/**
 * Customer accounts: provisioning, activation, sessions, account-claim security,
 * saved cards and the minimum-one-card invariant, plan changes, and the retired
 * legacy portal. Offline only: in-memory database and the Stripe test double.
 */
import 'reflect-metadata';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Reflector} from '@nestjs/core';
import {AuthGuard} from '../src/core';
import {BillingService, BillingWebhookService, PublicBillingController, RetiredPortalController} from '../src/billing';
import {MailService, OutboxService, renderMail} from '../src/mail';
import {AccountLifecycle, CardService, LAST_CARD_MESSAGE} from '../src/account-cards';
import {PlanChangeService} from '../src/account-plans';
import {AccountService} from '../src/account';
import {CustomerAuthService, CustomerGuard} from '../src/account-auth';
import {SESSION_COOKIE, classifyPlanChange, passwordProblems, safeReturnPath, signProof, verifyProof} from '../src/account-core';
import {fakeDb, makeEvent, makeStripeSubscription, stripeFixture} from './billing-fixture';

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-value-that-is-long-enough-123456';
process.env.FRONTEND_URL = 'http://localhost:3100';
delete process.env.FRONTEND_URLS;

const ORIGIN = 'http://localhost:3100';
const PASSWORD = 'Correct-horse-battery-41';
const MONTHLY = {id: 'plan-monthly', slug: 'community-membership', name: 'Community Membership', serviceType: 'memberships', description: '', billingType: 'RECURRING', interval: 'MONTH', intervalCount: 1, unitAmount: 2900, currency: 'usd', pricingUnit: 'PACKAGE', minQuantity: 1, maxQuantity: 1, requiresSchedule: false, requiresResource: false, requiresOnboarding: false, includedCredits: [{kind: 'MEETING_ROOM_HOUR', amount: 5, resetInterval: 'MONTH'}], active: true, archivedAt: null, sortOrder: 0};
const PLUS = {...MONTHLY, id: 'plan-plus', slug: 'community-plus', name: 'Community Plus', unitAmount: 4900, sortOrder: 1, includedCredits: [{kind: 'MEETING_ROOM_HOUR', amount: 12, resetInterval: 'MONTH'}]};
const ANNUAL = {...MONTHLY, id: 'plan-annual', slug: 'community-annual', name: 'Community Annual', interval: 'YEAR', unitAmount: 29000, sortOrder: 2};

async function harness() {
  const db = fakeDb();
  const stripe = stripeFixture({origin: ORIGIN});
  for (const plan of [MONTHLY, PLUS, ANNUAL]) await db.plan.create({data: plan});
  const outbox = new OutboxService(db, {mode: () => 'none'} as unknown as MailService);
  const cards = new CardService(db, stripe as never, outbox);
  const lifecycle = new AccountLifecycle(db, cards, outbox);
  const billing = new BillingService(db, stripe as never, outbox, lifecycle);
  const webhooks = new BillingWebhookService(db, billing, lifecycle);
  const auth = new CustomerAuthService(db, outbox, stripe as never);
  const plans = new PlanChangeService(db, stripe as never, billing, cards);
  return {db, stripe, outbox, cards, billing, webhooks, auth, plans, account: new AccountService(db, stripe as never, billing, cards, plans), publicApi: new PublicBillingController(db, billing, auth)};
}
type H = Awaited<ReturnType<typeof harness>>;

/** A browser: remembers the session cookie and sends the CSRF header from our origin. */
function browser(extra: Record<string, string> = {}) {
  const jar: Record<string, string> = {};
  const res = {cookie: (name: string, value: string) => void (jar[name] = value), clearCookie: (name: string) => void delete jar[name], setHeader: () => undefined};
  const req = (method = 'POST') => ({method, headers: {origin: ORIGIN, 'x-wsj-csrf': '1', 'user-agent': 'Mozilla/5.0 (Windows NT 10.0) Chrome/130', ...extra}, cookies: {...jar}, ip: '203.0.113.9'});
  return {jar, res, req};
}

const rejectsWith = (fn: () => Promise<unknown>, pattern: RegExp) =>
  assert.rejects(fn, (error: any) => {
    assert.match(JSON.stringify(error?.response ?? error?.message ?? ''), pattern);
    return true;
  });

async function buy(h: H, email = 'dana@example.invalid', planSlug = 'community-membership', session?: ReturnType<typeof browser>) {
  const checkout = await h.publicApi.checkout({customerName: 'Dana Buyer', customerEmail: email, items: [{planSlug}], acceptRecurringTerms: true, acceptAccountTerms: true, confirmAdditionalSubscription: true} as never, session?.req() as never);
  const order = await h.db.order.findUnique({where: {id: checkout.orderId}});
  const customer = await h.db.customer.findUnique({where: {id: order.customerId}});
  const unit = h.db.plan.rows.find((plan: any) => plan.slug === planSlug).unitAmount;
  const sub = makeStripeSubscription({customer: customer.stripeCustomerId, unitAmount: unit, interval: planSlug === 'community-annual' ? 'year' : 'month', metadata: {orderId: order.id, customerId: customer.id}});
  h.stripe.subscriptions.set(sub.id, sub);
  /* The card the buyer used in Checkout is now saved on their Stripe customer. */
  if (![...h.stripe.methods.values()].some(method => method.customer === customer.stripeCustomerId)) h.stripe.addCard(customer.stripeCustomerId);
  const event = makeEvent('checkout.session.completed', {id: 'cs_' + order.id, metadata: {orderId: order.id}, payment_status: 'paid', subscription: sub.id, amount_total: unit});
  await h.webhooks.process(event as never);
  return {checkout, order, customer, stripeSub: sub, event, subscription: await h.db.subscription.findUnique({where: {stripeSubscriptionId: sub.id}})};
}

