import * as THREE from 'three';
import { nextFrame, type FrameWait } from './StagedBuild';

/**
 * Pass 019: three.js uploads a texture the first time something using it is drawn, and
 * `renderer.compile` only visits visible objects. Textures (and distance levels) first seen
 * mid-swim therefore uploaded and compiled on the fly, which showed as texture pop-in. These
 * helpers let the scene upload every texture and compile every LOD level behind the
 * "Preparing aquarium details" status instead.
 */

/** Every texture referenced by a material in `root`, including hidden objects and shader uniforms. */
export function sceneTextures(
  root: THREE.Object3D,
  out = new Set<THREE.Texture>(),
): Set<THREE.Texture> {
  const visit = (value: unknown): void => {
    if (value instanceof THREE.Texture) out.add(value);
  };
  root.traverse((object) => {
    if (!(object instanceof THREE.Mesh || object instanceof THREE.Points))
      return;
    const materials: THREE.Material[] = Array.isArray(object.material)
      ? object.material
      : [object.material];
    for (const material of materials) {
      for (const value of Object.values(material)) visit(value);
      if (material instanceof THREE.ShaderMaterial)
        for (const uniform of Object.values(material.uniforms))
          visit(uniform.value);
    }
  });
  return out;
}

/**
 * Make every level of every `THREE.LOD` in `root` visible so a synchronous traversal (such as
 * `renderer.compile`) reaches them. Returns a function restoring the previous visibility; LODs
 * also reselect their level on the next render.
 */
export function revealLodLevels(root: THREE.Object3D): () => void {
  const hidden: THREE.Object3D[] = [];
  root.traverse((object) => {
    if (!(object instanceof THREE.LOD)) return;
    for (const level of object.levels)
      if (!level.object.visible) {
        level.object.visible = true;
        hidden.push(level.object);
      }
  });
  return () => {
    for (const object of hidden) object.visible = false;
  };
}

/**
 * v0.6 Pass 059: how the warm-up is spread over frames. Each frame uploads or draws only as much
 * as fits in `budgetMs`, so preparing a world no longer stalls one frame for half a second.
 */
export const WARM_UP = { budgetMs: 8, firstChunk: 8, maxChunk: 512 } as const;
/** A layer no scene uses, for drawing one chunk of a scene at a time. */
const WARM_LAYER = 31;
const corner = new THREE.Vector4(),
  savedViewport = new THREE.Vector4(),
  savedScissor = new THREE.Vector4();

/** Every object a full draw would reach (LOD levels revealed), in traversal order. */
function drawables(scene: THREE.Object3D): THREE.Object3D[] {
  const out: THREE.Object3D[] = [],
    restore = revealLodLevels(scene);
  try {
    scene.traverseVisible((o) => {
      if (
        o instanceof THREE.Mesh ||
        o instanceof THREE.Points ||
        o instanceof THREE.Line ||
        o instanceof THREE.Sprite
      )
        out.push(o);
    });
  } finally {
    restore();
  }
  return out;
}

/**
 * Draw `objects` (part of `scene`) once, with frustum culling off and every LOD level shown, into
 * a 1x1 corner of the screen. Three.js creates some GPU data only on an object's first draw
 * (geometry buffers, morph and instance textures); this makes that happen now.
 *
 * v0.6 Pass 059: it draws to the screen, not into a render target. Three.js builds different
 * programs for a render target (linear output, no tone mapping) than for the screen, so the old
 * 1x1 target compiled a second, unused copy of every program, synchronously, and the real ones
 * were still compiled on first sight. The corner pixel is redrawn by the next frame.
 */
