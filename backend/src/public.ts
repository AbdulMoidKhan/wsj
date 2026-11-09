import {ValidatedBody,ValidatedQuery} from './validation';
import {publicSafe,eligibilityWhere,SCHEDULE_COLUMNS_OMIT} from './content-safety';
import {Controller,Get,Post,Param,BadRequestException,NotFoundException,Inject} from '@nestjs/common';
import {Throttle} from '@nestjs/throttler';
import {Db,parsePagination} from './core';
import {ListDto,InquiryDto,PopupEventDto} from './dto';
import {serviceSubtypes} from './admin';
import nodemailer from 'nodemailer';
export const kinds=['pages','services','pricing','blog','categories','tags','popups','settings','use-cases','testimonials','coworking','virtual-office','dedicated-desk','business-address','mailbox','podcast-packages','meeting-rooms','events-space','photo-studio','llc-services','workshops','webinars','memberships'];
export function kind(value:string){if(!kinds.includes(value))throw new NotFoundException();return value;}

/** Strip multi-MB legacy crawled link archives from public settings responses. */
function sanitizePublicRow(resource: string, row: any) {
  if (!row) return row;
  if (resource === 'settings' && row.metadata && typeof row.metadata === 'object' && 'links' in row.metadata) {
    const { links, ...cleanMetadata } = row.metadata;
    return { ...row, metadata: cleanMetadata };
  }
  return row;
}

const publicCache = new Map<string, { time: number; expiresAt: number; data: any }>();
let publicCacheGeneration = 0;

/**
 * Only scheduling boundaries can change eligibility without a database write. Same set of rows as
 * before (kind/status/search, regardless of eligibility), computed with SQL MIN() instead of
 * loading every row: the earliest future publishAt (and startsAt/endsAt for popups).
 */
async function nextEligibilityBoundary(db: Db, resource: string, base: any, now: Date) {
  const fields = resource === 'popups' ? ['publishAt', 'startsAt', 'endsAt'] : ['publishAt'];
  const mins = await Promise.all(fields.map(f => db.content.aggregate({where: {...base, [f]: {gt: now}}, _min: {[f]: true}} as any)));
  let next = Infinity;
  fields.forEach((f, i) => { const v = (mins[i] as any)?._min?.[f]; if (v) next = Math.min(next, new Date(v).getTime()); });
  return next;
}
export function getCachedPublic(key: string, ttlMs = 45000) {
  const item = publicCache.get(key);
  const now = Date.now();
  if (item && now - item.time < ttlMs && now < item.expiresAt) return item.data;
  return null;
}
export function setCachedPublic(key: string, data: any, expiresAt = Infinity, generation = publicCacheGeneration) {
  // An admin write may have cleared the cache while the database read was pending.
  if (generation !== publicCacheGeneration) return;
  publicCache.set(key, { time: Date.now(), expiresAt, data });
  if (publicCache.size > 500) {
    const oldest = publicCache.keys().next().value;
    if (oldest) publicCache.delete(oldest);
  }
}
export function clearPublicCache() {
  publicCacheGeneration++;
  publicCache.clear();
}

