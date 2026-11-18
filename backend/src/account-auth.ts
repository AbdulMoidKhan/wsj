/**
 * Customer authentication. Deliberately separate from staff auth (auth.ts/core.ts):
 *
 * - Different principal: Customer rows, never User rows. No role, no CMS access.
 * - Different credential: an opaque random session token stored server-side as a
 *   SHA-256 digest (revocable, listable), not the staff JWT. The staff guard
 *   cannot parse it and this guard never reads the staff cookie or a Bearer header.
 * - Cookie: `wsj_customer`, HttpOnly, SameSite=Strict, Secure in production,
 *   Path=/api. The browser reaches the API same-origin through the Next rewrite,
 *   so the cookie is sent on API calls and nowhere else; server-rendered pages
 *   never receive it and never render account data.
 * - CSRF: SameSite=Strict + an allow-listed Origin + a custom header on every
 *   state-changing request (a cross-site form cannot set it).
 * - Every answer about whether an email has an account is generic.
 */
import {BadRequestException, Body, CanActivate, ConflictException, Controller, Delete, ExecutionContext, ForbiddenException, Get, HttpCode, Inject, Injectable, Optional, Param, Post, Req, Res, SetMetadata, UnauthorizedException, UseGuards} from '@nestjs/common';
import {Reflector} from '@nestjs/core';
import {Throttle} from '@nestjs/throttler';
import {IsBoolean, IsEmail, IsOptional, IsString, MaxLength, MinLength} from 'class-validator';
import {Transform} from 'class-transformer';
import {compare, hash} from 'bcryptjs';
import {Db} from './core';
import {ValidatedBody} from './validation';
import {frontendOrigins} from './origins';
import {PaymentClient} from './payments';
import {OutboxService, type MailTemplate} from './mail';
import {LOCKOUT_MS, MAX_FAILED_LOGINS, REAUTH_WINDOW_MS, SESSION_COOKIE, SESSION_COOKIE_PATH, SESSION_IDLE_MS, SESSION_TTL_MS, deviceLabel, displayName, hashToken, initials, ipHint, newToken, normalizeEmail, passwordProblems, type TokenPurpose} from './account-core';

const BCRYPT_COST = 12;
/** Compared against when no account exists, so timing does not reveal existence. */
const DUMMY_HASH = '$2b$12$C6UzMDM.H6dfI/f/IKcEe.2xqE5E5LGaBPa9kJ4QaMBjHHxNB5E2W';
const GENERIC_LOGIN_ERROR = 'That email and password do not match an account.';
const DEAD_LINK = 'This link is invalid, has expired or was already used. Request a new one.';

export interface CustomerPrincipal {
  id: string;
  email: string;
  name: string;
  sessionId: string;
  method: string;
  reauthAt: Date | null;
}

type Req = {method?: string; headers: Record<string, string | string[] | undefined>; cookies?: Record<string, unknown>; ip?: string; customer?: CustomerPrincipal};
type Res = {cookie: (name: string, value: string, options: Record<string, unknown>) => void; clearCookie: (name: string, options: Record<string, unknown>) => void; setHeader: (name: string, value: string) => void};

const lower = Transform(({value}) => (typeof value === 'string' ? value.trim().toLowerCase() : value));

export class LoginDto {
  @lower @IsEmail() @MaxLength(254) email!: string;
  @IsString() @MinLength(1) @MaxLength(200) password!: string;
}
export class EmailOnlyDto {
  @lower @IsEmail() @MaxLength(254) email!: string;
}
export class TokenDto {
  @IsString() @MinLength(20) @MaxLength(200) token!: string;
}
export class ActivateDto extends TokenDto {
  @IsString() @MinLength(1) @MaxLength(200) password!: string;
  @IsOptional() @IsBoolean() marketingOptIn?: boolean;
}
export class ResetDto extends TokenDto {
  @IsString() @MinLength(1) @MaxLength(200) password!: string;
}
export class ChangePasswordDto {
  @IsString() @MinLength(1) @MaxLength(200) currentPassword!: string;
  @IsString() @MinLength(1) @MaxLength(200) newPassword!: string;
}
export class ReauthDto {
  @IsString() @MinLength(1) @MaxLength(200) password!: string;
}
export class EmailChangeDto {
  @lower @IsEmail() @MaxLength(254) newEmail!: string;
  @IsString() @MinLength(1) @MaxLength(200) password!: string;
}

