import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import {
  CORE_FISH,
  CORE_FISH_IDS,
  CORE_FISH_ASSET,
} from '../src/fish/lowPoly/designs';
import { coreFishGeometry } from '../src/fish/lowPoly/model';
import { AssetLoader } from '../src/assets/AssetLoader';
import { ASSET_REGISTRY } from '../src/assets/AssetRegistry';
import { TANK_FISH } from '../src/config/tankFish';
import { FishGeometry } from '../src/fish/FishGeometry';
import { FISH_SPECIES } from '../src/fish/FishSpecies';
import { FishSystem } from '../src/fish/FishSystem';
import { AuthoredSchool } from '../src/benchmark/AuthoredSchool';
import { AQUARIUM } from '../src/config/world';

function mesh(object: THREE.Object3D, name = 'Body'): THREE.Mesh {
  const result = object.getObjectByName(name);
  if (!(result instanceof THREE.Mesh)) throw Error(`Missing ${name}`);
  return result;
}
describe('Pass 017 canonical core fish', () => {
  it('accounts for every catalog identity with a unique shape and asset, including former substitutions', () => {
    expect(CORE_FISH_IDS).toHaveLength(29);
    expect(new Set(TANK_FISH.map((f) => f.species))).toEqual(
      new Set(CORE_FISH_IDS),
    );
    expect(new Set(Object.values(CORE_FISH_ASSET)).size).toBe(29);
    const signatures = new Set(
      CORE_FISH_IDS.map((id) => {
        const d = CORE_FISH[id];
        return JSON.stringify([
          d.depth,
          d.width,
          d.heights,
          d.widths,
          d.forehead,
          d.tail,
          d.dorsal,
        ]);
      }),
    );
    expect(signatures.size).toBe(29);
    for (const f of TANK_FISH) {
      expect(f.asset).toBe(CORE_FISH_ASSET[f.species]);
      expect(f.tint).toBeUndefined();
    }
  });
  it.each(CORE_FISH_IDS)(
    '%s: valid geometry, budgets, stable head, moving tail and conservative morph bounds',
    (id) => {
      const g = coreFishGeometry(id),
        p = g.getAttribute('position'),
        poses = g.morphAttributes.position!,
        L = CORE_FISH[id].length;
      expect(p.count / 3).toBeLessThanOrEqual(900);
      expect(p.count / 3).toBeGreaterThan(150);
      expect(g.getAttribute('color').count).toBe(p.count);
      expect(g.getAttribute('uv').count).toBe(p.count);
      expect(poses.map((p) => p.name)).toEqual(['Stroke_Left', 'Stroke_Right']);
      const a = new THREE.Vector3(),
        b = new THREE.Vector3(),
        c = new THREE.Vector3();
      let tail = 0;
      for (let i = 0; i < p.count; i += 3) {
        a.fromBufferAttribute(p, i);
        b.fromBufferAttribute(p, i + 1);
        c.fromBufferAttribute(p, i + 2);
        expect(b.sub(a).cross(c.sub(a)).lengthSq()).toBeGreaterThan(1e-18);
      }
      for (const attr of [p, g.getAttribute('normal'), ...poses])
        expect(Array.from(attr.array).every(Number.isFinite)).toBe(true);
      const same = new Map<string, string>();
      for (let i = 0; i < p.count; i++) {
        if (p.getX(i) > 0.3 * L)
          expect(Math.abs(poses[0].getZ(i))).toBeLessThan(1e-8);
        if (p.getX(i) < -0.45 * L)
          tail = Math.max(tail, Math.abs(poses[0].getZ(i)));
        for (const pose of poses) {
          a.set(
            p.getX(i) + pose.getX(i),
            p.getY(i) + pose.getY(i),
            p.getZ(i) + pose.getZ(i),
          );
          expect(
            g.boundingBox!.clone().expandByScalar(1e-6).containsPoint(a),
          ).toBe(true);
        }
        const key = [p.getX(i), p.getY(i), p.getZ(i)].join(','),
          value = [poses[0].getX(i), poses[0].getY(i), poses[0].getZ(i)].join(
            ',',
          );
        if (same.has(key)) expect(value).toBe(same.get(key));
        same.set(key, value);
      }
      expect(tail).toBeGreaterThan(L * 0.07);
      g.dispose();
    },
  );
  it.each(CORE_FISH_IDS)(
    '%s: default loader produces canonical cached art without GLB network requests',
    async (id) => {
      const loader = new AssetLoader(),
        asset = CORE_FISH_ASSET[id],
        a = await loader.acquire(asset),
        b = await loader.acquire(asset);
      expect(a.model.userData.coreFish).toBe(id);
      for (const name of ASSET_REGISTRY[asset].requiredNodes)
        expect(a.model.getObjectByName(name)).toBeDefined();
      const near = mesh(a.model),
        far = mesh(a.model, 'Body_LOD1');
      expect(near.geometry).toBe(far.geometry);
      expect(near.geometry).toBe(mesh(b.model).geometry);
      const material = near.material as THREE.MeshStandardMaterial;
      expect(material.map).toBeNull();
      expect(material.normalMap).toBeNull();
      expect(material.flatShading).toBe(true);
      near.morphTargetInfluences![0] = 0.7;
      expect(mesh(b.model).morphTargetInfluences![0]).toBe(0);
      const dispose = vi.spyOn(near.geometry, 'dispose');
      a.release();
      loader.evictUnused(asset);
      expect(dispose).not.toHaveBeenCalled();
      b.release();
      loader.evictUnused(asset);
      expect(dispose).toHaveBeenCalledTimes(1);
      loader.dispose();
    },
  );
  it.each(FISH_SPECIES)(
    '$id: fallback has exactly the canonical shape at its configured size',
    async (species) => {
      const loader = new AssetLoader(),
        lease = await loader.acquire(CORE_FISH_ASSET[species.id]),
        template = new FishGeometry(species),
        visual = template.create(1);
      const canonical = mesh(lease.model).geometry.getAttribute('position'),
        fallback = visual.body.geometry.getAttribute('position'),
        k = species.length / CORE_FISH[species.id].length;
      expect(canonical.count).toBe(fallback.count);
      for (let i = 0; i < canonical.count; i++)
        expect(fallback.getX(i)).toBeCloseTo(canonical.getX(i) * k, 6);
      template.dispose();
      lease.release();
      loader.dispose();
    },
  );
  it('batches a school with independent continuous strokes, stable pause and bounded instance resources', async () => {
    const species = { ...FISH_SPECIES[0], count: 8 },
      fish = new FishSystem({ bounds: AQUARIUM, rocks: [] }, [species]),
      loader = new AssetLoader();
    const leases = await Promise.all(
        Array.from({ length: 8 }, () => loader.acquire('chromis')),
      ),
      school = new AuthoredSchool(fish, leases);
    for (let i = 0; i < 30; i++) {
      fish.update(1 / 60, true, false);
      school.update();
    }
    expect(school.meshes).toHaveLength(2);
    expect(fish.batches[0].meshes).toHaveLength(1);
    expect(fish.batches[0].meshes[0].morphTexture).toBeDefined();
    const before = fish.visuals.map((v) => [...v.body.morphTargetInfluences!]);
    fish.update(1, false, false);
    expect(fish.visuals.map((v) => v.body.morphTargetInfluences)).toEqual(
      before,
    );
    school.dispose();
    fish.dispose();
    loader.dispose();
  });
});

