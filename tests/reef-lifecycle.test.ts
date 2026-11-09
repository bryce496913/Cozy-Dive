import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { AssetLoader } from '../src/assets/AssetLoader';
import type { LoadedAsset } from '../src/assets/AssetValidation';
import { Aquarium } from '../src/environment/Aquarium';
import {
  AuthoredReef,
  authoredPlantGeometry,
  PLANT_TEMPLATE_NODES,
} from '../src/environment/AuthoredReef';

/** Minimal structurally valid reef library: real node names, PBR maps, colours and phase UVs. */
function reefFixture(): {
  asset: LoadedAsset;
  geometries: THREE.BufferGeometry[];
} {
  const scene = new THREE.Group(),
    geometries: THREE.BufferGeometry[] = [];
  const texture = new THREE.DataTexture(new Uint8Array(16), 2, 2);
  const material = new THREE.MeshStandardMaterial({
    map: texture,
    normalMap: texture,
    roughnessMap: texture,
  });
  const add = (name: string, parent: THREE.Object3D = scene): THREE.Mesh => {
    const g = new THREE.BoxGeometry(0.4, 0.8, 0.4);
    g.translate(0, 0.4, 0);
    const n = g.attributes.position.count;
    g.setAttribute(
      'color',
      new THREE.BufferAttribute(new Float32Array(n * 3).fill(0.8), 3),
    );
    g.setAttribute(
      'uv1',
      new THREE.BufferAttribute(new Float32Array(n * 2).fill(0.25), 2),
    );
    geometries.push(g);
    const mesh = new THREE.Mesh(g, material);
    mesh.name = name;
    parent.add(mesh);
    return mesh;
  };
  for (let i = 0; i < 6; i++) {
    const root = new THREE.Group();
    root.name = `Rock_${i}_Root`;
    scene.add(root);
    for (const suffix of ['', '_LOD1', '_LOD2'])
      add(`Rock_${i}${suffix}`, root);
    for (let k = 0; k < 2; k++) {
      const c = add(`COLLIDER_Rock_${i}_${k}`, root);
      c.geometry.scale(0.5, 0.5, 0.5);
    }
  }
  for (let i = 0; i < 3; i++)
    for (const name of [
      'Pebble',
      'Coral_Branching',
      'Coral_Massive',
      'Coral_Plate',
      'Meadow_Blade',
      'Shell',
    ])
      add(`${name}_${i}`);
  for (const prefix of Object.values(PLANT_TEMPLATE_NODES))
    for (let i = 0; i < 3; i++) add(`${prefix}_${i}`);
  add('Coral_Massive_0_LOD1');
  add('Rubble_0');
  add('Rubble_1');
  add('Sand_Material').position.x = 40; // library spans a realistic staging extent
  return { asset: { scene, scenes: [scene], animations: [] }, geometries };
}

