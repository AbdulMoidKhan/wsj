/**
 * Transactional email: one delivery adapter and a database outbox.
 *
 * - Nothing is "sent" until the adapter accepted it; a failed or unconfigured
 *   delivery leaves the row retryable and is never reported as delivered.
 * - The outbox stores a template name and non-secret payload only. Links that
 *   carry a single-use token are minted at delivery time, so a secret is never
 *   persisted in plain text and a retry simply issues a fresh token.
 * - Bodies and tokens are never logged.
 */
import {Inject, Injectable, OnModuleDestroy, OnModuleInit, Optional} from '@nestjs/common';
import fs from 'node:fs';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {Db} from './core';
import {frontendOrigins} from './origins';
import {TOKEN_TTL_MS, newToken, type TokenPurpose} from './account-core';

export interface OutgoingMail {
  to: string;
  subject: string;
  text: string;
}

export class MailNotConfiguredError extends Error {
  constructor() {
    super('MAIL_NOT_CONFIGURED');
  }
}

@Injectable()
export class MailService {
  /** smtp when configured; capture only outside production; otherwise none. */
  mode(): 'smtp' | 'capture' | 'none' {
    if (process.env.SMTP_HOST?.trim() && process.env.SMTP_FROM?.trim()) return 'smtp';
    if (process.env.NODE_ENV !== 'production' && process.env.MAIL_CAPTURE_DIR?.trim()) return 'capture';
    return 'none';
  }

  async deliver(mail: OutgoingMail): Promise<void> {
    const mode = this.mode();
    if (mode === 'none') throw new MailNotConfiguredError();
    if (mode === 'capture') {
      /* Local test adapter: writes the message to disk instead of the network. */
      const dir = path.resolve(process.env.MAIL_CAPTURE_DIR!);
      fs.mkdirSync(dir, {recursive: true});
      fs.writeFileSync(path.join(dir, Date.now() + '-' + randomUUID() + '.json'), JSON.stringify({...mail, capturedAt: new Date().toISOString()}, null, 1), {mode: 0o600});
      return;
    }
    const nodemailer = await import('nodemailer');
    const transport = nodemailer.default.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: process.env.SMTP_PORT === '465',
      connectionTimeout: 10000,
      socketTimeout: 10000,
      ...(process.env.SMTP_USER ? {auth: {user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD}} : {}),
    });
    await transport.sendMail({from: process.env.SMTP_FROM, to: mail.to, subject: mail.subject, text: mail.text});
  }
}

/* ───────────────────────────── Tokens ───────────────────────────── */

type TokenDb = Pick<Db, 'customerToken'>;

/**
 * Mint a single-use token. Any earlier unused token of the same purpose for
 * the same customer is retired first, so only the newest link works.
 */
export async function issueToken(db: TokenDb, customerId: string, purpose: TokenPurpose, data: Record<string, unknown> = {}, now = new Date()): Promise<string> {
  await db.customerToken.updateMany({where: {customerId, purpose, usedAt: null}, data: {usedAt: now}});
  const {token, hash} = newToken();
  await db.customerToken.create({data: {customerId, purpose, tokenHash: hash, data: data as object, expiresAt: new Date(now.getTime() + TOKEN_TTL_MS[purpose])}});
  return token;
}

/**
 * The token rides in the URL fragment: it is never sent to a server by the
 * navigation itself, so it cannot land in access logs or a Referer header.
 */
export function tokenLink(mode: 'setup' | 'login' | 'email' | 'reset', token: string, origin = frontendOrigins()[0]): string {
  const page = mode === 'reset' ? '/reset-password/' : '/activate/' + (mode === 'setup' ? '' : '?mode=' + mode);
  return origin + page + '#token=' + token;
}

/* ───────────────────────────── Templates ───────────────────────────── */

export type MailTemplate =
  | 'account_setup'
  | 'login_link'
  | 'password_reset'
  | 'password_changed'
  | 'email_change_verify'
  | 'email_change_notice'
  | 'email_changed'
  | 'purchase_receipt'
  | 'claim_available'
  | 'payment_failed'
  | 'cancellation_scheduled'
  | 'cancellation_withdrawn'
  | 'plan_change'
  | 'card_missing';

const SIGN_OFF = '\n\nWorkspace Junction\n(773) 986-1908 · grow@workspacejunction.com';
const str = (value: unknown, max = 200) => String(value ?? '').replace(/[\r\n]+/g, ' ').slice(0, max);
const money = (minor: unknown, currency: unknown) => new Intl.NumberFormat('en-US', {style: 'currency', currency: String(currency || 'usd').toUpperCase()}).format(Number(minor || 0) / 100);