import {
  ANCHORED_FISH_PARTS,
  anchoredFishGeometry,
  rebuildAnchoredFish,
} from '../src/fish/lowPoly/anchored';
import { disposeAsset } from '../src/assets/AssetValidation';
describe('original anchored fish migration', () => {
  it.each(ANCHORED_FISH_PARTS)(
    '%s retains finite pivot-local geometry and a bounded authored budget',
    (name) => {
      const g = anchoredFishGeometry(name);
      expect(g.attributes.position.count / 3).toBeLessThan(300);
      for (const attr of Object.values(g.attributes))
        expect(Array.from(attr.array).every(Number.isFinite)).toBe(true);
      expect(g.attributes.color.count).toBe(g.attributes.position.count);
      expect(g.boundingSphere!.radius).toBeGreaterThan(0);
      g.dispose();
    },
  );
  it('replaces only fish parts while preserving shared moray resources and all rig names', () => {
    const scene = new THREE.Group(),
      geometry = new THREE.BoxGeometry(),
      texture = new THREE.DataTexture(new Uint8Array(4), 1, 1),
      material = new THREE.MeshStandardMaterial({ map: texture });
    for (const name of [...ANCHORED_FISH_PARTS, 'MorayBody', 'AnemoneTissue']) {
      const m = new THREE.Mesh(geometry, material);
      m.name = name;
      scene.add(m);
    }
    const horse = scene.getObjectByName('HorseBody')!;
    horse.name = 'HorseBody_primitive';
    const group = new THREE.Group();
    group.name = 'HorseBody';
    group.add(horse);
    scene.add(group);
    const gd = vi.spyOn(geometry, 'dispose'),
      md = vi.spyOn(material, 'dispose'),
      td = vi.spyOn(texture, 'dispose');
    const asset = { scene, scenes: [scene], animations: [] };
    rebuildAnchoredFish(asset);
    expect(mesh(scene, 'MorayBody').geometry).toBe(geometry);
    expect(gd).not.toHaveBeenCalled();
    expect(md).not.toHaveBeenCalled();
    expect(td).not.toHaveBeenCalled();
    for (const name of ANCHORED_FISH_PARTS) {
      const part = mesh(scene, name);
      expect(part.geometry).not.toBe(geometry);
      expect((part.material as THREE.MeshStandardMaterial).map).toBeNull();
    }
    expect(mesh(scene, 'FrogJaw').position.toArray()).toEqual([0, 0.31, 0.16]);
    expect(mesh(scene, 'HorseTail').position.y).toBe(0.33);
    disposeAsset(asset);
    expect(gd).toHaveBeenCalledTimes(1);
    expect(md).toHaveBeenCalledTimes(1);
    expect(td).toHaveBeenCalledTimes(1);
  });
});
