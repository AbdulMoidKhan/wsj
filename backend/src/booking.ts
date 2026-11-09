import {ValidatedBody,ValidatedQuery} from './validation';
import {Controller,Get,Post,Patch,Delete,Param,Req,Res,Headers,UseGuards,BadRequestException,NotFoundException,InternalServerErrorException,Inject} from '@nestjs/common';
import type {Request,Response} from 'express';
import {ApiBearerAuth} from '@nestjs/swagger';
import {Throttle} from '@nestjs/throttler';
import {IsIn,IsString,MaxLength,ValidateIf,IsInt,Min,Max} from 'class-validator';
import {Type} from 'class-transformer';
import Stripe from 'stripe';
import {Db,AuthGuard,Roles,parsePagination} from './core';
import {BookingDto,BookingUpdateDto} from './dto';
import {audit} from './admin';
import {frontendOrigins} from './origins';
import {CURRENCY,PLAN_CATALOG,publicCatalog,resolveBookingTotal,UnknownAddOnError,type PlanId} from './pricing-catalog';
import nodemailer from 'nodemailer';
import {PaymentClient} from './payments';
import {BillingWebhookService} from './billing';


async function sendBookingEmail(subject: string, item: {customerName:string;customerEmail:string;customerPhone?:string|null;serviceName:string;bookingDate?:string|null;bookingTime?:string|null;guests?:number|null;totalPrice:number;notes?:string|null}): Promise<string> {
 if (!(process.env.SMTP_HOST && process.env.INQUIRY_TO && process.env.SMTP_FROM)) return 'NOT_CONFIGURED';
 try {
  const mail = nodemailer.createTransport({host:process.env.SMTP_HOST,port:Number(process.env.SMTP_PORT||587),secure:process.env.SMTP_PORT==='465',connectionTimeout:10000,socketTimeout:10000,...(process.env.SMTP_USER?{auth:{user:process.env.SMTP_USER,pass:process.env.SMTP_PASSWORD}}:{})});
  await mail.sendMail({from:process.env.SMTP_FROM,to:process.env.INQUIRY_TO,replyTo:item.customerEmail,subject,text:item.customerName+'\n'+item.customerEmail+'\n'+(item.customerPhone||'')+'\nService: '+item.serviceName+'\nDate: '+(item.bookingDate||'TBD')+' '+(item.bookingTime||'')+'\nGuests: '+(item.guests||1)+'\nTotal: $'+item.totalPrice.toFixed(2)+'\n\nNotes: '+(item.notes||'None')});
  return 'SENT';
 } catch (err: any) {
  console.error('[smtp] sendBookingEmail failed:', err?.message || err);
  return 'FAILED';
 }
}

class BookingListDto {
 @ValidateIf((_object,value)=>value!==undefined) @Type(()=>Number) @IsInt() @Min(1) @Max(1000000) page:number=1;
 @ValidateIf((_object,value)=>value!==undefined) @Type(()=>Number) @IsInt() @Min(1) @Max(100) limit:number=50;
 @ValidateIf((_object,value)=>value!==undefined) @IsString() @MaxLength(200) search?:string;
 @ValidateIf((_object,value)=>value!==undefined) @IsIn(['PENDING','CONFIRMED','CANCELLED','COMPLETED','REFUNDED']) status?:string;
}

@Controller('public')
export class PublicBookingController {
 constructor(@Inject(Db) private db:Db){}
 @Get('booking-catalog') @Throttle({default:{limit:2000,ttl:60000}})
 catalog(){return publicCatalog();}
 // Booking IDs are random UUIDs, not sequential or guessable; this intentionally
 // returns only the minimal safe subset needed to render a "thank you" page,
 // never email/phone/notes, so a leaked single ID cannot expose customer PII.
 @Get('bookings/:id/confirmation') @Throttle({default:{limit:120,ttl:60000}})
 async confirmation(@Param('id') id:string){
  const item=await this.db.booking.findUnique({where:{id}});
  if(!item)throw new NotFoundException();
  return {id:item.id,status:item.status,serviceName:item.serviceName,bookingDate:item.bookingDate,bookingTime:item.bookingTime,totalPrice:item.totalPrice,currency:CURRENCY};
 }
}

@Controller()
export class BookingController {
 constructor(@Inject(Db) private db:Db,@Inject(PaymentClient) private payments:PaymentClient=new PaymentClient()){}

