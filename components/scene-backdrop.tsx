'use client';

import {useEffect, useRef} from 'react';
import {usePathname} from 'next/navigation';
import {canRunRichEffects, useReducedMotion} from '@/lib/use-reduced-motion';

const SCENE_CHECK = 'wj:scene-check';
/* Routes whose design hides the ambient layers (Figma homepage/page frames sit on opaque
   backgrounds), so a WebGL world there would render invisibly and only cost CPU/GPU. */
const HIDDEN_SCENE_ROUTES = '#main.figma-home, #main.fx-page';

/* PublicLayout renders inside each page, so this component remounts on every navigation.
   The built world (renderer, GPU buffers, ScrollTrigger) is kept at module level and its
   canvas is re-attached to the new host; disposal is deferred and cancelled by a remount,
   so navigating never rebuilds three.js scenes. */
let world: {canvas: HTMLCanvasElement; dispose: () => void} | null = null;
let worldDisposeTimer: number | undefined;

/*
  <SceneBackdrop/> - one fixed, full-viewport WebGL world behind every public page.

  Floating coworking objects (office chairs, desks, podcast mics, laptops,
  monitors, lamps, coffee, plants, headphones) drift at depth along a vertical
  corridor. The camera path is a GSAP ScrollTrigger scrub over the whole page;
  scroll velocity briefly speeds up the objects' spin. Rendering is driven by
  the shared gsap.ticker (the same tick Lenis uses), so there is ONE animation
  loop for smooth scroll + 3D.

  Decorative only: aria-hidden, pointer-events none, z-index below content.
  Objects are anchored to the left/right edge band of the current viewport so
  they frame, rather than cover, the reading column. three.js and GSAP load
  after first paint. Stops when the tab is hidden or background motion is
  paused. Only capable desktops (lib/use-reduced-motion canRunRichEffects) without reduced
  motion, on routes that do not hide ambient layers, ever load three.js.
*/

