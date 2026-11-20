import { describe, expect, it } from 'vitest';
import { unlockedItems } from '../src/catalog/catalog';
import {
  CAVE,
  CAVE_FRAME,
  CREVICE,
  CREVICE_FRAME,
  GROTTO_FRAME,
  KELP,
  PASSAGE,
  grottoFromTank,
} from '../src/config/passage';
import type { Vec3 } from '../src/config/world';
import { sightLabel } from '../src/discovery/sights';
import { CaveEnvironment } from '../src/environment/cave/CaveEnvironment';
import {
  caveFloor,
  easeInCave,
  wallDistance,
} from '../src/environment/cave/CaveTerrain';
import { crossing, mapPoint } from '../src/player/passage';
import {
  ColliderGrid,
  TerrainCollisionWorld,
} from '../src/player/terrainCollision';
import {
  createSwimState,
  integrateSwimming,
  type SwimTuning,
} from '../src/player/swimming';

const v = (x: number, y: number, z: number): Vec3 => ({ x, y, z });
const tuning: SwimTuning = {
  speed: 1.68,
  feel: 'natural',
  reducedMotion: false,
};
/** A point in the grotto, as an offset from the crevice threshold (tank coordinates). */
const grottoAt = (dx: number, dy = 0, dz = 0): Vec3 =>
  grottoFromTank(
    v(
      CREVICE_FRAME.origin.x + dx,
      CREVICE.centre.y + dy,
      CREVICE.centre.z + dz,
    ),
    v(0, 0, 0),
  );
const ready = { outer: true, kelp: true, cave: true };

describe('Pass 034 the sea cave', () => {
  const env = new CaveEnvironment(),
    world = new TerrainCollisionWorld(
      new ColliderGrid(env.colliders),
      CAVE.bounds,
      caveFloor,
    );
  it('is reached through the grotto past its threshold, once ready, and left the same way', () => {
    const past = grottoAt(-PASSAGE.hysteresis * 2);
    expect(crossing('kelp', past, ready)?.target).toBe('cave');
    expect(crossing('kelp', past, { ...ready, cave: false })).toBeNull();
    expect(crossing('kelp', grottoAt(PASSAGE.hysteresis), ready)).toBeNull();
    // The kelp forest's own tunnel still leads back to the outer reef.
    expect(
      crossing('kelp', v(0, KELP.tunnel.y, PASSAGE.hysteresis * 2), ready)
        ?.target,
    ).toBe('outer');
    // The threshold maps onto the cave tunnel's start; backing out returns to the grotto.
    const o = mapPoint(
      GROTTO_FRAME.origin,
      GROTTO_FRAME,
      CAVE_FRAME,
      v(0, 0, 0),
    );
    expect(o.x).toBeCloseTo(CAVE_FRAME.origin.x, 9);
    expect(o.y).toBeCloseTo(CAVE_FRAME.origin.y, 9);
    expect(o.z).toBeCloseTo(CAVE_FRAME.origin.z, 9);
    expect(
      crossing('cave', v(0, CAVE.tunnel.y, PASSAGE.hysteresis * 2), ready)
        ?.target,
    ).toBe('kelp');
    expect(crossing('cave', v(0, CAVE.tunnel.y, -2), ready)).toBeNull();
  });
  it('can be swum from the tunnel into the cavern, and its walls stop the swimmer short of the rock', () => {
    const s = createSwimState({ ...CAVE_FRAME.origin }),
      dir = v(0, 0, 0);
    for (let i = 0; i < 60 * 20; i++) {
      dir.x = 0;
      dir.y = 0;
      dir.z = -1;
      easeInCave(s.position, dir);
      integrateSwimming(s, dir, 1 / 60, tuning, CAVE.bounds, world);
    }
    expect(s.position.z).toBeLessThan(CAVE.chamber.z);
    // Pushing at the walls and roof in every direction from the middle never reaches the rock.
    for (const [x, y, z] of [
      [1, 0, 0],
      [-1, 0, 0],
      [0, 1, 0],
      [0, 0, -1],
      [0.7, 0.7, 0],
      [-0.6, 0.5, -0.6],
    ]) {
      const e = createSwimState(v(0, 4, -25));
      for (let i = 0; i < 60 * 30; i++) {
        dir.x = x;
        dir.y = y;
        dir.z = z;
        easeInCave(e.position, dir);
        integrateSwimming(e, dir, 1 / 60, tuning, CAVE.bounds, world);
      }
      expect(wallDistance(e.position), `${x},${y},${z}`).toBeGreaterThan(0.4);
    }
  });
  it('names its sights, and seeing it unlocks a limestone arch for the tank', () => {
    expect(sightLabel('place:sea-cave')).toBe('Sea cave');
    expect(sightLabel('species:spiny-lobster')).toBe('Spiny lobster');
    expect(sightLabel('species:glassy-sweeper')).toBe('Glassy sweeper');
    expect(sightLabel('species:whitetip-reef-shark')).toBe(
      'Whitetip reef shark',
    );
    expect(
      unlockedItems([{ id: 'place:sea-cave', first: '2026-11-15T00:00:00Z' }])
        // Pass 051: beside the tank's own starters, which need no sighting.
        .filter((i) => i.sighting)
        .map((i) => i.kind),
    ).toEqual(['arch']);
    env.dispose();
  });
});

describe('the way home from the sea cave (playtest fix)', () => {
  it('swims from the cavern up the front tunnel and over its threshold', async () => {
    const { ColliderGrid, TerrainCollisionWorld } =
      await import('../src/player/terrainCollision');
    const { CAVE } = await import('../src/config/passage');
    const { easeInCave } = await import('../src/environment/cave/CaveTerrain');
    const env = new CaveEnvironment(),
      world = new TerrainCollisionWorld(
        new ColliderGrid(env.colliders),
        CAVE.bounds,
        caveFloor,
      ),
      state = {
        position: { x: 0.5, y: CAVE.tunnel.y - 0.3, z: CAVE.tunnel.openZ - 7 },
        velocity: { x: 0, y: 0, z: 0 },
      };
    let target: string | undefined;
    for (let i = 0; i < 600 && !target; i++) {
      const p = state.position,
        from = { ...p },
        dir = { x: -p.x * 0.3, y: (CAVE.tunnel.y - p.y) * 0.3, z: 1 },
        l = Math.hypot(dir.x, dir.y, dir.z);
      dir.x /= l;
      dir.y /= l;
      dir.z /= l;
      easeInCave(p, dir);
      p.x += dir.x * 0.08;
      p.y += dir.y * 0.08;
      p.z += dir.z * 0.08;
      world.move(state, from.x, from.y, from.z);
      target = crossing('cave', p, {
        outer: true,
        kelp: true,
        cave: true,
      })?.target;
    }
    expect(target).toBe('kelp');
    env.dispose();
  });
});
