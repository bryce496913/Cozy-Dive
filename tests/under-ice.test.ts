import { describe, expect, it } from 'vitest';
import { CAVE, ICE, ICE_FRAME, ICE_GATE_FRAME } from '../src/config/passage';
import type { Vec3 } from '../src/config/world';
import { backMouthZ } from '../src/environment/cave/CaveEnvironment';
import { IceEnvironment } from '../src/environment/ice/IceEnvironment';
import { IceGarden } from '../src/environment/ice/IceGarden';
import { easeInIce, iceFloor } from '../src/environment/ice/IceTerrain';
import { crossing, mapPoint, passageDarkness } from '../src/player/passage';
import {
  ColliderGrid,
  TerrainCollisionWorld,
} from '../src/player/terrainCollision';
import {
  createSwimState,
  integrateSwimming,
  type SwimTuning,
} from '../src/player/swimming';
import { ICE_SIGHTS, SIGHTS, sightLabel } from '../src/discovery/sights';

const v = (x: number, y: number, z: number): Vec3 => ({ x, y, z });
const tuning: SwimTuning = {
  speed: 1.68,
  feel: 'natural',
  reducedMotion: false,
};

describe('v0.6 Pass 046: the way under the ice', () => {
  it('opens a back tunnel in the cave, behind its back wall', () => {
    const b = CAVE.backTunnel;
    expect(backMouthZ()).toBeGreaterThan(b.endZ);
    expect(backMouthZ()).toBeLessThan(CAVE.chamber.z - CAVE.chamber.rz + 2);
  });
  it('crosses from the cave to the ice past the back threshold (only once the ice is ready)', () => {
    const b = CAVE.backTunnel,
      past = v(b.x, b.y, b.endZ - 0.2),
      before = v(b.x, b.y, b.endZ + 0.2);
    expect(
      crossing('cave', past, {
        outer: true,
        kelp: true,
        cave: true,
        ice: false,
      }),
    ).toBeNull();
    expect(
      crossing('cave', before, {
        outer: true,
        kelp: true,
        cave: true,
        ice: true,
      }),
    ).toBeNull();
    const c = crossing('cave', past, {
      outer: true,
      kelp: true,
      cave: true,
      ice: true,
    });
    expect(c?.target).toBe('ice');
    // Lands just inside the ice tunnel, the same distance past its start.
    const out = mapPoint(past, ICE_GATE_FRAME, ICE_FRAME, v(0, 0, 0));
    expect(out.z).toBeCloseTo(-0.2, 6);
    expect(out.y).toBeCloseTo(ICE.tunnel.y, 6);
    // And back again, out of the ice tunnel's start.
    const back = crossing('ice', v(0, ICE.tunnel.y, 0.2), {
      outer: true,
      kelp: true,
    });
    expect(back?.target).toBe('cave');
    // Darkest at each threshold.
    expect(passageDarkness('cave', v(b.x, b.y, b.endZ))).toBeGreaterThan(0.9);
    expect(passageDarkness('ice', v(0, ICE.tunnel.y, 0))).toBeGreaterThan(0.9);
    expect(passageDarkness('ice', v(0, 5, -30))).toBe(0);
  });
});

describe('v0.6 Pass 046: the waters under the ice', () => {
  const env = new IceEnvironment(),
    world = new TerrainCollisionWorld(
      new ColliderGrid(env.colliders),
      ICE.bounds,
      iceFloor,
    );
  it('is a tank the size of the kelp forest: icebergs at the sides and far end, ice above', () => {
    expect(ICE.walls.x * 2).toBe(48);
    expect(ICE.walls.farZ).toBe(-60);
    expect(ICE.holes.length).toBeGreaterThanOrEqual(3);
  });
  it('stops the swimmer short of the icebergs, the far end and the ice', () => {
    for (const [dx, dy, dz] of [
      [1, 0, 0],
      [-1, 0, 0],
      [0, 0, -1],
      [0, 1, 0],
    ]) {
      const s = createSwimState(v(0, 6, -30)),
        dir = v(0, 0, 0);
      for (let i = 0; i < 60 * 60; i++) {
        dir.x = dx;
        dir.y = dy;
        dir.z = dz;
        easeInIce(s.position, dir);
        integrateSwimming(s, dir, 1 / 60, tuning, ICE.bounds, world);
      }
      expect(Math.abs(s.position.x)).toBeLessThan(ICE.walls.x - 0.5);
      expect(s.position.z).toBeGreaterThan(ICE.walls.farZ + 0.5);
      expect(s.position.y).toBeLessThan(ICE.ceiling - 0.5);
    }
  });
  it('swims out of the tunnel into the tank', () => {
    const s = createSwimState(v(0, ICE.tunnel.y, -0.5)),
      dir = v(0, 0, 0);
    for (let i = 0; i < 60 * 20; i++) {
      dir.x = 0;
      dir.y = 0;
      dir.z = -1;
      easeInIce(s.position, dir);
      integrateSwimming(s, dir, 1 / 60, tuning, ICE.bounds, world);
    }
    expect(s.position.z).toBeLessThan(ICE.tunnel.wallZ - 3);
  });
  it('grows its garden on the seabed, and names its sights', () => {
    const g = new IceGarden(env.stones);
    for (const kind of [
      'sponge',
      'coral',
      'anemone',
      'star',
      'feather',
    ] as const)
      expect(g.spots[kind].length).toBeGreaterThan(0);
    for (const s of Object.values(ICE_SIGHTS))
      expect(sightLabel(s.id)).toBe(s.label);
    expect(new Set(SIGHTS.map((s) => s.id)).size).toBe(SIGHTS.length);
    g.dispose();
    g.dispose();
  });
  it('disposes once', () => {
    env.dispose();
    env.dispose();
    expect(env.root.children).toHaveLength(0);
  });
});
