import Image from '@/components/consistent-image';
import Link from 'next/link';
import {ArrowUpRight, BookOpen, Plus} from 'lucide-react';
import {BookingButton} from './booking';
import {TestimonialsSection} from './testimonials-section';
import livePages from '@/data/live-pages.json';
import {safeContent} from '@/lib/site';
import './library-view.css';

type Node = {t:string; children?:Node[]; items?:{q:string;a:string}[]};
function findFaq(nodes:Node[]):{q:string;a:string}[]{for(const node of nodes){if(node.t==='faq')return node.items||[];const found=findFaq(node.children||[]);if(found.length)return found;}return [];}
const faq = findFaq(livePages.pages['/library/'] as unknown as Node[]);
const steps = [
 ['Become a member','Library access is included with an active Coworking or Dedicated Desk Membership.'],
 ['Set up your library profile','Our team creates or activates your Library User profile so you can borrow under your name.'],
 ['Find your next read','Browse the curated collection on-site and choose the books that spark your curiosity.'],
 ['Check out at the front desk','Bring your books to our team. We’ll assign them to your profile and confirm your return date.'],
 ['Make time for a good book','Settle into the library or take selected books with you, according to their lending rules.'],
 ['Return, renew, repeat','Return books at the front desk by their due date. Need more time? Ask about a renewal.']
];
export function LibraryView(){return <main id="main" className="library-page">
 <div className="library-wrap">
  <nav className="library-crumbs" aria-label="Breadcrumb"><Link href="/">Home</Link><span>/</span><span aria-current="page">Library</span></nav>
  <section className="library-hero" aria-labelledby="library-title">
   <div><p className="library-eyebrow"><BookOpen size={16}/> THE WORKSPACE JUNCTION LIBRARY</p><h1 id="library-title">A little quiet.<br/>A world of <em>ideas.</em></h1></div>
   <div className="library-heroCopy"><p>A place to pause, read, and focus. Discover handpicked books and resources for your next chapter, right here at the Junction.</p><div className="library-actions"><BookingButton className="library-button" service="Library">Become a member <ArrowUpRight size={18}/></BookingButton><a className="library-textLink" href="https://www.libib.com/u/workspacejunction" target="_blank" rel="noreferrer">Browse the catalog <ArrowUpRight size={17}/></a></div></div>
  </section>
  <figure className="library-heroImage"><Image src="/media/5668e4a90b-library-image.png" alt="Members reading beside the bookshelves at Workspace Junction" width={1170} height={406} sizes="(max-width: 760px) 100vw, 1200px" priority/><figcaption><span>ROOM TO THINK. SPACE TO GROW.</span><span>Oakbrook Terrace, IL</span></figcaption></figure>
  <section className="library-intro" aria-labelledby="library-intro"><div><p className="library-eyebrow">SLOW DOWN. GET INSPIRED.</p><h2 id="library-intro">Read, learn,<br/>and reflect.</h2></div><div><p>Step away from the busy workday and spend time with a fresh perspective. Our library brings together curated books and research catalogs on business, entrepreneurship, technology, and personal growth.</p><p>Read freely in a calm, distraction-free setting. No reservation needed for members, just a little time and an open mind.</p><a className="library-textLink" href="#library-access">Explore library access <ArrowUpRight size={17}/></a></div></section>
 </div>
 <section className="library-works" aria-labelledby="library-works"><div className="library-wrap"><div className="library-sectionHead"><div><p className="library-eyebrow">FROM THE SHELF TO YOUR NEXT IDEA</p><h2 id="library-works">Make yourself<br/>at home.</h2></div><p>Getting started is simple. Our front desk team will help with everything from your first checkout to your next renewal.</p></div><ol className="library-steps">{steps.map(([title,desc],i)=><li key={title}><span className="library-number">0{i+1}</span><h3>{title}</h3><p>{desc}</p></li>)}</ol></div></section>
 <div className="library-wrap">
  <section className="library-access" id="library-access" aria-labelledby="access-title"><div className="library-accessImage"><Image src="/media/eb8c6afe1d-library-image3.png" alt="The library collection and reading area" width={493} height={356} sizes="(max-width: 760px) 100vw, 550px"/></div><div><p className="library-eyebrow">A RESOURCE FOR OUR COMMUNITY</p><h2 id="access-title">Your membership.<br/>More possibilities.</h2><p>The library is reserved for Workspace Junction members and authorized guests, keeping it a quiet, focused space for learning and thoughtful work.</p><p>Active Coworking and Dedicated Desk members can ask our front desk team to activate a Library User profile and start borrowing.</p><div className="library-actions"><BookingButton className="library-button" service="Library">Ask about membership <ArrowUpRight size={18}/></BookingButton><a className="library-textLink" href="https://www.libib.com/u/workspacejunction" target="_blank" rel="noreferrer">View collection <ArrowUpRight size={17}/></a></div></div></section>
  <section className="library-faq" aria-labelledby="faq-title"><div><p className="library-eyebrow">GOOD TO KNOW</p><h2 id="faq-title">A few things<br/>before you visit.</h2><p>Access, borrowing, and everything in between.</p><Link className="library-textLink" href="/contact-us/">Talk to our team <ArrowUpRight size={17}/></Link></div><div className="library-faqList">{faq.map(item=><details key={item.q}><summary>{item.q}<Plus size={18}/></summary><div dangerouslySetInnerHTML={{__html:safeContent(item.a)}}/></details>)}</div></section>
 </div>
 <TestimonialsSection slug="library"/>
 </main>}