/** Deliver the queued email and read the single-use token out of its link. */
async function tokenFrom(h: H, customerId: string, template = 'account_setup') {
  const row = h.db.emailOutbox.rows.filter((entry: any) => entry.customerId === customerId && entry.template === template).pop();
  assert.ok(row, template + ' email was queued');
  const {text} = await renderMail(h.db, row);
  const token = /#token=([\w-]+)/.exec(text)?.[1];
  assert.ok(token, 'the link carries the token in the URL fragment');
  assert.ok(!/\?token=/.test(text), 'never in the query string');
  return token!;
}

async function activated(h: H, email = 'dana@example.invalid') {
  const bought = await buy(h, email);
  const token = await tokenFrom(h, bought.customer.id);
  const session = browser();
  await h.auth.activate({token, password: PASSWORD} as never, session.req() as never, session.res as never);
  const principal = (await h.auth.resolve(session.req('GET') as never))!;
  assert.ok(principal);
  return {...bought, session, principal};
}
const actor = (principal: {id: string; email: string}) => ({id: principal.id, label: principal.email});

/* ─────────────── pure rules ─────────────── */

test('password policy, return paths, plan classification and scoped proofs', () => {
  assert.ok(passwordProblems('short').length);
  assert.ok(passwordProblems('password123').length);
  assert.ok(passwordProblems('danabuyer-secret', {email: 'danabuyer@example.com'}).length);
  assert.deepEqual(passwordProblems(PASSWORD, {email: 'dana@example.invalid', name: 'Dana Buyer'}), []);
  for (const bad of ['//evil.example', 'https://evil.example', '/\\evil', '/admin/', '/api/account']) assert.equal(safeReturnPath(bad), '/account/');
  assert.equal(safeReturnPath('/account/billing/?status=open'), '/account/billing/?status=open');
  assert.equal(classifyPlanChange({unitAmount: 2900, interval: 'MONTH', intervalCount: 1}, {unitAmount: 4900, interval: 'MONTH', intervalCount: 1}), 'UPGRADE');
  assert.equal(classifyPlanChange({unitAmount: 4900, interval: 'MONTH', intervalCount: 1}, {unitAmount: 2900, interval: 'MONTH', intervalCount: 1}), 'DOWNGRADE');
  assert.equal(classifyPlanChange({unitAmount: 2900, interval: 'MONTH', intervalCount: 1}, {unitAmount: 29000, interval: 'YEAR', intervalCount: 1}), 'INTERVAL_CHANGE');
  const proof = signProof('order-receipt', {o: 'order-1'}, 'secret-value', 60000);
  assert.equal(verifyProof<{o: string}>('order-receipt', proof, 'secret-value')?.o, 'order-1');
  assert.equal(verifyProof('plan-change-preview', proof, 'secret-value'), null, 'a proof is bound to its purpose');
  assert.equal(verifyProof('order-receipt', proof.slice(0, -2) + 'xx', 'secret-value'), null, 'a tampered proof is rejected');
});

/* ─────────────── provisioning and activation ─────────────── */

test('a paid checkout provisions one account and one setup email, and replays change nothing', async () => {
  const h = await harness();
  const {customer, event, order} = await buy(h);
  const stored = await h.db.customer.findUnique({where: {id: customer.id}});
  assert.equal(stored.accountStatus, 'PENDING_SETUP');
  assert.equal(stored.passwordHash, null, 'no password is generated or emailed');
  assert.ok(stored.cardConsentAt, 'card-saving consent from checkout is recorded');
  for (let i = 0; i < 3; i++) await h.webhooks.process({...event, id: event.id + '-redelivered-' + i} as never);
  await h.webhooks.process(event as never);
  assert.equal(h.db.customer.rows.length, 1, 'no duplicate identity');
  assert.equal(h.stripe.calls.filter(call => call.kind === 'customers.create').length, 1, 'no duplicate Stripe customer');
  assert.equal(h.db.emailOutbox.rows.filter((row: any) => row.template === 'account_setup').length, 1, 'one setup email');
  assert.equal(h.db.emailOutbox.rows.filter((row: any) => row.template === 'purchase_receipt').length, 1, 'one receipt');
  assert.equal(h.db.order.rows.length, 1);
  assert.equal((await h.db.order.findUnique({where: {id: order.id}})).status, 'PAID');
});

test('a browser return or an unpaid session never provisions an account', async () => {
  const h = await harness();
  const checkout = await h.publicApi.checkout({customerName: 'Pat', customerEmail: 'pat@example.invalid', items: [{planSlug: 'community-membership'}], acceptRecurringTerms: true, acceptAccountTerms: true} as never);
  const status = (await h.publicApi.orderStatus(checkout.orderId)) as any;
  assert.equal(status.processing, true);
  assert.equal(status.account, null);
  await h.webhooks.process(makeEvent('checkout.session.completed', {id: 'cs_unpaid', metadata: {orderId: checkout.orderId}, payment_status: 'unpaid'}) as never);
  assert.equal(h.db.customer.rows[0].accountStatus, 'GUEST');
  assert.equal(h.db.emailOutbox.rows.length, 0);
});

