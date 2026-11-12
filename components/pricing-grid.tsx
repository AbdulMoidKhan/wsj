'use client';
import {useState} from 'react';
import {Check,ArrowUpRight} from 'lucide-react';
import {BookingButton} from './booking';
export type PublicPlan={id?:string;title?:string;slug?:string;excerpt?:string;metadata?:{price?:string|number;amount?:number;currency?:string;billingPeriod?:string;features?:string[];featured?:boolean;ctaUrl?:string;ctaLabel?:string;offer?:string;service?:string;requiresReview?:boolean;enabled?:boolean}};
function destination(value?:string){if(!value)return null;try{const u=new URL(value,'https://workspacejunction.com');return ['http:','https:'].includes(u.protocol)?value:null}catch{return null}}
function cleanServiceName(s: string): string {
  const map: Record<string, string> = {
    'llc-setup': 'LLC Setup',
    'bpo-services': 'BPO Services',
    'digital-services': 'Digital Services',
    'digital-presence': 'Digital Presence',
    'notary-public': 'Notary Public',
    'printed-services': 'Printed Services',
    'trade-shows': 'Trade Shows',
  };
  if (map[s]) return map[s];
  return s.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

export function PricingGrid({plans}:{plans:PublicPlan[]}) {
 const services=[...new Set(plans.map(p=>p.metadata?.service).filter(Boolean))] as string[];
 const [selected,setSelected]=useState(services[0]||'');
 const [period,setPeriod]=useState('all');
 const relevant=services.length>1?plans.filter(p=>p.metadata?.service===selected):plans;
 const periods=[...new Set(relevant.map(p=>p.metadata?.billingPeriod||''))];
 const shown=period==='all'?relevant:relevant.filter(p=>(p.metadata?.billingPeriod||'')===period);
 return <>{services.length>1&&<div className="pricing-filters" role="group" aria-label="Pricing services">{services.map(s=><button type="button" aria-pressed={selected===s} onClick={()=>{setSelected(s);setPeriod('all')}} key={s}>{cleanServiceName(s)}</button>)}</div>}{periods.length>1&&<div className="pricing-filters" role="group" aria-label="Billing periods">{['all',...periods].map(s=><button type="button" aria-pressed={period===s} onClick={()=>setPeriod(s)} key={s}>{s==='all'?'All periods':cleanServiceName(s)||'Period not specified'}</button>)}</div>}<div className="pricing-grid" data-anim-stagger-group="true" data-anim-stagger="0.06">{shown.map((p,i)=>{const m=p.metadata||{},value=m.price??m.amount,url=destination(m.ctaUrl);const amount=typeof value==='number'?new Intl.NumberFormat('en-US',{style:'currency',currency:/^[A-Z]{3}$/.test(m.currency||'')?m.currency:'USD',maximumFractionDigits:value%1===0?0:2}).format(value):value;return <article className={'price-card '+(m.featured?'featured':'')} key={p.id||i}>{m.featured&&<span className="eyebrow">FEATURED PLAN</span>}<h3>{p.title}</h3><p>{p.excerpt}</p>{m.offer&&<p className="plan-offer">{m.offer}</p>}<div className="price-value">{amount}<small> / {m.billingPeriod||'month'}</small></div><ul>{(m.features||[]).map(f=><li key={f}><Check size={15}/>{f}</li>)}</ul>{url?<a className="btn btn-outline" href={url}>{m.ctaLabel||'Book now'}<ArrowUpRight size={15}/></a>:<BookingButton className="btn btn-outline" service={m.service?m.service+' - '+(p.title||''):p.title}>{m.ctaLabel||'Book now'}<ArrowUpRight size={15}/></BookingButton>}</article>})}</div></>;
}