 @Post('bookings') @Throttle({default:{limit:3,ttl:60000}})
 async create(@ValidatedBody(BookingDto) dto:BookingDto){
  if(dto.website)throw new BadRequestException('Invalid submission');
  const {website,couponCode,addOns,planId,...data}=dto;

  let resolved;
  try{resolved=resolveBookingTotal(planId,addOns||[]);}
  catch(error){if(error instanceof UnknownAddOnError)throw new BadRequestException('Unknown add-on: '+error.addOnId);throw error;}

  const stripe=this.payments.client();
  let promotionCodeId:string|undefined;
  if(couponCode){
   const promos=await stripe.promotionCodes.list({code:couponCode,active:true,limit:1});
   if(!promos.data.length)throw new BadRequestException('Invalid or expired coupon code');
   promotionCodeId=promos.data[0].id;
  }

  // Create the booking as PENDING before contacting Stripe: if Stripe itself is
  // unreachable we still want a durable record of the attempt to diagnose from
  // admin, and we delete it below if the checkout session cannot be created.
  const item=await this.db.booking.create({data:{...data,addOns:addOns||[],couponCode,status:'PENDING',subtotalPrice:resolved.subtotalCents/100,totalPrice:resolved.totalCents/100,subtotalPriceCents:resolved.subtotalCents,totalPriceCents:resolved.totalCents}});

  const origin=frontendOrigins()[0];
  const plan=PLAN_CATALOG[planId as PlanId];
  const lineItems:Stripe.Checkout.SessionCreateParams.LineItem[]=[
   {quantity:1,price_data:{currency:CURRENCY,unit_amount:plan.amountCents,product_data:{name:plan.name+' Plan',description:data.serviceName.slice(0,300)}}},
   ...resolved.addOns.map(addOn=>({quantity:1,price_data:{currency:CURRENCY,unit_amount:addOn.amountCents,product_data:{name:addOn.name}}} satisfies Stripe.Checkout.SessionCreateParams.LineItem)),
  ];

  let session:Stripe.Checkout.Session;
  try{
   session=await stripe.checkout.sessions.create({
    mode:'payment',
    line_items:lineItems,
    customer_email:data.customerEmail,
    client_reference_id:item.id,
    metadata:{bookingId:item.id},
    payment_intent_data:{metadata:{bookingId:item.id}},
    ...(promotionCodeId?{discounts:[{promotion_code:promotionCodeId}]}:{}),
    success_url:origin+'/booking-confirmation/?booking='+item.id,
    cancel_url:origin+'/?booking_cancelled='+item.id,
   });
  }catch{
   await this.db.booking.delete({where:{id:item.id}}).catch(()=>{});
   throw new BadRequestException('Unable to start checkout. Please try again.');
  }

  await this.db.booking.update({where:{id:item.id},data:{stripeResponse:{checkoutSessionId:session.id,createdAt:new Date().toISOString()}}});
  return {id:item.id,status:'pending_payment',checkoutUrl:session.url};
 }
}