/** Render at delivery time. Token templates mint their link here, never earlier. */
export async function renderMail(db: TokenDb, row: {customerId: string | null; template: string; payload: unknown}): Promise<{subject: string; text: string}> {
  const p = (row.payload && typeof row.payload === 'object' ? row.payload : {}) as Record<string, unknown>;
  const origin = frontendOrigins()[0];
  const hello = 'Hello' + (p.name ? ' ' + str(p.name, 80) : '') + ',\n\n';
  const needCustomer = () => {
    if (!row.customerId) throw new Error('template requires a customer');
    return row.customerId;
  };
  switch (row.template as MailTemplate) {
    case 'account_setup': {
      const link = tokenLink('setup', await issueToken(db, needCustomer(), 'ACCOUNT_SETUP'));
      return {
        subject: 'Set up your Workspace Junction account',
        text: hello + 'Thank you for your purchase. Your Workspace Junction account is ready to be set up.\n\nChoose a password to verify your email and manage your bookings, subscriptions, invoices and saved card:\n\n' + link + '\n\nThis link works once and expires in 24 hours. If it has expired, request a new one at ' + origin + '/login/.\n\nIf you did not make a purchase, you can ignore this email; no account is active until a password is set.' + SIGN_OFF,
      };
    }
    case 'login_link': {
      const link = tokenLink('login', await issueToken(db, needCustomer(), 'LOGIN_LINK'));
      return {subject: 'Your Workspace Junction sign-in link', text: hello + 'Use this link to sign in to your account:\n\n' + link + '\n\nIt works once and expires in 15 minutes. If you did not ask for it, you can ignore this email.' + SIGN_OFF};
    }
    case 'password_reset': {
      const link = tokenLink('reset', await issueToken(db, needCustomer(), 'PASSWORD_RESET'));
      return {subject: 'Reset your Workspace Junction password', text: hello + 'We received a request to reset your password. Choose a new one here:\n\n' + link + '\n\nThis link works once and expires in 30 minutes. If you did not ask for it, your password has not changed and you can ignore this email.' + SIGN_OFF};
    }
    case 'email_change_verify': {
      const link = tokenLink('email', await issueToken(db, needCustomer(), 'EMAIL_CHANGE', {newEmail: str(p.newEmail, 254)}));
      return {subject: 'Confirm your new email address', text: hello + 'Confirm this address as the new sign-in email for your Workspace Junction account:\n\n' + link + '\n\nThe link works once and expires in 60 minutes. Until you confirm, your current email stays in place.' + SIGN_OFF};
    }
    case 'email_change_notice':
      return {subject: 'A change to your account email was requested', text: hello + 'Someone signed in to your Workspace Junction account and asked to change its email address to ' + str(p.newEmailMasked, 120) + '. Nothing changes until that new address is confirmed.\n\nIf this was not you, sign in and change your password now: ' + origin + '/login/' + SIGN_OFF};
    case 'email_changed':
      return {subject: 'Your account email was changed', text: hello + 'The sign-in email for your Workspace Junction account was changed to ' + str(p.newEmailMasked, 120) + '. Other devices were signed out.\n\nIf this was not you, contact us immediately.' + SIGN_OFF};
    case 'password_changed':
      return {subject: 'Your Workspace Junction password was changed', text: hello + 'Your account password was just changed and other devices were signed out.\n\nIf this was not you, reset your password now: ' + origin + '/forgot-password/' + SIGN_OFF};
    case 'purchase_receipt': {
      const items = Array.isArray(p.items) ? (p.items as Array<Record<string, unknown>>).slice(0, 20).map(item => '  ' + str(item.description, 120) + (Number(item.quantity) > 1 ? ' x ' + Number(item.quantity) : '') + '  ' + money(item.amount, p.currency)).join('\n') : '';
      return {
        subject: 'Your Workspace Junction purchase',
        text: hello + 'We received your payment. Here is a summary:\n\n' + items + '\n\n  Paid today: ' + money(p.dueNowAmount, p.currency) + (Number(p.recurringAmount) > 0 ? '\n  Then: ' + money(p.recurringAmount, p.currency) + ' ' + str(p.recurringDescription, 40) + ' until you cancel' : '') + '\n\nReference: ' + str(p.orderId, 60) + '\n\nYour invoices and receipts are in your account: ' + origin + '/account/billing/' + SIGN_OFF,
      };
    }
    case 'claim_available':
      return {subject: 'A purchase is waiting for your account', text: hello + 'A purchase was made using this email address while not signed in. To add it to your Workspace Junction account, sign in and confirm it on your dashboard:\n\n' + origin + '/login/\n\nIf you do not recognise it, you can decline it there and our team will review.' + SIGN_OFF};
    case 'payment_failed':
      return {subject: 'We could not process your payment', text: hello + 'The latest payment for ' + str(p.planName, 120) + ' did not go through. Your access continues for now.\n\nSign in to update your card or pay the outstanding invoice: ' + origin + '/account/billing/' + SIGN_OFF};
    case 'cancellation_scheduled':
      return {subject: 'Your subscription will not renew', text: hello + 'Automatic renewal for ' + str(p.planName, 120) + ' has been stopped. You keep access until ' + str(p.lastAccess, 60) + '. No refund is issued for the current period.\n\nChanged your mind? You can undo this before that date: ' + origin + '/account/subscriptions/' + SIGN_OFF};
    case 'cancellation_withdrawn':
      return {subject: 'Your subscription will renew as normal', text: hello + 'The scheduled cancellation for ' + str(p.planName, 120) + ' was withdrawn. It renews as normal.' + SIGN_OFF};
    case 'plan_change':
      return {subject: 'Your plan change', text: hello + str(p.summary, 400) + '\n\nSee the details in your account: ' + origin + '/account/subscriptions/' + SIGN_OFF};
    case 'card_missing':
      return {subject: 'Add a payment card to your account', text: hello + 'Your Workspace Junction account no longer has a saved payment card. Anything you have already paid for is unaffected, but renewals cannot be collected.\n\nAdd a card here: ' + origin + '/account/payment-methods/' + SIGN_OFF};
    default:
      throw new Error('unknown mail template');
  }
}

