import type { Metadata, Viewport } from 'next';
import {Playfair_Display, Inter} from 'next/font/google';
import {loadSite} from '@/lib/site';
import './globals.css';
import './design.css';
import './responsive.css';
import './type-scale.css';
import './platform.css';
import './homepage.css';
import './inner-pages.css';
import './platform-components.css';
import './inquiry-design.css';
import './classic.css';
import './design-system.css';
import './inner-redesign.css';
import './community-network.css';
import './services-redesign.css';
import './consistency-system.css';
import './button-system.css';
import './requested-pages-polish.css';
import './mega-menu.css';
import './motion-system.css';
import './decorative-system.css';
// Loaded last: the senior art-direction layer that re-proportions the existing
// brand into the architectural editorial system. Copy and palette unchanged.
import './architectural-redesign.css';

// Classic editorial pairing: Playfair Display for display type, Inter for reading text.
const display = Playfair_Display({subsets:['latin'], variable:'--font-display', display:'swap', style:['normal','italic']});
const sans = Inter({subsets:['latin'], variable:'--font-sans', display:'swap'});
export const viewport:Viewport = {themeColor:'#D0CFCB'};
const defaultMetadata:Metadata={metadataBase:new URL(process.env.NEXT_PUBLIC_SITE_URL||'https://workspacejunction.com'),title:{default:'Workspace Junction | Work. Connect. Grow.',template:'%s | Workspace Junction'},description:'Coworking, meeting rooms, creative studios and business services in Oakbrook Terrace, Illinois.',openGraph:{siteName:'Workspace Junction',locale:'en_US',type:'website'}};
export async function generateMetadata():Promise<Metadata>{const b=(await loadSite()).business;return {...defaultMetadata,...(b?.seoTitle?{title:{default:b.seoTitle,template:'%s | Workspace Junction'}}:{}),description:b?.seoDescription||defaultMetadata.description}}
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en" className={`${display.variable} ${sans.variable}`}><body>{children}</body></html>}