const maskEmail = (email: string) => {
  const [local, domain] = email.split('@');
  return (local.length <= 2 ? local[0] + '*' : local[0] + '***' + local[local.length - 1]) + '@' + domain;
};

/** Cookie-authenticated and credential-bearing writes must come from our own pages. */
export function assertTrustedOrigin(req: Req) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(String(req.method ?? 'GET').toUpperCase())) return;
  const origin = req.headers.origin;
  if (typeof origin !== 'string' || !frontendOrigins().includes(origin)) throw new ForbiddenException('Request origin is not allowed');
  if (!req.headers['x-wsj-csrf']) throw new ForbiddenException('Missing request header');
}

@Injectable()
export class CustomerAuthService {
  constructor(@Inject(Db) private db: Db, @Inject(OutboxService) private outbox: OutboxService, @Optional() @Inject(PaymentClient) private payments?: PaymentClient) {}

  private cookieOptions() {
    return {httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict' as const, path: SESSION_COOKIE_PATH};
  }

  /** Resolve the session cookie to a principal, or null. Never throws. */
  async resolve(req: Req, now = new Date()): Promise<CustomerPrincipal | null> {
    const token = req.cookies?.[SESSION_COOKIE];
    if (typeof token !== 'string' || token.length < 20 || token.length > 200) return null;
    const session = await this.db.customerSession.findUnique({where: {tokenHash: hashToken(token)}, include: {customer: true}});
    if (!session || session.revokedAt || session.expiresAt.getTime() <= now.getTime()) return null;
    if (now.getTime() - session.lastSeenAt.getTime() > SESSION_IDLE_MS) return null;
    const customer = session.customer;
    /* Only an activated primary identity can hold a session. */
    if (!customer || customer.accountStatus !== 'ACTIVE' || customer.shadowState || !customer.emailKey) return null;
    if (now.getTime() - session.lastSeenAt.getTime() > 5 * 60000) await this.db.customerSession.update({where: {id: session.id}, data: {lastSeenAt: now}}).catch(() => undefined);
    return {id: customer.id, email: customer.email, name: customer.name, sessionId: session.id, method: session.method, reauthAt: session.reauthAt};
  }

  private async startSession(customerId: string, method: 'PASSWORD' | 'LINK', req: Req, res: Res, now = new Date()) {
    const {token, hash: tokenHash} = newToken();
    const session = await this.db.customerSession.create({
      data: {customerId, tokenHash, method, userAgent: String(req.headers['user-agent'] ?? '').slice(0, 300) || null, ipHint: ipHint(req.ip), expiresAt: new Date(now.getTime() + SESSION_TTL_MS), reauthAt: method === 'PASSWORD' ? now : null},
    });
    res.cookie(SESSION_COOKIE, token, {...this.cookieOptions(), maxAge: SESSION_TTL_MS});
    return session;
  }

  clearCookie(res: Res) {
    res.clearCookie(SESSION_COOKIE, this.cookieOptions());
  }

  private async revokeSessions(customerId: string, exceptSessionId?: string) {
    await this.db.customerSession.updateMany({where: {customerId, revokedAt: null, ...(exceptSessionId ? {id: {not: exceptSessionId}} : {})}, data: {revokedAt: new Date()}});
  }

  /** Atomically consume a single-use token: exactly one caller can win. */
  private async consume(token: string, purpose: TokenPurpose, now = new Date()) {
    const tokenHash = hashToken(token);
    const row = await this.db.customerToken.findUnique({where: {tokenHash}});
    if (!row || row.purpose !== purpose || row.usedAt || row.expiresAt.getTime() <= now.getTime()) throw new BadRequestException(DEAD_LINK);
    const claimed = await this.db.customerToken.updateMany({where: {id: row.id, usedAt: null}, data: {usedAt: now}});
    if (claimed.count !== 1) throw new BadRequestException(DEAD_LINK);
    return row;
  }

  private async mail(customer: {id: string; email: string; name: string}, template: MailTemplate, payload: Record<string, unknown> = {}, to = customer.email) {
    await this.outbox.enqueue({customerId: customer.id, to, template, payload: {name: displayName(customer), ...payload}});
  }

  /** One message per template per customer per minute, whatever the caller does. */
  private async recentlyMailed(customerId: string, template: string, now = new Date()): Promise<boolean> {
    const recent = await this.db.emailOutbox.findFirst({where: {customerId, template, createdAt: {gte: new Date(now.getTime() - 60000)}}});
    return Boolean(recent);
  }

  async sessionView(principal: CustomerPrincipal | null) {
    if (!principal) return {authenticated: false as const};
    const name = displayName(principal);
    return {authenticated: true as const, customer: {displayName: name, initials: initials(name), email: principal.email}, session: {method: principal.method}};
  }

  async login(dto: LoginDto, req: Req, res: Res, now = new Date()) {
    const customer = await this.db.customer.findUnique({where: {emailKey: normalizeEmail(dto.email)}});
    const usable = customer && customer.accountStatus === 'ACTIVE' && customer.passwordHash && !customer.shadowState;
    const locked = Boolean(customer?.lockedUntil && customer.lockedUntil.getTime() > now.getTime());
    const ok = await compare(dto.password, usable ? customer.passwordHash! : DUMMY_HASH);
    if (!usable || locked || !ok) {
      if (usable && !locked) {
        const failed = customer.failedLoginCount + 1;
        await this.db.customer.update({where: {id: customer.id}, data: {failedLoginCount: failed, ...(failed >= MAX_FAILED_LOGINS ? {lockedUntil: new Date(now.getTime() + LOCKOUT_MS), failedLoginCount: 0} : {})}});
      }
      throw new UnauthorizedException(GENERIC_LOGIN_ERROR);
    }
    await this.db.customer.update({where: {id: customer.id}, data: {failedLoginCount: 0, lockedUntil: null, lastLoginAt: now}});
    await this.startSession(customer.id, 'PASSWORD', req, res, now);
    return this.sessionView({id: customer.id, email: customer.email, name: customer.name, sessionId: '', method: 'PASSWORD', reauthAt: now});
  }

  async logout(principal: CustomerPrincipal | null, res: Res) {
    if (principal) await this.db.customerSession.updateMany({where: {id: principal.sessionId, revokedAt: null}, data: {revokedAt: new Date()}});
    this.clearCookie(res);
    return {loggedOut: true};
  }

  async logoutAll(principal: CustomerPrincipal, res: Res) {
    await this.revokeSessions(principal.id);
    this.clearCookie(res);
    return {loggedOut: true};
  }

  /**
   * Account activation: the emailed single-use link proves control of the
   * address; setting a password in the same step completes verification.
   */
  async activate(dto: ActivateDto, req: Req, res: Res, now = new Date()) {
    /* Validate the password before spending the token so a weak choice can be retried. */
    const peek = await this.db.customerToken.findUnique({where: {tokenHash: hashToken(dto.token)}});
    const target = peek ? await this.db.customer.findUnique({where: {id: peek.customerId}}) : null;
    if (!peek || !target || peek.purpose !== 'ACCOUNT_SETUP') throw new BadRequestException(DEAD_LINK);
    const problems = passwordProblems(dto.password, target);
    if (problems.length) throw new BadRequestException(problems);
    const row = await this.consume(dto.token, 'ACCOUNT_SETUP', now);
    const customer = await this.db.customer.findUnique({where: {id: row.customerId}});
    if (!customer || customer.shadowState || !customer.emailKey || customer.accountStatus === 'ACTIVE') throw new BadRequestException(DEAD_LINK);
    await this.db.customer.update({
      where: {id: customer.id},
      data: {
        passwordHash: await hash(dto.password, BCRYPT_COST),
        passwordChangedAt: now,
        emailVerifiedAt: now,
        accountStatus: 'ACTIVE',
        failedLoginCount: 0,
        lockedUntil: null,
        lastLoginAt: now,
        ...(dto.marketingOptIn === true ? {marketingOptIn: true, marketingConsentAt: now} : {}),
      },
    });
    await this.revokeSessions(customer.id);
    await this.startSession(customer.id, 'PASSWORD', req, res, now);
    return this.sessionView({id: customer.id, email: customer.email, name: customer.name, sessionId: '', method: 'PASSWORD', reauthAt: now});
  }

  /** What the activation page may show before a password is chosen. */
  async inspectSetup(dto: TokenDto, now = new Date()) {
    const row = await this.db.customerToken.findUnique({where: {tokenHash: hashToken(dto.token)}});
    const valid = Boolean(row && row.purpose === 'ACCOUNT_SETUP' && !row.usedAt && row.expiresAt.getTime() > now.getTime());
    return {valid};
  }

  /**
   * Email a sign-in or activation link. Same response whether or not the
   * address is known. Replaces the legacy multi-use management JWT.
   */
  async requestLink(email: string, now = new Date()) {
    const customer = await this.db.customer.findUnique({where: {emailKey: normalizeEmail(email)}});
    if (customer && !customer.shadowState) {
      if (customer.accountStatus === 'ACTIVE') {
        if (!(await this.recentlyMailed(customer.id, 'login_link', now))) await this.mail(customer, 'login_link');
      } else if (await this.hasPurchaseHistory(customer.id, customer.accountStatus)) {
        if (!(await this.recentlyMailed(customer.id, 'account_setup', now))) await this.mail(customer, 'account_setup');
      }
    }
    return {requested: true};
  }

  private async hasPurchaseHistory(customerId: string, accountStatus: string): Promise<boolean> {
    if (accountStatus === 'PENDING_SETUP') return true;
    if (await this.db.order.findFirst({where: {customerId, status: 'PAID'}})) return true;
    return Boolean(await this.db.subscription.findFirst({where: {customerId}}));
  }

  /** A sign-in link creates a LINK session: it can view and manage, but cannot change credentials without the password. */
  async exchangeLink(dto: TokenDto, req: Req, res: Res, now = new Date()) {
    const row = await this.consume(dto.token, 'LOGIN_LINK', now);
    const customer = await this.db.customer.findUnique({where: {id: row.customerId}});
    if (!customer || customer.accountStatus !== 'ACTIVE' || customer.shadowState) throw new BadRequestException(DEAD_LINK);
    await this.db.customer.update({where: {id: customer.id}, data: {lastLoginAt: now}});
    await this.startSession(customer.id, 'LINK', req, res, now);
    return this.sessionView({id: customer.id, email: customer.email, name: customer.name, sessionId: '', method: 'LINK', reauthAt: null});
  }

  async forgotPassword(email: string, now = new Date()) {
    const customer = await this.db.customer.findUnique({where: {emailKey: normalizeEmail(email)}});
    if (customer && !customer.shadowState) {
      if (customer.accountStatus === 'ACTIVE') {
        if (!(await this.recentlyMailed(customer.id, 'password_reset', now))) await this.mail(customer, 'password_reset');
      } else if (await this.hasPurchaseHistory(customer.id, customer.accountStatus)) {
        if (!(await this.recentlyMailed(customer.id, 'account_setup', now))) await this.mail(customer, 'account_setup');
      }
    }
    return {requested: true};
  }

  async resetPassword(dto: ResetDto, res: Res, now = new Date()) {
    const peek = await this.db.customerToken.findUnique({where: {tokenHash: hashToken(dto.token)}});
    const target = peek ? await this.db.customer.findUnique({where: {id: peek.customerId}}) : null;
    if (!peek || !target || peek.purpose !== 'PASSWORD_RESET') throw new BadRequestException(DEAD_LINK);
    const problems = passwordProblems(dto.password, target);
    if (problems.length) throw new BadRequestException(problems);
    const row = await this.consume(dto.token, 'PASSWORD_RESET', now);
    const customer = await this.db.customer.findUnique({where: {id: row.customerId}});
    if (!customer || customer.accountStatus !== 'ACTIVE' || customer.shadowState) throw new BadRequestException(DEAD_LINK);
    await this.db.customer.update({where: {id: customer.id}, data: {passwordHash: await hash(dto.password, BCRYPT_COST), passwordChangedAt: now, failedLoginCount: 0, lockedUntil: null}});
    /* Every existing session ends; the customer signs in again with the new password. */
    await this.revokeSessions(customer.id);
    this.clearCookie(res);
    await this.mail(customer, 'password_changed');
    return {reset: true};
  }

  private async checkPassword(customerId: string, password: string) {
    const customer = await this.db.customer.findUnique({where: {id: customerId}});
    const ok = await compare(password, customer?.passwordHash || DUMMY_HASH);
    if (!customer?.passwordHash || !ok) throw new ForbiddenException('That password is not correct.');
    return customer;
  }

  async changePassword(principal: CustomerPrincipal, dto: ChangePasswordDto, req: Req, res: Res, now = new Date()) {
    const customer = await this.checkPassword(principal.id, dto.currentPassword);
    const problems = passwordProblems(dto.newPassword, customer);
    if (dto.newPassword === dto.currentPassword) problems.push('Choose a password you have not just used.');
    if (problems.length) throw new BadRequestException(problems);
    await this.db.customer.update({where: {id: customer.id}, data: {passwordHash: await hash(dto.newPassword, BCRYPT_COST), passwordChangedAt: now}});
    /* Rotate: every session, including this one, is revoked and this device gets a new token. */
    await this.revokeSessions(customer.id);
    await this.startSession(customer.id, 'PASSWORD', req, res, now);
    await this.mail(customer, 'password_changed');
    return {changed: true};
  }

  async reauth(principal: CustomerPrincipal, dto: ReauthDto, now = new Date()) {
    await this.checkPassword(principal.id, dto.password);
    await this.db.customerSession.update({where: {id: principal.sessionId}, data: {reauthAt: now, method: 'PASSWORD'}});
    return {reauthenticated: true};
  }

  /** The new address must prove itself before anything changes; the old one is told. */
  async requestEmailChange(principal: CustomerPrincipal, dto: EmailChangeDto) {
    const customer = await this.checkPassword(principal.id, dto.password);
    const newEmail = normalizeEmail(dto.newEmail);
    if (newEmail === customer.emailKey) throw new BadRequestException('That is already your email address.');
    const taken = await this.db.customer.findUnique({where: {emailKey: newEmail}});
    await this.db.customer.update({where: {id: customer.id}, data: {pendingEmail: newEmail}});
    /* An address that already belongs to an account gets no link, and the caller cannot tell. */
    if (!taken) await this.mail(customer, 'email_change_verify', {newEmail}, newEmail);
    await this.mail(customer, 'email_change_notice', {newEmailMasked: maskEmail(newEmail)});
    return {requested: true};
  }

  /** Financial history is keyed by customer id and is never relinked by an email change. */
  async confirmEmailChange(dto: TokenDto, res: Res, now = new Date()) {
    const row = await this.consume(dto.token, 'EMAIL_CHANGE', now);
    const newEmail = normalizeEmail((row.data as {newEmail?: string} | null)?.newEmail);
    const customer = await this.db.customer.findUnique({where: {id: row.customerId}});
    if (!customer || !newEmail || customer.accountStatus !== 'ACTIVE' || customer.pendingEmail !== newEmail) throw new BadRequestException(DEAD_LINK);
    const oldEmail = customer.email;
    try {
      await this.db.customer.update({where: {id: customer.id}, data: {email: newEmail, emailKey: newEmail, emailVerifiedAt: now, pendingEmail: null}});
    } catch {
      /* The unique index on emailKey closes the race with another account taking the address. */
      throw new ConflictException(DEAD_LINK);
    }
    await this.revokeSessions(customer.id);
    this.clearCookie(res);
    /* Stripe is updated only after verification, and a failure is recorded for reconciliation rather than rolled back. */
    if (customer.stripeCustomerId && this.payments) {
      try {
        await this.payments.client().customers.update(customer.stripeCustomerId, {email: newEmail}, {idempotencyKey: 'email:' + customer.id + ':' + row.id});
      } catch {
        await this.db.billingEvent.create({data: {customerId: customer.id, actorType: 'SYSTEM', action: 'STRIPE_EMAIL_SYNC_FAILED', note: 'Stripe customer email is stale; reconcile from admin diagnostics.'}}).catch(() => undefined);
      }
    }
    await this.db.billingEvent.create({data: {customerId: customer.id, actorType: 'CUSTOMER', action: 'EMAIL_CHANGED', data: {from: maskEmail(oldEmail), to: maskEmail(newEmail)}}}).catch(() => undefined);
    await this.outbox.enqueue({customerId: customer.id, to: oldEmail, template: 'email_changed', payload: {name: displayName(customer), newEmailMasked: maskEmail(newEmail)}});
    return {changed: true};
  }

  async sessions(principal: CustomerPrincipal, now = new Date()) {
    const rows = await this.db.customerSession.findMany({where: {customerId: principal.id, revokedAt: null, expiresAt: {gt: now}}, orderBy: {lastSeenAt: 'desc'}, take: 30});
    return {items: rows.map(row => ({id: row.id, device: deviceLabel(row.userAgent), network: row.ipHint, method: row.method, createdAt: row.createdAt, lastSeenAt: row.lastSeenAt, current: row.id === principal.sessionId}))};
  }

  async revokeSession(principal: CustomerPrincipal, id: string) {
    /* Scoped by customer id: another customer's session id is simply not found. */
    const revoked = await this.db.customerSession.updateMany({where: {id, customerId: principal.id, revokedAt: null}, data: {revokedAt: new Date()}});
    return {revoked: revoked.count === 1};
  }
}

/* ───────────────────────────── Guard ───────────────────────────── */

export const RecentAuth = () => SetMetadata('customerRecentAuth', true);

@Injectable()
export class CustomerGuard implements CanActivate {
  constructor(@Inject(CustomerAuthService) private auth: CustomerAuthService, @Inject(Reflector) private reflector: Reflector) {}

