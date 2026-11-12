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
    /* Compound unique keys such as customerId_kind_idempotencyKey: {customerId, kind, idempotencyKey}. */
    if (condition && typeof condition === 'object' && !(condition instanceof Date) && !(key in row) && key.includes('_') && !Array.isArray(condition)) {
      if (!matches(row, condition as Row, relations)) return false;
      continue;
    }
    if (condition && typeof condition === 'object' && !(condition instanceof Date)) {
      const rule = condition as Row;
      const time = (input: unknown) => new Date(input as string).getTime();
      const operators = ['in', 'not', 'lte', 'gte', 'lt', 'gt', 'contains', 'equals', 'mode'];
      if ('in' in rule && !rule.in.includes(value)) return false;
      if ('not' in rule && (rule.not && typeof rule.not === 'object' && !(rule.not instanceof Date) ? matches({v: value}, {v: rule.not}) : value === rule.not)) return false;
      if ('lte' in rule && !(value != null && time(value) <= time(rule.lte))) return false;
      if ('gte' in rule && !(value != null && time(value) >= time(rule.gte))) return false;
      if ('lt' in rule && !(value != null && time(value) < time(rule.lt))) return false;
      if ('gt' in rule && !(value != null && time(value) > time(rule.gt))) return false;
      if ('equals' in rule) {
        const insensitive = rule.mode === 'insensitive';
        if (insensitive ? String(value ?? '').toLowerCase() !== String(rule.equals).toLowerCase() : value !== rule.equals) return false;
      }
      if ('contains' in rule) {
        const haystack = String(value ?? '').toLowerCase();
        if (!haystack.includes(String(rule.contains).toLowerCase())) return false;
      }
      if (!Object.keys(rule).some(entry => operators.includes(entry))) {
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
    async findMany({where, include, take, skip, orderBy}: Row = {}) {
      let found = rows.filter(row => matches(row, where, api._includes));
      const order = Array.isArray(orderBy) ? orderBy[0] : orderBy;
      if (order && typeof order === 'object') {
        const [field, direction] = Object.entries(order)[0] as [string, string];
        if (typeof direction === 'string') {
          const sign = direction === 'desc' ? -1 : 1;
          const key = (input: unknown) => (input instanceof Date ? input.getTime() : (input as number | string | null) ?? 0);
          found = [...found].sort((a, b) => (key(a[field]) > key(b[field]) ? sign : key(a[field]) < key(b[field]) ? -sign : 0));
        }
      }
      const start = skip ?? 0;
      const sliced = found.slice(start, take ? start + take : undefined);
      return include ? sliced.map(row => api._withIncludes(row, include)) : sliced;
    },
    async updateMany({where, data}: Row) {
      const hit = rows.filter(row => matches(row, where, api._includes));
      for (const row of hit) {
        for (const [key, value] of Object.entries(data)) {
          if (value && typeof value === 'object' && 'increment' in (value as Row)) row[key] = (row[key] ?? 0) + (value as Row).increment;
          else row[key] = value;
        }
        row.updatedAt = new Date();
      }
      return {count: hit.length};
    },
    async count({where}: Row = {}) {
      return rows.filter(row => matches(row, where, api._includes)).length;
    },
    async update({where, data, include}: Row) {
      const row = rows.find(candidate => matches(candidate, where));
      if (!row) throw new Error('Record to update not found in ' + name);
      for (const key of uniqueKeys) {
        if (data[key] !== undefined && data[key] !== null && rows.some(other => other !== row && other[key] === data[key])) throw new Error('Unique constraint failed on ' + name + '.' + key);
      }
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
        let value = resolver ? resolver(row) : null;
        /* Nested {where} on a to-many include filters the related rows. */
        const nestedWhere = typeof include[key] === 'object' ? (include[key] as Row).where : undefined;
        if (Array.isArray(value) && nestedWhere) value = value.filter(entry => matches(entry as Row, nestedWhere));
        result[key] = value;
      }
      return result;
    },
  };
  return api;
}

