'use client';
/**
 * Sign-in, password reset and account activation forms.
 *
 * Single-use links arrive with the token in the URL fragment (never sent to a
 * server, never logged, never in a Referer). The token is read once and removed
 * from the address bar before anything renders. Every response about whether an
 * email has an account is generic.
 */
import Link from 'next/link';
import {useRouter, useSearchParams} from 'next/navigation';
import {useEffect, useId, useState, type FormEvent, type ReactNode} from 'react';
import {Eye, EyeOff, Loader2} from 'lucide-react';
import {ApiError, accountFetch, safeNext, signedIn, takeFragmentToken, useCustomerSession} from '@/lib/account-client';
import './account-area.css';

function Shell({eyebrow, title, intro, children}: {eyebrow: string; title: string; intro?: ReactNode; children: ReactNode}) {
  return (
    <section className="aa-auth">
      <div className="aa-auth-card">
        <p className="aa-eyebrow">{eyebrow}</p>
        <h1 className="aa-auth-title">{title}</h1>
        {intro && <div className="aa-auth-intro">{intro}</div>}
        {children}
      </div>
    </section>
  );
}

function Field({label, hint, error, children, id}: {label: string; hint?: string; error?: string; id: string; children: ReactNode}) {
  return (
    <div className="aa-field">
      <label htmlFor={id}>{label}</label>
      {children}
      {hint && <p className="aa-hint" id={id + '-hint'}>{hint}</p>}
      {error && <p className="aa-field-error" id={id + '-error'}>{error}</p>}
    </div>
  );
}

