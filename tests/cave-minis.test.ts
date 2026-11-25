import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { CaveEnvironment } from '../src/environment/cave/CaveEnvironment';
import { CaveDressing } from '../src/environment/cave/CaveDressing';
import {
  CaveMinis,
  CAVE_MINI_NODES,
  CAVE_MINI_SIGHTS,
  CAVE_MINI_TUNING,
  type CaveMiniKind,
} from '../src/environment/cave/CaveMinis';
import {
  caveBurrow,
  caveStep,
} from '../src/environment/cave/CaveMiniAnimation';
import { CAVE } from '../src/config/passage';
import { CollisionWorld } from '../src/player/collision';
import {
  SightingTracker,
  saveJournal,
  loadJournal,
} from '../src/discovery/journal';
import { babyDefinition } from '../src/config/babies';
import { collectionEntry, COLLECTION } from '../src/collection/registry';
import { acquireCollectionArt } from '../src/environment/TankCollectionArt';
import { buildPreview } from '../src/collection/AlbumPreviews';
import { TankCatalog, saveTank, loadTankState } from '../src/catalog/catalog';
import { ReefAsset } from '../validation/ReefAsset';
import { testGeology } from '../validation/geologyModel';
const asset = new ReefAsset('public/assets/models/creatures/cave-minis.glb'),
  kinds = Object.keys(CAVE_MINI_NODES) as CaveMiniKind[];
