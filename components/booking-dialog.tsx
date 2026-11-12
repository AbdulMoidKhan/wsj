'use client';
/**
 * The site booking popup, driven entirely by the dynamic service catalog.
 *
 * Nothing in this file knows a service name, a package price, a billing
 * interval, an amenity list or an add-on cost. It reads them from
 * /public/catalog/* and the steps it shows are the steps the service itself
 * declares, so an administrator can add a service, change a price or switch a
 * booking flow without a code change.
 *
 * Every amount shown is confirmed by the server (/public/catalog/quote) before
 * payment, and checkout goes through /public/catalog/checkout, which recomputes
 * the price from the database and then creates the order and the Stripe
 * subscription or payment.
 *
 * If the catalog cannot be reached the popup falls back to its reservation
 * request behaviour and never implies a payment was taken.
 */
import {PUBLIC_API_URL} from '@/lib/public-api';
import {accountFetch, useCustomerSession} from '@/lib/account-client';
import {findCatalogServiceHint, findPlanHint} from '@/lib/catalog-service-hint';
import {blocksSameDayBooking} from '@/lib/booking-policy';
import './booking-dialog.css';
import {sendInquiry} from './forms';
import {useCallback, useEffect, useMemo, useReducer, useState, useRef, useId} from 'react';
import {useRouter} from 'next/navigation';
import Link from 'next/link';
import {
  AlertTriangle,
  Archive,
  Armchair,
  ArrowLeft,
  BookOpen,
  Briefcase,
  Building2,
  Camera,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Coffee,
  DoorOpen,
  Frame,
  Globe2,
  Handshake,
  HeartPulse,
  LayoutGrid,
  Lightbulb,
  Lock,
  Mail,
  Mic,
  Monitor,
  MonitorPlay,
  Package,
  PartyPopper,
  PenLine,
  Phone,
  Printer,
  Radio,
  ScrollText,
  Sparkles,
  Store,
  Ticket,
  Users,
  Utensils,
  Video,
  Wifi,
  Wrench,
  X,
} from 'lucide-react';

/* ── Catalog shapes, as served by the public API ── */
export type BillingUnit = 'ONE_TIME' | 'PER_HOUR' | 'PER_DAY' | 'PER_MONTH' | 'PER_YEAR' | 'PER_SESSION' | 'PER_ITEM' | 'PER_SETUP' | 'PER_BOOKING' | 'PER_PODCAST' | 'PER_CLIP' | 'CUSTOM';
type QuantityBasis = 'FLAT' | 'QUANTITY' | 'HOURS' | 'DAYS';
type FlowStep = 'service' | 'plan' | 'amenities' | 'extras' | 'schedule' | 'circle' | 'checkout';

export interface CatalogAmenity {
  slug: string;
  name: string;
  description: string;
  iconName: string;
  iconUrl: string | null;
}
export interface CatalogAddOn {
  slug: string;
  name: string;
  description: string;
  unitAmountCents: number;
  listPriceCents: number;
  currency: string;
  billingUnit: BillingUnit;
  unitLabel: string;
  quantityBasis: QuantityBasis;
  quantityNoun: string;
  billingType: 'ONE_TIME' | 'RECURRING';
  interval: 'MONTH' | 'YEAR' | null;
  minQuantity: number;
  maxQuantity: number;
  defaultQuantity: number;
  imageUrl: string | null;
  isRequired: boolean;
  sortOrder: number;
}
export interface CatalogPlan {
  slug: string;
  name: string;
  description: string;
  serviceSlug: string;
  unitAmountCents: number;
  currency: string;
  billingUnit: BillingUnit;
  unitLabel: string;
  quantityBasis: QuantityBasis;
  quantityNoun: string;
  billingType: 'ONE_TIME' | 'RECURRING';
  interval: 'MONTH' | 'YEAR' | null;
  intervalDescription: string;
  requiresSchedule: boolean;
  durationMinutes: number | null;
  durationDays: number | null;
  minQuantity: number;
  maxQuantity: number;
  capacityText: string | null;
  capacityMin: number | null;
  capacityMax: number | null;
  featured: boolean;
  sortOrder: number;
  rulesNotice: string | null;
  governmentNotice: string | null;
  metadata?: Record<string, unknown>;
  addOns: CatalogAddOn[];
  amenities: CatalogAmenity[];
}
export interface ServiceSummary {
  slug: string;
  name: string;
  description: string;
  categoryBadge: string | null;
  iconName: string;
  heroImageUrl: string | null;
  displayOrder: number;
  flowType: 'STANDARD' | 'NO_EXTRAS' | 'MEMBERSHIP' | 'CUSTOM';
  customSteps: string[];
  planCount: number;
  priceFromCents: number | null;
  currency: string;
  addOnCount: number;
  metadata?: Record<string, unknown>;
}
export interface ServiceDetail extends ServiceSummary {
  steps: FlowStep[];
  amenities: CatalogAmenity[];
  addOns: CatalogAddOn[];
  plans: CatalogPlan[];
  termsVersion: string | null;
}
interface Quote {
  currency: string;
  items: Array<{kind: 'PLAN' | 'ADDON'; slug: string; name: string; unitAmountCents: number; units: number; amount: number; billingUnit: BillingUnit; unitLabel: string; description: string}>;
  subtotalAmount: number;
  discountAmount: number;
  taxAmount: number;
  totalAmount: number;
  dueNowAmount: number;
  recurringAmount: number;
  recurringInterval: 'MONTH' | 'YEAR' | null;
  recurringDescription: string | null;
  discountDuration: 'once' | 'repeating' | 'forever' | null;
  discountDurationInMonths: number | null;
  notices: {rulesNotice: string | null; governmentNotice: string | null};
  termsVersion: string | null;
}

/* Icons are presentation only. The catalog stores a Lucide icon name; anything
   unknown falls back to a neutral glyph, so a new amenity never breaks a render. */
const ICONS: Record<string, typeof Check> = {
  Archive,
  Armchair,
  BookOpen,
  Briefcase,
  Building2,
  Camera,
  CalendarDays,
  Check,
  Coffee,
  DoorOpen,
  Frame,
  Globe2,
  Handshake,
  HeartPulse,
  LayoutGrid,
  Lightbulb,
  Lock,
  Mail,
  Mic,
  Monitor,
  MonitorPlay,
  Package,
  PartyPopper,
  PenLine,
  Phone,
  Printer,
  Radio,
  ScrollText,
  Sparkles,
  Store,
  Ticket,
  Users,
  Utensils,
  Video,
  Wifi,
  Wrench,
};
const icon = (name: string | null | undefined, fallback: typeof Check = Check) => (name && ICONS[name]) || fallback;

/** Used only when an administrator has not configured the circle list yet. */
const FALLBACK_CIRCLES = [
  'Community Circles',
  'Founder Circle',
  'Healthcare Entrepreneurs Circle',
  'Finance & Investment Circle',
  'Legal Professionals Circle',
  'Restaurant & Catering Owners Circle',
  'Tech Innovators Circle',
  'Marketing Leaders Circle',
];

const TIME_SLOTS = ['8:00 AM', '9:00 AM', '10:00 AM', '11:00 AM', '12:00 PM', '1:00 PM', '2:00 PM', '3:00 PM', '4:00 PM', '5:00 PM', '6:00 PM', '7:00 PM'];

/* Stripe.js is loaded from Stripe's own CDN, once per page, only when a payment
   actually starts. Embedded Checkout renders Stripe's hosted payment UI inside
   this dialog; card details go straight to Stripe and never touch our code. */
export interface EmbeddedCheckout {
  mount: (target: HTMLElement) => void;
  destroy: () => void;
}
type StripeFactory = (publishableKey: string) => {initEmbeddedCheckout: (options: {clientSecret: string}) => Promise<EmbeddedCheckout>};
declare global {
  interface Window {
    Stripe?: StripeFactory;
  }
}

