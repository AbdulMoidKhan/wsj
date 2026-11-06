'use client';

import Image from '@/components/consistent-image';
import {useState, useEffect, useRef} from 'react';
import {ChevronUp, ChevronDown, Quote, Star} from 'lucide-react';
import './testimonials-slider.css';

export type TestimonialItem = {
  id?: string;
  quote: string;
  name: string;
  role?: string;
  company?: string;
  avatar?: string;
};

export function TestimonialsSlider({items}: {items: TestimonialItem[]}) {
  const [currentIdx, setCurrentIdx] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const N = items.length;

  const next = () => {
    setCurrentIdx(i => (i + 1) % N);
  };

  const prev = () => {
    setCurrentIdx(i => (i - 1 + N) % N);
  };

  // Auto-advance every 6 seconds unless hovered or focused
  useEffect(() => {
    if (isPaused || N <= 1) return;
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (media.matches) return;

    timerRef.current = setInterval(() => {
      if (!document.hidden && document.documentElement.dataset.ambient !== 'paused') {
        setCurrentIdx(i => (i + 1) % N);
      }
    }, 6000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isPaused, N]);

  if (!items.length) return null;

  const prevIdx = (currentIdx - 1 + N) % N;
  const nextIdx = (currentIdx + 1) % N;

  return (
    <div
      className="lx-vslider-container"
      role="region"
      aria-label="Client testimonials"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onFocus={() => setIsPaused(true)}
      onBlur={event => {if (!event.currentTarget.contains(event.relatedTarget)) setIsPaused(false);}}
    >
      <div className="lx-vslider-layout">
        <div className="lx-vslider-sidebar" data-anim="fade-up">
          <div className="lx-vslider-badge">
            <span className="lx-vslider-dot" aria-hidden="true" />
            <span>Testimonials</span>
          </div>

          <h2 className="lx-vslider-heading" data-anim="split-lines">Trusted by Chicagoans</h2>

          <div className="lx-vslider-rating" aria-label="5 out of 5 stars rating" data-anim="fade-up" data-anim-delay="0.1">
            <div className="lx-vslider-stars">
              {[...Array(5)].map((_, i) => (
                <Star key={i} size={15} className="lx-vslider-star" fill="#d9910b" color="#d9910b" aria-hidden="true" />
              ))}
            </div>
            <span className="lx-vslider-score">5.0 / 5.0 Star Experience</span>
          </div>

          <p className="lx-vslider-desc" data-anim="fade-up" data-anim-delay="0.15">
            Direct feedback from entrepreneurs, independent consultants, podcasters, and growing teams thriving at Workspace Junction.
          </p>

          <div className="lx-vslider-nav">
            <div className="lx-vslider-arrows">
              <button
                type="button"
                className="lx-vslider-arrow"
                aria-label="Previous testimonial"
                onClick={prev}
              >
                <ChevronUp size={20} aria-hidden="true" />
              </button>
              <button
                type="button"
                className="lx-vslider-arrow"
                aria-label="Next testimonial"
                onClick={next}
              >
                <ChevronDown size={20} aria-hidden="true" />
              </button>
            </div>

            <div className="lx-vslider-dots" role="group" aria-label="Select testimonial">
              {items.map((it, i) => (
                <button
                  key={i}
                  type="button"
                  className={'lx-vdot' + (i === currentIdx ? ' is-active' : '')}
                  aria-label={'Go to testimonial by ' + it.name}
                  aria-pressed={i === currentIdx}
                  onClick={() => setCurrentIdx(i)}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="lx-vslider-stage">
          <div className="lx-vslider-track" aria-live="polite">
            {items.map((item, i) => {
              let state = 'is-hidden';
              let tabIndex = -1;
              let ariaHidden = true;

              if (i === currentIdx) {
                state = 'is-active';
                tabIndex = 0;
                ariaHidden = false;
              } else if (i === prevIdx) {
                state = 'is-prev';
              } else if (i === nextIdx) {
                state = 'is-next';
              }

              return (
                <figure
                  key={item.id || item.name + i}
                  className={`lx-vitem ${state}`}
                  tabIndex={tabIndex}
                  aria-hidden={ariaHidden}
                  onClick={() => {
                    if (i === prevIdx) prev();
                    if (i === nextIdx) next();
                  }}
                >
                  <div className="lx-vitem-quote-row">
                    <Quote size={28} className="lx-vitem-quote-icon" aria-hidden="true" />
                    <blockquote className="lx-vitem-quote">
                      <p>&ldquo;{item.quote}&rdquo;</p>
                    </blockquote>
                  </div>

                  <figcaption className="lx-vitem-footer">
                    {item.avatar && (
                      <Image
                        src={item.avatar}
                        alt={item.name}
                        width={46}
                        height={46}
                        className="lx-vitem-avatar"
                      />
                    )}
                    <div className="lx-vitem-meta">
                      <cite className="lx-vitem-name">{item.name}</cite>
                      {item.role && <span className="lx-vitem-role">{item.role}</span>}
                      {item.company && <span className="lx-vitem-company">{item.company}</span>}
                    </div>
                  </figcaption>
                </figure>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