  async canActivate(ctx: ExecutionContext) {
    const http = ctx.switchToHttp();
    const req = http.getRequest<Req>();
    const res = http.getResponse<Res>();
    /* Account responses are private to one customer and must never be cached or indexed. */
    res.setHeader('Cache-Control', 'no-store, private');
    res.setHeader('X-Robots-Tag', 'noindex');
    assertTrustedOrigin(req);
    const principal = await this.auth.resolve(req);
    if (!principal) throw new UnauthorizedException('Please sign in to continue.');
    if (this.reflector.getAllAndOverride<boolean>('customerRecentAuth', [ctx.getHandler(), ctx.getClass()])) {
      const fresh = principal.method === 'PASSWORD' && principal.reauthAt && Date.now() - principal.reauthAt.getTime() <= REAUTH_WINDOW_MS;
      if (!fresh) throw new ForbiddenException({statusCode: 403, code: 'REAUTH_REQUIRED', message: 'Please confirm your password to continue.'});
    }
    req.customer = principal;
    return true;
  }
}

/* ───────────────────────────── Controller ───────────────────────────── */

const noStore = (res: Res) => {
  res.setHeader('Cache-Control', 'no-store, private');
  res.setHeader('X-Robots-Tag', 'noindex');
};

@Controller('account/auth')
export class AccountAuthController {
  constructor(@Inject(CustomerAuthService) private auth: CustomerAuthService) {}

