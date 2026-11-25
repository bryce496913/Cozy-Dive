import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { IceEnvironment } from '../src/environment/ice/IceEnvironment';
import { IceGarden } from '../src/environment/ice/IceGarden';
import {
  IceMinis,
  ICE_MINI_NODES,
  ICE_MINI_SIGHTS,
  ICE_MINI_TUNING,
  type IceMiniKind,
} from '../src/environment/ice/IceMinis';
import { ICE } from '../src/config/passage';
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
const asset = new ReefAsset('public/assets/models/creatures/ice-minis.glb'),
  kinds = Object.keys(ICE_MINI_NODES) as IceMiniKind[];
const ids = ['sea-angel', 'tritoniella-belli', 'giant-isopod'] as const;
const rig: Record<IceMiniKind, Record<string, number>> = {
  angel: { Stroke_Left: 0, Stroke_Right: 1 },
  slug: { Stroke_Left: 0, Stroke_Right: 1 },
  isopod: { Stroke_Left: 0, Stroke_Right: 1 },
};
function fixture(authored = true) {
  const env = new IceEnvironment(authored ? testGeology() : undefined),
    dressing = new IceGarden(env.stones),
    minis = new IceMinis(env, dressing);
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
    const name = ICE_MINI_NODES[kind],
      p = asset.primitive(name),
      g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(p.positions, 3));
    g.setIndex(new THREE.BufferAttribute(p.indices, 1));
    g.morphAttributes.position = asset
      .morphPositions(name)
      .map((a) => new THREE.BufferAttribute(a, 3));
    g.morphTargetsRelative = true;
    const mesh = new THREE.Mesh(
      g,
      new THREE.MeshStandardMaterial({
        transparent: kind === 'angel',
        opacity: kind === 'angel' ? 0.57 : 1,
      }),
    );
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
describe('Pass 105 Antarctic habitats and movement', () => {
  it.each([true, false])(
    'provides reachable, separated water/coral/dropstone homes with authored=%s rock',
    (authored) => {
      const f = fixture(authored);
      try {
        const world = new CollisionWorld(f.env.colliders, ICE.bounds, 0.3);
        for (const kind of kinds) {
          const h = f.minis.homes[kind];
          expect(
            world.colliders.some((c) =>
              world.contains(c, h.view.x, h.view.y, h.view.z),
            ),
            kind,
          ).toBe(false);
          expect(h.target.distanceTo(h.view)).toBeLessThan(
            ICE_MINI_TUNING.reach,
          );
          for (const other of kinds)
            if (kind !== other)
              expect(
                h.position.distanceTo(f.minis.homes[other].position),
              ).toBeGreaterThanOrEqual(3);
        }
        expect(f.minis.homes.slug.attachment).toContain('soft-coral');
        expect(f.minis.homes.isopod.attachment).toContain('dropstone');
        expect(f.minis.homes.angel.position.y).toBe(9);
      } finally {
        f.dispose();
      }
    },
    30_000,
  );
  it('keeps every exported pose out of solid rock', () => {
    const f = fixture(),
      world = new CollisionWorld(f.env.colliders, ICE.bounds, 0),
      v = new THREE.Vector3();
    try {
      for (const kind of kinds) {
        const name = ICE_MINI_NODES[kind],
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
});
describe('Pass 105 observations, animation and lifecycle', () => {
  it('awards all three only close and looking, and blocks views through the seabed', async () => {
    const f = fixture(),
      l = library();
    try {
      expect(f.minis.sightings).toHaveLength(0);
      expect(await f.minis.load(l.loader)).toBe(true);
      for (const kind of kinds) {
        const h = f.minis.homes[kind],
          candidate = f.minis.sightings.find(
            (s) => s.id === ICE_MINI_SIGHTS[kind].id,
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
            y: -2,
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
      for (const name of Object.values(ICE_MINI_NODES)) {
        const x = a.minis.root.getObjectByName(name) as THREE.Mesh,
          y = b.minis.root.getObjectByName(name) as THREE.Mesh;
        x.morphTargetInfluences!.forEach((v, i) =>
          expect(v).toBeCloseTo(y.morphTargetInfluences![i], 10),
        );
      }
      const shrimp = a.minis.root.getObjectByName(
          'Glyptonotus_Antarcticus',
        ) as THREE.Mesh,
        w = [...shrimp.morphTargetInfluences!];
      a.minis.update(10, false, false);
      expect(shrimp.morphTargetInfluences).toEqual(w);
      a.minis.update(1, true, true);
      expect(shrimp.morphTargetInfluences!.every((v) => v === 0)).toBe(true);
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
describe('Pass 105 identity and collection', () => {
  it('preserves both older Antarctic save identities and appends only Tritoniella', () => {
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
      expect(e.section).toBe('antarctic');
      expect(e.order).toBe([0, 32, 16][i]);
      expect(e.rarity).toBe('rare');
      expect(COLLECTION.filter((x) => x.id === e.id)).toHaveLength(1);
      expect(tank.addBaby(id, seen)).toBe(true);
    }
    expect(saveTank(store, [], tank.babies)).toBe(true);
    expect(loadTankState(store, seen, context).babies).toEqual([...ids]);
    expect(collectionEntry('species:polar-bear')?.order).toBe(31);
  });
  it('shares identical models in habitat, album and tank, with the same anatomical morphs', async () => {
    const f = fixture(),
      l = library();
    await f.minis.load(l.loader);
    try {
      for (let i = 0; i < ids.length; i++) {
        const d = babyDefinition(ids[i]),
          e = collectionEntry(`species:${ids[i]}`)!,
          name = ICE_MINI_NODES[kinds[i]],
          art = await acquireCollectionArt(d, l.loader),
          card = await buildPreview(e, { creatures: l.loader, reef: l.loader });
        const wild = f.minis.root.getObjectByName(name) as THREE.Mesh,
          tank = art.model.getObjectByName(name) as THREE.Mesh,
          preview = card.object.getObjectByName(name) as THREE.Mesh;
        expect(d.asset).toBe('iceMinis');
        expect(
          new THREE.Box3().setFromObject(art.model).getSize(new THREE.Vector3())
            .y,
        ).toBeLessThanOrEqual(d.halfHeight * 2);
        expect(tank.geometry).toBe(wild.geometry);
        expect(preview.geometry).toBe(wild.geometry);
        art.update(1, 0, 45);
        if (kinds[i] === 'angel') {
          expect((wild.material as THREE.Material).depthWrite).toBe(false);
          art.update(0.5, 0, 45);
          expect((tank.material as THREE.Material).opacity).toBeCloseTo(0.285);
        }
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
    expect(l.release).toHaveBeenCalledTimes(7);
  }, 30_000);
  it('exports restrained sea-angel translucency without emissive glow', () => {
    const bytes = readFileSync('public/assets/models/creatures/ice-minis.glb');
    const gltf: {
      materials: {
        name: string;
        alphaMode?: string;
        pbrMetallicRoughness?: { baseColorFactor?: number[] };
        emissiveFactor?: number[];
      }[];
    } = JSON.parse(bytes.toString('utf8', 20, 20 + bytes.readUInt32LE(12)));
    const skin = gltf.materials.find(
      (m) => m.name === 'Clione_Antarctica_Skin',
    )!;
    expect(skin.alphaMode).toBe('BLEND');
    expect(skin.pbrMetallicRoughness!.baseColorFactor![3]).toBeCloseTo(0.57);
    expect((skin.emissiveFactor ?? [0, 0, 0]).every((v) => v === 0)).toBe(true);
  });
  it('ships finite detailed anatomy, three single-mesh animals and neutral default morph weights', () => {
    for (const kind of kinds) {
      const name = ICE_MINI_NODES[kind],
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
