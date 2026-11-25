import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { spanishShawlGeometry } from '../src/environment/kelp/SpanishShawl';
import { KelpDressing } from '../src/environment/kelp/KelpDressing';
import { KelpEnvironment } from '../src/environment/kelp/KelpEnvironment';
import {
  stalkPlacements,
  wallStalkPlacements,
} from '../src/environment/kelp/KelpStalks';
import {
  KelpMinis,
  KELP_MINI_NODES,
  kelpMiniObstacles,
  KELP_MINI_TUNING,
  type KelpMiniKind,
} from '../src/environment/kelp/KelpMinis';
import {
  animateKelpMini,
  kelpMiniMouth,
  kelpMiniExplore,
} from '../src/environment/kelp/KelpMiniAnimation';
import {
  SightingTracker,
  saveJournal,
  loadJournal,
} from '../src/discovery/journal';
import { COLLECTION, collectionEntry } from '../src/collection/registry';
import { babyDefinition } from '../src/config/babies';
import { acquireCollectionArt } from '../src/environment/TankCollectionArt';
import { buildPreview } from '../src/collection/AlbumPreviews';
import { testGeology } from '../validation/geologyModel';
import { ReefAsset } from '../validation/ReefAsset';
const kinds = Object.keys(KELP_MINI_NODES) as KelpMiniKind[];
const ids = [
  'weedy-seadragon',
  'spanish-shawl',
  'sarcastic-fringehead',
  'east-pacific-red-octopus',
] as const;
const asset = new ReefAsset('public/assets/models/creatures/kelp-minis.glb');
function fixture(authored = true) {
  const env = new KelpEnvironment(authored ? testGeology() : undefined);
  const rocks = [...env.boulders, ...env.wallRocks];
  const stalks = [
    ...stalkPlacements(undefined, undefined, rocks),
    ...wallStalkPlacements(undefined, rocks),
  ];
  const dressing = new KelpDressing(env.boulders);
  const minis = new KelpMinis(env, stalks, dressing.root);
  const obstacles = kelpMiniObstacles(dressing.root);
  dressing.dispose();
  return { env, stalks, minis, obstacles, dressingRoot: dressing.root };
}
function library() {
  const source = new THREE.Group();
  for (const name of Object.values(KELP_MINI_NODES)) {
    const p = asset.primitive(name),
      g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(p.positions, 3));
    g.setIndex(new THREE.BufferAttribute(p.indices, 1));
    g.morphAttributes.position = asset
      .morphPositions(name)
      .map((p) => new THREE.BufferAttribute(p, 3));
    g.morphTargetsRelative = true;
    const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial());
    m.name = name;
    m.morphTargetDictionary = {
      Stroke_Left: 0,
      Stroke_Right: 1,
      ...(name === 'Sarcastic_Fringehead' ? { Mouth_Open: 2 } : {}),
      ...(name === 'Red_Octopus' ? { Camouflage: 2 } : {}),
    };
    source.add(m);
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
describe('Pass 102 kelp miniature homes and discoveries', () => {
  it.each([true, false])(
    'selects four separated, clear homes on authored=%s terrain',
    async (authored) => {
      const { env, stalks, minis, obstacles, dressingRoot } = fixture(authored),
        f = library();
      try {
        expect(minis.sightings).toHaveLength(0);
        expect(await minis.load(f.loader)).toBe(true);
        expect(new Set(minis.sightings.map((s) => s.id)).size).toBe(4);
        for (const kind of kinds) {
          const h = minis.homes[kind],
            p = new THREE.Vector3(h.position.x, h.position.y, h.position.z),
            eye = new THREE.Vector3(h.view.x, h.view.y, h.view.z);
          const envelope = new THREE.Box3().setFromCenterAndSize(
            new THREE.Vector3(p.x, p.y + 0.09, p.z),
            new THREE.Vector3(0.42, 0.36, 0.42),
          );
          expect(obstacles.some((b) => b.intersectsBox(envelope))).toBe(false);
          for (const s of stalks)
            expect(Math.hypot(s.x - p.x, s.z - p.z)).toBeGreaterThanOrEqual(
              KELP_MINI_TUNING.vegetation,
            );
          for (const other of kinds)
            if (other !== kind)
              expect(
                Math.hypot(
                  p.x - minis.homes[other].position.x,
                  p.z - minis.homes[other].position.z,
                ),
              ).toBeGreaterThanOrEqual(5);
          const candidate = minis.sightings.find(
            (s) => s.id === `species:${ids[kinds.indexOf(kind)]}`,
          )!;
          expect(candidate.visibleFrom!(eye), kind).toBe(true);
          const tracker = new SightingTracker([]),
            forward = new THREE.Vector3(
              candidate.position.x,
              candidate.position.y,
              candidate.position.z,
            )
              .sub(eye)
              .normalize();
          let seen = false;
          for (let i = 0; i < 180; i++)
            if (tracker.update([candidate], eye, forward, 1 / 30)) seen = true;
          expect(seen, kind).toBe(true);
          const wall = new THREE.Mesh(
            new THREE.BoxGeometry(0.7, 0.7, 0.1),
            new THREE.MeshBasicMaterial(),
          );
          wall.position
            .copy(eye)
            .lerp(
              new THREE.Vector3(
                candidate.position.x,
                candidate.position.y,
                candidate.position.z,
              ),
              0.5,
            );
          wall.lookAt(eye);
          const occluders = kind === 'fringehead' ? dressingRoot : env.root;
          occluders.add(wall);
          occluders.updateMatrixWorld(true);
          expect(candidate.visibleFrom!(eye), kind).toBe(false);
          wall.removeFromParent();
          wall.geometry.dispose();
          wall.material.dispose();
        }
      } finally {
        minis.dispose();
        env.dispose();
      }
      expect(f.release).toHaveBeenCalledTimes(1);
    },
    30_000,
  );
  it('freezes pause/reduced motion, bounds exploration, and releases once', async () => {
    const { env, minis } = fixture(),
      f = library();
    await minis.load(f.loader);
    minis.update(0.1, true, false);
    const before = { ...minis.positionOf('seadragon') };
    minis.update(1, false, false);
    expect({ ...minis.positionOf('seadragon') }).toEqual(before);
    for (let i = 0; i < 1200; i++) minis.update(0.1, true, false);
    for (const k of kinds) {
      const p = minis.positionOf(k),
        h = minis.homes[k].position;
      expect(Math.hypot(p.x - h.x, p.y - h.y, p.z - h.z)).toBeLessThan(0.06);
    }
    minis.update(0.1, true, true);
    expect({ ...minis.positionOf('seadragon') }).toMatchObject(
      minis.homes.seadragon.position,
    );
    minis.dispose();
    minis.dispose();
    env.dispose();
    expect(f.release).toHaveBeenCalledTimes(1);
  });
  it('rejects failed libraries and releases late arrivals without sightings', async () => {
    const { env, minis } = fixture(),
      f = library();
    f.source.remove(f.source.children[0]);
    expect(await minis.load(f.loader)).toBe(false);
    expect(minis.sightings).toHaveLength(0);
    expect(f.release).toHaveBeenCalledTimes(1);
    minis.dispose();
    env.dispose();
    const next = fixture(),
      late = library();
    let resolve!: (
      value: Awaited<ReturnType<typeof late.loader.acquire>>,
    ) => void;
    const pending = next.minis.load({
      ...late.loader,
      acquire: () =>
        new Promise((r) => {
          resolve = r;
        }),
    });
    next.minis.dispose();
    resolve(await late.loader.acquire());
    expect(await pending).toBe(false);
    expect(late.release).toHaveBeenCalledTimes(1);
    expect(next.minis.sightings).toHaveLength(0);
    next.env.dispose();
  });
});
describe('Pass 102 canonical collection and anatomy', () => {
  it('preserves the single Spanish shawl and saves all four identities', () => {
    expect(
      COLLECTION.filter((e) => e.id === 'species:spanish-shawl'),
    ).toHaveLength(1);
    expect(collectionEntry('species:spanish-shawl')?.order).toBe(6);
    const store = new Map<string, string>(),
      storage = {
        getItem: (k: string) => store.get(k) ?? null,
        setItem: (k: string, v: string) => {
          store.set(k, v);
        },
      };
    const seen = ids.map((id) => ({
      id: `species:${id}`,
      first: '2026-11-25T00:00:00.000Z',
    }));
    expect(saveJournal(storage, seen)).toBe(true);
    expect(loadJournal(storage)).toEqual(seen);
  });
  it('uses identical geometry for habitat, album and aquarium for every animal', async () => {
    const { env, minis } = fixture(),
      f = library();
    await minis.load(f.loader);
    try {
      for (let i = 0; i < ids.length; i++) {
        const d = babyDefinition(ids[i])!,
          entry = collectionEntry(`species:${ids[i]}`)!;
        expect(d.asset).toBe('kelpMinis');
        expect(entry.rarity).toBe('rare');
        const art = await acquireCollectionArt(d, f.loader),
          preview = await buildPreview(entry, {
            creatures: f.loader,
            reef: f.loader,
          });
        const name = KELP_MINI_NODES[kinds[i]],
          wild = minis.root
            .getObjectByName(name)!
            .getObjectByProperty('isMesh', true) as THREE.Mesh;
        const tank = art.model.getObjectByName(name) as THREE.Mesh,
          card = preview.object.getObjectByName(name) as THREE.Mesh;
        expect(tank.geometry).toBe(wild.geometry);
        expect(card.geometry).toBe(wild.geometry);
        art.dispose();
        preview.dispose();
      }
    } finally {
      minis.dispose();
      env.dispose();
    }
    expect(f.release).toHaveBeenCalledTimes(9);
  });
  it('retains the existing Spanish shawl anatomy in the canonical Blender mesh', () => {
    const source = spanishShawlGeometry(),
      p = source.getAttribute('position');
    const exported = asset.primitive('Spanish_Shawl').positions;
    // GLB's float32 export can straddle a rounding-grid boundary: compare actual distances.
    for (let i = 0; i < exported.length; i += 3) {
      let nearest = Infinity;
      for (let j = 0; j < p.count; j++)
        nearest = Math.min(
          nearest,
          Math.hypot(
            exported[i] - p.getX(j) * 2.2,
            exported[i + 1] - p.getY(j) * 2.2,
            exported[i + 2] - p.getZ(j) * 2.2,
          ),
        );
      expect(nearest).toBeLessThan(5e-6);
    }
    source.dispose();
  });
  it('has frame-rate independent quiet motion and intermittent den exploration', async () => {
    const a = fixture(),
      b = fixture();
    await a.minis.load(library().loader);
    await b.minis.load(library().loader);
    try {
      for (let i = 0; i < 180; i++) a.minis.update(1 / 30, true, false);
      for (let i = 0; i < 720; i++) b.minis.update(1 / 120, true, false);
      for (const k of kinds)
        for (const axis of ['x', 'y', 'z'] as const)
          expect(a.minis.positionOf(k)[axis]).toBeCloseTo(
            b.minis.positionOf(k)[axis],
            10,
          );
      expect(kelpMiniExplore(50)).toBe(0);
      expect(kelpMiniExplore(80)).toBeCloseTo(1);
      expect(kelpMiniExplore(90)).toBe(0);
    } finally {
      a.minis.dispose();
      b.minis.dispose();
      a.env.dispose();
      b.env.dispose();
    }
  }, 30_000);
  it('exports distinct detailed meshes, finite morphs and a restrained periodic gape', () => {
    for (const name of Object.values(KELP_MINI_NODES)) {
      expect(
        asset.doc.meshes[asset.node(name).mesh!].weights?.every((w) => w === 0),
      ).toBe(true);
      const p = asset.primitive(name);
      expect(p.indices.length / 3).toBeGreaterThan(2000);
      expect(p.indices.length / 3).toBeLessThan(12000);
      expect(p.colors).toBeDefined();
      expect([...p.positions].every(Number.isFinite)).toBe(true);
      const morphs = asset.morphPositions(name);
      expect(morphs.length).toBe(
        name === 'Red_Octopus' || name === 'Sarcastic_Fringehead' ? 3 : 2,
      );
      for (const m of morphs) expect([...m].every(Number.isFinite)).toBe(true);
    }
    expect(kelpMiniMouth(0)).toBe(0);
    expect(kelpMiniMouth(25)).toBe(0);
    expect(kelpMiniMouth(28.5)).toBeCloseTo(1);
    expect(kelpMiniMouth(59.5)).toBeCloseTo(1);
    const f = library(),
      mouth = f.source.getObjectByName('Sarcastic_Fringehead') as THREE.Mesh;
    animateKelpMini(mouth, 28.5);
    expect(mouth.morphTargetInfluences![2]).toBeCloseTo(1);
    animateKelpMini(mouth, 0);
    expect(mouth.morphTargetInfluences![2]).toBe(0);
  });
});
