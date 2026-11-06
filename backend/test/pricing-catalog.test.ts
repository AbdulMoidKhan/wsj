import {test} from 'node:test';
import assert from 'node:assert/strict';
import {PLAN_CATALOG,ADDON_CATALOG,PLAN_IDS,ADDON_IDS,resolveBookingTotal,isPlanId,isAddOnId,UnknownAddOnError,publicCatalog,CURRENCY} from '../src/pricing-catalog';

test('every plan and add-on has a positive whole-cent amount',()=>{
 for(const id of PLAN_IDS){const plan=PLAN_CATALOG[id];assert.ok(Number.isInteger(plan.amountCents)&&plan.amountCents>0,plan.id);}
 for(const id of ADDON_IDS){const addOn=ADDON_CATALOG[id];assert.ok(Number.isInteger(addOn.amountCents)&&addOn.amountCents>0,addOn.id);}
});

test('resolveBookingTotal sums the exact catalog amounts, never invents a price',()=>{
 const silverOnly=resolveBookingTotal('silver',[]);
 assert.equal(silverOnly.subtotalCents,PLAN_CATALOG.silver.amountCents);
 assert.equal(silverOnly.addOnsCents,0);
 assert.equal(silverOnly.totalCents,PLAN_CATALOG.silver.amountCents);

 const withAddOns=resolveBookingTotal('bronze',['printing','mail']);
 assert.equal(withAddOns.subtotalCents,PLAN_CATALOG.bronze.amountCents);
 assert.equal(withAddOns.addOnsCents,ADDON_CATALOG.printing.amountCents+ADDON_CATALOG.mail.amountCents);
 assert.equal(withAddOns.totalCents,withAddOns.subtotalCents+withAddOns.addOnsCents);
 assert.deepEqual(withAddOns.addOns.map(a=>a.id),['printing','mail']);
});

test('an unrecognized add-on id throws instead of being priced at zero or ignored',()=>{
 assert.throws(()=>resolveBookingTotal('bronze',['printing','not-a-real-addon']),UnknownAddOnError);
 try{resolveBookingTotal('bronze',['phantom']);assert.fail('expected UnknownAddOnError');}
 catch(error){assert.ok(error instanceof UnknownAddOnError);assert.equal((error as UnknownAddOnError).addOnId,'phantom');}
});

test('an unrecognized plan id throws rather than resolving to any price',()=>{
 assert.throws(()=>resolveBookingTotal('enterprise' as any,[]));
});

test('type guards agree exactly with the catalog keys',()=>{
 for(const id of PLAN_IDS)assert.equal(isPlanId(id),true);
 for(const id of ADDON_IDS)assert.equal(isAddOnId(id),true);
 for(const bad of ['free','Bronze','',null,undefined,7])assert.equal(isPlanId(bad),false);
});

test('publicCatalog exposes the exact same priced data the server will charge, nothing more',()=>{
 const catalog=publicCatalog();
 assert.equal(catalog.currency,CURRENCY);
 assert.deepEqual(catalog.plans.map(p=>p.id).sort(),[...PLAN_IDS].sort());
 assert.deepEqual(catalog.addOns.map(a=>a.id).sort(),[...ADDON_IDS].sort());
 for(const plan of catalog.plans)assert.equal(plan.amountCents,PLAN_CATALOG[plan.id].amountCents);
});


test('duplicate add-on ids are rejected before a total can be charged',()=>{
 for(const id of ADDON_IDS){
  for(const ids of [[id,id],[id,...ADDON_IDS.filter(other=>other!==id),id]]){
   assert.throws(()=>resolveBookingTotal('bronze',ids),{message:'Duplicate add-on: '+id});
  }
 }
 const ids=['printing','mail','printing'];
 assert.throws(()=>resolveBookingTotal('silver',ids));
 assert.deepEqual(ids,['printing','mail','printing']);
});
