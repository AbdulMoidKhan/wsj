// Static hosting (GitHub Pages) has no server-side image optimizer.
// Prefix asset paths with repository basePath when deployed on GitHub Pages.
export default function imageLoader({ src }: { src: string; width: number; quality?: number }) {
  if (src.startsWith('http://') || src.startsWith('https://') || src.startsWith('data:')) {
    return src;
  }
  const basePath =
    process.env.NEXT_PUBLIC_BASE_PATH ||
    (typeof window !== 'undefined' && window.location.pathname.startsWith('/wsj') ? '/wsj' : '');
  const cleanSrc = src.startsWith('/') ? src : '/' + src;
  if (basePath && cleanSrc.startsWith(basePath)) {
    return cleanSrc;
  }
  return `${basePath}${cleanSrc}`;
}