function drawPart(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Object3D,
  camera: THREE.Camera,
  objects: readonly THREE.Object3D[],
): void {
  const masks = objects.map((o) => o.layers.mask),
    culled = objects.map((o) => o.frustumCulled),
    lights: [THREE.Light, number][] = [],
    lods: THREE.LOD[] = [],
    cameraMask = camera.layers.mask;
  for (const o of objects) {
    o.layers.enable(WARM_LAYER);
    o.frustumCulled = false;
  }
  // Lights must be seen by the warm-up camera, or the programs would be built for no lights.
  scene.traverse((o) => {
    if (o instanceof THREE.Light) {
      lights.push([o, o.layers.mask]);
      o.layers.enable(WARM_LAYER);
    }
    if (o instanceof THREE.LOD && o.autoUpdate) {
      o.autoUpdate = false;
      lods.push(o);
    }
  });
  camera.layers.set(WARM_LAYER);
  const restore = revealLodLevels(scene),
    target = renderer.getRenderTarget(),
    scissorTest = renderer.getScissorTest();
  renderer.getViewport(savedViewport);
  renderer.getScissor(savedScissor);
  try {
    renderer.setRenderTarget(null);
    corner.set(0, 0, 1, 1);
    renderer.setViewport(corner);
    renderer.setScissor(corner);
    renderer.setScissorTest(true);
    renderer.render(scene, camera);
  } finally {
    renderer.setViewport(savedViewport);
    renderer.setScissor(savedScissor);
    renderer.setScissorTest(scissorTest);
    renderer.setRenderTarget(target);
    restore();
    camera.layers.mask = cameraMask;
    objects.forEach((o, i) => {
      o.layers.mask = masks[i];
      o.frustumCulled = culled[i];
    });
    for (const [light, mask] of lights) light.layers.mask = mask;
    for (const lod of lods) lod.autoUpdate = true;
  }
}

/** Draw the whole scene once, at once (see `drawPart`). */
export function renderEverything(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Object3D,
  camera: THREE.Camera,
): void {
  drawPart(renderer, scene, camera, drawables(scene));
}

/**
 * v0.6 Pass 059: `renderEverything` a piece per frame, each piece sized to the frame budget from
 * how long the last one took. Stops early once `alive` says the scene is no longer wanted (a
 * disposed world must not be drawn, or its buffers would be uploaded again).
 */
export async function renderGradually(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Object3D,
  camera: THREE.Camera,
  alive: () => boolean = () => true,
  frame: FrameWait = nextFrame,
): Promise<void> {
  const all = drawables(scene);
  let size: number = WARM_UP.firstChunk;
  for (let at = 0; at < all.length;) {
    if (!alive()) return;
    const part = all.slice(at, at + size),
      begun = performance.now();
    drawPart(renderer, scene, camera, part);
    at += part.length;
    const took = Math.max(0.1, performance.now() - begun);
    size = Math.max(
      1,
      Math.min(WARM_UP.maxChunk, Math.round(size * (WARM_UP.budgetMs / took))),
    );
    if (at < all.length) await frame();
  }
}

/** v0.6 Pass 059: upload textures a few per frame, within the same budget. */
async function uploadGradually(
  renderer: THREE.WebGLRenderer,
  textures: Iterable<THREE.Texture>,
  alive: () => boolean,
  frame: FrameWait,
): Promise<void> {
  let begun = performance.now();
  for (const texture of textures) {
    if (!alive()) return;
    renderer.initTexture(texture);
    if (performance.now() - begun > WARM_UP.budgetMs) {
      await frame();
      begun = performance.now();
    }
  }
}

/**
 * Compile all shader programs (LOD levels included) and upload all GPU data before first use.
 * v0.6 Pass 059: the uploads and the warm-up draw are spread over frames within a budget, and
 * stop if `alive` turns false.
 */
export async function warmUpScene(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Object3D,
  camera: THREE.Camera,
  alive: () => boolean = () => true,
  frame: FrameWait = nextFrame,
): Promise<void> {
  const restore = revealLodLevels(scene);
  let compiled: Promise<unknown> | undefined;
  try {
    // compileAsync collects and starts every program synchronously, so levels can be
    // re-hidden straight after the call; parallel compilation finishes in the background.
    if (renderer.extensions.has('KHR_parallel_shader_compile'))
      compiled = renderer.compileAsync(scene, camera);
    else renderer.compile(scene, camera);
  } finally {
    restore();
  }
  await uploadGradually(renderer, sceneTextures(scene), alive, frame);
  await compiled;
  if (alive()) await renderGradually(renderer, scene, camera, alive, frame);
}
