'use client';
/**
 * The site booking popup, now driven by the structured billing catalog.
 *
 * Steps adapt to the selected package: a subscription never asks for a date, an
 * hourly room always does. Every amount shown is confirmed by the server
 * (/billing/quote) before payment, and checkout goes through /billing/checkout,
 * which creates the durable order and the Stripe subscription or payment.
 *
 * If the catalog cannot be reached the popup falls back to its reservation
 * request behaviour and never implies a payment was taken.
 */
import {PUBLIC_API_URL} from '@/lib/public-api';
import './booking-dialog.css';
import {sendInquiry} from './forms';
import {useCallback, useEffect, useMemo, useReducer, useState, useRef, useId} from 'react';
import {useRouter} from 'next/navigation';
import {ArrowLeft,Briefcase,Building2,CalendarDays,Check,ChevronLeft,ChevronRight,Coffee,DoorOpen,Globe2,Handshake,Lock,Mail,Mic,Monitor,Package,PartyPopper,Phone,Printer,Radio,Store,Ticket,Utensils,Wifi,Wrench,X} from 'lucide-react';

export interface Plan {
  slug:string;name:string;serviceType:string;description:string;
  billingType:'ONE_TIME'|'RECURRING';interval:'MONTH'|'YEAR'|null;intervalDescription:string;
  unitAmount:number;currency:string;pricingUnit:string;durationMinutes:number|null;
  minQuantity:number;maxQuantity:number;
  requiresSchedule:boolean;requiresResource:boolean;requiresOnboarding:boolean;
  includedCredits:Array<{kind:string;amount?:number;resetInterval?:string;unlimited?:boolean}>;
  metadata?:Record<string,unknown>;
}
interface Quote {
  currency:string;subtotalAmount:number;discountAmount:number;taxAmount:number;totalAmount:number;
  dueNowAmount:number;recurringAmount:number;recurringInterval:'MONTH'|'YEAR'|null;recurringDescription:string|null;
  discountDuration:'once'|'repeating'|'forever'|null;discountDurationInMonths:number|null;termsVersion:string|null;
}

/* Presentation only. Labels and icons never affect price or billing. */
const SERVICE_META:Record<string,{label:string;icon:typeof Briefcase}>={
  coworking:{label:'Coworking',icon:Globe2},
  dedicated:{label:'Dedicated Desk',icon:Monitor},
  memberships:{label:'Memberships',icon:Handshake},
  'virtual-office':{label:'Virtual Office',icon:Mail},
  'business-address':{label:'Business Address',icon:Building2},
  'virtual-mailbox':{label:'Mailbox',icon:Package},
  'meeting-rooms':{label:'Meeting Rooms',icon:DoorOpen},
  events:{label:'Event Space',icon:PartyPopper},
  'photo-studio':{label:'Photo Studio',icon:Store},
  'podcast-studio':{label:'Podcast Studio',icon:Mic},
  workshops:{label:'Workshops',icon:Wrench},
  webinars:{label:'Webinars',icon:Radio},
  'llc-setup':{label:'LLC Services',icon:Briefcase},
};
const serviceLabel=(key:string)=>SERVICE_META[key]?.label||key.replace(/[-_]/g,' ').replace(/\b\w/g,c=>c.toUpperCase());
const serviceIcon=(key:string)=>SERVICE_META[key]?.icon||Briefcase;

const AMENITIES=[
  {icon:Wifi,name:'High-Speed WiFi'},
  {icon:Coffee,name:'Coffee & Tea'},
  {icon:Printer,name:'Printing'},
  {icon:Phone,name:'Phone Booths'},
  {icon:Lock,name:'24/7 Access'},
  {icon:CalendarDays,name:'Flexible Terms'},
  {icon:Ticket,name:'Member Events'},
  {icon:Utensils,name:'Kitchen'},
];

const TIME_SLOTS=['8:00 AM','9:00 AM','10:00 AM','11:00 AM','12:00 PM','1:00 PM','2:00 PM','3:00 PM','4:00 PM','5:00 PM','6:00 PM','7:00 PM'];

/* Stripe.js is loaded from Stripe's own CDN, once per page, only when a payment
   actually starts. Embedded Checkout renders Stripe's hosted payment UI inside
   this dialog; card details go straight to Stripe and never touch our code. */
export interface EmbeddedCheckout{mount:(target:HTMLElement)=>void;destroy:()=>void}
type StripeFactory=(publishableKey:string)=>{initEmbeddedCheckout:(options:{clientSecret:string})=>Promise<EmbeddedCheckout>};
declare global{interface Window{Stripe?:StripeFactory}}

let stripeJs:Promise<StripeFactory|null>|null=null;
function loadStripeJs():Promise<StripeFactory|null>{
  if(typeof window==='undefined')return Promise.resolve(null);
  if(window.Stripe)return Promise.resolve(window.Stripe);
  if(!stripeJs){
    stripeJs=new Promise<StripeFactory|null>((resolve,reject)=>{
      const script=document.createElement('script');
      script.src='https://js.stripe.com/v3/';
      script.async=true;
      script.onload=()=>resolve(window.Stripe??null);
      script.onerror=()=>{stripeJs=null;reject(new Error('Stripe could not be loaded'));};
      document.head.appendChild(script);
    });
  }
  return stripeJs;
}

function money(minor:number,currency='usd'):string{
  return (minor/100).toLocaleString('en-US',{style:'currency',currency:currency.toUpperCase(),maximumFractionDigits:minor%100===0?0:2});
}
const creditLabel=(credit:{kind:string;amount?:number;resetInterval?:string;unlimited?:boolean})=>
  (credit.unlimited?'Unlimited ':(credit.amount??0)+' ')+credit.kind.replaceAll('_',' ').toLowerCase()+(credit.resetInterval==='YEAR'?' each year':' each month');