  /** Never 401: the navbar asks this on every page and needs a calm answer. */
  @Get('session') @Throttle({default: {limit: 600, ttl: 60000}})
  async session(@Req() req: Req, @Res({passthrough: true}) res: Res) {
    noStore(res);
    return this.auth.sessionView(await this.auth.resolve(req));
  }

  @Post('login') @HttpCode(200) @Throttle({default: {limit: 8, ttl: 60000}})
  async login(@ValidatedBody(LoginDto) dto: LoginDto, @Req() req: Req, @Res({passthrough: true}) res: Res) {
    noStore(res);
    assertTrustedOrigin(req);
    return this.auth.login(dto, req, res);
  }

  @Post('logout') @HttpCode(200) @Throttle({default: {limit: 60, ttl: 60000}})
  async logout(@Req() req: Req, @Res({passthrough: true}) res: Res) {
    noStore(res);
    assertTrustedOrigin(req);
    return this.auth.logout(await this.auth.resolve(req), res);
  }

  @Post('logout-all') @HttpCode(200) @UseGuards(CustomerGuard) @Throttle({default: {limit: 10, ttl: 60000}})
  logoutAll(@Req() req: Req, @Res({passthrough: true}) res: Res) {
    return this.auth.logoutAll(req.customer!, res);
  }

