/**
 * Test doubles for the billing module.
 *
 * - `fakeDb()` is an in-memory stand-in for the Prisma methods the billing code
 *   uses, including the unique constraints that make webhooks and entitlement
 *   grants idempotent.
 * - `stripeFixture()` is an offline Stripe double that records every call. No
 *   test ever reaches the network, and no live key is read.
 */
import type {PaymentClient} from '../src/payments';

let counter = 0;
const nextId = (prefix: string) => prefix + '_' + (++counter).toString(36) + '_' + Date.now().toString(36);

type Row = Record<string, any>;

function matches(row: Row, where: Row | undefined, relations: Record<string, (row: Row) => unknown> = {}): boolean {
  if (!where) return true;
  for (const [key, condition] of Object.entries(where)) {
    if (key === 'OR') {
      if (!(condition as Row[]).some(clause => matches(row, clause, relations))) return false;
      continue;
    }
    if (key === 'AND') {
      if (!(condition as Row[]).every(clause => matches(row, clause, relations))) return false;
      continue;
    }
    /* Relation filters such as {customer: {email: {contains}}} resolve the related row. */
    if (relations[key]) {
      const related = relations[key](row) as Row | null;
      if (!related || !matches(related, condition as Row)) return false;
      continue;
    }
    const value = row[key];
    if (condition && typeof condition === 'object' && !(condition instanceof Date)) {
      const rule = condition as Row;
      if ('in' in rule && !rule.in.includes(value)) return false;
      if ('not' in rule && value === rule.not) return false;
      if ('lte' in rule && !(value && new Date(value).getTime() <= new Date(rule.lte).getTime())) return false;
      if ('gte' in rule && !(value && new Date(value).getTime() >= new Date(rule.gte).getTime())) return false;
      if ('contains' in rule) {
        const haystack = String(value ?? '').toLowerCase();
        if (!haystack.includes(String(rule.contains).toLowerCase())) return false;
      }
      if (!('in' in rule) && !('not' in rule) && !('lte' in rule) && !('gte' in rule) && !('contains' in rule)) {
        if (JSON.stringify(value) !== JSON.stringify(condition)) return false;
      }
      continue;
    }
    if (value !== condition) return false;
  }
  return true;
}

function table(name: string, uniqueKeys: string[] = []) {
  const rows: Row[] = [];
  const api = {
    rows,
    async create({data, include}: Row) {
      for (const key of uniqueKeys) {
        if (data[key] !== undefined && data[key] !== null && rows.some(row => row[key] === data[key])) {
          throw new Error('Unique constraint failed on ' + name + '.' + key);
        }
      }
      const nested = data.items?.create;
      const row: Row = {id: data.id ?? nextId(name), createdAt: new Date(), updatedAt: new Date(), ...data};
      delete row.items;
      rows.push(row);
      if (nested) {
        for (const item of nested) await (api as any)._children?.create({data: {...item, orderId: row.id}});
      }
      return include ? api._withIncludes(row, include) : row;
    },
    async findUnique({where, include}: Row) {
      const row = rows.find(candidate => matches(candidate, where, api._includes));
      return row ? (include ? api._withIncludes(row, include) : row) : null;
    },
    async findFirst({where, include}: Row) {
      const row = rows.find(candidate => matches(candidate, where, api._includes));
      return row ? (include ? api._withIncludes(row, include) : row) : null;
    },
    async findMany({where, include, take}: Row = {}) {
      const found = rows.filter(row => matches(row, where, api._includes));
      const sliced = take ? found.slice(0, take) : found;
      return include ? sliced.map(row => api._withIncludes(row, include)) : sliced;
    },
    async count({where}: Row = {}) {
      return rows.filter(row => matches(row, where, api._includes)).length;
    },
    async update({where, data, include}: Row) {
      const row = rows.find(candidate => matches(candidate, where));
      if (!row) throw new Error('Record to update not found in ' + name);
      for (const [key, value] of Object.entries(data)) {
        if (value && typeof value === 'object' && 'increment' in (value as Row)) row[key] = (row[key] ?? 0) + (value as Row).increment;
        else row[key] = value;
      }
      row.updatedAt = new Date();
      return include ? api._withIncludes(row, include) : row;
    },
    async upsert({where, create, update}: Row) {
      const row = rows.find(candidate => matches(candidate, where));
      if (row) return api.update({where, data: update});
      return api.create({data: {...where, ...create}});
    },
    async deleteMany({where}: Row = {}) {
      let count = 0;
      for (let index = rows.length - 1; index >= 0; index -= 1) {
        if (matches(rows[index], where)) {
          rows.splice(index, 1);
          count += 1;
        }
      }
      return {count};
    },
    _includes: {} as Record<string, (row: Row) => unknown>,
    _withIncludes(row: Row, include: Row) {
      const result: Row = {...row};
      for (const key of Object.keys(include)) {
        if (!include[key]) continue;
        const resolver = api._includes[key];
        result[key] = resolver ? resolver(row) : null;
      }
      return result;
    },
  };
  return api;
}

