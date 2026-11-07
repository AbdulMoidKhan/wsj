/*
  Procedural low-poly coworking objects for the background scene.
  No model downloads: each object is assembled from primitives, then merged per
  material so an object costs at most three draw calls. Units are roughly
  "one desk = 2 units wide". Every builder returns a Group centred near origin.
*/
import type * as THREE_NS from 'three';

type T = typeof THREE_NS;
type Geo = THREE_NS.BufferGeometry;
export type Palette = {metal: THREE_NS.Material; pearl: THREE_NS.Material; forest: THREE_NS.Material};
type Parts = {metal: Geo[]; pearl: Geo[]; forest: Geo[]};

export function createOfficeKit(THREE: T, merge: (g: Geo[]) => Geo | null, palette: Palette) {
  const at = (g: Geo, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) => {
    const m = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(1, 1, 1));
    // merging needs matching attributes: drop uv on every part for consistency
    const out = g.index ? g.toNonIndexed() : g;
    if (out !== g) g.dispose();
    out.deleteAttribute('uv');
    out.applyMatrix4(m);
    return out;
  };
  const box = (w: number, h: number, d: number) => new THREE.BoxGeometry(w, h, d);
  const cyl = (rt: number, rb: number, h: number, s = 18) => new THREE.CylinderGeometry(rt, rb, h, s);
  const sph = (r: number, w = 16, h = 12) => new THREE.SphereGeometry(r, w, h);
  const tor = (r: number, t: number, arc = Math.PI * 2) => new THREE.TorusGeometry(r, t, 10, 40, arc);

  const build = (fill: (p: Parts) => void) => {
    const p: Parts = {metal: [], pearl: [], forest: []};
    fill(p);
    const group = new THREE.Group();
    (Object.keys(p) as Array<keyof Parts>).forEach(key => {
      if (!p[key].length) return;
      const geo = merge(p[key]);
      p[key].forEach(g => g.dispose());
      if (geo) {geo.computeVertexNormals(); group.add(new THREE.Mesh(geo, palette[key]));}
    });
    return group;
  };

  const officeChair = () => build(p => {
    p.forest.push(at(box(1, 0.16, 0.95), 0, 0.55, 0));                       // seat cushion
    p.forest.push(at(box(0.92, 1.05, 0.14), 0, 1.18, -0.44, -0.12));         // backrest
    p.metal.push(at(cyl(0.05, 0.05, 0.5), 0, 0.25, 0));                       // gas lift
    for (let i = 0; i < 5; i++) {                                             // five-star base
      const a = (i / 5) * Math.PI * 2;
      p.metal.push(at(box(0.62, 0.05, 0.08), Math.cos(a) * 0.3, 0.02, Math.sin(a) * 0.3, 0, -a, 0));
      p.pearl.push(at(sph(0.065, 10, 8), Math.cos(a) * 0.6, -0.03, Math.sin(a) * 0.6));
    }
    for (const s of [-1, 1]) {                                                // armrests
      p.metal.push(at(cyl(0.03, 0.03, 0.34, 8), s * 0.5, 0.75, 0.05));
      p.pearl.push(at(box(0.1, 0.05, 0.5), s * 0.5, 0.93, 0.05));
    }
  });

  const desk = () => build(p => {
    p.pearl.push(at(box(2.2, 0.08, 1.05), 0, 0.92, 0));                       // top
    for (const s of [-1, 1]) {                                                // trestle legs
      p.metal.push(at(box(0.07, 0.88, 0.07), s * 0.98, 0.46, 0.42));
      p.metal.push(at(box(0.07, 0.88, 0.07), s * 0.98, 0.46, -0.42));
      p.metal.push(at(box(0.07, 0.06, 0.9), s * 0.98, 0.08, 0));
    }
    p.metal.push(at(box(1.9, 0.05, 0.05), 0, 0.3, -0.42));                    // stretcher
  });

  // Broadcast mic on a desk stand. Every part touches the next:
  // base (y 0-0.06) -> pole (0.06-0.94) -> U-yoke (bottom at 0.94) -> pivot knobs -> body.
  const podcastMic = () => build(p => {
    p.forest.push(at(cyl(0.44, 0.48, 0.06, 28), 0, 0.03, 0));               // weighted round base
    p.metal.push(at(cyl(0.05, 0.05, 0.02, 20), 0, 0.07, 0));                 // base collar
    p.metal.push(at(cyl(0.035, 0.035, 0.88, 12), 0, 0.5, 0));                // upright pole
    p.metal.push(at(tor(0.27, 0.028, Math.PI), 0, 1.21, 0, 0, 0, Math.PI));  // U-yoke opening upward
    for (const s of [-1, 1]) p.metal.push(at(cyl(0.045, 0.045, 0.1, 12), s * 0.24, 1.21, 0, 0, 0, Math.PI / 2)); // pivot knobs
    p.forest.push(at(new THREE.CapsuleGeometry(0.19, 0.42, 8, 20), 0, 1.24, 0)); // mic body
    for (const y of [1.3, 1.39, 1.48]) p.metal.push(at(tor(0.196, 0.014), 0, y, 0, Math.PI / 2)); // grille bands
    p.pearl.push(at(sph(0.17, 20, 14), 0, 1.5, 0));                          // windscreen cap
    p.metal.push(at(cyl(0.1, 0.12, 0.08, 18), 0, 0.99, 0));                  // tail / XLR housing
  });

  const laptop = () => build(p => {
    p.pearl.push(at(box(1.3, 0.05, 0.9), 0, 0, 0));                           // base
    p.forest.push(at(box(1.1, 0.01, 0.55), 0, 0.03, -0.08));                  // keyboard
    p.pearl.push(at(box(1.3, 0.85, 0.04), 0, 0.42, -0.48, -0.32));            // lid
    p.forest.push(at(box(1.18, 0.72, 0.01), 0, 0.42, -0.45, -0.32));          // screen
  });

  const deskLamp = () => build(p => {
    p.metal.push(at(cyl(0.32, 0.36, 0.07, 24), 0, 0, 0));                     // base
    p.metal.push(at(cyl(0.03, 0.03, 0.95, 8), 0.12, 0.45, 0, 0, 0, -0.25));   // lower arm
    p.metal.push(at(sph(0.06, 10, 8), 0.24, 0.92, 0));                        // joint
    p.metal.push(at(cyl(0.03, 0.03, 0.8, 8), 0.05, 1.22, 0, 0, 0, 0.75));     // upper arm
    p.pearl.push(at(cyl(0.12, 0.34, 0.36, 20), -0.28, 1.42, 0, 0, 0, 0.9));  // shade
  });

  const coffeeCup = () => build(p => {
    p.pearl.push(at(cyl(0.3, 0.24, 0.55, 24), 0, 0.28, 0));
    p.metal.push(at(tor(0.15, 0.035, Math.PI * 1.2), 0.3, 0.3, 0, 0, 0, -Math.PI * 0.6));
    p.pearl.push(at(cyl(0.42, 0.4, 0.04, 24), 0, 0, 0));                      // saucer
    p.forest.push(at(cyl(0.27, 0.27, 0.02, 24), 0, 0.52, 0));                 // coffee
  });

  const plant = () => build(p => {
    p.pearl.push(at(cyl(0.38, 0.28, 0.6, 20), 0, 0.3, 0));
    p.metal.push(at(tor(0.38, 0.025), 0, 0.6, 0, Math.PI / 2));
    const leaf = () => new THREE.ConeGeometry(0.12, 0.85, 6);
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2;
      p.forest.push(at(leaf(), Math.cos(a) * 0.12, 1.0, Math.sin(a) * 0.12, Math.sin(a) * 0.45, 0, -Math.cos(a) * 0.45));
    }
  });

  const headphones = () => build(p => {
    p.metal.push(at(tor(0.48, 0.045, Math.PI), 0, 0.2, 0));                   // band
    for (const s of [-1, 1]) {
      p.forest.push(at(cyl(0.2, 0.2, 0.16, 20), s * 0.5, 0.05, 0, 0, 0, Math.PI / 2));
      p.pearl.push(at(cyl(0.16, 0.16, 0.04, 20), s * 0.41, 0.05, 0, 0, 0, Math.PI / 2));
    }
  });

  const monitor = () => build(p => {
    p.forest.push(at(box(1.6, 0.95, 0.05), 0, 1.05, 0));
    p.pearl.push(at(box(1.66, 1.01, 0.03), 0, 1.05, -0.03));
    p.metal.push(at(box(0.08, 0.55, 0.06), 0, 0.35, -0.06));
    p.metal.push(at(box(0.6, 0.04, 0.35), 0, 0.06, 0));
  });

  // All instances have independent transforms, but the merged geometry and
  // palette are immutable. Build each model once per scene, not once per item.
  const reuse = (make: () => THREE_NS.Group) => {
    let template: THREE_NS.Group | undefined;
    return () => (template ??= make()).clone(true);
  };
  return {
    officeChair: reuse(officeChair), desk: reuse(desk), podcastMic: reuse(podcastMic),
    laptop: reuse(laptop), deskLamp: reuse(deskLamp), coffeeCup: reuse(coffeeCup),
    plant: reuse(plant), headphones: reuse(headphones), monitor: reuse(monitor),
  };
}
