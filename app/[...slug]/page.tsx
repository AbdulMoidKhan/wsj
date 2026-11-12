import Image from '@/components/consistent-image';
import Link from 'next/link';
import {notFound} from 'next/navigation';
import type {Metadata} from 'next';
import {ArrowUpRight,Search} from 'lucide-react';
import {site,text,safeContent,routeFor,address,Entry,loadSite,Category,jsonLd} from '@/lib/site';
import {PublicLayout} from '@/components/public-layout';
import {InquiryForm} from '@/components/forms';
import {Pricing} from '@/components/pricing';
import {InnerHero,Highlights,SourceContent,ServiceExplore,pagePhoto,isServicePage,ServiceNav,ServiceOverview,ServiceDetails,InformationalContent} from '@/components/service-page';
import {organizeServiceContent} from '@/lib/service-content';
import {VenueGallery} from '@/components/venue-gallery';
import {LiveSections,liveSectionsFor} from '@/components/live-sections';
import {CommunityNetworkView} from '../../components/community-network-view';
import {fetchCommunityPlans} from '../../lib/community-pricing';
import {fetchCatalogService} from '../../lib/catalog';
import {ServicePricingSection} from '../../components/service-pricing-section';
import {CoworkingView} from '../../components/coworking-view';
import {LibraryView} from '../../components/library-view';
import {EcommercePageView} from '../../components/ecommerce-page-view';
import {CreativeDesignersPageView} from '../../components/creative-designers-view';
import {WorkshopsPageView} from '../../components/workshops-page-view';
import {TradeShowsPageView} from '../../components/trade-shows-view';
import {MembershipsPageView} from '../../components/memberships-page-view';
import {ServicesDirectoryView} from '../../components/services-directory-view';
import {UseCasesView} from '../../components/use-cases-view';
import {VisitPagesView} from '../../components/visit-pages-view';
import {ContactView} from '../../components/contact-view';
import {CreativeServicesView} from '../../components/creative-services-view';
import {InformationPagesView} from '../../components/information-pages-view';
import {DynamicPageView} from '../../components/dynamic-page-view';
import {DYNAMIC_PAGES} from '../../lib/dynamic-pages-config';
import {TestimonialsSection} from '../../components/testimonials-section';
import {FigmaPageView} from '../../components/figma-page/figma-page-view';
import {FigmaPostView} from '../../components/figma-page/figma-post-view';
import {figmaPageFor,FIGMA_ONLY_PATHS} from '../../lib/figma-pages';
export const revalidate=60;
type Props={params:Promise<{slug:string[]}>;searchParams?:Promise<{q?:string;page?:string;category?:string}>};
function pathOf(slug:string[]){return '/'+slug.join('/')+'/'}
async function matching(slug:string[]){const s=await loadSite(),p=pathOf(slug).replace(/\/$/,'');return [...s.pages,...s.posts].find(e=>e.path.replace(/\/$/,'')===p)}
export async function generateMetadata({params}:Props):Promise<Metadata>{const {slug}=await params;const blogPage=['blogs','blog'].includes(slug[0])&&slug.length===3&&slug[1]==='page'?slug[2]:null;const p=await matching(blogPage?[slug[0]]:slug);const category=(slug[0]==='tag'?(await loadSite()).tags||[]:(await loadSite()).categories).find(c=>['category','tag'].includes(slug[0])&&c.slug===slug[1]);if(!p&&!category){const fx=figmaPageFor(pathOf(slug));if(fx)return {title:{absolute:fx.title+' | Workspace Junction'},description:fx.description,alternates:{canonical:pathOf(slug)},openGraph:{title:fx.title,description:fx.description,type:'website'}};return {title:'Page not found',robots:{index:false}}}const rawTitle=text(p?.seo?.title||p?.title||category?.name||'Journal').replace(/^\s*[a-z]/,m=>m.toUpperCase());const title=blogPage?rawTitle+' – Page '+blogPage:rawTitle;return {title:{absolute:title.includes('Workspace')?title:title+' | Workspace Junction'},description:text(p?.seo?.description||p?.excerpt||p?.content||'').slice(0,160)||('Explore '+title+' at Workspace Junction in Oakbrook Terrace.'),alternates:{canonical:blogPage?pathOf(slug):p?.path||pathOf(slug)},openGraph:{title,description:text(p?.seo?.description||p?.excerpt||'').slice(0,160)||('Explore '+title+' at Workspace Junction in Oakbrook Terrace.'),images:p?.featuredImage?[p.featuredImage]:[],type:p?.type==='post'?'article':'website'}}}
export function generateStaticParams(){const d=site(),paths=new Set([...d.pages,...d.posts].filter(p=>p.path!=='/').map(p=>p.path));
 /* archive pagination uses /…/page/N/ paths (static-export friendly, matches canonicals), so pre-render every page of every archive */
 const pagesFor=(base:string,count:number)=>{for(let n=2;n<=Math.ceil(count/ARCHIVE_PAGE_SIZE);n++)paths.add(base+'page/'+n+'/')};
 pagesFor('/blogs/',d.posts.length);
 for(const c of d.categories){const count=d.posts.filter(p=>p.categories?.some(id=>String(id)===String(c.id))).length;if(count){paths.add('/category/'+c.slug+'/');pagesFor('/category/'+c.slug+'/',count)}}
 for(const path of FIGMA_ONLY_PATHS)paths.add(path);
 return [...paths].map(path=>({slug:path.split('/').filter(Boolean)}))}