test('a card checkout requires the account and saved-card consent; marketing stays separate', async () => {
  const h = await harness();
  await rejectsWith(() => h.publicApi.checkout({customerName: 'Pat', customerEmail: 'pat@example.invalid', items: [{planSlug: 'community-membership'}], acceptRecurringTerms: true} as never), /customer account will be created/);
  const ok = await h.publicApi.checkout({customerName: 'Pat', customerEmail: 'pat@example.invalid', items: [{planSlug: 'community-membership'}], acceptRecurringTerms: true, acceptAccountTerms: true} as never);
  const order = await h.db.order.findUnique({where: {id: ok.orderId}});
  assert.equal(order.metadata.consents.marketing, false, 'marketing is never implied');
  const session = h.stripe.calls.find(call => call.kind === 'checkout.sessions.create')!.input as any;
  assert.equal(session.saved_payment_method_options, undefined, 'a guest is never shown saved cards');
});

test('activation sets a password once; the link cannot be replayed and expired links fail', async () => {
  const h = await harness();
  const {customer} = await buy(h);
  const token = await tokenFrom(h, customer.id);
  const session = browser();
  await rejectsWith(() => h.auth.activate({token, password: 'password123'} as never, session.req() as never, session.res as never), /too common|10 characters/);
  const view = await h.auth.activate({token, password: PASSWORD} as never, session.req() as never, session.res as never);
  assert.equal(view.authenticated, true);
  assert.ok(session.jar[SESSION_COOKIE], 'the session lives in an HttpOnly cookie');
  assert.equal(JSON.stringify(view).includes(session.jar[SESSION_COOKIE]), false, 'the token is never in the response body');
  const stored = await h.db.customer.findUnique({where: {id: customer.id}});
  assert.equal(stored.accountStatus, 'ACTIVE');
  assert.ok(stored.emailVerifiedAt);
  assert.ok(stored.passwordHash.startsWith('$2'), 'a bcrypt hash is stored');
  assert.ok(h.db.customerToken.rows.every((row: any) => row.tokenHash !== token), 'only the token hash is stored');
  const other = browser();
  await rejectsWith(() => h.auth.activate({token, password: PASSWORD + 'x'} as never, other.req() as never, other.res as never), /already used|expired|invalid/);

  const fresh = await buy(h, 'lee@example.invalid');
  const lateToken = await tokenFrom(h, fresh.customer.id);
  for (const row of h.db.customerToken.rows) if (row.customerId === fresh.customer.id) row.expiresAt = new Date(Date.now() - 1000);
  await rejectsWith(() => h.auth.activate({token: lateToken, password: PASSWORD} as never, other.req() as never, other.res as never), /expired/);
});

/* ─────────────── sign-in, sessions, credentials ─────────────── */

test('login is generic for unknown, wrong and not-yet-activated accounts, and locks after repeated failures', async () => {
  const h = await harness();
  const {customer} = await buy(h, 'pending@example.invalid');
  await activated(h);
  const b = browser();
  const attempt = (email: string, password: string) => () => h.auth.login({email, password} as never, b.req() as never, b.res as never);
  for (const run of [attempt('nobody@example.invalid', PASSWORD), attempt('dana@example.invalid', 'Wrong-password-1234'), attempt(customer.email, PASSWORD)]) await rejectsWith(run, /do not match an account/);
  const ok = await attempt('DANA@example.invalid', PASSWORD)();
  assert.equal(ok.authenticated, true, 'email identity is case-insensitive');
  for (let i = 0; i < 8; i++) await attempt('dana@example.invalid', 'Wrong-password-1234')().catch(() => undefined);
  await rejectsWith(attempt('dana@example.invalid', PASSWORD), /do not match/);
});

test('password change rotates sessions, notifies, and logout-all and revoke end other devices', async () => {
  const h = await harness();
  const {session, principal, customer} = await activated(h);
  const laptop = browser();
  await h.auth.login({email: customer.email, password: PASSWORD} as never, laptop.req() as never, laptop.res as never);
  const listed = await h.auth.sessions(principal);
  assert.equal(listed.items.length, 2);
  assert.ok(listed.items.every(item => !('tokenHash' in item)), 'session list exposes no token material');
  await rejectsWith(() => h.auth.changePassword(principal, {currentPassword: 'nope-nope-nope', newPassword: 'Another-strong-pass-77'} as never, session.req() as never, session.res as never), /not correct/);
  await h.auth.changePassword(principal, {currentPassword: PASSWORD, newPassword: 'Another-strong-pass-77'} as never, session.req() as never, session.res as never);
  assert.equal(await h.auth.resolve(laptop.req('GET') as never), null, 'other sessions are revoked');
  const current = await h.auth.resolve(session.req('GET') as never);
  assert.ok(current, 'this device got a fresh session');
  assert.ok(h.db.emailOutbox.rows.some((row: any) => row.template === 'password_changed'));
  const phone = browser();
  await h.auth.login({email: customer.email, password: 'Another-strong-pass-77'} as never, phone.req() as never, phone.res as never);
  const phoneSession = h.db.customerSession.rows.find((row: any) => !row.revokedAt && row.id !== current!.sessionId);
  assert.equal((await h.auth.revokeSession(current!, phoneSession.id)).revoked, true);
  assert.equal(await h.auth.resolve(phone.req('GET') as never), null);
  await h.auth.logoutAll(current!, session.res as never);
  assert.equal(await h.auth.resolve(session.req('GET') as never), null);
  assert.equal(session.jar[SESSION_COOKIE], undefined, 'the cookie is cleared');
});

test('forgot password is generic, the reset link is single-use and ends every session', async () => {
  const h = await harness();
  const {session, customer} = await activated(h);
  assert.deepEqual(await h.auth.forgotPassword('nobody@example.invalid'), {requested: true});
  assert.deepEqual(await h.auth.forgotPassword(customer.email), {requested: true});
  const token = await tokenFrom(h, customer.id, 'password_reset');
  const anon = browser();
  await h.auth.resetPassword({token, password: 'Brand-new-password-55'} as never, anon.res as never);
  await rejectsWith(() => h.auth.resetPassword({token, password: 'Brand-new-password-66'} as never, anon.res as never), /already used|expired|invalid/);
  assert.equal(await h.auth.resolve(session.req('GET') as never), null);
  const ok = await h.auth.login({email: customer.email, password: 'Brand-new-password-55'} as never, anon.req() as never, anon.res as never);
  assert.equal(ok.authenticated, true);
});

