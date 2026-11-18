'use client';

import Link from 'next/link';
import Image from '@/components/consistent-image';
import {flushSync} from 'react-dom';
import type {Business} from '@/lib/site';
import {useEffect, useRef, useState, type ReactNode} from 'react';
import {usePathname} from 'next/navigation';
import {ArrowUpRight, Building, CalendarDays, ChevronDown, HeartHandshake, Landmark, Laptop, Mailbox, MapPin, Mic, Monitor, Phone, Users, X, type LucideIcon} from 'lucide-react';
import {BookingButton, BookingLauncher} from './booking';
import {SiteFooter} from './site-footer';
import {CampaignLoader} from './campaign-loader';
import {DeferredGsapMotion} from './deferred-motion';
import {AccountNav, MobileAccountNav} from './account-nav';

export type NavLink = {label:string; href:string};
const SERVICE_BAR:ReadonlyArray<{label:string; href:string; Icon:LucideIcon}> = [
  {label:'Coworking', href:'/coworking/', Icon:Landmark},
  {label:'Dedicated Desks', href:'/dedicated/', Icon:Monitor},
  {label:'Business Address', href:'/business-address/', Icon:Building},
  {label:'Event Space', href:'/events/', Icon:CalendarDays},
  {label:'Podcast Studio', href:'/podcast-studio/', Icon:Mic},
  {label:'Virtual Offices', href:'/virtual-office/', Icon:Laptop},
  {label:'Meeting Rooms', href:'/meeting-rooms/', Icon:Users},
  {label:'Mailbox', href:'/mail-box/', Icon:Mailbox},
  {label:'Community', href:'/community-network/', Icon:HeartHandshake},
];
type LinkGroup = {title:string; items:NavLink[]};
const routePath = (href:string) => href.split(/[?#]/)[0].replace(/\/+$/, '').toLowerCase() || '/';
// Account, auth and checkout pages keep the marketing closing band out of the way of the task.
const TRANSACTIONAL_ROUTE = /^\/(login|account|activate|forgot-password|reset-password|booking-confirmation)(\/|$)/;

function groupLinks(links:NavLink[]):LinkGroup[] {
  const groups:LinkGroup[] = [
    {title:'Spaces to work', items:[]},
    {title:'Business essentials', items:[]},
    {title:'Create & connect', items:[]},
    {title:'About the Junction', items:[{label:'Home', href:'/'}]},
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
    const explore = !/community/.test(path) && coreExplore.test(link.label.trim()) || /^\/(?:about-us|blogs|journal|services|use-cases|partners|gallery|contact-us)$/.test(path);
    const index = explore ? 3
      : /podcast|photo|studio|event|workshop|webinar|library|trade.show|community|creative-designers/.test(value) ? 2
      : /virtual|mail|business.address|printing|printed|automation|llc|digital|bpo|notary|e-commerce/.test(value) ? 1
      : /cowork|dedicated|meeting|office|desk|membership/.test(value) ? 0 : -1;
    if (index >= 0) groups[index].items.push({...link, label:({'/dedicated':'Dedicated Desks','/events':'Event Space','/virtual-office':'Virtual Offices','/mail-box':'Mailbox','/photo-studio':'Photo Studio','/bpo-services':'BPO Services'} as Record<string,string>)[path] || link.label});
  }
  return groups.filter(group => group.items.length > 0);
}

type SiteShellProps = {children:ReactNode; links:NavLink[]; logo?:string; footerLogo?:string; business?:Business};

export function SiteShell(props:SiteShellProps) {
  const pathname = usePathname();
  // Navigation owns transient menu state; route changes remount only the public shell.
  // The account area keeps one shell instance across its sections so the sidebar and session state do not remount.
  const shellKey = pathname.startsWith('/account/') ? '/account/' : pathname;
  if (pathname === '/admin' || pathname.startsWith('/admin/')) return props.children;
  // The booking launcher and the motion orchestrator hold no route state, so they sit OUTSIDE the
  // keyed subtree. The decorative WebGL world and ambient glow layers were retired: photography and
  // brand colour carry the pages now, and neither cost a frame of main-thread time.
  return <div className="wj-platform">
    <a className="wj-skip" href="#main">Skip to content</a>
    <PublicSiteShell key={shellKey} {...props} pathname={pathname}/>
    <BookingLauncher/><CampaignLoader/><DeferredGsapMotion/>
  </div>;
}

function PublicSiteShell({children, links, logo, footerLogo, business, pathname}:SiteShellProps & {pathname:string}) {
  const [mobileMounted, setMobileMounted] = useState(false);
  const [mobileClosing, setMobileClosing] = useState(false);
  const [compactMenu, setCompactMenu] = useState(false);
  useEffect(() => {
    const query = window.matchMedia('(max-width:899px)');
    const update = () => setCompactMenu(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);
  const [openMegaGroup, setOpenMegaGroup] = useState('Spaces to work');
  const mobileTrigger = useRef<HTMLButtonElement>(null);
  const mobilePanel = useRef<HTMLDivElement>(null);
  const closeTimer = useRef<NodeJS.Timeout | null>(null);
  const b = business || {phone:'(773) 986-1908', phoneHref:'+17739861908', email:'grow@workspacejunction.com', address:'1S280 Summit Ave Unit E2 Suite 1, Oakbrook Terrace, IL 60181', tagline:'A space for your next chapter.'};
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
  const isCurrent = (href:string) => routePath(pathname) === routePath(href);
  const aboutHref = find(/^about/i, '/about-us/');
  // The service bar under the header: the headline offers, each kept only when this site build has the page.
  const known = new Set(links.map(link => routePath(link.href)));
  const serviceBar = SERVICE_BAR.filter(item => known.has(routePath(item.href)));

  useEffect(() => {
    if (!mobileMounted) return;
    const trigger = mobileTrigger.current;
    const panel = mobilePanel.current;
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

  const linkList = (items:NavLink[], close?:() => void) => items.map(link => (
    <Link prefetch={false} href={link.href} key={link.href} onClick={close} aria-current={isCurrent(link.href) ? 'page' : undefined}>
      <span>{link.label}</span>
    </Link>
  ));
  const brand = <>{logoSrc ? <Image src={logoSrc} alt="Workspace Junction" width={220} height={67} preload className="wj-logo"/> : <span className="wj-wordmark">Workspace<span>Junction<span className="wj-brand-dot">.</span></span></span>}</>;

  return <>
    <header id="wj-site-header" className="at-header" data-home={pathname === '/' ? '' : undefined}>
      <div className="at-head">
        <Link prefetch={false} href="/" className="wj-brand at-brand" aria-label="Workspace Junction home">{brand}</Link>
        <div className="at-actions">
          <BookingButton variant="yellow" className="at-book" data-magnetic="0.2">
            <span className="at-book-full">Plans &amp; Pricing</span>
            <span className="at-book-short">Plans</span>
          </BookingButton>
          <a href={'tel:'+b.phoneHref} className="at-phone" aria-label={'Call ' + b.phone}><Phone size={16} aria-hidden="true"/><span>{b.phone}</span></a>
          <nav className="at-nav" aria-label="Main navigation">
            <ul className="at-nav-list">
              <li className="at-nav-item"><Link prefetch={false} className="at-nav-link" href="/" aria-current={isCurrent('/') ? 'page' : undefined}>Home</Link></li>
              {aboutHref && <li className="at-nav-item"><Link prefetch={false} className="at-nav-link" href={aboutHref} aria-current={isCurrent(aboutHref) ? 'page' : undefined}>About Us</Link></li>}
              <li className="at-nav-item"><Link prefetch={false} className="at-nav-link" href={contactHref} aria-current={isCurrent(contactHref) ? 'page' : undefined}>Contact</Link></li>
            </ul>
          </nav>
          <AccountNav/>
          <button type="button" className="wj-menu-toggle wj-control at-burger" ref={mobileTrigger} aria-label="Open menu" aria-expanded={mobileMounted} aria-controls={mobileMounted ? 'wj-mobile-menu' : undefined} onClick={openMobile}><span className="at-burger-lines" aria-hidden="true"><i/><i/><i/></span></button>
        </div>
      </div>
      {serviceBar.length > 0 && <nav className="at-services" aria-label="Services">
        <ul className="at-services-list">
          {serviceBar.map(({label, href, Icon}) => <li key={href}>
            <Link prefetch={false} className="at-service" href={href} aria-current={isCurrent(href) ? 'page' : undefined}><Icon size={18} strokeWidth={1.6} aria-hidden="true"/><span>{label}</span></Link>
          </li>)}
        </ul>
      </nav>}
    </header>
    {mobileMounted && <>
      <div className={'wj-mobile-backdrop' + (mobileClosing ? ' is-closing' : '')} onClick={closeMobile} aria-hidden="true" />
      <div className={'wj-mobile-panel' + (mobileClosing ? ' is-closing' : '')} id="wj-mobile-menu" data-ui-tone="dark" data-lenis-prevent data-lenis-prevent-wheel data-lenis-prevent-touch role="dialog" aria-modal="true" aria-label="Navigation menu" ref={mobilePanel} tabIndex={-1}>
        <div className="wj-mega-bar">
          <div className="wj-mega-heading"><span className="wj-mega-brand">Your business belongs here.</span><p className="wj-mega-intro">Space to work. Services to grow. People to connect with.</p></div>
          <div className="wj-mega-bar-actions">
            <MobileAccountNav compact onNavigate={closeMobile}/>
            <button type="button" className="wj-mega-close" aria-label="Close menu" onClick={closeMobile}><X size={22} aria-hidden="true"/></button>
          </div>
        </div>
        <div className="wj-mega-body">
        <div className="wj-mega-showcase">
        <div className="wj-mega-feature-heading">Find your space</div>
        <div className="wj-mega-spaces">
          {[
            {label:'Coworking',href:'/coworking/',img:'/media/5a32e442c2-coworking-space.jpg'},
            {label:'Meeting Rooms',href:'/meeting-rooms/',img:'/media/0c15617f3a-meeting-rooms.jpg'},
            {label:'Event Space',href:'/events/',img:'/media/5f8e75abc6-events.png'},
            {label:'Podcast Studio',href:'/podcast-studio/',img:'/media/6e6e0920a9-podcast-image-1.png'},
            {label:'Dedicated Desks',href:'/dedicated/',img:'/media/6d247f9676-dedicated-desk.png'},
            {label:'Virtual Offices',href:'/virtual-office/',img:'/media/24aa74cdc6-virtual-office.png'},
          ].map(s => (
            <Link key={s.href} prefetch={false} href={s.href} onClick={closeMobile} aria-current={isCurrent(s.href) ? 'page' : undefined} className="wj-mega-card">
              <span className="wj-mega-card-img" style={{backgroundImage:`linear-gradient(180deg,transparent 42%,rgba(3,27,21,.92) 100%),url(${s.img})`}} aria-hidden="true"/>
              <span className="wj-mega-card-label"><span>{s.label}</span><ArrowUpRight size={20} aria-hidden="true"/></span>
            </Link>
          ))}
        </div>
          {/* eslint-disable react-hooks/refs -- closeMobile and mobileTrigger.current are accessed only in event handlers, not during render */}
          <aside className="wj-mega-location" aria-label="Find Workspace Junction">
            <div className="wj-mega-location-image" aria-hidden="true"/>
            <div className="wj-mega-location-copy">
              <h2>Find your workspace</h2>
              <div className="wj-mega-address"><MapPin size={22} aria-hidden="true"/><p><strong>Workspace Junction</strong><span>{b.address}</span></p></div>
              <button type="button" className="wj-mega-explore" aria-haspopup="dialog" onClick={() => {
                if (closeTimer.current) {clearTimeout(closeTimer.current); closeTimer.current = null;}
                flushSync(() => {setMobileMounted(false); setMobileClosing(false);});
                window.dispatchEvent(new CustomEvent('wj:book', {detail:{trigger:mobileTrigger.current}}));
              }}>Plans &amp; pricing <ArrowUpRight size={18} aria-hidden="true"/></button>
            </div>
          </aside>
        </div>
        <div className="wj-mega-lower">
          <nav aria-label="Mobile navigation" className="wj-mega-nav">
            {groups.map(group => {
              const expanded = openMegaGroup === group.title;
              const groupId = 'wj-group-' + group.title.toLowerCase().replace(/[^a-z]+/g, '-');
              return <section className={'wj-nav-group wj-nav-group--' + groupId.slice('wj-group-'.length) + (expanded ? ' is-open' : '')} key={group.title}>
                <h2 className="wj-nav-group-heading">{group.title}</h2>
                <button type="button" className="wj-nav-group-toggle" aria-controls={groupId} aria-expanded={expanded} onClick={() => setOpenMegaGroup(expanded ? '' : group.title)}>
                  <span>{group.title}</span><ChevronDown size={21} aria-hidden="true"/>
                </button>
                <div id={groupId} className="wj-nav-group-links" hidden={compactMenu && !expanded}>{linkList(group.items, closeMobile)}</div>
              </section>;
            })}
          </nav>
          {/* eslint-enable react-hooks/refs */}
        </div>
        </div>
      </div>
    </>}
    <div className="wj-route-stage" key={pathname}>{children}</div>
    <SiteFooter business={b} footerLogo={footerLogoSrc} groups={groups} links={links} showCta={!TRANSACTIONAL_ROUTE.test(pathname)}/>
  </>;
}