const ids = [
  'stargazer',
  'psychedelic-frogfish',
  'banded-coral-shrimp',
  'wonderpus',
] as const;
const rig: Record<CaveMiniKind, Record<string, number>> = {
  gazer: { Stroke_Left: 0, Stroke_Right: 1, Burrow: 2, Shift: 3 },
  frog: { Stroke_Left: 0, Stroke_Right: 1, Step: 2, Hop: 3 },
  shrimp: { Stroke_Left: 0, Stroke_Right: 1 },
  wonderpus: { Stroke_Left: 0, Stroke_Right: 1, Burrow: 2, Explore: 3 },
};
function fixture(authored = true) {
  const env = new CaveEnvironment(authored ? testGeology() : undefined),
    dressing = new CaveDressing(
      env.skylightTop,
      env.root.getObjectByName('Cave boulders'),
    );
  const minis = new CaveMinis(env, dressing.root);
  return {
    env,
    dressing,
    minis,
    dispose() {
      minis.dispose();
      dressing.dispose();
      env.dispose();
    },
  };
}
function library() {
  const model = new THREE.Group();
  for (const kind of kinds) {
    const name = CAVE_MINI_NODES[kind],
      p = asset.primitive(name),
      g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(p.positions, 3));
    g.setIndex(new THREE.BufferAttribute(p.indices, 1));
    g.morphAttributes.position = asset
      .morphPositions(name)
      .map((a) => new THREE.BufferAttribute(a, 3));
    g.morphTargetsRelative = true;
    const mesh = new THREE.Mesh(g, new THREE.MeshStandardMaterial());
    mesh.name = name;
    mesh.morphTargetDictionary = rig[kind];
    model.add(mesh);
  }
  const release = vi.fn();
  return {
    model,
    release,
    loader: {
      acquire: vi.fn(async () => ({
        model: model.clone(true),
        animations: [],
        release,
      })),
      evictUnused: vi.fn(),
    },
  };
}
describe('Pass 104 cave habitats and movement', () => {
  it.each([true, false])(
    'provides reachable, separated sand/crack/shelter homes with authored=%s rock',
    (authored) => {
      const f = fixture(authored);
      try {
        const world = new CollisionWorld(f.env.colliders, CAVE.bounds, 0.3);
        for (const kind of kinds) {
          const h = f.minis.homes[kind];
          expect(
            world.colliders.some((c) =>
              world.contains(c, h.view.x, h.view.y, h.view.z),
            ),
            kind,
          ).toBe(false);
          expect(h.target.distanceTo(h.view)).toBeLessThan(
            CAVE_MINI_TUNING.reach,
          );
          for (const other of kinds)
            if (kind !== other)
              expect(
                h.position.distanceTo(f.minis.homes[other].position),
              ).toBeGreaterThanOrEqual(3);
        }
        expect(f.minis.homes.frog.shelter).toBeDefined();
        for (const c of f.env.cracks)
          expect(
            Math.hypot(
              c.x - f.minis.homes.frog.position.x,
              c.z - f.minis.homes.frog.position.z,
            ),
          ).toBeGreaterThanOrEqual(1.2);
        expect(f.minis.homes.shrimp.shelter).toBeDefined();
        expect(f.minis.homes.shrimp.attachment).toContain('crack');
        expect(f.minis.homes.wonderpus.position.z).toBeGreaterThan(-15);
        expect(Math.abs(f.minis.homes.wonderpus.position.x)).toBeGreaterThan(3);
      } finally {
        f.dispose();
      }
    },
    30_000,
  );
  it('keeps every exported pose out of solid rock while allowing deliberate sand burial', () => {
    const f = fixture(),
      world = new CollisionWorld(f.env.colliders, CAVE.bounds, 0),
      v = new THREE.Vector3();
    try {
      for (const kind of kinds) {
        const name = CAVE_MINI_NODES[kind],
          p = asset.primitive(name).positions,
          h = f.minis.homes[kind],
          matrix = new THREE.Matrix4().compose(
            h.position,
            h.rotation,
            new THREE.Vector3(1, 1, 1),
          );
        for (const d of [undefined, ...asset.morphPositions(name)])
          for (let i = 0; i < p.length; i += 3) {
            v.set(
              p[i] + (d?.[i] ?? 0),
              p[i + 1] + (d?.[i + 1] ?? 0),
              p[i + 2] + (d?.[i + 2] ?? 0),
            ).applyMatrix4(matrix);
            expect(
              world.colliders.some((c) => world.contains(c, v.x, v.y, v.z)),
              `${kind} vertex ${i / 3}`,
            ).toBe(false);
          }
      }
    } finally {
      f.dispose();
    }
  }, 30_000);
  it('has visible buried eyes, deterministic emergence, fin-supported steps and brief wonderpus concealment', () => {
    const p = asset.primitive('Stargazer').positions,
      d = asset.morphPositions('Stargazer')[2];
    let low = Infinity,
      high = -Infinity;
    for (let i = 1; i < p.length; i += 3) {
      low = Math.min(low, p[i] + d[i]);
      high = Math.max(high, p[i] + d[i]);
    }
    expect(low).toBeLessThan(0);
    expect(high).toBeGreaterThan(0.008);
    expect(caveBurrow('Stargazer', 0)).toBe(1);
    expect(caveBurrow('Stargazer', 79)).toBeCloseTo(0);
    expect(caveBurrow('Wonderpus', 0)).toBe(0);
    expect(caveBurrow('Wonderpus', 80)).toBeCloseTo(1);
    expect(caveBurrow('Wonderpus', 90)).toBe(0);
    expect(caveStep(20)).toBe(0);
    expect(caveStep(45)).toBeCloseTo(1);
  });
});
describe('Pass 104 observations, animation and lifecycle', () => {
  it('awards all four only close and looking, blocks views through sand, and never awards a hidden octopus', async () => {
    const f = fixture(),
      l = library();
    try {
      expect(f.minis.sightings).toHaveLength(0);
      expect(await f.minis.load(l.loader)).toBe(true);
      for (const kind of kinds) {
        const h = f.minis.homes[kind],
          candidate = f.minis.sightings.find(
            (s) => s.id === CAVE_MINI_SIGHTS[kind].id,
          )!,
          tracker = new SightingTracker([]),
          direction = new THREE.Vector3(
            candidate.position.x,
            candidate.position.y,
            candidate.position.z,
          )
            .sub(h.view)
            .normalize();
        expect(candidate.visibleFrom!(h.view), kind).toBe(true);
        let seen = false;
        for (let i = 0; i < 100; i++)
          if (tracker.update([candidate], h.view, direction, 1 / 30))
            seen = true;
        expect(seen, kind).toBe(true);
        expect(
          candidate.visibleFrom!({
            x: h.target.x,
            y: h.position.y - 0.5,
            z: h.target.z,
          }),
          kind,
        ).toBe(false);
        const far = h.target.clone().add(new THREE.Vector3(0, 4, 0)),
          unseen = new SightingTracker([]);
        for (let i = 0; i < 100; i++)
          expect(
            unseen.update(
              [candidate],
              far,
              h.target.clone().sub(far).normalize(),
              1 / 30,
            ),
          ).toBeNull();
      }
      for (let i = 0; i < 800; i++) f.minis.update(0.1, true, false);
      const oct = f.minis.sightings.find((s) => s.id === 'species:wonderpus')!;
      expect(oct.visibleFrom!(f.minis.homes.wonderpus.view)).toBe(false);
      f.minis.update(0.1, true, true);
      expect(oct.visibleFrom!(f.minis.homes.wonderpus.view)).toBe(true);
    } finally {
      f.dispose();
    }
    expect(l.release).toHaveBeenCalledTimes(1);
  }, 30_000);
  it('freezes pause/reduced motion and is frame-rate independent', async () => {
    const a = fixture(),
      b = fixture();
    await a.minis.load(library().loader);
    await b.minis.load(library().loader);
    try {
      for (let i = 0; i < 120; i++) a.minis.update(1 / 30, true, false);
      for (let i = 0; i < 480; i++) b.minis.update(1 / 120, true, false);
      for (const name of Object.values(CAVE_MINI_NODES)) {
        const x = a.minis.root.getObjectByName(name) as THREE.Mesh,
          y = b.minis.root.getObjectByName(name) as THREE.Mesh;
        x.morphTargetInfluences!.forEach((v, i) =>
          expect(v).toBeCloseTo(y.morphTargetInfluences![i], 10),
        );
      }
      const shrimp = a.minis.root.getObjectByName(
          'Banded_Coral_Shrimp',
        ) as THREE.Mesh,
        w = [...shrimp.morphTargetInfluences!];
      a.minis.update(10, false, false);
      expect(shrimp.morphTargetInfluences).toEqual(w);
      a.minis.update(1, true, true);
      expect(shrimp.morphTargetInfluences!.every((v) => v === 0)).toBe(true);
      expect(
        (a.minis.root.getObjectByName('Stargazer') as THREE.Mesh)
          .morphTargetInfluences![2],
      ).toBe(1);
    } finally {
      a.dispose();
      b.dispose();
    }
  }, 30_000);
  it('releases incomplete and late libraries, disposes once and exposes no placeholders', async () => {
    const a = fixture(),
      l = library();
    l.model.remove(l.model.children[0]);
    expect(await a.minis.load(l.loader)).toBe(false);
    expect(a.minis.sightings).toHaveLength(0);
    expect(l.release).toHaveBeenCalledTimes(1);
    a.dispose();
    const b = fixture(),
      late = library();
    let resolve!: (v: Awaited<ReturnType<typeof late.loader.acquire>>) => void;
    const p = b.minis.load({
      ...late.loader,
      acquire: () =>
        new Promise((r) => {
          resolve = r;
        }),
    });
    b.minis.dispose();
    resolve(await late.loader.acquire());
    expect(await p).toBe(false);
    b.dispose();
    expect(late.release).toHaveBeenCalledTimes(1);
  }, 30_000);
});
describe('Pass 104 identity and collection', () => {
  it('appends four cave slots without replacing existing animals and round-trips saves', () => {
    const data = new Map<string, string>(),
      store = {
        getItem: (k: string) => data.get(k) ?? null,
        setItem: (k: string, v: string) => {
          data.set(k, v);
        },
      },
      seen = ids.map((id) => ({
        id: `species:${id}`,
        first: '2026-11-25T00:00:00.000Z',
      }));
    expect(saveJournal(store, seen)).toBe(true);
    expect(loadJournal(store)).toEqual(seen);
    const context = { keepOut: [], routes: [], surface: () => 0 },
      tank = new TankCatalog([], context);
    for (let i = 0; i < ids.length; i++) {
      const id = ids[i],
        e = collectionEntry(`species:${id}`)!;
      expect(e.section).toBe('sea-cave');
      expect(e.order).toBe(14 + i);
      expect(e.rarity).toBe('rare');
      expect(COLLECTION.filter((x) => x.id === e.id)).toHaveLength(1);
      expect(tank.addBaby(id, seen)).toBe(true);
    }
    expect(saveTank(store, [], tank.babies)).toBe(true);
    expect(loadTankState(store, seen, context).babies).toEqual([...ids]);
    expect(collectionEntry('species:cleaner-shrimp')?.order).toBe(4);
  });
  it('shares identical models in habitat, album and tank, with presentation-only burial differences', async () => {
    const f = fixture(),
      l = library();
    await f.minis.load(l.loader);
    try {
      for (let i = 0; i < ids.length; i++) {
        const d = babyDefinition(ids[i]),
          e = collectionEntry(`species:${ids[i]}`)!,
          name = CAVE_MINI_NODES[kinds[i]],
          art = await acquireCollectionArt(d, l.loader),
          card = await buildPreview(e, { creatures: l.loader, reef: l.loader });
        const wild = f.minis.root.getObjectByName(name) as THREE.Mesh,
          tank = art.model.getObjectByName(name) as THREE.Mesh,
          preview = card.object.getObjectByName(name) as THREE.Mesh;
        expect(d.asset).toBe('caveMinis');
        expect(tank.geometry).toBe(wild.geometry);
        expect(preview.geometry).toBe(wild.geometry);
        art.update(1, 0, 45);
        card.update(45, 0);
        expect(tank.morphTargetInfluences).toEqual(
          preview.morphTargetInfluences,
        );
        art.dispose();
        card.dispose();
      }
    } finally {
      f.dispose();
    }
    expect(l.release).toHaveBeenCalledTimes(9);
  }, 30_000);
  it('ships finite detailed anatomy, four single-mesh animals and neutral default morph weights', () => {
    for (const kind of kinds) {
      const name = CAVE_MINI_NODES[kind],
        p = asset.primitive(name);
      expect(p.colors).toBeDefined();
      expect(asset.primitives(name)).toHaveLength(1);
      expect(asset.morphPositions(name)).toHaveLength(
        Object.keys(rig[kind]).length,
      );
      expect(p.indices.length / 3).toBeGreaterThan(1000);
      expect(
        asset.doc.meshes[asset.node(name).mesh!].weights!.every((v) => v === 0),
      ).toBe(true);
      for (const a of [p.positions, ...asset.morphPositions(name)])
        expect([...a].every(Number.isFinite)).toBe(true);
    }
  });
});
