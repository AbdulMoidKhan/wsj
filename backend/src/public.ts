import {ValidatedBody,ValidatedQuery} from './validation';
import {publicSafe,contentEligible} from './content-safety';
import {Controller,Get,Post,Param,BadRequestException,NotFoundException,Inject} from '@nestjs/common';
import {Throttle} from '@nestjs/throttler';
import {Db,parsePagination} from './core';
import {ListDto,InquiryDto,PopupEventDto} from './dto';
import {serviceSubtypes} from './admin';
import nodemailer from 'nodemailer';
export const kinds=['pages','services','pricing','blog','categories','tags','popups','settings','use-cases','testimonials','coworking','virtual-office','dedicated-desk','business-address','mailbox','podcast-packages','meeting-rooms','events-space','photo-studio','llc-services','workshops','webinars','memberships'];
export function kind(value:string){if(!kinds.includes(value))throw new NotFoundException();return value;}
@Controller()
export class PublicController {
 constructor(@Inject(Db) private db:Db){}
 @Get('health') @Throttle({default:{limit:2000,ttl:60000}}) async health(){await this.db.$queryRawUnsafe('SELECT 1');return {status:'ok'};}
 @Get('public/:resource') @Throttle({default:{limit:2000,ttl:60000}}) async list(@Param('resource') resource:string,@ValidatedQuery(ListDto) q:ListDto){
  const {page,limit,skip,take,search}=parsePagination(q,25);
  const subType = serviceSubtypes[resource];
  const kindFilter = subType ? {
    OR: [
      { kind: resource },
      { kind: 'services', metadata: { path: ['type'], equals: subType } }
    ]
  } : { kind: kind(resource) };
  const where={...kindFilter,status:'PUBLISHED' as const,...(search?{title:{contains:search,mode:'insensitive' as const}}:{})};
  const eligible=(await this.db.content.findMany({where,orderBy:[{sortOrder:'asc'},{createdAt:'desc'}]})).filter(row=>contentEligible(resource,row));
  return publicSafe({items:eligible.slice(skip,skip+take),total:eligible.length,page,limit});
 }

 @Get('public/:resource/:slug') @Throttle({default:{limit:2000,ttl:60000}}) async detail(@Param('resource') resource:string,@Param('slug') slug:string){
  const subType = serviceSubtypes[resource];
  const kindFilter = subType ? {
    OR: [
      { kind: resource },
      { kind: 'services', metadata: { path: ['type'], equals: subType } }
    ]
  } : { kind: kind(resource) };
  const item=await this.db.content.findFirst({where:{...kindFilter,slug,status:'PUBLISHED'}});
  if(!item||!contentEligible(resource,item))throw new NotFoundException();
  return publicSafe(item);
 }
 @Post('inquiries') @Throttle({default:{limit:5,ttl:60000}})
 async inquiry(@ValidatedBody(InquiryDto) dto:InquiryDto){if(dto.website)throw new BadRequestException('Invalid submission');const {website,...data}=dto;const item=await this.db.inquiry.create({data});let emailStatus='NOT_CONFIGURED';if(process.env.SMTP_HOST&&process.env.INQUIRY_TO&&process.env.SMTP_FROM){try{const mail=nodemailer.createTransport({host:process.env.SMTP_HOST,port:Number(process.env.SMTP_PORT||587),secure:process.env.SMTP_PORT==='465',connectionTimeout:10000,socketTimeout:10000,...(process.env.SMTP_USER?{auth:{user:process.env.SMTP_USER,pass:process.env.SMTP_PASSWORD}}:{})});await mail.sendMail({from:process.env.SMTP_FROM,to:process.env.INQUIRY_TO,replyTo:dto.email,subject:'Website inquiry: '+(dto.service||'General'),text:dto.name+'\n'+dto.email+'\n'+(dto.phone||'')+'\n\n'+dto.message});emailStatus='SENT';}catch{emailStatus='FAILED';}await this.db.inquiry.update({where:{id:item.id},data:{emailStatus}});}return {id:item.id,status:'received',emailStatus};}
 @Post('popup-events') @Throttle({default:{limit:60,ttl:60000}}) async event(@ValidatedBody(PopupEventDto) dto:PopupEventDto){const popup=await this.db.content.findFirst({where:{id:dto.popupId,kind:'popups',status:'PUBLISHED'}});if(!popup||!contentEligible('popups',popup))throw new NotFoundException('Popup not found');await this.db.popupEvent.create({data:dto});return {recorded:true};}
}

