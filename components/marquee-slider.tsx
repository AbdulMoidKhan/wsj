'use client';

import { useState } from 'react';
import Image from '@/components/consistent-image';

interface MarqueeSliderProps {
  title?: string;
  images: {
    src: string;
    alt: string;
    w?: number;
    h?: number;
  }[];
}

export function MarqueeSlider({ title, images }: MarqueeSliderProps) {
  const [isPaused, setIsPaused] = useState(false);

  if (!images || images.length === 0) return null;

  // Duplicate items to ensure seamless infinite looping without gaps
  const loopImages = [...images, ...images, ...images];

  return (
    <div className="lx-marquee-wrap">
      {title && (
        <div className="lx-marquee-head">
          <h2 className="lx-h lx-h2 lx-marquee-title">{title}</h2>
          <span className="lx-marquee-badge">
            <span className="lx-badge-dot" aria-hidden="true" />
            Live Studio Moments
          </span>
        </div>
      )}

      <div
        className="lx-marquee-container"
        tabIndex={0}
        aria-label="Studio gallery. Focus or hover to pause movement."
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
        onFocus={() => setIsPaused(true)}
        onBlur={event => {if (!event.currentTarget.contains(event.relatedTarget)) setIsPaused(false);}}
        onTouchStart={() => setIsPaused(true)}
        onTouchEnd={() => setIsPaused(false)}
      >
        <div className={'lx-marquee-track' + (isPaused ? ' is-paused' : '')}>
          {loopImages.map((img, i) => (
            <div key={`${img.src}-${i}`} className="lx-marquee-item">
              <div className="lx-marquee-frame">
                <Image
                  src={img.src}
                  alt={img.alt || `Studio Gallery Photo ${i + 1}`}
                  width={img.w || 440}
                  height={img.h || 290}
                  className="lx-marquee-img"
                  sizes="(max-width: 640px) 260px, (max-width: 1024px) 320px, 380px"
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
