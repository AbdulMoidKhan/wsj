import {ValidatedBody,ValidatedQuery} from './validation';
import {cleanContent,configurationErrors,scheduleColumns} from './content-safety';
import {Controller,Get,Post,Patch,Delete,Param,Req,UseGuards,BadRequestException,NotFoundException,ForbiddenException,Inject} from '@nestjs/common';
import {ApiBearerAuth} from '@nestjs/swagger';
import {hash} from 'bcryptjs';
import {Db,AuthGuard,Roles,parsePagination} from './core';
import {ContentDto,UpdateContentDto,UserDto,UpdateUserDto,InquiryUpdateDto,InquiryListDto,ListDto} from './dto';
import {kind,clearPublicCache} from './public';

export const serviceSubtypes: Record<string, string> = {
  'coworking': 'csb_studios',
  'virtual-office': 'csb_virtual_office',
  'dedicated-desk': 'csb_dedicated_desk',
  'business-address': 'csb_business_address',
  'mailbox': 'csb_email_box',
  'podcast-packages': 'csb_podcast_packages',
  'meeting-rooms': 'csb_meeting_rooms',
  'events-space': 'csb_events_space',
  'photo-studio': 'csb_photo_studio',
  'llc-services': 'csb_llc',
  'workshops': 'csb_workshops',
  'webinars': 'csb_webinars',
  'memberships': 'csb_memberships',
};

export async function audit(db:Db,req:any,action:string,resource:string,resourceId?:string){await db.audit.create({data:{actorId:req.user.id,action,resource,resourceId}});}
const safeUser={id:true,email:true,name:true,role:true,active:true,createdAt:true,updatedAt:true} as const;

@ApiBearerAuth() @UseGuards(AuthGuard) @Roles('ADMIN') @Controller('admin/users')
export class UsersController {
 constructor(@Inject(Db) private db:Db){}
 @Get() async list(@ValidatedQuery(ListDto) q:ListDto){
  const {page,limit,skip,take}=parsePagination(q,10);
  const [items,total]=await Promise.all([this.db.user.findMany({select:safeUser,skip,take,orderBy:{createdAt:'desc'}}),this.db.user.count()]);
  return {items,total,page,limit};
 }
 @Post() async create(@ValidatedBody(UserDto) dto:UserDto,@Req() req:any){const {password,...data}=dto;const item=await this.db.user.create({data:{...data,email:dto.email.toLowerCase(),passwordHash:await hash(password,12)},select:safeUser});await audit(this.db,req,'CREATE','users',item.id);return item;}
 @Patch(':id') async update(@Param('id') id:string,@ValidatedBody(UpdateUserDto) dto:UpdateUserDto,@Req() req:any){if(id===req.user.id&&(dto.active===false||(dto.role&&dto.role!=='ADMIN')))throw new BadRequestException('Cannot disable or demote yourself');const {password,...data}=dto;const item=await this.db.user.update({where:{id},data:{...data,...(dto.email?{email:dto.email.toLowerCase()}:{}),...(password?{passwordHash:await hash(password,12)}:{}),tokenVersion:{increment:1}},select:safeUser});await audit(this.db,req,'UPDATE','users',id);return item;}
 @Delete(':id') async remove(@Param('id') id:string,@Req() req:any){if(id===req.user.id)throw new BadRequestException('Cannot delete yourself');await this.db.user.delete({where:{id}});await audit(this.db,req,'DELETE','users',id);return {deleted:true};}
}

@ApiBearerAuth() @UseGuards(AuthGuard) @Controller('admin')
export class OperationsController {
 constructor(@Inject(Db) private db:Db){}
 @Get('inquiries') async inquiries(@ValidatedQuery(InquiryListDto) q:InquiryListDto){
  const {page,limit,skip,take,search,status}=parsePagination(q,10);
  const where={...(status?{status}:{}),...(search?{OR:[{name:{contains:search,mode:'insensitive' as const}},{email:{contains:search,mode:'insensitive' as const}},{message:{contains:search,mode:'insensitive' as const}}]}:{})};
  const [items,total]=await Promise.all([this.db.inquiry.findMany({where,skip,take,orderBy:{createdAt:'desc'}}),this.db.inquiry.count({where})]);
  return {items,total,page,limit};
 }
 @Patch('inquiries/:id') @Roles('ADMIN','EDITOR') async updateInquiry(@Param('id') id:string,@ValidatedBody(InquiryUpdateDto) dto:InquiryUpdateDto,@Req() req:any){const item=await this.db.inquiry.update({where:{id},data:dto});await audit(this.db,req,'UPDATE','inquiries',id);return item;}
 @Delete('inquiries/:id') @Roles('ADMIN') async deleteInquiry(@Param('id') id:string,@Req() req:any){await this.db.inquiry.delete({where:{id}});await audit(this.db,req,'DELETE','inquiries',id);return {deleted:true};}
 @Get('audit') @Roles('ADMIN') async logs(@ValidatedQuery(ListDto) q:ListDto){
  const {page,limit,skip,take}=parsePagination(q,10);
  const [items,total]=await Promise.all([this.db.audit.findMany({skip,take,orderBy:{createdAt:'desc'}}),this.db.audit.count()]);
  return {items,total,page,limit};
 }
 @Get('popup-stats') async popupStats(){const grouped=await this.db.popupEvent.groupBy({by:['popupId','event'],_count:{_all:true}});const stats=new Map<string,any>();for(const row of grouped){const item=stats.get(row.popupId)||{popupId:row.popupId,views:0,clicks:0,dismissals:0,submissions:0};const key=({view:'views',click:'clicks',dismiss:'dismissals',submit:'submissions'} as Record<string,string>)[row.event];if(key)item[key]=row._count._all;stats.set(row.popupId,item);}return {items:[...stats.values()].map(item=>({...item,conversionRate:item.views?item.submissions/item.views:0}))};}
 @Get('popup-events') async events(@ValidatedQuery(ListDto) q:ListDto){
  const {page,limit,skip,take}=parsePagination(q,10);
  const [items,total]=await Promise.all([this.db.popupEvent.findMany({skip,take,orderBy:{createdAt:'desc'}}),this.db.popupEvent.count()]);
  return {items,total,page,limit};
 }
}

