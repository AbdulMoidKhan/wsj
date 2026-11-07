'use strict';
// CPU-only model construction benchmark, no browser/GPU or application server.
const fs = require('node:fs');
const path = require('node:path');
const out = process.argv[2];
if (!out || !path.isAbsolute(out) || fs.existsSync(out)) throw Error('Provide a fresh absolute JSON output path');
require('./ts-register.cjs');
const THREE = require('three');
const {mergeGeometries} = require('three/examples/jsm/utils/BufferGeometryUtils.js');
const {createOfficeKit} = require('../../components/office-models.ts');
const names = ['officeChair','podcastMic','laptop','coffeeCup','desk','headphones','deskLamp','monitor','plant','officeChair','podcastMic','laptop','coffeeCup','desk','headphones','plant','monitor','officeChair'];
const samples = [];
for (let run = 0; run < 25; run++) {
 const palette = {metal: new THREE.MeshStandardMaterial(), pearl: new THREE.MeshStandardMaterial(), forest: new THREE.MeshStandardMaterial()};
 const start = performance.now();
 const kit = createOfficeKit(THREE, geometries => mergeGeometries(geometries, false), palette);
 const objects = names.map(name => kit[name]());
 const durationMs = performance.now() - start;
 const geometries = new Set(); let meshes = 0;
 objects.forEach(object => object.traverse(child => {if (child.geometry) {geometries.add(child.geometry); meshes++;}}));
 let geometryBytes = 0;
 geometries.forEach(geometry => {Object.values(geometry.attributes).forEach(attribute => {geometryBytes += attribute.array.byteLength;}); geometry.dispose();});
 Object.values(palette).forEach(material => material.dispose());
 if (run >= 5) samples.push({durationMs, uniqueGeometries: geometries.size, geometryBytes, meshes});
}
const ordered = samples.map(sample => sample.durationMs).sort((a, b) => a - b);
const result = {conditions: 'CPU-only Three.js construction for the exact 18-model scene sequence, 5 discarded warm-ups, 20 measured samples; no rendering/GPU/network.', medianMs: (ordered[9] + ordered[10]) / 2, p95Ms: ordered[18], samples};
fs.writeFileSync(out, JSON.stringify(result, null, 2), {flag: 'wx'});
console.log(JSON.stringify({medianMs: result.medianMs, p95Ms: result.p95Ms, ...samples[0]}));