test('email change needs the password, verifies the new address, tells the old one, and keeps history', async () => {
  const h = await harness();
  const {principal, customer, order} = await activated(h);
  await rejectsWith(() => h.auth.requestEmailChange(principal, {newEmail: 'new@example.invalid', password: 'wrong-wrong-wrong'} as never), /not correct/);
  await h.auth.requestEmailChange(principal, {newEmail: 'new@example.invalid', password: PASSWORD} as never);
  assert.equal((await h.db.customer.findUnique({where: {id: customer.id}})).email, customer.email, 'nothing changes before verification');
  assert.ok(h.db.emailOutbox.rows.some((row: any) => row.template === 'email_change_notice' && row.toEmail === customer.email));
  const token = await tokenFrom(h, customer.id, 'email_change_verify');
  await h.auth.confirmEmailChange({token} as never, browser().res as never);
  const stored = await h.db.customer.findUnique({where: {id: customer.id}});
  assert.equal(stored.emailKey, 'new@example.invalid');
  assert.equal((await h.db.order.findUnique({where: {id: order.id}})).customerId, customer.id, 'financial history stays on the same customer id');
  assert.ok(h.stripe.calls.some(call => call.kind === 'customers.update' && (call.input as any).email === 'new@example.invalid'), 'Stripe synced after verification');
});

test('customer and staff credentials are not interchangeable', async () => {
  const h = await harness();
  const {session} = await activated(h);
  const guard = new AuthGuard({user: {findUnique: async () => null}} as never, new Reflector());
  const ctx = (req: unknown) => ({switchToHttp: () => ({getRequest: () => req}), getHandler: () => null, getClass: () => null}) as never;
  await assert.rejects(() => guard.canActivate(ctx({method: 'GET', headers: {}, cookies: {access_token: session.jar[SESSION_COOKIE]}})), /Invalid or expired session/);
  await assert.rejects(() => guard.canActivate(ctx({method: 'GET', headers: {authorization: 'Bearer ' + session.jar[SESSION_COOKIE]}})), /Invalid or expired session/);
  assert.equal(await h.auth.resolve({headers: {}, cookies: {access_token: 'staff.jwt.token-value-long-enough'}} as never), null, 'the staff cookie is never read as a customer session');
});

test('the customer guard enforces origin and CSRF header, and marks responses private', async () => {
  const h = await harness();
  const {session} = await activated(h);
  const headers: Record<string, string> = {};
  const guard = new CustomerGuard(h.auth, new Reflector());
  class Target {
    handler() {}
  }
  const ctx = (req: any) => ({switchToHttp: () => ({getRequest: () => req, getResponse: () => ({setHeader: (k: string, v: string) => void (headers[k] = v)})}), getHandler: () => Target.prototype.handler, getClass: () => Target}) as never;
  assert.equal(await guard.canActivate(ctx(session.req('GET'))), true);
  assert.equal(headers['Cache-Control'], 'no-store, private');
  await assert.rejects(() => guard.canActivate(ctx({...session.req('POST'), headers: {...session.req().headers, origin: 'https://evil.example'}})), /origin/i);
  await assert.rejects(() => guard.canActivate(ctx({...session.req('POST'), headers: {origin: ORIGIN}})), /header/i);
  await assert.rejects(() => guard.canActivate(ctx({method: 'GET', headers: {}, cookies: {}})), /sign in/i);
});

/* ─────────────── account takeover and disclosure ─────────────── */

test("buying with someone else's email cannot reach their account, history or cards", async () => {
  const h = await harness();
  const owner = await activated(h, 'owner@example.invalid');
  const ownerBefore = {...(await h.db.customer.findUnique({where: {id: owner.customer.id}}))};
  const attack = await h.publicApi.checkout({customerName: 'Mallory', customerEmail: 'OWNER@example.invalid', customerPhone: '+1 555 0100', items: [{planSlug: 'community-membership'}], acceptRecurringTerms: true, acceptAccountTerms: true} as never);
  const order = await h.db.order.findUnique({where: {id: attack.orderId}});
  assert.notEqual(order.customerId, owner.customer.id, 'the purchase is not attached to the existing account');
  const shadow = await h.db.customer.findUnique({where: {id: order.customerId}});
  assert.equal(shadow.shadowState, 'PENDING_CLAIM');
  assert.equal(shadow.emailKey, null, 'a shadow row is never a sign-in identity');
  assert.notEqual(shadow.stripeCustomerId, ownerBefore.stripeCustomerId, "the attacker's card never lands on the owner's billing profile");
  const ownerAfter = await h.db.customer.findUnique({where: {id: owner.customer.id}});
  assert.equal(ownerAfter.name, ownerBefore.name, 'the owner profile is not overwritten');
  assert.equal(ownerAfter.phone, ownerBefore.phone);
  await h.webhooks.process(makeEvent('checkout.session.completed', {id: 'cs_attack', metadata: {orderId: order.id}, payment_status: 'paid'}) as never);
  const status = (await h.publicApi.orderStatus(order.id)) as any;
  assert.equal(status.account, 'check_email', 'identical to a brand-new buyer');
  assert.equal(status.detail, false);
  assert.equal(JSON.stringify(status).includes(owner.customer.id), false);
  assert.equal((await h.account.orders(owner.principal.id, {})).total, 1, 'the account does not show the unverified purchase');
  const claims = await h.account.claims(owner.principal.id);
  assert.equal(claims.purchases.length, 1);
  await h.account.declineClaim(owner.principal, shadow.id);
  assert.equal((await h.account.orders(owner.principal.id, {})).total, 1, 'a declined purchase never joins the account');
  assert.ok(h.db.supportRequest.rows.some((row: any) => row.type === 'CLAIM_DISPUTE'));
});