@Controller()
export class PublicController {
 constructor(@Inject(Db) private db:Db){}
 @Get('health') @Throttle({default:{limit:2000,ttl:60000}}) async health(){await this.db.$queryRaw`SELECT 1`;return {status:'ok'};}
 @Get('public/:resource') @Throttle({default:{limit:2000,ttl:60000}}) async list(@Param('resource') resource:string,@ValidatedQuery(ListDto) q:ListDto){
  const cacheKey = `list:${resource}:${JSON.stringify(q)}`;
  const cached = getCachedPublic(cacheKey);
  if (cached) return cached;
  const {page,limit,skip,take,search}=parsePagination(q,25);
  const subType = serviceSubtypes[resource];
  const kindFilter = subType ? {
    OR: [
      { kind: resource },
      { kind: 'services', metadata: { path: ['type'], equals: subType } }
    ]
  } : { kind: kind(resource) };
  const base={...kindFilter,status:'PUBLISHED' as const,...(search?{title:{contains:search,mode:'insensitive' as const}}:{})};
  const generation = publicCacheGeneration;
  const now = new Date(Date.now());
  // F-003: eligibility, totals and pagination run in SQL on the scheduling columns.
  const where={...base,...eligibilityWhere(resource, now)};
  const [rows,total,expiresAt] = await Promise.all([
   this.db.content.findMany({where,orderBy:[{sortOrder:'asc'},{createdAt:'desc'}],skip,take,omit:SCHEDULE_COLUMNS_OMIT}),
   this.db.content.count({where}),
   nextEligibilityBoundary(this.db, resource, base, now),
  ]);
  const sanitized = rows.map(row => sanitizePublicRow(resource, row));
  const result = publicSafe({items:sanitized,total,page,limit});
  setCachedPublic(cacheKey, result, expiresAt, generation);
  return result;
 }

 @Get('public/:resource/:slug') @Throttle({default:{limit:2000,ttl:60000}}) async detail(@Param('resource') resource:string,@Param('slug') slug:string){
  const cacheKey = `detail:${resource}:${slug}`;
  const cached = getCachedPublic(cacheKey);
  if (cached) return cached;
  const subType = serviceSubtypes[resource];
  const kindFilter = subType ? {
    OR: [
      { kind: resource },
      { kind: 'services', metadata: { path: ['type'], equals: subType } }
    ]
  } : { kind: kind(resource) };
  const generation = publicCacheGeneration;
  const now = new Date(Date.now());
  const base = {...kindFilter,slug,status:'PUBLISHED' as const};
  const item=await this.db.content.findFirst({where:{...base,...eligibilityWhere(resource, now)},omit:SCHEDULE_COLUMNS_OMIT});
  if(!item)throw new NotFoundException();
  const expiresAt = await nextEligibilityBoundary(this.db, resource, base, now);
  const result = publicSafe(sanitizePublicRow(resource, item));
  setCachedPublic(cacheKey, result, expiresAt, generation);
  return result;
 }
 @Post('inquiries') @Throttle({default:{limit:5,ttl:60000}})
 async inquiry(@ValidatedBody(InquiryDto) dto:InquiryDto){if(dto.website)throw new BadRequestException('Invalid submission');const {website,...data}=dto;const item=await this.db.inquiry.create({data});let emailStatus='NOT_CONFIGURED';if(process.env.SMTP_HOST&&process.env.INQUIRY_TO&&process.env.SMTP_FROM){try{const mail=nodemailer.createTransport({host:process.env.SMTP_HOST,port:Number(process.env.SMTP_PORT||587),secure:process.env.SMTP_PORT==='465',connectionTimeout:10000,socketTimeout:10000,...(process.env.SMTP_USER?{auth:{user:process.env.SMTP_USER,pass:process.env.SMTP_PASSWORD}}:{})});await mail.sendMail({from:process.env.SMTP_FROM,to:process.env.INQUIRY_TO,replyTo:dto.email,subject:'Website inquiry: '+(dto.service||'General'),text:dto.name+'\n'+dto.email+'\n'+(dto.phone||'')+'\n\n'+dto.message});emailStatus='SENT';}catch(err:any){console.error('[smtp] inquiry email dispatch failed:',err?.message||err);emailStatus='FAILED';}await this.db.inquiry.update({where:{id:item.id},data:{emailStatus}});}return {id:item.id,status:'received',emailStatus};}
 @Post('popup-events') @Throttle({default:{limit:60,ttl:60000}}) async event(@ValidatedBody(PopupEventDto) dto:PopupEventDto){const popup=await this.db.content.findFirst({where:{id:dto.popupId,kind:'popups',status:'PUBLISHED',...eligibilityWhere('popups',new Date(Date.now()))},select:{id:true}});if(!popup)throw new NotFoundException('Popup not found');await this.db.popupEvent.create({data:dto});return {recorded:true};}
}

