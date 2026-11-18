import Link from 'next/link';
import Image from '@/components/consistent-image';
import {ArrowRight, Camera, Coffee, Mail, MapPin, Mic, Phone, Users, Wifi} from 'lucide-react';
import type {Business} from '@/lib/site';
import {BookingButton} from './booking';
import type {NavLink} from './site-shell';
import './site-footer.css';

export interface SiteFooterProps {
  business?: Business;
  footerLogo?: string;
  groups: {title: string; items: NavLink[]}[];
  /** Every public page in this build; footer links are filtered against it. */
  links?: NavLink[];
  /** The "Ready to work…" band above the footer; off on account, auth and checkout pages. */
  showCta?: boolean;
}

const norm = (href: string) => href.split(/[?#]/)[0].replace(/\/+$/, '').toLowerCase() || '/';

const COLUMNS: Array<{title: string; items: Array<readonly [string, string]>}> = [
  {title: 'Workspace', items: [['Coworking', '/coworking/'], ['Dedicated Desks', '/dedicated/'], ['Meeting Rooms', '/meeting-rooms/'], ['Event Space', '/events/'], ['Podcast Studio', '/podcast-studio/'], ['Photo Studio', '/photo-studio/']]},
  {title: 'Business', items: [['Virtual Office', '/virtual-office/'], ['Business Address', '/business-address/'], ['Mailbox', '/mail-box/'], ['LLC Setup', '/llc-setup/'], ['Notary Public', '/notary-public/'], ['Digital Services', '/digital-services/']]},
  {title: 'Company', items: [['About Us', '/about-us/'], ['Memberships', '/memberships/'], ['Community', '/community-network/'], ['Journal', '/blogs/'], ['Partners', '/partners/'], ['Contact', '/contact-us/']]},
];

const SOCIAL = [
  {label: 'LinkedIn', href: 'https://www.linkedin.com/company/workspace-junction', path: 'M4.98 3.5A2.5 2.5 0 1 1 5 8.5a2.5 2.5 0 0 1-.02-5ZM3 9.75h4V21H3V9.75Zm6.5 0h3.8v1.6h.06c.53-1 1.84-2.05 3.78-2.05 4.04 0 4.79 2.66 4.79 6.12V21h-4v-4.98c0-1.19-.02-2.72-1.66-2.72-1.66 0-1.92 1.3-1.92 2.63V21h-4V9.75Z'},
  {label: 'Facebook', href: 'https://www.facebook.com/people/Workspace-Junction/61577329376091/', path: 'M13.5 21v-7.5h2.53l.38-2.94H13.5V8.69c0-.85.24-1.43 1.46-1.43h1.56V4.63A20.9 20.9 0 0 0 14.25 4.5c-2.25 0-3.79 1.37-3.79 3.9v2.16H7.92v2.94h2.54V21h3.04Z'},
  {label: 'Instagram', href: 'https://www.instagram.com/workspace.junction', path: 'M12 7.38a4.62 4.62 0 1 0 0 9.24 4.62 4.62 0 0 0 0-9.24Zm0 7.62a3 3 0 1 1 0-6 3 3 0 0 1 0 6Zm5.88-7.8a1.08 1.08 0 1 1-2.16 0 1.08 1.08 0 0 1 2.16 0ZM21 8.29c-.07-1.44-.4-2.72-1.45-3.77S17.2 3.14 15.77 3.07C14.28 3 9.72 3 8.23 3.07c-1.43.07-2.71.4-3.77 1.45S3.14 6.85 3.07 8.29C3 9.78 3 14.22 3.07 15.71c.07 1.44.4 2.72 1.45 3.77s2.33 1.38 3.77 1.45c1.49.07 6.05.07 7.54 0 1.44-.07 2.72-.4 3.77-1.45s1.38-2.33 1.45-3.77c.07-1.49.07-5.93 0-7.42Zm-1.94 9.02a3.03 3.03 0 0 1-1.71 1.71c-1.18.47-3.99.36-5.3.36s-4.12.1-5.3-.36a3.03 3.03 0 0 1-1.7-1.71c-.48-1.18-.37-3.99-.37-5.31s-.1-4.12.36-5.3a3.03 3.03 0 0 1 1.71-1.71c1.18-.47 3.99-.36 5.3-.36s4.12-.1 5.3.36a3.03 3.03 0 0 1 1.71 1.71c.47 1.18.36 3.99.36 5.3s.11 4.13-.36 5.31Z'},
];

const AMENITIES = [
  {label: 'High-Speed Wi-Fi', Icon: Wifi},
  {label: 'Coffee & Refreshments', Icon: Coffee},
  {label: 'Podcast Studio', Icon: Mic},
  {label: 'Photo Studio', Icon: Camera},
  {label: 'Meeting Rooms', Icon: Users},
];

/* Global footer: a "ready to work" band over a photo of the front desk, then the brand,
   three link columns and contact details, an amenity strip, the legal line and a night
   skyline. Business details come from site settings; links only render for pages that exist. */
export function SiteFooter({business, footerLogo, groups, links, showCta = true}: SiteFooterProps) {
  const b = business || {
    phone: '(773) 986-1908',
    phoneHref: '+17739861908',
    email: 'grow@workspacejunction.com',
    address: '1S280 Summit Ave Unit E2 Suite 1, Oakbrook Terrace, IL 60181',
    tagline: 'A space for your next chapter.'
  };
  const footerLogoSrc = footerLogo || '/media/footer-logo.png';
  const known = new Set((links || groups.flatMap(g => g.items)).map(l => norm(l.href)));
  const exists = (href: string) => known.size === 0 || known.has(norm(href));
  const columns = COLUMNS.map(c => ({...c, items: c.items.filter(([, href]) => exists(href))})).filter(c => c.items.length);
  const membersHref = exists('/memberships/') ? '/memberships/' : '/contact-us/';
  const [street, ...rest] = b.address.split(/,\s*/);

  return (
    <>
      {showCta && (
        <section className="gf-cta" aria-labelledby="gf-cta-title" data-mo-static>
          <div className="gf-cta-photo" aria-hidden="true" />
          <div className="gf-wrap gf-cta-inner">
            <div className="gf-cta-copy">
              <h2 id="gf-cta-title" className="gf-cta-title">Ready to Work, Create, and Grow at Workspace Junction?</h2>
              <p className="gf-cta-text">Join a vibrant community, access premium spaces, and get the flexibility your work deserves.</p>
            </div>
            <div className="gf-cta-actions">
              <BookingButton service="Workspace Junction tour" variant="yellow" className="gf-btn gf-btn-gold">Book a Tour <ArrowRight size={18} aria-hidden="true" /></BookingButton>
              <Link prefetch={false} href={membersHref} className="gf-btn gf-btn-line">Become a Member</Link>
            </div>
          </div>
        </section>
      )}

      <footer id="wj-site-footer" className="wj-footer gf" role="contentinfo" aria-label="Site footer">
        <div className="gf-wrap">
          <div className="gf-main">
            <div className="gf-brand">
              <Link prefetch={false} href="/" className="gf-logo-link" aria-label="Workspace Junction home">
                {footerLogoSrc ? <Image src={footerLogoSrc} alt="" width={220} height={65} className="gf-logo" /> : <span className="gf-wordmark">Workspace Junction</span>}
              </Link>
              <p className="gf-blurb">A flexible, professional workspace for entrepreneurs, teams, and growing businesses in the Chicago area.</p>
              <ul className="gf-social" aria-label="Workspace Junction on social media">
                {SOCIAL.map(s => (
                  <li key={s.label}>
                    <a href={s.href} target="_blank" rel="noreferrer" aria-label={s.label + ' (opens in a new tab)'}>
                      <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false"><path d={s.path} fill="currentColor" /></svg>
                    </a>
                  </li>
                ))}
              </ul>
            </div>

            <nav className="gf-columns" aria-label="Footer navigation">
              {columns.map(c => (
                <div key={c.title} className="gf-col">
                  <h2 className="gf-heading">{c.title}</h2>
                  <ul>{c.items.map(([label, href]) => <li key={href}><Link prefetch={false} href={href}>{label}</Link></li>)}</ul>
                </div>
              ))}
            </nav>

            <div className="gf-col gf-contact">
              <h2 className="gf-heading">Get in Touch</h2>
              <ul>
                <li><MapPin size={20} aria-hidden="true" /><a href={'https://maps.google.com/?q=' + encodeURIComponent(b.address)} target="_blank" rel="noreferrer"><address>{street}<br />{rest.join(', ')}</address><span className="sr-only"> (opens map in a new tab)</span></a></li>
                <li><Phone size={20} aria-hidden="true" /><a href={'tel:' + b.phoneHref}>{b.phone}</a></li>
                <li><Mail size={20} aria-hidden="true" /><a href={'mailto:' + b.email}>{b.email}</a></li>
              </ul>
            </div>
          </div>

          <ul className="gf-amenities" aria-label="On site">
            {AMENITIES.map(({label, Icon}) => <li key={label}><Icon size={30} strokeWidth={1.5} aria-hidden="true" /><span>{label}</span></li>)}
          </ul>

          <div className="gf-bottom">
            <span>© {new Date().getFullYear()} Workspace Junction. All rights reserved.</span>
            <span className="gf-legal">
              <Link prefetch={false} href="/terms-and-privacy/">Privacy Policy</Link>
              <span aria-hidden="true" className="gf-sep" />
              <Link prefetch={false} href="/terms-and-privacy/">Terms of Service</Link>
              <span aria-hidden="true" className="gf-sep" />
              <Link prefetch={false} href="/admin/">Team login</Link>
            </span>
          </div>
        </div>
        <div className="gf-skyline" aria-hidden="true" />
      </footer>
    </>
  );
}
