import { IsString, IsEmail, MinLength, MaxLength, IsIn, IsObject, IsInt, Min, Max, IsBoolean, Matches, ValidateIf, registerDecorator } from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { ApiProperty, PartialType } from '@nestjs/swagger';
function PasswordBytes(){return (object:object,propertyName:string)=>registerDecorator({name:'passwordBytes',target:object.constructor,propertyName,validator:{validate:(value:unknown)=>typeof value==='string'&&Buffer.byteLength(value,'utf8')<=72,defaultMessage:()=> 'Password must not exceed 72 UTF-8 bytes'}});}
export class LoginDto {
 @ApiProperty() @IsEmail() email!:string;
 @ApiProperty() @IsString() @MinLength(1) @MaxLength(128) password!:string;
}
export class ContentDto {
 @ApiProperty() @IsString() @MinLength(1) @MaxLength(300) title!:string;
 @ApiProperty() @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/) @MaxLength(200) slug!:string;
 @ApiProperty({enum:['DRAFT','PUBLISHED','ARCHIVED'],required:false}) @ValidateIf((_object,value)=>value!==undefined) @IsIn(['DRAFT','PUBLISHED','ARCHIVED']) status?:'DRAFT'|'PUBLISHED'|'ARCHIVED';
 @ValidateIf((_object,value)=>value!==undefined) @IsString() @MaxLength(2000) excerpt?:string;
 @ApiProperty({type:Object,required:false}) @ValidateIf((_object,value)=>value!==undefined) @IsObject() content?:Record<string,any>;
 @ApiProperty({type:Object,required:false}) @ValidateIf((_object,value)=>value!==undefined) @IsObject() metadata?:Record<string,any>;
 @ValidateIf((_object,value)=>value!==undefined) @IsInt() @Min(-2147483648) @Max(2147483647) sortOrder?:number;
}
export class UpdateContentDto extends PartialType(ContentDto,{skipNullProperties:false}){}
export class UserDto {
 @ApiProperty() @IsEmail() email!:string;
 @ApiProperty() @IsString() @MinLength(1) @MaxLength(200) name!:string;
 @ApiProperty() @IsString() @MinLength(12) @MaxLength(128) @PasswordBytes() password!:string;
 @ApiProperty({enum:['ADMIN','EDITOR','VIEWER']}) @IsIn(['ADMIN','EDITOR','VIEWER']) role!:'ADMIN'|'EDITOR'|'VIEWER';
 @ValidateIf((_object,value)=>value!==undefined) @IsBoolean() active?:boolean;
}
export class UpdateUserDto extends PartialType(UserDto,{skipNullProperties:false}){}
export class InquiryDto {
 @ApiProperty() @Transform(({value})=>typeof value==='string'?value.trim():value) @IsString() @MinLength(1) @MaxLength(200) name!:string;
 @ApiProperty() @Transform(({value})=>typeof value==='string'?value.trim():value) @IsEmail() @MaxLength(254) email!:string;
 @ValidateIf((_object,value)=>value!==undefined) @Transform(({value})=>typeof value==='string'?value.trim():value) @IsString() @MaxLength(50) phone?:string;
 @ValidateIf((_object,value)=>value!==undefined) @Transform(({value})=>typeof value==='string'?value.trim():value) @IsString() @MaxLength(200) service?:string;
 @ApiProperty() @Transform(({value})=>typeof value==='string'?value.trim():value) @IsString() @MinLength(3) @MaxLength(10000) message!:string;
 @ValidateIf((_object,value)=>value!==undefined) @Transform(({value})=>typeof value==='string'?value.trim():value) @IsString() @MaxLength(200) website?:string;
}
export class InquiryUpdateDto { @ApiProperty({enum:['NEW','READ','RESOLVED']}) @IsIn(['NEW','READ','RESOLVED']) status!:string; }
export class PopupEventDto {
 @ApiProperty() @IsString() @MaxLength(100) popupId!:string;
 @ApiProperty({enum:['view','click','dismiss','submit']}) @IsIn(['view','click','dismiss','submit']) event!:string;
 @ValidateIf((_object,value)=>value!==undefined) @IsString() @MaxLength(100) sessionId?:string;
}
export class ListDto {
 @ValidateIf((_object,value)=>value!==undefined) @Type(()=>Number) @IsInt() @Min(1) @Max(1000000) page:number=1;
 @ValidateIf((_object,value)=>value!==undefined) @Type(()=>Number) @IsInt() @Min(1) @Max(100) limit:number=50;
 @ValidateIf((_object,value)=>value!==undefined) @IsString() @MaxLength(200) search?:string;
 @ValidateIf((_object,value)=>value!==undefined) @IsIn(['DRAFT','PUBLISHED','ARCHIVED']) status?:'DRAFT'|'PUBLISHED'|'ARCHIVED';
}
export class MediaDto { @ValidateIf((_object,value)=>value!==undefined) @IsString() @MaxLength(300) alt?:string; }
export class InquiryListDto {
 @ValidateIf((_object,value)=>value!==undefined) @Type(()=>Number) @IsInt() @Min(1) @Max(1000000) page:number=1;
 @ValidateIf((_object,value)=>value!==undefined) @Type(()=>Number) @IsInt() @Min(1) @Max(100) limit:number=50;
 @ValidateIf((_object,value)=>value!==undefined) @IsString() @MaxLength(200) search?:string;
 @ValidateIf((_object,value)=>value!==undefined) @IsIn(['NEW','READ','RESOLVED']) status?:string;
}
import {IsArray,ArrayMaxSize,ArrayUnique,IsDateString} from 'class-validator';
import {PLAN_IDS,ADDON_IDS,type PlanId,type AddOnId} from './pricing-catalog';
export class BookingDto {
 @ApiProperty() @Transform(({value})=>typeof value==='string'?value.trim():value) @IsString() @MinLength(1) @MaxLength(200) customerName!:string;
 @ApiProperty() @Transform(({value})=>typeof value==='string'?value.trim():value) @IsEmail() @MaxLength(254) customerEmail!:string;
 @ValidateIf((_object,value)=>value!==undefined) @Transform(({value})=>typeof value==='string'?value.trim():value) @IsString() @MaxLength(50) customerPhone?:string;
 @ApiProperty() @Transform(({value})=>typeof value==='string'?value.trim():value) @IsString() @MinLength(1) @MaxLength(100) serviceType!:string;
 @ValidateIf((_object,value)=>value!==undefined) @IsString() @MaxLength(100) serviceId?:string;
 @ApiProperty() @Transform(({value})=>typeof value==='string'?value.trim():value) @IsString() @MinLength(1) @MaxLength(300) serviceName!:string;
 // The only price-bearing input: an id into the server's own catalog. The
 // client can never supply a price directly (see pricing-catalog.ts).
 @ApiProperty({enum:PLAN_IDS}) @IsIn(PLAN_IDS) planId!:PlanId;
 @ValidateIf((_object,value)=>value!==undefined) @IsDateString({strict:true}) @MaxLength(50) bookingDate?:string;
 @ValidateIf((_object,value)=>value!==undefined) @IsString() @MaxLength(20) bookingTime?:string;
 @ValidateIf((_object,value)=>value!==undefined) @Type(()=>Number) @IsInt() @Min(1) @Max(2147483647) duration?:number;
 @ValidateIf((_object,value)=>value!==undefined) @Type(()=>Number) @IsInt() @Min(1) @Max(500) guests?:number;
 // Each element must be a known catalog add-on id; an unrecognized id is
 // rejected here rather than silently dropped or priced as zero. Duplicate
 // ids are invalid too: selecting an add-on is not a quantity purchase.
 @ValidateIf((_object,value)=>value!==undefined) @IsArray() @ArrayMaxSize(ADDON_IDS.length) @ArrayUnique({message:'addOns must not contain duplicate IDs'}) @IsIn(ADDON_IDS,{each:true}) addOns?:AddOnId[];
 @ValidateIf((_object,value)=>value!==undefined) @IsString() @MaxLength(5000) notes?:string;
 @ValidateIf((_object,value)=>value!==undefined) @Transform(({value})=>typeof value==='string'?value.trim():value) @IsString() @MinLength(1) @MaxLength(100) couponCode?:string;
 @ValidateIf((_object,value)=>value!==undefined) @IsString() @MaxLength(200) website?:string;
}
export class BookingUpdateDto {
 @ValidateIf((_object,value)=>value!==undefined) @IsIn(['PENDING','CONFIRMED','CANCELLED','COMPLETED','REFUNDED']) status?:'PENDING'|'CONFIRMED'|'CANCELLED'|'COMPLETED'|'REFUNDED';
 @ValidateIf((_object,value)=>value!==undefined) @IsString() @MaxLength(5000) notes?:string;
}

export class PresignUploadDto {
 @ApiProperty({enum:['blogs','sliders','use-cases','services','images','videos','static']})
 @IsIn(['blogs','sliders','use-cases','services','images','videos','static'])
 category!:'blogs'|'sliders'|'use-cases'|'services'|'images'|'videos'|'static';

 @ApiProperty()
 @IsString()
 @MinLength(1)
 @MaxLength(255)
 filename!:string;

 @ApiProperty()
 @IsString()
 @MinLength(1)
 @MaxLength(100)
 contentType!:string;

 @ApiProperty()
 @Type(()=>Number)
 @IsInt()
 @Min(1)
 @Max(1024 * 1024 * 1024)
 contentLength!:number;
}

export class FinalizeUploadDto {
 @ApiProperty()
 @IsString()
 @MinLength(1)
 @MaxLength(512)
 key!:string;

 @ValidateIf((_object,value)=>value!==undefined)
 @IsString()
 @MaxLength(300)
 alt?:string;

 @ValidateIf((_object,value)=>value!==undefined)
 @IsString()
 @MaxLength(255)
 originalName?:string;
}