export function fakeDb() {
  const plan = table('plan', ['slug']);
  const customer = table('customer', ['email', 'stripeCustomerId']);
  const order = table('order', ['stripeCheckoutSessionId']);
  const orderItem = table('orderItem');
  const subscription = table('subscription', ['stripeSubscriptionId']);
  const invoice = table('invoice', ['stripeInvoiceId']);
  const billingEvent = table('billingEvent');
  const entitlementEntry = table('entitlementEntry', ['sourceRef']);
  const webhookEvent = table('webhookEvent', ['stripeEventId']);

  (order as any)._children = orderItem;
  order._includes = {
    items: (row: Row) => orderItem.rows.filter(item => item.orderId === row.id),
    customer: (row: Row) => customer.rows.find(entry => entry.id === row.customerId) ?? null,
    subscriptions: (row: Row) => subscription.rows.filter(sub => sub.orderId === row.id),
  };
  subscription._includes = {
    plan: (row: Row) => plan.rows.find(entry => entry.id === row.planId) ?? null,
    customer: (row: Row) => customer.rows.find(entry => entry.id === row.customerId) ?? null,
    invoices: (row: Row) => invoice.rows.filter(entry => entry.subscriptionId === row.id),
    events: (row: Row) => billingEvent.rows.filter(entry => entry.subscriptionId === row.id),
  };

  return {plan, customer, order, orderItem, subscription, invoice, billingEvent, entitlementEntry, webhookEvent} as any;
}

export interface StripeFixture extends PaymentClient {
  calls: Array<{kind: string; input?: unknown}>;
  subscriptions: Map<string, Row>;
  promotion: Row | null;
  failCheckout: boolean;
}

/** Offline Stripe double. Subscriptions behave like Stripe's own state machine. */
export function stripeFixture(options: {origin?: string} = {}): StripeFixture {
  const origin = options.origin ?? 'http://localhost:3100';
  const calls: Array<{kind: string; input?: unknown}> = [];
  const subscriptions = new Map<string, Row>();
  const fixture: StripeFixture = {
    calls,
    subscriptions,
    promotion: null,
    failCheckout: false,
    client() {
      return {
        customers: {
          create: async (input: Row) => {
            calls.push({kind: 'customers.create', input});
            return {id: nextId('cus')};
          },
        },
        promotionCodes: {
          list: async (input: Row) => {
            calls.push({kind: 'promotionCodes.list', input});
            return {data: fixture.promotion && fixture.promotion.code === input.code ? [fixture.promotion] : []};
          },
        },
        checkout: {
          sessions: {
            create: async (input: Row, options?: Row) => {
              calls.push({kind: 'checkout.sessions.create', input: {...input, idempotencyKey: options?.idempotencyKey}});
              if (fixture.failCheckout) throw new Error('fixture checkout failure');
              const id = nextId('cs');
              /* Embedded sessions return a client secret instead of a hosted URL. */
              if (input.ui_mode === 'embedded_page') return {id, url: null, client_secret: id + '_secret_fixture'};
              return {id, url: origin + '/booking-confirmation/?order=' + input.metadata.orderId};
            },
          },
        },
        subscriptions: {
          retrieve: async (id: string) => {
            calls.push({kind: 'subscriptions.retrieve', input: id});
            const sub = subscriptions.get(id);
            if (!sub) throw new Error('No such subscription: ' + id);
            return sub;
          },
          update: async (id: string, input: Row) => {
            calls.push({kind: 'subscriptions.update', input: {id, ...input}});
            const sub = subscriptions.get(id);
            if (!sub) throw new Error('No such subscription: ' + id);
            Object.assign(sub, input);
            if (input.cancel_at_period_end === true) sub.cancel_at = sub.current_period_end;
            if (input.cancel_at_period_end === false) sub.cancel_at = null;
            return sub;
          },
          cancel: async (id: string, input: Row) => {
            calls.push({kind: 'subscriptions.cancel', input: {id, ...input}});
            const sub = subscriptions.get(id);
            if (!sub) throw new Error('No such subscription: ' + id);
            sub.status = 'canceled';
            sub.ended_at = Math.floor(Date.now() / 1000);
            sub.cancel_at_period_end = false;
            return sub;
          },
        },
        billingPortal: {sessions: {create: async (input: Row) => {calls.push({kind: 'billingPortal', input}); return {url: origin + '/stripe-portal'};}}},
        refunds: {create: async (input: Row) => {calls.push({kind: 'refunds.create', input}); return {id: nextId('re')};}},
      } as never;
    },
  };
  return fixture;
}

/** Build a Stripe-shaped subscription object for the fixture. */
export function makeStripeSubscription(options: {id?: string; customer: string; status?: string; interval?: 'month' | 'year'; unitAmount?: number; periodStart?: number; periodEnd?: number; metadata?: Row; cancelAtPeriodEnd?: boolean}): Row {
  const now = Math.floor(Date.now() / 1000);
  const interval = options.interval ?? 'month';
  const periodStart = options.periodStart ?? now;
  const periodEnd = options.periodEnd ?? periodStart + (interval === 'year' ? 365 : 30) * 86400;
  return {
    id: options.id ?? nextId('sub'),
    object: 'subscription',
    customer: options.customer,
    status: options.status ?? 'active',
    cancel_at_period_end: options.cancelAtPeriodEnd ?? false,
    cancel_at: null,
    ended_at: null,
    current_period_start: periodStart,
    current_period_end: periodEnd,
    latest_invoice: nextId('in'),
    metadata: options.metadata ?? {},
    items: {data: [{id: nextId('si'), quantity: 1, current_period_start: periodStart, current_period_end: periodEnd, price: {id: nextId('price'), currency: 'usd', unit_amount: options.unitAmount ?? 5000, recurring: {interval, interval_count: 1}}}]},
  };
}

export function makeEvent(type: string, object: Row, id = nextId('evt')): Row {
  return {id, object: 'event', type, data: {object}};
}
