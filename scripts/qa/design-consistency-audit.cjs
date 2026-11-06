/* Read-only QA. No clicks/submissions. Explicit typography roles:
 data-ui-type/data-design-role/data-typography-role/data-type-role. Explicit exceptions:
 data-design-exception/data-role-exception/.design-role-exception/.typography-role-exception.
 No animation-hiding CSS is injected; only finite animations are finished for metrics. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),{chromium}=require('playwright');
const arg=(k,d)=>{const i=process.argv.indexOf('--'+k);return i<0?d:process.argv[i+1];};
const base=new URL(arg('base','http://localhost:3000')),file=arg('routes-file');
if(!file)throw Error('--routes-file is required');
const input=JSON.parse(fs.readFileSync(file,'utf8')),routes=Array.isArray(input)?input:input.routes;
if(!Array.isArray(routes)||!routes.length||routes.some(r=>typeof r!=='string'||!r.startsWith('/')||new URL(r,base).origin!==base.origin))throw Error('Expected same-origin route strings in array or {routes:[]}');
const widths=arg('widths','375,768,1440').split(',').map(Number),concurrency=Number(arg('concurrency','3')),out=arg('out','test-results/design-consistency-audit.json');
if(widths.some(w=>!Number.isInteger(w)||w<200)||!Number.isInteger(concurrency)||concurrency<1||concurrency>16)throw Error('Invalid widths or concurrency (1..16)');
const buttons='.wj-button,.btn,.wj-btn,.ip-button,.lx-btn,.lv-plans,.lv-pill,.cn-btn-gold,.cn-btn-dark,.cn-btn-outline-dark,.cn-btn-text-play,.cn-plan-btn,.library-button,.library-textLink,.creative-button,.creative-textLink,.info-button,.info-text-link,.visit-button,.visit-link,.ip-text-link,.text-link,.bk-btn,.bk-submit-btn,.adm-button';
async function inspect(page,width){return page.evaluate(({width,buttons})=>{
 const violations=[],excluded=[],cache=new Map(),css=e=>{if(!cache.has(e))cache.set(e,getComputedStyle(e));return cache.get(e);};
 const visible=e=>{const s=css(e),r=e.getBoundingClientRect();return s.display!=='none'&&s.visibility!=='hidden'&&s.opacity!=='0'&&r.width>0&&r.height>0&&!e.closest('[hidden],[aria-hidden="true"]');};
 const selector=e=>{const p=[];for(let n=e;n&&n.nodeType===1;n=n.parentElement){const peers=n.parentElement?[...n.parentElement.children].filter(x=>x.localName===n.localName):[];p.unshift(n.localName+(peers.length>1?`:nth-of-type(${peers.indexOf(n)+1})`:''));}return p.join(' > ');};
 const info=e=>({selector:selector(e),id:e.id||null,classes:e.getAttribute('class')||'',text:(e.textContent||e.getAttribute('aria-label')||e.getAttribute('alt')||e.getAttribute('value')||'').replace(/\s+/g,' ').trim()});
 const add=(e,rule,expected,actual)=>violations.push({...info(e),rule,expected,actual});
 const near=(a,b,t=.65)=>Math.abs(parseFloat(a)-b)<=t,phone=width<=700,tablet=width<=1000;
 const specs={price:[40,500,1.2,'inter'],h1:[phone?40:tablet?48:64,500,1.12,'playfair'],h2:[phone?32:tablet?36:44,500,1.2,'playfair'],h3:[phone?24:tablet?26:28,500,1.3,'playfair'],h4:[phone?20:22,600,1.35,'playfair'],p:[16,400,1.75,'inter'],body:[16,400,1.75,'inter'],secondary:[14,400,1.6,'inter'],caption:[14,400,1.6,'inter'],meta:[14,400,1.6,'inter'],eyebrow:[12,600,1.5,'inter'],label:[14,600,1.5,'inter']};specs.h5=specs.h6=specs.h4;
 for(const e of document.querySelectorAll('h1,h2,h3,h4,h5,h6,p,[data-design-role],[data-typography-role],[data-type-role]')){
  if(!visible(e))continue;
  const ex=e.closest('[data-design-exception],[data-role-exception],.design-role-exception,.typography-role-exception');
  if(ex){excluded.push({...info(e),reason:ex.getAttribute('data-design-exception')||ex.getAttribute('data-role-exception')||'explicit exception class'});continue;}
  let role=e.getAttribute('data-ui-type')||e.getAttribute('data-design-role')||e.getAttribute('data-typography-role')||e.getAttribute('data-type-role');
  if(!role&&e.matches('.lv-h1'))role='h1';if(!role&&e.matches('.creative-price,.price-value,.info-price'))role='price';if(!role&&e.closest('.wj-footer'))role=/^H/.test(e.tagName)?'label':'secondary';if(!role&&e.matches('.wj-small,.wj-consent,.visit-policy-note,.visit-policy-final'))role='secondary';if(!role){const c=e.getAttribute('class')||'';role=/(?:^|[\s_-])eyebrow(?:$|[\s_-])/i.test(c)?'eyebrow':/(?:^|[\s_-])(secondary|caption|meta)(?:$|[\s_-])/i.test(c)?'secondary':/dialog[-_]title/i.test(c)||e.matches('[role="dialog"] h1,[role="dialog"] h2,dialog h1,dialog h2')?'h3':e.closest('.wj-header,.wj-mega-nav,.wj-footer')&&/^H[1-6]$/.test(e.tagName)?'label':e.localName;}
  role=role.toLowerCase();const v=specs[role],s=css(e);if(!v){add(e,'unknown-type-role',Object.keys(specs),role);continue;}
  const [size,weight,line,family]=v;
  if(!near(s.fontSize,size)||Number(s.fontWeight)!==weight||!near(s.lineHeight,size*line)||!s.fontFamily.toLowerCase().includes(family)||(role==='eyebrow'&&!near(s.letterSpacing,size*.08,.2)))add(e,'typography',{role,size,weight,lineHeight:size*line,family,...(role==='eyebrow'?{letterSpacing:size*.08}:{})},{size:s.fontSize,weight:s.fontWeight,lineHeight:s.lineHeight,family:s.fontFamily,letterSpacing:s.letterSpacing});
 }
 const radius=e=>{const s=css(e),a=[s.borderTopLeftRadius,s.borderTopRightRadius,s.borderBottomRightRadius,s.borderBottomLeftRadius];if(a.some(x=>!/^5px(?: 5px)?$/.test(x)))add(e,'radius','5px all corners',a);};
 const actions=new Set([...document.querySelectorAll(buttons)].filter(e=>visible(e)&&!e.matches('.visit-photo-button,.vg-photo-button,.vg-image-button')));
 for(const e of actions){const s=css(e);radius(e);const yellow=['rgb(217, 145, 11)','rgb(194, 127, 6)'].includes(s.backgroundColor),green=['rgb(33, 77, 62)','rgb(23, 61, 48)'].includes(s.backgroundColor);if(!(yellow||green)||s.color!==(yellow?'rgb(11, 29, 25)':'rgb(255, 255, 255)'))add(e,'button-colors',{yellow:'#d9910b / #0b1d19',green:'#214d3e / #ffffff',hover:['#c27f06','#173d30']},{background:s.backgroundColor,color:s.color});if(!s.fontFamily.toLowerCase().includes('inter')||!near(s.fontSize,phone?14:15)||Number(s.fontWeight)!==700||e.getBoundingClientRect().height<43.5)add(e,'button-type',{family:'Inter',size:phone?14:15,weight:700,minHeight:44},{family:s.fontFamily,size:s.fontSize,weight:s.fontWeight,height:e.getBoundingClientRect().height});}
 const surfaces=new Set(document.querySelectorAll('main section,main article,main aside,main [data-surface],main .card,main [class*="-card"],main [class*="_card"],main [class*="panel"],main [class*="surface"],main [class*="Card"]'));
 for(const e of document.querySelectorAll('main *')){if(!visible(e))continue;const s=css(e);if(s.backgroundImage!=='none'||!['transparent','rgba(0, 0, 0, 0)'].includes(s.backgroundColor)||parseFloat(s.borderTopWidth)>0||s.boxShadow!=='none')surfaces.add(e);}
 for(const e of surfaces)if(visible(e)&&!actions.has(e)&&!e.matches('img,svg,video,canvas,input,select,textarea'))radius(e);
 for(const e of document.images)if(visible(e)){radius(e);if(e.complete&&!e.naturalWidth)add(e,'broken-image','loaded image',{src:e.getAttribute('src'),currentSrc:e.currentSrc,complete:e.complete,naturalWidth:e.naturalWidth});}
 const allowed=['rgba(0, 0, 0, 0)','rgb(247, 245, 239)','rgb(238, 234, 221)','rgb(231, 234, 223)','rgb(25, 60, 50)','rgb(255, 255, 255)'];
 for(const e of document.querySelectorAll('body,main,main section,main [data-section],main [data-surface]'))if(visible(e)){const s=css(e);if(!allowed.includes(s.backgroundColor)||s.backgroundImage.includes('gradient('))add(e,'main-background',{colors:allowed,gradient:false},{color:s.backgroundColor,image:s.backgroundImage});}
 const overflow=document.documentElement.scrollWidth-document.documentElement.clientWidth;
 if(overflow>1){add(document.documentElement,'horizontal-overflow','<=1px',overflow);for(const e of document.querySelectorAll('body *'))if(visible(e)){const r=e.getBoundingClientRect();if(r.left< -1||r.right>innerWidth+1)add(e,'overflow-element','within viewport',{left:r.left,right:r.right,width:r.width});}}
 const ids=new Map();for(const e of document.querySelectorAll('[id]')){if(!ids.has(e.id))ids.set(e.id,[]);ids.get(e.id).push(e);}for(const [id,els]of ids)if(els.length>1)for(const e of els)add(e,'duplicate-id','unique id',{id,count:els.length});
 return {title:document.title,overflow,violations,excluded};
},{width,buttons});}
(async()=>{
 const browser=await chromium.launch({headless:true}),results=[],jobs=routes.flatMap((route,index)=>widths.map(width=>({route,index,width})));let next=0;
 try{await Promise.all(Array.from({length:Math.min(concurrency,jobs.length)},async()=>{while(next<jobs.length){const job=jobs[next++],context=await browser.newContext({viewport:{width:job.width,height:900},reducedMotion:'reduce',serviceWorkers:'block'}),page=await context.newPage(),events=[];let status=0;
 page.on('pageerror',e=>events.push({rule:'pageerror',message:e.message}));
 page.on('requestfailed',r=>{const f=r.failure()?.errorText||'';if(!/ERR_ABORTED|NS_BINDING_ABORTED/.test(f))events.push({rule:'failed-request',url:r.url(),method:r.method(),resourceType:r.resourceType(),message:f});});
 page.on('response',r=>{if(r.status()>=400&&r.request().resourceType()!=='document'&&!r.url().includes('/__qa-missing-route__/'))events.push({rule:'http-resource-status',url:r.url(),status:r.status(),resourceType:r.request().resourceType()});});
 await context.route('**/*',route=>{const r=route.request();if(r.isNavigationRequest()&&new URL(r.url()).origin!==base.origin)return route.abort('blockedbyclient');return route.continue();});
 try{const response=await page.goto(new URL(job.route,base).href,{waitUntil:'load',timeout:60000});status=response?.status()||0;
 const settle=await page.evaluate(async()=>{const pause=ms=>new Promise(r=>setTimeout(r,ms)),end=Date.now()+12000;let steps=0,complete=false;for(let y=0;Date.now()<end&&steps<150;y+=Math.max(400,innerHeight*.8)){scrollTo(0,y);await pause(65);steps++;if(y>=document.documentElement.scrollHeight-innerHeight){await pause(150);if(y>=document.documentElement.scrollHeight-innerHeight){complete=true;break;}}}return {scrollSteps:steps,scrollComplete:complete};});
 await page.waitForLoadState('networkidle',{timeout:5000}).catch(()=>{});
 await page.evaluate(async()=>{await Promise.race([document.fonts.ready,new Promise(r=>setTimeout(r,3000))]);await Promise.race([Promise.all([...document.images].map(i=>i.complete?Promise.resolve():new Promise(r=>{i.addEventListener('load',r,{once:true});i.addEventListener('error',r,{once:true});}))),new Promise(r=>setTimeout(r,3000))]);});
 const animations=await page.evaluate(()=>{let finished=0,infinite=0;for(const a of document.getAnimations()){if(a.effect?.getComputedTiming().iterations===Infinity){infinite++;continue;}try{a.finish();finished++;}catch{}}scrollTo(0,0);return {finished,infinite};});
 await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
 const metrics=await inspect(page,job.width);if(status<200||status>=400)events.push({rule:'document-status',status});if(!settle.scrollComplete)events.push({rule:'lazy-scroll-bound',message:'Coverage incomplete: reached lazy scroll bound'});
 results.push({...job,status,url:page.url(),...settle,animations,...metrics,events});
 }catch(e){results.push({...job,status,violations:[],excluded:[],events:[...events,{rule:'audit-error',message:e.message}]});}finally{await context.close();}
 }}));}finally{await browser.close();}
 results.sort((a,b)=>a.index-b.index||widths.indexOf(a.width)-widths.indexOf(b.width));const counts={};
 for(const r of results){r.violations.sort((a,b)=>a.selector.localeCompare(b.selector)||a.rule.localeCompare(b.rule));r.events.sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b)));for(const v of [...r.violations,...r.events])counts[v.rule]=(counts[v.rule]||0)+1;delete r.index;}
 const problemChecks=results.filter(r=>r.violations.length||r.events.length).length,summary={schemaVersion:1,base:base.href,routes:routes.length,widths,concurrency,checks:results.length,problemChecks,violations:Object.values(counts).reduce((a,b)=>a+b,0),byRule:Object.fromEntries(Object.entries(counts).sort(([a],[b])=>a.localeCompare(b)))};
 fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,JSON.stringify({summary,results},null,2)+'\n');console.log(JSON.stringify(summary,null,2));process.exitCode=problemChecks?1:0;
})().catch(e=>{console.error(e);process.exitCode=2;});