test('a verified owner can claim a guest purchase made while signed out', async () => {
  const h = await harness();
  const owner = await activated(h, 'owner@example.invalid');
  const guest = await h.publicApi.checkout({customerName: 'Owner', customerEmail: 'owner@example.invalid', items: [{planSlug: 'community-plus'}], acceptRecurringTerms: true, acceptAccountTerms: true} as never);
  const order = await h.db.order.findUnique({where: {id: guest.orderId}});
  await h.webhooks.process(makeEvent('checkout.session.completed', {id: 'cs_guest', metadata: {orderId: order.id}, payment_status: 'paid'}) as never);
  assert.ok(h.db.emailOutbox.rows.some((row: any) => row.template === 'claim_available'));
  const intruder = await activated(h, 'intruder@example.invalid');
  await rejectsWith(() => h.account.acceptClaim(intruder.principal, order.customerId), /Not Found/);
  await h.account.acceptClaim(owner.principal, order.customerId);
  assert.equal((await h.account.orders(owner.principal.id, {})).total, 2);
  await rejectsWith(() => h.account.acceptClaim(owner.principal, order.customerId), /Not Found/);
});

test('a signed-in checkout derives identity from the session and ignores the form email', async () => {
  const h = await harness();
  const owner = await activated(h, 'owner@example.invalid');
  const before = h.stripe.calls.filter(call => call.kind === 'customers.create').length;
  const result = await h.publicApi.checkout({customerName: 'Someone Else', customerEmail: 'other@example.invalid', items: [{planSlug: 'community-plus'}], acceptRecurringTerms: true, acceptAccountTerms: true} as never, owner.session.req() as never);
  const order = await h.db.order.findUnique({where: {id: result.orderId}});
  assert.equal(order.customerId, owner.customer.id);
  assert.equal(order.contactEmail, 'other@example.invalid', 'what was typed is kept as a snapshot only');
  assert.equal(h.stripe.calls.filter(call => call.kind === 'customers.create').length, before, 'no new Stripe customer');
  const session = h.stripe.calls.filter(call => call.kind === 'checkout.sessions.create').pop()!.input as any;
  assert.equal(session.saved_payment_method_options.payment_method_remove, 'disabled', 'Checkout cannot remove saved cards');
  await rejectsWith(() => h.publicApi.checkout({customerName: 'Owner', customerEmail: 'owner@example.invalid', items: [{planSlug: 'community-membership'}], acceptRecurringTerms: true, acceptAccountTerms: true} as never, owner.session.req() as never), /DUPLICATE_SUBSCRIPTION/);
  await rejectsWith(() => h.publicApi.checkout({customerName: 'X', customerEmail: 'x@example.invalid', items: [{planSlug: 'community-plus'}], acceptRecurringTerms: true, acceptAccountTerms: true} as never, {...owner.session.req(), headers: {origin: 'https://evil.example', 'x-wsj-csrf': '1'}} as never), /origin/i);
});

test('concurrent guest checkouts with one new email create one identity and one Stripe customer key', async () => {
  const h = await harness();
  const attempt = () => h.publicApi.checkout({customerName: 'Sam', customerEmail: 'sam@example.invalid', items: [{planSlug: 'community-membership'}], acceptRecurringTerms: true, acceptAccountTerms: true} as never);
  await Promise.all([attempt(), attempt(), attempt()]);
  assert.equal(h.db.customer.rows.filter((row: any) => row.email === 'sam@example.invalid').length, 1);
  /* Every Stripe create carries the same customer:<id> idempotency key, so Stripe returns one customer. */
  assert.equal(new Set(h.stripe.calls.filter(call => call.kind === 'customers.create').map(call => JSON.stringify((call.input as any).metadata))).size, 1);
});

test("the order status shows details only with the buyer's receipt proof, and no legacy token anywhere", async () => {
  const h = await harness();
  const {checkout, order} = await buy(h);
  const bare = (await h.publicApi.orderStatus(order.id)) as any;
  assert.equal(bare.detail, false);
  assert.equal(bare.items, undefined);
  const forged = (await h.publicApi.orderStatus(order.id, {headers: {'x-order-proof': 'forged.proof'}} as never)) as any;
  assert.equal(forged.detail, false);
  const other = await buy(h, 'other@example.invalid');
  const crossed = (await h.publicApi.orderStatus(order.id, {headers: {'x-order-proof': other.checkout.receiptProof}} as never)) as any;
  assert.equal(crossed.detail, false, 'a proof for one order opens no other order');
  const mine = (await h.publicApi.orderStatus(order.id, {headers: {'x-order-proof': checkout.receiptProof}} as never)) as any;
  assert.equal(mine.detail, true);
  assert.equal(mine.items.length, 1);
  for (const body of [bare, mine]) assert.equal(/token/i.test(JSON.stringify(Object.keys(body))), false);
  const retired = new RetiredPortalController();
  assert.throws(() => retired.root(), /no longer supported/);
  assert.throws(() => retired.rest(), /no longer supported/);
});

/* ─────────────── cards ─────────────── */