const priceSuffix=(plan:Plan)=>plan.billingType==='RECURRING'?plan.intervalDescription:plan.pricingUnit==='HOUR'?'per hour':'one-time';

/** 12-hour slot to 24-hour clock, used to build the reservation start instant. */
function to24(slot:string):string{
  const match=slot.match(/^(\d+):(\d+)\s*(AM|PM)$/i);
  if(!match)return '09:00';
  let hour=Number(match[1])%12;
  if(match[3].toUpperCase()==='PM')hour+=12;
  return String(hour).padStart(2,'0')+':'+match[2];
}

interface S{
  stepIndex:number;serviceType:string;planSlug:string;addOns:string[];quantity:number;
  date:string;time:string;
  email:string;firstName:string;lastName:string;phone:string;
  coupon:string;notes:string;circle:string;terms:boolean;
  submitting:boolean;error:string;
}
type A=
  |{t:'SET_SERVICE';v:string}
  |{t:'SET_PLAN';v:string;quantity:number}
  |{t:'TOGGLE_ADDON';v:string}
  |{t:'SET_FIELD';k:keyof S;v:unknown}
  |{t:'NEXT';max:number}
  |{t:'BACK'}
  |{t:'SUBMITTING'}
  |{t:'ERROR';v:string};

function init(preselect?:{serviceType?:string;planSlug?:string}):S{
  return{stepIndex:0,serviceType:preselect?.serviceType||'',planSlug:preselect?.planSlug||'',addOns:[],quantity:1,date:'',time:'',email:'',firstName:'',lastName:'',phone:'',coupon:'',notes:'',circle:'',terms:false,submitting:false,error:''};
}
function reducer(s:S,a:A):S{
  switch(a.t){
    case 'SET_SERVICE':return{...s,serviceType:a.v,planSlug:'',addOns:[],quantity:1,date:'',time:''};
    case 'SET_PLAN':return{...s,planSlug:a.v,quantity:a.quantity,date:'',time:''};
    case 'TOGGLE_ADDON':{const has=s.addOns.includes(a.v);return{...s,addOns:has?s.addOns.filter(x=>x!==a.v):[...s.addOns,a.v]};}
    case 'SET_FIELD':return{...s,[a.k]:a.v};
    case 'NEXT':return{...s,stepIndex:Math.min(s.stepIndex+1,a.max),error:''};
    case 'BACK':return{...s,stepIndex:Math.max(s.stepIndex-1,0),error:''};
    case 'SUBMITTING':return{...s,submitting:true,error:''};
    case 'ERROR':return{...s,submitting:false,error:a.v};
    default:return s;
  }
}

