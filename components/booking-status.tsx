'use client';
import {PUBLIC_API_URL} from '@/lib/public-api';
import {useEffect, useRef, useState} from 'react';
import Link from 'next/link';
import {useSearchParams} from 'next/navigation';

type Confirmation = {id:string;status:string;serviceName:string;bookingDate?:string|null;bookingTime?:string|null;totalPrice:number;currency:string};

const POLL_MS = 2500;
const MAX_ATTEMPTS = 24; // ~1 minute: Stripe webhooks normally arrive within a few seconds of redirect.

function money(amount:number, currency:string):string {
 try { return amount.toLocaleString('en-US', {style:'currency', currency: currency.toUpperCase()}); }
 catch { return '$' + amount.toFixed(2); }
}

export function BookingStatus({id}:{id:string}) {
 const [data, setData] = useState<Confirmation | null>(null);
 const [notFound, setNotFound] = useState(false);
 const [timedOut, setTimedOut] = useState(false);
 const attempts = useRef(0);

 useEffect(() => {
  let cancelled = false;
  let timer: ReturnType<typeof setTimeout>;

  async function poll() {
   try {
    const res = await fetch(PUBLIC_API_URL + '/public/bookings/' + encodeURIComponent(id) + '/confirmation');
    if (cancelled) return;
    if (res.status === 404) { setNotFound(true); return; }
    if (!res.ok) throw new Error('request failed');
    const body: Confirmation = await res.json();
    setData(body);
    attempts.current += 1;
    if (body.status === 'PENDING' && attempts.current < MAX_ATTEMPTS) {
     timer = setTimeout(poll, POLL_MS);
    } else if (body.status === 'PENDING') {
     setTimedOut(true);
    }
   } catch {
    attempts.current += 1;
    if (!cancelled && attempts.current < MAX_ATTEMPTS) timer = setTimeout(poll, POLL_MS);
    else if (!cancelled) setTimedOut(true);
   }
  }
  void poll();
  return () => { cancelled = true; clearTimeout(timer); };
 }, [id]);

 if (notFound) return <>
  <p>We couldn&apos;t find that booking.</p>
  <p><Link href="/">Return home</Link> or <Link href="/contact-us/">contact us</Link> for help.</p>
 </>;

 if (!data) return <p role="status">Checking your payment status&hellip;</p>;

 if (data.status === 'CONFIRMED') return <>
  <p role="status"><strong>Your booking is confirmed.</strong> Payment of {money(data.totalPrice, data.currency)} was received for {data.serviceName}
   {data.bookingDate ? <> on {data.bookingDate}{data.bookingTime ? ' at ' + data.bookingTime : ''}</> : null}.</p>
  <p>A confirmation has been sent to your email. Reference: <code>{data.id}</code></p>
  <p><Link href="/">Return home</Link></p>
 </>;

 if (data.status === 'CANCELLED') return <>
  <p>This booking was cancelled before payment completed. No charge was made.</p>
  <p><Link href="/">Return home</Link> to start a new booking.</p>
 </>;

 if (data.status === 'REFUNDED') return <>
  <p>This booking was refunded. Reference: <code>{data.id}</code></p>
  <p><Link href="/contact-us/">Contact us</Link> with any questions.</p>
 </>;

 if (timedOut) return <>
  <p>We&apos;re still waiting for payment confirmation. This can take a minute if your bank is slow to respond.</p>
  <p>Reference: <code>{data.id}</code>. Refresh this page in a moment, or <Link href="/contact-us/">contact us</Link> if this continues.</p>
 </>;

 return <p role="status" aria-live="polite">Confirming your payment&hellip; this usually takes a few seconds.</p>;
}


type OrderStatusBody = {id:string;status:string;mode?:string;processing:boolean;paymentMethod?:string;currency:string;dueNowAmount:number;autoRenew?:boolean;recurringAmount:number;recurringDescription:string|null;currentPeriodEnd?:string|null;items:Array<{description:string;quantity:number;amount:number;billingType:string}>;subscriptions:Array<{id:string;accessStatus:string;autoRenew?:boolean;renews?:boolean;activeUntil?:string|null;currentPeriodEnd?:string|null}>};

/**
 * The capability minted for this checkout attempt, kept in this tab only.
 * It is never put in the URL, so a shared or logged link reveals nothing.
 */
function checkoutToken(orderId:string):string|null {
 try { return sessionStorage.getItem('wj.checkout.' + orderId); } catch { return null; }
}

/**
 * Checkout result for the billing catalog. Access is never claimed from the
 * browser redirect: the page keeps showing "processing" until the backend has
 * recorded Stripe's confirmation.
 */
