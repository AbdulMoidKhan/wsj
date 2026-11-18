import Image from '@/components/consistent-image';
const widths=[384,640,828,867];
const defaultSizes='(max-width: 650px) 100vw, (max-width: 900px) 50vw, (min-width: 1920px) 1018px, 53vw';
const srcSet=(format:string)=>widths.map(width=>`/media/optimized/home-hero-${width}.${format} ${width}w`).join(', ');
/** Static derivatives avoid first-request image encoding on the critical LCP path. */
export function HomeHeroImage({alt='Workspace Junction coworking space in Oakbrook Terrace',className='cover',sizes=defaultSizes}:{alt?:string;className?:string;sizes?:string}={}){return <><link rel="preload" as="image" type="image/webp" imageSrcSet={srcSet('webp')} imageSizes={sizes} fetchPriority="high"/><picture><source type="image/webp" srcSet={srcSet('webp')} sizes={sizes}/><source type="image/avif" srcSet={srcSet('avif')} sizes={sizes}/><Image src="/media/optimized/home-hero-867.webp" alt={alt} fill unoptimized decoding="async" loading="eager" fetchPriority="high" sizes={sizes} className={className}/></picture></>}
