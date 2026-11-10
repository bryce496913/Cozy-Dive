import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import * as THREE from 'three';
import { ASSET_REGISTRY, type AssetId } from '../src/assets/AssetRegistry';
import type { AssetLease } from '../src/assets/AssetLoader';
import {
  AuthoredSchool,
  FISH_LOD,
  fishLevel,
} from '../src/benchmark/AuthoredSchool';
import { Aquarium } from '../src/environment/Aquarium';
import { ReefAsset } from '../validation/ReefAsset';

const FISH = [
  'chromis',
  'clownfish',
  'cardinalfish',
  'firefish',
  'assessor',
  'gramma',
] as const;
const glbJson = (path: string) => {
  const b = readFileSync(path);
  return JSON.parse(b.toString('utf8', 20, 20 + b.readUInt32LE(12))) as {
    extensionsUsed?: string[];
    images?: { mimeType?: string; bufferView?: number }[];
    bufferViews?: { byteOffset?: number; byteLength: number }[];
  };
};

describe('Pass 017 fish distance level', () => {
  it('switches at a body-length distance with hysteresis', () => {
    const limit = FISH_LOD.bodyLengths * 0.5;
    expect(fishLevel(limit * 0.99, 0.5, false)).toBe(true);
    expect(fishLevel(limit * 1.01, 0.5, false)).toBe(false);
    // A near fish stays near inside the hysteresis band; a far fish stays far.
    expect(fishLevel(limit * 1.05, 0.5, true)).toBe(true);
    expect(fishLevel(limit * (1 + FISH_LOD.hysteresis) * 1.01, 0.5, true)).toBe(
      false,
    );
    expect(fishLevel(limit * 1.05, 0.5, false)).toBe(false);
  });
  it.each(FISH)(
    '%s carries a cheap, morphing, in-bounds distance level',
    (id) => {
      const fish = new ReefAsset(`public/assets/models/fish/${id}.glb`);
      let full = 0,
        far = 0;
      for (const part of ['Body', 'Median_Fins', 'Eyes_Gills_Mouth']) {
        const near = fish.primitive(part),
          low = fish.primitive(`${part}_LOD1`);
        const n = fish.doc.meshes[fish.node(part).mesh!].primitives,
          l = fish.doc.meshes[fish.node(`${part}_LOD1`).mesh!].primitives;
        const tris = (ps: typeof n) =>
          ps.reduce(
            (sum, p) =>
              sum +
              (fish.doc.accessors as { count: number }[])[p.indices].count / 3,
            0,
          );
        full += tris(n);
        far += tris(l);
        if (part !== 'Eyes_Gills_Mouth')
          expect(l[0].targets?.length, part).toBe(2);
        const a = new THREE.Box3().setFromArray(near.positions),
          b = new THREE.Box3().setFromArray(low.positions);
        expect(a.expandByScalar(0.004).containsBox(b), part).toBe(true);
      }
      expect(far).toBeLessThan(full * 0.2);
      expect(far).toBeGreaterThan(1000);
    },
  );
  it('moves each fish between full and distance sets without losing or duplicating any', () => {
    const q = new Aquarium();
    try {
      const species = 'royal-gramma',
        count = q.fish.simulation.fish.filter(
          (f) => f.species.id === species,
        ).length;
      const part = (name: string) => {
        const g = new THREE.BoxGeometry(0.2, 0.1, 0.05);
        g.morphAttributes.position = [
          g.attributes.position.clone(),
          g.attributes.position.clone(),
        ];
        const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial());
        m.name = name;
        m.morphTargetDictionary = { Stroke_Left: 0, Stroke_Right: 1 };
        m.morphTargetInfluences = [0, 0];
        return m;
      };
      const leases: AssetLease[] = Array.from({ length: count }, () => {
        const model = new THREE.Group();
        model.add(part('Body'), part('Body_LOD1'));
        return { model, animations: [], release: () => {} };
      });
      const school = new AuthoredSchool(q.fish, leases, species);
      const [near, far] = school.meshes;
      expect(near.name).toBe('Authored Body');
      expect(far.name).toBe('Authored Body_LOD1');
      const camera = new THREE.PerspectiveCamera();
      const fish =
        q.fish.visuals[
          q.fish.simulation.fish.findIndex((f) => f.species.id === species)
        ].root;
      camera.position
        .copy(fish.getWorldPosition(new THREE.Vector3()))
        .add(new THREE.Vector3(0, 0, 0.5));
      school.update(camera);
      expect(near.count + far.count).toBe(count);
      expect(near.count).toBeGreaterThanOrEqual(1);
      camera.position.set(500, 500, 500);
      school.update(camera);
      expect(near.count).toBe(0);
      expect(far.count).toBe(count);
      school.update(); // no camera: every fish at full detail (benchmarks, matched captures)
      expect(near.count).toBe(count);
      school.dispose();
    } finally {
      q.dispose();
    }
  });
});

describe('Pass 017/018 asset compression', () => {
  it('ships every registered GLB with Draco geometry and KTX2 (Basis) textures', () => {
    const KTX2_ID = [0xab, 0x4b, 0x54, 0x58, 0x20, 0x32, 0x30, 0xbb];
    for (const id of Object.keys(ASSET_REGISTRY) as AssetId[]) {
      const path = `public/${ASSET_REGISTRY[id].path}`;
      const json = glbJson(path);
      expect(json.extensionsUsed, id).toContain('KHR_draco_mesh_compression');
      expect(json.extensionsUsed, id).toContain('KHR_texture_basisu');
      expect(json.extensionsUsed, id).not.toContain('EXT_texture_webp');
      const images = json.images ?? [];
      expect(images.length, id).toBeGreaterThan(0);
      const b = readFileSync(path);
      const bin = 20 + b.readUInt32LE(12) + 8;
      for (const image of images) {
        expect(image.mimeType, id).toBe('image/ktx2');
        const view = json.bufferViews?.[image.bufferView ?? -1];
        expect(view, id).toBeDefined();
        const start = bin + (view?.byteOffset ?? 0);
        expect([...b.subarray(start, start + 8)], id).toEqual(KTX2_ID);
        // Full mip chain, so minified surfaces sample prefiltered compressed levels.
        const w = b.readUInt32LE(start + 20);
        const h = b.readUInt32LE(start + 24);
        const levels = b.readUInt32LE(start + 40);
        expect(levels, id).toBe(Math.floor(Math.log2(Math.max(w, h))) + 1);
      }
    }
  });
  it('bundles the Basis transcoder locally', () => {
    for (const file of ['basis_transcoder.wasm', 'basis_transcoder.js'])
      expect(existsSync(`public/assets/basis/${file}`), file).toBe(true);
  });
  it('bundles the Draco decoder locally and stays within the download budget', () => {
    for (const file of [
      'draco_decoder.wasm',
      'draco_wasm_wrapper.js',
      'draco_decoder.js',
    ])
      expect(existsSync(`public/assets/draco/${file}`), file).toBe(true);
    const models = readdirSync('public/assets/models', { recursive: true })
      .map(String)
      .filter((f) => f.endsWith('.glb'));
    const bytes = models.reduce(
      (sum, f) => sum + statSync(`public/assets/models/${f}`).size,
      0,
    );
    expect(bytes).toBeLessThan(20 * 1024 * 1024);
    // Source maps are authoring inputs only and no longer ship in public/.
    expect(existsSync('public/assets/textures')).toBe(false);
  });
});