@ApiBearerAuth() @UseGuards(AuthGuard) @Controller('admin')
export class ContentController {
 constructor(@Inject(Db) private db:Db){}
 private check(resource:string,req:any,write=false){kind(resource);if(resource==='settings'&&req.user.role!=='ADMIN')throw new ForbiddenException();if(write&&req.user.role==='VIEWER')throw new ForbiddenException();}
 @Get(':resource') async list(@Param('resource') resource:string,@ValidatedQuery(ListDto) q:ListDto,@Req() req:any){
  this.check(resource,req);
  const {page,limit,skip,take,search,status}=parsePagination(q,10);
  const subType = serviceSubtypes[resource];
  const kindFilter = subType ? {
    OR: [
      { kind: resource },
      { kind: 'services', metadata: { path: ['type'], equals: subType } }
    ]
  } : { kind: resource };
  const where: any = {
    ...kindFilter,
    ...(status?{status}:{}),
    ...(search?{title:{contains:search,mode:'insensitive' as const}}:{})
  };
  const [items,total]=await Promise.all([
    this.db.content.findMany({where,skip,take,orderBy:[{sortOrder:'asc'},{createdAt:'desc'}]}),
    this.db.content.count({where})
  ]);
  return {items,total,page,limit};
 }
 @Get(':resource/:id') async detail(@Param('resource') resource:string,@Param('id') id:string,@Req() req:any){
  this.check(resource,req);
  const subType = serviceSubtypes[resource];
  const kindFilter = subType ? {
    OR: [
      { kind: resource },
      { kind: 'services', metadata: { path: ['type'], equals: subType } }
    ]
  } : { kind: resource };
  const item=await this.db.content.findFirst({where:{id,...kindFilter}});
  if(!item)throw new NotFoundException();
  return item;
 }
 @Post(':resource') async create(@Param('resource') resource:string,@ValidatedBody(ContentDto) dto:ContentDto,@Req() req:any){
  this.check(resource,req,true);
  const errors=configurationErrors(resource,dto.metadata);
  if(errors.length)throw new BadRequestException(errors);
  const subType = serviceSubtypes[resource];
  const metadata = cleanContent(dto.metadata||{});
  if(subType && !metadata.type) metadata.type = subType;
  const item=await this.db.content.create({data:{...dto,content:cleanContent(dto.content||{}),metadata,...scheduleColumns(metadata),kind:resource}});
  clearPublicCache();
  await audit(this.db,req,'CREATE',resource,item.id);
  return item;
 }
 @Patch(':resource/:id') async update(@Param('resource') resource:string,@Param('id') id:string,@ValidatedBody(UpdateContentDto) dto:UpdateContentDto,@Req() req:any){
  this.check(resource,req,true);
  await this.detail(resource,id,req);
  const errors=configurationErrors(resource,dto.metadata);
  if(errors.length)throw new BadRequestException(errors);
  const metadata=dto.metadata?cleanContent(dto.metadata):undefined;
  const item=await this.db.content.update({where:{id},data:{...dto,...(dto.content?{content:cleanContent(dto.content)}:{}),...(metadata?{metadata,...scheduleColumns(metadata)}:{})}});
  clearPublicCache();
  await audit(this.db,req,'UPDATE',resource,id);
  return item;
 }
 @Delete(':resource/:id') async remove(@Param('resource') resource:string,@Param('id') id:string,@Req() req:any){
  this.check(resource,req,true);
  await this.detail(resource,id,req);
  await this.db.content.delete({where:{id}});
  clearPublicCache();
  await audit(this.db,req,'DELETE',resource,id);
  return {deleted:true};
 }
}


