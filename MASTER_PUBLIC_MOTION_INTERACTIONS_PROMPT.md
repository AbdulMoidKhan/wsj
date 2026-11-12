# MASTER MOTION, TRANSITIONS & MICRO-INTERACTIONS SPECIFICATION: WORKSPACE JUNCTION

> **ROLE & OPERATING MINDSET**
> You are acting as a world-class **Creative Technologist & Motion Design Systems Lead** specializing in ultra-polished, fluid web interactions (Awwwards / Apple / Linear quality).
> Your stack: **Next.js 16 App Router, React 19, Tailwind CSS, GSAP (ScrollTrigger, Flip, Observer), @studio-freight/lenis (or lenis), Lucide Icons**.
>
> **CORE OBJECTIVE**
> Transform the entire public-facing Workspace Junction platform from a static layout into an organic, responsive, tactile experience where every interaction feels deliberate, physical, and weighted. Never use generic or jarring bouncy animations; every motion must reflect executive prestige, architectural stability, and frictionless speed.

---

## 1. MOTION DESIGN SYSTEM & DESIGN TOKENS

Establish unified easing curves and duration tokens across Tailwind CSS variables and GSAP defaults:

```css
:root {
  /* Motion Duration Tokens */
  --motion-instant: 120ms;
  --motion-fast: 240ms;
  --motion-normal: 400ms;
  --motion-slow: 700ms;
  --motion-deliberate: 1100ms;

  /* Cubic Bezier Easing Curves */
  --ease-out-expo: cubic-bezier(0.16, 1, 0.3, 1);       /* Decisive entries, hovers */
  --ease-in-out-cubic: cubic-bezier(0.65, 0, 0.35, 1);   /* Smooth layout morphs */
  --ease-spring-gentle: cubic-bezier(0.25, 1, 0.5, 1);   /* Physical tactile bounce */
  --ease-spring-snappy: cubic-bezier(0.34, 1.56, 0.64, 1);/* Magnetic buttons & pills */
}
```

### Accessibility & Reduced Motion Guardrail
Every animation, GSAP timeline, and CSS transition MUST respect `@media (prefers-reduced-motion: reduce)`.
```ts
// Universal Reduced Motion Guard
const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
if (prefersReduced) {
  // Disable parallax, reduce opacity transitions to instant 1ms, zero out transforms
}
```

---

## 2. GLOBAL PAGE TRANSITIONS & VIEW TRANSITIONS

1. **Next.js Route Change Smoothing**:
   - Implement seamless page transitions between routes (`/`, `/about-us/`, `/contact-us/`, `/podcast-studio/`, `/coworking/`, etc.).
   - Subtle backdrop veil fade (`opacity: 0 -> 1` at 180ms) paired with a subtle upward drift (`translateY(8px) -> translateY(0)` at 320ms with `--ease-out-expo`).
   - Eliminate hard white-flashes or layout jumps on client-side routing.
2. **Scroll Restoration & Lenis Inertia**:
   - Ensure `@studio-freight/lenis` smooth scroll momentum synchronizes with GSAP `ScrollTrigger.update`.
   - Prevent scroll jumps on route transitions by resetting scroll position to top with Lenis `scrollTo(0, { immediate: true })`.

---

## 3. HEADER, NAVIGATION & TOP BARS

1. **Sticky Header Dynamic State Transitions**:
   - **Initial State**: Transparent background, full height (`py-5`), soft subtle borders.
   - **Scrolled State (Down > 40px)**: Transitions via CSS/GSAP to a glassmorphism backdrop (`backdrop-blur-md bg-stone-950/80 border-b border-emerald-950/40 shadow-lg shadow-black/20 py-3`).
   - **Scroll Direction Intelligence**:
     - Fast scroll down: Header translates up `-100%` smoothly to maximize reading viewport.
     - Scroll up (even 10px): Header glides down `translateY(0)` instantly with `--ease-out-expo`.
2. **Interactive Navigation Links & Indicators**:
   - **Magnetic Pill Indicator**: Active and hovered navigation links feature an animated sliding pill/underline background using GSAP or CSS layout animation that slides fluidly beneath hovered items.
   - **Subtle Glow on Hover**: Nav links shift color from muted slate to crisp pearl white, with a subtle emerald ambient glow (`text-shadow: 0 0 12px rgba(16, 185, 129, 0.4)`).
3. **Mobile Drawer & Hamburger Morph**:
   - Hamburger icon lines morph organically into an 'X' close indicator with SVG rotation and stroke-offset animation.
   - Mobile sheet slides in from right/top using `--ease-out-expo`, with nav links cascading into view via staggered delay (`stagger: 0.04s`, `translateY: 20px -> 0`, `opacity: 0 -> 1`).

---

## 4. HERO SECTIONS & DYNAMIC CAROUSEL

1. **Typography Entrance Animation**:
   - Split headings into words/lines (using lightweight CSS or standard span splitting, no Club plugins).
   - Animate lines up from an overflow hidden mask: `clip-path: inset(0 0 100% 0) -> inset(0 0 0% 0)` paired with `translateY(40px) -> translateY(0)` with a staggered sequence (0.08s interval).
2. **Carousel Slide Transitions**:
   - Current slide cross-fade: Outgoing slide fades out while scaling up slightly (`scale(1) -> scale(1.04)`, `opacity: 0`).
   - Incoming slide zooms gently in from `scale(1.08) -> scale(1)` over 900ms (`--ease-out-expo`).
   - Slide index counter ("01 / 03") flips vertically with a mechanical counter roll effect.
