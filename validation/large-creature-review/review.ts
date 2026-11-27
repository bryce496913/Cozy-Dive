import * as THREE from 'three';
import {
  LARGE_CREATURE_IDS,
  largeCreatureDesign,
  type LargeCreatureId,
} from '../../src/creatures/lowPoly/designs';
import { largeCreatureGeometry } from '../../src/creatures/lowPoly/model';
import { lowPolyMaterial } from '../../src/rendering/lowPoly/resources';

const NAMES: Record<LargeCreatureId, string> = {
  reefShark: 'Blacktip reef shark',
  whitetipShark: 'Whitetip reef shark',
  greatWhite: 'Great white shark',
  hammerhead: 'Hammerhead shark',
  scallopedHammerhead: 'Scalloped hammerhead shark',
  leopardShark: 'Leopard shark',
  nurseShark: 'Nurse shark',
  whaleShark: 'Whale shark',
  eagleRay: 'Spotted eagle ray',
  batRay: 'Bat ray',
  mantaRay: 'Manta ray',
  seaTurtle: 'Green sea turtle',
  sunfish: 'Ocean sunfish',
  humpbackWhale: 'Humpback whale',
  minkeWhale: 'Antarctic minke whale',
  killerWhale: 'Killer whale',
  seaLion: 'California sea lion',
  harbourSeal: 'Harbour seal',
  weddellSeal: 'Weddell seal',
  weddellSealPup: 'Weddell seal pup',
  leopardSeal: 'Leopard seal',
  emperorPenguin: 'Emperor penguin',
  adeliePenguin: 'Adélie penguin',
  seaOtter: 'Sea otter',
  polarBear: 'Polar bear',
};

interface Specimen {
  readonly id: LargeCreatureId;
  readonly scene: THREE.Scene;
  readonly camera: THREE.PerspectiveCamera;
  readonly mesh: THREE.Mesh;
  readonly viewport: HTMLElement;
  readonly geometry: THREE.BufferGeometry;
  readonly material: THREE.Material;
}

const canvas = document.querySelector<HTMLCanvasElement>('#render')!;
const grid = document.querySelector<HTMLElement>('#grid')!;
const selection = document.querySelector<HTMLElement>('#selection')!;
const view = document.querySelector<HTMLSelectElement>('#view')!;
const motionButton = document.querySelector<HTMLButtonElement>('#motion')!;
const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  alpha: true,
});
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.setScissorTest(true);

const selected = new Set<LargeCreatureId>();
const specimens: Specimen[] = [];
let moving = !matchMedia('(prefers-reduced-motion: reduce)').matches;
let frame = 0;
let time = 0;
let previous = performance.now();

function articleFor(id: LargeCreatureId): HTMLElement {
  const design = largeCreatureDesign(id);
  const article = document.createElement('article');
  article.innerHTML = `
    <div class="viewport" data-creature="${id}"></div>
    <div class="label">
      <div><h2>${NAMES[id]}</h2><div class="family">${design.family}</div></div>
      <label><input type="checkbox" value="${id}"> Needs redesign</label>
    </div>`;
  const input = article.querySelector<HTMLInputElement>('input')!;
  input.addEventListener('change', () => {
    if (input.checked) selected.add(id);
    else selected.delete(id);
    updateSelection();
  });
  return article;
}

function createSpecimen(id: LargeCreatureId, viewport: HTMLElement): Specimen {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#285b67');
  scene.add(new THREE.HemisphereLight('#e0f4ec', '#173b44', 2.2));
  const key = new THREE.DirectionalLight('#fff0cf', 3.2);
  key.position.set(-3, 5, 6);
  scene.add(key);
  const geometry = largeCreatureGeometry(id);
  const material = lowPolyMaterial({ role: 'body', vertexColors: true });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = NAMES[id];
  const box = new THREE.Box3().setFromObject(mesh);
  mesh.position.sub(box.getCenter(new THREE.Vector3()));
  scene.add(mesh);
  return {
    id,
    scene,
    camera: new THREE.PerspectiveCamera(31, 1, 0.01, 100),
    mesh,
    viewport,
    geometry,
    material,
  };
}

