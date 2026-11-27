import * as THREE from 'three';
import {
  CORE_FISH_IDS,
  CORE_FISH,
  CORE_FISH_ASSET,
} from '../../src/fish/lowPoly/designs';
import {
  ANCHORED_FISH_PARTS,
  anchoredFishGeometry,
} from '../../src/fish/lowPoly/anchored';
import { lowPolyMaterial } from '../../src/rendering/lowPoly/resources';
import { AssetLoader } from '../../src/assets/AssetLoader';
import { creatureStroke } from '../../src/environment/creatureStroke';
import { frogfishGape } from '../../src/creatures/discoveries/Frogfish';
const renderer = new THREE.WebGLRenderer({
  canvas: document.querySelector('canvas')!,
  antialias: true,
});
renderer.setPixelRatio(1);
renderer.setSize(1440, 1100, false);
const scene = new THREE.Scene();
scene.background = new THREE.Color('#2b4d52');
scene.fog = new THREE.Fog('#2b4d52', 20, 40);
scene.add(new THREE.HemisphereLight('#e8f4e0', '#405b61', 2));
const light = new THREE.DirectionalLight('#fff0d3', 2.5);
light.position.set(-3, 7, 8);
scene.add(light);
const camera = new THREE.OrthographicCamera(-9, 9, 1.5, -12.25, 0.1, 50);
camera.position.set(0, 0, 15);
let loader = new AssetLoader(),
  models: THREE.Group[] = [],
  meshes: THREE.Mesh[] = [],
  leases: Awaited<ReturnType<AssetLoader['acquire']>>[] = [],
  owned: THREE.Mesh[] = [],
  time = 0,
  previous = 0,
  paused = false,
  raf = 0,
  retired = false;
const labels = document.querySelector('#labels')!,
  view = document.querySelector<HTMLSelectElement>('#view')!,
  speed = document.querySelector<HTMLSelectElement>('#speed')!,
  media = matchMedia('(prefers-reduced-motion: reduce)');