@Controller('webhooks')
export class StripeWebhookController {
 constructor(@Inject(Db) private db:Db,@Inject(PaymentClient) private payments:PaymentClient=new PaymentClient(),@Inject(BillingWebhookService) private billing?:BillingWebhookService){}
 // No AuthGuard/Origin check: this endpoint is called server-to-server by
 // Stripe, authenticated purely by the signed payload below. @Throttle is a
 // high ceiling, not a rate limit on legitimate Stripe delivery.
 @Post('stripe') @Throttle({default:{limit:600,ttl:60000}})
 async handle(@Req() req:Request&{rawBody?:Buffer},@Headers('stripe-signature') signature:string|undefined,@Res() res:Response){
  const secret=process.env.STRIPE_WEBHOOK_SECRET?.trim();
  if(!secret||!signature||!req.rawBody)return res.status(400).json({message:'Webhook not configured or signature missing'});
  let event:Stripe.Event;
  try{event=this.payments.client().webhooks.constructEvent(req.rawBody,signature,secret);}
  catch{return res.status(400).json({message:'Invalid signature'});}

  // Billing (orders, subscriptions, invoices) is journaled and processed idempotently
  // by its own service. Legacy booking events keep the original path below.
  if(BillingWebhookService.handles(event)){
   if(!this.billing)return res.status(200).json({received:true,ignored:'billing processor unavailable'});
   try{const outcome=await this.billing.process(event);return res.status(200).json({received:true,outcome});}
   catch{console.error('[stripe-webhook] billing processing failed; retry required');return res.status(503).json({received:false,message:'Temporary processing failure'});}
  }

  try{
   if(event.type==='checkout.session.completed'||event.type==='checkout.session.async_payment_succeeded'){
    const session=event.data.object as Stripe.Checkout.Session;
    const bookingId=session.metadata?.bookingId||session.client_reference_id;
    if(bookingId&&session.payment_status==='paid'){
     const item=await this.db.booking.findUnique({where:{id:bookingId}});
     // Idempotent: a webhook can be delivered more than once for the same
     // event. Only act, and only send one confirmation email, the first time.
     if(item&&item.status!=='CONFIRMED'){
      const paymentIntentId=typeof session.payment_intent==='string'?session.payment_intent:session.payment_intent?.id;
      const emailStatus=await sendBookingEmail('Booking confirmed: '+item.serviceName,item);
      await this.db.booking.update({where:{id:bookingId},data:{status:'CONFIRMED',stripePaymentIntentId:paymentIntentId,emailStatus,stripeResponse:{...(item.stripeResponse as object||{}),checkoutSessionId:session.id,paymentIntentId,amountTotalCents:session.amount_total,eventId:event.id,confirmedAt:new Date().toISOString()}}});
     }
    }
   }else if(event.type==='checkout.session.expired'){
    const session=event.data.object as Stripe.Checkout.Session;
    const bookingId=session.metadata?.bookingId||session.client_reference_id;
    if(bookingId){
     const item=await this.db.booking.findUnique({where:{id:bookingId}});
     if(item&&item.status==='PENDING')await this.db.booking.update({where:{id:bookingId},data:{status:'CANCELLED'}});
    }
   }
  }catch{
   // A paid event is not handled until its state is durably saved. Acknowledge
   // transient failures with a retryable response so Stripe can redeliver.
   // Never include payloads, credentials or database errors in this response.
   console.error('[stripe-webhook] processing failed; retry required');
   return res.status(503).json({received:false,message:'Temporary processing failure'});
  }
  return res.status(200).json({received:true});
 }
}

@ApiBearerAuth() @UseGuards(AuthGuard) @Controller('admin/bookings')
export class BookingAdminController {
 constructor(@Inject(Db) private db:Db,@Inject(PaymentClient) private payments:PaymentClient=new PaymentClient()){}
 @Get() async list(@ValidatedQuery(BookingListDto) q:BookingListDto){
  const {page,limit,skip,take,search,status}=parsePagination(q,10);
  const where={...(status?{status:status as any}:{}),...(search?{OR:[{customerName:{contains:search,mode:'insensitive' as const}},{customerEmail:{contains:search,mode:'insensitive' as const}},{serviceName:{contains:search,mode:'insensitive' as const}}]}:{})};
  const [items,total]=await Promise.all([this.db.booking.findMany({where,skip,take,orderBy:{createdAt:'desc'}}),this.db.booking.count({where})]);
  return {items,total,page,limit};
 }
 @Get(':id') async detail(@Param('id') id:string){const item=await this.db.booking.findUnique({where:{id}});if(!item)throw new NotFoundException();return item;}
 @Patch(':id') @Roles('ADMIN','EDITOR') async update(@Param('id') id:string,@ValidatedBody(BookingUpdateDto) dto:BookingUpdateDto,@Req() req:any){
  const item=await this.db.booking.findUnique({where:{id}});
  if(!item)throw new NotFoundException();
  let extra:{stripeResponse?:any}={};
  if(dto.status==='REFUNDED'&&item.status!=='REFUNDED'){
   if(!item.stripePaymentIntentId)throw new BadRequestException('No payment on this booking to refund');
   try{
    const refund=await this.payments.client().refunds.create({payment_intent:item.stripePaymentIntentId});
    extra={stripeResponse:{...(item.stripeResponse as object||{}),refundId:refund.id,refundedAt:new Date().toISOString()}};
   }catch{throw new BadRequestException('Stripe refund failed; booking status was not changed');}
  }
  const updated=await this.db.booking.update({where:{id},data:{...dto,...extra}});
  await audit(this.db,req,'UPDATE','bookings',id);
  return updated;
 }
 @Delete(':id') @Roles('ADMIN') async remove(@Param('id') id:string,@Req() req:any){const item=await this.db.booking.findUnique({where:{id}});if(!item)throw new NotFoundException();await this.db.booking.delete({where:{id}});await audit(this.db,req,'DELETE','bookings',id);return {deleted:true};}
}

