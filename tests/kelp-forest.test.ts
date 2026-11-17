import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { unlockedItems } from '../src/catalog/catalog';
import {
  CLEFT_FRAME,
  CREVICE,
  CREVICE_FRAME,
  KELP,
  KELP_FRAME,
  cleftFromTank,
} from '../src/config/passage';
import { CRUISE_SPECIES } from '../src/config/creatures';
import type { Vec3 } from '../src/config/world';
import { SIGHTS, sightLabel } from '../src/discovery/sights';
import { outerCruisers } from '../src/environment/outer/OuterCreatures';
import {
  KelpEnvironment,
  boulderLayout,
} from '../src/environment/kelp/KelpEnvironment';
import {
  KELP_CRUISERS,
  KELP_LIFE,
  kelpObstacles,
  kelpSpecies,
} from '../src/environment/kelp/KelpLife';
import {
  KelpStalks,
  STALKS,
  stalkPlacements,
} from '../src/environment/kelp/KelpStalks';
import {
  easeInKelp,
  kelpFloor,
  laneWeight,
} from '../src/environment/kelp/KelpTerrain';
import { FISH_SPECIES, fishPopulation } from '../src/fish/FishSpecies';
import { mapPoint } from '../src/player/passage';
import {
  ColliderGrid,
  TerrainCollisionWorld,
} from '../src/player/terrainCollision';
import {
  createSwimState,
  integrateSwimming,
  type SwimTuning,
} from '../src/player/swimming';

const tuning: SwimTuning = {
  speed: 1.68,
  feel: 'natural',
  reducedMotion: false,
};
const v = (x: number, y: number, z: number): Vec3 => ({ x, y, z });

describe('Pass 032 kelp forest: the way in', () => {
  const env = new KelpEnvironment(),
    world = new TerrainCollisionWorld(
      new ColliderGrid(env.colliders),
      KELP.bounds,
      kelpFloor,
    ),
    blocked = (p: Vec3) =>
      world.colliders.some((c) => world.contains(c, p.x, p.y, p.z));
  it('maps every point you can reach near the cleft threshold into open tunnel', () => {
    for (const dx of [0.3, 0, -0.6, -0.9])
      for (const dy of [-0.72, 0, 0.72])
        for (const dz of [-0.67, 0, 0.67]) {
          const inCleft = cleftFromTank(
              v(
                CREVICE_FRAME.origin.x + dx,
                CREVICE.centre.y + dy,
                CREVICE.centre.z + dz,
              ),
              v(0, 0, 0),
            ),
            q = mapPoint(inCleft, CLEFT_FRAME, KELP_FRAME, v(0, 0, 0));
          expect(blocked(q), JSON.stringify(q)).toBe(false);
          expect(q.y).toBeGreaterThan(kelpFloor(q.x, q.z) + 0.5);
        }
  });
  it('can be swum from the tunnel start out into the forest, and is sealed', () => {
    const s = createSwimState({ ...KELP_FRAME.origin });
    for (let i = 0; i < 60 * 20 && s.position.z > KELP.tunnel.wallZ - 4; i++)
      integrateSwimming(s, v(0, 0, -1), 1 / 60, tuning, KELP.bounds, world);
    expect(s.position.z).toBeLessThan(KELP.tunnel.wallZ - 3);
    // Pushing into the tunnel's walls from inside keeps the swimmer within it.
    for (const dir of [
      v(1, 0, 0),
      v(-1, 0, 0),
      v(0, 1, 0),
      v(0, -1, 0),
      v(0, 0, 1),
    ]) {
      const e = createSwimState(v(0, KELP.tunnel.y, -3));
      for (let i = 0; i < 60 * 8; i++)
        integrateSwimming(e, dir, 1 / 60, tuning, KELP.bounds, world);
      expect(
        Math.hypot(e.position.x, e.position.y - KELP.tunnel.y),
      ).toBeLessThan(KELP.tunnel.radius);
      expect(e.position.z).toBeLessThan(KELP.tunnel.startZ + 0.2);
    }
    // The wall is solid away from the tunnel.
    const w = createSwimState(v(12, 6, -14));
    for (let i = 0; i < 60 * 15; i++)
      integrateSwimming(w, v(0, 0, 1), 1 / 60, tuning, KELP.bounds, world);
    expect(w.position.z).toBeLessThan(KELP.tunnel.wallZ);
  });
  it('leaves the tunnel exit and the sandy lane open', () => {
    const bottom = KELP.tunnel.y - KELP.tunnel.radius;
    for (let z = KELP.tunnel.wallZ; z > KELP.tunnel.wallZ - 4; z -= 0.25)
      for (const x of [-1, 0, 1])
        expect(kelpFloor(x, z)).toBeLessThan(bottom - 0.4);
    for (const b of boulderLayout()) {
      expect(laneWeight(b.x, b.z)).toBeLessThan(0.05);
      expect(
        Math.abs(b.x) < STALKS.exitClear.halfWidth &&
          b.z > KELP.tunnel.wallZ - STALKS.exitClear.depth,
      ).toBe(false);
    }
  });
  it('disposes everything it created exactly once', () => {
    const e = new KelpEnvironment(),
      geometries = new Set<THREE.BufferGeometry>(),
      materials = new Set<THREE.Material>();
    e.root.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        geometries.add(o.geometry);
        materials.add(o.material as THREE.Material);
      }
    });
    const spies = [...geometries, ...materials].map((r) =>
      vi.spyOn(r, 'dispose'),
    );
    e.dispose();
    e.dispose();
    for (const s of spies) expect(s).toHaveBeenCalledTimes(1);
    expect(e.root.children).toHaveLength(0);
  });
  env.dispose();
});

