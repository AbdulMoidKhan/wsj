'use client';

import Link from 'next/link';
import Image from '@/components/consistent-image';
import {flushSync} from 'react-dom';
import type {Business} from '@/lib/site';
import {useEffect, useRef, useState, type ReactNode} from 'react';
import {usePathname} from 'next/navigation';
import {ArrowUpRight, Building2, CalendarDays, ChevronDown, Handshake, Landmark, Laptop, Mailbox, MapPin, Menu, Mic, Monitor, Phone, Users, X} from 'lucide-react';
import {BookingButton, BookingLauncher} from './booking';
import {SiteFooter} from './site-footer';
import {CampaignLoader} from './campaign-loader';
import {AmbientBackdrop} from './ambient';
import {SceneBackdrop} from './scene-backdrop';
import {GsapMotion} from './gsap-motion';

export type NavLink = {label:string; href:string};
type LinkGroup = {title:string; items:NavLink[]};
const routePath = (href:string) => href.split(/[?#]/)[0].replace(/\/+$/, '').toLowerCase() || '/';

function groupLinks(links:NavLink[]):LinkGroup[] {
  const groups:LinkGroup[] = [
    {title:'Work & Meet', items:[]},
    {title:'Business Services', items:[]},
    {title:'Create & Connect', items:[]},
    {title:'Explore the Junction', items:[{label:'Home', href:'/'}]},
  ];
  const publicLinks = links.filter(link => /^\/(?!\/)/.test(link.href));
  const unique = publicLinks.filter((link, index, all) => all.findIndex(item => routePath(item.href) === routePath(link.href)) === index);
  const pathOf = (link:NavLink) => routePath(link.href);
  const membershipPaths = ['/memberships', '/membership-plans', '/monthly-memberships', '/monthly_memberships'];
  const membership = membershipPaths.find(path => unique.some(link => pathOf(link) === path));
  const coreExplore = /^(about(?: us)?|community(?: network)?|blogs?|journal|services|use cases|partners|gallery|contact(?: us)?)$/i;
  for (const link of unique) {
    const path = pathOf(link);
    // Preserve source routes, but omit prototypes, package utilities and industry details from primary navigation.
    if (path === '/' || /^\/(?:home(?:-new|-redesign)?|menu-page|scrolling-cards|face-linkup|shop|membership-checkout|membership-confirmation|book-an-appointment|schedule-a-tour|booking-confirmation|terms-and-privacy|admin)(?:\/|$)/.test(path)
      || /^\/(?:csb_[^/]+|wj-package|category|use-cases)\//.test(path)) continue;
    if (membershipPaths.includes(path) && path !== membership) continue;
    const value = (link.label + ' ' + path).toLowerCase();
    const explore = coreExplore.test(link.label.trim()) || /^\/(?:about-us|community-network|blogs|journal|services|use-cases|partners|gallery|contact-us)$/.test(path);
    const index = explore || /e-commerce|creative-designers/.test(path) ? 3
      : /podcast|photo|studio|event|workshop|webinar|library|trade.show/.test(value) ? 2
      : /virtual|mail|business.address|printing|printed|automation|llc|digital|bpo|notary/.test(value) ? 1
      : /cowork|dedicated|meeting|office|desk|membership/.test(value) ? 0 : -1;
    if (index >= 0) groups[index].items.push({...link, label:({'/dedicated':'Dedicated Desks','/events':'Event Space','/virtual-office':'Virtual Offices','/mail-box':'Mailbox','/photo-studio':'Photo Studio','/bpo-services':'BPO Services'} as Record<string,string>)[path] || link.label});
  }
  return groups.filter(group => group.items.length > 0);
}

type SiteShellProps = {children:ReactNode; links:NavLink[]; logo?:string; footerLogo?:string; business?:Business};

export function SiteShell(props:SiteShellProps) {
  const pathname = usePathname();
  // Navigation owns transient menu state; route changes remount only the public shell.
  return (pathname === '/admin' || pathname.startsWith('/admin/')) ? props.children : <PublicSiteShell key={pathname} {...props} pathname={pathname}/>;
}

function PublicSiteShell({children, links, logo, footerLogo, business, pathname}:SiteShellProps & {pathname:string}) {
  const [mobileMounted, setMobileMounted] = useState(false);
  const [mobileClosing, setMobileClosing] = useState(false);
  const [openMegaGroup, setOpenMegaGroup] = useState('Work & Meet');
  const [compact, setCompact] = useState(false);
  const mobileTrigger = useRef<HTMLButtonElement>(null);
  const headerRef = useRef<HTMLElement>(null);
  const mobilePanel = useRef<HTMLDivElement>(null);
  const closeTimer = useRef<NodeJS.Timeout | null>(null);
  const b = business || {phone:'(773) 986-1908', phoneHref:'+17739861908', email:'grow@workspacejunction.com', address:'1S280 Summit Ave, Unit E2 Suite 1, Oakbrook Terrace, IL 60181', tagline:'A space for your next chapter.'};
  const groups = groupLinks(links);
  const find = (pattern:RegExp, fallback:string) => links.find(link => /^\/(?!\/|admin(?:\/|$))/i.test(link.href) && pattern.test(link.label))?.href || fallback;
  const contactHref = find(/^contact/i, '/contact-us/');
  const logoSrc = logo || '/media/navbar-logo.png';
  const footerLogoSrc = footerLogo || '/media/footer-logo.png';

  const openMobile = () => {
    if (closeTimer.current) { clearTimeout(closeTimer.current); closeTimer.current = null; }
    setMobileClosing(false);
    setMobileMounted(true);
  };

  const closeMobile = () => {
    if (closeTimer.current || !mobileMounted) return;
    setMobileClosing(true);
    closeTimer.current = setTimeout(() => {
      setMobileMounted(false);
      setMobileClosing(false);
      closeTimer.current = null;
    }, 280);
  };
  useEffect(() => () => {if (closeTimer.current) clearTimeout(closeTimer.current);}, []);
  /* One breakpoint decides the navigation model: a three-part desktop sheet or
     a single-column accordion. They are different compositions, not one layout
     folded up. */
  useEffect(() => {
    const query = window.matchMedia('(max-width:959px)');
    const apply = () => setCompact(query.matches);
    apply();
    query.addEventListener('change', apply);
    return () => query.removeEventListener('change', apply);
  }, []);
  const isCurrent = (href:string) => routePath(pathname) === routePath(href);
  const aboutHref = find(/^about/i, '/about-us/');
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

  /* The header docks on scroll: the category index compresses to a single
     precise rule so the page, not the navigation, holds the viewport. */
  useEffect(() => {
    const header = headerRef.current;
    if (!header) return;
    let frame = 0;
    const apply = () => {
      frame = 0;
      header.classList.toggle('is-docked', window.scrollY > 96);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(apply);
    };
    apply();
    window.addEventListener('scroll', onScroll, {passive: true});
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  useEffect(() => {
    if (!mobileMounted) return;
    const trigger = mobileTrigger.current;
    const panel = mobilePanel.current;
    // Presentation lives in app/mega-nav.css (layer wj-art); no inline overrides.
    const onPanelWheel = (event:WheelEvent) => {
      if (!panel || panel.scrollHeight <= panel.clientHeight || Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;
      event.preventDefault();
      event.stopPropagation();
      panel.scrollTop += event.deltaY;
    };
    panel?.addEventListener('wheel', onPanelWheel, {passive:false});
    const body = document.body;
    const root = document.documentElement;
    const scrollX = window.scrollX, scrollY = window.scrollY;
    const saved = {overflow:body.style.overflow, position:body.style.position, top:body.style.top, left:body.style.left, width:body.style.width, paddingRight:body.style.paddingRight, rootOverflow:root.style.overflow};
    const gutter = window.innerWidth - root.clientWidth;
    if (gutter > 0) body.style.paddingRight = (parseFloat(getComputedStyle(body).paddingRight) + gutter) + 'px';
    Object.assign(body.style, {overflow:'hidden', position:'fixed', top:-scrollY+'px', left:-scrollX+'px', width:'100%'});
    root.style.overflow = 'hidden';
    // aria-modal alone does not isolate background controls from pointer/AT access.
    const background = Array.from(mobilePanel.current?.parentElement?.children || []).filter((item):item is HTMLElement => item instanceof HTMLElement && item !== mobilePanel.current && !item.classList.contains('wj-mobile-backdrop')).map(item => ({item, inert:item.inert}));
    background.forEach(({item}) => {item.inert = true;});
    mobilePanel.current?.querySelector<HTMLButtonElement>('button')?.focus({preventScroll:true});
    const keydown = (event:KeyboardEvent) => {
      if (event.key === 'Escape') {event.preventDefault(); closeMobile();}
      if (event.key !== 'Tab') return;
      const targets = Array.from(mobilePanel.current?.querySelectorAll<HTMLElement>('a[href],button:not([disabled]),summary,[tabindex="0"]') || []).filter(item => item.getClientRects().length > 0);
      const first = targets[0], last = targets[targets.length - 1];
      if (!first) {event.preventDefault(); mobilePanel.current?.focus(); return;}
      if (event.shiftKey && (document.activeElement === first || !mobilePanel.current?.contains(document.activeElement))) {event.preventDefault(); last.focus();}
      else if (!event.shiftKey && (document.activeElement === last || !mobilePanel.current?.contains(document.activeElement))) {event.preventDefault(); first.focus();}
    };
    document.addEventListener('keydown', keydown);
    return () => {
      document.removeEventListener('keydown', keydown);
      panel?.removeEventListener('wheel', onPanelWheel);
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
  // eslint-disable-next-line react-hooks/exhaustive-deps -- closeMobile is stable within a mobileMounted cycle; adding it would re-run the scroll-lock effect on every render
  }, [mobileMounted]);

  /* Level 3 of the menu: one contextual photograph per category instead of a
     wall of equally weighted tiles. Every destination here is also present as
     a text link, so nothing becomes unreachable. */
  const previews:Record<string,{label:string; href:string; img:string}> = {
    'Work & Meet': {label:'Coworking', href:'/coworking/', img:'/media/5a32e442c2-coworking-space.jpg'},
    'Business Services': {label:'Virtual Offices', href:'/virtual-office/', img:'/media/24aa74cdc6-virtual-office.png'},
    'Create & Connect': {label:'Podcast Studio', href:'/podcast-studio/', img:'/media/6e6e0920a9-podcast-image-1.png'},
    'Explore the Junction': {label:'Community Network', href:'/community-network/', img:'/media/c982925218-Group-1597884977.jpg'},
  };
  const activeGroup = groups.find(group => group.title === openMegaGroup) || groups[0] || {title:'', items:[]};
  const preview = previews[activeGroup.title] || previews['Work & Meet'];
  const exploreSpaces = () => {
    if (closeTimer.current) {clearTimeout(closeTimer.current); closeTimer.current = null;}
    const trigger = mobileTrigger.current;
    flushSync(() => {setMobileMounted(false); setMobileClosing(false);});
    window.dispatchEvent(new CustomEvent('wj:book', {detail:{trigger}}));
  };

  const linkList = (items:NavLink[], close?:() => void) => items.map(link => (
    <Link prefetch={false} href={link.href} key={link.href} onClick={close} aria-current={isCurrent(link.href) ? 'page' : undefined}>
      <span>{link.label}</span>
    </Link>
  ));
  const brand = <>{logoSrc ? <Image src={logoSrc} alt="Workspace Junction" width={220} height={67} priority className="wj-logo"/> : <span className="wj-wordmark">Workspace<span>Junction<span className="wj-brand-dot">.</span></span></span>}</>;

  return <div className="wj-platform" data-art-direction="architectural">
    <a className="wj-skip" href="#main">Skip to content</a>
    <AmbientBackdrop/>
    <SceneBackdrop/>
    <header className="wj-header lv-header" ref={headerRef}>
      <div className="container lv-head-row">
        <Link prefetch={false} href="/" className="wj-brand" aria-label="Workspace Junction home">{brand}</Link>
        <div className="lv-head-right">
          <BookingButton variant="yellow" className="lv-plans">
            <span className="lv-plans-shine" aria-hidden="true"/>
            <span className="lv-plans-text-full">Plans &amp; Pricing</span>
            <span className="lv-plans-text-short">Plans</span>
          </BookingButton>
          <a href={'tel:'+b.phoneHref} className="lv-phone"><span className="lv-phone-icon"><Phone size={16} aria-hidden="true"/></span><span>{b.phone}</span></a>
          <nav className="lv-primary" aria-label="Main navigation">
            <Link prefetch={false} href="/" aria-current={pathname === '/' ? 'page' : undefined}><span>Home</span></Link>
            {aboutHref && <Link prefetch={false} href={aboutHref} aria-current={isCurrent(aboutHref) ? 'page' : undefined}><span>About Us</span></Link>}
            <Link prefetch={false} href={contactHref} aria-current={isCurrent(contactHref) ? 'page' : undefined}><span>Contact</span></Link>
          </nav>
          <button type="button" className="wj-menu-toggle lv-burger" ref={mobileTrigger} aria-label="Open menu" aria-expanded={mobileMounted} aria-controls={mobileMounted ? 'wj-mobile-menu' : undefined} onClick={openMobile}><Menu size={24} aria-hidden="true"/></button>
        </div>
      </div>
      <nav className="lv-strip" aria-label="Spaces and services">
        <ul className="container">{strip.map(item => <li key={item.href}><Link prefetch={false} href={item.href} aria-current={isCurrent(item.href) ? 'page' : undefined}><item.icon size={18} strokeWidth={1.5} aria-hidden="true"/><span>{item.label}</span></Link></li>)}</ul>
      </nav>
    </header>
    {mobileMounted && <>
      <div className={'wj-mobile-backdrop' + (mobileClosing ? ' is-closing' : '')} onClick={closeMobile} aria-hidden="true" />
      <div className={'wj-mobile-panel' + (mobileClosing ? ' is-closing' : '')} id="wj-mobile-menu" data-ui-tone="dark" data-lenis-prevent data-lenis-prevent-wheel data-lenis-prevent-touch role="dialog" aria-modal="true" aria-label="Navigation menu" ref={mobilePanel} tabIndex={-1}>
        <div className="wj-mega-bar">
          <span className="wj-mega-brand">Workspace Junction</span>
          <button type="button" className="wj-mega-close" aria-label="Close menu" onClick={closeMobile}><X size={25} aria-hidden="true"/></button>
        </div>
        {/* eslint-disable react-hooks/refs -- closeMobile and mobileTrigger.current are read only inside event handlers, never during render */}
        {compact ? (
          /* Compact: one column, categories as disclosures, location last. */
          <div className="wj-mega-stack">
            <nav aria-label="Navigation" className="wj-mega-nav">
              {groups.map(group => {
                const expanded = openMegaGroup === group.title;
                return <section className={'wj-nav-group' + (expanded ? ' is-open' : '')} key={group.title}>
                  <button type="button" className="wj-nav-group-toggle" aria-expanded={expanded} onClick={() => setOpenMegaGroup(expanded ? '' : group.title)}>
                    <span>{group.title}</span><ChevronDown size={21} aria-hidden="true"/>
                  </button>
                  <div className="wj-nav-group-links">{linkList(group.items, closeMobile)}</div>
                </section>;
              })}
            </nav>
            <aside className="wj-mega-location" aria-label="Find Workspace Junction">
              <div className="wj-mega-location-copy">
                <h2>Find your workspace</h2>
                <div className="wj-mega-address"><MapPin size={22} aria-hidden="true"/><p><strong>Workspace Junction</strong><span>{b.address}</span></p></div>
                <button type="button" className="wj-mega-explore" aria-haspopup="dialog" onClick={exploreSpaces}>Explore Spaces <ArrowUpRight size={18} aria-hidden="true"/></button>
              </div>
            </aside>
          </div>
        ) : (
          /* Desktop: category rail, the active category's links, one preview. */
          <div className="wj-mega-body">
            <div className="wj-mega-rail" role="tablist" aria-orientation="vertical" aria-label="Navigation categories">
              {groups.map((group, index) => (
                <button
                  type="button"
                  key={group.title}
                  id={'wj-cat-' + index}
                  role="tab"
                  aria-selected={activeGroup.title === group.title}
                  aria-controls={'wj-catpanel-' + index}
                  tabIndex={activeGroup.title === group.title ? 0 : -1}
                  className={'wj-mega-cat' + (activeGroup.title === group.title ? ' is-active' : '')}
                  onMouseEnter={() => setOpenMegaGroup(group.title)}
                  onFocus={() => setOpenMegaGroup(group.title)}
                  onClick={() => setOpenMegaGroup(group.title)}
                  onKeyDown={event => {
                    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
                    event.preventDefault();
                    const next = (index + (event.key === 'ArrowDown' ? 1 : groups.length - 1)) % groups.length;
                    setOpenMegaGroup(groups[next].title);
                    document.getElementById('wj-cat-' + next)?.focus();
                  }}
                >
                  <span className="wj-mega-cat-index">{String(index + 1).padStart(2, '0')}</span>
                  <span className="wj-mega-cat-label">{group.title}</span>
                  <span className="wj-mega-cat-count">{activeGroup.title === group.title ? <ArrowUpRight size={16} aria-hidden="true"/> : null}</span>
                </button>
              ))}
              <div className="wj-mega-rail-foot">
                <a href={'tel:' + b.phoneHref}>{b.phone}</a>
                <a href={'mailto:' + b.email}>{b.email}</a>
              </div>
            </div>
            <div className="wj-mega-panel-links" id={'wj-catpanel-' + groups.findIndex(group => group.title === activeGroup.title)} role="tabpanel" aria-labelledby={'wj-cat-' + groups.findIndex(group => group.title === activeGroup.title)}>
              <p className="wj-mega-panel-title">{activeGroup.title}</p>
              <div className="wj-mega-link-columns">{linkList(activeGroup.items, closeMobile)}</div>
            </div>
            <aside className="wj-mega-preview" aria-label="Find Workspace Junction">
              <div className="wj-mega-feature-heading"><span>Featured services</span><i aria-hidden="true"/></div>
              <Link prefetch={false} href={preview.href} onClick={closeMobile} className="wj-mega-card" aria-current={isCurrent(preview.href) ? 'page' : undefined}>
                <span className="wj-mega-card-img" style={{backgroundImage:`linear-gradient(180deg,transparent 38%,rgba(3,27,21,.9) 100%),url(${preview.img})`}} aria-hidden="true"/>
                <span className="wj-mega-card-label"><span>{preview.label}</span><ArrowUpRight size={20} aria-hidden="true"/></span>
              </Link>
              <div className="wj-mega-location-copy">
                <h2>Find your workspace</h2>
                <div className="wj-mega-address"><MapPin size={20} aria-hidden="true"/><p><strong>Workspace Junction</strong><span>{b.address}</span></p></div>
                <button type="button" className="wj-mega-explore" aria-haspopup="dialog" onClick={exploreSpaces}>Explore Spaces <ArrowUpRight size={18} aria-hidden="true"/></button>
              </div>
            </aside>
          </div>
        )}
        {/* eslint-enable react-hooks/refs */}
      </div>
    </>}
    <div className="wj-route-stage" key={pathname}>{children}</div>
    {pathname !== '/' && <section className="wj-closing amb-local" aria-labelledby="wj-closing-title" data-anim="fade-up"><div className="container wj-closing-inner"><div><p className="eyebrow" data-anim="fade-up">Your next chapter starts here</p><h2 id="wj-closing-title" aria-label="Good things happen at the Junction." data-anim="split-lines">Good things happen<br/>at the Junction.</h2><p data-anim="fade-up" data-anim-delay="0.1">Work. Connect. Grow.</p></div><div className="wj-closing-actions" data-anim="fade-up" data-anim-delay="0.15"><BookingButton service="Workspace Junction tour" variant="yellow" className="wj-button wj-button-yellow" data-magnetic="0.25">Come see for yourself <ArrowUpRight size={19} aria-hidden="true"/></BookingButton>{isCurrent(contactHref) ? <a href={'tel:' + b.phoneHref} className="text-link" data-magnetic="0.25">Call our team {b.phone} <ArrowUpRight size={17} aria-hidden="true"/></a> : <Link prefetch={false} href={contactHref} className="text-link" data-magnetic="0.25">Talk to our team <ArrowUpRight size={17} aria-hidden="true"/></Link>}</div></div></section>}
    <SiteFooter business={b} footerLogo={footerLogoSrc} groups={groups}/>
    <BookingLauncher/><CampaignLoader/><GsapMotion/>
  </div>;
}