export function SceneBackdrop() {
  const host = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const reduced = useReducedMotion();

  /* Per route: decide whether the world should be visible. It is created lazily the first time
     a route wants it and then paused (not rebuilt) on routes that do not. Phones, tablets,
     low-power/data-saver devices and reduced-motion users never download three.js at all. */
  useEffect(() => {
    const off = reduced || !canRunRichEffects() || Boolean(document.querySelector(HIDDEN_SCENE_ROUTES));
    const root = document.documentElement;
    if (off) root.dataset.sceneOff = ''; else delete root.dataset.sceneOff;
    window.dispatchEvent(new Event(SCENE_CHECK));
  }, [pathname, reduced]);

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    let disposed = false;
    let started = false;
    let idle: number | undefined;
    let timer: number | undefined;
    window.clearTimeout(worldDisposeTimer);
    if (world) {el.appendChild(world.canvas); started = true;}

    const start = async () => {
      if (world) {el.appendChild(world.canvas); return;}
      const probe = document.createElement('canvas');
      if (!(probe.getContext('webgl2') || probe.getContext('webgl'))) return;
      const [THREE, {mergeGeometries}, {RoomEnvironment}, {gsap}, {ScrollTrigger}, {createOfficeKit}] = await Promise.all([
        import('three'),
        import('three/examples/jsm/utils/BufferGeometryUtils.js'),
        import('three/examples/jsm/environments/RoomEnvironment.js'),
        import('gsap'),
        import('gsap/ScrollTrigger'),
        import('./office-models'),
      ]);
      if (disposed) return;
      gsap.registerPlugin(ScrollTrigger);

      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      const finePointer = window.matchMedia('(pointer: fine)').matches;
      const narrow = () => window.innerWidth < 760;

      const renderer = new THREE.WebGLRenderer({antialias: (window.devicePixelRatio || 1) < 1.5, alpha: true, powerPreference: 'high-performance'});
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, narrow() ? 1 : 1.5));
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.05;
      renderer.domElement.setAttribute('aria-hidden', 'true');
      el.appendChild(renderer.domElement);

      const scene = new THREE.Scene();
      scene.fog = new THREE.Fog(0xd0cfcb, 8, 21);
      const pmrem = new THREE.PMREMGenerator(renderer);
      const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
      scene.environment = envTex;

      const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 60);
      camera.position.set(0, 0, 10);

      const palette = {
        metal: new THREE.MeshStandardMaterial({color: 0xd9910b, metalness: 0.85, roughness: 0.32, flatShading: true}),
        pearl: new THREE.MeshStandardMaterial({color: 0xe6e5e2, metalness: 0.12, roughness: 0.5, flatShading: true}),
        forest: new THREE.MeshStandardMaterial({color: 0x2f5a50, metalness: 0.35, roughness: 0.4, flatShading: true}),
      };
      const kit = createOfficeKit(THREE, g => mergeGeometries(g, false), palette);

      type Item = {obj: InstanceType<typeof THREE.Group>; base: {x: number; y: number; z: number}; spin: [number, number, number]; bob: number; phase: number; size: number};
      const items: Item[] = [];
      // [model, side hint (sign = side), y along corridor, depth z, spin, size]
      const layout: Array<[keyof typeof kit, number, number, number, [number, number, number], number]> = [
        ['officeChair', 5.2, 0.6, -1.5, [0.05, 0.28, 0.03], 1.25],
        ['podcastMic', -5, -1.2, -0.8, [0.08, 0.32, 0.04], 1.2],
        ['laptop', -5.6, 2.6, -4, [0.12, 0.22, 0.05], 1.15],
        ['coffeeCup', 4.2, -2.6, 0.6, [0.15, 0.4, 0.08], 0.9],
        ['desk', 5.6, -5.6, -3.2, [0.06, 0.2, 0.04], 1.15],
        ['headphones', -4.6, -6.6, -1.6, [0.18, 0.3, 0.06], 1.1],
        ['deskLamp', -4.2, -10, 0, [0.06, 0.34, 0.05], 1.05],
        ['monitor', 4.8, -11, -1.4, [0.05, 0.26, 0.03], 1.05],
        ['plant', 5.8, -14.6, -4, [0.04, 0.24, 0.03], 1.2],
        ['officeChair', -5.4, -15.8, -3, [0.05, -0.26, 0.03], 1.15],
        ['podcastMic', 4.3, -19.2, 0.3, [0.08, -0.3, 0.05], 1.05],
        ['laptop', -4.6, -20.4, -1.2, [0.1, 0.26, 0.04], 1.05],
        ['coffeeCup', -4.1, -24, 0.6, [0.15, 0.38, 0.08], 0.85],
        ['desk', 5, -25.6, -2.4, [0.06, -0.22, 0.04], 1.05],
        ['headphones', 4.2, -29.6, -0.4, [0.16, 0.3, 0.06], 1],
        ['plant', -4.8, -31.2, -1.6, [0.04, 0.26, 0.03], 1.1],
        ['monitor', -5.2, -35.2, -3, [0.05, 0.24, 0.03], 1],
        ['officeChair', 4.6, -37.2, -0.8, [0.05, 0.3, 0.03], 1.05],
      ];
      for (const [model, x, y, z, spin, size] of layout) {
        const obj = kit[model]();
        obj.rotation.set(Math.random() * 0.8 - 0.4, Math.random() * Math.PI * 2, Math.random() * 0.6 - 0.3);
        obj.position.set(0, y, z);
        scene.add(obj);
        items.push({obj, base: {x, y, z}, spin, bob: 0.22, phase: Math.random() * Math.PI * 2, size});
      }

      // Dust: fine champagne points through the corridor.
      const dustCount = narrow() ? 180 : 380;
      const pos = new Float32Array(dustCount * 3);
      for (let i = 0; i < dustCount; i++) {
        pos[i * 3] = (Math.random() - 0.5) * 18;
        pos[i * 3 + 1] = 4 - Math.random() * 46;
        pos[i * 3 + 2] = -8 + Math.random() * 9;
      }
      const dustGeo = new THREE.BufferGeometry();
      dustGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      const dustMat = new THREE.PointsMaterial({color: 0xb97a08, size: 0.035, transparent: true, opacity: 0.5, depthWrite: false});
      const dust = new THREE.Points(dustGeo, dustMat);
      scene.add(dust);

      scene.add(new THREE.HemisphereLight(0xffffff, 0xb8b7b2, 0.95));
      const key = new THREE.DirectionalLight(0xfff0d6, 1.7);
      key.position.set(4, 6, 6);
      scene.add(key);
      const rim = new THREE.DirectionalLight(0x9fc1b0, 0.6);
      rim.position.set(-5, -3, -2);
      scene.add(rim);

      const rig = {y: 0, sway: 0, roll: 0};
      const pointer = {x: 0, y: 0};
      const render = () => {
        camera.position.set(rig.sway + pointer.x * 0.9, rig.y - pointer.y * 0.6, 10);
        camera.lookAt(rig.sway * 0.4 + pointer.x * 0.3, rig.y, 0);
        camera.rotation.z += rig.roll;
        renderer.render(scene, camera);
      };

      // Anchor each object to the edge band of the current viewport at its depth.
      const halfFov = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
      const applyLayout = () => {
        const scale = narrow() ? 0.55 : 1;
        for (const it of items) {
          const halfW = halfFov * (camera.position.z - it.base.z) * camera.aspect;
          const k = 0.86 + Math.min(1, Math.max(0, (Math.abs(it.base.x) - 3.6) / 2.2)) * 0.16;
          it.obj.position.x = Math.sign(it.base.x) * halfW * k;
          it.obj.scale.setScalar(it.size * scale * 0.72);
        }
      };
      const resize = () => {
        const w = window.innerWidth, h = window.innerHeight;
        renderer.setSize(w, h, false);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        applyLayout();
        render();
      };

      // Camera rig: ScrollTrigger scrubs depth down the corridor across the whole page,
      // with a gentle sway and a slow roll so the descent feels cinematic.
      const camTl = gsap.timeline({defaults: {ease: 'none'}, scrollTrigger: {trigger: document.documentElement, start: 'top top', end: 'bottom bottom', scrub: reduced ? true : 1.2}});
      camTl.to(rig, {y: -36, duration: 1}, 0)
        .to(rig, {sway: 0.9, duration: 0.25, ease: 'sine.inOut'}, 0)
        .to(rig, {sway: -0.9, duration: 0.5, ease: 'sine.inOut'}, 0.25)
        .to(rig, {sway: 0, duration: 0.25, ease: 'sine.inOut'}, 0.75)
        .to(rig, {roll: 0.035, duration: 0.5, ease: 'sine.inOut'}, 0)
        .to(rig, {roll: -0.02, duration: 0.5, ease: 'sine.inOut'}, 0.5);

      // Scroll velocity -> extra spin, decaying smoothly.
      const boost = {v: 0};
      const velTrigger = ScrollTrigger.create({
        trigger: document.documentElement, start: 'top top', end: 'bottom bottom',
        onUpdate: self => {
          const v = Math.min(Math.abs(self.getVelocity()) / 1800, 2.5);
          if (v > boost.v) gsap.to(boost, {v, duration: 0.25, overwrite: true, onComplete: () => {gsap.to(boost, {v: 0, duration: 1.6, ease: 'power2.out'});}});
        },
      });

      const px = gsap.quickTo(pointer, 'x', {duration: 1.2, ease: 'power3.out'});
      const py = gsap.quickTo(pointer, 'y', {duration: 1.2, ease: 'power3.out'});
      const onPointer = (e: PointerEvent) => {px(e.clientX / window.innerWidth - 0.5); py(e.clientY / window.innerHeight - 0.5);};
      if (finePointer && !reduced) window.addEventListener('pointermove', onPointer, {passive: true});

      /* Adaptive quality governor: keeps scrolling smooth on weaker GPUs / high-DPI screens.
         Watches frame time over ~1s windows and steps down: pixel ratio -> 1, then render the
         3D layer every other frame (~30fps; GSAP + Lenis stay at full rate), then stop the
         layer (still frame). Steps back up if headroom returns. */
      const dprMax = Math.min(window.devicePixelRatio || 1, narrow() ? 1 : 1.5);
      let quality = 0; // 0 full, 1 dpr 1, 2 half-rate, 3 still
      let win = 0, winFrames = 0, frameNo = 0, good = 0;
      const setQuality = (q: number) => {
        quality = Math.max(0, Math.min(3, q));
        renderer.setPixelRatio(quality >= 1 ? 1 : dprMax);
        renderer.setSize(window.innerWidth, window.innerHeight, false);
        document.documentElement.dataset.sceneQuality = String(quality);
        if (quality === 3 && document.documentElement.dataset.perf !== 'lite') {
          document.documentElement.dataset.perf = 'lite';
          window.dispatchEvent(new Event('wj:perf-lite'));
        }
      };
      const govern = (deltaMs: number) => {
        win += deltaMs; winFrames++;
        if (win < 1000) return;
        const avg = win / winFrames;
        win = 0; winFrames = 0;
        if (avg > 22 && quality < 3) {good = 0; setQuality(quality + 1);}
        else if (avg < 17.5 && quality > 0 && quality < 3) {if (++good >= 3) {good = 0; setQuality(quality - 1);}}
        else good = 0;
      };

      let t = 0;
      const tick = (_time: number, deltaMs: number) => {
        govern(deltaMs);
        if (quality === 3) return;
        frameNo++;
        if (quality === 2 && frameNo % 2) return;
        const dt = Math.min(deltaMs / 1000, 0.05) * (quality === 2 ? 2 : 1);
        t += dt;
        const speed = 1 + boost.v * 3;
        for (const it of items) {
          it.obj.rotation.x += it.spin[0] * dt * speed;
          it.obj.rotation.y += it.spin[1] * dt * speed;
          it.obj.rotation.z += it.spin[2] * dt * speed;
          it.obj.position.y = it.base.y + Math.sin(t * 0.55 + it.phase) * it.bob;
          it.obj.position.z = it.base.z + Math.sin(t * 0.32 + it.phase) * 0.25;
        }
        dust.rotation.y = Math.sin(t * 0.05) * 0.15;
        render();
      };

      resize();
      window.addEventListener('resize', resize, {passive: true});

      let running = false;
      const paused = () => document.documentElement.dataset.ambient === 'paused' || document.documentElement.dataset.sceneOff !== undefined;
      const sync = () => {
        const should = !reduced && !document.hidden && !paused();
        if (should && !running) {running = true; gsap.ticker.add(tick);}
        else if (!should && running) {running = false; gsap.ticker.remove(tick);}
      };
      // still frames keep following scroll when the loop is off
      camTl.eventCallback('onUpdate', () => {if (!running && !paused()) render();});

      document.documentElement.dataset.scene = 'live';
      const onVisibility = () => sync();
      document.addEventListener('visibilitychange', onVisibility);
      const mo = new MutationObserver(sync);
      mo.observe(document.documentElement, {attributes: true, attributeFilter: ['data-ambient', 'data-scene-off']});
      sync();
      render();

      world = {canvas: renderer.domElement, dispose: () => {
        gsap.ticker.remove(tick);
        camTl.scrollTrigger?.kill(); camTl.kill(); velTrigger.kill();
        mo.disconnect();
        document.removeEventListener('visibilitychange', onVisibility);
        window.removeEventListener('resize', resize);
        window.removeEventListener('pointermove', onPointer);
        delete document.documentElement.dataset.scene;
        // Repeated model instances share geometry; release each GPU buffer once.
        const geometries = new Set<{dispose: () => void}>();
        scene.traverse(o => {const m = o as unknown as {geometry?: {dispose: () => void}}; if (m.geometry) geometries.add(m.geometry);});
        geometries.forEach(geometry => geometry.dispose());
        Object.values(palette).forEach(m => m.dispose());
        dustMat.dispose(); envTex.dispose(); pmrem.dispose(); renderer.dispose();
        renderer.domElement.remove();
      }};
    };

    // Start after the page has painted so the scene never competes with LCP.
    const w = window as Window & {requestIdleCallback?: (cb: () => void, o?: {timeout: number}) => number; cancelIdleCallback?: (id: number) => void};
    const kick = () => {if (!disposed) start().catch(() => {/* CSS ambient layer remains */});};
    // Decoration never competes with loading: build the world after the first user interaction
    // (or a quiet 7s), then in an idle period. Real users see it fade in as they start reading.
    const INTERACTIONS = ['pointermove', 'pointerdown', 'keydown', 'wheel', 'scroll'] as const;
    let armed = false;
    const disarm = () => {INTERACTIONS.forEach(type => window.removeEventListener(type, onFirstInteraction)); window.clearTimeout(timer);};
    function onFirstInteraction() {
      disarm();
      if (disposed || started || document.documentElement.dataset.sceneOff !== undefined) {armed = false; return;}
      started = true;
      idle = w.requestIdleCallback?.(kick, {timeout: 2000});
      if (idle === undefined) timer = window.setTimeout(kick, 300);
    }
    const maybeStart = () => {
      if (started || armed || disposed || document.documentElement.dataset.sceneOff !== undefined) return;
      armed = true;
      INTERACTIONS.forEach(type => window.addEventListener(type, onFirstInteraction, {passive: true, once: true}));
      timer = window.setTimeout(onFirstInteraction, 7000);
    };
    window.addEventListener(SCENE_CHECK, maybeStart);
    maybeStart();

    return () => {
      disposed = true;
      window.removeEventListener(SCENE_CHECK, maybeStart);
      disarm();
      if (idle !== undefined) w.cancelIdleCallback?.(idle);
      if (timer !== undefined) window.clearTimeout(timer);
      worldDisposeTimer = window.setTimeout(() => {world?.dispose(); world = null;}, 4000);
    };
  }, []);

  return <div ref={host} className="scene-backdrop" aria-hidden="true"/>;
}