describe('Pass 032 kelp forest: the kelp', () => {
  it('grows in groves over the forest floor, off the lane and the tunnel exit (deterministic)', () => {
    const a = stalkPlacements(),
      b = stalkPlacements();
    expect(a).toEqual(b);
    expect(a.length).toBe(STALKS.count);
    for (const s of a) {
      expect(laneWeight(s.x, s.z)).toBeLessThanOrEqual(0.05);
      expect(s.z).toBeLessThan(KELP.forest.maxZ + 1e-9);
      expect(
        Math.abs(s.x) < STALKS.exitClear.halfWidth &&
          s.z > KELP.tunnel.wallZ - STALKS.exitClear.depth,
      ).toBe(false);
      expect(s.y).toBeLessThanOrEqual(kelpFloor(s.x, s.z));
    }
  });
  it('sways on simulation time only: still while paused and with reduced motion', () => {
    const k = new KelpStalks();
    try {
      k.update(1 / 60, true, false);
      const t = k.swayTime;
      expect(t).toBeGreaterThan(0);
      k.update(1, false, false);
      k.update(1, true, true);
      k.update(Number.NaN, true, false);
      expect(k.swayTime).toBe(t);
      // Three templates, one draw each.
      expect(k.root.children).toHaveLength(STALKS.heights.length);
    } finally {
      k.dispose();
    }
  });
});

describe('Pass 032 kelp forest: life and discovery', () => {
  const boulders = boulderLayout();
  it('keeps garibaldi out of the tank: their own species, never in its population', () => {
    const species = kelpSpecies(boulders);
    expect(species).toHaveLength(KELP_LIFE.groups);
    for (const s of species) {
      expect(s.id).toBe('garibaldi');
      expect(s.count).toBe(KELP_LIFE.perGroup);
      expect(s.schooling.enabled).toBe(false);
      expect(s.region.y).toBeGreaterThan(kelpFloor(s.region.x, s.region.z));
    }
    expect(FISH_SPECIES.some((f) => f.id === 'garibaldi')).toBe(false);
    expect(fishPopulation('home').some((f) => f.id === 'garibaldi')).toBe(
      false,
    );
  });
  it('routes the bat rays along the lane, lifted clear of the seabed and boulders', () => {
    const obstacles = kelpObstacles(boulders),
      cruisers = outerCruisers(obstacles, KELP_CRUISERS);
    // v0.6 Pass 044: four bat rays and three leopard sharks.
    expect(cruisers).toHaveLength(7);
    for (const c of cruisers) {
      expect(['bat-ray', 'leopard-shark']).toContain(c.species.id);
      for (let i = 0; i < 400; i++) {
        c.update(0.5, undefined, false);
        const p = c.position;
        expect(p.y).toBeGreaterThan(obstacles(p.x, p.z, 0.5) + 0.3);
        expect(p.z).toBeLessThan(KELP.tunnel.wallZ);
      }
    }
    expect(CRUISE_SPECIES['bat-ray'].asset).toBe('eagleRay');
  });
  it('names its sights, and seeing the kelp unlocks a kelp stand for the tank', () => {
    expect(sightLabel('species:garibaldi')).toBe('Garibaldi');
    expect(sightLabel('plant:giant-kelp')).toBe('Giant kelp');
    expect(sightLabel('species:bat-ray')).toBe('Bat ray');
    expect(new Set(SIGHTS.map((s) => s.id)).size).toBe(SIGHTS.length);
    const seen = [
      { id: 'plant:giant-kelp', first: '2026-11-14T00:00:00.000Z' },
    ];
    expect(unlockedItems(seen).map((i) => i.kind)).toEqual(['kelp']);
  });
  it('eases swimming to a hover at its edges, as the outer waters do', () => {
    const r = KELP.reach,
      out = easeInKelp(v(0, 5, r.far - r.past - 3), v(0, 0, -1));
    expect(out.z).toBeCloseTo(0, 12);
    const inside = easeInKelp(v(0, 5, -30), v(0, 0, -1));
    expect(inside.z).toBe(-1);
    const up = easeInKelp(v(0, r.up + r.rise + 3, -30), v(0, 1, 0));
    expect(up.y).toBeCloseTo(0, 12);
  });
});
