import sanitizeHtml from 'sanitize-html';
const secretKey=/(password|secret|token|api.?key|private.?key|credential|smtp)/i;
export function cleanContent(value:any):any {
 if(typeof value==='string')return sanitizeHtml(value,{allowedTags:sanitizeHtml.defaults.allowedTags.concat(['img','h1','h2']),allowedAttributes:{...sanitizeHtml.defaults.allowedAttributes,img:['src','alt','width','height']},allowedSchemes:['http','https','mailto','tel'],allowProtocolRelative:false});
 if(Array.isArray(value))return value.map(cleanContent);
 if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).filter(([k])=>!['__proto__','constructor','prototype'].includes(k)).map(([k,v])=>[k,cleanContent(v)]));
 return value;
}
export function publicSafe(value:any):any {if(Array.isArray(value))return value.map(publicSafe);if(value&&typeof value==='object'&&!(value instanceof Date))return Object.fromEntries(Object.entries(value).filter(([k])=>!secretKey.test(k)).map(([k,v])=>[k,publicSafe(v)]));return value;}
export function popupEligible(row:any){const m=row.metadata||{},now=Date.now();if(m.startsAt&&(!Number.isFinite(Date.parse(m.startsAt))||Date.parse(m.startsAt)>now))return false;if(m.endsAt&&(!Number.isFinite(Date.parse(m.endsAt))||Date.parse(m.endsAt)<=now))return false;return true;}

/** Future publication is enforced at read time, without a scheduler process. */
export function contentEligible(resource:string,row:any){
 const m=row.metadata||{};
 if(m.enabled===false||(resource==='pricing'&&m.requiresReview===true))return false;
 if(resource==='popups'&&!popupEligible(row))return false;
 const scheduled=m.publishAt;
 return !scheduled||(Number.isFinite(Date.parse(scheduled))&&Date.parse(scheduled)<=Date.now());
}

export function configurationErrors(resource:string,metadata:any):string[]{
 const m=metadata||{},errors:string[]=[];
 if(m.enabled!==undefined&&typeof m.enabled!=='boolean')errors.push('enabled must be boolean');
 for(const key of ['publishAt',...(resource==='popups'?['startsAt','endsAt']:[])]){if(m[key]!==undefined&&(typeof m[key]!=='string'||!/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(m[key])||!Number.isFinite(Date.parse(m[key]))))errors.push(key+' must be an ISO date with timezone');}
 if(resource==='popups'&&m.startsAt&&m.endsAt&&Date.parse(m.endsAt)<=Date.parse(m.startsAt))errors.push('endsAt must follow startsAt');
 if(resource==='testimonials'){
 for(const key of ['role','company','avatar','quote'])if(m[key]!==undefined&&typeof m[key]!=='string')errors.push(key+' must be a string');
 if(typeof m.avatar==='string'&&m.avatar.trim()&&!/^(https?:\/\/|\/)/.test(m.avatar.trim()))errors.push('avatar must be a site path (/media/photo.png) or an absolute http(s) URL');
 if(m.rating!==undefined&&(!Number.isFinite(Number(m.rating))||Number(m.rating)<1||Number(m.rating)>5))errors.push('rating must be a number between 1 and 5');
 }
 if(resource==='use-cases'){
 for(const key of ['number','href','featuredImage','alt','description'])if(m[key]!==undefined&&typeof m[key]!=='string')errors.push(key+' must be a string');
 if(typeof m.href==='string'&&m.href.trim()&&!/^(https?:\/\/|\/|#)/.test(m.href.trim()))errors.push('href must be a site path (/example/), an anchor or an absolute http(s) URL');
 if(m.hideFromHomepage!==undefined&&typeof m.hideFromHomepage!=='boolean')errors.push('hideFromHomepage must be boolean');
 }
 if(resource==='pricing'){
 for(const key of ['price','amount'])if(m[key]!==undefined&&!((typeof m[key]==='number'&&Number.isFinite(m[key])&&m[key]>=0)||(typeof m[key]==='string'&&m[key].trim().length>0)))errors.push(key+' must be a nonnegative number or a display string');
 if(m.features!==undefined&&(!Array.isArray(m.features)||!m.features.every((v:any)=>typeof v==='string')))errors.push('features must be a string array');
 for(const key of ['featured','requiresReview'])if(m[key]!==undefined&&typeof m[key]!=='boolean')errors.push(key+' must be boolean');
 }
 return errors;
}
