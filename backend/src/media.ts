import {ValidatedBody,ValidatedQuery} from './validation';
import {Controller,Get,Post,Patch,Delete,Param,Req,UseGuards,BadRequestException,NotFoundException,UseInterceptors,UploadedFile,Inject} from '@nestjs/common';
import {ApiConsumes,ApiBearerAuth,ApiBody} from '@nestjs/swagger';
import {FileInterceptor} from '@nestjs/platform-express';
import {randomUUID} from 'node:crypto';
import {mkdir,writeFile,unlink} from 'node:fs/promises';
import path from 'node:path';
import {Db,AuthGuard,Roles,parsePagination} from './core';
import {ListDto,MediaDto,PresignUploadDto,FinalizeUploadDto} from './dto';
import {audit} from './admin';
import {R2StorageService,assertManagedKey} from './storage';

@ApiBearerAuth() @UseGuards(AuthGuard) @Controller('admin/media')
export class MediaController {
 constructor(
  @Inject(Db) private db:Db,
  @Inject(R2StorageService) private storage:R2StorageService
 ){}

 @Get() async list(@ValidatedQuery(ListDto) q:ListDto){
  const {page,limit,skip,take,search}=parsePagination(q,10);
  const where=search?{OR:[{originalName:{contains:search,mode:'insensitive' as const}},{alt:{contains:search,mode:'insensitive' as const}}]}:{};
  const [items,total]=await Promise.all([this.db.media.findMany({where,skip,take,orderBy:{createdAt:'desc'}}),this.db.media.count({where})]);
  return {items,total,page,limit};
 }

 @Post('presign')
 @Roles('ADMIN','EDITOR')
 async presign(@ValidatedBody(PresignUploadDto) dto:PresignUploadDto){
  if(!this.storage.isConfigured()){
   throw new BadRequestException('Direct R2 presigned uploads require R2 credentials to be configured.');
  }
  return this.storage.generatePresignedUploadUrl({
   category: dto.category,
   originalName: dto.filename,
   contentType: dto.contentType,
   contentLength: dto.contentLength,
  });
 }

 @Post('finalize')
 @Roles('ADMIN','EDITOR')
 async finalize(@ValidatedBody(FinalizeUploadDto) dto:FinalizeUploadDto,@Req() req:any){
  assertManagedKey(dto.key);
  if(!this.storage.isConfigured()){
   throw new BadRequestException('Direct R2 uploads require R2 credentials to be configured.');
  }
  const exists = await this.storage.fileExists(dto.key);
  if(!exists){
   throw new NotFoundException('Uploaded file not found on object storage');
  }
  const meta = await this.storage.getFileMetadata(dto.key);
  const original = dto.originalName || path.basename(dto.key);
  const url = this.storage.getPublicUrl(dto.key);
  const item = await this.db.media.create({
   data: {
    filename: dto.key,
    originalName: original.slice(0, 255),
    mimeType: meta.contentType || 'application/octet-stream',
    size: meta.size,
    alt: dto.alt || '',
    url,
   }
  });
  await audit(this.db,req,'CREATE','media',item.id);
  return item;
 }

 @Post() @Roles('ADMIN','EDITOR') @ApiConsumes('multipart/form-data') @ApiBody({schema:{type:'object',properties:{file:{type:'string',format:'binary'},alt:{type:'string'}}}}) @UseInterceptors(FileInterceptor('file',{limits:{fileSize:25*1024*1024,files:1}}))
 async upload(@UploadedFile() file:Express.Multer.File,@ValidatedBody(MediaDto) dto:MediaDto,@Req() req:any){
  if(!file)throw new BadRequestException('File required');
  const b=file.buffer;
  let ext='',mime='';
  if(b.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))){ext='png';mime='image/png';}
  else if(b[0]===255&&b[1]===216&&b[2]===255){ext='jpg';mime='image/jpeg';}
  else if(b.toString('ascii',0,4)==='RIFF'&&b.toString('ascii',8,12)==='WEBP'){ext='webp';mime='image/webp';}
  else if(b.toString('ascii',0,5)==='%PDF-'){ext='pdf';mime='application/pdf';}
  if(!ext||file.mimetype!==mime)throw new BadRequestException('Only signature-verified PNG, JPEG, WebP and PDF allowed');

  // If R2 storage is configured, upload directly to Cloudflare R2
  if(this.storage.isConfigured()){
   const stored = await this.storage.uploadFile({
    category: 'images',
    buffer: b,
    originalName: file.originalname,
    contentType: mime,
   });
   const item = await this.db.media.create({
    data: {
     filename: stored.key,
     originalName: path.basename(file.originalname).slice(0,255),
     mimeType: mime,
     size: file.size,
     alt: dto.alt || '',
     url: stored.url,
    }
   });
   await audit(this.db,req,'CREATE','media',item.id);
   return item;
  }

  // Fallback to local disk when R2 is not configured
  const filename=randomUUID()+'.'+ext;
  const folder=path.resolve(process.env.UPLOAD_DIR||'uploads');
  await mkdir(folder,{recursive:true});
  await writeFile(path.join(folder,filename),b,{flag:'wx'});
  const item=await this.db.media.create({
   data: {
    filename,
    originalName:path.basename(file.originalname).slice(0,255),
    mimeType:mime,
    size:file.size,
    alt:dto.alt||'',
    url:(process.env.API_ORIGIN||'http://localhost:4000')+'/uploads/'+filename
   }
  });
  await audit(this.db,req,'CREATE','media',item.id);
  return item;
 }

 @Patch(':id') @Roles('ADMIN','EDITOR') async update(@Param('id') id:string,@ValidatedBody(MediaDto) dto:MediaDto,@Req() req:any){
  const item=await this.db.media.update({where:{id},data:dto});
  await audit(this.db,req,'UPDATE','media',id);
  return item;
 }

 @Delete(':id') @Roles('ADMIN','EDITOR') async remove(@Param('id') id:string,@Req() req:any){
  const item=await this.db.media.findUnique({where:{id}});
  if(!item)throw new NotFoundException();

  // If stored in R2, delete from bucket if unreferenced
  if(this.storage.isConfigured() && item.filename.includes('/')){
   await this.storage.deleteFile(item.filename, {
    isReferenced: async (key) => {
     const count = await this.db.media.count({where: {filename: key, id: {not: id}}});
     return count > 0;
    }
   }).catch((e:any)=>{
    // Ignore 404/not found errors on delete
   });
  } else {
   // Local file fallback
   await unlink(path.join(path.resolve(process.env.UPLOAD_DIR||'uploads'),item.filename)).catch((e:any)=>{if(e.code!=='ENOENT')throw e;});
  }

  await this.db.media.delete({where:{id}});
  await audit(this.db,req,'DELETE','media',id);
  return {deleted:true};
 }
}