function setView() {
  models.forEach((m) => {
    m.rotation.set(
      0,
      m.name === 'seahorse' || m.name === 'frogfish' ? Math.PI / 2 : 0,
      0,
    );
    if (view.value === 'front') m.rotation.y -= Math.PI / 2;
    if (view.value === 'top') m.rotation.x = Math.PI / 2;
    if (view.value === 'three-quarter') m.rotation.x = 0.2;
    m.rotation.y -= view.value === 'three-quarter' ? 0.45 : 0;
  });
}
async function restore() {
  if (models.length || retired) return;
  const next = await Promise.all(
    CORE_FISH_IDS.map((id) => loader.acquire(CORE_FISH_ASSET[id])),
  );
  leases = next;
  const identities = [...CORE_FISH_IDS, 'seahorse', 'frogfish'];
  for (let i = 0; i < identities.length; i++) {
    const model = new THREE.Group(),
      id = identities[i];
    model.name = id;
    model.position.set(-7.5 + (i % 6) * 3, -Math.floor(i / 6) * 2.25, 0);
    scene.add(model);
    models.push(model);
    if (i < CORE_FISH_IDS.length) {
      const near = next[i].model.getObjectByName('Body')!;
      near.removeFromParent();
      model.add(near);
      near.scale.setScalar(2 / CORE_FISH[CORE_FISH_IDS[i]].length);
      meshes.push(near as THREE.Mesh);
    } else {
      for (const name of ANCHORED_FISH_PARTS.filter((n) =>
        n.startsWith(id === 'seahorse' ? 'Horse' : 'Frog'),
      )) {
        const part = new THREE.Mesh(
          anchoredFishGeometry(name),
          lowPolyMaterial({ role: 'body', vertexColors: true }),
        );
        part.name = name;
        owned.push(part);
        model.add(part);
        if (name === 'HorseTail') part.position.y = 0.33;
        if (name === 'HorseDorsal') part.position.set(0, 0.59, -0.14);
        if (name === 'HorseLeftFin') part.position.set(0.045, 0.97, 0.02);
        if (name === 'HorseRightFin') {
          part.position.set(-0.045, 0.97, 0.02);
          part.scale.x = -1;
        }
        if (name === 'FrogJaw') part.position.set(0, 0.31, 0.16);
        if (name === 'FrogLure') part.position.set(0, 0.455, 0.275);
        if (name === 'FrogFoot') {
          const other = part.clone();
          other.scale.x = -1;
          model.add(other);
        }
      }
      model.scale.setScalar(1.5);
      model.children.forEach((p) => {
        p.position.y -= 0.5;
      });
    }
    const label = document.createElement('span');
    label.textContent = id.replaceAll('-', ' ');
    label.style.left = `${((model.position.x + 9) / 18) * 100}%`;
    label.style.top = `${((1.5 - model.position.y + 0.85) / 13.75) * 1100}px`;
    labels.append(label);
  }
  setView();
}
function release() {
  models.forEach((m) => m.removeFromParent());
  models = [];
  meshes = [];
  leases.forEach((l) => l.release());
  leases = [];
  owned.forEach((m) => {
    m.geometry.dispose();
    (m.material as THREE.Material).dispose();
  });
  owned = [];
  loader.dispose();
  loader = new AssetLoader();
  labels.replaceChildren();
}
function snapshot() {
  return {
    models: models.length,
    drawCalls: renderer.info.render.calls,
    triangles: renderer.info.render.triangles,
    geometries: renderer.info.memory.geometries,
    textures: renderer.info.memory.textures,
    morphAttributeBytes: meshes.reduce(
      (sum, m) =>
        sum +
        (m.geometry.morphAttributes.position ?? []).reduce(
          (n, a) => n + a.array.byteLength,
          0,
        ),
      0,
    ),
    time,
    paused,
    view: view.value,
    reduced: media.matches,
    counts: meshes.map((m, i) => ({
      id: CORE_FISH_IDS[i],
      triangles: m.geometry.attributes.position.count / 3,
    })),
  };
}
let nextMetrics = 0;
function render(now: number) {
  const dt = previous
    ? Math.min(0.05, Math.max(0, (now - previous) / 1000))
    : 0;
  previous = now;
  if (!paused) time += dt;
  const rate = Number(speed.value);
  for (let i = 0; i < meshes.length; i++)
    creatureStroke(
      meshes[i],
      { left: 0, right: 1 },
      Math.sin(time * 4 * rate + i) *
        Math.min(0.95, 0.25 + rate * 0.35) *
        (media.matches ? 0.5 : 1),
      Math.sin(time * 4 * rate + i + 0.6) * (media.matches ? 0.5 : 1),
    );
  for (const model of models)
    for (const part of model.children) {
      if (part.name === 'FrogJaw') part.rotation.x = frogfishGape(time);
      if (part.name === 'FrogLure') part.rotation.x = Math.sin(time) * 0.04;
      if (part.name === 'HorseDorsal')
        part.rotation.y = Math.sin(time * 12) * 0.12;
    }
  renderer.render(scene, camera);
  if (now > nextMetrics) {
    document.querySelector('#metrics')!.textContent = JSON.stringify(
      snapshot(),
      null,
      2,
    );
    nextMetrics = now + 500;
  }
  raf = requestAnimationFrame(render);
}
view.onchange = setView;
document.querySelector<HTMLButtonElement>('#pause')!.onclick = () => {
  paused = !paused;
};
document.querySelector<HTMLButtonElement>('#release')!.onclick = release;
document.querySelector<HTMLButtonElement>('#restore')!.onclick = () => {
  void restore();
};
await restore();
raf = requestAnimationFrame(render);
Object.assign(window, {
  fishInspection: {
    snapshot,
    dispose() {
      retired = true;
      cancelAnimationFrame(raf);
      release();
      loader.dispose();
      renderer.dispose();
    },
  },
});