test('the last card cannot be removed; an extra card can, and foreign cards are invisible', async () => {
  const h = await harness();
  const {principal, customer} = await activated(h);
  const list = await h.cards.list(principal.id);
  assert.equal(list.profiles[0].cards.length, 1);
  const only = list.profiles[0].cards[0];
  assert.equal(only.isDefault, true, 'the checkout card became the default');
  await rejectsWith(() => h.cards.remove(principal.id, only.id, {}, actor(principal)), new RegExp(LAST_CARD_MESSAGE));
  assert.ok(h.stripe.methods.get(h.db.customerCard.rows[0].stripePaymentMethodId)!.customer, 'still attached at Stripe');

  h.stripe.addCard(customer.stripeCustomerId, {last4: '1881'});
  const extra = (await h.cards.list(principal.id)).profiles[0].cards.find(card => card.last4 === '1881')!;
  await h.cards.remove(principal.id, extra.id, {}, actor(principal));
  assert.equal((await h.cards.list(principal.id)).profiles[0].cards.length, 1);

  const stranger = await activated(h, 'stranger@example.invalid');
  const theirs = (await h.cards.list(stranger.principal.id)).profiles[0].cards[0];
  await rejectsWith(() => h.cards.remove(principal.id, theirs.id, {}, actor(principal)), /Not Found/);
  await rejectsWith(() => h.cards.setDefault(principal.id, theirs.id, {}, actor(principal)), /Not Found/);
});

test('two simultaneous removals can never delete every card', async () => {
  const h = await harness();
  const {principal, customer} = await activated(h);
  h.stripe.addCard(customer.stripeCustomerId, {last4: '0005'});
  const cards = (await h.cards.list(principal.id)).profiles[0].cards;
  assert.equal(cards.length, 2);
  const def = cards.find(card => card.isDefault)!;
  const other = cards.find(card => !card.isDefault)!;
  const results = await Promise.allSettled([h.cards.remove(principal.id, def.id, {replacementCardId: other.id}, actor(principal)), h.cards.remove(principal.id, other.id, {}, actor(principal))]);
  assert.equal(results.filter(result => result.status === 'fulfilled').length, 1, 'exactly one removal wins');
  assert.equal([...h.stripe.methods.values()].filter(method => method.customer === customer.stripeCustomerId).length, 1, 'one card always remains at Stripe');
});

test('removing the default card switches the customer and subscriptions first; a failed switch keeps the card', async () => {
  const h = await harness();
  const {principal, customer, stripeSub} = await activated(h);
  const replacementPm = h.stripe.addCard(customer.stripeCustomerId, {last4: '4444'});
  const listing = await h.cards.list(principal.id);
  const def = listing.profiles[0].cards.find(card => card.isDefault)!;
  const replacement = listing.profiles[0].cards.find(card => card.last4 === '4444')!;
  assert.equal(listing.profiles[0].affectedSubscriptions.length, 1, 'the UI is told which subscriptions a default change affects');

  h.stripe.failDefaultUpdate = true;
  await rejectsWith(() => h.cards.remove(principal.id, def.id, {replacementCardId: replacement.id}, actor(principal)), /nothing was removed/);
  assert.equal([...h.stripe.methods.values()].filter(method => method.customer === customer.stripeCustomerId).length, 2, 'the old card is still attached');

  h.stripe.failDefaultUpdate = false;
  await h.cards.remove(principal.id, def.id, {replacementCardId: replacement.id}, actor(principal));
  assert.equal(h.stripe.defaults.get(customer.stripeCustomerId), replacementPm);
  assert.equal(stripeSub.default_payment_method, replacementPm, 'the subscription bills the replacement');
});

test('a card added through a SetupIntent is verified against this customer, and 3-D Secure is reported, not assumed', async () => {
  const h = await harness();
  const {principal, customer} = await activated(h);
  const intent = await h.cards.createSetupIntent(principal.id);
  assert.ok(intent.clientSecret);
  h.stripe.setupIntents.get(intent.setupIntentId)!.status = 'requires_action';
  assert.equal((await h.cards.completeSetup(principal.id, {setupIntentId: intent.setupIntentId}, actor(principal))).added, false);
  const pm = h.stripe.addCard(customer.stripeCustomerId, {last4: '3155'});
  Object.assign(h.stripe.setupIntents.get(intent.setupIntentId)!, {status: 'succeeded', payment_method: pm});
  assert.equal((await h.cards.completeSetup(principal.id, {setupIntentId: intent.setupIntentId, makeDefault: true}, actor(principal))).added, true);
  assert.equal(h.stripe.defaults.get(customer.stripeCustomerId), pm);
  const stranger = await activated(h, 'stranger@example.invalid');
  const theirs = await h.cards.createSetupIntent(stranger.principal.id);
  await rejectsWith(() => h.cards.completeSetup(principal.id, {setupIntentId: theirs.setupIntentId}, actor(principal)), /Not Found/);
});

test('a card removed outside the app is detected and flagged, and access is kept', async () => {
  const h = await harness();
  const {principal, customer, subscription} = await activated(h);
  await h.cards.list(principal.id);
  for (const method of h.stripe.methods.values()) if (method.customer === customer.stripeCustomerId) method.customer = null;
  await h.webhooks.process(makeEvent('payment_method.detached', {id: 'pm_x', customer: null}, 'evt_detach') as never);
  await h.webhooks.process({...makeEvent('payment_method.detached', {id: 'pm_x', customer: null}, 'evt_detach_2'), data: {object: {id: 'pm_x', customer: null}, previous_attributes: {customer: customer.stripeCustomerId}}} as never);
  const stored = await h.db.customer.findUnique({where: {id: customer.id}});
  assert.equal(stored.cardStatus, 'MISSING');
  assert.ok(h.db.billingEvent.rows.some((row: any) => row.action === 'CARD_INVARIANT_BROKEN'));
  assert.equal(h.db.emailOutbox.rows.filter((row: any) => row.template === 'card_missing').length, 1);
  const overview = await h.account.overview(principal);
  assert.ok(overview.banners.some(banner => banner.type === 'card_missing'));
  assert.equal((await h.db.subscription.findUnique({where: {id: subscription.id}})).accessStatus, 'ACTIVE', 'paid access is not taken away');
});

