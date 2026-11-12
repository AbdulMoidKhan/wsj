'use client';
/**
 * Navbar account control. Logged out: a Login link. Logged in: the customer's
 * name and initials opening an accessible menu. While the session is being
 * checked it renders a neutral placeholder of the same size, so neither a
 * "Login" link nor anyone's name flashes before the answer is known.
 * Names are rendered as React text, never as HTML.
 */
import Link from 'next/link';
import {useRouter} from 'next/navigation';
import {useEffect, useId, useRef, useState} from 'react';
import {ChevronDown, LogIn} from 'lucide-react';
import {logout, useCustomerSession} from '@/lib/account-client';
import './account-nav.css';

export const ACCOUNT_LINKS = [
  {href: '/account/', label: 'Dashboard'},
  {href: '/account/subscriptions/', label: 'My subscriptions'},
  {href: '/account/purchases/', label: 'Bookings & purchases'},
  {href: '/account/payment-methods/', label: 'Payment methods'},
  {href: '/account/billing/', label: 'Billing & invoices'},
  {href: '/account/profile/', label: 'Profile & security'},
];

export function AccountNav() {
  const session = useCustomerSession();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    wrap.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
    const onDown = (event: MouseEvent) => {
      if (!wrap.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      const items = Array.from(wrap.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []);
      const index = items.indexOf(document.activeElement as HTMLElement);
      const move = (next: number) => {
        event.preventDefault();
        items[(next + items.length) % items.length]?.focus();
      };
      if (event.key === 'Escape') {
        event.preventDefault();
        setOpen(false);
        button.current?.focus();
      } else if (event.key === 'ArrowDown') move(index + 1);
      else if (event.key === 'ArrowUp') move(index - 1);
      else if (event.key === 'Home') move(0);
      else if (event.key === 'End') move(items.length - 1);
      else if (event.key === 'Tab') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (session.status === 'loading') return <span className="an-placeholder" aria-hidden="true" />;

  if (session.status === 'anonymous') {
    return (
      <Link prefetch={false} href="/login/" className="an-login">
        <LogIn size={17} aria-hidden="true" />
        <span>Login</span>
      </Link>
    );
  }

  const {displayName, initials, email} = session.customer;
  return (
    <div className="an-wrap" ref={wrap}>
      <button ref={button} type="button" className="wj-control an-trigger" aria-haspopup="menu" aria-expanded={open} aria-controls={open ? menuId : undefined} onClick={() => setOpen(value => !value)}>
        <span className="an-avatar" aria-hidden="true">{initials}</span>
        <span className="an-name">{displayName}</span>
        <span className="wj-sr-only">, account menu</span>
        <ChevronDown size={16} aria-hidden="true" />
      </button>
      {open && (
        <div className="an-menu" role="menu" id={menuId} aria-label="Account">
          <p className="an-menu-head" role="none">
            <strong>{displayName}</strong>
            <span>{email}</span>
          </p>
          {ACCOUNT_LINKS.map(link => (
            <Link key={link.href} prefetch={false} href={link.href} role="menuitem" className="wj-control an-item" onClick={() => setOpen(false)}>
              {link.label}
            </Link>
          ))}
          <button
            type="button"
            role="menuitem"
            className="wj-control an-item an-logout"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              await logout().catch(() => undefined);
              setBusy(false);
              setOpen(false);
              router.push('/');
            }}
          >
            {busy ? 'Signing out…' : 'Logout'}
          </button>
        </div>
      )}
    </div>
  );
}

/** Account links inside the mobile navigation panel. */
export function MobileAccountNav({onNavigate}: {onNavigate: () => void}) {
  const session = useCustomerSession();
  const router = useRouter();
  if (session.status === 'loading') return <div className="an-mobile an-mobile-loading" aria-hidden="true" />;
  if (session.status === 'anonymous') {
    return (
      <div className="an-mobile">
        <Link prefetch={false} href="/login/" className="an-mobile-login" onClick={onNavigate}>
          <LogIn size={18} aria-hidden="true" /> Login
        </Link>
      </div>
    );
  }
  return (
    <nav className="an-mobile" aria-label="Your account">
      <p className="an-mobile-who">
        <span className="an-avatar" aria-hidden="true">{session.customer.initials}</span>
        <span>{session.customer.displayName}</span>
      </p>
      <div className="an-mobile-links">
        {ACCOUNT_LINKS.map(link => (
          <Link key={link.href} prefetch={false} href={link.href} onClick={onNavigate}>
            {link.label}
          </Link>
        ))}
        <button
          type="button"
          className="wj-control"
          onClick={async () => {
            await logout().catch(() => undefined);
            onNavigate();
            router.push('/');
          }}
        >
          Logout
        </button>
      </div>
    </nav>
  );
}