function setCamera(specimen: Specimen): void {
  const size = new THREE.Box3()
    .setFromObject(specimen.mesh)
    .getSize(new THREE.Vector3());
  const length = Math.max(size.x, size.y, size.z);
  const direction = new THREE.Vector3(0.72, 0.3, 1);
  if (view.value === 'side') direction.set(0, 0.08, 1);
  if (view.value === 'front') direction.set(1, 0.08, 0.04);
  if (view.value === 'top') direction.set(0.04, 1, 0.12);
  specimen.camera.position.copy(
    direction.normalize().multiplyScalar(length * 1.65),
  );
  specimen.camera.lookAt(0, 0, 0);
  specimen.camera.updateProjectionMatrix();
}

function updateSelection(): void {
  const ids = LARGE_CREATURE_IDS.filter((id) => selected.has(id));
  selection.classList.toggle('empty', !ids.length);
  selection.textContent = ids.length
    ? ids.map((id) => `- ${NAMES[id]} (${id})`).join('\n')
    : 'No creatures selected.';
}

for (const id of LARGE_CREATURE_IDS) {
  const article = articleFor(id);
  grid.append(article);
  specimens.push(createSpecimen(id, article.querySelector('.viewport')!));
}

function resizeRenderer(): void {
  const ratio = Math.min(devicePixelRatio, 2);
  const width = Math.floor(innerWidth * ratio);
  const height = Math.floor(innerHeight * ratio);
  if (canvas.width !== width || canvas.height !== height) {
    renderer.setSize(innerWidth, innerHeight, false);
    renderer.setPixelRatio(ratio);
  }
}

function render(now: number): void {
  const dt = Math.min(0.05, Math.max(0, (now - previous) / 1000));
  previous = now;
  if (moving) time += dt;
  resizeRenderer();
  renderer.setScissorTest(false);
  renderer.setClearColor('#10282f', 1);
  renderer.clear();
  renderer.setScissorTest(true);
  for (const specimen of specimens) {
    const rect = specimen.viewport.getBoundingClientRect();
    if (rect.bottom < 0 || rect.top > innerHeight) continue;
    const left = Math.max(0, rect.left);
    const width = Math.min(innerWidth, rect.right) - left;
    const height = Math.min(innerHeight, rect.bottom) - Math.max(0, rect.top);
    if (width <= 0 || height <= 0) continue;
    specimen.camera.aspect = rect.width / rect.height;
    setCamera(specimen);
    const influences = specimen.mesh.morphTargetInfluences;
    const dictionary = specimen.mesh.morphTargetDictionary;
    if (influences && dictionary) {
      const leftStroke = dictionary.Stroke_Left;
      const rightStroke = dictionary.Stroke_Right;
      const stroke = Math.sin(time * 1.7);
      if (leftStroke !== undefined)
        influences[leftStroke] = Math.max(0, stroke);
      if (rightStroke !== undefined)
        influences[rightStroke] = Math.max(0, -stroke);
    }
    renderer.setViewport(
      rect.left,
      innerHeight - rect.bottom,
      rect.width,
      rect.height,
    );
    renderer.setScissor(
      rect.left,
      innerHeight - rect.bottom,
      rect.width,
      rect.height,
    );
    renderer.render(specimen.scene, specimen.camera);
  }
  frame = requestAnimationFrame(render);
}

view.addEventListener('change', () => specimens.forEach(setCamera));
motionButton.addEventListener('click', () => {
  moving = !moving;
  motionButton.textContent = moving ? 'Pause motion' : 'Resume motion';
});
document.querySelector('#select-all')!.addEventListener('click', () => {
  for (const input of document.querySelectorAll<HTMLInputElement>('input')) {
    input.checked = true;
    selected.add(input.value as LargeCreatureId);
  }
  updateSelection();
});
document.querySelector('#clear')!.addEventListener('click', () => {
  selected.clear();
  document.querySelectorAll<HTMLInputElement>('input').forEach((input) => {
    input.checked = false;
  });
  updateSelection();
});
document.querySelector('#copy')!.addEventListener('click', async () => {
  await navigator.clipboard.writeText(selection.textContent ?? '');
});

frame = requestAnimationFrame(render);
Object.assign(window, {
  largeCreatureReview: {
    ids: [...LARGE_CREATURE_IDS],
    selected,
    dispose() {
      cancelAnimationFrame(frame);
      for (const specimen of specimens) {
        specimen.geometry.dispose();
        specimen.material.dispose();
      }
      renderer.dispose();
    },
  },
});