export function OrderStatus({id}:{id:string}) {
 const [data, setData] = useState<OrderStatusBody | null>(null);
 const [notFound, setNotFound] = useState(false);
 const [timedOut, setTimedOut] = useState(false);
 const attempts = useRef(0);

 useEffect(() => {
  let cancelled = false;
  let timer: ReturnType<typeof setTimeout>;
  async function poll() {
   try {
    const token = checkoutToken(id);
    /* Purchases made in our own payment form are read back with their own
       capability; older orders keep using the public status route. */
    const res = token
     ? await fetch(PUBLIC_API_URL + '/public/payments/orders/' + encodeURIComponent(id), {cache:'no-store', headers:{'X-Checkout-Token': token}})
     : await fetch(PUBLIC_API_URL + '/billing/orders/' + encodeURIComponent(id) + '/status', {cache:'no-store'});
    if (cancelled) return;
    if (res.status === 404) { setNotFound(true); return; }
    if (!res.ok) throw new Error('request failed');
    const payload = await res.json();
    const body: OrderStatusBody = payload && typeof payload === 'object' && 'data' in payload && payload.data ? payload.data : payload;
    setData(body);
    attempts.current += 1;
    if (body.processing && attempts.current < MAX_ATTEMPTS) timer = setTimeout(poll, POLL_MS);
    else if (body.processing) setTimedOut(true);
   } catch {
    attempts.current += 1;
    if (!cancelled && attempts.current < MAX_ATTEMPTS) timer = setTimeout(poll, POLL_MS);
    else if (!cancelled) setTimedOut(true);
   }
  }
  void poll();
  return () => { cancelled = true; clearTimeout(timer); };
 }, [id]);

 if (notFound) return <>
  <p>We couldn&apos;t find that purchase.</p>
  <p><Link href="/">Return home</Link> or <Link href="/contact-us/">contact us</Link> for help.</p>
 </>;

 if (!data) return <p role="status">Checking your payment status&hellip;</p>;

 const amount = (minor:number) => money(minor/100, data.currency);

 if (data.status === 'PAID') {
  const renews = data.subscriptions[0]?.renews ?? (data.autoRenew !== false && data.recurringAmount > 0);
  const activeUntil = data.subscriptions[0]?.activeUntil ?? data.subscriptions[0]?.currentPeriodEnd ?? data.currentPeriodEnd ?? null;
  return <>
   <p role="status"><strong>Payment confirmed.</strong> We received {amount(data.dueNowAmount)} for {data.items.map(item=>item.description).join(', ')}.</p>
   {renews
    ? <p>You chose automatic renewal, so this continues at {amount(data.recurringAmount)} {data.recurringDescription} until you cancel. You can stop renewal at any time from your account.</p>
    : <p>This was a single payment for the current period. <strong>Nothing further will be charged</strong> and no card was stored for future payments.</p>}
   {activeUntil && <p>Your paid period runs until {new Date(activeUntil).toLocaleDateString(undefined,{dateStyle:'medium'})}.</p>}
   <p>Reference: <code>{data.id}</code></p>
   <p><Link href="/account/">Manage your purchase</Link></p>
  </>;
 }

 if (data.paymentMethod === 'MANUAL') return <>
  <p>Your request is recorded and is <strong>awaiting payment</strong>. Our team will contact you to arrange it.</p>
  <p>Nothing is active until payment is confirmed. Reference: <code>{data.id}</code></p>
 </>;

 if (data.status === 'EXPIRED' || data.status === 'CANCELLED') return <>
  <p>This checkout expired before payment completed. No charge was made.</p>
  <p><Link href="/">Return home</Link> to start again.</p>
 </>;

 if (data.status === 'FAILED') return <>
  <p>The payment did not go through, so nothing was charged and no service was activated.</p>
  <p><Link href="/contact-us/">Contact us</Link> if you need a hand.</p>
 </>;

 if (timedOut) return <>
  <p>We&apos;re still waiting for payment confirmation from Stripe. Your purchase is safe: it completes as soon as the confirmation arrives.</p>
  <p>Reference: <code>{data.id}</code>. Refresh this page in a moment, or <Link href="/contact-us/">contact us</Link> if this continues.</p>
 </>;

 return <p role="status" aria-live="polite">Confirming your payment&hellip; this usually takes a few seconds.</p>;
}

export function BookingConfirmationClient() {
 const searchParams = useSearchParams();
 const booking = searchParams.get('booking') || undefined;
 const order = searchParams.get('order') || undefined;
 return (
  <article className="container wj-policy-body">
   {order
    ? <OrderStatus id={order}/>
    : booking
    ? <BookingStatus id={booking}/>
    : <>
       <p>We couldn&apos;t find a booking reference in this link.</p>
       <p><Link href="/">Return home</Link> or <Link href="/contact-us/">contact us</Link> if you completed a payment and landed here by mistake.</p>
      </>}
  </article>
 );
}
