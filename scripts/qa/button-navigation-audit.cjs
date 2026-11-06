/* Read-only regression audit for the public header/footer route inventory.
   Never submits forms, creates a booking, or invokes a payment endpoint. */
const fs=require('node:fs');
const path=require('node:path');
const {chromium}=require('playwright');
const arg=(key,fallback)=>{const i=process.argv.indexOf('--'+key);return i<0?fallback:process.argv[i+1];};
const base=arg('base','http://localhost:3000');
const routes=JSON.parse(fs.readFileSync(arg('routes-file','test-results/public-navigation-routes.json'),'utf8'));
const widths=arg('widths','375,768,1440').split(',').map(Number);
const out=arg('out','test-results/button-navigation-audit.json');
const ctaSelector='.wj-button,.btn,.wj-btn,.ip-button,.lx-btn,.lv-plans,.lv-pill,.cn-btn-gold,.cn-btn-dark,.cn-btn-outline-dark,.cn-btn-text-play,.cn-plan-btn,.library-button,.library-textLink,.creative-button,.creative-textLink,.info-button,.info-text-link,.visit-button,.visit-link,.ip-text-link,.text-link,.bk-btn,.bk-submit-btn';
(async()=>{
 const browser=await chromium.launch({headless:true});
 const context=await browser.newContext({reducedMotion:'reduce'});
 const results=[];let next=0;const jobs=routes.flatMap(route=>widths.map(width=>({route,width})));const started=Date.now();
 await Promise.all(Array.from({length:Number(arg('concurrency','3'))},async()=>{while(next<jobs.length){
  const job=jobs[next++];const page=await context.newPage();const errors=[],failed=[];let status=0;
  page.on('pageerror',e=>errors.push(e.message));
  page.on('response',r=>{if(r.url().startsWith(base)&&r.status()>=400&&r.request().resourceType()!=='document')failed.push(r.status()+' '+r.url().replace(base,''));});
  try{
   await page.setViewportSize({width:job.width,height:900});
   const response=await page.goto(base+job.route,{waitUntil:'load',timeout:60000});status=response.status();
   await page.evaluate(async()=>{const step=Math.max(600,innerHeight);for(let y=0;y<document.documentElement.scrollHeight;y+=step){window.scrollTo(0,y);await new Promise(r=>setTimeout(r,60));}window.scrollTo(0,document.documentElement.scrollHeight);});
   await page.waitForLoadState('networkidle',{timeout:6000}).catch(()=>{});
   const metrics=await page.evaluate(ctaSelector=>{
    const visible=el=>{const s=getComputedStyle(el),r=el.getBoundingClientRect();return s.display!=='none'&&s.visibility!=='hidden'&&r.width>0&&r.height>0&&!el.closest('[hidden],[aria-hidden="true"]');};
    const buttonIssues=[];const variants={yellow:0,green:0};
    for(const el of document.querySelectorAll(ctaSelector)){
     if(!visible(el))continue;const s=getComputedStyle(el);const expected=s.backgroundColor==='rgb(217, 145, 11)'?'yellow':s.backgroundColor==='rgb(33, 77, 62)'?'green':null;
     if(expected)variants[expected]++;
     const correct=expected&&(s.borderRadius===(expected==='yellow'?'999px':'10px'))&&s.color===(expected==='yellow'?'rgb(11, 29, 25)':'rgb(255, 255, 255)');
     if(!correct)buttonIssues.push({text:el.textContent.trim().slice(0,75),class:el.className,bg:s.backgroundColor,color:s.color,radius:s.borderRadius});
    }
    const ids=new Map();for(const el of document.querySelectorAll('[id]'))ids.set(el.id,(ids.get(el.id)||0)+1);
    const duplicateIds=[...ids].filter(([,count])=>count>1).map(([id,count])=>({id,count}));
    const brokenAnchors=[];for(const a of document.querySelectorAll('a[href]')){let u;try{u=new URL(a.href);}catch{continue;}if(u.origin===location.origin&&u.pathname===location.pathname&&u.hash&&u.hash!=='#wj-booking'&&!document.getElementById(decodeURIComponent(u.hash.slice(1))))brokenAnchors.push({label:a.textContent.trim().slice(0,70),href:a.getAttribute('href')});}
    const brokenImages=[...document.images].filter(i=>visible(i)&&i.complete&&!i.naturalWidth).map(i=>i.getAttribute('src'));
    return {title:document.title,overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth,h1:document.querySelectorAll('main h1').length,variants,buttonIssues,duplicateIds,brokenAnchors,brokenImages,header:!!document.querySelector('.wj-header'),footer:!!document.querySelector('.wj-footer')};
   },ctaSelector);
   results.push({...job,status,...metrics,errors,failed:[...new Set(failed)]});
  }catch(e){results.push({...job,status,error:e.message,errors,failed});}
  await page.close();if(results.length%10===0)console.log(`${results.length}/${jobs.length} checks (${Math.round((Date.now()-started)/1000)}s)`);
 }}));
 await browser.close();const problems=results.filter(r=>r.error||r.status>=400||r.status===0||r.overflow>1||r.h1!==1||r.buttonIssues.length||r.duplicateIds.length||r.brokenAnchors.length||r.brokenImages.length||r.errors.length||r.failed.length||!r.header||!r.footer);
 const summary={routes:routes.length,widths,checks:results.length,seconds:Math.round((Date.now()-started)/1000),problems:problems.length};
 fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,JSON.stringify({summary,results,problems},null,2));console.log(JSON.stringify(summary,null,2));console.log(JSON.stringify(problems.map(r=>({route:r.route,width:r.width,status:r.status,error:r.error,overflow:r.overflow,h1:r.h1,buttonIssues:r.buttonIssues,duplicateIds:r.duplicateIds,brokenAnchors:r.brokenAnchors,brokenImages:r.brokenImages,errors:r.errors,failed:r.failed})),null,2));process.exitCode=problems.length?1:0;
})().catch(e=>{console.error(e);process.exitCode=2;});
