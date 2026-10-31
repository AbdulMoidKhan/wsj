'use client';
import {PUBLIC_API_URL} from '@/lib/public-api';
import {useEffect,useState} from 'react';
import dynamic from 'next/dynamic';
import type {Popup} from './campaigns';
const Campaigns=dynamic(()=>import('./campaigns').then(m=>m.Campaigns),{ssr:false});
export function CampaignLoader(){const [popups,setPopups]=useState<Popup[]|null>(null);useEffect(()=>{const controller=new AbortController();fetch(PUBLIC_API_URL+'/public/popups/',{signal:controller.signal}).then(r=>r.ok?r.json():null).then(data=>{if(data?.items?.length)setPopups(data.items)}).catch(()=>{});return()=>controller.abort()},[]);return popups?<Campaigns initialPopups={popups}/>:null}
