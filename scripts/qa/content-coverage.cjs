#!/usr/bin/env node
/* Content preservation: every text string in data/live-pages.json must be visible in the rendered page (#main).
   Usage: node scripts/qa/content-coverage.cjs [--base http://localhost:3100] */
const path=require('node:path');const {chromium}=require(path.join(process.cwd(),'node_modules','playwright'));
const base=(process.argv.includes('--base')?process.argv[process.argv.indexOf('--base')+1]:'http://localhost:3100').replace(/\/$/,'');
const pages=require(path.join(process.cwd(),'data','live-pages.json')).pages;
const norm=s=>s.replace(/<[^>]+>/g,' ').replace(/&nbsp;|&#160;/g,' ').replace(/&amp;/g,'&').replace(/&#8217;|&rsquo;/g,'\u2019').replace(/&#8211;|&ndash;/g,'\u2013').replace(/&#[0-9]+;|&[a-z]+;/g,' ').replace(/\\?u2013/g,'\u2013').replace(/\\?u2014/g,'\u2014').replace(/^#\s*/,'').toLowerCase().replace(/[^a-z0-9]+/g,'');
function strings(nodes,out=[]){for(const n of nodes){switch(n.t){case 'box':strings(n.children,out);break;case 'tabs':n.tabs.forEach(t=>{out.push(t.title);strings(t.children,out)});break;case 'h':case 'text':out.push(n.text);break;case 'html':out.push(...n.html.split(/<\/(?:p|li|h\d|div)>|<br\s*\/?>/i));break;case 'btn':out.push(n.label);break;case 'list':n.items.forEach(i=>out.push(i.text));break;case 'card':out.push(n.title||'',n.text||'');break;case 'stat':out.push(n.value);break;case 'faq':n.items.forEach(i=>out.push(i.q));break;case 'quote':out.push(n.text);break;case 'table':n.rows.forEach(r=>r.forEach(x=>out.push(x)));break;}}return out;}
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:1440,height:900}});let missingTotal=0,checked=0;const report={};
for(const [route,nodes] of Object.entries(pages)){if(!nodes?.length)continue;await p.goto(base+route,{waitUntil:'load',timeout:60000});
 const txt=norm(await p.evaluate(()=>{document.querySelectorAll('details').forEach(d=>d.open=true);document.querySelectorAll('[role=tabpanel][hidden]').forEach(e=>e.hidden=false);return document.querySelector('#main').textContent}));
 const want=[...new Set(strings(nodes).map(norm).filter(s=>s.length>=3))];
 const miss=want.filter(s=>!txt.includes(s));checked+=want.length;missingTotal+=miss.length;if(miss.length)report[route]=miss.slice(0,8);}
await b.close();console.log(JSON.stringify({pages:Object.keys(pages).length,stringsChecked:checked,missing:missingTotal,report},null,1));process.exit(missingTotal?1:0);})();
