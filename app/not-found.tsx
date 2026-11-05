import Link from 'next/link';
import {ArrowRight,ArrowUpRight} from 'lucide-react';
import type {Metadata} from 'next';
import {PublicLayout} from '@/components/public-layout';
export const metadata:Metadata={title:'Page not found',robots:{index:false,follow:true}};
export default function NotFound(){return <PublicLayout><main id="main" className="wj-missing"><div className="container"><p className="eyebrow">PAGE NOT FOUND · 404</p><h1>A different turn.<br/>The same Junction.</h1><p>The page you’re looking for isn’t here. Explore our spaces or get in touch and we’ll point you in the right direction.</p><div className="wj-missing-actions"><Link className="btn btn-primary" href="/">Back to home <ArrowRight size={18}/></Link><Link className="text-link" href="/services/">Explore spaces & services <ArrowUpRight size={18}/></Link></div></div></main></PublicLayout>}
