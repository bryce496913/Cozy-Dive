import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { WARM_UP, renderGradually } from '../src/rendering/warmUp';

/**
 * v0.6 Pass 059: the warm-up draw, a chunk per frame. A stand-in renderer records which objects
 * each draw would reach (by the same layer test three.js uses) and how long each draw "takes".
 */
class RecordingRenderer {
  draws: THREE.Object3D[][] = [];
  lightsSeen: number[] = [];
  targets: (THREE.WebGLRenderTarget | null)[] = [];
  private target: THREE.WebGLRenderTarget | null = null;
  private scissorTest = false;
  constructor(private readonly costPerObject = 0) {}
  getRenderTarget() {
    return this.target;
  }
  setRenderTarget(t: THREE.WebGLRenderTarget | null) {
    this.target = t;
  }
  getViewport(v: THREE.Vector4) {
    return v.set(0, 0, 100, 100);
  }
  getScissor(v: THREE.Vector4) {
    return v.set(0, 0, 100, 100);
  }
  setViewport() {}
  setScissor() {}
  getScissorTest() {
    return this.scissorTest;
  }
  setScissorTest(on: boolean) {
    this.scissorTest = on;
  }
  render(scene: THREE.Object3D, camera: THREE.Camera) {
    const drawn: THREE.Object3D[] = [];
    let lights = 0;
    scene.traverseVisible((o) => {
      if (!o.layers.test(camera.layers)) return;
      if (o instanceof THREE.Light) lights++;
      else if (o instanceof THREE.Mesh) drawn.push(o);
    });
    this.draws.push(drawn);
    this.lightsSeen.push(lights);
    this.targets.push(this.target);
    // Pretend each object costs some time, so the chunk size adapts.
    const until = performance.now() + drawn.length * this.costPerObject;
    while (performance.now() < until) {
      /* busy */
    }
  }
}
function world(n: number) {
  const scene = new THREE.Scene(),
    camera = new THREE.PerspectiveCamera(),
    geometry = new THREE.BoxGeometry(),
    material = new THREE.MeshBasicMaterial();
  scene.add(new THREE.DirectionalLight());
  const meshes: THREE.Mesh[] = [];
  for (let i = 0; i < n; i++) {
    const m = new THREE.Mesh(geometry, material);
    m.layers.set(i % 2 ? 0 : 2);
    meshes.push(m);
    scene.add(m);
  }
  return { scene, camera, meshes };
}
// The stand-in implements just what the warm-up calls; the cast is confined to these tests.
const asRenderer = (r: RecordingRenderer) =>
  r as unknown as THREE.WebGLRenderer;
const noWait = () => Promise.resolve();

describe('gradual warm-up (Pass 059)', () => {
  it('draws every object exactly once, across several frames', async () => {
    const r = new RecordingRenderer(0.05),
      { scene, camera, meshes } = world(600);
    await renderGradually(asRenderer(r), scene, camera, () => true, noWait);
    const drawn = r.draws.flat();
    expect(new Set(drawn).size).toBe(meshes.length);
    expect(drawn.length).toBe(meshes.length);
    expect(r.draws.length).toBeGreaterThan(1);
  });
  it('draws to the screen (not a render target) with the lights in view', async () => {
    const r = new RecordingRenderer(),
      { scene, camera } = world(20);
    await renderGradually(asRenderer(r), scene, camera, () => true, noWait);
    expect(r.targets.every((t) => t === null)).toBe(true);
    expect(r.lightsSeen.every((n) => n === 1)).toBe(true);
  });
  it('puts back every layer, culling flag and the camera’s layers', async () => {
    const r = new RecordingRenderer(),
      { scene, camera, meshes } = world(40);
    meshes[3].frustumCulled = false;
    const masks = meshes.map((m) => m.layers.mask),
      cameraMask = camera.layers.mask;
    await renderGradually(asRenderer(r), scene, camera, () => true, noWait);
    expect(meshes.map((m) => m.layers.mask)).toEqual(masks);
    expect(meshes.filter((m) => !m.frustumCulled)).toEqual([meshes[3]]);
    expect(camera.layers.mask).toBe(cameraMask);
  });
  it('stops as soon as the world is no longer wanted', async () => {
    const r = new RecordingRenderer(0.2),
      { scene, camera } = world(300);
    let frames = 0;
    await renderGradually(
      asRenderer(r),
      scene,
      camera,
      () => frames < 1,
      () => {
        frames++;
        return Promise.resolve();
      },
    );
    expect(r.draws.length).toBe(1);
    expect(r.draws[0].length).toBe(WARM_UP.firstChunk);
  });
});
