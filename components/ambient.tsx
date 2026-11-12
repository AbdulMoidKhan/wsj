/*
  Ambient backdrop: static, CSS-only decorative layers (glows, architectural shapes, flowing
  lines). Their slow drifts are compositor-only transform animations declared in CSS, paused
  by the browser in hidden tabs and disabled for reduced motion / Figma-frame routes.

  The former 2D particle canvas ran its own requestAnimationFrame loop (with per-particle
  shadowBlur) even on routes where it was display:none; the WebGL world already draws dust
  motes on capable desktops, so the canvas loop was removed rather than optimised.
*/
export function AmbientBackdrop() {
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

    </div>
  );
}
