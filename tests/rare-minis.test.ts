import * as THREE from 'three';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { Aquarium } from '../src/environment/Aquarium';
import { safeFishPosition } from '../src/fish/FishHabitat';
import {
  RARE_MINI_NODES,
  RARE_MINI_TUNING,
  RareMinis,
  rareMiniHomes,
  type RareMiniKind,
} from '../src/creatures/discoveries/RareMinis';
import { SightingTracker } from '../src/discovery/journal';
import { AQUARIUM_SIGHTS, SIGHTS } from '../src/discovery/sights';
import { babyDefinition, BABY_CAP, TANK_BABIES } from '../src/config/babies';
import { collectionEntry, COLLECTION } from '../src/collection/registry';
import { ReefAsset } from '../validation/ReefAsset';
import type { AssetLease } from '../src/assets/AssetLoader';
import { AQUARIUM } from '../src/config/world';

/** V0.8 Pass 100: the aquarium's three rare miniature discoveries. */
const KINDS: RareMiniKind[] = ['pikachu', 'leafSheep', 'candyCrab'];
const IDS = {
  pikachu: 'species:pikachu-nudibranch',
  leafSheep: 'species:leaf-sheep',
  candyCrab: 'species:candy-crab',
} as const;

/** A stand-in for the library: three named meshes with the Stroke morphs. */
function fakeLoader() {
  const released = vi.fn(),
    evicted = vi.fn();
  const model = new THREE.Group();
  for (const name of Object.values(RARE_MINI_NODES)) {
    const g = new THREE.BoxGeometry(0.05, 0.02, 0.12);
    g.morphAttributes.position = [
      g.attributes.position.clone(),
      g.attributes.position.clone(),
    ];
    const mesh = new THREE.Mesh(g, new THREE.MeshStandardMaterial());
    mesh.name = name;
    mesh.morphTargetDictionary = { Stroke_Left: 0, Stroke_Right: 1 };
    mesh.morphTargetInfluences = [0, 0];
    mesh.position.x = 0.3;
    model.add(mesh);
  }
  return {
    released,
    evicted,
    loader: {
      acquire: vi.fn(async (): Promise<AssetLease> => ({
        model,
        animations: [],
        release: released,
      })),
      evictUnused: evicted,
    },
  };
}