describe('AuthoredReef presentation lifecycle', () => {
  it('swaps and restores visuals, materials and structural hulls without changing identity', async () => {
    const q = new Aquarium();
    const { asset, geometries } = reefFixture();
    const disposed = vi.fn();
    geometries.forEach((g) => g.addEventListener('dispose', disposed));
    const colliders = q.collision.colliders,
      original = colliders.slice(),
      sandMaterial = q.sand.material,
      plantGeometry = q.plants.batches.map((b) => b.mesh.geometry);
    const reef = new AuthoredReef(q, new AssetLoader(async () => asset));
    expect(await reef.ready).toBe(true);
    expect(reef.state).toBe('ready');
    expect(reef.inventory.rocks).toBe(34);
    expect(reef.inventory.corals).toBe(9);
    expect(reef.inventory.debris).toBeGreaterThan(200);
    expect(q.rocks.every((r) => !r.mesh.visible)).toBe(true);
    expect(q.hardscape.formations.every((f) => !f.mesh.visible)).toBe(true);
    expect(q.sand.material).not.toBe(sandMaterial);
    expect(colliders).toBe(q.collision.colliders);
    expect(colliders.length).toBe(original.length + 34);
    for (const rock of q.rocks.filter((r) => r.solid))
      expect(colliders.includes(rock.collider!)).toBe(false);
    q.plants.batches.forEach((b, i) => {
      expect(b.mesh.geometry).not.toBe(plantGeometry[i]);
      expect(b.mesh.geometry.getAttribute('plantMotion')).toBeDefined();
    });
    // The authored vegetation keeps the shared current/pause clock.
    const swapped = q.plants.batches[0].mesh
      .material as THREE.MeshStandardMaterial;
    expect(swapped.onBeforeCompile).toBe(q.plants.material.onBeforeCompile);

    reef.setEnabled(false);
    expect(colliders).toEqual(original);
    expect(q.rocks.every((r) => r.mesh.visible)).toBe(true);
    expect(q.sand.material).toBe(sandMaterial);
    q.plants.batches.forEach((b, i) =>
      expect(b.mesh.geometry).toBe(plantGeometry[i]),
    );
    reef.setEnabled(true);
    expect(colliders.length).toBe(original.length + 34);

    reef.dispose();
    reef.dispose();
    expect(colliders).toEqual(original);
    expect(q.rocks.every((r) => r.mesh.visible)).toBe(true);
    expect(reef.root.parent).toBeNull();
    reef.setEnabled(true); // no resurrection after disposal
    expect(colliders).toEqual(original);
    expect(disposed).toHaveBeenCalledTimes(geometries.length);
    q.dispose();
  });
  it('keeps the procedural reef untouched when the library fails or is disposed early', async () => {
    const q = new Aquarium();
    const original = q.collision.colliders.slice();
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const failed = new AuthoredReef(
      q,
      new AssetLoader(() => Promise.reject(new Error('offline'))),
    );
    expect(await failed.ready).toBe(false);
    expect(failed.state).toBe('fallback');
    expect(q.collision.colliders).toEqual(original);
    expect(q.rocks.every((r) => r.mesh.visible)).toBe(true);
    const { asset } = reefFixture();
    const early = new AuthoredReef(q, new AssetLoader(async () => asset));
    early.dispose();
    expect(await early.ready).toBe(false);
    expect(q.collision.colliders).toEqual(original);
    expect(q.root.children.includes(early.root)).toBe(false);
    error.mockRestore();
    failed.dispose();
    q.dispose();
  });
  it('derives the established current-motion contract from authored plant templates', () => {
    const g = new THREE.BufferGeometry();
    g.setAttribute(
      'position',
      new THREE.Float32BufferAttribute([0, 0, 0, 0, 0.5, 0, 0.1, 1, 0], 3),
    );
    g.setAttribute(
      'normal',
      new THREE.Float32BufferAttribute([0, 1, 0, 0, 1, 0, 0, 1, 0], 3),
    );
    g.setAttribute(
      'uv',
      new THREE.Float32BufferAttribute([0, 0, 0, 0.5, 0, 1], 2),
    );
    g.setAttribute(
      'uv1',
      new THREE.Float32BufferAttribute([0.25, 0, 0.25, 0, 0.25, 0], 2),
    );
    g.setAttribute(
      'color',
      new THREE.Float32BufferAttribute([1, 0, 0, 0, 1, 0, 0, 0, 1], 3),
    );
    const out = authoredPlantGeometry(g, { sway: 0.04, frequency: 0.5 });
    const m = out.getAttribute('plantMotion');
    expect(m.getX(0)).toBe(0); // anchored base never moves
    expect(m.getX(1)).toBeCloseTo(0.25 * 0.04);
    expect(m.getX(2)).toBeCloseTo(0.04); // flexible tips move most
    expect(m.getY(2)).toBeCloseTo(Math.PI / 2);
    expect(m.getW(2)).toBe(0.5);
    expect(out.getAttribute('color').itemSize).toBe(3);
    expect(Array.from(m.array).every(Number.isFinite)).toBe(true);
    out.dispose();
    g.dispose();
  });
});
