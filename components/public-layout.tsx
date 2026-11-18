import {SiteShell,NavLink} from '@/components/site-shell';
import {loadSite,text} from '@/lib/site';
export async function PublicLayout({children, footerLogo}:{children:React.ReactNode; footerLogo?:string}){const s=await loadSite();const links:NavLink[]=s.pages.filter(p=>p.path!=='/'&&(!p.type||p.type==='page'||p.type==='html')&&!/^(?:membership-confirmation|membership-checkout|scrolling-cards|face-linkup|shop)$/.test(p.slug)).map(p=>({label:p.path==='/contact-us/'?'Contact Us':text(p.title),href:p.path}));const b=s.brand as {logo?:string;footerLogo?:string};return <SiteShell business={s.business} links={links} logo={b.logo||"/media/navbar-logo.png"} footerLogo={footerLogo||"/media/figma-home/footer-wordmark.png"}>{children}</SiteShell>}



