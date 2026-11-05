import type {MetadataRoute} from 'next';
import {loadSite} from '@/lib/site';
import redirects from '@/data/redirects.json';
export const revalidate=60;

const norm=(path:string)=>('/'+path.replace(/^\/+|\/+$/g,'')+'/').replace(/^\/\/$/,'/');
/* Paths that 301 elsewhere must not be advertised (they would be "page with redirect" in Search Console). */
const redirected=new Set((redirects as Array<{source:string}>).map(r=>norm(r.source)));
const hidden=/^\/(membership-(checkout|confirmation)|face-linkup|scrolling-cards|menu-page|shop)(\/|$)/;

export default async function sitemap():Promise<MetadataRoute.Sitemap>{
 const s=await loadSite();
 const base=process.env.NEXT_PUBLIC_SITE_URL||'https://workspacejunction.com';
 const postCount=(id:string|number,key:'categories'|'tags')=>s.posts.filter(p=>(p as unknown as Record<string,Array<string|number>|undefined>)[key]?.some(v=>String(v)===String(id))).length;
 const emptyArchive=new Set<string>();
 const records:MetadataRoute.Sitemap=[...s.pages,...s.posts].filter(p=>!hidden.test(p.path)).map(p=>({url:base+p.path,lastModified:p.modified||p.date||undefined,changeFrequency:p.type==='post'?'monthly' as const:'weekly' as const,priority:p.path==='/'?1:.7}));
 for(const [kind,items,key] of [['category',s.categories,'categories'],['tag',s.tags||[],'tags']] as const)for(const c of items){
  const path='/'+kind+'/'+c.slug+'/';
  /* empty category/tag archives are thin pages: leave them out */
  if(!postCount(c.id,key)){emptyArchive.add(path);continue}
  records.push({url:base+path,lastModified:undefined,changeFrequency:'weekly',priority:.5});
 }
 const keep=records.filter(r=>{const path=norm(r.url.slice(base.length)||'/');return !redirected.has(path)&&![...emptyArchive].some(a=>path.startsWith(a))});
 return [...new Map(keep.map(r=>[r.url,r])).values()];
}