import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import {
  REEF_MINI_NODES,
  REEF_MINI_TUNING,
  ReefMinis,
  burrowAt,
  mimicryAt,
  reefMiniHomes,
  type ReefMiniKind,
} from '../src/environment/outer/ReefMinis';
import { outerReefLayout } from '../src/environment/outer/OuterReefLayout';
import { seabedHeight } from '../src/environment/outer/OuterTerrain';
import { SightingTracker } from '../src/discovery/journal';
import { SIGHTS } from '../src/discovery/sights';
import { babyDefinition, BABY_CAP, TANK_BABIES } from '../src/config/babies';
import { COLLECTION, collectionEntry } from '../src/collection/registry';
import { ReefAsset } from '../validation/ReefAsset';
import type { AssetLease } from '../src/assets/AssetLoader';
import { OUTER } from '../src/config/passage';

/** V0.8 Pass 101: the outer reef's four rare miniatures. */
const KINDS: ReefMiniKind[] = ['harlequin', 'pipefish', 'frogfish', 'mimic'];
const IDS: Record<ReefMiniKind, string> = {
  harlequin: 'species:harlequin-shrimp',
  pipefish: 'species:ornate-ghost-pipefish',
  frogfish: 'species:hairy-frogfish',
  mimic: 'species:mimic-octopus',
};
const placements = outerReefLayout().placements;

