'use client';
import {PUBLIC_API_URL} from '@/lib/public-api';
import './booking-dialog.css';
import {sendInquiry} from './forms';
import {useEffect,useReducer,useState,useRef,useId} from 'react';
import {ArrowLeft,Bot,Briefcase,Building2,CalendarDays,Car,Check,ChevronLeft,ChevronRight,Coffee,DoorOpen,Dumbbell,Globe2,Handshake,Lock,Mail,Mic,Monitor,Package,PartyPopper,Phone,Printer,Radio,Store,Ticket,Utensils,Wifi,Wrench,X} from 'lucide-react';

const WORKSPACE_TYPES=[
  {id:'hot-desk',icon:Briefcase,name:'Hot Desk'},
  {id:'dedicated-desk',icon:Monitor,name:'Dedicated Desk'},
  {id:'private-office',icon:DoorOpen,name:'Private Office'},
  {id:'virtual-office',icon:Mail,name:'Virtual Office'},
  {id:'day-office',icon:CalendarDays,name:'Day Office'},
  {id:'meeting-room',icon:Handshake,name:'Meeting Room'},
  {id:'conference-room',icon:Building2,name:'Conference Room'},
  {id:'event-space',icon:PartyPopper,name:'Event Space'},
  {id:'podcast-studio',icon:Mic,name:'Podcast Studio'},
  {id:'coworking-space',icon:Globe2,name:'Coworking Space'},
  {id:'trade-show',icon:Store,name:'Trade Show'},
  {id:'workshop-space',icon:Wrench,name:'Workshop Space'},
  {id:'webinar-studio',icon:Radio,name:'Webinar Studio'},
];

// Plan/add-on names, descriptions and prices come from the server's own
// catalog (fetched below), which is also the only source the payment itself
// can charge from. This UI-only badge map never affects price.
const PLAN_BADGES:Record<string,string>={silver:'Popular'};

const AMENITIES=[
  {icon:Wifi,name:'High-Speed WiFi'},
  {icon:Coffee,name:'Coffee & Tea'},
  {icon:Printer,name:'Printing'},
  {icon:Phone,name:'Phone Booths'},
  {icon:Lock,name:'24/7 Access'},
  {icon:Car,name:'Parking'},
  {icon:Dumbbell,name:'Fitness Center'},
  {icon:Utensils,name:'Kitchen'},
];

const ADDON_ICONS:Record<string,typeof Printer>={printing:Printer,storage:Package,mail:Mail,podcast:Mic,assistant:Bot,events:Ticket};

interface CatalogPlan{id:string;name:string;amountCents:number;period:string;description:string;featured:boolean}
interface CatalogAddOn{id:string;name:string;amountCents:number;description:string}
interface Catalog{currency:string;plans:CatalogPlan[];addOns:CatalogAddOn[]}

function money(cents:number,currency='USD'):string{return (cents/100).toLocaleString('en-US',{style:'currency',currency:currency.toUpperCase(),maximumFractionDigits:cents%100===0?0:2});}

const TIME_SLOTS=['8:00 AM','9:00 AM','10:00 AM','11:00 AM','12:00 PM','1:00 PM','2:00 PM','3:00 PM','4:00 PM','5:00 PM','6:00 PM','7:00 PM'];

const STEP_TITLES=['Choose Workspace','Select Plan','Add-ons','Preferred Date','Review & Pay'];
const STEP_LABELS=['Workspace Type','Plan & Details','Add-ons','Date & Time','Payment'];

function mapService(s?:string):string{
  if(!s)return '';
  const l=s.toLowerCase();
  // Try an exact multi-word match first ('dedicated desk' only matches
  // dedicated-desk). Only fall back to a loose single-word match (e.g. a bare
  // 'room') when nothing matched the full name, so a shared word in one
  // candidate's id ('hot-desk' contains 'desk') can never outrank an exact
  // phrase match that appears later in the list ('dedicated-desk').
  const full=WORKSPACE_TYPES.find(w=>l.includes(w.id.replace(/-/g,' ')));
  if(full)return full.id;
  const partial=WORKSPACE_TYPES.find(w=>w.id.split('-').some(p=>l.includes(p)));
  return partial?.id||'';
}

interface S{
  step:number;workspaceType:string;planId:string;addons:string[];
  date:string;time:string;
  email:string;firstName:string;lastName:string;phone:string;
  coupon:string;notes:string;terms:boolean;
  submitting:boolean;error:string;
}
type A=
  |{t:'SET_TYPE';v:string}
  |{t:'SET_PLAN';v:string}
  |{t:'TOGGLE_ADDON';v:string}
  |{t:'SET_DATE';v:string}
  |{t:'SET_TIME';v:string}
  |{t:'SET_FIELD';k:keyof S;v:unknown}
  |{t:'NEXT'}
  |{t:'BACK'}
  |{t:'SUBMITTING'}
  |{t:'ERROR';v:string};