  @Post('activate/inspect') @HttpCode(200) @Throttle({default: {limit: 20, ttl: 60000}})
  inspect(@ValidatedBody(TokenDto) dto: TokenDto, @Req() req: Req, @Res({passthrough: true}) res: Res) {
    noStore(res);
    assertTrustedOrigin(req);
    return this.auth.inspectSetup(dto);
  }

  @Post('activate') @HttpCode(200) @Throttle({default: {limit: 10, ttl: 60000}})
  activate(@ValidatedBody(ActivateDto) dto: ActivateDto, @Req() req: Req, @Res({passthrough: true}) res: Res) {
    noStore(res);
    assertTrustedOrigin(req);
    return this.auth.activate(dto, req, res);
  }

  @Post('link/request') @HttpCode(200) @Throttle({default: {limit: 3, ttl: 60000}})
  requestLink(@ValidatedBody(EmailOnlyDto) dto: EmailOnlyDto, @Req() req: Req, @Res({passthrough: true}) res: Res) {
    noStore(res);
    assertTrustedOrigin(req);
    return this.auth.requestLink(dto.email);
  }

  @Post('link/exchange') @HttpCode(200) @Throttle({default: {limit: 10, ttl: 60000}})
  exchange(@ValidatedBody(TokenDto) dto: TokenDto, @Req() req: Req, @Res({passthrough: true}) res: Res) {
    noStore(res);
    assertTrustedOrigin(req);
    return this.auth.exchangeLink(dto, req, res);
  }