3. **Ambient Background Orb / Glow Motion**:
   - Background subtle radial gradients float with slow, continuous Lissajous curve animation (`duration: 18s`, infinite alternate, low CPU footprint).

---

## 5. BUTTONS, CARDS & INTERACTIVE SURFACES

1. **Magnetic & Tactile Buttons (Primary CTAs)**:
   - **Cursor Magnetism**: On desktop mousemove within 30px boundary of buttons ("Book a Private Tour", "Explore Memberships", "Book now"), button center gently pulls toward cursor (`x * 0.2`, `y * 0.2`).
   - **Hover Shimmer / Sheen**: A diagonal highlight sweep glides across the button on hover:
     ```css
     .btn-shimmer::after {
       content: '';
       position: absolute;
       inset: 0;
       transform: translateX(-100%) skewX(-15deg);
       background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.18), transparent);
       transition: transform 600ms var(--ease-out-expo);
     }
     .btn-shimmer:hover::after {
       transform: translateX(200%) skewX(-15deg);
     }
     ```
   - **Active Click State**: Scale down slightly (`scale(0.97)` at 80ms) for high-responsiveness tactile feedback.
2. **Pricing & Membership Cards**:
   - **3D Tilt & Lighting Effect**: Subtle perspective card tilt on mousemove (`rotateX` / `rotateY` up to 4 degrees) with a radial cursor-following highlight on the border.
   - **Featured "Platinum" Card**: Subtle breathing border glow pulsing with emerald hues (`box-shadow: 0 0 25px rgba(16, 185, 129, 0.15)`).
   - **Plan Feature Checkmarks**: Stagger in with a gentle check-spring when user switches pricing frequency (Monthly vs Annual).
3. **Podcast Studio Tab Selector**:
   - Active tab indicator slides smoothly between tabs (`Solo Creator`, `Interview`, `Panel`, `Premium Video`) using CSS `layoutId` or GSAP element bounding rect interpolation.
   - Content panel cross-fades without height jumps: animate panel container height smoothly using `ResizeObserver` or CSS transition.

---

## 6. SCROLL-TRIGGERED REVEALS (ON-SCROLL STORYTELLING)

1. **Section Reveal Hierarchy**:
   - Each major section (`Events & Workshops`, `Made For The Way You Work`, `Meeting Rooms`, `Beyond The Desk`, `FAQ`) uses GSAP `ScrollTrigger`:
     - `start: "top 85%"`
     - Elements trigger: Subtitle badge fades in first, followed by H2 heading, paragraph description, and staggered grid cards (`stagger: 0.1s`).
2. **Parallax Image Effects**:
   - Facility photography containers have `overflow: hidden`.
   - Internal image scales to `115%` and scrolls with subtle inverted parallax (`translateY: -8% -> +8%` across viewport pass).
3. **Accordion / FAQ Micro-Interactions**:
   - Expanding FAQ item smoothly interpolates `grid-template-rows: 0fr -> 1fr` over 350ms (`--ease-out-expo`).
   - Plus icon rotates 135 degrees smoothly to become a close 'X' with color shift from muted gray to vibrant emerald.

---

## 7. EMBEDDED CHECKOUT MODAL MOTION POLISH

1. **Modal Entry & Backdrop**:
   - Backdrop veil: Blurs background (`backdrop-blur-sm bg-black/60`) over 200ms.
   - Dialog box: Scales up from `scale(0.96) translateY(12px)` to `scale(1) translateY(0)` with zero bounce, feeling anchored and enterprise-grade.
2. **Step Progression & Slide Navigation**:
   - Step transition: As user clicks "Continue" (e.g. from Service -> Package -> Included -> Extras -> Review & Pay), outgoing step slides left (`translateX(-20px)`, `opacity: 0`), incoming step slides in from right (`translateX(20px) -> 0`, `opacity: 1`).
   - Step progress bar: Animates forward with a liquid fill tween.
3. **Add-on Checkbox & Order Summary Updates**:
   - When an add-on is toggled (e.g. Business Address +$25/mo), the total price counter rolls smoothly to the new amount using a fast numerical tween, avoiding instant layout blinks.

---

## 8. CODE STRUCTURE & IMPLEMENTATION PLAN

Implement clean, modular motion hooks and reusable components:

1. **`lib/motion.ts`**:
   - Define custom GSAP registers (`ScrollTrigger`, `Observer`).
   - Export standard reusable animation presets (`fadeInUp`, `staggerGrid`, `magneticHover`, `parallaxImage`).
2. **`components/motion/MotionWrapper.tsx`**:
   - Client wrapper for scroll-triggered viewport entrances with reduced-motion fallbacks.
3. **`styles/animations.css`**:
   - Utility keyframes for button shimmers, ambient glowing orbs, accordion height interpolation, and border sheen effects.

---

## 9. VERIFICATION & QUALITY ASSURANCE CRITERIA

- **Performance**: Zero frame drops on 60Hz and 120Hz ProMotion displays; 60fps locked during active Lenis scrolling.
- **No Layout Shifts (CLS)**: Pre-allocate heights and aspect ratios so transitions never induce cumulative layout shift.
- **CPU & Battery Friendliness**: Pause off-screen animations with `ScrollTrigger.batch` or IntersectionObservers.
- **Visual Proof**: Capture screenshots and test recordings across both Desktop and Mobile viewports verifying all hover states and active motion states.

---

*Apply this specification thoroughly across every component in the public layer to deliver an exceptional, award-winning user experience.*
