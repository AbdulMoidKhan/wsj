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


export function BookingConfirmationClient() {
 const searchParams = useSearchParams();
 const booking = searchParams.get('booking') || undefined;
 return (
  <article className="container wj-policy-body">
   {booking
    ? <BookingStatus id={booking}/>
    : <>
       <p>We couldn&apos;t find a booking reference in this link.</p>
       <p><Link href="/">Return home</Link> or <Link href="/contact-us/">contact us</Link> if you completed a payment and landed here by mistake.</p>
      </>}
  </article>
 );
}