  @Post('password/forgot') @HttpCode(200) @Throttle({default: {limit: 3, ttl: 60000}})
  forgot(@ValidatedBody(EmailOnlyDto) dto: EmailOnlyDto, @Req() req: Req, @Res({passthrough: true}) res: Res) {
    noStore(res);
    assertTrustedOrigin(req);
    return this.auth.forgotPassword(dto.email);
  }

  @Post('password/reset') @HttpCode(200) @Throttle({default: {limit: 10, ttl: 60000}})
  reset(@ValidatedBody(ResetDto) dto: ResetDto, @Req() req: Req, @Res({passthrough: true}) res: Res) {
    noStore(res);
    assertTrustedOrigin(req);
    return this.auth.resetPassword(dto, res);
  }

  @Post('password/change') @HttpCode(200) @UseGuards(CustomerGuard) @Throttle({default: {limit: 5, ttl: 60000}})
  changePassword(@ValidatedBody(ChangePasswordDto) dto: ChangePasswordDto, @Req() req: Req, @Res({passthrough: true}) res: Res) {
    return this.auth.changePassword(req.customer!, dto, req, res);
  }

  @Post('reauth') @HttpCode(200) @UseGuards(CustomerGuard) @Throttle({default: {limit: 8, ttl: 60000}})
  reauth(@ValidatedBody(ReauthDto) dto: ReauthDto, @Req() req: Req) {
    return this.auth.reauth(req.customer!, dto);
  }

  @Post('email/change') @HttpCode(200) @UseGuards(CustomerGuard) @Throttle({default: {limit: 3, ttl: 60000}})
  emailChange(@ValidatedBody(EmailChangeDto) dto: EmailChangeDto, @Req() req: Req) {
    return this.auth.requestEmailChange(req.customer!, dto);
  }

  @Post('email/confirm') @HttpCode(200) @Throttle({default: {limit: 10, ttl: 60000}})
  emailConfirm(@ValidatedBody(TokenDto) dto: TokenDto, @Req() req: Req, @Res({passthrough: true}) res: Res) {
    noStore(res);
    assertTrustedOrigin(req);
    return this.auth.confirmEmailChange(dto, res);
  }

  @Get('sessions') @UseGuards(CustomerGuard) @Throttle({default: {limit: 60, ttl: 60000}})
  sessions(@Req() req: Req) {
    return this.auth.sessions(req.customer!);
  }

  @Delete('sessions/:id') @UseGuards(CustomerGuard) @Throttle({default: {limit: 30, ttl: 60000}})
  revoke(@Param('id') id: string, @Req() req: Req, @Body() _body: unknown) {
    return this.auth.revokeSession(req.customer!, id);
  }
}
