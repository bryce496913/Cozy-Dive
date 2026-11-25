import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { WreckMiniOcclusion } from '../src/environment/wreck/WreckMiniOcclusion';
import { ShipwreckModel } from '../src/environment/wreck/ShipwreckModel';
import {
  WreckMinis,
  WRECK_MINI_NODES,
  WRECK_MINI_SIGHTS,
  WRECK_MINI_TUNING,
  wreckMiniHomes,
  wreckMiniSolids,
  type WreckMiniKind,
} from '../src/environment/wreck/WreckMinis';
import {
  animateWreckMini,
  wreckPerch,
  wreckLift,
} from '../src/environment/wreck/WreckMiniAnimation';
import {
  SHIP,
  DECK_TOP,
  toShip,
  wreckColliders,
} from '../src/environment/wreck/WreckLayout';
import { CollisionWorld } from '../src/player/collision';
import { WRECK } from '../src/config/wreck';
import {
  SightingTracker,
  saveJournal,
  loadJournal,
} from '../src/discovery/journal';
import { babyDefinition, BABY_CAP, TANK_BABIES } from '../src/config/babies';
import { COLLECTION, collectionEntry } from '../src/collection/registry';
import { acquireCollectionArt } from '../src/environment/TankCollectionArt';
import { buildPreview } from '../src/collection/AlbumPreviews';
import { TankCatalog, saveTank, loadTankState } from '../src/catalog/catalog';
import { ReefAsset } from '../validation/ReefAsset';
const asset = new ReefAsset('public/assets/models/creatures/wreck-minis.glb');
const kinds = Object.keys(WRECK_MINI_NODES) as WreckMiniKind[];
const ids = [
  'skeleton-shrimp',
  'juvenile-wolf-eel',
  'decorator-crab',
  'painted-greenling',
] as const;
const rig: Record<WreckMiniKind, Record<string, number>> = {
  skeleton: { Stroke_Left: 0, Stroke_Right: 1 },
  wolf: { Stroke_Left: 0, Stroke_Right: 1, Retreat: 2 },
  crab: { Stroke_Left: 0, Stroke_Right: 1, Reposition: 2 },
  greenling: { Stroke_Left: 0, Stroke_Right: 1, Perch: 2, Lift: 3 },
};
function library() {
  const source = new THREE.Group();
  for (const kind of kinds) {
    const name = WRECK_MINI_NODES[kind],
      p = asset.primitive(name),
      g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(p.positions, 3));
    g.setIndex(new THREE.BufferAttribute(p.indices, 1));
    g.morphAttributes.position = asset
      .morphPositions(name)
      .map((p) => new THREE.BufferAttribute(p, 3));
    g.morphTargetsRelative = true;
    const mesh = new THREE.Mesh(g, new THREE.MeshStandardMaterial());
    mesh.name = name;
    mesh.morphTargetDictionary = rig[kind];
    source.add(mesh);
  }
  const release = vi.fn(),
    evictUnused = vi.fn();
  return {
    source,
    release,
    loader: {
      acquire: vi.fn(async () => ({
        model: source.clone(true),
        animations: [],
        release,
      })),
      evictUnused,
    },
  };
}
function fixture() {
  const ship = new ShipwreckModel(),
    minis = new WreckMinis({ ship });
  return { ship, minis };
}
describe('Pass 103 wreck miniature attachments and navigation', () => {
  it('uses existing growth and the existing breach with clear, reachable views', () => {
    const { ship, minis } = fixture();
    try {
      expect(wreckMiniHomes({ ship })).toEqual(minis.homes);
      const world = new CollisionWorld(wreckColliders(), WRECK.bounds, 0.28),
        local = { x: 0, y: 0, z: 0 };
      for (const kind of kinds) {
        const h = minis.homes[kind];
        expect(h.position.distanceTo(h.view)).toBeLessThan(
          WRECK_MINI_TUNING.reach,
        );
        expect(
          world.colliders.some((c) =>
            world.contains(c, h.view.x, h.view.y, h.view.z),
          ),
          kind,
        ).toBe(false);
        for (const other of kinds)
          if (kind !== other)
            expect(
              h.position.distanceTo(minis.homes[other].position),
            ).toBeGreaterThanOrEqual(2);
        if (kind !== 'wolf') {
          toShip(h.position, local);
          expect(local.y).toBeGreaterThan(DECK_TOP - 0.03);
          expect(Math.abs(local.x)).toBeGreaterThan(SHIP.hatch.half + 0.45);
        }
      }
      expect(minis.homes.crab.attachment).toBe('Wreck soft corals');
      expect(minis.homes.greenling.attachment).toBe('Wreck encrusting mats');
      const home = minis.homes.skeleton,
        growth = ship.root.getObjectByName(
          home.attachment,
        ) as THREE.InstancedMesh,
        matrix = new THREE.Matrix4();
      growth.getMatrixAt(home.instance!, matrix);
      matrix.premultiply(growth.matrixWorld);
      const p = growth.geometry.getAttribute('position'),
        v = new THREE.Vector3();
      let nearest = Infinity;
      for (let i = 0; i < p.count; i++)
        nearest = Math.min(
          nearest,
          v
            .fromBufferAttribute(p, i)
            .applyMatrix4(matrix)
            .distanceTo(home.position),
        );
      expect(nearest).toBeLessThan(1e-8);
      toShip(minis.homes.wolf.position, local);
      expect(local.z).toBeGreaterThan(SHIP.breach.foreZ);
      expect(local.z).toBeLessThan(SHIP.breach.foreZ + 0.6);
      expect(local.y).toBeLessThan(SHIP.breach.high - 0.3);
    } finally {
      minis.dispose();
      ship.dispose();
    }
  }, 30_000);
  it('crops exact steel triangles for close observations and owns only its CPU geometry', () => {
    const { ship, minis } = fixture(),
      solids = wreckMiniSolids({ ship }),
      visibility = new WreckMiniOcclusion(
        solids,
        minis.homes,
        WRECK_MINI_TUNING.reach,
      );
    const all = solids.reduce(
      (n, m) =>
        n +
        (m.geometry.index?.count ?? m.geometry.getAttribute('position').count) /
          3,
      0,
    );
    const originalDisposed = solids.map((m) => vi.spyOn(m.geometry, 'dispose'));
    try {
      for (const k of kinds) {
        expect(visibility.triangleCount(k)).toBeLessThan(all * 0.3);
        expect(
          visibility.visible(k, minis.homes[k].view, minis.homes[k].target),
        ).toBe(true);
      }
    } finally {
      visibility.dispose();
      visibility.dispose();
      originalDisposed.forEach((spy) => expect(spy).not.toHaveBeenCalled());
      minis.dispose();
      ship.dispose();
    }
  }, 30_000);
  it('keeps creature vertices and their full motion envelope outside solid ship collision', () => {
    const { ship, minis } = fixture();
    try {
      const world = new CollisionWorld(wreckColliders(), WRECK.bounds, 0),
        v = new THREE.Vector3();
      for (const kind of kinds) {
        const p = asset.primitive(WRECK_MINI_NODES[kind]).positions,
          h = minis.homes[kind],
          matrix = new THREE.Matrix4().compose(
            h.position,
            h.rotation,
            new THREE.Vector3(1, 1, 1),
          ),
          morphs = asset.morphPositions(WRECK_MINI_NODES[kind]);
        for (const delta of [undefined, ...morphs])
          for (let i = 0; i < p.length; i += 3) {
            v.set(
              p[i] + (delta?.[i] ?? 0),
              p[i + 1] + (delta?.[i + 1] ?? 0),
              p[i + 2] + (delta?.[i + 2] ?? 0),
            ).applyMatrix4(matrix);
            expect(
              world.colliders.some((c) => world.contains(c, v.x, v.y, v.z)),
              `${kind} ${i / 3}`,
            ).toBe(false);
          }
      }
    } finally {
      minis.dispose();
      ship.dispose();
    }
  }, 30_000);
});
describe('Pass 103 observations, animation and resource ownership', () => {
  it('discovers each loaded creature only nearby, looking at it, with no view through steel', async () => {
    const { ship, minis } = fixture(),
      f = library();
    try {
      expect(minis.sightings).toHaveLength(0);
      expect(await minis.load(f.loader)).toBe(true);
      expect(minis.sightings).toHaveLength(4);
      for (const kind of kinds) {
        const h = minis.homes[kind],
          candidate = minis.sightings.find(
            (s) => s.id === WRECK_MINI_SIGHTS[kind].id,
          )!;
        expect(candidate.visibleFrom!(h.view), kind).toBe(true);
        const tracker = new SightingTracker([]),
          forward = h.target.clone().sub(h.view).normalize();
        let seen = false;
        for (let i = 0; i < 180; i++)
          if (
            tracker.update([candidate], h.view, forward, 1 / 30)?.id ===
            candidate.id
          )
            seen = true;
        expect(seen, kind).toBe(true);
        const far = h.target.clone().add(new THREE.Vector3(0, 4, 0)),
          away = forward.clone().negate(),
          unseen = new SightingTracker([]);
        for (let i = 0; i < 180; i++) {
          expect(
            unseen.update(
              [candidate],
              far,
              h.target.clone().sub(far).normalize(),
              1 / 30,
            ),
          ).toBeNull();
          expect(unseen.update([candidate], h.view, away, 1 / 30)).toBeNull();
        }
        // Move an existing opaque hull mesh into this line of sight; no new raycast proxy is used.
        const hull = ship.root.getObjectByName('Wreck hull') as THREE.Mesh,
          old = hull.geometry,
          oldMatrix = hull.matrix.clone(),
          block = new THREE.BoxGeometry(0.6, 0.6, 0.15);
        hull.geometry = block;
        const midpoint = h.view.clone().lerp(h.target, 0.5);
        const m = new THREE.Object3D();
        m.position.copy(midpoint);
        m.lookAt(h.view);
        m.updateMatrix();
        hull.matrix.copy(
          ship.root.matrixWorld.clone().invert().multiply(m.matrix),
        );
        ship.root.updateMatrixWorld(true);
        expect(candidate.visibleFrom!(h.view)).toBe(false);
        hull.geometry = old;
        hull.matrix.copy(oldMatrix);
        ship.root.updateMatrixWorld(true);
        block.dispose();
      }
    } finally {
      minis.dispose();
      ship.dispose();
    }
    expect(f.release).toHaveBeenCalledTimes(1);
  }, 30_000);
  it('freezes pause/reduced motion, has controlled perch cycles and retreats gently on approach', async () => {
    const { ship, minis } = fixture(),
      f = library();
    await minis.load(f.loader);
    try {
      const player = {
        position: minis.homes.wolf.view.clone(),
        velocity: { x: 0, y: 0, z: 0 },
        active: true,
      };
      player.position
        .copy(minis.homes.wolf.target)
        .add(new THREE.Vector3(0.7, 0, 0));
      for (let i = 0; i < 60; i++) minis.update(1 / 60, true, false, player);
      const wolf = minis.root.getObjectByName(
        'Juvenile_Wolf_Eel',
      ) as THREE.Mesh;
      expect(wolf.morphTargetInfluences![2]).toBeGreaterThan(0.2);
      expect(wolf.morphTargetInfluences![2]).toBeLessThan(0.75);
      const weights = [...wolf.morphTargetInfluences!];
      minis.update(10, false, false, player);
      expect(wolf.morphTargetInfluences).toEqual(weights);
      minis.update(0.1, true, true, player);
      for (const name of Object.values(WRECK_MINI_NODES))
        expect(
          (
            minis.root.getObjectByName(name) as THREE.Mesh
          ).morphTargetInfluences!.every((v) => v === 0),
        ).toBe(true);
      expect(wreckPerch(20)).toBe(0);
      expect(wreckPerch(45)).toBe(1);
      expect(wreckPerch(58)).toBe(0);
      expect(wreckLift(37.5)).toBeCloseTo(1);
      expect(wreckLift(45)).toBe(0);
    } finally {
      minis.dispose();
      ship.dispose();
    }
  }, 30_000);
  it('is frame-rate independent and never makes population copies', async () => {
    const a = fixture(),
      b = fixture(),
      fa = library(),
      fb = library();
    await a.minis.load(fa.loader);
    await b.minis.load(fb.loader);
    try {
      for (let i = 0; i < 240; i++) a.minis.update(1 / 30, true, false);
      for (let i = 0; i < 960; i++) b.minis.update(1 / 120, true, false);
      for (const name of Object.values(WRECK_MINI_NODES)) {
        const m = a.minis.root.getObjectByName(name) as THREE.Mesh,
          n = b.minis.root.getObjectByName(name) as THREE.Mesh;
        m.morphTargetInfluences!.forEach((v, i) =>
          expect(v).toBeCloseTo(n.morphTargetInfluences![i], 10),
        );
      }
      let meshes = 0;
      a.minis.root.traverse((o) => {
        if (o instanceof THREE.Mesh) meshes++;
      });
      expect(meshes).toBe(4);
      expect(fa.loader.acquire).toHaveBeenCalledTimes(1);
    } finally {
      a.minis.dispose();
      b.minis.dispose();
      a.ship.dispose();
      b.ship.dispose();
    }
  }, 30_000);
  it('releases failed/late libraries, has no placeholder sightings and disposes once', async () => {
    const a = fixture(),
      f = library();
    f.source.remove(f.source.children[0]);
    expect(await a.minis.load(f.loader)).toBe(false);
    expect(f.release).toHaveBeenCalledTimes(1);
    expect(a.minis.sightings).toHaveLength(0);
    a.minis.dispose();
    a.ship.dispose();
    const b = fixture(),
      late = library();
    let resolve!: (v: Awaited<ReturnType<typeof late.loader.acquire>>) => void;
    const pending = b.minis.load({
      ...late.loader,
      acquire: () =>
        new Promise((r) => {
          resolve = r;
        }),
    });
    b.minis.dispose();
    resolve(await late.loader.acquire());
    expect(await pending).toBe(false);
    b.minis.dispose();
    expect(late.release).toHaveBeenCalledTimes(1);
    expect(b.minis.sightings).toHaveLength(0);
    b.ship.dispose();
  }, 30_000);
});
describe('Pass 103 canonical art, collection and saves', () => {
  it('adds four rare Shipwreck slots, preserves existing identities, and saves journal/tank choices', () => {
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
    for (const id of ids) expect(tank.addBaby(id, seen)).toBe(true);
    expect(saveTank(store, [], tank.babies)).toBe(true);
    expect(loadTankState(store, seen, context).babies).toEqual([...ids]);
    expect(BABY_CAP).toBe(TANK_BABIES.length);
    expect(collectionEntry('species:queensland-grouper')?.order).toBe(0);
    for (let i = 0; i < ids.length; i++) {
      const e = collectionEntry(`species:${ids[i]}`)!;
      expect(e.section).toBe('shipwreck');
      expect(e.order).toBe(i + 1);
      expect(e.rarity).toBe('rare');
      expect(COLLECTION.filter((x) => x.id === e.id)).toHaveLength(1);
    }
  });
  it('uses the same source geometry and rigs for wild, preview and aquarium art', async () => {
    const { ship, minis } = fixture(),
      f = library();
    await minis.load(f.loader);
    try {
      for (let i = 0; i < ids.length; i++) {
        const d = babyDefinition(ids[i]),
          e = collectionEntry(`species:${ids[i]}`)!,
          name = WRECK_MINI_NODES[kinds[i]];
        expect(d.asset).toBe('wreckMinis');
        expect(d.nodes).toEqual([name]);
        const art = await acquireCollectionArt(d, f.loader),
          preview = await buildPreview(e, {
            creatures: f.loader,
            reef: f.loader,
          });
        const wild = minis.root.getObjectByName(name) as THREE.Mesh,
          tank = art.model.getObjectByName(name) as THREE.Mesh,
          card = preview.object.getObjectByName(name) as THREE.Mesh;
        expect(tank.geometry).toBe(wild.geometry);
        expect(card.geometry).toBe(wild.geometry);
        art.update(1, 0, 37.5);
        preview.update(37.5, 0);
        expect(card.morphTargetInfluences).toEqual(tank.morphTargetInfluences);
        art.dispose();
        preview.dispose();
      }
    } finally {
      minis.dispose();
      ship.dispose();
    }
    expect(f.release).toHaveBeenCalledTimes(9);
  }, 30_000);
  it('exports detailed, readable species meshes within a small four-draw budget', () => {
    let triangles = 0;
    for (const kind of kinds) {
      const name = WRECK_MINI_NODES[kind],
        p = asset.primitive(name),
        morphs = asset.morphPositions(name);
      triangles += p.indices.length / 3;
      expect(p.colors).toBeDefined();
      expect(morphs).toHaveLength(Object.keys(rig[kind]).length);
      expect(
        asset.doc.meshes[asset.node(name).mesh!].weights!.every((w) => w === 0),
      ).toBe(true);
      for (const a of [p.positions, ...morphs])
        expect([...a].every(Number.isFinite)).toBe(true);
      expect(asset.primitives(name)).toHaveLength(1);
    }
    expect(triangles).toBeLessThan(18000);
    const h = new THREE.Box3()
      .setFromArray(asset.primitive('Skeleton_Shrimp').positions)
      .getSize(new THREE.Vector3());
    expect(h.y).toBeGreaterThan(0.17);
    expect(h.x).toBeGreaterThan(0.07);
    const f = library(),
      m = f.source.getObjectByName('Decorator_Crab') as THREE.Mesh;
    animateWreckMini(m, 80);
    expect(m.morphTargetInfluences![2]).toBeCloseTo(1);
  });
});