/* ─────────────── plan changes ─────────────── */

test('an upgrade is previewed by Stripe, applied only after payment, and grants only the benefit difference', async () => {
  const h = await harness();
  const {principal, subscription} = await activated(h);
  const options = await h.plans.options(principal.id, subscription.id);
  assert.deepEqual(options.targets.map(target => [target.slug, target.kind]).sort(), [['community-annual', 'INTERVAL_CHANGE'], ['community-plus', 'UPGRADE']]);
  const preview = await h.plans.preview(principal.id, subscription.id, 'community-plus');
  assert.equal(preview.amountDueNow, h.stripe.previewAmount, "the amount comes from Stripe's invoice preview");
  assert.equal(preview.effective, 'IMMEDIATE');

  h.stripe.previewAmount = 1999;
  await rejectsWith(() => h.plans.confirm(principal.id, subscription.id, {targetSlug: 'community-plus', confirmToken: preview.confirmToken}, actor(principal)), /PREVIEW_CHANGED/);
  assert.equal((await h.db.subscription.findUnique({where: {id: subscription.id}})).planId, 'plan-monthly', 'nothing changed');

  const fresh = await h.plans.preview(principal.id, subscription.id, 'community-plus');
  const result = await h.plans.confirm(principal.id, subscription.id, {targetSlug: 'community-plus', confirmToken: fresh.confirmToken, idempotencyKey: 'upgrade-key-1'}, actor(principal));
  assert.equal(result.status, 'APPLIED');
  assert.equal((await h.db.subscription.findUnique({where: {id: subscription.id}})).planId, 'plan-plus');
  const extra = h.db.entitlementEntry.rows.filter((row: any) => row.sourceRef?.startsWith('upgrade:'));
  assert.equal(extra.length, 1);
  assert.equal(extra[0].delta, 7, '12 included minus the 5 already granted');
  const replay = await h.plans.confirm(principal.id, subscription.id, {targetSlug: 'community-plus', confirmToken: fresh.confirmToken, idempotencyKey: 'upgrade-key-1'}, actor(principal));
  assert.equal(replay.status, 'APPLIED', 'a replayed request returns the recorded result');
  assert.equal(h.stripe.calls.filter(call => call.kind === 'subscriptions.update' && (call.input as any).items).length, 1, 'Stripe was changed once');
});

test('an upgrade whose payment fails or needs authentication keeps the old plan and benefits', async () => {
  const h = await harness();
  const {principal, subscription} = await activated(h);
  h.stripe.upgradeNeedsAction = true;
  const preview = await h.plans.preview(principal.id, subscription.id, 'community-plus');
  const result = (await h.plans.confirm(principal.id, subscription.id, {targetSlug: 'community-plus', confirmToken: preview.confirmToken}, actor(principal))) as any;
  assert.equal(result.status, 'PENDING_PAYMENT');
  assert.ok(result.paymentUrl, 'the customer is sent to Stripe to finish payment or 3-D Secure');
  const stored = await h.db.subscription.findUnique({where: {id: subscription.id}});
  assert.equal(stored.planId, 'plan-monthly');
  assert.equal(stored.pendingUpdate, true);
  assert.equal(h.db.entitlementEntry.rows.filter((row: any) => row.sourceRef?.startsWith('upgrade:')).length, 0, 'no higher-tier benefit before payment');
  await rejectsWith(() => h.plans.preview(principal.id, subscription.id, 'community-annual'), /already pending/);
});

test('an interval change is scheduled for period end, can be withdrawn, and touches no other subscription', async () => {
  const h = await harness();
  const {principal, subscription, stripeSub, session} = await activated(h);
  const second = await buy(h, 'dana@example.invalid', 'community-plus', session);
  const preview = await h.plans.preview(principal.id, subscription.id, 'community-annual');
  assert.equal(preview.effective, 'PERIOD_END');
  assert.equal(preview.amountDueNow, 0);
  assert.equal(new Date(preview.effectiveAt!).getTime(), stripeSub.current_period_end * 1000, 'the provider period end, not a 30-day guess');
  const result = await h.plans.confirm(principal.id, subscription.id, {targetSlug: 'community-annual', confirmToken: preview.confirmToken}, actor(principal));
  assert.equal(result.status, 'SCHEDULED');
  assert.equal((await h.db.subscription.findUnique({where: {id: subscription.id}})).planId, 'plan-monthly', 'current plan continues until then');
  assert.equal((await h.db.subscription.findUnique({where: {id: second.subscription.id}})).stripeScheduleId ?? null, null, 'the other subscription is untouched');
  const withdrawn = await h.plans.withdraw(principal.id, subscription.id, actor(principal));
  assert.equal(withdrawn.status, 'WITHDRAWN');
  assert.ok(h.stripe.calls.some(call => call.kind === 'subscriptionSchedules.release'));
  const stranger = await activated(h, 'stranger@example.invalid');
  await rejectsWith(() => h.plans.preview(stranger.principal.id, subscription.id, 'community-plus'), /Not Found/);
});

/* ─────────────── account data ─────────────── */