export function fakeDb() {
  const plan = table('plan', ['slug']);
  /* Identity uniqueness lives on emailKey; shadow and collision rows share an email. */
  const customer = table('customer', ['emailKey', 'stripeCustomerId']);
  const customerSession = table('customerSession', ['tokenHash']);
  const customerToken = table('customerToken', ['tokenHash']);
  const customerCard = table('customerCard', ['stripePaymentMethodId']);
  const customerOperation = table('customerOperation');
  const emailOutbox = table('emailOutbox', ['dedupeKey']);
  const subscriptionChange = table('subscriptionChange');
  const stripePriceRef = table('stripePriceRef', ['key']);
  const supportRequest = table('supportRequest');
  const booking = table('booking');
  const catalogPlan = table('catalogPlan', ['slug']);
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

  customer._includes = {
    orders: (row: Row) => order.rows.filter(entry => entry.customerId === row.id).map(entry => order._withIncludes(entry, {items: true})),
  };
  customerSession._includes = {customer: (row: Row) => customer.rows.find(entry => entry.id === row.customerId) ?? null};
  /* Default field values Prisma would fill in, so code under test sees realistic rows. */
  const defaults = (target: ReturnType<typeof table>, values: Row) => {
    const create = target.create.bind(target);
    target.create = async (args: Row) => create({...args, data: {...values, ...args.data}});
  };
  defaults(customer, {name: '', phone: null, emailKey: null, accountStatus: 'GUEST', shadowState: null, mergedIntoId: null, passwordHash: null, emailVerifiedAt: null, failedLoginCount: 0, lockedUntil: null, cardStatus: 'UNKNOWN', marketingOptIn: false, notificationPrefs: {}, mutationLockToken: null, mutationLockUntil: null, stripeCustomerId: null, metadata: {}});
  defaults(customerSession, {method: 'PASSWORD', revokedAt: null, reauthAt: null, lastSeenAt: new Date()});
  defaults(customerToken, {usedAt: null, data: {}});
  defaults(customerCard, {isDefault: false, detachedAt: null});
  defaults(customerOperation, {status: 'STARTED', result: {}});
  defaults(emailOutbox, {status: 'PENDING', attempts: 0, nextAttemptAt: new Date(0), lockedUntil: null, customerId: null, dedupeKey: null});
  defaults(subscription, {pendingUpdate: false, stripeScheduleId: null, defaultPaymentMethodId: null, cancelAtPeriodEnd: false, metadata: {}});
  defaults(order, {metadata: {}});
  defaults(booking, {customerId: null});

  return {plan, customer, order, orderItem, subscription, invoice, billingEvent, entitlementEntry, webhookEvent, customerSession, customerToken, customerCard, customerOperation, emailOutbox, subscriptionChange, stripePriceRef, supportRequest, booking, catalogPlan} as any;
}

export interface StripeFixture extends PaymentClient {
  calls: Array<{kind: string; input?: unknown}>;
  subscriptions: Map<string, Row>;
  promotion: Row | null;
  failCheckout: boolean;
  /** Payment methods by id: {id, customer, card: {brand,last4,exp_month,exp_year}}. */
  methods: Map<string, Row>;
  /** Stripe customer id -> default payment method id. */
  defaults: Map<string, string | null>;
  setupIntents: Map<string, Row>;
  schedules: Map<string, Row>;
  invoices: Map<string, Row>;
  /** Test switches. */
  failDefaultUpdate: boolean;
  failDetach: boolean;
  previewAmount: number;
  /** Next subscription update leaves a pending_update (payment failed / needs 3-D Secure). */
  upgradeNeedsAction: boolean;
  /** Attach a card to a Stripe customer, as a completed SetupIntent or Checkout would. */
  addCard(customer: string, card?: Partial<{brand: string; last4: string; exp_month: number; exp_year: number}>): string;
}