function init(service?:string):S{return{step:0,workspaceType:mapService(service),planId:'',addons:[],date:'',time:'',email:'',firstName:'',lastName:'',phone:'',coupon:'',notes:'',terms:false,submitting:false,error:''};}

function reducer(s:S,a:A):S{
  switch(a.t){
    case 'SET_TYPE':return{...s,workspaceType:a.v};
    case 'SET_PLAN':return{...s,planId:a.v};
    case 'TOGGLE_ADDON':{const has=s.addons.includes(a.v);return{...s,addons:has?s.addons.filter(x=>x!==a.v):[...s.addons,a.v]};}
    case 'SET_DATE':return{...s,date:a.v};
    case 'SET_TIME':return{...s,time:a.v};
    case 'SET_FIELD':return{...s,[a.k]:a.v};
    case 'NEXT':return{...s,step:Math.min(s.step+1,4)};
    case 'BACK':return{...s,step:Math.max(s.step-1,0)};
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
      <div className="bk-cal-scroll" tabIndex={0} role="region" aria-label="Calendar dates, scroll horizontally on small screens"><div className="bk-cal-grid">
        {DAY_NAMES.map(n=><div key={n} className="bk-cal-day-name">{n}</div>)}
        {cells.map((d,i)=>d===null?<div key={`e${i}`} className="bk-cal-day empty"/>:<button key={d} type="button" className={['bk-cal-day',isPast(d)?'past':'',selected===toStr(d)?'selected':'',isToday(d)&&selected!==toStr(d)?'today':''].join(' ').trim()} disabled={isPast(d)} aria-label={new Date(yr,mo,d).toLocaleDateString(undefined,{dateStyle:'full'})} aria-pressed={selected===toStr(d)} onClick={()=>!isPast(d)&&onChange(toStr(d))}>{d}</button>)}
      </div></div>
    </div>
  );
}

