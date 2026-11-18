/**
 * LOCAL account preview API. Never imported by the application.
 *
 * Runs the real NestJS app from source on a loopback port against an isolated
 * local database (wsj_account_qa) with the offline Stripe double from
 * test/billing-fixture.ts. Live Stripe keys from backend/.env are blanked
 * before anything loads, and every outbound non-loopback socket is refused,
 * so nothing can reach Stripe, SMTP or any other provider. Email goes to a
 * local capture directory.
 *
 * Usage (from backend/): node --import tsx scripts/qa-account-preview.ts
 * Seeded sign-in (test data only): PREVIEW_EMAIL / PREVIEW_PASSWORD below.
 */
import fs from 'node:fs';
import path from 'node:path';
import net from 'node:net';
import os from 'node:os';

export const PREVIEW_EMAIL = 'preview.member@example.test';
export const PREVIEW_PASSWORD = 'Preview-only-Junction-2026';
const PORT = Number(process.env.QA_PREVIEW_PORT || 4100);
const FRONTEND = process.env.QA_PREVIEW_FRONTEND || 'http://localhost:3100';

/* ── Fail closed before any module reads configuration ── */
const env = Object.fromEntries(
  fs
    .readFileSync(path.resolve(__dirname, '../.env'), 'utf8')
    .split(/\r?\n/)
    .filter(line => /^[A-Z_]+=/.test(line))
    .map(line => [line.slice(0, line.indexOf('=')), line.slice(line.indexOf('=') + 1).replace(/^['"]|['"]$/g, '')]),
);
const db = new URL(env.DATABASE_URL);
if (!['localhost', '127.0.0.1'].includes(db.hostname)) throw new Error('Local database required');
db.pathname = '/wsj_account_qa';
Object.assign(process.env, {
  DATABASE_URL: db.toString(),
  JWT_SECRET: env.JWT_SECRET,
  FRONTEND_URL: FRONTEND,
  FRONTEND_URLS: '',
  STRIPE_SECRET_KEY: '',
  STRIPE_PUBLISHABLE_KEY: '',
  STRIPE_WEBHOOK_SECRET: '',
  SMTP_HOST: '',
  NODE_ENV: 'development',
  MAIL_CAPTURE_DIR: process.env.MAIL_CAPTURE_DIR || path.join(os.tmpdir(), 'wsj-account-preview-mail'),
});
const connect = net.Socket.prototype.connect;
net.Socket.prototype.connect = function (this: net.Socket, ...args: unknown[]) {
  const first = Array.isArray(args[0]) ? (args[0] as unknown[])[0] : args[0];
  const host = first && typeof first === 'object' ? (first as {host?: string}).host : typeof args[1] === 'string' ? args[1] : 'localhost';
  if (host && !['localhost', '127.0.0.1', '::1'].includes(host)) throw new Error('QA_EXTERNAL_NETWORK_REFUSED');
  return (connect as (...input: unknown[]) => net.Socket).apply(this, args);
} as typeof net.Socket.prototype.connect;

async function main() {
  await import('reflect-metadata');
  const {Module} = await import('@nestjs/common');
  const {hash} = await import('bcryptjs');
  const {PrismaClient} = await import('@prisma/client');
  const {AppModule, createApplication} = await import('../src/application');
  const {PaymentClient} = await import('../src/payments');
  const {stripeFixture, makeStripeSubscription} = await import('../test/billing-fixture');

  const stripe = stripeFixture({origin: FRONTEND});
  const prisma = new PrismaClient();
  const now = Math.floor(Date.now() / 1000);
  const day = 86400;

  /* ── Seed sanitized test data (idempotent) ── */
  const plans = [
    {id: 'preview-plan-monthly', slug: 'community-membership', name: 'Community Membership', unitAmount: 2900, interval: 'MONTH' as const, credits: [{kind: 'MEETING_ROOM_HOUR', amount: 5, resetInterval: 'MONTH'}]},
    {id: 'preview-plan-plus', slug: 'community-plus', name: 'Community Plus', unitAmount: 4900, interval: 'MONTH' as const, credits: [{kind: 'MEETING_ROOM_HOUR', amount: 12, resetInterval: 'MONTH'}, {kind: 'COWORKING_DAY', amount: 4, resetInterval: 'MONTH'}]},
    {id: 'preview-plan-annual', slug: 'community-annual', name: 'Community Annual', unitAmount: 29000, interval: 'YEAR' as const, credits: [{kind: 'MEETING_ROOM_HOUR', amount: 5, resetInterval: 'MONTH'}]},
  ];
  for (const plan of plans) {
    await prisma.plan.upsert({
      where: {slug: plan.slug},
      update: {},
      create: {id: plan.id, slug: plan.slug, name: plan.name, serviceType: 'memberships', billingType: 'RECURRING', interval: plan.interval, unitAmount: plan.unitAmount, includedCredits: plan.credits},
    });
  }
  await prisma.plan.upsert({where: {slug: 'huddle-room-hour'}, update: {}, create: {id: 'preview-plan-room', slug: 'huddle-room-hour', name: 'Huddle Room', serviceType: 'meeting-rooms', billingType: 'ONE_TIME', unitAmount: 3500, pricingUnit: 'HOUR', maxQuantity: 8, requiresSchedule: true}});

  const stripeCustomerId = 'cus_preview_member';
  const customer = await prisma.customer.upsert({
    where: {emailKey: PREVIEW_EMAIL},
    update: {},
    create: {email: PREVIEW_EMAIL, emailKey: PREVIEW_EMAIL, name: 'Jordan Rivera', phone: '+1 630 555 0142', company: 'Rivera Studio', accountStatus: 'ACTIVE', emailVerifiedAt: new Date(), passwordHash: await hash(PREVIEW_PASSWORD, 12), passwordChangedAt: new Date(), stripeCustomerId, cardStatus: 'OK', accountTermsVersion: '2026-11-account-v1', accountTermsAcceptedAt: new Date(), cardConsentAt: new Date(), billingAddress: {line1: '1S280 Summit Ave', city: 'Oakbrook Terrace', state: 'IL', postalCode: '60181', country: 'US'}},
  });

  /* Cards live only in the Stripe double. */
  const primary = stripe.addCard(stripeCustomerId, {brand: 'visa', last4: '4242', exp_month: 8, exp_year: new Date().getUTCFullYear() + 2});
  stripe.addCard(stripeCustomerId, {brand: 'mastercard', last4: '5454', exp_month: new Date().getUTCMonth() + 1, exp_year: new Date().getUTCFullYear()});
  stripe.defaults.set(stripeCustomerId, primary);

  const stripeSub = makeStripeSubscription({id: 'sub_preview_member', customer: stripeCustomerId, unitAmount: 2900, periodStart: now - 9 * day, periodEnd: now + 21 * day, metadata: {customerId: customer.id}});
  stripeSub.default_payment_method = primary;
  stripe.subscriptions.set(stripeSub.id, stripeSub);

  const existing = await prisma.subscription.findUnique({where: {stripeSubscriptionId: stripeSub.id}});
  if (existing) {
    /* The double is in memory: re-align the stored item ids with this run's Stripe object. */
    await prisma.subscription.update({where: {id: existing.id}, data: {stripePriceId: stripeSub.items.data[0].price.id, stripeItemId: stripeSub.items.data[0].id, defaultPaymentMethodId: primary}});
  } else {
    const membershipOrder = await prisma.order.create({
      data: {
        customerId: customer.id, status: 'PAID', mode: 'SUBSCRIPTION', currency: 'usd', subtotalAmount: 2900, totalAmount: 2900, dueNowAmount: 2900, recurringAmount: 2900, recurringInterval: 'MONTH',
        contactName: 'Jordan Rivera', contactEmail: PREVIEW_EMAIL, paidAt: new Date((now - 39 * day) * 1000), createdAt: new Date((now - 39 * day) * 1000), termsVersion: '2026-11-recurring-v1', termsAcceptedAt: new Date((now - 39 * day) * 1000),
        items: {create: [{planId: 'preview-plan-monthly', description: 'Community Membership', quantity: 1, unitAmount: 2900, amount: 2900, billingType: 'RECURRING', interval: 'MONTH', metadata: {slug: 'community-membership', kind: 'PLAN', serviceType: 'memberships'}}]},
      },
    });
    const start = new Date(Date.now() + 6 * day * 1000);
    start.setUTCHours(15, 0, 0, 0);
    await prisma.order.create({
      data: {
        customerId: customer.id, status: 'PAID', mode: 'PAYMENT', currency: 'usd', subtotalAmount: 9500, totalAmount: 9500, dueNowAmount: 9500, contactName: 'Jordan Rivera', contactEmail: PREVIEW_EMAIL, paidAt: new Date((now - 2 * day) * 1000), createdAt: new Date((now - 2 * day) * 1000),
        metadata: {schedule: [{planSlug: 'huddle-room-hour', startAt: start.toISOString()}]},
        items: {create: [
          {planId: 'preview-plan-room', description: 'Huddle Room', quantity: 2, unitAmount: 3500, amount: 7000, billingType: 'ONE_TIME', metadata: {slug: 'huddle-room-hour', kind: 'PLAN', serviceType: 'meeting-rooms', billingUnit: 'PER_HOUR', units: 2}},
          {description: 'Presentation display', quantity: 1, unitAmount: 2500, amount: 2500, billingType: 'ONE_TIME', metadata: {slug: 'display', kind: 'ADDON', serviceType: 'meeting-rooms'}},
        ]},
      },
    });
    const sub = await prisma.subscription.create({
      data: {
        customerId: customer.id, orderId: membershipOrder.id, planId: 'preview-plan-monthly', stripeSubscriptionId: stripeSub.id, stripeCustomerId, stripePriceId: stripeSub.items.data[0].price.id, stripeItemId: stripeSub.items.data[0].id,
        interval: 'MONTH', unitAmount: 2900, currency: 'usd', stripeStatus: 'active', accessStatus: 'ACTIVE', currentPeriodStart: new Date((now - 9 * day) * 1000), currentPeriodEnd: new Date((now + 21 * day) * 1000), nextInvoiceAt: new Date((now + 21 * day) * 1000), defaultPaymentMethodId: primary,
      },
    });
    await prisma.entitlementEntry.create({data: {customerId: customer.id, subscriptionId: sub.id, kind: 'MEETING_ROOM_HOUR', delta: 5, reason: 'Included benefit for the paid period', sourceRef: 'preview-grant-current', periodStart: sub.currentPeriodStart, periodEnd: sub.currentPeriodEnd}});
    await prisma.entitlementEntry.create({data: {customerId: customer.id, subscriptionId: sub.id, kind: 'MEETING_ROOM_HOUR', delta: -2, reason: 'Used: huddle room', sourceRef: 'preview-use-1', periodStart: sub.currentPeriodStart, periodEnd: sub.currentPeriodEnd}});
    await prisma.invoice.create({data: {stripeInvoiceId: 'in_preview_paid', subscriptionId: sub.id, customerId: customer.id, number: 'WJ-0142-0001', status: 'paid', currency: 'usd', amountDue: 2900, amountPaid: 2900, total: 2900, subtotal: 2900, periodStart: new Date((now - 39 * day) * 1000), periodEnd: new Date((now - 9 * day) * 1000), createdAt: new Date((now - 39 * day) * 1000), lines: [{description: 'Community Membership', amount: 2900, quantity: 1}], hostedUrl: FRONTEND + '/stripe-invoice/in_preview_paid'}});
    await prisma.invoice.create({data: {stripeInvoiceId: 'in_preview_open', customerId: customer.id, number: 'WJ-0142-0002', status: 'open', currency: 'usd', amountDue: 4500, amountRemaining: 4500, total: 4500, subtotal: 4500, createdAt: new Date((now - 1 * day) * 1000), lines: [{description: 'Event space deposit', amount: 4500, quantity: 1}], hostedUrl: FRONTEND + '/stripe-invoice/in_preview_open'}});
  }
  stripe.invoices.set('in_preview_open', {id: 'in_preview_open', customer: stripeCustomerId, status: 'open', hosted_invoice_url: FRONTEND + '/stripe-invoice/in_preview_open', amount_due: 4500, amount_remaining: 4500});
  await prisma.$disconnect();

  /* ── Start the real application with the Stripe double ── */
  class PreviewModule {}
  Module({
    imports: Reflect.getMetadata('imports', AppModule),
    controllers: Reflect.getMetadata('controllers', AppModule),
    providers: (Reflect.getMetadata('providers', AppModule) as unknown[]).map(provider => (provider === PaymentClient ? {provide: PaymentClient, useValue: stripe} : provider)),
  })(PreviewModule);
  const app = await createApplication(PreviewModule);
  app.use((_req: unknown, res: {setHeader: (name: string, value: string) => void}, next: () => void) => {
    res.setHeader('X-QA-Payments', 'offline-fixture');
    next();
  });
  await app.listen(PORT, '127.0.0.1');
  console.log('[account-preview] ready on 127.0.0.1:' + PORT + ' (offline Stripe double, isolated database, mail captured locally)');
}

main().catch(error => {
  console.error('[account-preview] refused: ' + (error instanceof Error ? error.message : 'error'));
  process.exitCode = 1;
});
