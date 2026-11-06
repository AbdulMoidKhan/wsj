import 'reflect-metadata';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {plainToInstance} from 'class-transformer';
import {validateSync} from 'class-validator';
import {BookingDto,BookingUpdateDto} from '../src/dto';

// Pure DTO regressions: no server, database, .env, SMTP or seed changes.
// Match main.ts's transform/implicit-conversion and whitelist settings.
// enableImplicitConversion is false: every field needing string->number/date
// conversion carries an explicit @Type/@IsDateString; Array/Boolean fields
// without one must not be silently coerced from the wrong input type.
// No price fields: the server now computes totalPrice/subtotalPrice itself
// from planId/addOns (see pricing-catalog.ts); the client cannot supply them.
function normal(){return {
 customerName:'QA Customer',customerEmail:'qa-booking@example.com',
 serviceType:'meeting-rooms',serviceName:'Meeting Room',planId:'silver',
 bookingDate:'2026-11-04',bookingTime:'09:00',duration:60,guests:2,
 addOns:['printing','mail'],
};}
function bookingErrors(overrides:Record<string,unknown>={}){
 return validateSync(plainToInstance(BookingDto,{...normal(),...overrides},{enableImplicitConversion:false}),{whitelist:true,forbidNonWhitelisted:true});
}
function rejects(field:string,value:unknown){
 assert.ok(bookingErrors({[field]:value}).some(error=>error.property===field),'Expected validation error for '+field);
}
function updateErrors(payload:Record<string,unknown>){
 return validateSync(plainToInstance(BookingUpdateDto,payload,{enableImplicitConversion:false}),{whitelist:true,forbidNonWhitelisted:true});
}

test('normal booking and strict valid ISO dates pass DTO validation',()=>{
 assert.deepEqual(bookingErrors(),[]);
 for(const bookingDate of ['2028-02-29','2026-11-04T09:00:00Z'])assert.deepEqual(bookingErrors({bookingDate}),[]);
 const dto=plainToInstance(BookingDto,{...normal(),serviceType:'  meeting-rooms  ',serviceName:'  Meeting Room  '},{enableImplicitConversion:false});
 assert.equal(dto.serviceType,'meeting-rooms');assert.equal(dto.serviceName,'Meeting Room');
 assert.deepEqual(validateSync(dto),[]);
});

test('addOns rejects objects, null, numbers and any id outside the server catalog',()=>{
 for(const value of [{label:'Projector'},null,7,'Projector',[{label:'Projector'}],[null],[7],['printing',7],['printing',null],['printing','not-a-real-addon'],['Coffee']])rejects('addOns',value);
});

test('addOns accepts any subset of the real catalog, empty included',()=>{
 assert.deepEqual(bookingErrors({addOns:[]}),[]);
 assert.deepEqual(bookingErrors({addOns:['printing']}),[]);
 assert.deepEqual(bookingErrors({addOns:['printing','storage','mail','podcast','assistant','events']}),[]);
});

test('planId only accepts a real catalog plan, never a client-invented one',()=>{
 for(const planId of ['bronze','silver','gold','platinum'])assert.deepEqual(bookingErrors({planId}),[]);
 for(const planId of ['free','enterprise','','Bronze',null,7])rejects('planId',planId);
});

test('the client can no longer supply a price: subtotalPrice/totalPrice are rejected as unknown fields',()=>{
 for(const field of ['subtotalPrice','totalPrice'])assert.ok(bookingErrors({[field]:0.01}).some(error=>error.property===field&&error.constraints?.whitelistValidation));
});

test('duration remains a positive signed PostgreSQL int32',()=>{
 assert.deepEqual(bookingErrors({duration:1}),[]);
 assert.deepEqual(bookingErrors({duration:2147483647}),[]);
 for(const value of [2147483648,'2147483648',Number.MAX_SAFE_INTEGER,0,-1,1.5,null])rejects('duration',value);
});

test('bookingDate rejects malformed and impossible calendar dates',()=>{
 for(const value of ['not-a-date','2026-02-30','2026-13-01','2026-11-32','',null])rejects('bookingDate',value);
});

test('service identifiers and labels cannot become blank after trimming',()=>{
 for(const field of ['serviceType','serviceName'])for(const value of ['','   ','\t\r\n',null])rejects(field,value);
});

test('booking updates reject null and unknown status but accept allowed statuses',()=>{
 assert.deepEqual(updateErrors({}),[]);
 for(const status of ['PENDING','CONFIRMED','CANCELLED','COMPLETED','REFUNDED'])assert.deepEqual(updateErrors({status}),[]);
 for(const status of [null,'INVALID','confirmed','',7])assert.ok(updateErrors({status}).some(error=>error.property==='status'));
});


test('addOns rejects repeated catalog ids with a clear validation message',()=>{
 for(const addOns of [['printing','printing'],['printing','mail','printing'],['events','events']]){
  const error=bookingErrors({addOns}).find(error=>error.property==='addOns');
  assert.equal(error?.constraints?.arrayUnique,'addOns must not contain duplicate IDs');
 }
});

test('optional addOns stays optional and distinct selections remain valid',()=>{
 assert.deepEqual(bookingErrors({addOns:undefined}),[]);
 assert.deepEqual(bookingErrors({addOns:['events','assistant','podcast','mail','storage','printing']}),[]);
});