/* ───────────────────────────── Outbox ───────────────────────────── */

const MAX_ATTEMPTS = 8;
const backoffMs = (attempts: number) => Math.min(6 * 60 * 60 * 1000, 60000 * 2 ** Math.max(0, attempts - 1));

@Injectable()
export class OutboxService implements OnModuleInit, OnModuleDestroy {
  private timer: NodeJS.Timeout | null = null;
  private draining: Promise<number> | null = null;

  constructor(@Inject(Db) private db: Db, @Optional() @Inject(MailService) private mail: MailService = new MailService()) {}

  onModuleInit() {
    if (process.env.NODE_ENV === 'test' || process.env.OUTBOX_WORKER === 'off') return;
    this.timer = setInterval(() => void this.drain().catch(() => undefined), 60000);
    this.timer.unref();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  /**
   * Record the intent to send. With a dedupeKey the same message can be
   * enqueued any number of times (webhook replay, retry, refresh) and exists once.
   */
  async enqueue(entry: {customerId?: string | null; to: string; template: MailTemplate; payload?: Record<string, unknown>; dedupeKey?: string | null}): Promise<{id: string; created: boolean}> {
    if (entry.dedupeKey) {
      const existing = await this.db.emailOutbox.findUnique({where: {dedupeKey: entry.dedupeKey}});
      if (existing) return {id: existing.id, created: false};
    }
    try {
      const row = await this.db.emailOutbox.create({data: {customerId: entry.customerId ?? null, toEmail: entry.to, template: entry.template, payload: (entry.payload ?? {}) as object, dedupeKey: entry.dedupeKey ?? null}});
      if (process.env.OUTBOX_WORKER !== 'off') void this.drain().catch(() => undefined);
      return {id: row.id, created: true};
    } catch (error) {
      /* A concurrent enqueue won the unique dedupe key: that is success. */
      const existing = entry.dedupeKey ? await this.db.emailOutbox.findUnique({where: {dedupeKey: entry.dedupeKey}}) : null;
      if (existing) return {id: existing.id, created: false};
      throw error;
    }
  }

  /** Deliver what is due. Safe to run concurrently on several instances. */
  async drain(limit = 25, now = new Date()): Promise<number> {
    if (this.draining) return this.draining;
    this.draining = this.drainOnce(limit, now).finally(() => {
      this.draining = null;
    });
    return this.draining;
  }

  private async drainOnce(limit: number, now: Date): Promise<number> {
    /* Without an adapter nothing is claimed: rows stay PENDING and visible in diagnostics. */
    if (this.mail.mode() === 'none') return 0;
    const due = await this.db.emailOutbox.findMany({
      where: {OR: [{status: {in: ['PENDING', 'FAILED']}, nextAttemptAt: {lte: now}}, {status: 'SENDING', lockedUntil: {lte: now}}]},
      orderBy: {createdAt: 'asc'},
      take: limit,
    });
    let sent = 0;
    for (const row of due) {
      /* Compare-and-set claim: only one worker moves a row into SENDING. */
      const claim = await this.db.emailOutbox.updateMany({
        where: {id: row.id, status: row.status, attempts: row.attempts},
        data: {status: 'SENDING', attempts: {increment: 1}, lockedUntil: new Date(now.getTime() + 2 * 60000)},
      });
      if (claim.count !== 1) continue;
      const attempts = row.attempts + 1;
      try {
        const rendered = await renderMail(this.db, row);
        await this.mail.deliver({to: row.toEmail, ...rendered});
        await this.db.emailOutbox.update({where: {id: row.id}, data: {status: 'SENT', sentAt: new Date(), lockedUntil: null, lastError: null}});
        sent += 1;
      } catch (error) {
        const dead = attempts >= MAX_ATTEMPTS;
        /* Only an error class/code is kept: never a body, address list or token. */
        const reason = error instanceof Error ? (error as Error & {code?: string}).code || error.name || 'Error' : 'Error';
        await this.db.emailOutbox
          .update({where: {id: row.id}, data: {status: dead ? 'DEAD' : 'FAILED', lockedUntil: null, lastError: String(reason).slice(0, 80), nextAttemptAt: new Date(now.getTime() + backoffMs(attempts))}})
          .catch(() => undefined);
      }
    }
    return sent;
  }
}
