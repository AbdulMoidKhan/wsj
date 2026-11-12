import Link from 'next/link';
import Image from '@/components/consistent-image';
import {ArrowUpRight} from 'lucide-react';
import type {Business} from '@/lib/site';
import type {NavLink} from './site-shell';

export interface SiteFooterProps {
  business?: Business;
  footerLogo?: string;
  groups: {title: string; items: NavLink[]}[];
}

export function SiteFooter({business, footerLogo, groups}: SiteFooterProps) {
  const b = business || {
    phone: '(773) 986-1908',
    phoneHref: '+17739861908',
    email: 'grow@workspacejunction.com',
    address: '1S280 Summit Ave, Unit E2 Suite 1, Oakbrook Terrace, IL 60181',
    tagline: 'A space for your next chapter.'
  };
  const footerLogoSrc = footerLogo || '/media/footer-logo.png';

  return (
    <footer className="wj-footer amb-local" role="contentinfo" aria-label="Site Footer">
      <div className="container">
        {/* Top Info Bar: Brand, Address, Contact */}
        <div className="wj-footer-top">
          <div>
            {/* Accessible name = visible logo text + tagline (WCAG 2.5.3 label-in-name). */}
            <Link prefetch={false} href="/" className="wj-footer-brand">
              {footerLogoSrc ? (
                <Image
                  src={footerLogoSrc}
                  alt="Workspace Junction"
                  width={220}
                  height={65}
                  priority={false}
                  className="wj-footer-logo"
                />
              ) : (
                <span className="wj-wordmark">Workspace Junction</span>
              )}
              <span data-business-tagline className="wj-footer-tagline">
                {b.tagline}
              </span>
            </Link>
          </div>

          <div>
            <h2>Come find us</h2>
            <address className="wj-footer-address">{b.address}</address>
            <a
              href={'https://maps.google.com/?q=' + encodeURIComponent(b.address)}
              target="_blank"
              rel="noreferrer"
              className="wj-footer-link"
            >
              Get directions <ArrowUpRight size={15} aria-hidden="true" />
            </a>
          </div>

          <div>
            <h2>Let’s talk</h2>
            <a href={'tel:' + b.phoneHref} className="wj-footer-link">
              {b.phone}
            </a>
            <a href={'mailto:' + b.email} className="wj-footer-link">
              {b.email}
            </a>
            <Link prefetch={false} href="/admin/" className="wj-footer-admin-link">
              Member of the team? Admin <ArrowUpRight size={13} aria-hidden="true" />
            </Link>
          </div>
        </div>

        {/* 4 Categorized Columns */}
        <nav className="wj-footer-links" aria-label="Footer navigation">
          {groups.map((group) => (
            <div key={group.title} className="wj-footer-group">
              <h2>{group.title}</h2>
              {group.items.map((link) => (
                <Link prefetch={false} href={link.href} key={link.href} className="wj-footer-nav-item">
                  <span>{link.label}</span>
                </Link>
              ))}
            </div>
          ))}
        </nav>

        {/* Bottom Legal Copyright Bar */}
        <div className="wj-footer-bottom">
          <span className="wj-copyright">© {new Date().getFullYear()} Workspace Junction</span>
          <span className="wj-credo">Work with purpose. Grow together.</span>
          <Link prefetch={false} href="/terms-and-privacy/" className="wj-terms-link">
            Terms &amp; Privacy
          </Link>
        </div>
      </div>
    </footer>
  );
}