let stripeJs: Promise<StripeFactory | null> | null = null;
function loadStripeJs(): Promise<StripeFactory | null> {
  if (typeof window === 'undefined') return Promise.resolve(null);
  if (window.Stripe) return Promise.resolve(window.Stripe);
  if (!stripeJs) {
    stripeJs = new Promise<StripeFactory | null>((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://js.stripe.com/v3/';
      script.async = true;
      script.onload = () => resolve(window.Stripe ?? null);
      script.onerror = () => {
        stripeJs = null;
        reject(new Error('Stripe could not be loaded'));
      };
      document.head.appendChild(script);
    });
  }
  return stripeJs;
}

function money(minor: number, currency = 'usd'): string {
  return (minor / 100).toLocaleString('en-US', {style: 'currency', currency: currency.toUpperCase(), maximumFractionDigits: minor % 100 === 0 ? 0 : 2});
}

/** 12-hour slot to 24-hour clock, used to build the reservation start instant. */
function to24(slot: string): string {
  const match = slot.match(/^(\d+):(\d+)\s*(AM|PM)$/i);
  if (!match) return '09:00';
  let hour = Number(match[1]) % 12;
  if (match[3].toUpperCase() === 'PM') hour += 12;
  return String(hour).padStart(2, '0') + ':' + match[2];
}

const basisNoun = (plan: CatalogPlan) => (plan.quantityBasis === 'HOURS' ? 'hours' : plan.quantityBasis === 'DAYS' ? 'days' : plan.quantityNoun || 'quantity');

/** Required add-ons start selected at their default quantity. */
function requiredAddOns(plan: CatalogPlan): Record<string, number> {
  const selection: Record<string, number> = {};
  for (const addOn of plan.addOns) if (addOn.isRequired) selection[addOn.slug] = Math.max(1, addOn.defaultQuantity || 1);
  return selection;
}

interface S {
  stepIndex: number;
  serviceSlug: string;
  planSlug: string;
  units: number;
  addOns: Record<string, number>;
  date: string;
  time: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  coupon: string;
  notes: string;
  circle: string;
  terms: boolean;
  /** Card purchases include a customer account and a saved card; this is that consent. */
  accountTerms: boolean;
  /** Separate, optional, never pre-ticked. */
  marketing: boolean;
  /** Signed-in buyer confirmed a second subscription to a plan they already have. */
  confirmExtra: boolean;
  duplicate: boolean;
  submitting: boolean;
  error: string;
}
type A =
  | {t: 'SET_SERVICE'; v: string}
  | {t: 'SET_PLAN'; v: string; units: number; addOns: Record<string, number>}
  | {t: 'SET_ADDON'; slug: string; quantity: number}
  | {t: 'SET_FIELD'; k: keyof S; v: unknown}
  | {t: 'NEXT'; max: number}
  | {t: 'BACK'}
  | {t: 'SUBMITTING'}
  | {t: 'ERROR'; v: string};

function init(): S {
  return {stepIndex: 0, serviceSlug: '', planSlug: '', units: 1, addOns: {}, date: '', time: '', email: '', firstName: '', lastName: '', phone: '', coupon: '', notes: '', circle: '', terms: false, accountTerms: false, marketing: false, confirmExtra: false, duplicate: false, submitting: false, error: ''};
}
function reducer(s: S, a: A): S {
  switch (a.t) {
    case 'SET_SERVICE':
      return {...s, serviceSlug: a.v, planSlug: '', addOns: {}, units: 1, date: '', time: ''};
    case 'SET_PLAN':
      return {...s, planSlug: a.v, units: a.units, addOns: a.addOns, date: '', time: ''};
    case 'SET_ADDON': {
      const next = {...s.addOns};
      if (a.quantity <= 0) delete next[a.slug];
      else next[a.slug] = a.quantity;
      return {...s, addOns: next};
    }
    case 'SET_FIELD':
      return {...s, [a.k]: a.v};
    case 'NEXT':
      return {...s, stepIndex: Math.min(s.stepIndex + 1, a.max), error: ''};
    case 'BACK':
      return {...s, stepIndex: Math.max(s.stepIndex - 1, 0), error: ''};
    case 'SUBMITTING':
      return {...s, submitting: true, error: ''};
    case 'ERROR':
      return {...s, submitting: false, error: a.v};
    default:
      return s;
  }
}