export function BookingDialog({service,onClose}:{service?:string;onClose:()=>void}){
  const [s,dispatch]=useReducer(reducer,service,init);
  const [catalog,setCatalog]=useState<Catalog|null>(null);
  const [catalogError,setCatalogError]=useState(false);
  const [requestSent,setRequestSent]=useState(false);
  const dialogRef=useRef<HTMLDialogElement>(null);
  const formRef=useRef<HTMLFormElement>(null);
  const titleRef=useRef<HTMLHeadingElement>(null);
  const closeRef=useRef(onClose);
  const submittingRef=useRef(false);
  const titleId=useId();
  useEffect(()=>{closeRef.current=onClose;},[onClose]);
  useEffect(()=>{
    const controller=new AbortController();
    fetch(PUBLIC_API_URL+'/public/booking-catalog',{signal:controller.signal})
      .then(r=>r.ok?r.json():Promise.reject())
      .then(data=>{setCatalog(data);setCatalogError(false);})
      // An aborted request (e.g. React dev-mode double-invoking this effect,
      // or the dialog closing mid-fetch) is not a real failure; only a
      // completed, failed request should show the error banner.
      .catch(error=>{if(error?.name!=='AbortError')setCatalogError(true);});
    return()=>controller.abort();
  },[]);
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
  useEffect(()=>{
    titleRef.current?.focus({preventScroll:true});
    formRef.current?.scrollTo({top:0,behavior:'instant'});
  },[s.step]);

  const plan=catalog?.plans.find(p=>p.id===s.planId);
  const selectedAddOns=(catalog?.addOns||[]).filter(a=>s.addons.includes(a.id));
  const totalCents=(plan?.amountCents||0)+selectedAddOns.reduce((sum,a)=>sum+a.amountCents,0);
  const currency=catalog?.currency||'usd';
  const progress=((s.step+1)/5)*100;

  const canNext=()=>{
    if(s.step===0)return!!s.workspaceType;
    if(s.step===1)return!!s.planId || catalogError;
    if(s.step===3)return!!s.date&&!!s.time;
    return true;
  };

  async function submit(){
    if(submittingRef.current)return;
    const customerName=(s.firstName.trim()+' '+s.lastName.trim()).trim();
    const today=new Date();today.setHours(0,0,0,0);
    const requestMode=!plan&&catalogError;
    if(!WORKSPACE_TYPES.some(w=>w.id===s.workspaceType)||(!plan&&!requestMode)){dispatch({t:'ERROR',v:'Please review your workspace and plan selections.'});return;}
    if(!/^\d{4}-\d{2}-\d{2}$/.test(s.date)||new Date(s.date+'T00:00:00')<today||!TIME_SLOTS.includes(s.time)){dispatch({t:'ERROR',v:'Please go back and choose a current or future preferred date and time.'});return;}
    if(!s.firstName.trim()||!s.lastName.trim()||customerName.length>200||!s.email.trim()||!formRef.current?.reportValidity()){dispatch({t:'ERROR',v:'Enter your first name, last name, and a valid email address.'});return;}
    if(!s.terms){dispatch({t:'ERROR',v:'Please accept the Terms of Use to continue.'});return;}
    submittingRef.current=true;
    dispatch({t:'SUBMITTING'});
    const wt=WORKSPACE_TYPES.find(w=>w.id===s.workspaceType);
    if(requestMode){
      // Catalog (and therefore payment) is unavailable: send a reservation request, never a payment.
      try{
        await sendInquiry({name:customerName,email:s.email.trim(),phone:s.phone.trim(),service:wt?.name||s.workspaceType,message:'Booking request (live catalog unavailable). Workspace: '+(wt?.name||s.workspaceType)+'. Preferred date: '+s.date+' at '+s.time+'.'+(s.notes.trim()?' Notes: '+s.notes.trim():''),website:''});
        setRequestSent(true);
      }catch(e:unknown){dispatch({t:'ERROR',v:e instanceof Error?e.message:'We could not send your request. Please call (773) 986-1908.'});}
      submittingRef.current=false;
      return;
    }
    const body={
      customerName,
      customerEmail:s.email.trim(),
      customerPhone:s.phone.trim()||undefined,
      serviceType:s.workspaceType,
      serviceName:(wt?.name||s.workspaceType)+(plan?' - '+plan.name:''),
      planId:s.planId,
      bookingDate:s.date||undefined,
      bookingTime:s.time||undefined,
      guests:1,
      addOns:s.addons,
      notes:s.notes.trim()||undefined,
      couponCode:s.coupon.trim()||undefined,
    };
    try{
      const res=await fetch(PUBLIC_API_URL+'/bookings',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
      if(!res.ok){const d=await res.json().catch(()=>({}));throw new Error(typeof d?.message==='string'?d.message:'Booking could not be started. Please try again.');}
      const receipt=await res.json();
      if(!receipt?.checkoutUrl)throw new Error('Payment could not be started. Please try again or contact us.');
      // Leaves the page for Stripe's hosted checkout; on return the customer
      // lands on /booking-confirmation, which reads the real payment status.
      window.location.href=receipt.checkoutUrl;
    }catch(e:unknown){dispatch({t:'ERROR',v:e instanceof Error?e.message:'Something went wrong. Please try again.'});submittingRef.current=false;}
  }

  return(
    <dialog ref={dialogRef} className="bk-overlay" aria-modal="true" aria-labelledby={titleId} data-lenis-prevent onCancel={e=>{e.preventDefault();closeRef.current();}} onClick={e=>{if(e.target===e.currentTarget)onClose();}}>
      <div className="bk-modal">
        <div className="bk-header">
          {s.step>0&&<button type="button" className="bk-back" disabled={s.submitting} onClick={()=>dispatch({t:'BACK'})} aria-label="Go back"><ArrowLeft size={17} aria-hidden="true"/></button>}
          <div className="bk-header-info">
            <p className="bk-step-label">Step {s.step+1} of 5 - {STEP_LABELS[s.step]}</p>
            <h2 className="bk-title" id={titleId} ref={titleRef} tabIndex={-1}>{STEP_TITLES[s.step]}</h2>
          </div>
          <button type="button" className="bk-close" onClick={onClose} aria-label="Close"><X size={18} aria-hidden="true"/></button>
        </div>
        <div className="bk-progress" role="progressbar" aria-label="Request progress" aria-valuenow={s.step+1} aria-valuemin={1} aria-valuemax={5}>
          <div className="bk-progress-fill" style={{width:progress+'%'}}/>
        </div>
        <form ref={formRef} className="bk-body" data-lenis-prevent aria-busy={s.submitting} onSubmit={e=>{e.preventDefault();if(s.step===4)void submit();}}>
          {catalogError&&(
            <div className="bk-fallback-banner" role="status">
              <p><strong>Note:</strong> Live booking catalog is refreshing. You can still choose your preferred workspace below to submit your reservation request, or call us at (773) 986-1908 for immediate booking.</p>
            </div>
          )}
          {s.step===0&&(
            <div className="bk-type-grid">
              {WORKSPACE_TYPES.map(wt=>(
                <button key={wt.id} type="button" aria-pressed={s.workspaceType===wt.id} className={'bk-type-card'+(s.workspaceType===wt.id?' selected':'')} onClick={()=>dispatch({t:'SET_TYPE',v:wt.id})}>
                  <span className="bk-type-icon"><wt.icon size={28} strokeWidth={1.8} aria-hidden="true"/></span>
                  <span className="bk-type-name">{wt.name}</span>
                </button>
              ))}
            </div>
          )}
          {s.step===1&&(
            <>
              {catalogError && (!catalog?.plans || catalog.plans.length === 0) ? (
                <div className="bk-plan-fallback">
                  <p>Our team will confirm package options and availability for your selected workspace ({WORKSPACE_TYPES.find(w=>w.id===s.workspaceType)?.name || 'selected workspace'}).</p>
                  <p className="bk-plan-fallback-note">Click Continue to select your preferred date and time.</p>
                </div>
              ) : (
                <div className="bk-plan-grid">
                  {(catalog?.plans||[]).map(p=>(
                    <button key={p.id} type="button" aria-pressed={s.planId===p.id} className={['bk-plan-card',p.featured?'featured':'',s.planId===p.id?'selected':''].join(' ').trim()} onClick={()=>dispatch({t:'SET_PLAN',v:p.id})}>
                      {PLAN_BADGES[p.id]&&<span className="bk-plan-badge">{PLAN_BADGES[p.id]}</span>}
                      <div className="bk-plan-name">{p.name}</div>
                      <div className="bk-plan-price">{money(p.amountCents,catalog?.currency)}</div>
                      <div className="bk-plan-period">{p.period}</div>
                      <div className="bk-plan-desc">{p.description}</div>
                    </button>
                  ))}
                </div>
              )}
              {plan&&(
                <div className="bk-plan-details-box">
                  <div className="bk-detail-header">
                    <span className="bk-detail-name">{plan.name} Plan Details</span>
                    <span className="bk-detail-price">{money(plan.amountCents,currency)}<small style={{fontSize:14,fontWeight:400}}>{plan.period}</small></span>
                  </div>
                  <p className="bk-detail-desc">{plan.description}</p>
                  <div className="bk-amenities-title">What&apos;s included</div>
                  <div className="bk-amenities-grid">
                    {AMENITIES.map(a=>(
                      <div key={a.name} className="bk-amenity">
                        <span className="bk-amenity-icon"><a.icon size={16} strokeWidth={2} aria-hidden="true"/></span>
                        <span>{a.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
          {s.step===2&&(
            <>
              <div className="bk-addons-grid">
                {(catalog?.addOns||[]).map(a=>{
                  const sel=s.addons.includes(a.id);
                  const Icon=ADDON_ICONS[a.id]||Package;
                  return(
                    <button type="button" key={a.id} className={'bk-addon'+(sel?' selected':'')} role="checkbox" aria-checked={sel} onClick={()=>dispatch({t:'TOGGLE_ADDON',v:a.id})}>
                      <span className="bk-addon-icon"><Icon size={22} strokeWidth={1.8} aria-hidden="true"/></span>
                      <div className="bk-addon-info">
                        <div className="bk-addon-name">{a.name}</div>
                        <div className="bk-addon-desc">{a.description}</div>
                      </div>
                      <span className="bk-addon-price">+{money(a.amountCents,currency)}</span>
                      <span className="bk-addon-check">{sel&&<Check size={13} strokeWidth={2.5} aria-hidden="true"/>}</span>
                    </button>
                  );
                })}
              </div>
              <div className="bk-summary">
                <div className="bk-summary-title">Summary</div>
                <div className="bk-summary-row"><span>{plan?.name} Plan</span><span>{plan?money(plan.amountCents,currency):'—'}</span></div>
                {selectedAddOns.map(a=><div key={a.id} className="bk-summary-row"><span>{a.name}</span><span>+{money(a.amountCents,currency)}</span></div>)}
                <div className="bk-summary-row total"><span>Total due now</span><span>{money(totalCents,currency)}</span></div>
              </div>
            </>
          )}
          {s.step===3&&(
            <>
              <CalendarPicker selected={s.date} onChange={v=>dispatch({t:'SET_DATE',v})}/>
              {s.date&&(
                <div className="bk-time-section">
                  <div className="bk-time-title">Select preferred time</div>
                  <div className="bk-time-grid">
                    {TIME_SLOTS.map(ts=>(
                      <button key={ts} type="button" aria-pressed={s.time===ts} className={'bk-time-slot'+(s.time===ts?' selected':'')} onClick={()=>dispatch({t:'SET_TIME',v:ts})}>{ts}</button>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
          {s.step===4&&(
            <>
              <div className="bk-field">
                <label className="bk-label" htmlFor="bk-email">Email Address</label>
                <input id="bk-email" className="bk-input" type="email" placeholder="you@example.com" autoComplete="email" maxLength={254} readOnly={s.submitting} value={s.email} onChange={e=>dispatch({t:'SET_FIELD',k:'email',v:e.target.value})} required/>
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
              <div className="bk-field">
                <label className="bk-label" htmlFor="bk-phone">Phone (optional)</label>
                <input id="bk-phone" className="bk-input" type="tel" placeholder="+1 (555) 000-0000" autoComplete="tel" maxLength={50} readOnly={s.submitting} value={s.phone} onChange={e=>dispatch({t:'SET_FIELD',k:'phone',v:e.target.value})}/>
              </div>
              {requestSent?(
                <div className="bk-plan-fallback" role="status"><p><strong>Request sent.</strong> Our team will contact you to confirm availability and pricing. No payment has been taken.</p></div>
              ):null}
              <div className="bk-row-2">
                <div className="bk-field" hidden={!plan}>
                  <label className="bk-label" htmlFor="bk-coupon">Coupon code (optional)</label>
                  <input id="bk-coupon" className="bk-input" type="text" placeholder="SAVE10" autoComplete="off" maxLength={100} readOnly={s.submitting} value={s.coupon} onChange={e=>dispatch({t:'SET_FIELD',k:'coupon',v:e.target.value})}/>
                </div>
                <div className="bk-field">
                  <label className="bk-label" htmlFor="bk-notes">Notes (optional)</label>
                  <input id="bk-notes" className="bk-input" type="text" placeholder="Anything we should know?" maxLength={5000} readOnly={s.submitting} value={s.notes} onChange={e=>dispatch({t:'SET_FIELD',k:'notes',v:e.target.value})}/>
                </div>
              </div>
              <div className="bk-checkout-summary">
                <div className="bk-summary-row"><span>{WORKSPACE_TYPES.find(w=>w.id===s.workspaceType)?.name}</span><span/></div>
                <div className="bk-summary-row"><span>{plan?.name} Plan</span><span>{plan?money(plan.amountCents,currency):'—'}</span></div>
                {selectedAddOns.map(a=><div key={a.id} className="bk-summary-row"><span>{a.name}</span><span>+{money(a.amountCents,currency)}</span></div>)}
                {s.date&&<div className="bk-summary-row"><span>Preferred date</span><span>{s.date}{s.time?', '+s.time:''}</span></div>}
                {plan&&<div className="bk-summary-row total"><span>Total due now</span><span>{money(totalCents,currency)}</span></div>}
              </div>
              <label className="bk-terms">
                <input type="checkbox" required disabled={s.submitting} checked={s.terms} onChange={e=>dispatch({t:'SET_FIELD',k:'terms',v:e.target.checked})}/>
                I agree to the <a href="/terms-and-privacy" target="_blank" rel="noopener noreferrer">Terms of Use</a> and <a href="/terms-and-privacy" target="_blank" rel="noopener noreferrer">Privacy Notice</a>{plan?<>, and authorize payment of {money(totalCents,currency)} shown above</>:<>, and understand this is a reservation request, not a confirmed booking</>}
              </label>
              {s.error&&<p className="bk-error-msg" role="alert">{s.error}</p>}
              <button type="submit" className="bk-submit-btn" disabled={s.submitting||requestSent||(!catalog&&!catalogError)}>
                {plan?(s.submitting?'Redirecting to payment...':'Continue to payment'):(requestSent?'Request sent':s.submitting?'Sending request...':'Send booking request')}
              </button>
            </>
          )}
        </form>
        {s.step<4&&(
          <div className="bk-footer">
            {s.step>0&&<button type="button" className="bk-btn bk-btn-ghost" onClick={()=>dispatch({t:'BACK'})}>Back</button>}
            <button type="button" className="bk-btn bk-btn-primary" disabled={!canNext()} onClick={()=>dispatch({t:'NEXT'})}>
              {s.step===3?(plan?'Review & pay':'Review request'):'Continue'}
            </button>
          </div>
        )}
      </div>
    </dialog>
  );
}
