import fs from 'node:fs';
import path from 'node:path';
import {site} from './site';
export function mediaFor(...terms:string[]):string {const s=site();for(const term of terms){const page=s.pages.find(p=>(p.slug+' '+p.title).toLowerCase().includes(term));if(page?.featuredImage)return page.featuredImage;if(page?.images?.length)return page.images.find(x=>/\.(webp|jpe?g|avif|png)/i.test(x))||page.images[0];}try{const files=fs.readdirSync(path.join(process.cwd(),'public/media'),{recursive:true}) as string[];for(const term of terms){const file=files.find(f=>f.toLowerCase().includes(term)&&/\.(webp|jpe?g|avif|png)$/i.test(f)&&!f.includes('150x'));if(file)return '/media/'+file.replaceAll('\\','/')}}catch{}return ''}
