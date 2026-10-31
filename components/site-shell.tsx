'use client';

import Link from 'next/link';
import Image from 'next/image';
import {flushSync} from 'react-dom';
import type {Business} from '@/lib/site';
import {useEffect, useRef, useState, type ReactNode} from 'react';
import {usePathname} from 'next/navigation';
import {ArrowUpRight, Building2, CalendarDays, Handshake, Landmark, Laptop, Mailbox, Menu, Mic, Monitor, Phone, Search, Users, X} from 'lucide-react';
import {BookingButton, BookingLauncher} from './booking';
import {CampaignLoader} from './campaign-loader';
import {AmbientBackdrop, MotionController, MotionToggle} from './ambient';
import {SceneBackdrop} from './scene-backdrop';
import {GsapMotion} from './gsap-motion';

export type NavLink = {label:string; href:string};
type LinkGroup = {title:string; items:NavLink[]};

function groupLinks(links:NavLink[]):LinkGroup[] {
  const groups:LinkGroup[] = [
    {title:'Work & Meet', items:[]},
    {title:'Business Services', items:[]},
    {title:'Create & Connect', items:[]},
    {title:'Explore the Junction', items:[]},
  ];
  const unique = links.filter((link, index, all) => all.findIndex(item => item.href === link.href) === index);
  const pathOf = (link:NavLink) => link.href.split(/[?#]/)[0].replace(/\/$/, '').toLowerCase();
  const membershipPaths = ['/memberships', '/membership-plans', '/monthly-memberships', '/monthly_memberships'];
  const membership = membershipPaths.find(path => unique.some(link => pathOf(link) === path));
  const coreExplore = /^(about(?: us)?|community(?: network)?|blogs?|journal|services|use cases|partners|gallery|contact(?: us)?)$/i;
  for (const link of unique) {
    const path = pathOf(link);
    // Preserve source routes, but omit prototypes, package utilities and industry details from primary navigation.
    if (/^\/(?:home(?:-new|-redesign)?|menu-page|scrolling-cards|face-linkup|shop|membership-checkout|membership-confirmation|book-an-appointment|schedule-a-tour|admin)(?:\/|$)/.test(path)
      || /^\/(?:csb_[^/]+|wj-package|category|use-cases)\//.test(path)) continue;
    if (membershipPaths.includes(path) && path !== membership) continue;
    const value = (link.label + ' ' + path).toLowerCase();
    const explore = coreExplore.test(link.label.trim()) || /^\/(?:about-us|community-network|blogs|journal|services|use-cases|partners|gallery|contact-us)$/.test(path);
    const index = explore ? 3
      : /podcast|photo|studio|event|workshop|webinar|library|trade.show/.test(value) ? 2
      : /virtual|mail|business.address|printing|printed|automation|llc|digital|bpo|notary/.test(value) ? 1
      : /cowork|dedicated|meeting|office|desk|membership/.test(value) ? 0 : -1;
    if (index >= 0) groups[index].items.push(link);
  }
  return groups.filter(group => group.items.length > 0);
}

type SiteShellProps = {children:ReactNode; links:NavLink[]; logo?:string; business?:Business};

export function SiteShell(props:SiteShellProps) {
  const pathname = usePathname();
  // Navigation owns transient menu state; route changes remount only the public shell.
  return pathname.startsWith('/admin') ? props.children : <PublicSiteShell key={pathname} {...props} pathname={pathname}/>;
}

function PublicSiteShell({children, links, logo, business, pathname}:SiteShellProps & {pathname:string}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const mobileTrigger = useRef<HTMLButtonElement>(null);
  const searchTrigger = useRef<HTMLButtonElement>(null);
  const mobilePanel = useRef<HTMLDivElement>(null);
  const b = business || {phone:'(773) 986-1908', phoneHref:'+17739861908', email:'grow@workspacejunction.com', address:'1S280 Summit Ave, Unit E2 Suite 1, Oakbrook Terrace, IL 60181', tagline:'A space for your next chapter.'};
  const groups = groupLinks(links);
  const find = (pattern:RegExp, fallback:string) => links.find(link => pattern.test(link.label))?.href || fallback;
  const servicesHref = find(/^services$/i, '/services/');
  const contactHref = find(/^contact/i, '/contact-us/');
  const closeMobile = () => {setMobileOpen(false);};
  const aboutHref = links.find(link => /^about/i.test(link.label))?.href;
  // Secondary strip mirrors the live site's service bar (icon over label).
  const strip = [
    {label:'Coworking', href:'/coworking/', icon:Landmark},
    {label:'Dedicated Desks', href:'/dedicated/', icon:Monitor},
    {label:'Business Address', href:'/business-address/', icon:Building2},
    {label:'Event Space', href:'/events/', icon:CalendarDays},
    {label:'Podcast Studio', href:'/podcast-studio/', icon:Mic},
    {label:'Virtual Offices', href:'/virtual-office/', icon:Laptop},
    {label:'Meeting Rooms', href:'/meeting-rooms/', icon:Users},
    {label:'Mailbox', href:'/mail-box/', icon:Mailbox},
    {label:'Community', href:'/community-network/', icon:Handshake},
  ];

  useEffect(() => {
    if (!mobileOpen) return;
    const trigger = mobileTrigger.current;
    const body = document.body;
    const root = document.documentElement;
    const scrollX = window.scrollX, scrollY = window.scrollY;
    const saved = {overflow:body.style.overflow, position:body.style.position, top:body.style.top, left:body.style.left, width:body.style.width, paddingRight:body.style.paddingRight, rootOverflow:root.style.overflow};
    const gutter = window.innerWidth - root.clientWidth;
    if (gutter > 0) body.style.paddingRight = (parseFloat(getComputedStyle(body).paddingRight) + gutter) + 'px';
    Object.assign(body.style, {overflow:'hidden', position:'fixed', top:-scrollY+'px', left:-scrollX+'px', width:'100%'});
    root.style.overflow = 'hidden';
    // aria-modal alone does not isolate background controls from pointer/AT access.
    const background = Array.from(mobilePanel.current?.parentElement?.children || []).filter((item):item is HTMLElement => item instanceof HTMLElement && item !== mobilePanel.current).map(item => ({item, inert:item.inert}));
    background.forEach(({item}) => {item.inert = true;});
    mobilePanel.current?.querySelector<HTMLButtonElement>('button')?.focus({preventScroll:true});
    const keydown = (event:KeyboardEvent) => {
      if (event.key === 'Escape') {event.preventDefault(); setMobileOpen(false);}
      if (event.key !== 'Tab') return;
      const targets = Array.from(mobilePanel.current?.querySelectorAll<HTMLElement>('a[href],button:not([disabled]),summary,[tabindex="0"]') || []).filter(item => item.getClientRects().length > 0);
      const first = targets[0], last = targets[targets.length - 1];
      if (!first) return;
      if (event.shiftKey && (document.activeElement === first || !mobilePanel.current?.contains(document.activeElement))) {event.preventDefault(); last.focus();}
      else if (!event.shiftKey && (document.activeElement === last || !mobilePanel.current?.contains(document.activeElement))) {event.preventDefault(); first.focus();}
    };
    document.addEventListener('keydown', keydown);
    return () => {
      document.removeEventListener('keydown', keydown);
      background.forEach(({item, inert}) => {item.inert = inert;});
      Object.assign(body.style, {overflow:saved.overflow, position:saved.position, top:saved.top, left:saved.left, width:saved.width, paddingRight:saved.paddingRight});
      root.style.overflow = saved.rootOverflow;
      // Defeat CSS smooth scrolling only for restoration of the frozen page.
      const behavior = root.style.scrollBehavior;
      root.style.scrollBehavior = 'auto';
      window.scrollTo(scrollX, scrollY);
      root.style.scrollBehavior = behavior;
      if (trigger?.isConnected) trigger.focus({preventScroll:true});
    };
  }, [mobileOpen]);

  const linkList = (items:NavLink[], close?:() => void) => items.map(link => (
    <Link prefetch={false} href={link.href} key={link.href} onClick={close} aria-current={pathname.replace(/\/$/, '') === link.href.replace(/\/$/, '') ? 'page' : undefined}>
      <span>{link.label}</span>
    </Link>
  ));
  const brand = <>{logo ? <Image src={logo} alt="Workspace Junction" width={220} height={64} priority className="wj-logo"/> : <span className="wj-wordmark">Workspace<span>Junction<span className="wj-brand-dot">.</span></span></span>}</>;

  return <div className="wj-platform">
    <a className="wj-skip" href="#main">Skip to content</a>
    <AmbientBackdrop/>
    <SceneBackdrop/>
    <header className="wj-header lv-header">
      <div className="container lv-head-row">
        <Link prefetch={false} href="/" className="wj-brand" aria-label="Workspace Junction home">{brand}</Link>
        <div className="lv-head-right">
          <Link prefetch={false} href={pathname === '/' ? '#pricing' : '/#pricing'} className="lv-plans">
            <span className="lv-plans-shine" aria-hidden="true"/>
            <span className="lv-plans-text-full">Plans &amp; Pricing</span>
            <span className="lv-plans-text-short">Plans</span>
          </Link>
          <a href={'tel:'+b.phoneHref} className="lv-phone"><span className="lv-phone-icon"><Phone size={15} aria-hidden="true"/></span><span>{b.phone}</span></a>
          <div className="lv-search">
            <button type="button" className="lv-icon-btn" ref={searchTrigger} aria-label="Search" aria-expanded={searchOpen} aria-controls="lv-search-form" onClick={() => setSearchOpen(!searchOpen)}><Search size={18} aria-hidden="true"/></button>
            {searchOpen && <form id="lv-search-form" action="/blogs/" method="get" role="search" className="lv-search-form" onKeyDown={event => {if (event.key === 'Escape') {event.preventDefault(); setSearchOpen(false); searchTrigger.current?.focus();}}}><label className="lv-sr" htmlFor="lv-q">Search Workspace Junction</label><input id="lv-q" name="q" type="search" placeholder="Search articles, rooms and services..." autoFocus/><button type="submit" className="lv-pill-mini">Search</button></form>}
          </div>
          <nav className="lv-primary" aria-label="Main navigation">
            <Link prefetch={false} href="/" aria-current={pathname === '/' ? 'page' : undefined}><span>Home</span></Link>
            {aboutHref && <Link prefetch={false} href={aboutHref} aria-current={pathname === aboutHref ? 'page' : undefined}><span>About Us</span></Link>}
            <Link prefetch={false} href={contactHref} aria-current={pathname === contactHref ? 'page' : undefined}><span>Contact</span></Link>
          </nav>
          <button type="button" className="wj-menu-toggle lv-burger" ref={mobileTrigger} aria-label="Open menu" aria-expanded={mobileOpen} aria-controls="wj-mobile-menu" onClick={() => {setMobileOpen(true); setSearchOpen(false);}}><Menu size={24} aria-hidden="true"/></button>
        </div>
      </div>
      <nav className="lv-strip" aria-label="Spaces and services">
        <ul className="container">{strip.map(item => <li key={item.href}><Link prefetch={false} href={item.href} aria-current={pathname === item.href ? 'page' : undefined}><item.icon size={18} strokeWidth={1.5} aria-hidden="true"/><span>{item.label}</span></Link></li>)}</ul>
      </nav>
    </header>
    {mobileOpen && <div className="wj-mobile-panel" id="wj-mobile-menu" role="dialog" aria-modal="true" aria-label="Navigation menu" ref={mobilePanel}>
      <div className="wj-mobile-top"><span>Explore the Junction</span><button type="button" className="wj-menu-toggle" aria-label="Close menu" onClick={closeMobile}><X size={24} aria-hidden="true"/></button></div>
      <nav aria-label="Mobile navigation" className="wj-mobile-nav">
        <div className="wj-mobile-primary"><Link prefetch={false} href="/" onClick={closeMobile}><span>Home</span></Link><Link prefetch={false} href={servicesHref} onClick={closeMobile}><span>All spaces & services</span></Link></div>
        {groups.map(group => <div className="wj-nav-group" key={group.title}><h2>{group.title}</h2>{linkList(group.items, closeMobile)}</div>)}
      </nav>
      <div className="wj-mobile-actions"><button type="button" className="btn btn-primary" aria-haspopup="dialog" onClick={() => {flushSync(closeMobile); window.dispatchEvent(new CustomEvent('wj:book', {detail:{trigger:mobileTrigger.current}}));}}>Find your space <ArrowUpRight size={17} aria-hidden="true"/></button><a href={'tel:'+b.phoneHref}>{b.phone}</a></div>
    </div>}
    {children}
    {pathname !== '/' && <section className="wj-closing amb-local" aria-labelledby="wj-closing-title"><div className="container wj-closing-inner"><div><p className="eyebrow">Your next chapter starts here</p><h2 id="wj-closing-title" aria-label="Good things happen at the Junction.">Good things happen<br/>at the Junction.</h2><p>Work. Connect. Grow.</p></div><div className="wj-closing-actions"><BookingButton className="btn btn-cream">Come see for yourself <ArrowUpRight size={19} aria-hidden="true"/></BookingButton><Link prefetch={false} href={contactHref} className="text-link">Talk to our team <ArrowUpRight size={17} aria-hidden="true"/></Link></div></div></section>}
    <footer className="wj-footer amb-local"><div className="container">
      <div className="wj-footer-top"><div><Link prefetch={false} href="/" className="wj-footer-brand">Workspace Junction<span data-business-tagline>{b.tagline}</span></Link></div><div><h2>Come find us</h2><p>{b.address}</p><a href={'https://maps.google.com/?q='+encodeURIComponent(b.address)} target="_blank" rel="noreferrer">Get directions <ArrowUpRight size={16} aria-hidden="true"/></a></div><div><h2>Let’s talk</h2><a href={'tel:'+b.phoneHref}>{b.phone}</a><a href={'mailto:'+b.email}>{b.email}</a><Link prefetch={false} href="/admin/">Member of the team? Admin <ArrowUpRight size={14} aria-hidden="true"/></Link></div></div>
      <div className="wj-footer-links">{groups.map(group => <div key={group.title}><h2>{group.title}</h2>{linkList(group.items)}</div>)}</div>
      <div className="wj-footer-bottom"><span>© {new Date().getFullYear()} Workspace Junction</span><span>Work with purpose. Grow together.</span><Link prefetch={false} href={find(/terms|privacy/i, '/terms-and-privacy/')}>Terms & Privacy</Link></div>
    </div></footer>
    <BookingLauncher/><CampaignLoader/><MotionToggle/><MotionController/><GsapMotion/>
  </div>;
}
