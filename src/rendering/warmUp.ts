import * as THREE from 'three';

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
 * Draw the whole scene once into a 1x1 target with frustum culling off and every LOD level
 * shown. Besides material textures, three.js creates some GPU data only on an object's first
 * draw (geometry buffers, morph and instance textures); this makes that happen now.
 */
export function renderEverything(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Object3D,
  camera: THREE.Camera,
): void {
  const target = new THREE.WebGLRenderTarget(1, 1);
  const culled: THREE.Object3D[] = [],
    lods: THREE.LOD[] = [];
  scene.traverse((object) => {
    if (object.frustumCulled) {
      object.frustumCulled = false;
      culled.push(object);
    }
    if (object instanceof THREE.LOD && object.autoUpdate) {
      object.autoUpdate = false;
      lods.push(object);
    }
  });
  const restore = revealLodLevels(scene),
    previous = renderer.getRenderTarget();
  try {
    renderer.setRenderTarget(target);
    renderer.render(scene, camera);
  } finally {
    renderer.setRenderTarget(previous);
    restore();
    for (const object of culled) object.frustumCulled = true;
    for (const lod of lods) lod.autoUpdate = true;
    target.dispose();
  }
}

/** Compile all shader programs (LOD levels included) and upload all GPU data before first use. */
export async function warmUpScene(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Object3D,
  camera: THREE.Camera,
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
  for (const texture of sceneTextures(scene)) renderer.initTexture(texture);
  await compiled;
  renderEverything(renderer, scene, camera);
}