describe('rare miniature discoveries: homes and behaviour', () => {
  let a: Aquarium;
  beforeAll(() => {
    a = new Aquarium();
  });
  afterAll(() => a.dispose());

  it('gives each a fixed home in its own microhabitat, apart from the other discoveries', () => {
    const rare = a.anchoredLife.hidden.rare,
      hidden = a.anchoredLife.hidden;
    expect(rare.homes.candyCrab.plant?.species.id).toBe('soft-coral');
    expect(rare.homes.leafSheep.plant?.species.id).toBe('caulerpa');
    expect(rare.homes.pikachu.habitatKind).toBe('reef-face');
    // A near-level rock face (its rubble tops).
    expect(rare.homes.pikachu.orientation.y).toBeGreaterThanOrEqual(0.8);
    const others = [
      hidden.seahorse.home,
      hidden.frogfish.home,
      ...hidden.nudibranchs.animals.map((n) => n.home),
    ];
    for (const kind of KINDS) {
      const p = rare.homes[kind].position;
      for (const o of others)
        expect(
          Math.hypot(
            o.position.x - p.x,
            o.position.y - p.y,
            o.position.z - p.z,
          ),
          kind,
        ).toBeGreaterThanOrEqual(RARE_MINI_TUNING.clearance - 1e-6);
      for (const k of KINDS)
        if (k !== kind) {
          const q = rare.homes[k].position;
          expect(Math.hypot(q.x - p.x, q.y - p.y, q.z - p.z)).toBeGreaterThan(
            1,
          );
        }
      // Inside the glass.
      expect(p.x).toBeGreaterThan(AQUARIUM.min.x);
      expect(p.x).toBeLessThan(AQUARIUM.max.x);
      expect(p.z).toBeGreaterThan(AQUARIUM.min.z);
      expect(p.z).toBeLessThan(AQUARIUM.max.z);
    }
  });

  it('is deterministic: the same homes every visit (persistent, never randomly spawned)', () => {
    const b = new Aquarium();
    try {
      for (const kind of KINDS)
        expect(b.anchoredLife.hidden.rare.homes[kind].position).toEqual(
          a.anchoredLife.hidden.rare.homes[kind].position,
        );
    } finally {
      b.dispose();
    }
  });

  it('offers each a clear viewing spot the swimmer can reach, close enough to see it', () => {
    const rare = a.anchoredLife.hidden.rare,
      h = a.fish.simulation.habitat;
    for (const kind of KINDS) {
      const home = rare.homes[kind];
      expect(safeFishPosition(home.view, 0.65, h), kind).toBe(true);
      const d = Math.hypot(
        home.view.x - home.position.x,
        home.view.y - home.position.y,
        home.view.z - home.position.z,
      );
      expect(d, kind).toBeLessThan(RARE_MINI_TUNING.reach);
      expect(home.approach.length).toBeGreaterThan(2);
    }
  });

  it('is sighted only up close, looked at directly, and only once the model is shown', async () => {
    const h = a.fish.simulation.habitat,
      hidden = a.anchoredLife.hidden;
    const rare = new RareMinis(
      h,
      a.plants.placements,
      [{ id: 'reef', colliders: a.rockColliders }],
      [hidden.seahorse.home, hidden.frogfish.home].map((x) => ({
        ...x.position,
        clearance: 1.1,
      })),
    );
    try {
      expect(rare.sightings).toHaveLength(0);
      const { loader } = fakeLoader();
      expect(await rare.load(loader)).toBe(true);
      expect(rare.sightings.map((s) => s.id).sort()).toEqual(
        Object.values(IDS).sort(),
      );
      const home = rare.homes.leafSheep,
        target = rare.positionOf('leafSheep');
      const look = (eye: THREE.Vector3) =>
        new THREE.Vector3(target.x, target.y, target.z).sub(eye).normalize();
      // From across the tank (4 m away, looking straight at it): never.
      const far = new THREE.Vector3(target.x, target.y + 1, target.z).add(
        new THREE.Vector3(
          home.view.x - target.x,
          0,
          home.view.z - target.z,
        ).setLength(4),
      );
      const t1 = new SightingTracker([]);
      for (let i = 0; i < 300; i++)
        expect(t1.update(rare.sightings, far, look(far), 1 / 30)).toBeNull();
      // From its viewing spot, looking at it for the usual dwell: seen.
      const near = new THREE.Vector3(home.view.x, home.view.y, home.view.z);
      const t2 = new SightingTracker([]);
      let seen: string | undefined;
      for (let i = 0; i < 60 && !seen; i++)
        seen = t2.update(rare.sightings, near, look(near), 1 / 30)?.id;
      expect(seen).toBe(IDS.leafSheep);
      // Looking away from it (beyond its narrow cone): not.
      const t3 = new SightingTracker([]);
      const away = look(near).applyAxisAngle(new THREE.Vector3(0, 1, 0), 0.6);
      for (let i = 0; i < 120; i++)
        expect(t3.update(rare.sightings, near, away, 1 / 30)?.id).not.toBe(
          IDS.leafSheep,
        );
    } finally {
      rare.dispose();
    }
  });

  it('crawls at the same pace at any frame rate, pauses for the diver, and keeps still with reduced motion', async () => {
    const h = a.fish.simulation.habitat;
    const make = async () => {
      const r = new RareMinis(
        h,
        a.plants.placements,
        [{ id: 'reef', colliders: a.rockColliders }],
        [],
      );
      await r.load(fakeLoader().loader);
      return r;
    };
    const run = async (fps: number, reduced = false, diver = false) => {
      const r = await make();
      const p = r.positionOf('pikachu'),
        player = {
          position: { ...p },
          velocity: { x: 0, y: 0, z: 0 },
          active: diver,
        };
      for (let i = 0; i < 60 * fps; i++)
        r.update(i / fps, 1 / fps, reduced, player);
      const out = { ...r.positionOf('pikachu') };
      r.dispose();
      return out;
    };
    const start = (await make()).positionOf('pikachu');
    const at30 = await run(30),
      at60 = await run(60),
      at120 = await run(120);
    // A minute's crawl moves it, the same distance at any frame rate.
    expect(Math.hypot(at30.x - start.x, at30.z - start.z)).toBeGreaterThan(
      0.01,
    );
    expect(Math.hypot(at60.x - at30.x, at60.z - at30.z)).toBeLessThan(0.002);
    expect(Math.hypot(at120.x - at30.x, at120.z - at30.z)).toBeLessThan(0.002);
    // The crawl loop stays on its tested footprint.
    for (const p of [at30, at60, at120])
      expect(Math.hypot(p.x - start.x, p.z - start.z)).toBeLessThan(0.17);
    // Reduced motion: it stays where it is.
    const still = await run(60, true);
    expect(Math.hypot(still.x - start.x, still.z - start.z)).toBeLessThan(1e-6);
    // The diver right beside it: it soon stops (far less than the free crawl).
    const shy = await run(60, false, true);
    expect(Math.hypot(shy.x - start.x, shy.z - start.z)).toBeLessThan(
      Math.hypot(at60.x - start.x, at60.z - start.z) * 0.2,
    );
  });

  it('stays still while the game is paused (the tank is not advanced)', async () => {
    const hidden = a.anchoredLife.hidden;
    await hidden.rare.load(fakeLoader().loader);
    hidden.update(1, true, false);
    const before = { ...hidden.rare.positionOf('pikachu') };
    for (let i = 0; i < 300; i++) hidden.update(1 / 60, false, false);
    expect(hidden.rare.positionOf('pikachu')).toEqual(before);
  });

  it('shows nothing and loses nothing when the library cannot load, and releases it exactly once', async () => {
    const h = a.fish.simulation.habitat;
    const failing = new RareMinis(
      h,
      a.plants.placements,
      [{ id: 'reef', colliders: a.rockColliders }],
      [],
    );
    expect(
      await failing.load({
        acquire: () => Promise.reject(Error('offline')),
        evictUnused: () => undefined,
      }),
    ).toBe(false);
    expect(failing.sightings).toHaveLength(0);
    expect(failing.loaded).toBe(false);
    failing.dispose();
    const ok = new RareMinis(
        h,
        a.plants.placements,
        [{ id: 'reef', colliders: a.rockColliders }],
        [],
      ),
      fake = fakeLoader();
    await ok.load(fake.loader);
    ok.dispose();
    ok.dispose();
    expect(fake.released).toHaveBeenCalledTimes(1);
    expect(fake.evicted).toHaveBeenCalledWith('rareMinis');
    expect(ok.sightings).toHaveLength(0);
    expect(ok.root.children).toHaveLength(0);
    // Disposed while loading: the late lease is released at once.
    const late = new RareMinis(
        h,
        a.plants.placements,
        [{ id: 'reef', colliders: a.rockColliders }],
        [],
      ),
      slow = fakeLoader();
    const pending = late.load(slow.loader);
    late.dispose();
    expect(await pending).toBe(false);
    expect(slow.released).toHaveBeenCalledTimes(1);
  });

  it('perches the crab on a coral that is actually drawn, with a viewing spot for where it is', async () => {
    const h = a.fish.simulation.habitat;
    const make = async () => {
      const r = new RareMinis(
        h,
        a.plants.placements,
        [{ id: 'reef', colliders: a.rockColliders }],
        [],
      );
      await r.load(fakeLoader().loader);
      return r;
    };
    const drawn = (plant: {
      position: { x: number; y: number; z: number };
      height: number;
    }) =>
      new THREE.Matrix4().compose(
        new THREE.Vector3(plant.position.x, plant.position.y, plant.position.z),
        new THREE.Quaternion(),
        new THREE.Vector3().setScalar(plant.height),
      );
    // Its first coral withheld by the reef: it moves to the next drawn one.
    const r = await make();
    const first = r.homes.candyCrab.plant!;
    expect(
      r.perchCrab((plant) =>
        plant === first ? undefined : { toWorld: drawn(plant) },
      ),
    ).toBe(true);
    expect(r.homes.candyCrab.plant).not.toBe(first);
    expect(r.homes.candyCrab.plant?.species.id).toBe('soft-coral');
    const p = r.positionOf('candyCrab'),
      v = r.homes.candyCrab.view;
    expect(Math.hypot(v.x - p.x, v.y - p.y, v.z - p.z)).toBeLessThan(
      RARE_MINI_TUNING.reach,
    );
    expect(r.sightings.some((s) => s.id === IDS.candyCrab)).toBe(true);
    r.dispose();
    // No coral drawn at all: it is not shown and cannot be sighted (nothing perches on nothing).
    const none = await make();
    expect(none.perchCrab(() => undefined)).toBe(false);
    expect(none.sightings.some((s) => s.id === IDS.candyCrab)).toBe(false);
    none.dispose();
  });

  it('chooses homes without WebGL (pure layout)', () => {
    const homes = rareMiniHomes(
      a.fish.simulation.habitat,
      a.plants.placements,
      [{ id: 'reef', colliders: a.rockColliders }],
      [],
    );
    expect(Object.keys(homes).sort()).toEqual([...KINDS].sort());
  });
});

