import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { ASSET_REGISTRY } from '../src/assets/AssetRegistry';
import { FISH_SPECIES } from '../src/fish/FishSpecies';
import { ReefAsset } from '../validation/ReefAsset';

const chromis = new ReefAsset('public/assets/models/fish/chromis.glb');
const SPECIES = [
  ['cardinalfish', 'pajama-cardinalfish'],
  ['firefish', 'firefish-goby'],
  ['assessor', 'yellow-assessor'],
  ['gramma', 'royal-gramma'],
] as const;
const box = (asset: ReefAsset, names: readonly string[]): THREE.Box3 => {
  const b = new THREE.Box3();
  for (const name of names) {
    const p = asset.primitive(name).positions,
      t = asset.node(name).translation ?? [0, 0, 0],
      part = new THREE.Box3().setFromArray(p);
    part.translate(new THREE.Vector3(t[0], t[1], t[2]));
    b.union(part);
  }
  return b;
};

describe('Pass 016 authored reef fish', () => {
  it.each(SPECIES)('%s keeps the accepted chromis rig contract', (id) => {
    const fish = new ReefAsset(`public/assets/models/fish/${id}.glb`);
    for (const name of ASSET_REGISTRY[id].requiredNodes)
      expect(fish.has(name), name).toBe(true);
    for (const name of [
      'Body',
      'Median_Fins',
      'Eyes_Gills_Mouth',
      'Pectoral_Left',
      'Pectoral_Right',
    ]) {
      const a = chromis.primitive(name),
        b = fish.primitive(name);
      // Same topology as the accepted rig: morphs, pivots and instancing behave identically.
      expect(b.positions.length, name).toBe(a.positions.length);
      expect(b.indices.length, name).toBe(a.indices.length);
      expect(b.positions.every(Number.isFinite), name).toBe(true);
      expect(b.attributes, name).toContain('COLOR_0');
    }
    for (const name of ['Body', 'Median_Fins']) {
      const mesh = fish.doc.meshes[fish.node(name).mesh!];
      expect(mesh.primitives[0].targets?.length ?? 0, name).toBe(2);
    }
    for (const side of ['Pectoral_Left', 'Pectoral_Right'])
      expect(fish.node(side).translation).toHaveLength(3);
  });
  it.each(SPECIES)('%s matches its species proportions', (id, speciesId) => {
    const fish = new ReefAsset(`public/assets/models/fish/${id}.glb`),
      species = FISH_SPECIES.find((s) => s.id === speciesId)!,
      all = box(fish, [
        'Body',
        'Median_Fins',
        'Pectoral_Left',
        'Pectoral_Right',
      ]),
      body = box(fish, ['Body']);
    const size = all.getSize(new THREE.Vector3()),
      bodySize = body.getSize(new THREE.Vector3());
    // Length includes the caudal fin (as the chromis does); +X forward.
    expect(size.x).toBeGreaterThan(species.length * 0.85);
    expect(size.x).toBeLessThan(species.length * 1.15);
    expect(bodySize.y).toBeGreaterThan(species.height * 0.75);
    expect(bodySize.y).toBeLessThan(species.height * 1.05);
    expect(bodySize.z).toBeLessThan(species.width * 1.05);
    expect(body.max.x).toBeGreaterThan(-body.min.x * 0.6); // snout forward of the tail root
  });
  it('gives the firefish its tall dorsal pennant', () => {
    const fish = new ReefAsset('public/assets/models/fish/firefish.glb'),
      fins = box(fish, ['Median_Fins']),
      body = box(fish, ['Body']);
    expect(fins.max.y).toBeGreaterThan(body.max.y * 2);
  });
});

describe('Pass 016 shared fish textures', () => {
  it('points identical authored maps at one texture and keeps unrelated ones', async () => {
    const { shareTextures } = await import('../src/benchmark/AuthoredSchool');
    const named = (name: string) => {
      const t = new THREE.Texture();
      t.name = name;
      return t;
    };
    const pool = new Map<string, THREE.Texture>();
    const a = new THREE.MeshStandardMaterial({
      map: named('fish-scales-base'),
      normalMap: named('chromis-normal'),
    });
    const b = new THREE.MeshStandardMaterial({
      map: named('fish-scales-base'),
      normalMap: named('other-normal'),
    });
    shareTextures(a, pool);
    shareTextures(b, pool);
    expect(b.map).toBe(a.map);
    expect(b.normalMap).not.toBe(a.normalMap);
    expect(pool.size).toBe(3);
  });
});
