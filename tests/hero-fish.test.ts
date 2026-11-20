import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { ASSET_REGISTRY } from '../src/assets/AssetRegistry';
import { FISH_SPECIES } from '../src/fish/FishSpecies';
import { ReefAsset } from '../validation/ReefAsset';
import { validateGlbFile } from '../validation/AssetStandards';

/** V0.7 Pass 065: the hero fish (rebuilt from anatomy) keep the runtime rig contract. */
const HEROES = [
  ['chromis', 'blue-green-chromis'],
  ['clownfish', 'ocellaris-clownfish'],
  ['gramma', 'royal-gramma'],
] as const;
const tris = (fish: ReefAsset, name: string) =>
  fish.doc.meshes[fish.node(name).mesh!].primitives.reduce(
    (sum, p) =>
      sum + (fish.doc.accessors as { count: number }[])[p.indices].count / 3,
    0,
  );

describe('V0.7 Pass 065 hero fish', () => {
  it.each(HEROES)(
    '%s keeps the rig contract the instanced runtime drives',
    (id) => {
      const fish = new ReefAsset(`public/assets/models/fish/${id}.glb`);
      for (const name of ASSET_REGISTRY[id].requiredNodes)
        expect(fish.has(name), name).toBe(true);
      for (const name of [
        'Body',
        'Median_Fins',
        'Body_LOD1',
        'Median_Fins_LOD1',
      ]) {
        const mesh = fish.doc.meshes[fish.node(name).mesh!];
        expect(mesh.primitives[0].targets?.length ?? 0, name).toBe(2);
        expect(
          fish.primitive(name).positions.every(Number.isFinite),
          name,
        ).toBe(true);
      }
      for (const side of ['Pectoral_Left', 'Pectoral_Right'])
        expect(fish.node(side).translation, side).toHaveLength(3);
    },
  );

  it.each(HEROES)(
    '%s stays within the fish budget and is cheaper than the old rig',
    (id) => {
      const fish = new ReefAsset(`public/assets/models/fish/${id}.glb`);
      const near = [
        'Body',
        'Median_Fins',
        'Eyes_Gills_Mouth',
        'Pectoral_Left',
        'Pectoral_Right',
      ]
        .map((n) => tris(fish, n))
        .reduce((a, b) => a + b);
      const far = ['Body_LOD1', 'Median_Fins_LOD1', 'Eyes_Gills_Mouth_LOD1']
        .map((n) => tris(fish, n))
        .reduce((a, b) => a + b);
      expect(near).toBeLessThan(12686); // the accepted chromis rig
      expect(near).toBeGreaterThan(6000);
      expect(far).toBeLessThan(2600);
    },
  );

  it.each(HEROES)(
    '%s matches its species length, +X forward',
    (id, speciesId) => {
      const fish = new ReefAsset(`public/assets/models/fish/${id}.glb`),
        species = FISH_SPECIES.find((s) => s.id === speciesId)!,
        b = new THREE.Box3();
      for (const name of ['Body', 'Median_Fins'])
        b.union(new THREE.Box3().setFromArray(fish.primitive(name).positions));
      const length = species.authoredLength ?? species.length,
        size = b.getSize(new THREE.Vector3());
      expect(size.x).toBeGreaterThan(length * 0.85);
      expect(size.x).toBeLessThan(length * 1.15);
      // The snout (+X) is the body's front; the caudal fin extends behind (-X).
      const body = new THREE.Box3().setFromArray(
        fish.primitive('Body').positions,
      );
      expect(body.max.x).toBeGreaterThan(-b.min.x * 0.6);
    },
  );

  it.each(HEROES)('%s passes the V0.7 production checks', async (id) => {
    const r = await validateGlbFile(`public/assets/models/fish/${id}.glb`);
    expect(r.errors).toEqual([]);
    expect(r.warnings).toEqual([]);
    expect(r.stats.morphTargets).toEqual(['Stroke_Left', 'Stroke_Right']);
  });
});

/** V0.7 Pass 066: the whole roster is built on the hero standard. */
const ROSTER = [
  'chromis',
  'clownfish',
  'gramma',
  'assessor',
  'cardinalfish',
  'firefish',
  'butterflyfish',
  'bannerfish',
  'idol',
  'bluetang',
  'icefish',
  'notothen',
  'toothfish',
  'napoleon',
  'seabass',
  'parrotfish',
  'sheephead',
  'trevally',
] as const;
describe('V0.7 Pass 066 fish roster', () => {
  it.each(ROSTER)(
    '%s meets the hero production standard and budget',
    async (id) => {
      const file = `public/assets/models/fish/${id}.glb`;
      const r = await validateGlbFile(file);
      expect(r.errors).toEqual([]);
      expect(r.warnings).toEqual([]);
      const fish = new ReefAsset(file);
      const sum = (names: string[]) =>
        names.map((n) => tris(fish, n)).reduce((a, b) => a + b);
      expect(
        sum([
          'Body',
          'Median_Fins',
          'Eyes_Gills_Mouth',
          'Pectoral_Left',
          'Pectoral_Right',
        ]),
      ).toBeLessThan(12686);
      expect(
        sum(['Body_LOD1', 'Median_Fins_LOD1', 'Eyes_Gills_Mouth_LOD1']),
      ).toBeLessThan(2600);
    },
  );
});
