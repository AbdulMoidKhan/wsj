'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Image from '@/components/consistent-image';

export interface BlueprintSliderItem {
  src: string;
  alt: string;
  w?: number;
  h?: number;
}

interface BlueprintSliderProps {
  heading: string;
  subheading?: string;
  paragraph?: string;
  images: BlueprintSliderItem[];
  eyebrow?: string;
  intervalMs?: number;
  /** noun used in labels: "Studio" for studios, "Space" for workspaces */
  viewNoun?: string;
}

export function BlueprintSlider({
  heading,
  subheading,
  paragraph,
  images,
  eyebrow = 'PODCAST STUDIO',
  intervalMs = 4000,
  viewNoun = 'Space'
}: BlueprintSliderProps) {
  const [activeIdx, setActiveIdx] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const total = images?.length || 0;

  const nextSlide = useCallback(() => {
    setActiveIdx(prev => (prev + 1) % (total || 1));
  }, [total]);

  // Automatic cycling timer
  useEffect(() => {
    if (total <= 1 || isPaused) return;

    timerRef.current = setInterval(() => {
      nextSlide();
    }, intervalMs);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [total, isPaused, intervalMs, nextSlide]);

  if (!images || total === 0) return null;

  const currentImage = images[activeIdx] || images[0];
  // the next three views in rotation order (never the active one)
  const otherImages = Array.from({length: Math.min(3, total - 1)}, (_, o) => (activeIdx + o + 1) % total).map(idx => ({ img: images[idx], idx }));

  const handleManualSelect = (idx: number) => {
    setActiveIdx(idx);
    // Restart timer smoothly on manual interaction
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = setInterval(nextSlide, intervalMs);
    }
  };

  return (
    <div
      className="lx-blueprint-section"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onFocusCapture={() => setIsPaused(true)}
      onBlurCapture={() => setIsPaused(false)}
    >
      <div className="lx-blueprint-grid">
        {/* LEFT COLUMN: Header, Paragraph, 1 Big Feature Image */}
        <div className="lx-blueprint-left">
          <div className="lx-blueprint-header-wrap">
            <span className="eyebrow hp-eyebrow lx-blueprint-eyebrow">
              <span className="lx-badge-dot" aria-hidden="true" />
              {eyebrow}
            </span>
            <h2 className="lx-h lx-blueprint-title">{heading}</h2>
            {subheading && <h3 className="lx-blueprint-sub">{subheading}</h3>}
            {paragraph && (
              <div
                className="lx-blueprint-lead"
                dangerouslySetInnerHTML={{ __html: paragraph }}
              />
            )}
          </div>

          <div className="lx-blueprint-main-frame">
            <Image
              key={currentImage.src}
              src={currentImage.src}
              alt={currentImage.alt || 'Main feature view'}
              width={currentImage.w || 1200}
              height={currentImage.h || 600}
              priority
              className="lx-blueprint-main-img"
            />
            <div className="lx-blueprint-tag">
              <span className="lx-blueprint-tag-dot" aria-hidden="true" />
              <span>{viewNoun} View {activeIdx + 1} of {total}</span>
              {isPaused && <span className="lx-blueprint-paused-text">(Paused on hover)</span>}
            </div>

            {/* Subtle Progress Bar along bottom of big image */}
            <div className="lx-blueprint-progress-track" aria-hidden="true">
              <div
                key={`${activeIdx}-${isPaused}`}
                className={'lx-blueprint-progress-bar' + (isPaused ? ' is-paused' : '')}
                style={{ animationDuration: `${intervalMs}ms` }}
              />
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: 3 Thumbnails as interactive slider cards */}
        <div className="lx-blueprint-right">
          <div className="lx-blueprint-thumbs-header">
            <span className="lx-blueprint-thumbs-label">{viewNoun} Perspectives</span>
            <span className="lx-blueprint-thumbs-hint">Auto-advancing • Click to switch</span>
          </div>

          <div className="lx-blueprint-thumbs-list">
            {otherImages.map(({ img, idx }) => (
              <button
                key={img.src}
                type="button"
                className="lx-blueprint-thumb-btn"
                onClick={() => handleManualSelect(idx)}
                aria-label={`Switch to ${viewNoun.toLowerCase()} view ${idx + 1}`}
              >
                <div className="lx-blueprint-thumb-frame">
                  <Image
                    src={img.src}
                    alt={img.alt || `Perspective ${idx + 1}`}
                    width={img.w || 380}
                    height={img.h || 250}
                    className="lx-blueprint-thumb-img"
                  />
                  <div className="lx-blueprint-thumb-overlay">
                    <span className="lx-blueprint-view-badge">View {idx + 1}</span>
                  </div>
                </div>
              </button>
            ))}
          </div>

          {/* Quick Pagination Dots for Mobile and Tablet */}
          <div className="lx-blueprint-dots" aria-label="Slider navigation dots">
            {images.map((_, i) => (
              <button
                key={i}
                type="button"
                className={'lx-blueprint-dot' + (i === activeIdx ? ' is-active' : '')}
                onClick={() => handleManualSelect(i)}
                aria-label={`Go to slide ${i + 1}`}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