function fakeLoader() {
  const released = vi.fn(),
    evicted = vi.fn(),
    model = new THREE.Group();
  for (const name of Object.values(REEF_MINI_NODES)) {
    const g = new THREE.BoxGeometry(0.05, 0.02, 0.1),
      morphs = name === 'Mimic_Octopus' ? 4 : 2;
    g.morphAttributes.position = Array.from({ length: morphs }, () =>
      g.attributes.position.clone(),
    );
    const mesh = new THREE.Mesh(g, new THREE.MeshStandardMaterial());
    mesh.name = name;
    mesh.morphTargetDictionary = {
      Stroke_Left: 0,
      Stroke_Right: 1,
      ...(morphs === 4 ? { Mimic_Flatfish: 2, Mimic_Lionfish: 3 } : {}),
    };
    mesh.morphTargetInfluences = new Array(morphs).fill(0);
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
const shown = async () => {
  const r = new ReefMinis(placements);
  await r.load(fakeLoader().loader);
  return r;
};

describe('outer reef rare miniatures: homes', () => {
  const homes = reefMiniHomes(placements);
  it('lives in its own microhabitat of the existing reef', () => {
    expect(placements[homes.harlequin.source.index].family).toBe('plate');
    expect(placements[homes.pipefish.source.index].family).toBe('fan');
    expect(['rubble', 'shell']).toContain(
      placements[homes.frogfish.source.index].family,
    );
    expect(['grass', 'blade']).toContain(
      placements[homes.mimic.source.index].family,
    );
    // The bottom-dwellers rest on the seabed; the pipefish hovers above its fan's foot.
    for (const k of ['harlequin', 'frogfish', 'mimic'] as const) {
      const p = homes[k].position;
      expect(Math.abs(p.y - seabedHeight(p.x, p.z)), k).toBeLessThan(1e-6);
    }
    const fan = placements[homes.pipefish.source.index];
    expect(homes.pipefish.position.y).toBeGreaterThan(fan.position.y + 0.1);
  });

  it('is stable, inside the reef top, well apart and clear of the day octopus', () => {
    expect(reefMiniHomes(placements)).toEqual(homes);
    const g = OUTER.glass;
    for (const k of KINDS) {
      const p = homes[k].position;
      expect(Math.abs(p.x)).toBeLessThan(OUTER.reach.halfWidth);
      expect(p.z).toBeGreaterThan(g.z);
      expect(p.z).toBeLessThan(OUTER.cliffZ);
      for (const o of KINDS)
        if (o !== k) {
          const q = homes[o].position;
          expect(Math.hypot(p.x - q.x, p.z - q.z)).toBeGreaterThanOrEqual(
            REEF_MINI_TUNING.spacing,
          );
        }
    }
    const d = REEF_MINI_TUNING.dayOctopus;
    expect(
      Math.hypot(homes.mimic.position.x - d.x, homes.mimic.position.z - d.z),
    ).toBeGreaterThan(d.clearance);
  });
});

describe('outer reef rare miniatures: discovery and behaviour', () => {
  it('is seen only close up and looked at, from its viewing spot; never from across the reef', async () => {
    const r = await shown();
    try {
      expect(r.sightings.map((s) => s.id).sort()).toEqual(
        Object.values(IDS).sort(),
      );
      for (const k of KINDS) {
        const home = r.homes[k],
          t = r.sightOf(k),
          at = (eye: THREE.Vector3) =>
            new THREE.Vector3(t.x, t.y, t.z).sub(eye).normalize();
        const view = new THREE.Vector3(home.view.x, home.view.y, home.view.z);
        expect(view.distanceTo(new THREE.Vector3(t.x, t.y, t.z))).toBeLessThan(
          REEF_MINI_TUNING.reach,
        );
        // From 6 m, looking straight at it: never.
        const far = new THREE.Vector3(t.x, t.y + 2, t.z + 5.6),
          t1 = new SightingTracker([]);
        for (let i = 0; i < 300; i++)
          expect(t1.update(r.sightings, far, at(far), 1 / 30)?.id).not.toBe(
            IDS[k],
          );
        // From its viewing spot (others seen on the way are recorded first).
        const t2 = new SightingTracker([]);
        let seen = false;
        for (let i = 0; i < 300 && !seen; i++)
          seen = t2.update(r.sightings, view, at(view), 1 / 30)?.id === IDS[k];
        expect(seen, k).toBe(true);
      }
    } finally {
      r.dispose();
    }
  });

  it('brings the mimic octopus out on a fixed cycle, never by rare chance, with both postures', () => {
    const { out, hidden } = REEF_MINI_TUNING.burrow;
    let inside = 0;
    const samples = 6000,
      cycle = out + hidden;
    for (let i = 0; i < samples; i++)
      if (burrowAt((i / samples) * cycle) > 0.5) inside++;
    // Out about four fifths of the time; back out within `hidden` s of going in.
    expect(inside / samples).toBeCloseTo(hidden / cycle, 1);
    expect(burrowAt(0)).toBe(0);
    expect(burrowAt(out + hidden / 2)).toBe(1);
    const postures = new Set<number>();
    for (let t = 0; t < 120; t += 0.5) {
      const m = mimicryAt(t);
      if (m.amount > 0.5) postures.add(m.posture);
    }
    expect([...postures].sort()).toEqual([0, 1]);
  });

  it('hides from sight while in its burrow and is sightable again when out', async () => {
    const r = await shown();
    try {
      const { out, hidden } = REEF_MINI_TUNING.burrow;
      for (let t = 0; t < out + hidden / 2; t += 0.1) r.update(0.1, false);
      expect(r.sightOf('mimic').y).toBeLessThan(-1000);
      for (let t = 0; t < hidden; t += 0.1) r.update(0.1, false);
      expect(r.sightOf('mimic').y).toBeGreaterThan(-100);
    } finally {
      r.dispose();
    }
  });

  it('moves at the same pace at any frame rate, keeps still with reduced motion, and freezes when shy', async () => {
    const run = async (fps: number, reduced = false, shy = false) => {
      const r = await shown(),
        p = r.homes.frogfish.position,
        player = {
          position: { ...p },
          velocity: { x: 0, y: 0, z: 0 },
          active: shy,
        };
      for (let i = 0; i < 40 * fps; i++) r.update(1 / fps, reduced, player);
      const at = { ...r.positionOf('frogfish') };
      r.dispose();
      return at;
    };
    const start = reefMiniHomes(placements).frogfish.position;
    const a = await run(30),
      b = await run(60),
      c = await run(120);
    expect(Math.hypot(a.x - start.x, a.z - start.z)).toBeGreaterThan(0.03);
    expect(Math.hypot(b.x - a.x, b.z - a.z)).toBeLessThan(0.003);
    expect(Math.hypot(c.x - a.x, c.z - a.z)).toBeLessThan(0.003);
    // A short shuffle: it stays by its rubble.
    expect(Math.hypot(a.x - start.x, a.z - start.z)).toBeLessThan(0.2);
    const still = await run(60, true);
    expect(Math.hypot(still.x - start.x, still.z - start.z)).toBeLessThan(1e-9);
    // The diver beside it: it soon freezes (far less than its free shuffle).
    const shy = await run(60, false, true);
    expect(Math.hypot(shy.x - start.x, shy.z - start.z)).toBeLessThan(
      Math.hypot(b.x - start.x, b.z - start.z) * 0.3,
    );
  });

  it('shows nothing and loses nothing when the library fails, and releases it exactly once', async () => {
    const failing = new ReefMinis(placements);
    expect(
      await failing.load({
        acquire: () => Promise.reject(Error('offline')),
        evictUnused: () => undefined,
      }),
    ).toBe(false);
    expect(failing.sightings).toHaveLength(0);
    failing.dispose();
    const ok = new ReefMinis(placements),
      fake = fakeLoader();
    await ok.load(fake.loader);
    ok.dispose();
    ok.dispose();
    expect(fake.released).toHaveBeenCalledTimes(1);
    expect(fake.evicted).toHaveBeenCalledWith('reefMinis');
    expect(ok.root.children).toHaveLength(0);
    const late = new ReefMinis(placements),
      slow = fakeLoader(),
      pending = late.load(slow.loader);
    late.dispose();
    expect(await pending).toBe(false);
    expect(slow.released).toHaveBeenCalledTimes(1);
  });
});

describe('outer reef rare miniatures: one model for reef, card and tank', () => {
  const asset = new ReefAsset('public/assets/models/creatures/reef-minis.glb');
  const sizes: Record<string, [number, number]> = {
    Harlequin_Shrimp: [0.04, 0.09],
    Ghost_Pipefish: [0.08, 0.16],
    Hairy_Frogfish: [0.12, 0.22],
    Mimic_Octopus: [0.35, 0.55],
  };
  it.each(Object.values(REEF_MINI_NODES))(
    '%s is to scale, rests at y = 0 and has real strokes',
    (node) => {
      const p = asset.primitive(node).positions,
        lo = [Infinity, Infinity, Infinity],
        hi = [-Infinity, -Infinity, -Infinity];
      for (let i = 0; i < p.length; i++) {
        lo[i % 3] = Math.min(lo[i % 3], p[i]);
        hi[i % 3] = Math.max(hi[i % 3], p[i]);
      }
      const size = Math.max(...hi.map((v, k) => v - lo[k]));
      expect(size).toBeGreaterThan(sizes[node][0]);
      expect(size).toBeLessThan(sizes[node][1]);
      expect(Math.abs(lo[1])).toBeLessThan(0.006);
      const morphs = asset.morphPositions(node);
      expect(morphs).toHaveLength(node === 'Mimic_Octopus' ? 4 : 2);
      for (const m of morphs) {
        let moved = 0;
        for (let i = 0; i < m.length; i += 3)
          moved = Math.max(moved, Math.hypot(m[i], m[i + 1], m[i + 2]));
        expect(moved).toBeGreaterThan(size * 0.02);
      }
      expect(asset.primitive(node).indices.length / 3).toBeLessThan(7000);
    },
  );

  it('rests in its own pose by default (no morph weight left on)', () => {
    for (const mesh of asset.doc.meshes as {
      name?: string;
      weights?: number[];
    }[])
      for (const w of mesh.weights ?? []) expect(w).toBe(0);
  });

  it('registers each as a rare Outer Reef card that joins the tank as the same model', () => {
    for (const k of KINDS) {
      const id = IDS[k],
        entry = collectionEntry(id)!;
      expect(entry.section).toBe('outer-reef');
      expect(entry.rarity).toBe('rare');
      expect(entry.discovery).toBe('sighting');
      expect(entry.model).toEqual({
        type: 'asset',
        asset: 'reefMinis',
        nodes: [REEF_MINI_NODES[k]],
      });
      const key = id.slice(8);
      expect(entry.tank).toEqual({ slot: 'animal', key });
      const baby = babyDefinition(key as never);
      expect(baby.asset).toBe('reefMinis');
      expect(baby.nodes).toEqual([REEF_MINI_NODES[k]]);
      expect(SIGHTS.some((s) => s.id === id)).toBe(true);
    }
    expect(babyDefinition('ornate-ghost-pipefish').motion).toBe('swim');
    for (const k of [
      'harlequin-shrimp',
      'hairy-frogfish',
      'mimic-octopus',
    ] as const)
      expect(babyDefinition(k).motion).toBe('crawl');
    // The Outer Reef page keeps its earlier slots in order; the four follow.
    expect(
      COLLECTION.filter((e) => e.section === 'outer-reef')
        .slice(-4)
        .map((e) => e.id),
    ).toEqual(KINDS.map((k) => IDS[k]));
    expect(BABY_CAP).toBe(TANK_BABIES.length);
  });
});