/** Offline Stripe double. Subscriptions behave like Stripe's own state machine. */
export function stripeFixture(options: {origin?: string} = {}): StripeFixture {
  const origin = options.origin ?? 'http://localhost:3100';
  const calls: Array<{kind: string; input?: unknown}> = [];
  const subscriptions = new Map<string, Row>();
  const methods = new Map<string, Row>();
  const defaults = new Map<string, string | null>();
  const setupIntents = new Map<string, Row>();
  const schedules = new Map<string, Row>();
  const invoices = new Map<string, Row>();
  const fixture: StripeFixture = {
    calls,
    subscriptions,
    promotion: null,
    failCheckout: false,
    methods,
    defaults,
    setupIntents,
    schedules,
    invoices,
    failDefaultUpdate: false,
    failDetach: false,
    previewAmount: 1500,
    upgradeNeedsAction: false,
    addCard(customer, card = {}) {
      const id = nextId('pm');
      methods.set(id, {id, object: 'payment_method', customer, card: {brand: 'visa', last4: '4242', exp_month: 12, exp_year: new Date().getUTCFullYear() + 3, ...card}});
      return id;
    },
    client() {
      return {
        customers: {
          create: async (input: Row) => {
            calls.push({kind: 'customers.create', input});
            return {id: nextId('cus')};
          },
          retrieve: async (id: string) => {
            calls.push({kind: 'customers.retrieve', input: id});
            return {id, object: 'customer', invoice_settings: {default_payment_method: defaults.get(id) ?? null}};
          },
          update: async (id: string, input: Row) => {
            calls.push({kind: 'customers.update', input: {id, ...input}});
            const wanted = input.invoice_settings?.default_payment_method;
            if (wanted !== undefined) {
              if (fixture.failDefaultUpdate) throw new Error('fixture default update failure');
              if (wanted && methods.get(wanted)?.customer !== id) throw new Error('No such PaymentMethod for this customer');
              defaults.set(id, wanted);
            }
            return {id, invoice_settings: {default_payment_method: defaults.get(id) ?? null}};
          },
          listPaymentMethods: async (id: string) => {
            calls.push({kind: 'customers.listPaymentMethods', input: id});
            return {data: [...methods.values()].filter(method => method.customer === id)};
          },
          retrievePaymentMethod: async (customer: string, id: string) => {
            const method = methods.get(id);
            if (!method || method.customer !== customer) throw new Error('No such PaymentMethod');
            return method;
          },
        },
        paymentMethods: {
          detach: async (id: string) => {
            calls.push({kind: 'paymentMethods.detach', input: id});
            if (fixture.failDetach) throw new Error('fixture detach failure');
            const method = methods.get(id);
            if (!method?.customer) throw new Error('not attached');
            if (defaults.get(method.customer) === id) defaults.set(method.customer, null);
            method.customer = null;
            return method;
          },
        },
        setupIntents: {
          create: async (input: Row) => {
            calls.push({kind: 'setupIntents.create', input});
            const id = nextId('seti');
            const intent = {id, customer: input.customer, status: 'requires_payment_method', client_secret: id + '_secret_fixture', payment_method: null};
            setupIntents.set(id, intent);
            return intent;
          },
          retrieve: async (id: string) => {
            const intent = setupIntents.get(id);
            if (!intent) throw new Error('No such setup intent');
            return intent;
          },
        },
        prices: {
          create: async (input: Row) => {
            calls.push({kind: 'prices.create', input});
            return {id: nextId('price'), ...input};
          },
        },
        invoices: {
          createPreview: async (input: Row) => {
            calls.push({kind: 'invoices.createPreview', input});
            return {amount_due: fixture.previewAmount, subtotal: fixture.previewAmount, total: fixture.previewAmount, total_taxes: [], lines: {data: [{description: 'Remaining time on new plan', amount: fixture.previewAmount + 500}, {description: 'Unused time on old plan', amount: -500}]}};
          },
          retrieve: async (id: string) => {
            const invoice = invoices.get(id);
            if (!invoice) throw new Error('No such invoice');
            return invoice;
          },
        },
        subscriptionSchedules: {
          create: async (input: Row) => {
            calls.push({kind: 'subscriptionSchedules.create', input});
            const sub = subscriptions.get(input.from_subscription);
            if (!sub) throw new Error('No such subscription');
            const id = nextId('sub_sched');
            const item = sub.items.data[0];
            schedules.set(id, {id, subscription: sub.id, phases: [{start_date: sub.current_period_start, end_date: sub.current_period_end, items: [{price: item.price.id, quantity: item.quantity}]}]});
            sub.schedule = id;
            return schedules.get(id);
          },
          retrieve: async (id: string) => {
            const schedule = schedules.get(id);
            if (!schedule) throw new Error('No such schedule');
            return schedule;
          },
          update: async (id: string, input: Row) => {
            calls.push({kind: 'subscriptionSchedules.update', input: {id, ...input}});
            const schedule = schedules.get(id);
            if (!schedule) throw new Error('No such schedule');
            Object.assign(schedule, input);
            return schedule;
          },
          release: async (id: string) => {
            calls.push({kind: 'subscriptionSchedules.release', input: id});
            const schedule = schedules.get(id);
            if (!schedule) throw new Error('No such schedule');
            const sub = subscriptions.get(schedule.subscription);
            if (sub) sub.schedule = null;
            schedule.status = 'released';
            return schedule;
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
          update: async (id: string, input: Row, options?: Row) => {
            calls.push({kind: 'subscriptions.update', input: {id, ...input, idempotencyKey: options?.idempotencyKey}});
            const sub = subscriptions.get(id);
            if (!sub) throw new Error('No such subscription: ' + id);
            const {items, proration_behavior: _p, proration_date: _d, payment_behavior: behavior, ...rest} = input;
            if (Array.isArray(items)) {
              const invoiceId = nextId('in');
              const needsAction = fixture.upgradeNeedsAction && behavior === 'pending_if_incomplete';
              invoices.set(invoiceId, {id: invoiceId, customer: sub.customer, status: needsAction ? 'open' : 'paid', hosted_invoice_url: origin + '/stripe-invoice/' + invoiceId});
              sub.latest_invoice = invoiceId;
              if (needsAction) {
                /* Stripe keeps the old price in force and parks the change as a pending update. */
                sub.pending_update = {subscription_items: items, expires_at: Math.floor(Date.now() / 1000) + 82800};
              } else {
                for (const change of items) {
                  const target = sub.items.data.find((entry: Row) => entry.id === change.id);
                  if (target) target.price = {...target.price, id: change.price};
                }
                sub.pending_update = null;
              }
            }
            Object.assign(sub, rest);
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
