import fs from 'node:fs';
import path from 'node:path';
import {site} from './site';

/**
 * Resolves a media URL, applying the configured remote CDN / R2 media prefix
 * (NEXT_PUBLIC_MEDIA_URL) when present.
 * - Handles relative paths ('/media/...', '/uploads/...', 'static/...')
 * - Handles full external/R2 URLs
 * - Safe fallback to local relative paths when NEXT_PUBLIC_MEDIA_URL is unset
 */
export function getMediaUrl(src: string): string {
  if (!src) return '';
  if (src.startsWith('http://') || src.startsWith('https://') || src.startsWith('data:')) {
    return src;
  }
  const baseUrl = process.env.NEXT_PUBLIC_MEDIA_URL?.trim().replace(/\/+$/, '');
  if (!baseUrl) {
    return src.startsWith('/') ? src : '/' + src;
  }
  if (src.startsWith('/media/')) {
    return `${baseUrl}/static/${src.slice(7)}`;
  }
  if (src.startsWith('media/')) {
    return `${baseUrl}/static/${src.slice(6)}`;
  }
  if (src.startsWith('/static/')) {
    return `${baseUrl}${src}`;
  }
  if (src.startsWith('static/')) {
    return `${baseUrl}/${src}`;
  }
  return src.startsWith('/') ? src : '/' + src;
}

export function mediaFor(...terms:string[]):string {
  const s=site();
  for(const term of terms){
    const page=s.pages.find(p=>(p.slug+' '+p.title).toLowerCase().includes(term));
    if(page?.featuredImage) return getMediaUrl(page.featuredImage);
    if(page?.images?.length) {
      const found = page.images.find(x=>/\.(webp|jpe?g|avif|png)/i.test(x))||page.images[0];
      if (found) return getMediaUrl(found);
    }
  }
  try{
    const files=fs.readdirSync(path.join(process.cwd(),'public/media'),{recursive:true}) as string[];
    for(const term of terms){
      const file=files.find(f=>f.toLowerCase().includes(term)&&/\.(webp|jpe?g|avif|png)$/i.test(f)&&!f.includes('150x'));
      if(file) return getMediaUrl('/media/'+file.replaceAll('\\','/'));
    }
  }catch{}
  return '';
}

