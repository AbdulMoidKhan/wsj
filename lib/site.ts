import fs from 'node:fs';
import path from 'node:path';
import sanitizeHtml from 'sanitize-html';
import {cache} from 'react';
export type Entry = {id:number|string;slug:string;path:string;title:string;content:string;excerpt?:string;date?:string;modified?:string;featuredImage?:string;images?:string[];seo?:{title?:string;description?:string};type?:string;categories?:(number|string)[];tags?:(number|string)[];author?:string;featured?:boolean};
export type Category={id:number|string;slug:string;name:string};
export type Business={phone:string;phoneHref:string;email:string;address:string;tagline:string;logo?:string;seoTitle?:string;seoDescription?:string};
export const businessDefaults:Business={phone:"(773) 986-1908",phoneHref:"+17739861908",email:"grow@workspacejunction.com",address:"1S280 Summit Ave Unit E2 Suite 1, Oakbrook Terrace, IL 60181",tagline:"A space for your next chapter."};
export type Site = {business?:Business;pages:Entry[];posts:Entry[];categories:Category[];tags?:Category[];assets:unknown[];pricing:unknown[];links:unknown[];brand:Record<string,unknown>};
let sourceCache:{mtime:number;data:Site}|undefined;
export const site=cache(function():Site {try{const file=path.join(process.cwd(),'data/site.json'),mtime=fs.statSync(file).mtimeMs;if(sourceCache?.mtime===mtime)return sourceCache.data;const data=JSON.parse(fs.readFileSync(file,'utf8')) as Site;sourceCache={mtime,data};return data}catch{return {pages:[],posts:[],categories:[],assets:[],pricing:[],links:[],brand:{}}}});
let mediaAssets:unknown[]|undefined;let mediaLookup=new Map<string,string>();
export function text(html=''){
  return html
    .replace(/<[^>]*>/g,' ')
    .replace(/\\?u2013/g,'–')
    .replace(/\\?u2014/g,'—')
    .replace(/&amp;/g,'&')
    .replace(/&#8217;|&rsquo;/g,"'")
    .replace(/&#8211;|&ndash;/g,'–')
    .replace(/&#8212;|&mdash;/g,'—')
    .replace(/&nbsp;/g,' ')
    .replace(/&#038;/g,'&')
    .replace(/&quot;/g,'"')
    .replace(/\bbussiness\b/gi, 'business')
    .replace(/\bBussiness\b/g, 'Business')
    .replace(/\s+/g,' ')
    .trim();
}
function contentImage(attrs:Record<string,string>){const src=localMedia(attrs.src||'');if(!/^\/(?:media|uploads)\/.*\.(?:png|jpe?g|webp)$/i.test(src))return {...attrs,src,loading:'lazy',decoding:'async'};const originalWidth=Number(attrs.width)||1200;const max=originalWidth<=384?384:originalWidth<=828?828:1200;const widths=[384,640,828,1080,1200].filter(w=>w<=max);const url=(w:number)=>'/_next/image?url='+encodeURIComponent(src)+'&w='+w+'&q=75';return {...attrs,src:url(max),srcset:widths.map(w=>url(w)+' '+w+'w').join(', '),sizes:'(max-width:650px) calc(100vw - 40px), 900px',loading:'lazy',decoding:'async'}}
export function safeContent(value:unknown):string{let lastHeading=1;const heading=(tag:string,attribs:Record<string,string>)=>{const level=Math.min(tag==='h1'?2:Number(tag[1]),lastHeading+1);lastHeading=level;return {tagName:'h'+level,attribs}};const raw=typeof value==='string'?value:value&&typeof value==='object'&&'html' in value?String(value.html):'';
const cleanedRaw = raw
  .replace(/\\?u2013/g, '–')
  .replace(/\\?u2014/g, '—')
  .replace(/\bbussiness\b/gi, 'business')
  .replace(/\bBussiness\b/g, 'Business');
const rendered=sanitizeHtml(cleanedRaw,{allowedTags:[...sanitizeHtml.defaults.allowedTags,'img','figure','figcaption','details','summary','video','source'],allowedAttributes:{'*':['id','class','aria-hidden'],a:['href','title','target','rel','aria-label'],img:['src','srcset','sizes','alt','width','height','loading','decoding'],video:['src','controls','poster'],source:['src','type']},allowedSchemes:['http','https','mailto','tel'],transformTags:{h1:heading,h2:heading,h3:heading,h4:heading,h5:heading,h6:heading,a:(tag,attrs)=>({tagName:tag,attribs:{...attrs,href:localPath(attrs.href||''),...(attrs.target==='_blank'?{rel:'noopener noreferrer'}:{})}}),img:(tag,attrs)=>({tagName:tag,attribs:contentImage(attrs)})},exclusiveFilter:frame=>frame.tag==='img'&&(!frame.attribs.src||/data:|javascript:/i.test(frame.attribs.src))});return rendered.replace(/(<a\b[^>]*href="([^"]+)"[^>]*>)\s*(?:Learn More|Read More)\s*<\/a>/gi,(all,opening,href)=>{const target=[...site().pages,...site().posts].find(p=>p.path===String(href).split('#')[0]);const label=href==='/coworking/#pricing'?'Compare coworking plans':target?'Explore '+text(target.title):'';return label?opening+label.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')+'</a>':all})}
export function localPath(p:string){try{const u=new URL(p,'https://workspacejunction.com');if(!['workspacejunction.com','www.workspacejunction.com'].includes(u.hostname))return p;let hash='';try{hash=decodeURIComponent(u.hash)}catch{hash=u.hash}if(hash==='#wj-booking')return '#wj-booking';if(hash.startsWith('#elementor-action:'))return '#wj-booking';const legacy:Record<string,string>={'#webinar-plans':'/webinars/#pricing','#rooms':'/meeting-rooms/#pricing','#table-dedicated':'/dedicated/#pricing','#detailbox':'/mail-box/#pricing','#business-table':'/business-address/#pricing','#compare-plan':'/virtual-office/#pricing','#pricing2':'/podcast-studio/#pricing','#table-podcast':'/podcast-studio/#pricing','#tableCoworking':'/coworking/#pricing','#about-detail':'/about-us/#main','#events-table':'/events/#pricing','#content':u.pathname+'#main'};return legacy[hash]||u.pathname+u.search+u.hash}catch{return p}}
/** Map imported source URLs to verified local files without production hotlinks. */
export function localMedia(value:string):string {if(!value)return '';try{const u=new URL(value);if(u.origin===new URL(process.env.API_URL||'http://localhost:4000/api').origin&&u.pathname.startsWith('/uploads/'))return u.pathname}catch{}const normalized=localPath(value);if(normalized.startsWith('/media/')||normalized.startsWith('/uploads/'))return normalized;const assets=site().assets;if(mediaAssets!==assets){mediaAssets=assets;mediaLookup=new Map((assets as {sourceUrl:string;localPath?:string}[]).filter(a=>a.localPath).map(a=>[a.sourceUrl,a.localPath!]))}return mediaLookup.get(value)||value}
export function jsonLd(value:unknown){return JSON.stringify(value).replace(/</g,'\\u003c')}
export function findPage(term:string){return site().pages.find(p=>p.slug===term||p.path===term||p.path==='/' +term+'/')}
export function routeFor(term:string,fallback='/services/'){const pages=site().pages;const words=term.toLowerCase().replace(/[^a-z0-9]+/g,' ').trim().split(' ');return pages.find(p=>p.slug===term)?.path||pages.find(p=>words.every(w=>(p.slug+' '+p.title).toLowerCase().replace(/-/g,' ').includes(w)))?.path||fallback}
type ApiContent={id:string;slug:string;title:string;content:unknown;excerpt?:string;metadata?:Record<string,unknown>;createdAt?:string;updatedAt?:string};
function fromApi(d:ApiContent,kind:string,original?:Entry):Entry{const m=d.metadata||{};return {...original,id:d.id,slug:d.slug,title:d.title,content:safeContent(d.content),excerpt:d.excerpt||original?.excerpt,path:String(m.path||m.originalPath||original?.path||'/'+d.slug+'/'),type:kind==='blog'?'post':String(m.type||original?.type||'page'),date:String(m.date||m.publishedAt||original?.date||d.createdAt||''),modified:d.updatedAt||original?.modified,seo:m.seo as Entry['seo']||original?.seo,featuredImage:localMedia(String(m.featuredImage||original?.featuredImage||'')),images:((m.images as string[])||original?.images)?.map(localMedia),categories:m.categories as (number|string)[]||original?.categories,tags:m.tags as (number|string)[]||original?.tags,author:String(m.author||original?.author||'Workspace Junction'),featured:m.featured===true}}

const siteCache = new Map<string, { time: number; data: unknown }>();

export async function publicItems(resource:string):Promise<ApiContent[]|null>{
  const cacheKey = 'resource:' + resource;
  const cached = siteCache.get(cacheKey);
  if (cached && Date.now() - cached.time < 30000) return cached.data as ApiContent[];
  try{
    const items:ApiContent[]=[];
    // Keep each cached fetch below Next's 2 MB item limit. The previous
    // 100-record pages response exceeded it; retain the same 1,000-item cap.
    for(let page=1;page<=40;page++){
      const r=await fetch((process.env.API_URL||'http://localhost:4000/api')+'/public/'+resource+'?limit=25&page='+page,{next:{revalidate:30},signal:AbortSignal.timeout(3000)});
      if(!r.ok)return null;
      const d=await r.json(),batch=Array.isArray(d)?d:d.items||[];
      items.push(...batch);
      if(Array.isArray(d)||items.length>=(d.total||0)||batch.length===0)break;
    }
    siteCache.set(cacheKey, { time: Date.now(), data: items });
    return items;
  }catch{return null}
}
/** One published setting by slug (null when absent or the API is unavailable). Avoids pulling the multi-MB settings collection. */
export async function publicSetting(slug:string):Promise<ApiContent|null>{
  const cacheKey = 'setting:' + slug;
  const cached = siteCache.get(cacheKey);
  if (cached && Date.now() - cached.time < 30000) return cached.data as ApiContent;
  try{
    const r=await fetch((process.env.API_URL||'http://localhost:4000/api')+'/public/settings/'+encodeURIComponent(slug),{next:{revalidate:30},signal:AbortSignal.timeout(2500)});
    const data = r.ok?await r.json():null;
    if (data) siteCache.set(cacheKey, { time: Date.now(), data });
    return data;
  }catch{return null}
}
async function businessSettings():Promise<ApiContent[]> {
  const cacheKey = 'settings:business';
  const cached = siteCache.get(cacheKey);
  if (cached && Date.now() - cached.time < 30000) return cached.data as ApiContent[];
  const items:ApiContent[]=[];
  for(const slug of ['business','business-settings']){
    try{
      const r=await fetch((process.env.API_URL||'http://localhost:4000/api')+'/public/settings/'+slug,{next:{revalidate:30},signal:AbortSignal.timeout(1800)});
      if(r.ok)items.push(await r.json());
    }catch{}
  }
  siteCache.set(cacheKey, { time: Date.now(), data: items });
  return items;
}
export async function loadBusiness():Promise<Business>{const b=(await businessSettings())?.find(r=>['business','business-settings'].includes(r.slug))?.metadata||{};const business={...businessDefaults};for(const key of Object.keys(businessDefaults).concat(['logo','seoTitle','seoDescription']) as (keyof Business)[]){if(typeof b[key]==='string'&&String(b[key]).trim())business[key]=String(b[key]).trim()}if(business.logo)business.logo=localMedia(business.logo);return business;}
export const loadSite=cache(async function():Promise<Site>{const original=site();const [pages,services,posts,categories,tags,settings]=await Promise.all([publicItems('pages'),publicItems('services'),publicItems('blog'),publicItems('categories'),publicItems('tags'),businessSettings()]);const b=settings?.find(r=>['business','business-settings'].includes(r.slug))?.metadata||{};const business={...businessDefaults};for(const key of Object.keys(businessDefaults).concat(['logo','seoTitle','seoDescription']) as (keyof Business)[]){if(typeof b[key]==='string'&&String(b[key]).trim())business[key]=String(b[key]).trim()}if(business.logo)business.logo=localMedia(business.logo);return {...original,business,brand:{...original.brand,...(business.logo?{logo:business.logo}:{})},pages:pages!==null?[...pages,...(services||[])].map(d=>fromApi(d,'pages',original.pages.find(p=>p.path===d.metadata?.path||p.slug===d.slug))):original.pages,posts:posts!==null?posts.map(d=>fromApi(d,'blog',original.posts.find(p=>p.slug===d.slug))):original.posts,tags:tags!==null?tags.map(c=>({id:c.id,slug:c.slug,name:c.title})):original.tags||[],categories:categories!==null?categories.map(c=>({id:(c.metadata?.sourceId as number|string)||(c.metadata?.id as number|string)||c.id,slug:c.slug,name:c.title})):original.categories}});
export async function liveEntry(entry:Entry):Promise<Entry>{try{const resource=entry.type==='post'?'blog':'pages';const r=await fetch((process.env.API_URL||'http://localhost:4000/api')+'/public/'+resource+'/'+entry.slug,{next:{revalidate:30},signal:AbortSignal.timeout(1800)});if(!r.ok)return {...entry,content:safeContent(entry.content)};return fromApi(await r.json(),resource,entry)}catch{return {...entry,content:safeContent(entry.content)}}}
export const address='1S280 Summit Ave Unit E2 Suite 1, Oakbrook Terrace, IL 60181';