function CalendarPicker({selected, onChange, blockToday = false}: {selected: string; onChange: (d: string) => void; blockToday?: boolean}) {
  const today = new Date();
  const [yr, setYr] = useState(today.getFullYear());
  const [mo, setMo] = useState(today.getMonth());
  const firstDay = new Date(yr, mo, 1).getDay();
  const daysInMonth = new Date(yr, mo + 1, 0).getDate();
  const monthName = new Date(yr, mo).toLocaleString('default', {month: 'long', year: 'numeric'});
  const cells: Array<number | null> = Array(firstDay).fill(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  const prev = () => {
    if (mo === 0) {
      setMo(11);
      setYr(y => y - 1);
    } else setMo(m => m - 1);
  };
  const next = () => {
    if (mo === 11) {
      setMo(0);
      setYr(y => y + 1);
    } else setMo(m => m + 1);
  };
  const isPast = (d: number) => {
    const dt = new Date(yr, mo, d);
    dt.setHours(0, 0, 0, 0);
    const t = new Date();
    t.setHours(0, 0, 0, 0);
    if (blockToday) t.setDate(t.getDate() + 1);
    return dt < t;
  };
  const toStr = (d: number) => `${yr}-${String(mo + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  const isToday = (d: number) => d === today.getDate() && mo === today.getMonth() && yr === today.getFullYear();
  const DAY_NAMES = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
  return (
    <div className="bk-cal-card">
      <div className="bk-cal-nav">
        <button type="button" className="bk-cal-nav-btn" onClick={prev} aria-label="Previous month">
          <ChevronLeft size={16} aria-hidden="true" />
        </button>
        <span className="bk-cal-month">{monthName}</span>
        <button type="button" className="bk-cal-nav-btn" onClick={next} aria-label="Next month">
          <ChevronRight size={16} aria-hidden="true" />
        </button>
      </div>
      <div className="bk-cal-scroll" tabIndex={0} role="region" aria-label="Calendar dates, scroll horizontally on small screens">
        <div className="bk-cal-grid" key={`${yr}-${mo}`}>
          {DAY_NAMES.map(n => (
            <div key={n} className="bk-cal-day-name">
              {n}
            </div>
          ))}
          {cells.map((d, i) =>
            d === null ? (
              <div key={`e${i}`} className="bk-cal-day empty" />
            ) : (
              <button
                key={d}
                type="button"
                className={['bk-cal-day', isPast(d) ? 'past' : '', selected === toStr(d) ? 'selected' : '', isToday(d) && selected !== toStr(d) ? 'today' : ''].join(' ').trim()}
                disabled={isPast(d)}
                aria-label={new Date(yr, mo, d).toLocaleDateString(undefined, {dateStyle: 'full'})}
                aria-pressed={selected === toStr(d)}
                onClick={() => !isPast(d) && onChange(toStr(d))}
              >
                {d}
              </button>
            ),
          )}
        </div>
      </div>
    </div>
  );
}

export function BookingDialog({service, plan: preselectedPlan, onClose}: {service?: string; plan?: string; onClose: () => void}) {
  const [services, setServices] = useState<ServiceSummary[] | null>(null);
  /* Keyed by slug so a previous service's packages can never be shown for the
     one now selected, and so no effect has to clear state synchronously. */
  const [loadedDetail, setLoadedDetail] = useState<{slug: string; data: ServiceDetail} | null>(null);
  const [catalogError, setCatalogError] = useState(false);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [quoting, setQuoting] = useState(false);
  const [requestSent, setRequestSent] = useState(false);
  const [pay, setPay] = useState<{clientSecret: string; publishableKey: string} | null>(null);
  const [payReady, setPayReady] = useState(false);
  const [closing, setClosing] = useState(false);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const payMountRef = useRef<HTMLDivElement>(null);
  const embeddedRef = useRef<EmbeddedCheckout | null>(null);
  const [s, dispatch] = useReducer(reducer, undefined, init);
  const router = useRouter();
  const session = useCustomerSession();
  const signedIn = session.status === 'authenticated';

  /* A signed-in buyer starts from their own saved details. They stay editable as order contact
     details, but the server attaches the purchase to the signed-in account regardless. */
  const prefilled = useRef(false);
  useEffect(() => {
    if (!signedIn || prefilled.current) return;
    prefilled.current = true;
    accountFetch<{name?: string; email?: string; phone?: string | null}>('/account/profile')
      .then(profile => {
        const [first, ...rest] = String(profile.name ?? '').trim().split(/\s+/);
        if (profile.email) dispatch({t: 'SET_FIELD', k: 'email', v: profile.email});
        if (first) dispatch({t: 'SET_FIELD', k: 'firstName', v: first});
        if (rest.length) dispatch({t: 'SET_FIELD', k: 'lastName', v: rest.join(' ')});
        if (profile.phone) dispatch({t: 'SET_FIELD', k: 'phone', v: profile.phone});
      })
      .catch(() => undefined);
  }, [signedIn]);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const closeRef = useRef(onClose);
  const submittingRef = useRef(false);
  const titleId = useId();
  const requestClose = useCallback(() => {
    if (closeTimerRef.current) return;
    setClosing(true);
    closeTimerRef.current = setTimeout(onClose, 160);
  }, [onClose]);
  useEffect(() => {
    closeRef.current = requestClose;
    return () => {
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    };
  }, [requestClose]);

  /* 1. The live service list. A page CTA can preselect a service or package. */
  useEffect(() => {
    const controller = new AbortController();
    (async () => {
      try {
        const response = await fetch(PUBLIC_API_URL + '/public/catalog/services', {signal: controller.signal, cache: 'no-store'});
        if (!response.ok) throw new Error('catalog');
        const body = (await response.json()) as {items: ServiceSummary[]};
        const items = body.items ?? [];
        setServices(items);
        setCatalogError(false);

        let serviceSlug = '';
        if (preselectedPlan) {
          const planResponse = await fetch(PUBLIC_API_URL + '/public/catalog/plans/' + encodeURIComponent(preselectedPlan), {signal: controller.signal, cache: 'no-store'});
          if (planResponse.ok) {
            const planBody = (await planResponse.json()) as {serviceSlug?: string; service?: {slug: string}};
            serviceSlug = planBody.service?.slug || planBody.serviceSlug || '';
          }
        }
        if (!serviceSlug && service) {
          const match = findCatalogServiceHint(items, service);
          serviceSlug = match?.slug ?? '';
        }
        if (serviceSlug) dispatch({t: 'SET_SERVICE', v: serviceSlug});
      } catch (error) {
        if ((error as {name?: string})?.name !== 'AbortError') setCatalogError(true);
      }
    })();
    return () => controller.abort();
  }, [service, preselectedPlan]);

  /* 2. The selected service, with its packages, amenities, add-ons and steps. */
  useEffect(() => {
    const slug = s.serviceSlug;
    if (!slug) return;
    const controller = new AbortController();
    (async () => {
      try {
        const response = await fetch(PUBLIC_API_URL + '/public/catalog/services/' + encodeURIComponent(slug), {signal: controller.signal, cache: 'no-store'});
        if (!response.ok) throw new Error('service');
        const body = (await response.json()) as ServiceDetail;
        setLoadedDetail({slug, data: body});
        // An explicit package slug wins; otherwise a CTA labelled "Service - Package" may select
        // its package when that name is unique within the live service.
        const target = (preselectedPlan ? body.plans.find(entry => entry.slug === preselectedPlan) : undefined)
          ?? (!preselectedPlan && service ? findPlanHint(body.plans, service) : undefined);
        if (target) dispatch({t: 'SET_PLAN', v: target.slug, units: Math.max(1, target.minQuantity), addOns: requiredAddOns(target)});
      } catch (error) {
        if ((error as {name?: string})?.name !== 'AbortError') setCatalogError(true);
      }
    })();
    return () => controller.abort();
  }, [s.serviceSlug, preselectedPlan, service]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const body = document.body;
    const root = document.documentElement;
    const scrollX = window.scrollX,
      scrollY = window.scrollY;
    const saved = {overflow: body.style.overflow, position: body.style.position, top: body.style.top, left: body.style.left, width: body.style.width, paddingRight: body.style.paddingRight, rootOverflow: root.style.overflow};
    const gutter = window.innerWidth - root.clientWidth;
    if (gutter > 0) body.style.paddingRight = parseFloat(getComputedStyle(body).paddingRight) + gutter + 'px';
    body.style.overflow = 'hidden';
    body.style.position = 'fixed';
    body.style.top = -scrollY + 'px';
    body.style.left = -scrollX + 'px';
    body.style.width = '100%';
    root.style.overflow = 'hidden';
    dialog.showModal();
    const trap = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;
      const targets = Array.from(dialog.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), select:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])')).filter(el => el.getClientRects().length > 0);
      const first = targets[0],
        last = targets[targets.length - 1];
      if (!first) {
        event.preventDefault();
        dialog.focus();
        return;
      }
      if (event.shiftKey && (document.activeElement === first || !targets.includes(document.activeElement as HTMLElement))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || !targets.includes(document.activeElement as HTMLElement))) {
        event.preventDefault();
        first.focus();
      }
    };
    dialog.addEventListener('keydown', trap);
    return () => {
      dialog.removeEventListener('keydown', trap);
      dialog.close();
      Object.assign(body.style, {overflow: saved.overflow, position: saved.position, top: saved.top, left: saved.left, width: saved.width, paddingRight: saved.paddingRight});
      root.style.overflow = saved.rootOverflow;
      const behavior = root.style.scrollBehavior;
      root.style.scrollBehavior = 'auto';
      window.scrollTo({left: scrollX, top: scrollY, behavior: 'instant'});
      root.style.scrollBehavior = behavior;
      if (trigger?.isConnected) trigger.focus({preventScroll: true});
    };
  }, []);

  const detail = loadedDetail && loadedDetail.slug === s.serviceSlug ? loadedDetail.data : null;
  const detailLoading = Boolean(s.serviceSlug) && !detail && !catalogError;
  const plan = useMemo(() => detail?.plans.find(entry => entry.slug === s.planSlug) ?? null, [detail, s.planSlug]);
  const currency = plan?.currency ?? detail?.currency ?? 'usd';
  /* Package-level attachments win over the service library, exactly as the
     server resolves them when it prices the selection. */
  const availableAddOns = useMemo<CatalogAddOn[]>(() => (plan ? plan.addOns : detail?.addOns ?? []), [plan, detail]);
  const amenities = useMemo<CatalogAmenity[]>(() => (plan?.amenities.length ? plan.amenities : detail?.amenities ?? []), [plan, detail]);
  const circles = useMemo<string[]>(() => {
    const configured = detail?.metadata?.circles;
    return Array.isArray(configured) && configured.length ? configured.map(String) : FALLBACK_CIRCLES;
  }, [detail]);
  /* Validity rules are per package; the service shows every distinct rule once. */
  const serviceRules = useMemo(() => [...new Set((detail?.plans ?? []).map(entry => entry.rulesNotice).filter((value): value is string => Boolean(value)))], [detail]);

  /* The steps a service declares, minus the ones that have nothing to show. */
  const steps = useMemo<Array<FlowStep | 'pay'>>(() => {
    const declared = detail?.steps?.length ? detail.steps : (['service', 'plan', 'checkout'] as FlowStep[]);
    const list = declared.filter(entry => {
      if (entry === 'amenities') return amenities.length > 0;
      if (entry === 'extras') return availableAddOns.length > 0;
      if (entry === 'schedule') return plan ? plan.requiresSchedule : true;
      return true;
    });
    if (!list.includes('service')) list.unshift('service');
    if (!list.includes('checkout')) list.push('checkout');
    return pay ? [...list, 'pay'] : list;
  }, [detail, amenities.length, availableAddOns.length, plan, pay]);

  /* While a payment session is open the dialog stays on the payment step. */
  const stepIndex = pay ? steps.length - 1 : Math.min(s.stepIndex, steps.length - 1);
  const step = steps[stepIndex];
  const STEP_TITLES: Record<string, string> = {service: 'Choose a service', plan: 'Select your package', amenities: "What's included", extras: 'Optional extras', schedule: 'Pick a date & time', circle: 'Choose your Circle', checkout: 'Review & pay', pay: 'Secure payment'};
  const STEP_HINTS: Record<string, string> = {
    service: 'Pick what you need. Every service below is live from our catalogue.',
    plan: 'Prices are set by us, confirmed by our server, and never change in your browser.',
    amenities: 'Everything these packages include as standard.',
    extras: 'Optional extras you can add to this purchase.',
    schedule: 'Choose when you would like the space. Times are Central.',
    circle: 'Your membership includes one professional Circle.',
    checkout: 'Check the details, then pay securely with Stripe.',
    pay: 'Card details go straight to Stripe. We never see or store them.',
  };
  const STEP_LABELS: Record<string, string> = {service: 'Service', plan: 'Package', amenities: 'Included', extras: 'Extras', schedule: 'Date & Time', circle: 'Circle', checkout: 'Review', pay: 'Payment'};

  useEffect(() => {
    titleRef.current?.focus({preventScroll: true});
    formRef.current?.scrollTo({top: 0, behavior: 'instant'});
  }, [stepIndex]);

  /* Mount Stripe's embedded payment form once a checkout session exists. */
  useEffect(() => {
    if (step !== 'pay' || !pay) return;
    let cancelled = false;
    (async () => {
      try {
        const target = payMountRef.current;
        if (!target) return;
        const Stripe = await loadStripeJs();
        if (!Stripe) throw new Error('Stripe could not be loaded');
        if (!pay.publishableKey) throw new Error('Payments are not configured. Please contact our team.');
        const instance = await Stripe(pay.publishableKey).initEmbeddedCheckout({clientSecret: pay.clientSecret});
        if (cancelled) {
          instance.destroy();
          return;
        }
        instance.mount(target);
        embeddedRef.current = instance;
        setPayReady(true);
      } catch (error) {
        if (!cancelled) dispatch({t: 'ERROR', v: error instanceof Error ? error.message : 'We could not open the secure payment form.'});
      }
    })();
    return () => {
      cancelled = true;
      try {
        embeddedRef.current?.destroy();
      } catch {}
      embeddedRef.current = null;
    };
  }, [step, pay]);

  /** Abandon the open payment session and return to the review step. */
  function cancelPayment() {
    try {
      embeddedRef.current?.destroy();
    } catch {}
    embeddedRef.current = null;
    setPayReady(false);
    setPay(null);
    submittingRef.current = false;
    dispatch({t: 'ERROR', v: ''});
  }

  const selectedAddOns = useMemo(() => availableAddOns.filter(addOn => (s.addOns[addOn.slug] ?? 0) > 0), [availableAddOns, s.addOns]);
  /* Each add-on uses its own selected units. Package hours/days must not
     silently replace an independently selected extension or item quantity. */
  const addOnUnits = useCallback(
    (addOn: CatalogAddOn) => {
      const requested = s.addOns[addOn.slug] ?? 0;
      if (requested <= 0) return 0;
      return requested;
    },
    [s.addOns],
  );

  /* Local preview only. The payable figure always comes from the server. */
  const localDueNow = (plan ? plan.unitAmountCents * s.units : 0) + selectedAddOns.reduce((sum, addOn) => sum + addOn.unitAmountCents * addOnUnits(addOn), 0);
  const localRecurring =
    (plan?.billingType === 'RECURRING' ? plan.unitAmountCents * s.units : 0) + selectedAddOns.filter(addOn => addOn.billingType === 'RECURRING').reduce((sum, addOn) => sum + addOn.unitAmountCents * addOnUnits(addOn), 0);
  const recurringPlan = plan?.billingType === 'RECURRING' || selectedAddOns.some(addOn => addOn.billingType === 'RECURRING');

  const selectionBody = useCallback(() => {
    const payload: Record<string, unknown> = {planSlug: s.planSlug, addOns: selectedAddOns.map(addOn => ({slug: addOn.slug, quantity: addOnUnits(addOn)}))};
    if (plan?.quantityBasis === 'HOURS') payload.durationHours = s.units;
    else if (plan?.quantityBasis === 'DAYS') payload.days = s.units;
    else if (s.units > 1) payload.quantity = s.units;
    if (s.coupon.trim()) payload.couponCode = s.coupon.trim();
    return payload;
  }, [s.planSlug, s.units, s.coupon, selectedAddOns, addOnUnits, plan]);

  /** Server-confirmed price. Nothing in this dialog can change what is charged. */
  const refreshQuote = useCallback(async () => {
    if (!plan) return;
    setQuoting(true);
    try {
      const response = await fetch(PUBLIC_API_URL + '/public/catalog/quote', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(selectionBody())});
      const body = await response.json();
      if (!response.ok) throw new Error(Array.isArray(body?.message) ? body.message.join(' ') : body?.message || 'We could not price this selection.');
      setQuote(body as Quote);
      dispatch({t: 'ERROR', v: ''});
    } catch (error) {
      setQuote(null);
      dispatch({t: 'ERROR', v: error instanceof Error ? error.message : 'We could not price this selection.'});
    } finally {
      setQuoting(false);
    }
  }, [plan, selectionBody]);

  const selectPlan = (entry: CatalogPlan) => {
    dispatch({t: 'SET_PLAN', v: entry.slug, units: Math.max(1, entry.minQuantity), addOns: requiredAddOns(entry)});
    setQuote(null);
  };

  const canNext = () => {
    if (step === 'service') return Boolean(s.serviceSlug);
    if (step === 'plan') return Boolean(s.planSlug) || catalogError || (detail?.plans.length ?? 0) === 0;
    if (step === 'schedule') return Boolean(s.date && s.time);
    if (step === 'circle') return Boolean(s.circle);
    return true;
  };

  const requestMode = !plan;

  async function submit() {
    if (submittingRef.current) return;
    const customerName = (s.firstName.trim() + ' ' + s.lastName.trim()).trim();
    if (!s.firstName.trim() || !s.lastName.trim() || customerName.length > 200 || !s.email.trim() || !formRef.current?.reportValidity()) {
      dispatch({t: 'ERROR', v: 'Enter your first name, last name, and a valid email address.'});
      return;
    }
    if (!s.terms) {
      dispatch({t: 'ERROR', v: recurringPlan ? 'Please accept the terms and the recurring billing notice to continue.' : 'Please accept the Terms of Use to continue.'});
      return;
    }
    if (plan && !signedIn && !s.accountTerms) {
      dispatch({t: 'ERROR', v: 'Please confirm the customer account and saved card to continue.'});
      return;
    }
    if (plan?.requiresSchedule) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(s.date) || new Date(s.date + 'T00:00:00') < today || !TIME_SLOTS.includes(s.time)) {
        dispatch({t: 'ERROR', v: 'Please go back and choose a current or future date and time.'});
        return;
      }
    }
    submittingRef.current = true;
    dispatch({t: 'SUBMITTING'});

    if (requestMode) {
      const serviceName = detail?.name || s.serviceSlug || 'General';
      try {
        await sendInquiry({
          name: customerName,
          email: s.email.trim(),
          phone: s.phone.trim(),
          service: serviceName,
          message: 'Booking request. Service: ' + serviceName + (s.date ? '. Preferred date: ' + s.date + ' at ' + s.time : '') + (s.notes.trim() ? ' Notes: ' + s.notes.trim() : ''),
          website: '',
        });
        setRequestSent(true);
      } catch (error) {
        dispatch({t: 'ERROR', v: error instanceof Error ? error.message : 'We could not send your request. Please call (773) 986-1908.'});
      }
      submittingRef.current = false;
      return;
    }

    try {
      const startAt = plan?.requiresSchedule && s.date && s.time ? new Date(s.date + 'T' + to24(s.time) + ':00').toISOString() : undefined;
      const response = await fetch(PUBLIC_API_URL + '/public/catalog/checkout', {
        method: 'POST',
        credentials: 'same-origin',
        /* The header lets a signed-in checkout pass the API's cross-site request check. */
        headers: {'Content-Type': 'application/json', 'X-WSJ-CSRF': '1'},
        body: JSON.stringify({
          ...selectionBody(),
          customerName,
          customerEmail: s.email.trim(),
          ...(s.phone.trim() ? {customerPhone: s.phone.trim()} : {}),
          ...(startAt ? {startAt} : {}),
          ...(s.circle.trim() ? {membershipCircle: s.circle.trim()} : {}),
          ...(s.notes.trim() ? {notes: s.notes.trim()} : {}),
          ...(recurringPlan ? {acceptRecurringTerms: true} : {}),
          /* A signed-in account already agreed to the account terms when it was created. */
          acceptAccountTerms: signedIn || s.accountTerms,
          marketingOptIn: s.marketing,
          ...(s.confirmExtra ? {confirmAdditionalSubscription: true} : {}),
          embedded: true,
        }),
      });
      const body = await response.json();
      if (response.status === 409 && body?.code === 'DUPLICATE_SUBSCRIPTION') {
        dispatch({t: 'SET_FIELD', k: 'duplicate', v: true});
        dispatch({t: 'ERROR', v: body.message});
        submittingRef.current = false;
        return;
      }
      if (!response.ok) throw new Error(Array.isArray(body?.message) ? body.message.join(' ') : body?.message || 'Checkout could not be started. Please try again.');
      /* Lets this browser, and only this one, see the itemised receipt for this one order. */
      try {
        if (body.receiptProof && body.orderId) sessionStorage.setItem('wsj-receipt:' + body.orderId, body.receiptProof);
      } catch {
        /* Storage blocked: the confirmation page still shows the payment state. */
      }
      /* Preferred path: Stripe's payment form opens inside this dialog. */
      if (body.clientSecret) {
        setPay({clientSecret: body.clientSecret, publishableKey: body.publishableKey || ''});
        dispatch({t: 'ERROR', v: ''});
        submittingRef.current = false;
        return;
      }
      /* Fallback: Stripe's hosted page is an external destination. */
      if (body.checkoutUrl) {
        window.location.href = body.checkoutUrl;
        return;
      }
      router.push('/booking-confirmation/?order=' + encodeURIComponent(body.orderId));
    } catch (error) {
      dispatch({t: 'ERROR', v: error instanceof Error ? error.message : 'Something went wrong. Please try again.'});
      submittingRef.current = false;
    }
  }

  const progress = ((stepIndex + 1) / steps.length) * 100;
  const dueNow = quote ? quote.dueNowAmount : localDueNow;
  const recurring = quote ? quote.recurringAmount : localRecurring;

  return (
    <dialog
      ref={dialogRef}
      className={'bk-overlay' + (closing ? ' is-closing' : '')}
      aria-modal="true"
      aria-labelledby={titleId}
      data-lenis-prevent
      onCancel={e => {
        e.preventDefault();
        closeRef.current();
      }}
      onClick={e => {
        if (e.target === e.currentTarget) requestClose();
      }}
    >
      <div className="bk-modal">
        <header className="bk-header">
          <div className="bk-header-top">
            <span className="bk-brand">
              <span className="bk-brand-mark">WJ</span>Workspace Junction
            </span>
            <button type="button" className="bk-close" onClick={requestClose} aria-label="Close">
              <X size={18} aria-hidden="true" />
            </button>
          </div>
          <ol className="bk-stepper" aria-label="Checkout steps">
            {steps.map((entry, index) => (
              <li key={entry} className={'bk-stepper-item' + (index === stepIndex ? ' is-current' : '') + (index < stepIndex ? ' is-done' : '')} aria-current={index === stepIndex ? 'step' : undefined}>
                <span className="bk-stepper-dot" aria-hidden="true">
                  {index < stepIndex ? <Check size={13} strokeWidth={3} /> : index + 1}
                </span>
                <span className="bk-stepper-label">{STEP_LABELS[entry]}</span>
              </li>
            ))}
          </ol>
          <div className="bk-headline">
            {stepIndex > 0 && (
              <button type="button" className="bk-back" disabled={s.submitting && step !== 'pay'} onClick={() => (step === 'pay' ? cancelPayment() : dispatch({t: 'BACK'}))} aria-label={step === 'pay' ? 'Cancel payment and go back' : 'Go back'}>
                <ArrowLeft size={17} aria-hidden="true" />
              </button>
            )}
            <div className="bk-header-info">
              <h2 className="bk-title" id={titleId} ref={titleRef} tabIndex={-1}>
                {STEP_TITLES[step]}
              </h2>
              <p className="bk-subtitle">{STEP_HINTS[step]}</p>
            </div>
          </div>
        </header>
        <div className="bk-progress" role="progressbar" aria-label="Checkout progress" aria-valuenow={stepIndex + 1} aria-valuemin={1} aria-valuemax={steps.length}>
          <div className="bk-progress-fill" style={{width: progress + '%'}} />
        </div>
        <div className="bk-layout">
          <form
            ref={formRef}
            className="bk-body"
            data-lenis-prevent
            aria-busy={s.submitting}
            onSubmit={e => {
              e.preventDefault();
              if (step === 'checkout') void submit();
            }}
          >
            {catalogError && (
              <div className="bk-fallback-banner" role="status">
                <p>
                  <strong>Note:</strong> Our live service catalogue is refreshing, so payment is unavailable right now. You can still send a reservation request below, or call us at (773) 986-1908.
                </p>
              </div>
            )}
            {!services && !catalogError && (
              <p className="bk-step-label" role="status">
                Loading current services&hellip;
              </p>
            )}

            <div className="bk-step-content" key={step}>
              {step === 'service' && (
                <div className="bk-type-grid">
                  {(services ?? []).map(entry => {
                    const Icon = icon(entry.iconName, Briefcase);
                    return (
                      <button
                        key={entry.slug}
                        type="button"
                        aria-pressed={s.serviceSlug === entry.slug}
                        className={'bk-type-card' + (s.serviceSlug === entry.slug ? ' selected' : '')}
                        onClick={() => {
                          dispatch({t: 'SET_SERVICE', v: entry.slug});
                          setQuote(null);
                        }}
                      >
                        <span className="bk-type-icon">
                          <Icon size={28} strokeWidth={1.8} aria-hidden="true" />
                        </span>
                        <span className="bk-type-name">{entry.name}</span>
                        {entry.priceFromCents !== null && <span className="bk-type-price">from {money(entry.priceFromCents, entry.currency)}</span>}
                        {entry.categoryBadge && <span className="bk-type-badge">{entry.categoryBadge}</span>}
                      </button>
                    );
                  })}
                </div>
              )}

              {step === 'plan' && (
                <>
                  {detailLoading && (
                    <p className="bk-step-label" role="status">
                      Loading packages&hellip;
                    </p>
                  )}
                  {!detailLoading && (detail?.plans.length ?? 0) === 0 ? (
                    <div className="bk-plan-fallback">
                      <p>{detail?.description || 'Our team will confirm options and availability for you.'}</p>
                      <p className="bk-plan-fallback-note">Pricing for this service is confirmed by our team. Continue to send a request instead.</p>
                    </div>
                  ) : (
                    <div className="bk-plan-grid">
                      {(detail?.plans ?? []).map(entry => (
                        <button key={entry.slug} type="button" aria-pressed={s.planSlug === entry.slug} className={['bk-plan-card', entry.featured ? 'featured' : '', s.planSlug === entry.slug ? 'selected' : ''].join(' ').trim()} onClick={() => selectPlan(entry)}>
                          {entry.billingType === 'RECURRING' && <span className="bk-plan-badge">Subscription</span>}
                          <div className="bk-plan-name">{entry.name}</div>
                          <div className="bk-plan-price">{money(entry.unitAmountCents, entry.currency)}</div>
                          <div className="bk-plan-period">{entry.unitLabel}</div>
                          {entry.capacityText && <div className="bk-plan-capacity">{entry.capacityText}</div>}
                          <div className="bk-plan-desc">{entry.description}</div>
                        </button>
                      ))}
                    </div>
                  )}
                  {serviceRules.map(rule => (
                    <p key={rule} className="bk-rule-pill">
                      <Check size={13} strokeWidth={3} aria-hidden="true" />
                      {rule}
                    </p>
                  ))}
                  {plan && (
                    <div className="bk-plan-details-box">
                      <div className="bk-detail-header">
                        <span className="bk-detail-name">{plan.name}</span>
                        <span className="bk-detail-price">
                          {money(plan.unitAmountCents, currency)}
                          <small style={{fontSize: 14, fontWeight: 400}}> {plan.unitLabel}</small>
                        </span>
                      </div>
                      {plan.description && <p className="bk-detail-desc">{plan.description}</p>}
                      {plan.governmentNotice && (
                        <p className="bk-notice">
                          <AlertTriangle size={14} aria-hidden="true" />
                          <span>{plan.governmentNotice}</span>
                        </p>
                      )}
                      {plan.capacityText && (
                        <p className="bk-detail-desc">
                          <strong>Capacity:</strong> {plan.capacityText}
                        </p>
                      )}
                      {plan.billingType === 'RECURRING' && (
                        <p className="bk-detail-desc">
                          <strong>This is a subscription.</strong> It renews {plan.intervalDescription} automatically until you cancel. You can stop renewal any time from your account.
                        </p>
                      )}
                      {plan.durationDays ? <p className="bk-detail-desc">Valid for {plan.durationDays} days from activation.</p> : null}
                      {plan.maxQuantity > 1 && (
                        <div className="bk-field bk-qty-field">
                          <label className="bk-label" htmlFor="bk-qty">
                            {plan.quantityBasis === 'HOURS' ? 'How many hours?' : plan.quantityBasis === 'DAYS' ? 'How many days?' : 'How many ' + basisNoun(plan) + '?'}
                          </label>
                          <input
                            id="bk-qty"
                            className="bk-input"
                            type="number"
                            min={plan.minQuantity}
                            max={plan.maxQuantity}
                            value={s.units}
                            onChange={e => {
                              dispatch({t: 'SET_FIELD', k: 'units', v: Math.max(plan.minQuantity, Math.min(plan.maxQuantity, Number(e.target.value) || plan.minQuantity))});
                              setQuote(null);
                            }}
                          />
                          <p className="bk-plan-fallback-note">
                            {money(plan.unitAmountCents * s.units, currency)} total for {s.units} {basisNoun(plan)}
                          </p>
                        </div>
                      )}
                      {amenities.length > 0 && (
                        <>
                          <div className="bk-amenities-title">What&apos;s included</div>
                          <div className="bk-amenities-grid">
                            {amenities.map(amenity => {
                              const Icon = icon(amenity.iconName);
                              return (
                                <div key={amenity.slug} className="bk-amenity">
                                  <span className="bk-amenity-icon">
                                    <Icon size={16} strokeWidth={2} aria-hidden="true" />
                                  </span>
                                  <span>{amenity.name}</span>
                                </div>
                              );
                            })}
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </>
              )}

              {step === 'amenities' && (
                <>
                  <div className="bk-amenities-grid bk-amenities-step">
                    {amenities.map(amenity => {
                      const Icon = icon(amenity.iconName);
                      return (
                        <div key={amenity.slug} className="bk-amenity">
                          <span className="bk-amenity-icon">
                            <Icon size={16} strokeWidth={2} aria-hidden="true" />
                          </span>
                          <span>
                            <strong>{amenity.name}</strong>
                            {amenity.description ? <small>{amenity.description}</small> : null}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                  {serviceRules.map(rule => (
                    <p key={rule} className="bk-rule-pill">
                      <Check size={13} strokeWidth={3} aria-hidden="true" />
                      {rule}
                    </p>
                  ))}
                </>
              )}

              {step === 'extras' && (
                <>
                  <div className="bk-addons-grid">
                    {availableAddOns.map(addOn => {
                      const quantity = s.addOns[addOn.slug] ?? 0;
                      const selected = quantity > 0;
                      const stepped = addOn.maxQuantity > 1 && !(addOn.quantityBasis === 'HOURS' && plan?.quantityBasis === 'HOURS') && !(addOn.quantityBasis === 'DAYS' && plan?.quantityBasis === 'DAYS');
                      const units = addOnUnits(addOn);
                      return (
                        <div key={addOn.slug} className="bk-addon-row">
                          <button
                            type="button"
                            className={'bk-addon' + (selected ? ' selected' : '')}
                            role="checkbox"
                            aria-checked={selected}
                            disabled={addOn.isRequired}
                            onClick={() => {
                              dispatch({t: 'SET_ADDON', slug: addOn.slug, quantity: selected ? 0 : Math.max(1, addOn.defaultQuantity || 1)});
                              setQuote(null);
                            }}
                          >
                            <span className="bk-addon-icon">
                              <Package size={22} strokeWidth={1.8} aria-hidden="true" />
                            </span>
                            <span className="bk-addon-info">
                              <span className="bk-addon-name">
                                {addOn.name}
                                {addOn.isRequired && <span className="bk-addon-required">included</span>}
                              </span>
                              <span className="bk-addon-desc">{addOn.description || addOn.unitLabel}</span>
                            </span>
                            <span className="bk-addon-price">
                              +{money(addOn.unitAmountCents, addOn.currency)}
                              <small> {addOn.unitLabel}</small>
                            </span>
                            <span className="bk-addon-check">{selected && <Check size={13} strokeWidth={2.5} aria-hidden="true" />}</span>
                          </button>
                          {selected && stepped && (
                            <div className="bk-addon-qty">
                              <label htmlFor={'bk-addon-' + addOn.slug}>{addOn.quantityNoun}</label>
                              <input
                                id={'bk-addon-' + addOn.slug}
                                type="number"
                                min={Math.max(1, addOn.minQuantity)}
                                max={addOn.maxQuantity}
                                value={quantity}
                                onChange={e => {
                                  dispatch({t: 'SET_ADDON', slug: addOn.slug, quantity: Math.max(1, Math.min(addOn.maxQuantity, Number(e.target.value) || 1))});
                                  setQuote(null);
                                }}
                              />
                              <span>= {money(addOn.unitAmountCents * units, addOn.currency)}</span>
                            </div>
                          )}
                          {selected && !stepped && units > 1 && (
                            <p className="bk-addon-qty-note">
                              {units} × {money(addOn.unitAmountCents, addOn.currency)} = {money(addOn.unitAmountCents * units, addOn.currency)}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  <div className="bk-summary">
                    <div className="bk-summary-title">Summary</div>
                    <div className="bk-summary-row">
                      <span>{plan?.name}</span>
                      <span>{plan ? money(plan.unitAmountCents * s.units, currency) : '—'}</span>
                    </div>
                    {selectedAddOns.map(addOn => (
                      <div key={addOn.slug} className="bk-summary-row">
                        <span>
                          {addOn.name}
                          {addOnUnits(addOn) > 1 ? ' × ' + addOnUnits(addOn) : ''}
                        </span>
                        <span>+{money(addOn.unitAmountCents * addOnUnits(addOn), addOn.currency)}</span>
                      </div>
                    ))}
                    <div className="bk-summary-row total">
                      <span>Due today</span>
                      <span>{money(localDueNow, currency)}</span>
                    </div>
                  </div>
                </>
              )}

              {step === 'schedule' && (
                <>
                  <CalendarPicker
                    selected={s.date}
                    blockToday={blocksSameDayBooking(detail?.slug, plan?.billingType)}
                    onChange={v => {
                      dispatch({t: 'SET_FIELD', k: 'date', v});
                      setQuote(null);
                    }}
                  />
                  {s.date && plan?.durationDays ? (
                    <div className="bk-plan-fallback-note" style={{marginTop: 12, padding: '10px 14px', background: 'var(--bk-sand)', borderRadius: 5}}>
                      <strong>{plan.durationDays}-day reservation:</strong> {s.date} to {new Date(new Date(s.date).getTime() + plan.durationDays * 86400000).toISOString().split('T')[0]}
                    </div>
                  ) : null}
                  {s.date && (
                    <div className="bk-time-section">
                      <div className="bk-time-title">
                        Select a start time
                        {plan?.quantityBasis === 'HOURS' ? ' (' + s.units + ' hour' + (s.units === 1 ? '' : 's') + ')' : plan?.durationMinutes ? ' (' + plan.durationMinutes + ' minutes)' : ''}
                      </div>
                      <div className="bk-time-grid">
                        {TIME_SLOTS.map(slot => (
                          <button
                            key={slot}
                            type="button"
                            aria-pressed={s.time === slot}
                            className={'bk-time-slot' + (s.time === slot ? ' selected' : '')}
                            onClick={() => {
                              dispatch({t: 'SET_FIELD', k: 'time', v: slot});
                              setQuote(null);
                            }}
                          >
                            {slot}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}

              {step === 'circle' && (
                <div className="bk-type-grid">
                  {circles.map(entry => (
                    <button key={entry} type="button" aria-pressed={s.circle === entry} className={'bk-type-card' + (s.circle === entry ? ' selected' : '')} onClick={() => dispatch({t: 'SET_FIELD', k: 'circle', v: entry})}>
                      <span className="bk-type-icon">
                        <Users size={24} strokeWidth={1.8} aria-hidden="true" />
                      </span>
                      <span className="bk-type-name">{entry}</span>
                    </button>
                  ))}
                </div>
              )}

              {step === 'checkout' && (
                <>
                  <div className="bk-field">
                    <label className="bk-label" htmlFor="bk-email">
                      Email Address
                    </label>
                    <input id="bk-email" className="bk-input" type="email" placeholder="you@example.com" autoComplete="email" maxLength={254} readOnly={s.submitting} value={s.email} onChange={e => dispatch({t: 'SET_FIELD', k: 'email', v: e.target.value})} required />
                  </div>
                  <div className="bk-row-2">
                    <div className="bk-field">
                      <label className="bk-label" htmlFor="bk-first">
                        First Name
                      </label>
                      <input id="bk-first" className="bk-input" type="text" placeholder="Jane" autoComplete="given-name" maxLength={99} readOnly={s.submitting} pattern=".*\S.*" value={s.firstName} onChange={e => dispatch({t: 'SET_FIELD', k: 'firstName', v: e.target.value})} required />
                    </div>
                    <div className="bk-field">
                      <label className="bk-label" htmlFor="bk-last">
                        Last Name
                      </label>
                      <input id="bk-last" className="bk-input" type="text" placeholder="Smith" autoComplete="family-name" maxLength={100} readOnly={s.submitting} pattern=".*\S.*" value={s.lastName} onChange={e => dispatch({t: 'SET_FIELD', k: 'lastName', v: e.target.value})} required />
                    </div>
                  </div>
                  <div className="bk-row-2">
                    <div className="bk-field">
                      <label className="bk-label" htmlFor="bk-phone">
                        Phone (optional)
                      </label>
                      <input id="bk-phone" className="bk-input" type="tel" placeholder="+1 (555) 000-0000" autoComplete="tel" maxLength={50} readOnly={s.submitting} value={s.phone} onChange={e => dispatch({t: 'SET_FIELD', k: 'phone', v: e.target.value})} />
                    </div>
                    {steps.includes('circle') ? (
                      <div className="bk-field">
                        <label className="bk-label" htmlFor="bk-circle">
                          Industry Circle (required)
                        </label>
                        <select id="bk-circle" className="bk-input" value={s.circle} onChange={e => dispatch({t: 'SET_FIELD', k: 'circle', v: e.target.value})} required>
                          <option value="">Select your professional Circle</option>
                          {circles.map(entry => (
                            <option key={entry} value={entry}>
                              {entry}
                            </option>
                          ))}
                        </select>
                      </div>
                    ) : (
                      <div className="bk-field">
                        <label className="bk-label" htmlFor="bk-notes">
                          Notes (optional)
                        </label>
                        <input id="bk-notes" className="bk-input" type="text" placeholder="Anything we should know?" maxLength={5000} readOnly={s.submitting} value={s.notes} onChange={e => dispatch({t: 'SET_FIELD', k: 'notes', v: e.target.value})} />
                      </div>
                    )}
                  </div>
                  {plan && (
                    <div className="bk-row-2">
                      <div className="bk-field">
                        <label className="bk-label" htmlFor="bk-coupon">
                          Coupon code (optional)
                        </label>
                        <input id="bk-coupon" className="bk-input" type="text" placeholder="SAVE10" autoComplete="off" maxLength={100} readOnly={s.submitting} value={s.coupon} onChange={e => dispatch({t: 'SET_FIELD', k: 'coupon', v: e.target.value})} onBlur={() => void refreshQuote()} />
                      </div>
                      <div className="bk-field bk-quote-action">
                        <span className="bk-label">Confirm your price</span>
                        <button type="button" className="bk-btn bk-btn-ghost" disabled={quoting} onClick={() => void refreshQuote()}>
                          {quoting ? 'Checking…' : 'Review price'}
                        </button>
                      </div>
                    </div>
                  )}
                  {requestSent && (
                    <div className="bk-plan-fallback" role="status">
                      <p>
                        <strong>Request sent.</strong> Our team will contact you to confirm availability and pricing. No payment has been taken.
                      </p>
                    </div>
                  )}
                  <div className="bk-checkout-summary" aria-live="polite">
                    <div className="bk-summary-row">
                      <span>{detail?.name || 'Service'}</span>
                      <span />
                    </div>
                    <div className="bk-summary-row">
                      <span>
                        {plan?.name || 'Reservation request'}
                        {plan && s.units > 1 ? ' · ' + s.units + ' ' + basisNoun(plan) : ''}
                      </span>
                      <span>{plan ? money(plan.unitAmountCents * s.units, currency) : '—'}</span>
                    </div>
                    {selectedAddOns.map(addOn => (
                      <div key={addOn.slug} className="bk-summary-row">
                        <span>
                          {addOn.name}
                          {addOnUnits(addOn) > 1 ? ' × ' + addOnUnits(addOn) : ''}
                        </span>
                        <span>+{money(addOn.unitAmountCents * addOnUnits(addOn), addOn.currency)}</span>
                      </div>
                    ))}
                    {plan?.requiresSchedule && s.date && (
                      <div className="bk-summary-row">
                        <span>Reserved</span>
                        <span>
                          {s.date}
                          {s.time ? ', ' + s.time : ''}
                        </span>
                      </div>
                    )}
                    {s.circle && (
                      <div className="bk-summary-row">
                        <span>Circle</span>
                        <span>{s.circle}</span>
                      </div>
                    )}
                    {quote && quote.discountAmount > 0 && (
                      <div className="bk-summary-row">
                        <span>Discount{quote.discountDuration === 'once' ? ' (first charge only)' : quote.discountDuration === 'forever' ? ' (every charge)' : quote.discountDuration === 'repeating' ? ' (' + quote.discountDurationInMonths + ' months)' : ''}</span>
                        <span>−{money(quote.discountAmount, quote.currency)}</span>
                      </div>
                    )}
                    {plan && (
                      <div className="bk-summary-row total">
                        <span>Due today</span>
                        <span>{money(dueNow, currency)}</span>
                      </div>
                    )}
                    {recurring > 0 && (
                      <div className="bk-summary-row">
                        <span>Then</span>
                        <span>
                          {money(recurring, currency)} {quote?.recurringDescription || plan?.intervalDescription}
                        </span>
                      </div>
                    )}
                    {plan && !quote && (
                      <div className="bk-summary-row">
                        <span className="bk-plan-fallback-note">Final amount is confirmed by our server before payment.</span>
                        <span />
                      </div>
                    )}
                  </div>
                  {plan?.governmentNotice && (
                    <p className="bk-notice">
                      <AlertTriangle size={14} aria-hidden="true" />
                      <span>{plan.governmentNotice}</span>
                    </p>
                  )}
                  {plan?.rulesNotice && (
                    <p className="bk-rule-pill">
                      <Check size={13} strokeWidth={3} aria-hidden="true" />
                      {plan.rulesNotice}
                    </p>
                  )}
                  <label className="bk-terms">
                    <input type="checkbox" required disabled={s.submitting} checked={s.terms} onChange={e => dispatch({t: 'SET_FIELD', k: 'terms', v: e.target.checked})} />
                    <span className="bk-terms-copy">
                      I agree to the{' '}
                      <a href="/terms-and-privacy" target="_blank" rel="noopener noreferrer">
                        Terms of Use
                      </a>{' '}
                      and{' '}
                      <a href="/terms-and-privacy" target="_blank" rel="noopener noreferrer">
                        Privacy Notice
                      </a>
                      {plan ? (
                        recurringPlan ? (
                          <>
                            , and I understand this is a subscription of {money(recurring, currency)} {quote?.recurringDescription || plan.intervalDescription}, charged automatically until I cancel. I can stop renewal any time from my account; access continues to the end of the paid period and the current period is not refunded.
                          </>
                        ) : (
                          <>, and authorize the one-time payment of {money(dueNow, currency)} shown above</>
                        )
                      ) : (
                        <>, and understand this is a reservation request, not a confirmed booking</>
                      )}
                    </span>
                  </label>
                  {plan && (signedIn ? (
                    <p className="bk-account-note">
                      Purchasing as <strong>{session.status === 'authenticated' ? session.customer.displayName : ''}</strong>. This purchase is added to your account, and you can pay with a saved card or a new one.
                    </p>
                  ) : (
                    <label className="bk-terms">
                      <input type="checkbox" required disabled={s.submitting} checked={s.accountTerms} onChange={e => dispatch({t: 'SET_FIELD', k: 'accountTerms', v: e.target.checked})} />
                      <span className="bk-terms-copy">
                        I understand a Workspace Junction customer account is created with this purchase, and my card is saved securely with Stripe for renewals and future purchases. I can manage or replace it from my account. We email you a link to set your password.
                      </span>
                    </label>
                  ))}
                  {plan && (
                    <label className="bk-terms">
                      <input type="checkbox" disabled={s.submitting} checked={s.marketing} onChange={e => dispatch({t: 'SET_FIELD', k: 'marketing', v: e.target.checked})} />
                      <span className="bk-terms-copy">Send me occasional news and offers (optional).</span>
                    </label>
                  )}
                  {s.duplicate && (
                    <label className="bk-terms">
                      <input type="checkbox" disabled={s.submitting} checked={s.confirmExtra} onChange={e => dispatch({t: 'SET_FIELD', k: 'confirmExtra', v: e.target.checked})} />
                      <span className="bk-terms-copy">Yes, buy an additional, separately billed subscription. To change my existing plan instead I will use <Link href="/account/subscriptions/" onClick={() => closeRef.current()}>My subscriptions</Link>.</span>
                    </label>
                  )}
                  {s.error && (
                    <p className="bk-error-msg" role="alert">
                      {s.error}
                    </p>
                  )}
                  <button type="submit" className="bk-submit-btn" disabled={s.submitting || requestSent || (!services && !catalogError)}>
                    {plan ? (s.submitting ? 'Opening secure payment…' : 'Continue to payment') : requestSent ? 'Request sent' : s.submitting ? 'Sending request…' : 'Send booking request'}
                  </button>
                  <p className="bk-plan-fallback-note">Payments are processed by Stripe. Card details never reach our servers.</p>
                </>
              )}

              {step === 'pay' && (
                <div className="bk-pay">
                  <div className="bk-pay-head">
                    <span>Paying now</span>
                    <strong>{money(dueNow, currency)}</strong>
                  </div>
                  {!payReady && (
                    <p className="bk-status" role="status">
                      Opening Stripe&rsquo;s secure payment form&hellip;
                    </p>
                  )}
                  <div ref={payMountRef} className={'bk-pay-mount' + (payReady ? ' is-ready' : '')} aria-busy={!payReady} />
                  {s.error && (
                    <p className="bk-error-msg" role="alert">
                      {s.error}
                    </p>
                  )}
                  <button type="button" className="bk-btn bk-btn-ghost bk-pay-cancel" onClick={cancelPayment}>
                    Back to review
                  </button>
                  <p className="bk-plan-fallback-note">Payment is processed by Stripe. Your card details are entered directly into Stripe&rsquo;s own form and never reach our servers.</p>
                </div>
              )}
            </div>
          </form>
          <aside className="bk-rail" aria-label="Your selection">
            <p className="bk-rail-title">Your selection</p>
            <dl className="bk-rail-list">
              <div>
                <dt>Service</dt>
                <dd>{detail?.name || 'Not chosen yet'}</dd>
              </div>
              <div>
                <dt>Package</dt>
                <dd>{plan ? plan.name : 'Not chosen yet'}</dd>
              </div>
              {plan && plan.maxQuantity > 1 && (
                <div>
                  <dt>{basisNoun(plan).replace(/^\w/, c => c.toUpperCase())}</dt>
                  <dd>{s.units}</dd>
                </div>
              )}
              {selectedAddOns.length > 0 && (
                <div>
                  <dt>Extras</dt>
                  <dd>{selectedAddOns.map(addOn => addOn.name + (addOnUnits(addOn) > 1 ? ' ×' + addOnUnits(addOn) : '')).join(', ')}</dd>
                </div>
              )}
              {plan?.requiresSchedule && (
                <div>
                  <dt>When</dt>
                  <dd>{s.date ? s.date + (s.time ? ' · ' + s.time : '') : 'Not chosen yet'}</dd>
                </div>
              )}
              {s.circle && (
                <div>
                  <dt>Circle</dt>
                  <dd>{s.circle}</dd>
                </div>
              )}
            </dl>
            <div className="bk-rail-total">
              <span>Due today</span>
              <strong>{plan ? money(dueNow, currency) : '—'}</strong>
            </div>
            {recurring > 0 && (
              <p className="bk-rail-recurring">
                then {money(recurring, currency)} {quote?.recurringDescription || plan?.intervalDescription}, until you cancel
              </p>
            )}
            {amenities.length > 0 && (
              <ul className="bk-rail-credits">
                {amenities.slice(0, 6).map(amenity => (
                  <li key={amenity.slug}>
                    <Check size={13} strokeWidth={3} aria-hidden="true" />
                    {amenity.name}
                  </li>
                ))}
              </ul>
            )}
            <p className="bk-rail-note">
              <Lock size={13} aria-hidden="true" /> Secure payment by Stripe. Prices are confirmed by our server before you pay.
            </p>
          </aside>
        </div>
        {step !== 'checkout' && step !== 'pay' && (
          <footer className="bk-footer">
            <div className="bk-footer-price">
              {plan ? (
                <>
                  <span>Due today</span>
                  <strong>{money(localDueNow, currency)}</strong>
                  {localRecurring > 0 && (
                    <small>
                      then {money(localRecurring, currency)} {plan.intervalDescription}
                    </small>
                  )}
                </>
              ) : (
                <span>Choose a package to see pricing</span>
              )}
            </div>
            <div className="bk-footer-actions">
              {stepIndex > 0 && (
                <button type="button" className="bk-btn bk-btn-ghost" onClick={() => dispatch({t: 'BACK'})}>
                  Back
                </button>
              )}
              <button type="button" className="bk-btn bk-btn-primary" disabled={!canNext()} onClick={() => dispatch({t: 'NEXT', max: steps.length - 1})}>
                {steps[stepIndex + 1] === 'checkout' ? (plan ? 'Review & pay' : 'Review request') : 'Continue'}
                <ChevronRight size={16} aria-hidden="true" />
              </button>
            </div>
          </footer>
        )}
      </div>
    </dialog>
  );
}
