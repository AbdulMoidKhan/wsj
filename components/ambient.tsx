'use client';

import {useEffect, useRef, useSyncExternalStore} from 'react';
import {Pause, Play} from 'lucide-react';

/*
  Advanced Ambient Motion System:
  1. Multi-layered luminous glowing orbs (emerald, amber, champagne) with organic drift
  2. Elegant architectural geometric wireframes (concentric rings, floating glass diamonds, coordinate reticles)
  3. Continuous champagne particle constellation (ultra-lightweight canvas particle drift)
  4. Pointer-responsive parallax displacement on pointer:fine devices
  5. Accessible pause/resume toggle + respects prefers-reduced-motion
*/

const STORAGE_KEY = 'wj-ambient';
const PAUSE_EVENT = 'wj:ambient-change';

function readPaused() {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'paused';
  } catch {
    return false;
  }
}

function subscribePaused(onChange: () => void) {
  window.addEventListener(PAUSE_EVENT, onChange);
  window.addEventListener('storage', onChange);
  return () => {
    window.removeEventListener(PAUSE_EVENT, onChange);
    window.removeEventListener('storage', onChange);
  };
}

export function AmbientBackdrop() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId = 0;
    let width = 0;
    let height = 0;

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) return;

    const resize = () => {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize, {passive: true});

    // Particle pool: gentle champagne motes drifting upwards with delicate breathing
    const count = window.innerWidth < 768 ? 16 : 32;
    const particles = Array.from({length: count}, () => ({
      x: Math.random() * (width || 1200),
      y: Math.random() * (height || 800),
      radius: Math.random() * 1.8 + 0.6,
      vx: (Math.random() - 0.5) * 0.25,
      vy: -(Math.random() * 0.35 + 0.15),
      alpha: Math.random() * 0.45 + 0.15,
      alphaSpeed: Math.random() * 0.015 + 0.005,
      color: Math.random() > 0.4 ? '217, 145, 11' : '239, 195, 109', // gold / champagne
    }));

    const render = (now: number) => {
      if (document.hidden || document.documentElement.dataset.ambient === 'paused') {
        animId = requestAnimationFrame(render);
        return;
      }

      ctx.clearRect(0, 0, width, height);

      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        p.alpha += Math.sin(now * p.alphaSpeed) * 0.004;
        if (p.alpha < 0.1) p.alpha = 0.1;
        if (p.alpha > 0.65) p.alpha = 0.65;

        // Wrap edges smoothly
        if (p.y < -10) {
          p.y = height + 10;
          p.x = Math.random() * width;
        }
        if (p.x < -10) p.x = width + 10;
        if (p.x > width + 10) p.x = -10;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${p.color}, ${p.alpha})`;
        ctx.shadowColor = `rgba(${p.color}, 0.5)`;
        ctx.shadowBlur = 6;
        ctx.fill();
      }

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <div className="amb-backdrop" aria-hidden="true">
      {/* 1. Luminous Mesh Gradients */}
      <span className="amb-glow amb-glow-emerald" />
      <span className="amb-glow amb-glow-amber" />
      <span className="amb-glow amb-glow-champagne" />
      <span className="amb-glow amb-glow-deep" />

      {/* 2. Floating Precision & Architectural Shapes */}
      <div className="amb-shape amb-orbit-ring" />
      <div className="amb-shape amb-nested-ring" />
      <div className="amb-shape amb-glass-diamond" />
      <div className="amb-shape amb-glass-diamond-sm" />

      {/* Modern architectural floorplan precision marks */}
      <span className="amb-reticle amb-reticle-tl">+</span>
      <span className="amb-reticle amb-reticle-tr">+</span>
      <span className="amb-reticle amb-reticle-bl">+</span>
      <span className="amb-reticle amb-reticle-br">+</span>

      {/* Floating architectural lines with smooth wave motion */}
      <svg className="amb-lines amb-lines-flowing" viewBox="0 0 2400 600" preserveAspectRatio="none" focusable="false">
        <defs>
          <linearGradient id="ambGoldGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="rgba(217,145,11,0)" />
            <stop offset="30%" stopColor="rgba(217,145,11,0.28)" />
            <stop offset="70%" stopColor="rgba(243,194,103,0.32)" />
            <stop offset="100%" stopColor="rgba(217,145,11,0)" />
          </linearGradient>
          <linearGradient id="ambForestGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="rgba(42,90,80,0)" />
            <stop offset="50%" stopColor="rgba(42,90,80,0.22)" />
            <stop offset="100%" stopColor="rgba(42,90,80,0)" />
          </linearGradient>
        </defs>
        <path d="M0 240 C400 160, 800 320, 1200 240 C1600 160, 2000 320, 2400 240" fill="none" stroke="url(#ambGoldGrad)" strokeWidth="1.2" />
        <path d="M0 290 C450 360, 850 210, 1200 290 C1550 370, 1950 210, 2400 290" fill="none" stroke="url(#ambForestGrad)" strokeWidth="1" strokeDasharray="6 6" />
        <path d="M0 340 C380 260, 780 410, 1200 340 C1620 270, 2020 410, 2400 340" fill="none" stroke="url(#ambGoldGrad)" strokeWidth="1" />
      </svg>

      {/* 3. Champagne Particle Constellation Canvas */}
      <canvas ref={canvasRef} className="amb-particles-canvas" />
    </div>
  );
}

export function MotionToggle() {
  const paused = useSyncExternalStore(subscribePaused, readPaused, () => false);

  useEffect(() => {
    const root = document.documentElement;
    if (paused) root.dataset.ambient = 'paused';
    else delete root.dataset.ambient;
  }, [paused]);

  const toggle = () => {
    try {
      if (paused) localStorage.removeItem(STORAGE_KEY);
      else localStorage.setItem(STORAGE_KEY, 'paused');
    } catch {}
    window.dispatchEvent(new Event(PAUSE_EVENT));
  };

  return (
    <button
      type="button"
      className="amb-toggle"
      aria-pressed={paused}
      onClick={toggle}
      title={paused ? 'Resume ambient animations' : 'Pause ambient animations'}
      aria-label={paused ? 'Resume ambient animations' : 'Pause ambient animations'}
    >
      {paused ? <Play size={15} aria-hidden="true" /> : <Pause size={15} aria-hidden="true" />}
      <span className="amb-toggle-label">{paused ? 'Play motion' : 'Pause motion'}</span>
    </button>
  );
}

export function MotionController() {
  useEffect(() => {
    const root = document.documentElement;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');

    const onVisibility = () => {
      root.dataset.tab = document.hidden ? 'hidden' : 'visible';
    };
    onVisibility();
    document.addEventListener('visibilitychange', onVisibility);

    // Section-level ambient layers only animate while on screen
    const locals = Array.from(document.querySelectorAll<HTMLElement>('.amb-local'));
    const localIO =
      'IntersectionObserver' in window
        ? new IntersectionObserver(
            entries => {
              for (const entry of entries) {
                (entry.target as HTMLElement).dataset.inview = entry.isIntersecting ? 'true' : 'false';
              }
            },
            {rootMargin: '80px 0px'}
          )
        : null;
    locals.forEach(el => {
      el.dataset.inview = 'false';
      localIO?.observe(el);
    });

    // Cursor-driven subtle parallax coordinates on pointer:fine
    let pointerOff = () => {};
    if (!reduced.matches && window.matchMedia('(pointer: fine)').matches) {
      let raf = 0;
      let targetX = 0;
      let targetY = 0;
      let currentX = 0;
      let currentY = 0;

      const loop = () => {
        currentX += (targetX - currentX) * 0.05;
        currentY += (targetY - currentY) * 0.05;
        root.style.setProperty('--mouse-px', currentX.toFixed(3));
        root.style.setProperty('--mouse-py', currentY.toFixed(3));
        raf = requestAnimationFrame(loop);
      };
      raf = requestAnimationFrame(loop);

      const onPointerMove = (e: PointerEvent) => {
        targetX = (e.clientX / window.innerWidth - 0.5) * 2; // -1 to 1
        targetY = (e.clientY / window.innerHeight - 0.5) * 2;
      };
      window.addEventListener('pointermove', onPointerMove, {passive: true});

      pointerOff = () => {
        cancelAnimationFrame(raf);
        window.removeEventListener('pointermove', onPointerMove);
      };
    }

    return () => {
      pointerOff();
      document.removeEventListener('visibilitychange', onVisibility);
      localIO?.disconnect();
    };
  }, []);

  return null;
}