const ARCHIVE_PAGE_SIZE=9;
/** Category/tag display name: fixes the migrated "bussiness" slug typo and title-cases each word. */
function termName(name:string){return text(name).replace(/\bbuss?iness\b/gi,'Business').replace(/(^|[\s/-])([a-z])/g,(_,a:string,b:string)=>a+b.toUpperCase())}
/** Related stories: same category first, then newest; never the current post and never a repeated cover image. */
function relatedPosts(posts:Entry[],current:Entry,limit=3){
 const shared=(v:Entry)=>v.categories?.filter(id=>current.categories?.some(c=>String(c)===String(id))&&String(id)!=='1').length||0;
 const ranked=posts.filter(v=>v.path!==current.path&&v.id!==current.id).sort((a,b)=>shared(b)-shared(a)||Date.parse(b.date||'')-Date.parse(a.date||''));
 const seen=new Set<string>(current.featuredImage?[current.featuredImage]:[]),picked:Entry[]=[];
 for(const v of ranked){const key=v.featuredImage||'';if(key&&seen.has(key))continue;if(key)seen.add(key);picked.push(v);if(picked.length===limit)break}
 return picked}
export default async function Page({params,searchParams}:Props){
 const {slug}=await params,s=await loadSite();
 const isTag=slug[0]==='tag';const category=(isTag?s.tags||[]:s.categories).find(c=>['category','tag'].includes(slug[0])&&c.slug===slug[1]);
 let source=await matching(slug);
 const isBlogIndex=['blogs','blog'].includes(slug[0])&&(slug.length===1||slug.length===3&&slug[1]==='page');
 if(category||isBlogIndex)return <Archive category={category} isTag={isTag} query={{q:(await searchParams)?.q,page:category?(slug[2]==='page'?slug[3]:undefined):(slug[1]==='page'?slug[2]:undefined)}}/>;
 /* Pages redesigned in Figma ("REDESIGN / … — Homepage Style") render from lib/figma-pages. */
 const figma=figmaPageFor(pathOf(slug));
 if(figma)return <PublicLayout><FigmaPageView page={figma}/></PublicLayout>;
 if(!source)notFound();source={...source,content:safeContent(source.content)};
 if(source.slug==='community-network'){
   const communityPlans = await fetchCommunityPlans();
   return <PublicLayout><CommunityNetworkView plans={communityPlans}/></PublicLayout>;
 }
 if(source.slug==='memberships') {
   /* Pass prices come from the coworking service in the dynamic catalog. */
   const [communityPlans,coworking] = await Promise.all([fetchCommunityPlans(),fetchCatalogService('coworking')]);
   return <PublicLayout><MembershipsPageView communityPlans={communityPlans} coworking={coworking}/></PublicLayout>;
 }
 if(source.slug==='workshops')return <PublicLayout><WorkshopsPageView/></PublicLayout>;
 if(source.slug==='services')return <PublicLayout><ServicesDirectoryView/></PublicLayout>;
 if(source.slug==='use-cases')return <PublicLayout><UseCasesView/></PublicLayout>;
 if(['partners','about-us'].includes(source.slug))return <PublicLayout><InformationPagesView slug={source.slug}/></PublicLayout>;
 if(source.slug==='trade-shows')return <PublicLayout><TradeShowsPageView/></PublicLayout>;
 if(['webinars','photo-studio'].includes(source.slug))return <PublicLayout><CreativeServicesView slug={source.slug}/></PublicLayout>;
 if(source.slug==='contact-us')return <PublicLayout><ContactView/></PublicLayout>;
 if(source.slug==='gallery')return <PublicLayout><VisitPagesView slug={source.slug}/></PublicLayout>;
 if(source.slug==='creative-designers-agencies')return <PublicLayout><CreativeDesignersPageView/></PublicLayout>;
 if(source.slug==='e-commerce-online-business')return <PublicLayout><EcommercePageView/></PublicLayout>;
 if(source.slug==='library')return <PublicLayout><LibraryView/></PublicLayout>;
 if(source.slug==='coworking')return <PublicLayout><CoworkingView/></PublicLayout>;
 if(DYNAMIC_PAGES[source.slug])return <PublicLayout><DynamicPageView slug={source.slug}/></PublicLayout>;
 const p=source,title=text(p.title),isPost=p.type==='post'||s.posts.some(post=>post.path===p.path),isContact=/contact/.test(p.slug),isWorkflow=/membership-checkout|membership-confirmation|book-an-appointment|schedule-a-tour|face-linkup|^shop$/.test(p.slug),isDirectory=/^(services|use-cases|our-partners|partners|community)$/.test(p.slug),legal=/terms|privacy/.test(p.slug),image=pagePhoto(p,isPost);
 if(isPost){const cat=s.categories.find(c=>String(c.id)!=='1'&&p.categories?.some(id=>String(id)===String(c.id)));return <PublicLayout><FigmaPostView p={p} category={cat?termName(cat.name):undefined} related={relatedPosts(s.posts,p)}/><script type="application/ld+json" dangerouslySetInnerHTML={{__html:jsonLd({'@context':'https://schema.org','@type':'BlogPosting',headline:title,datePublished:p.date,dateModified:p.modified||p.date,image:image?(image.startsWith('http')?image:'https://workspacejunction.com'+image):undefined,author:{'@type':'Organization',name:p.author||'Workspace Junction'},publisher:{'@type':'Organization',name:'Workspace Junction'},mainEntityOfPage:'https://workspacejunction.com'+p.path})}}/></PublicLayout>}
 const structured=!isPost&&!legal&&!isContact&&!isWorkflow&&!isDirectory&&isServicePage(p);const organized=!isPost&&!legal?organizeServiceContent(p.content,{informational:!structured}):null;
 const live=!isPost&&!legal&&!isWorkflow?liveSectionsFor(p.path):null;
 /* render the plans wrapper only when the reviewed catalog actually has plans for this page */
 const pricing=!live&&!isPost&&!legal&&!isContact&&!isWorkflow?await Pricing({service:p.slug}):null;
 const crumbs={'@context':'https://schema.org','@type':'BreadcrumbList',itemListElement:[{'@type':'ListItem',position:1,name:'Home',item:'https://workspacejunction.com/'},{'@type':'ListItem',position:2,name:title,item:'https://workspacejunction.com'+p.path}]};
 const hasLivePlans = /^(coworking|events|llc-setup|dedicated|workshops)$/.test(p.slug);
 if(live)return <PublicLayout><main id="main" className="ip-page lx-main">
 <nav className="ip-wrap lx-crumbs" aria-label="Breadcrumb"><Link prefetch={false} href="/">Home</Link><span aria-hidden="true">/</span><span aria-current="page">{title}</span></nav>
 <LiveSections sections={live} title={title} service={title}/>
 {/* The live capture of /gallery/ only holds its heading (the source gallery is a JS widget), so keep the venue gallery the non-live template renders. */}
 {p.slug==='gallery'&&<VenueGallery images={p.images}/>}
 <TestimonialsSection slug={p.slug}/>
 {!hasLivePlans&&!isDirectory&&<ServicePricingSection service={p.slug} serviceTitle={title}/>}
 {!isDirectory&&<ServiceExplore pages={s.pages} current={p}/>}
 </main><script type="application/ld+json" dangerouslySetInnerHTML={{__html:jsonLd(crumbs)}}/></PublicLayout>;
 return <PublicLayout><main id="main" className={'ip-page '+(isPost?'ip-post-page':legal?'ip-legal-page':'')}>
 <InnerHero p={p} isPost={isPost} isContact={isContact} isWorkflow={isWorkflow} legal={legal}/>
 {!isPost&&!isContact&&!isWorkflow&&!legal&&!isDirectory&&<Highlights p={p}/>}
 {p.slug==='gallery'&&<VenueGallery images={p.images}/>}
 {isWorkflow?<section className="ip-wrap ip-form-section" id="ip-details"><div><p className="ip-eyebrow">An inquiry, not a reservation</p><h2>Let’s plan your next step.</h2><p>Tell us what you need and our team will confirm current plans, availability and next steps.</p><div className="ip-notice">This review site does not process payments, create memberships or confirm reservations. Submitting an inquiry is not a confirmed booking.</div></div><InquiryForm service={title}/></section>:isContact?<section className="ip-wrap ip-form-section" id="ip-details"><div><p className="ip-eyebrow">Visit the Junction</p><h2>We’d love to hear from you.</h2><address className="ip-contact-address">{s.business?.address||address}</address><dl className="ip-contact-list"><div><dt>Call us</dt><dd><a href={'tel:'+(s.business?.phoneHref||'+17739861908')}>{s.business?.phone||'(773) 986-1908'}</a></dd></div><div><dt>Email us</dt><dd><a href={'mailto:'+(s.business?.email||'grow@workspacejunction.com')}>{s.business?.email||'grow@workspacejunction.com'}</a></dd></div></dl></div><InquiryForm/></section>:null}
 {isDirectory&&/^(services|use-cases)$/.test(p.slug)&&<ServiceExplore pages={s.pages} current={p} directory industry={p.slug==='use-cases'}/>}
 {structured&&organized?<><ServiceNav/><ServiceOverview p={p} content={organized}/><section className="ip-product-plans" id="ip-plans" aria-label="Reviewed plans and availability">{pricing&&<div className="ip-pricing">{pricing}</div>}<p className="ip-wrap ip-plans-note">Our team confirms current availability, inclusions and next steps. An inquiry does not create a paid membership or confirmed reservation.</p></section><ServiceDetails content={organized}/></>:!isPost&&!legal&&organized?<InformationalContent p={p} content={organized} detailsId={!isContact&&!isWorkflow}/>:<section className={'ip-wrap ip-reading-section '+(isPost?'ip-article-body':'')} id={!isContact&&!isWorkflow?'ip-details':undefined} aria-label={isPost?'Article':'Service information'}>
 {!isPost&&!legal&&<div className="ip-section-heading"><div><p className="ip-eyebrow">{isContact?'Get in touch':isWorkflow?'Helpful information':'The details'}</p><h2>{isDirectory?'Discover the Junction':/about|community|partner/.test(p.slug)?'People, purpose and possibility.':'A closer look at '+title+'.'}</h2></div></div>}
 <SourceContent p={p}/>
 {isPost&&<><div className="post-taxonomy ip-taxonomy">{[...s.categories.filter(c=>p.categories?.some(id=>String(id)===String(c.id))).map(c=>({...c,base:'category'})),...(s.tags||[]).filter(c=>p.tags?.some(id=>String(id)===String(c.id))).map(c=>({...c,base:'tag'}))].map(c=><Link prefetch={false} key={c.base+c.id} href={'/'+c.base+'/'+c.slug+'/'}>{termName(c.name)}</Link>)}</div><div className="share-row ip-share"><span>Share this story</span><a target="_blank" rel="noreferrer" href={'https://www.linkedin.com/sharing/share-offsite/?url='+encodeURIComponent('https://workspacejunction.com'+p.path)}>LinkedIn <ArrowUpRight size={14}/></a><a href={'mailto:?subject='+encodeURIComponent(title)+'&body='+encodeURIComponent('https://workspacejunction.com'+p.path)}>Email <ArrowUpRight size={14}/></a></div></>}
 </section>}
 {!structured&&!isPost&&!legal&&!isContact&&!isWorkflow&&pricing&&<div className="ip-pricing">{pricing}</div>}
 {!isPost&&!legal&&<TestimonialsSection slug={p.slug}/>}
 {!isPost&&!legal&&!isContact&&!isWorkflow&&!isDirectory&&<ServiceExplore pages={s.pages} current={p}/>}

 {isPost&&<section className="ip-related ip-wrap"><div className="ip-section-heading"><div><p className="ip-eyebrow">Keep exploring</p><h2>More from the Junction.</h2></div><Link prefetch={false} href={routeFor('blogs','/blogs/')} className="ip-text-link">All stories <ArrowUpRight size={17}/></Link></div><div className="journal-grid">{relatedPosts(s.posts,p).map(v=><PostCard key={v.path} p={v}/>)}</div></section>}
 </main><script type="application/ld+json" dangerouslySetInnerHTML={{__html:jsonLd(isPost?{'@context':'https://schema.org','@type':'BlogPosting',headline:title,datePublished:p.date,dateModified:p.modified||p.date,image:image?(image.startsWith('http')?image:'https://workspacejunction.com'+image):undefined,author:{'@type':'Organization',name:p.author||'Workspace Junction'},publisher:{'@type':'Organization',name:'Workspace Junction'},mainEntityOfPage:'https://workspacejunction.com'+p.path}:{'@context':'https://schema.org','@type':'BreadcrumbList',itemListElement:[{'@type':'ListItem',position:1,name:'Home',item:'https://workspacejunction.com/'},{'@type':'ListItem',position:2,name:title,item:'https://workspacejunction.com'+p.path}]})}}/></PublicLayout>
}
function PostCard({p}:{p:Entry}){return <Link prefetch={false} href={p.path} className="journal-card ip-journal-card"><div className="journal-image">{p.featuredImage&&<Image src={p.featuredImage} alt={text(p.title)} fill sizes="(max-width:650px) 100vw,33vw" className="cover"/>}</div><p className="eyebrow">{p.date?new Date(p.date).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}):'THE JUNCTION JOURNAL'}</p><h3>{text(p.title)}</h3><p className="journal-excerpt">{text(p.excerpt||p.content).slice(0,145)}…</p><span className="text-link">Read the story <ArrowUpRight size={15}/></span></Link>}
async function Archive({category,query,isTag=false}:{category?:Category;isTag?:boolean;query:{q?:string;page?:string;category?:string}}){const s=await loadSite(),q=query.q||'',selected=category||s.categories.find(c=>c.slug===query.category);const filtered=[...s.posts].sort((a,b)=>Number(b.featured)-Number(a.featured)||Date.parse(b.date||'')-Date.parse(a.date||'')).filter(p=>(!selected||(isTag?p.tags:p.categories)?.some(id=>String(id)===String(selected.id)))&&(!q||(text(p.title)+' '+text(p.content)).toLowerCase().includes(q.toLowerCase())));const total=Math.max(1,Math.ceil(filtered.length/ARCHIVE_PAGE_SIZE)),page=Math.min(total,Math.max(1,Math.floor(Number(query.page))||1));const base=category?(isTag?'/tag/':'/category/')+category.slug+'/':routeFor('blogs','/blogs/');const makeUrl=(n:number)=>{const target=n<=1?base:base+'page/'+n+'/';return q?target+'?q='+encodeURIComponent(q):target;};const windowed=[...new Set([1,page-1,page,page+1,total])].filter(n=>n>=1&&n<=total).sort((a,b)=>a-b);return <PublicLayout><main id="main" className="container ip-wrap ip-archive"><section className="archive-intro"><p className="eyebrow">THE JUNCTION JOURNAL</p><h1>{category?termName(category.name):<>Ideas. Perspectives.<br/>Possibilities.</>}</h1><p>Fresh thinking for the way you work, create and grow.</p></section><div className="archive-tools"><div className="category-tabs"><Link prefetch={false} className={!selected?'active':''} href={routeFor('blogs','/blogs/')}>All stories</Link>{s.categories.map(c=><Link prefetch={false} className={selected?.id===c.id?'active':''} key={c.id} href={'/category/'+c.slug+'/'}>{termName(c.name)}</Link>)}</div><form className="search-input" action={base}><Search size={15}/><input name="q" defaultValue={q} aria-label="Search journal" placeholder="Find a little inspiration…"/><button className="icon-btn" type="submit" aria-label="Search"><ArrowUpRight size={16}/></button></form></div><h2 className="lv-sr">{category?termName(category.name)+' stories':'Latest stories'}</h2>{filtered.length?<div className="archive-grid">{filtered.slice((page-1)*ARCHIVE_PAGE_SIZE,page*ARCHIVE_PAGE_SIZE).map(p=><PostCard key={p.path} p={p}/>)}</div>:<div className="archive-empty" role="status"><p>{q?<>No stories match “{q}”{selected?<> in {termName(selected.name)}</>:null}.</>:selected?<>No stories have been published in {termName(selected.name)} yet.</>:'No stories have been published yet.'}</p><Link prefetch={false} href={routeFor('blogs','/blogs/')} className="text-link">Browse all stories <ArrowUpRight size={16}/></Link></div>}{total>1&&<nav className="pagination archive-pagination" aria-label="Pagination">{page>1?<Link prefetch={false} className="pagination-step pagination-prev" rel="prev" href={makeUrl(page-1)}><span aria-hidden="true">←</span> Previous</Link>:<span className="pagination-step pagination-prev is-disabled" aria-hidden="true"><span>←</span> Previous</span>}<span className="pagination-pages">{windowed.map((n,i)=><span className="pagination-item" key={n}>{i>0&&n-windowed[i-1]>1&&<span className="pagination-gap" aria-hidden="true">…</span>}<Link prefetch={false} className={page===n?'active':''} aria-current={page===n?'page':undefined} aria-label={'Page '+n} href={makeUrl(n)}>{n}</Link></span>)}</span>{page<total?<Link prefetch={false} className="pagination-step pagination-next" rel="next" href={makeUrl(page+1)}>Next <span aria-hidden="true">→</span></Link>:<span className="pagination-step pagination-next is-disabled" aria-hidden="true">Next <span>→</span></span>}</nav>}</main></PublicLayout>}


