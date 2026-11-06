/**
 * QA helper: creates a local-only customer, order and subscription record so the
 * customer portal can be reviewed without touching Stripe, then prints a portal
 * link. Run with `--cleanup` to remove everything it created.
 *
 * It never contacts Stripe and never creates a real charge.
 */
import 'dotenv/config';
import {PrismaClient} from '@prisma/client';
import jwt from 'jsonwebtoken';

const db = new PrismaClient();
const EMAIL = 'qa-portal@example.invalid';

async function cleanup() {
  const customer = await db.customer.findUnique({where: {email: EMAIL}});
  if (!customer) return console.log('Nothing to clean up.');
  await db.entitlementEntry.deleteMany({where: {customerId: customer.id}});
  await db.billingEvent.deleteMany({where: {customerId: customer.id}});
  await db.invoice.deleteMany({where: {customerId: customer.id}});
  await db.subscription.deleteMany({where: {customerId: customer.id}});
  await db.orderItem.deleteMany({where: {order: {customerId: customer.id}}});
  await db.order.deleteMany({where: {customerId: customer.id}});
  await db.customer.delete({where: {id: customer.id}});
  console.log('QA portal fixture removed.');
}

async function main() {
  if (process.argv.includes('--cleanup')) return cleanup();
  const plan = await db.plan.findFirst({where: {billingType: 'RECURRING', active: true}, orderBy: {unitAmount: 'asc'}});
  if (!plan) throw new Error('No recurring plan available');
  const customer = await db.customer.upsert({where: {email: EMAIL}, update: {}, create: {email: EMAIL, name: 'QA Reviewer', stripeCustomerId: 'cus_qa_local_preview'}});
  const now = new Date();
  const periodEnd = new Date(now.getTime() + 30 * 86400000);
  const order = await db.order.create({
    data: {
      customerId: customer.id,
      status: 'PAID',
      mode: 'SUBSCRIPTION',
      currency: plan.currency,
      subtotalAmount: plan.unitAmount,
      totalAmount: plan.unitAmount,
      dueNowAmount: plan.unitAmount,
      recurringAmount: plan.unitAmount,
      recurringInterval: plan.interval,
      paidAt: now,
      items: {create: [{planId: plan.id, description: plan.name, quantity: 1, unitAmount: plan.unitAmount, amount: plan.unitAmount, billingType: 'RECURRING', interval: plan.interval}]},
    },
  });
  const subscription = await db.subscription.upsert({
    where: {stripeSubscriptionId: 'sub_qa_local_preview'},
    update: {},
    create: {
      customerId: customer.id,
      orderId: order.id,
      planId: plan.id,
      stripeSubscriptionId: 'sub_qa_local_preview',
      stripeCustomerId: 'cus_qa_local_preview',
      interval: plan.interval ?? 'MONTH',
      currency: plan.currency,
      unitAmount: plan.unitAmount,
      stripeStatus: 'active',
      accessStatus: 'ACTIVE',
      currentPeriodStart: now,
      currentPeriodEnd: periodEnd,
      nextInvoiceAt: periodEnd,
    },
  });
  await db.invoice.upsert({
    where: {stripeInvoiceId: 'in_qa_local_preview'},
    update: {},
    create: {stripeInvoiceId: 'in_qa_local_preview', subscriptionId: subscription.id, customerId: customer.id, amountDue: plan.unitAmount, amountPaid: plan.unitAmount, currency: plan.currency, status: 'paid', periodStart: now, periodEnd},
  });
  await db.entitlementEntry.upsert({
    where: {sourceRef: 'qa:preview:grant'},
    update: {},
    create: {customerId: customer.id, subscriptionId: subscription.id, kind: 'MEETING_ROOM_HOUR', delta: 5, reason: 'QA preview grant', sourceRef: 'qa:preview:grant', periodStart: now, periodEnd},
  });
  const token = jwt.sign({sub: customer.id, purpose: 'billing-portal'}, process.env.JWT_SECRET!, {expiresIn: '2h'});
  console.log('http://localhost:3000/account/?token=' + token);
}

main()
  .catch(error => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
