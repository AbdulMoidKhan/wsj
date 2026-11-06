const test=require('node:test');
const assert=require('node:assert/strict');
const {resolveServiceIntent,requestedIntentMessage}=require('../../lib/service-intent.ts');
test('only explicit catalog-backed coworking enters paid checkout',()=>{
 for(const value of [undefined,'','Coworking','coworking space','coworking-space'])assert.equal(resolveServiceIntent(value).mode,'booking');
 for(const plan of ['Bronze','Silver','Gold','Platinum'])assert.equal(resolveServiceIntent(plan+' - Coworking').planId,plan.toLowerCase());
});
test('unsupported and ambiguous offers cannot become unrelated workspace charges',()=>{
 for(const value of ['Mailbox','Rent a Mailbox','Reserve a Desk','Hot Desk','Photo Studio','Notary Public','Community Membership (Monthly)','LLC Setup','BPO Services','Webinars','Podcast Studio','Business Address','Gold','Bronze 1 day pass','Coworking Tour'])assert.equal(resolveServiceIntent(value).mode,'inquiry',value);
});
test('requested offer and interval are retained verbatim',()=>{
 const original='Photo Studio: Monthly Creator Plan - $250 / 30 Days';
 const result=requestedIntentMessage(original,'Monthly Creator Plan','30 Days');
 assert.ok(result.includes(original));assert.ok(result.includes('Requested plan: Monthly Creator Plan'));assert.ok(result.includes('Requested interval: 30 Days'));
});