test('profile edits sync to Stripe without rewriting past orders; support and closure stay safe', async () => {
  const h = await harness();
  const {principal, order} = await activated(h);
  const before = await h.db.order.findUnique({where: {id: order.id}});
  const updated = await h.account.updateProfile(principal, {name: 'Dana B. Renamed', phone: '+1 312 555 0101', company: 'Dana Co', billingAddress: {line1: '1 Main St', city: 'Chicago', state: 'IL', postalCode: '60601', country: 'us'}} as never);
  assert.equal(updated.displayName, 'Dana B. Renamed');
  assert.equal((updated.billingAddress as any).country, 'US');
  assert.equal((await h.db.order.findUnique({where: {id: order.id}})).contactName, before.contactName, 'the order keeps its checkout snapshot');
  assert.ok(h.stripe.calls.some(call => call.kind === 'customers.update' && (call.input as any).name === 'Dana B. Renamed'));
  const stranger = await activated(h, 'stranger@example.invalid');
  const supported = await h.account.support(principal, {type: 'SUPPORT', subject: 'Help please', message: 'A question about my plan', reference: stranger.order.id} as never);
  assert.equal(h.db.supportRequest.rows.find((row: any) => row.id === supported.id).reference, null, "a reference to someone else's order is dropped");
  const closure = await h.account.requestClosure(principal, {} as never);
  assert.equal(closure.activeSubscriptions.length, 1);
  assert.ok(h.db.subscription.rows.every((row: any) => row.accessStatus === 'ACTIVE' && !row.cancelAtPeriodEnd), 'closure cancels nothing');
});

test('expired benefit periods do not roll over and invoices are owner-only', async () => {
  const h = await harness();
  const {principal, customer, subscription} = await activated(h);
  await h.db.entitlementEntry.create({data: {customerId: customer.id, subscriptionId: subscription.id, kind: 'COWORKING_DAY', delta: 10, reason: 'Included benefit for the paid period', sourceRef: 'old-period', periodStart: new Date(Date.now() - 60 * 86400000), periodEnd: new Date(Date.now() - 30 * 86400000)}});
  const days = (await h.account.benefits(principal.id)).balances.find(row => row.kind === 'COWORKING_DAY')!;
  assert.equal(days.available, 0);
  assert.equal(days.expired, 10);
  const invoice = await h.db.invoice.create({data: {stripeInvoiceId: 'in_owned', customerId: customer.id, status: 'open', amountDue: 2900, amountRemaining: 2900, currency: 'usd', hostedUrl: ORIGIN + '/stripe-invoice/in_owned', pdfUrl: null}});
  const stranger = await activated(h, 'stranger@example.invalid');
  await rejectsWith(() => h.account.invoice(stranger.principal.id, invoice.id), /Not Found/);
  await rejectsWith(() => h.account.payInvoice(stranger.principal.id, invoice.id), /Not Found/);
  assert.equal((await h.account.invoice(principal.id, invoice.id)).payable, true);
  assert.equal((await h.account.invoices(principal.id, {limit: 1, page: 1} as never)).items.length, 1);
});

test("legacy bookings are linked only on the verified owner's request", async () => {
  const h = await harness();
  const {principal} = await activated(h);
  await h.db.booking.create({data: {serviceType: 'meeting-rooms', serviceName: 'Huddle Room', customerName: 'Dana', customerEmail: 'Dana@Example.invalid', bookingDate: '2099-03-04', bookingTime: '10:00 AM', status: 'CONFIRMED', guests: 2, duration: 2, subtotalPrice: 70, totalPrice: 70}});
  assert.equal((await h.account.bookings(principal.id)).upcoming.length, 0, 'not linked by email alone');
  assert.equal((await h.account.claims(principal.id)).legacyBookings, 1);
  assert.equal((await h.account.claimLegacyBookings(principal)).claimed, 1);
  const bookings = await h.account.bookings(principal.id);
  assert.equal(bookings.upcoming.length, 1);
  assert.equal(bookings.upcoming[0].start.toISOString(), '2099-03-04T16:00:00.000Z', '10:00 Central (CST) is 16:00 UTC');
  const ics = await h.account.bookingIcs(principal.id, bookings.upcoming[0].id);
  assert.match(ics, /DTSTART:20990304T160000Z/);
  assert.match(ics, /DTEND:20990304T180000Z/);
});

test('a package with a minimum term cannot have its renewal stopped until the term is covered', async () => {
  const h = await harness();
  const {principal, subscription} = await activated(h);
  /* Checkout stores the term on the subscription snapshot (the mailbox is sold with 3 months). */
  await h.db.subscription.update({where: {id: subscription.id}, data: {metadata: {...subscription.metadata, catalogPlan: {slug: 'mailbox-rental-30-days', name: 'Mailbox Rental', minimumTermMonths: 3}}}});

  const preview = await h.account.cancellationPreview(principal.id, subscription.id);
  assert.equal(preview.minimumTerm?.months, 3);
  assert.equal(preview.minimumTerm?.blocked, true);
  await rejectsWith(() => h.account.cancel(principal, subscription.id), /3-month minimum term/);
  assert.equal((await h.db.subscription.findUnique({where: {id: subscription.id}})).cancelAtPeriodEnd, false, 'nothing was scheduled');

  /* Once the paid period reaches the end of the term, the customer may stop renewal as usual. */
  const started = new Date();
  started.setUTCMonth(started.getUTCMonth() - 3);
  await h.db.subscription.update({where: {id: subscription.id}, data: {createdAt: started}});
  assert.equal((await h.account.cancellationPreview(principal.id, subscription.id)).minimumTerm?.blocked, false);
  const cancelled = await h.account.cancel(principal, subscription.id);
  assert.equal(cancelled.cancelAtPeriodEnd, true);
});