function CalendarPicker({selected,onChange}:{selected:string;onChange:(d:string)=>void}){
  const today=new Date();
  const [yr,setYr]=useState(today.getFullYear());
  const [mo,setMo]=useState(today.getMonth());
  const firstDay=new Date(yr,mo,1).getDay();
  const daysInMonth=new Date(yr,mo+1,0).getDate();
  const monthName=new Date(yr,mo).toLocaleString('default',{month:'long',year:'numeric'});
  const cells:Array<number|null>=Array(firstDay).fill(null);
  for(let d=1;d<=daysInMonth;d++)cells.push(d);
  const prev=()=>{if(mo===0){setMo(11);setYr(y=>y-1);}else setMo(m=>m-1);};
  const next=()=>{if(mo===11){setMo(0);setYr(y=>y+1);}else setMo(m=>m+1);};
  const isPast=(d:number)=>{const dt=new Date(yr,mo,d);dt.setHours(0,0,0,0);const t=new Date();t.setHours(0,0,0,0);return dt<t;};
  const toStr=(d:number)=>`${yr}-${String(mo+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
  const isToday=(d:number)=>d===today.getDate()&&mo===today.getMonth()&&yr===today.getFullYear();
  const DAY_NAMES=['Su','Mo','Tu','We','Th','Fr','Sa'];
  return(
    <div className="bk-cal-card">
      <div className="bk-cal-nav">
        <button type="button" className="bk-cal-nav-btn" onClick={prev} aria-label="Previous month"><ChevronLeft size={16} aria-hidden="true"/></button>
        <span className="bk-cal-month">{monthName}</span>
        <button type="button" className="bk-cal-nav-btn" onClick={next} aria-label="Next month"><ChevronRight size={16} aria-hidden="true"/></button>
      </div>
      <div className="bk-cal-scroll" tabIndex={0} role="region" aria-label="Calendar dates, scroll horizontally on small screens"><div className="bk-cal-grid" key={`${yr}-${mo}`}>
        {DAY_NAMES.map(n=><div key={n} className="bk-cal-day-name">{n}</div>)}
        {cells.map((d,i)=>d===null?<div key={`e${i}`} className="bk-cal-day empty"/>:<button key={d} type="button" className={['bk-cal-day',isPast(d)?'past':'',selected===toStr(d)?'selected':'',isToday(d)&&selected!==toStr(d)?'today':''].join(' ').trim()} disabled={isPast(d)} aria-label={new Date(yr,mo,d).toLocaleDateString(undefined,{dateStyle:'full'})} aria-pressed={selected===toStr(d)} onClick={()=>!isPast(d)&&onChange(toStr(d))}>{d}</button>)}
      </div></div>
    </div>
  );
}

export function BookingDialog({service,plan:preselectedPlan,onClose}:{service?:string;plan?:string;onClose:()=>void}){
  const [catalog,setCatalog]=useState<Plan[]|null>(null);
  const [catalogError,setCatalogError]=useState(false);
  const [quote,setQuote]=useState<Quote|null>(null);
  const [quoting,setQuoting]=useState(false);
  const [requestSent,setRequestSent]=useState(false);
  const [pay,setPay]=useState<{clientSecret:string;publishableKey:string}|null>(null);
  const [payReady,setPayReady]=useState(false);
  const [closing,setClosing]=useState(false);
  const closeTimerRef=useRef<ReturnType<typeof setTimeout>|null>(null);
  const payMountRef=useRef<HTMLDivElement>(null);
  const embeddedRef=useRef<EmbeddedCheckout|null>(null);
  const [s,dispatch]=useReducer(reducer,undefined,()=>init());
  const router=useRouter();
  const dialogRef=useRef<HTMLDialogElement>(null);
  const formRef=useRef<HTMLFormElement>(null);
  const titleRef=useRef<HTMLHeadingElement>(null);
  const closeRef=useRef(onClose);
  const submittingRef=useRef(false);
  const titleId=useId();
  const requestClose=useCallback(()=>{
    if(closeTimerRef.current)return;
    setClosing(true);
    closeTimerRef.current=setTimeout(onClose,160);
  },[onClose]);
  useEffect(()=>{closeRef.current=requestClose;return()=>{if(closeTimerRef.current)clearTimeout(closeTimerRef.current);};},[requestClose]);

  /* Live catalog. Service and package can be preselected from a page CTA. */
  useEffect(()=>{
    const controller=new AbortController();
    fetch(PUBLIC_API_URL+'/public/plans',{signal:controller.signal,cache:'no-store'})
      .then(r=>r.ok?r.json():Promise.reject(new Error('catalog')))
      .then((data:{items:Plan[]})=>{
        const items=data.items||[];
        setCatalog(items);
        setCatalogError(false);
        const byPlan=preselectedPlan?items.find(p=>p.slug===preselectedPlan):undefined;
        const hint=(service||'').toLowerCase();
        const byService=byPlan?undefined:items.find(p=>hint&&(hint.includes(serviceLabel(p.serviceType).toLowerCase())||hint.includes(p.serviceType.replace(/-/g,' '))));
        if(byPlan)dispatch({t:'SET_PLAN',v:byPlan.slug,quantity:byPlan.minQuantity||1});
        if(byPlan||byService)dispatch({t:'SET_SERVICE',v:(byPlan||byService)!.serviceType});
        if(byPlan)dispatch({t:'SET_PLAN',v:byPlan.slug,quantity:byPlan.minQuantity||1});
      })
      .catch(error=>{if(error?.name!=='AbortError')setCatalogError(true);});
    return()=>controller.abort();
  },[service,preselectedPlan]);

  useEffect(()=>{
    const dialog=dialogRef.current;
    if(!dialog)return;
    const trigger=document.activeElement instanceof HTMLElement?document.activeElement:null;
    const body=document.body;
    const root=document.documentElement;
    const scrollX=window.scrollX,scrollY=window.scrollY;
    const saved={overflow:body.style.overflow,position:body.style.position,top:body.style.top,left:body.style.left,width:body.style.width,paddingRight:body.style.paddingRight,rootOverflow:root.style.overflow};
    const gutter=window.innerWidth-root.clientWidth;
    if(gutter>0)body.style.paddingRight=(parseFloat(getComputedStyle(body).paddingRight)+gutter)+'px';
    body.style.overflow='hidden';
    body.style.position='fixed';body.style.top=-scrollY+'px';body.style.left=-scrollX+'px';body.style.width='100%';
    root.style.overflow='hidden';
    dialog.showModal();
    const trap=(event:KeyboardEvent)=>{
      if(event.key!=='Tab')return;
      const targets=Array.from(dialog.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])')).filter(el=>el.getClientRects().length>0);
      const first=targets[0],last=targets[targets.length-1];
      if(!first){event.preventDefault();dialog.focus();return;}
      if(event.shiftKey&&(document.activeElement===first||!targets.includes(document.activeElement as HTMLElement))){event.preventDefault();last.focus();}
      else if(!event.shiftKey&&(document.activeElement===last||!targets.includes(document.activeElement as HTMLElement))){event.preventDefault();first.focus();}
    };
    dialog.addEventListener('keydown',trap);
    return()=>{
      dialog.removeEventListener('keydown',trap);
      dialog.close();
      Object.assign(body.style,{overflow:saved.overflow,position:saved.position,top:saved.top,left:saved.left,width:saved.width,paddingRight:saved.paddingRight});
      root.style.overflow=saved.rootOverflow;
      const behavior=root.style.scrollBehavior;root.style.scrollBehavior='auto';
      window.scrollTo({left:scrollX,top:scrollY,behavior:'instant'});root.style.scrollBehavior=behavior;
      if(trigger?.isConnected)trigger.focus({preventScroll:true});
    };
  },[]);

  const services=useMemo(()=>{
    const seen=new Map<string,number>();
    for(const item of catalog||[]){if(!item.metadata?.addOn)seen.set(item.serviceType,(seen.get(item.serviceType)||0)+1);}
    return [...seen.entries()].map(([key,count])=>({key,count,label:serviceLabel(key),Icon:serviceIcon(key)}));
  },[catalog]);
  const servicePlans=useMemo(()=>(catalog||[]).filter(p=>p.serviceType===s.serviceType&&!p.metadata?.addOn),[catalog,s.serviceType]);
  const addOnPlans=useMemo(()=>(catalog||[]).filter(p=>p.metadata?.addOn&&(p.serviceType===s.serviceType||p.metadata?.addOnGlobal===true)),[catalog,s.serviceType]);
  const plan=useMemo(()=>(catalog||[]).find(p=>p.slug===s.planSlug),[catalog,s.planSlug]);
  const selectedAddOns=useMemo(()=>addOnPlans.filter(p=>s.addOns.includes(p.slug)),[addOnPlans,s.addOns]);
  const currency=plan?.currency||'usd';

  /* Steps adapt to the package: no date step for a subscription, no extras step
     when the catalog has no compatible add-ons. */
  const steps=useMemo(()=>{
    const list:Array<'service'|'plan'|'addons'|'schedule'|'review'|'pay'>=['service','plan'];
    if(addOnPlans.length)list.push('addons');
    if(plan?.requiresSchedule)list.push('schedule');
    list.push('review');
    if(pay)list.push('pay');
    return list;
  },[addOnPlans.length,plan?.requiresSchedule,pay]);
  /* While a payment session is open the dialog stays on the payment step. */
  const stepIndex=pay?steps.length-1:Math.min(s.stepIndex,steps.length-1);
  const step=steps[stepIndex];
  const STEP_TITLES:Record<string,string>={service:'Choose a service',plan:'Select your package',addons:'Optional extras',schedule:'Pick a date & time',review:'Review & pay',pay:'Secure payment'};
  const STEP_HINTS:Record<string,string>={service:'Pick what you need. Every package below is live from our catalogue.',plan:'Prices are set by us, confirmed by our server, and never change in your browser.',addons:'Optional extras you can add to this purchase.',schedule:'Choose when you would like the space. Times are Central.',review:'Check the details, then pay securely with Stripe.',pay:'Card details go straight to Stripe. We never see or store them.'};
  const STEP_LABELS:Record<string,string>={service:'Service',plan:'Package',addons:'Extras',schedule:'Date & Time',review:'Review',pay:'Payment'};

  useEffect(()=>{
    titleRef.current?.focus({preventScroll:true});
    formRef.current?.scrollTo({top:0,behavior:'instant'});
  },[stepIndex]);

  /* Mount Stripe's embedded payment form once a checkout session exists. */
  useEffect(()=>{
    if(step!=='pay'||!pay)return;
    let cancelled=false;
    (async()=>{
      try{
        const target=payMountRef.current;
        if(!target)return;
        const Stripe=await loadStripeJs();
        if(!Stripe)throw new Error('Stripe could not be loaded');
        if(!pay.publishableKey)throw new Error('Payments are not configured. Please contact our team.');
        const instance=await Stripe(pay.publishableKey).initEmbeddedCheckout({clientSecret:pay.clientSecret});
        if(cancelled){instance.destroy();return;}
        instance.mount(target);
        embeddedRef.current=instance;
        setPayReady(true);
      }catch(error){
        if(!cancelled)dispatch({t:'ERROR',v:error instanceof Error?error.message:'We could not open the secure payment form.'});
      }
    })();
    return()=>{
      cancelled=true;
      try{embeddedRef.current?.destroy();}catch{}
      embeddedRef.current=null;
    };
  },[step,pay]);

  /** Abandon the open payment session and return to the review step. */
  function cancelPayment(){
    try{embeddedRef.current?.destroy();}catch{}
    embeddedRef.current=null;
    setPayReady(false);
    setPay(null);
    submittingRef.current=false;
    dispatch({t:'ERROR',v:''});
  }

  const localDueNow=(plan?plan.unitAmount*s.quantity:0)+selectedAddOns.reduce((sum,a)=>sum+a.unitAmount,0);
  const localRecurring=(plan?.billingType==='RECURRING'?plan.unitAmount*s.quantity:0)+selectedAddOns.filter(a=>a.billingType==='RECURRING').reduce((sum,a)=>sum+a.unitAmount,0);
  const recurringPlan=plan?.billingType==='RECURRING'||selectedAddOns.some(a=>a.billingType==='RECURRING');

  const items=useCallback(()=>{
    const startAt=plan?.requiresSchedule&&s.date&&s.time?new Date(s.date+'T'+to24(s.time)+':00').toISOString():undefined;
    return [
      ...(plan?[{planSlug:plan.slug,quantity:s.quantity,...(startAt?{startAt}:{})}]:[]),
      ...selectedAddOns.map(a=>({planSlug:a.slug,quantity:1})),
    ];
  },[plan,s.quantity,s.date,s.time,selectedAddOns]);

  /** Server-confirmed price. Nothing in this dialog can change what is charged. */
  const refreshQuote=useCallback(async()=>{
    if(!plan||!s.email.trim())return;
    setQuoting(true);
    try{
      const res=await fetch(PUBLIC_API_URL+'/billing/quote',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({customerName:(s.firstName+' '+s.lastName).trim()||'Guest',customerEmail:s.email.trim(),items:items(),...(s.coupon.trim()?{couponCode:s.coupon.trim()}:{})})});
      const body=await res.json();
      if(!res.ok)throw new Error(Array.isArray(body?.message)?body.message.join(' '):body?.message||'We could not price this selection.');
      setQuote(body);
      dispatch({t:'ERROR',v:''});
    }catch(error){
      setQuote(null);
      dispatch({t:'ERROR',v:error instanceof Error?error.message:'We could not price this selection.'});
    }finally{setQuoting(false);}
  },[plan,items,s.email,s.firstName,s.lastName,s.coupon]);

  const canNext=()=>{
    if(step==='service')return Boolean(s.serviceType);
    if(step==='plan')return Boolean(s.planSlug)||catalogError;
    if(step==='schedule')return Boolean(s.date&&s.time);
    return true;
  };

  async function submit(){
    if(submittingRef.current)return;
    const customerName=(s.firstName.trim()+' '+s.lastName.trim()).trim();
    const requestMode=!plan&&catalogError;
    if(!s.firstName.trim()||!s.lastName.trim()||customerName.length>200||!s.email.trim()||!formRef.current?.reportValidity()){dispatch({t:'ERROR',v:'Enter your first name, last name, and a valid email address.'});return;}
    if(!s.terms){dispatch({t:'ERROR',v:recurringPlan?'Please accept the terms and the recurring billing notice to continue.':'Please accept the Terms of Use to continue.'});return;}
    if(!plan&&!requestMode){dispatch({t:'ERROR',v:'Please go back and choose a package.'});return;}
    if(plan?.requiresSchedule){
      const today=new Date();today.setHours(0,0,0,0);
      if(!/^\d{4}-\d{2}-\d{2}$/.test(s.date)||new Date(s.date+'T00:00:00')<today||!TIME_SLOTS.includes(s.time)){dispatch({t:'ERROR',v:'Please go back and choose a current or future date and time.'});return;}
    }
    submittingRef.current=true;
    dispatch({t:'SUBMITTING'});
    if(requestMode){
      try{
        await sendInquiry({name:customerName,email:s.email.trim(),phone:s.phone.trim(),service:serviceLabel(s.serviceType||'general'),message:'Booking request (live catalog unavailable). Service: '+serviceLabel(s.serviceType||'general')+(s.date?'. Preferred date: '+s.date+' at '+s.time:'')+(s.notes.trim()?' Notes: '+s.notes.trim():''),website:''});
        setRequestSent(true);
      }catch(error){dispatch({t:'ERROR',v:error instanceof Error?error.message:'We could not send your request. Please call (773) 986-1908.'});}
      submittingRef.current=false;
      return;
    }
    try{
      const res=await fetch(PUBLIC_API_URL+'/billing/checkout',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({
        customerName,
        customerEmail:s.email.trim(),
        ...(s.phone.trim()?{customerPhone:s.phone.trim()}:{}),
        items:items(),
        ...(s.coupon.trim()?{couponCode:s.coupon.trim()}:{}),
        ...(s.circle.trim()?{membershipCircle:s.circle.trim()}:{}),
        ...(s.notes.trim()?{notes:s.notes.trim()}:{}),
        ...(recurringPlan?{acceptRecurringTerms:true}:{}),
        embedded:true,
      })});
      const body=await res.json();
      if(!res.ok)throw new Error(Array.isArray(body?.message)?body.message.join(' '):body?.message||'Checkout could not be started. Please try again.');
      /* Preferred path: Stripe's payment form opens inside this dialog. */
      if(body.clientSecret){
        setPay({clientSecret:body.clientSecret,publishableKey:body.publishableKey||''});
        dispatch({t:'ERROR',v:''});
        submittingRef.current=false;
        return;
      }
      /* Fallback: Stripe's hosted page is an external destination. */
      if(body.checkoutUrl){window.location.href=body.checkoutUrl;return;}
      router.push('/booking-confirmation/?order='+encodeURIComponent(body.orderId));
    }catch(error){dispatch({t:'ERROR',v:error instanceof Error?error.message:'Something went wrong. Please try again.'});submittingRef.current=false;}
  }

  const progress=((stepIndex+1)/steps.length)*100;

  return(
    <dialog ref={dialogRef} className={'bk-overlay'+(closing?' is-closing':'')} aria-modal="true" aria-labelledby={titleId} data-lenis-prevent onCancel={e=>{e.preventDefault();closeRef.current();}} onClick={e=>{if(e.target===e.currentTarget)requestClose();}}>
      <div className="bk-modal">
        <header className="bk-header">
          <div className="bk-header-top">
            <span className="bk-brand"><span className="bk-brand-mark">WJ</span>Workspace Junction</span>
            <button type="button" className="bk-close" onClick={requestClose} aria-label="Close"><X size={18} aria-hidden="true"/></button>
          </div>
          <ol className="bk-stepper" aria-label="Checkout steps">
            {steps.map((entry,index)=>(
              <li key={entry} className={'bk-stepper-item'+(index===stepIndex?' is-current':'')+(index<stepIndex?' is-done':'')} aria-current={index===stepIndex?'step':undefined}>
                <span className="bk-stepper-dot" aria-hidden="true">{index<stepIndex?<Check size={13} strokeWidth={3}/>:index+1}</span>
                <span className="bk-stepper-label">{STEP_LABELS[entry]}</span>
              </li>
            ))}
          </ol>
          <div className="bk-headline">
            {stepIndex>0&&<button type="button" className="bk-back" disabled={s.submitting&&step!=='pay'} onClick={()=>step==='pay'?cancelPayment():dispatch({t:'BACK'})} aria-label={step==='pay'?'Cancel payment and go back':'Go back'}><ArrowLeft size={17} aria-hidden="true"/></button>}
            <div className="bk-header-info">
              <h2 className="bk-title" id={titleId} ref={titleRef} tabIndex={-1}>{STEP_TITLES[step]}</h2>
              <p className="bk-subtitle">{STEP_HINTS[step]}</p>
            </div>
          </div>
        </header>
        <div className="bk-progress" role="progressbar" aria-label="Checkout progress" aria-valuenow={stepIndex+1} aria-valuemin={1} aria-valuemax={steps.length}>
          <div className="bk-progress-fill" style={{width:progress+'%'}}/>
        </div>
        <div className="bk-layout">
        <form ref={formRef} className="bk-body" data-lenis-prevent aria-busy={s.submitting} onSubmit={e=>{e.preventDefault();if(step==='review')void submit();}}>
          {catalogError&&(
            <div className="bk-fallback-banner" role="status">
              <p><strong>Note:</strong> Our live package catalog is refreshing, so payment is unavailable right now. You can still send a reservation request below, or call us at (773) 986-1908.</p>
            </div>
          )}
          {!catalog&&!catalogError&&<p className="bk-step-label" role="status">Loading current packages&hellip;</p>}

          <div className="bk-step-content" key={step}>
          {step==='service'&&(
            <div className="bk-type-grid">
              {services.map(entry=>(
                <button key={entry.key} type="button" aria-pressed={s.serviceType===entry.key} className={'bk-type-card'+(s.serviceType===entry.key?' selected':'')} onClick={()=>dispatch({t:'SET_SERVICE',v:entry.key})}>
                  <span className="bk-type-icon"><entry.Icon size={28} strokeWidth={1.8} aria-hidden="true"/></span>
                  <span className="bk-type-name">{entry.label}</span>
                </button>
              ))}
            </div>
          )}

          {step==='plan'&&(
            <>
              {servicePlans.length===0?(
                <div className="bk-plan-fallback">
                  <p>No packages are published for this service yet. Our team will confirm options and availability for you.</p>
                  <p className="bk-plan-fallback-note">Continue to send a request instead.</p>
                </div>
              ):(
                <div className="bk-plan-grid">
                  {servicePlans.map(p=>(
                    <button key={p.slug} type="button" aria-pressed={s.planSlug===p.slug} className={['bk-plan-card',p.billingType==='RECURRING'?'featured':'',s.planSlug===p.slug?'selected':''].join(' ').trim()} onClick={()=>{dispatch({t:'SET_PLAN',v:p.slug,quantity:p.minQuantity||1});setQuote(null);}}>
                      {p.billingType==='RECURRING'&&<span className="bk-plan-badge">Subscription</span>}
                      <div className="bk-plan-name">{p.name}</div>
                      <div className="bk-plan-price">{money(p.unitAmount,p.currency)}</div>
                      <div className="bk-plan-period">{priceSuffix(p)}</div>
                      <div className="bk-plan-desc">{p.description}</div>
                    </button>
                  ))}
                </div>
              )}
              {plan&&(
                <div className="bk-plan-details-box">
                  <div className="bk-detail-header">
                    <span className="bk-detail-name">{plan.name}</span>
                    <span className="bk-detail-price">{money(plan.unitAmount,currency)}<small style={{fontSize:14,fontWeight:400}}> {priceSuffix(plan)}</small></span>
                  </div>
                  {plan.description&&<p className="bk-detail-desc">{plan.description}</p>}
                  {plan.billingType==='RECURRING'&&<p className="bk-detail-desc"><strong>This is a subscription.</strong> It renews {plan.intervalDescription} automatically until you cancel. You can stop renewal any time from your account.</p>}
                  {plan.requiresOnboarding&&<p className="bk-detail-desc">This service needs a short onboarding step after payment; our team will reach out to complete it.</p>}
                  {plan.maxQuantity>1&&(
                    <div className="bk-field bk-qty-field">
                      <label className="bk-label" htmlFor="bk-qty">{plan.pricingUnit==='HOUR'?'How many hours?':'Quantity'}</label>
                      <input id="bk-qty" className="bk-input" type="number" min={plan.minQuantity} max={plan.maxQuantity} value={s.quantity} onChange={e=>{dispatch({t:'SET_FIELD',k:'quantity',v:Math.max(plan.minQuantity,Math.min(plan.maxQuantity,Number(e.target.value)||plan.minQuantity))});setQuote(null);}}/>
                      <p className="bk-plan-fallback-note">{money(plan.unitAmount*s.quantity,currency)} total{plan.pricingUnit==='HOUR'?' for '+s.quantity+' hour'+(s.quantity===1?'':'s'):''}</p>
                    </div>
                  )}
                  {plan.includedCredits?.length>0&&(
                    <>
                      <div className="bk-amenities-title">Included benefits</div>
                      <div className="bk-amenities-grid">
                        {plan.includedCredits.map(credit=>(
                          <div key={credit.kind} className="bk-amenity"><span className="bk-amenity-icon"><Ticket size={16} strokeWidth={2} aria-hidden="true"/></span><span>{creditLabel(credit)}</span></div>
                        ))}
                      </div>
                    </>
                  )}
                  <div className="bk-amenities-title">What&apos;s included</div>
                  <div className="bk-amenities-grid">
                    {AMENITIES.map(a=>(
                      <div key={a.name} className="bk-amenity"><span className="bk-amenity-icon"><a.icon size={16} strokeWidth={2} aria-hidden="true"/></span><span>{a.name}</span></div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {step==='addons'&&(
            <>
              <div className="bk-addons-grid">
                {addOnPlans.map(a=>{
                  const sel=s.addOns.includes(a.slug);
                  return(
                    <button type="button" key={a.slug} className={'bk-addon'+(sel?' selected':'')} role="checkbox" aria-checked={sel} onClick={()=>{dispatch({t:'TOGGLE_ADDON',v:a.slug});setQuote(null);}}>
                      <span className="bk-addon-icon"><Package size={22} strokeWidth={1.8} aria-hidden="true"/></span>
                      <div className="bk-addon-info">
                        <div className="bk-addon-name">{a.name}</div>
                        <div className="bk-addon-desc">{a.description||priceSuffix(a)}</div>
                      </div>
                      <span className="bk-addon-price">+{money(a.unitAmount,a.currency)}</span>
                      <span className="bk-addon-check">{sel&&<Check size={13} strokeWidth={2.5} aria-hidden="true"/>}</span>
                    </button>
                  );
                })}
              </div>
              <div className="bk-summary">
                <div className="bk-summary-title">Summary</div>
                <div className="bk-summary-row"><span>{plan?.name}</span><span>{plan?money(plan.unitAmount*s.quantity,currency):'—'}</span></div>
                {selectedAddOns.map(a=><div key={a.slug} className="bk-summary-row"><span>{a.name}</span><span>+{money(a.unitAmount,a.currency)}</span></div>)}
                <div className="bk-summary-row total"><span>Due today</span><span>{money(localDueNow,currency)}</span></div>
              </div>
            </>
          )}

          {step==='schedule'&&(
            <>
              <CalendarPicker selected={s.date} onChange={v=>{dispatch({t:'SET_FIELD',k:'date',v});setQuote(null);}}/>
              {s.date&&(
                <div className="bk-time-section">
                  <div className="bk-time-title">Select a start time{plan?.pricingUnit==='HOUR'?' ('+s.quantity+' hour'+(s.quantity===1?'':'s')+')':plan?.durationMinutes?' ('+plan.durationMinutes+' minutes)':''}</div>
                  <div className="bk-time-grid">
                    {TIME_SLOTS.map(ts=>(
                      <button key={ts} type="button" aria-pressed={s.time===ts} className={'bk-time-slot'+(s.time===ts?' selected':'')} onClick={()=>{dispatch({t:'SET_FIELD',k:'time',v:ts});setQuote(null);}}>{ts}</button>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {step==='review'&&(
            <>
              <div className="bk-field">
                <label className="bk-label" htmlFor="bk-email">Email Address</label>
                <input id="bk-email" className="bk-input" type="email" placeholder="you@example.com" autoComplete="email" maxLength={254} readOnly={s.submitting} value={s.email} onChange={e=>dispatch({t:'SET_FIELD',k:'email',v:e.target.value})} onBlur={()=>void refreshQuote()} required/>
              </div>
              <div className="bk-row-2">
                <div className="bk-field">
                  <label className="bk-label" htmlFor="bk-first">First Name</label>
                  <input id="bk-first" className="bk-input" type="text" placeholder="Jane" autoComplete="given-name" maxLength={99} readOnly={s.submitting} pattern=".*\S.*" value={s.firstName} onChange={e=>dispatch({t:'SET_FIELD',k:'firstName',v:e.target.value})} required/>
                </div>
                <div className="bk-field">
                  <label className="bk-label" htmlFor="bk-last">Last Name</label>
                  <input id="bk-last" className="bk-input" type="text" placeholder="Smith" autoComplete="family-name" maxLength={100} readOnly={s.submitting} pattern=".*\S.*" value={s.lastName} onChange={e=>dispatch({t:'SET_FIELD',k:'lastName',v:e.target.value})} required/>
                </div>
              </div>
              <div className="bk-row-2">
                <div className="bk-field">
                  <label className="bk-label" htmlFor="bk-phone">Phone (optional)</label>
                  <input id="bk-phone" className="bk-input" type="tel" placeholder="+1 (555) 000-0000" autoComplete="tel" maxLength={50} readOnly={s.submitting} value={s.phone} onChange={e=>dispatch({t:'SET_FIELD',k:'phone',v:e.target.value})}/>
                </div>
                {plan?.serviceType==='memberships'?(
                  <div className="bk-field">
                    <label className="bk-label" htmlFor="bk-circle">Membership circle (optional)</label>
                    <input id="bk-circle" className="bk-input" type="text" placeholder="Which circle would you like to join?" maxLength={120} readOnly={s.submitting} value={s.circle} onChange={e=>dispatch({t:'SET_FIELD',k:'circle',v:e.target.value})}/>
                  </div>
                ):(
                  <div className="bk-field">
                    <label className="bk-label" htmlFor="bk-notes">Notes (optional)</label>
                    <input id="bk-notes" className="bk-input" type="text" placeholder="Anything we should know?" maxLength={5000} readOnly={s.submitting} value={s.notes} onChange={e=>dispatch({t:'SET_FIELD',k:'notes',v:e.target.value})}/>
                  </div>
                )}
              </div>
              {plan&&(
                <div className="bk-row-2">
                  <div className="bk-field">
                    <label className="bk-label" htmlFor="bk-coupon">Coupon code (optional)</label>
                    <input id="bk-coupon" className="bk-input" type="text" placeholder="SAVE10" autoComplete="off" maxLength={100} readOnly={s.submitting} value={s.coupon} onChange={e=>dispatch({t:'SET_FIELD',k:'coupon',v:e.target.value})} onBlur={()=>void refreshQuote()}/>
                  </div>
                  <div className="bk-field bk-quote-action">
                    <span className="bk-label">Confirm your price</span>
                    <button type="button" className="bk-btn bk-btn-ghost" disabled={!s.email.trim()||quoting} onClick={()=>void refreshQuote()}>{quoting?'Checking…':'Review price'}</button>
                  </div>
                </div>
              )}
              {requestSent&&<div className="bk-plan-fallback" role="status"><p><strong>Request sent.</strong> Our team will contact you to confirm availability and pricing. No payment has been taken.</p></div>}
              <div className="bk-checkout-summary" aria-live="polite">
                <div className="bk-summary-row"><span>{serviceLabel(s.serviceType)}</span><span/></div>
                <div className="bk-summary-row"><span>{plan?.name||'Reservation request'}</span><span>{plan?money(plan.unitAmount*s.quantity,currency):'—'}</span></div>
                {selectedAddOns.map(a=><div key={a.slug} className="bk-summary-row"><span>{a.name}</span><span>+{money(a.unitAmount,a.currency)}</span></div>)}
                {plan?.requiresSchedule&&s.date&&<div className="bk-summary-row"><span>Reserved</span><span>{s.date}{s.time?', '+s.time:''}</span></div>}
                {quote&&quote.discountAmount>0&&(
                  <div className="bk-summary-row">
                    <span>Discount{quote.discountDuration==='once'?' (first charge only)':quote.discountDuration==='forever'?' (every charge)':quote.discountDuration==='repeating'?' ('+quote.discountDurationInMonths+' months)':''}</span>
                    <span>−{money(quote.discountAmount,quote.currency)}</span>
                  </div>
                )}
                {plan&&<div className="bk-summary-row total"><span>Due today</span><span>{money(quote?quote.dueNowAmount:localDueNow,currency)}</span></div>}
                {(quote?quote.recurringAmount:localRecurring)>0&&(
                  <div className="bk-summary-row"><span>Then</span><span>{money(quote?quote.recurringAmount:localRecurring,currency)} {quote?.recurringDescription||plan?.intervalDescription}</span></div>
                )}
                {plan&&!quote&&<div className="bk-summary-row"><span className="bk-plan-fallback-note">Final amount is confirmed by our server before payment.</span><span/></div>}
              </div>
              <label className="bk-terms">
                <input type="checkbox" required disabled={s.submitting} checked={s.terms} onChange={e=>dispatch({t:'SET_FIELD',k:'terms',v:e.target.checked})}/>
                <span className="bk-terms-copy">
                  I agree to the <a href="/terms-and-privacy" target="_blank" rel="noopener noreferrer">Terms of Use</a> and <a href="/terms-and-privacy" target="_blank" rel="noopener noreferrer">Privacy Notice</a>
                {plan
                  ?recurringPlan
                    ?<>, and I understand this is a subscription of {money(quote?quote.recurringAmount:localRecurring,currency)} {plan.intervalDescription}, charged automatically until I cancel. I can stop renewal any time from my account; access continues to the end of the paid period and the current period is not refunded.</>
                    :<>, and authorize the one-time payment of {money(quote?quote.dueNowAmount:localDueNow,currency)} shown above</>
                  :<>, and understand this is a reservation request, not a confirmed booking</>}
                </span>
              </label>
              {s.error&&<p className="bk-error-msg" role="alert">{s.error}</p>}
              <button type="submit" className="bk-submit-btn" disabled={s.submitting||requestSent||(!catalog&&!catalogError)}>
                {plan?(s.submitting?'Opening secure payment…':'Continue to payment'):(requestSent?'Request sent':s.submitting?'Sending request…':'Send booking request')}
              </button>
              <p className="bk-plan-fallback-note">Payments are processed by Stripe. Card details never reach our servers.</p>
            </>
          )}
          {step==='pay'&&(
            <div className="bk-pay">
              <div className="bk-pay-head">
                <span>Paying now</span>
                <strong>{money(quote?quote.dueNowAmount:localDueNow,currency)}</strong>
              </div>
              {!payReady&&<p className="bk-status" role="status">Opening Stripe&rsquo;s secure payment form&hellip;</p>}
              <div ref={payMountRef} className={'bk-pay-mount'+(payReady?' is-ready':'')} aria-busy={!payReady}/>
              {s.error&&<p className="bk-error-msg" role="alert">{s.error}</p>}
              <button type="button" className="bk-btn bk-btn-ghost bk-pay-cancel" onClick={cancelPayment}>Back to review</button>
              <p className="bk-plan-fallback-note">Payment is processed by Stripe. Your card details are entered directly into Stripe&rsquo;s own form and never reach our servers.</p>
            </div>
          )}
          </div>
        </form>
          <aside className="bk-rail" aria-label="Your selection">
            <p className="bk-rail-title">Your selection</p>
            <dl className="bk-rail-list">
              <div><dt>Service</dt><dd>{s.serviceType?serviceLabel(s.serviceType):'Not chosen yet'}</dd></div>
              <div><dt>Package</dt><dd>{plan?plan.name:'Not chosen yet'}</dd></div>
              {plan&&plan.maxQuantity>1&&<div><dt>{plan.pricingUnit==='HOUR'?'Hours':'Quantity'}</dt><dd>{s.quantity}</dd></div>}
              {selectedAddOns.length>0&&<div><dt>Extras</dt><dd>{selectedAddOns.map(a=>a.name).join(', ')}</dd></div>}
              {plan?.requiresSchedule&&<div><dt>When</dt><dd>{s.date?s.date+(s.time?' · '+s.time:''):'Not chosen yet'}</dd></div>}
            </dl>
            <div className="bk-rail-total">
              <span>Due today</span>
              <strong>{plan?money(quote?quote.dueNowAmount:localDueNow,currency):'—'}</strong>
            </div>
            {(quote?quote.recurringAmount:localRecurring)>0&&(
              <p className="bk-rail-recurring">then {money(quote?quote.recurringAmount:localRecurring,currency)} {quote?.recurringDescription||plan?.intervalDescription}, until you cancel</p>
            )}
            {plan?.includedCredits?.length?(
              <ul className="bk-rail-credits">{plan.includedCredits.map(credit=><li key={credit.kind}><Check size={13} strokeWidth={3} aria-hidden="true"/>{creditLabel(credit)}</li>)}</ul>
            ):null}
            <p className="bk-rail-note"><Lock size={13} aria-hidden="true"/> Secure payment by Stripe. Prices are confirmed by our server before you pay.</p>
          </aside>
        </div>
        {step!=='review'&&step!=='pay'&&(
          <footer className="bk-footer">
            <div className="bk-footer-price">
              {plan?<><span>Due today</span><strong>{money(localDueNow,currency)}</strong>{localRecurring>0&&<small>then {money(localRecurring,currency)} {plan.intervalDescription}</small>}</>:<span>Choose a package to see pricing</span>}
            </div>
            <div className="bk-footer-actions">
              {stepIndex>0&&<button type="button" className="bk-btn bk-btn-ghost" onClick={()=>dispatch({t:'BACK'})}>Back</button>}
              <button type="button" className="bk-btn bk-btn-primary" disabled={!canNext()} onClick={()=>dispatch({t:'NEXT',max:steps.length-1})}>
                {steps[stepIndex+1]==='review'?(plan?'Review & pay':'Review request'):'Continue'}
                <ChevronRight size={16} aria-hidden="true"/>
              </button>
            </div>
          </footer>
        )}
      </div>
    </dialog>
  );
}