function PasswordInput({id, value, onChange, autoComplete, describedBy, disabled}: {id: string; value: string; onChange: (value: string) => void; autoComplete: string; describedBy?: string; disabled?: boolean}) {
  const [shown, setShown] = useState(false);
  return (
    <div className="aa-password">
      <input id={id} type={shown ? 'text' : 'password'} required autoComplete={autoComplete} value={value} maxLength={72} disabled={disabled} aria-describedby={describedBy} onChange={event => onChange(event.target.value)} />
      <button type="button" className="wj-control aa-icon-button" aria-label={shown ? 'Hide password' : 'Show password'} aria-pressed={shown} onClick={() => setShown(value => !value)}>
        {shown ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
      </button>
    </div>
  );
}

function ErrorBox({message}: {message: string}) {
  if (!message) return null;
  return (
    <p className="aa-alert aa-alert-bad" role="alert">
      {message}
    </p>
  );
}

/** Mirrors the server policy so most problems are caught before a round trip. */
function passwordHint(value: string, email?: string): string {
  if (!value) return '';
  if (value.length < 10) return 'Use at least 10 characters.';
  if (new TextEncoder().encode(value).length > 72) return 'Use at most 72 characters.';
  if (email && value.toLowerCase().includes(email.split('@')[0].toLowerCase()) && email.split('@')[0].length >= 4) return 'Do not use your email address in your password.';
  return '';
}

/* ───────────────────────────── Login ───────────────────────────── */

export function LoginForm() {
  const params = useSearchParams();
  const router = useRouter();
  const session = useCustomerSession();
  const next = safeNext(params.get('next'));
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<'password' | 'link'>('password');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  const emailId = useId();
  const passwordId = useId();

  useEffect(() => {
    if (session.status === 'authenticated') router.replace(next);
  }, [session.status, next, router]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      if (mode === 'link') {
        await accountFetch('/account/auth/link/request', {method: 'POST', json: {email}});
        setSent(true);
      } else {
        signedIn(await accountFetch('/account/auth/login', {method: 'POST', json: {email, password}}));
        router.replace(next);
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Sign-in failed. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Shell
      eyebrow="YOUR ACCOUNT"
      title="Sign in"
      intro={<p>Manage your bookings, subscriptions, invoices and saved cards. Your account is created when you make your first purchase.</p>}
    >
      {sent ? (
        <div className="aa-alert aa-alert-ok" role="status">
          <p><strong>Check your email.</strong> If that address has an account with us, a sign-in link is on its way. It works once and expires in 15 minutes.</p>
          <p>If you bought something but never set a password, the email will include your account setup link instead.</p>
        </div>
      ) : (
        <form className="aa-form" onSubmit={submit} noValidate={false}>
          <div className="aa-segmented" role="radiogroup" aria-label="How do you want to sign in?">
            <button type="button" className="wj-control" role="radio" aria-checked={mode === 'password'} onClick={() => setMode('password')}>Password</button>
            <button type="button" className="wj-control" role="radio" aria-checked={mode === 'link'} onClick={() => setMode('link')}>Email me a link</button>
          </div>
          <Field id={emailId} label="Email address">
            <input id={emailId} type="email" required autoComplete="email" maxLength={254} value={email} onChange={event => setEmail(event.target.value)} />
          </Field>
          {mode === 'password' && (
            <Field id={passwordId} label="Password">
              <PasswordInput id={passwordId} value={password} onChange={setPassword} autoComplete="current-password" />
            </Field>
          )}
          <ErrorBox message={error} />
          <button className="wj-button wj-button-yellow aa-submit" disabled={busy}>
            {busy ? <><Loader2 size={16} className="aa-spin" aria-hidden="true" /> Please wait…</> : mode === 'link' ? 'Send sign-in link' : 'Sign in'}
          </button>
          <p className="aa-links">
            <Link href="/forgot-password/">Forgot your password?</Link>
            <span aria-hidden="true">·</span>
            <button type="button" className="wj-control aa-text-button" onClick={() => setMode('link')}>Bought something but never set a password?</button>
          </p>
        </form>
      )}
      <p className="aa-auth-foot">
        New here? Your account comes with your first booking or membership. <button type="button" className="wj-control aa-text-button" onClick={() => window.dispatchEvent(new CustomEvent('wj:book', {detail: {}}))}>Browse services</button>
      </p>
    </Shell>
  );
}

/* ───────────────────────────── Forgot password ───────────────────────────── */

export function ForgotPasswordForm() {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');
  const id = useId();
  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await accountFetch('/account/auth/password/forgot', {method: 'POST', json: {email}});
      setDone(true);
    } catch (caught) {
      setError(caught instanceof ApiError && caught.status === 429 ? caught.message : 'We could not send that request. Please try again.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <Shell eyebrow="YOUR ACCOUNT" title="Reset your password" intro={<p>Enter the email you use with Workspace Junction and we will send you a reset link.</p>}>
      {done ? (
        <p className="aa-alert aa-alert-ok" role="status">If that address has an account, a reset link is on its way. It works once and expires in 30 minutes.</p>
      ) : (
        <form className="aa-form" onSubmit={submit}>
          <Field id={id} label="Email address">
            <input id={id} type="email" required autoComplete="email" maxLength={254} value={email} onChange={event => setEmail(event.target.value)} />
          </Field>
          <ErrorBox message={error} />
          <button className="wj-button wj-button-yellow aa-submit" disabled={busy}>{busy ? 'Sending…' : 'Send reset link'}</button>
        </form>
      )}
      <p className="aa-auth-foot"><Link href="/login/">Back to sign in</Link></p>
    </Shell>
  );
}

/* ───────────────────────────── Reset password ───────────────────────────── */

export function ResetPasswordForm() {
  const [token, setToken] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');
  const id = useId();
  const confirmId = useId();
  useEffect(() => {
    /* Deferred: the fragment exists only in the browser, after hydration. */
    const timer = setTimeout(() => setToken(takeFragmentToken()), 0);
    return () => clearTimeout(timer);
  }, []);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (password !== confirm) return setError('The two passwords do not match.');
    setBusy(true);
    setError('');
    try {
      await accountFetch('/account/auth/password/reset', {method: 'POST', json: {token, password}});
      setDone(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'We could not reset your password.');
    } finally {
      setBusy(false);
    }
  }
  if (token === null) return <Shell eyebrow="YOUR ACCOUNT" title="Reset your password"><p className="aa-muted" role="status">Checking your link…</p></Shell>;
  if (!token) return <Shell eyebrow="YOUR ACCOUNT" title="Link not found" intro={<p>This page needs the reset link from your email. Links work once and expire after 30 minutes.</p>}><Link className="wj-button wj-button-yellow" href="/forgot-password/">Request a new link</Link></Shell>;
  if (done) return <Shell eyebrow="YOUR ACCOUNT" title="Password updated" intro={<p>Your password was changed and every device was signed out. Sign in with your new password.</p>}><Link className="wj-button wj-button-yellow" href="/login/">Sign in</Link></Shell>;
  const hint = passwordHint(password);
  return (
    <Shell eyebrow="YOUR ACCOUNT" title="Choose a new password">
      <form className="aa-form" onSubmit={submit}>
        <Field id={id} label="New password" hint={hint || 'At least 10 characters. A short phrase is easier to remember and harder to guess.'}>
          <PasswordInput id={id} value={password} onChange={setPassword} autoComplete="new-password" describedBy={id + '-hint'} />
        </Field>
        <Field id={confirmId} label="Confirm new password">
          <PasswordInput id={confirmId} value={confirm} onChange={setConfirm} autoComplete="new-password" />
        </Field>
        <ErrorBox message={error} />
        <button className="wj-button wj-button-yellow aa-submit" disabled={busy || Boolean(hint)}>{busy ? 'Saving…' : 'Save new password'}</button>
      </form>
    </Shell>
  );
}

/* ───────────────────────────── Activation, sign-in links, email confirmation ───────────────────────────── */

export function ActivateForm() {
  const params = useSearchParams();
  const router = useRouter();
  const mode = params.get('mode') === 'login' ? 'login' : params.get('mode') === 'email' ? 'email' : 'setup';
  const [token, setToken] = useState<string | null>(null);
  const [valid, setValid] = useState<boolean | null>(null);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [marketing, setMarketing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState('');
  const id = useId();
  const confirmId = useId();

  useEffect(() => {
    /* Deferred: the fragment exists only in the browser, after hydration. */
    const timer = setTimeout(() => {
      const value = takeFragmentToken();
      setToken(value);
      if (!value) return;
      if (mode === 'setup') {
        accountFetch<{valid: boolean}>('/account/auth/activate/inspect', {method: 'POST', json: {token: value}}).then(result => setValid(result.valid)).catch(() => setValid(false));
        return;
      }
      /* Sign-in and email links act on load. They are single-use, so a refresh simply shows the expired state. */
      const path = mode === 'login' ? '/account/auth/link/exchange' : '/account/auth/email/confirm';
      accountFetch(path, {method: 'POST', json: {token: value}})
        .then(view => {
          if (mode === 'login') {
            signedIn(view);
            router.replace('/account/');
          } else setDone('Your email address was updated. For your security every device was signed out; sign in with your new address.');
        })
        .catch(caught => setError(caught instanceof Error ? caught.message : 'This link could not be used.'));
    }, 0);
    return () => clearTimeout(timer);
  }, [mode, router]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (password !== confirm) return setError('The two passwords do not match.');
    setBusy(true);
    setError('');
    try {
      signedIn(await accountFetch('/account/auth/activate', {method: 'POST', json: {token, password, marketingOptIn: marketing}}));
      router.replace('/account/?welcome=1');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'We could not set up your account.');
    } finally {
      setBusy(false);
    }
  }

  const expired = (
    <>
      <p>Links work once and expire. Request a fresh one with the email you used at checkout.</p>
      <Link className="wj-button wj-button-yellow" href="/login/">Get a new link</Link>
    </>
  );

  if (token === null) return <Shell eyebrow="YOUR ACCOUNT" title="One moment"><p className="aa-muted" role="status">Checking your link…</p></Shell>;
  if (!token) return <Shell eyebrow="YOUR ACCOUNT" title="Link not found" intro={<p>This page needs the link from your email.</p>}>{expired}</Shell>;
  if (done) return <Shell eyebrow="YOUR ACCOUNT" title="Email updated" intro={<p>{done}</p>}><Link className="wj-button wj-button-yellow" href="/login/">Sign in</Link></Shell>;
  if (mode !== 'setup') return <Shell eyebrow="YOUR ACCOUNT" title={error ? 'This link has expired' : 'Signing you in…'}>{error ? <><ErrorBox message={error} />{expired}</> : <p className="aa-muted" role="status"><Loader2 size={16} className="aa-spin" aria-hidden="true" /> Please wait…</p>}</Shell>;
  if (valid === false) return <Shell eyebrow="ACCOUNT SETUP" title="This setup link has expired">{expired}</Shell>;
  if (valid === null) return <Shell eyebrow="ACCOUNT SETUP" title="One moment"><p className="aa-muted" role="status">Checking your link…</p></Shell>;

  const hint = passwordHint(password);
  return (
    <Shell eyebrow="ACCOUNT SETUP" title="Set up your account" intro={<p>Thanks for your purchase. Choose a password to verify your email and open your account. Your purchase is already safe whether or not you do this now.</p>}>
      <form className="aa-form" onSubmit={submit}>
        <Field id={id} label="Choose a password" hint={hint || 'At least 10 characters. A short phrase is easier to remember and harder to guess.'}>
          <PasswordInput id={id} value={password} onChange={setPassword} autoComplete="new-password" describedBy={id + '-hint'} />
        </Field>
        <Field id={confirmId} label="Confirm password">
          <PasswordInput id={confirmId} value={confirm} onChange={setConfirm} autoComplete="new-password" />
        </Field>
        <label className="aa-check">
          <input type="checkbox" checked={marketing} onChange={event => setMarketing(event.target.checked)} />
          <span>Send me occasional news and offers from Workspace Junction (optional). Account and billing emails are sent either way.</span>
        </label>
        <ErrorBox message={error} />
        <button className="wj-button wj-button-yellow aa-submit" disabled={busy || Boolean(hint)}>{busy ? 'Setting up…' : 'Open my account'}</button>
      </form>
    </Shell>
  );
}
