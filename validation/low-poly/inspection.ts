import * as THREE from 'three';
import { pixelRatioFor } from '../../src/rendering/graphicsDetail';
import { LowPolyResources } from '../../src/rendering/lowPoly/resources';
import { createPrototype, prototypeIds } from './prototypes';

const canvas = document.querySelector<HTMLCanvasElement>('#scene')!;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(pixelRatioFor(window.devicePixelRatio, 'full'));
renderer.setSize(window.innerWidth, 520, false);
renderer.outputColorSpace = THREE.SRGBColorSpace;
const scene = new THREE.Scene();
scene.background = new THREE.Color('#25484e');
scene.fog = new THREE.Fog('#25484e', 15, 35);
scene.add(new THREE.HemisphereLight('#d5f4ea', '#344b54', 2));
const key = new THREE.DirectionalLight('#fff1d1', 3);
key.position.set(-2, 6, 5);
scene.add(key);
const camera = new THREE.OrthographicCamera(-7.4, 7.4, 2.7, -2.7, 0.1, 50);
const resources = new LowPolyResources();
let models: ReturnType<typeof createPrototype>[] = [];
const media = matchMedia('(prefers-reduced-motion: reduce)');
let reduced = media.matches,
  paused = false,
  time = 0,
  previous = performance.now(),
  frame = 0,
  nextMetrics = 0;
const events = new AbortController();
const listenerOptions = { signal: events.signal };
const metrics = document.querySelector<HTMLDivElement>('#metrics')!;
const view = document.querySelector<HTMLSelectElement>('#view')!;
const reducedButton = document.querySelector<HTMLButtonElement>('#reduced')!;
function setView() {
  // Rotate each specimen around its own centre, keeping five silhouettes in view.
  for (const { mesh } of models) {
    mesh.rotation.set(0, 0, 0);
    if (view.value === 'front') mesh.rotation.y = -Math.PI / 2;
    if (view.value === 'top') mesh.rotation.x = Math.PI / 2;
    if (view.value === 'three-quarter') mesh.rotation.set(0.25, -0.4, 0);
  }
  camera.position.set(0, 1, 12);
  camera.lookAt(0, 1, 0);
  camera.updateProjectionMatrix();
}
function restore() {
  if (models.length) return;
  models = prototypeIds.map((id, i) => {
    const p = createPrototype(resources, id);
    p.mesh.position.set(
      (i - 2) * 2.9,
      id === 'plant' || id === 'coral' ? 0 : 0.7,
      0,
    );
    scene.add(p.mesh);
    return p;
  });
  setView();
}
function release() {
  for (const p of models) p.dispose();
  models = [];
}
function snapshot() {
  return {
    models: models.length,
    cache: resources.counts,
    drawCalls: renderer.info.render.calls,
    triangles: renderer.info.render.triangles,
    geometries: renderer.info.memory.geometries,
    textures: renderer.info.memory.textures,
    programs: renderer.info.programs?.length ?? 0,
    paused,
    reduced,
    time,
    counts: models.map((p, i) => ({
      id: prototypeIds[i],
      triangles:
        (p.mesh.geometry.index?.count ??
          p.mesh.geometry.getAttribute('position').count) / 3,
    })),
  };
}
function render(now: number) {
  const dt = Math.max(0, Math.min((now - previous) / 1000, 0.05));
  previous = now;
  if (!paused) time += dt;
  for (const p of models) p.update(time, reduced);
  renderer.render(scene, camera);
  if (now >= nextMetrics) {
    metrics.textContent = JSON.stringify(snapshot(), null, 2);
    nextMetrics = now + 250;
  }
  frame = requestAnimationFrame(render);
}
function resize() {
  renderer.setSize(window.innerWidth, 520, false);
}
function preference() {
  reduced = media.matches;
  reducedButton.setAttribute('aria-pressed', String(reduced));
}
view.addEventListener('change', setView, listenerOptions);
document.querySelector('#pause')!.addEventListener(
  'click',
  (e) => {
    paused = !paused;
    (e.currentTarget as HTMLButtonElement).textContent = paused
      ? 'Resume motion'
      : 'Pause motion';
  },
  listenerOptions,
);
reducedButton.addEventListener(
  'click',
  () => {
    reduced = !reduced;
    reducedButton.setAttribute('aria-pressed', String(reduced));
  },
  listenerOptions,
);
document
  .querySelector('#release')!
  .addEventListener('click', release, listenerOptions);
document
  .querySelector('#restore')!
  .addEventListener('click', restore, listenerOptions);
window.addEventListener('resize', resize, listenerOptions);
media.addEventListener('change', preference, listenerOptions);
preference();
restore();
frame = requestAnimationFrame(render);
// Read-only harness instrumentation; absent from the production entry point.
Object.assign(window, {
  lowPolyInspection: {
    snapshot,
    dispose() {
      cancelAnimationFrame(frame);
      release();
      resources.dispose();
      renderer.dispose();
      events.abort();
    },
  },
});