describe('rare miniature discoveries: one model for wild, card and tank', () => {
  const asset = new ReefAsset('public/assets/models/creatures/rare-minis.glb');
  it.each(Object.entries(RARE_MINI_NODES))(
    '%s (%s) is a small animal with natural colours and two real bend strokes',
    (_kind, node) => {
      const p = asset.primitive(node).positions;
      const lo = [Infinity, Infinity, Infinity],
        hi = [-Infinity, -Infinity, -Infinity];
      for (let i = 0; i < p.length; i++) {
        lo[i % 3] = Math.min(lo[i % 3], p[i]);
        hi[i % 3] = Math.max(hi[i % 3], p[i]);
      }
      const size = Math.max(...hi.map((v, k) => v - lo[k]));
      // Small: 6 to 18 cm at the tank's scale (its fish are about 40 cm).
      expect(size).toBeGreaterThan(0.06);
      expect(size).toBeLessThan(0.18);
      // Resting on its foot or legs (y = 0), head forward (+Z is the long axis but for the crab).
      expect(Math.abs(lo[1])).toBeLessThan(0.006);
      const strokes = asset.morphPositions(node);
      expect(strokes).toHaveLength(2);
      for (const m of strokes) {
        let moved = 0;
        for (let i = 0; i < m.length; i += 3)
          moved = Math.max(moved, Math.hypot(m[i], m[i + 1], m[i + 2]));
        expect(moved).toBeGreaterThan(0.001);
        expect(moved).toBeLessThan(size * 0.25);
      }
      // A modest budget: a few thousand triangles each.
      expect(asset.primitive(node).indices.length / 3).toBeLessThan(7000);
    },
  );

  it('registers each as a rare aquarium card that joins the tank as the same model', () => {
    for (const [kind, id] of Object.entries(IDS)) {
      const entry = collectionEntry(id)!;
      expect(entry.section).toBe('aquarium');
      expect(entry.rarity).toBe('rare');
      expect(entry.discovery).toBe('sighting');
      expect(entry.model).toEqual({
        type: 'asset',
        asset: 'rareMinis',
        nodes: [RARE_MINI_NODES[kind as RareMiniKind]],
      });
      expect(entry.tank).toEqual({ slot: 'animal', key: id.slice(8) });
      const baby = babyDefinition(id.slice(8) as never);
      expect(baby.asset).toBe('rareMinis');
      expect(baby.nodes).toEqual([RARE_MINI_NODES[kind as RareMiniKind]]);
      // Not enlarged with the big animals: miniatures of tiny animals stay tiny.
      expect(baby.size).toBeLessThanOrEqual(0.22);
      expect(SIGHTS.some((s) => s.id === id)).toBe(true);
    }
    expect(Object.values(AQUARIUM_SIGHTS).map((s) => s.id)).toEqual(
      Object.values(IDS),
    );
    // The aquarium page keeps its earlier slots in order; the three follow.
    expect(
      COLLECTION.filter((e) => e.section === 'aquarium')
        .slice(-3)
        .map((e) => e.id),
    ).toEqual(Object.values(IDS));
    // One of each fits in a full tank.
    expect(BABY_CAP).toBe(TANK_BABIES.length);
  });
});
