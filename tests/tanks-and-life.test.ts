import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { CAVE, KELP, OUTER } from '../src/config/passage';
import type { Vec3 } from '../src/config/world';
import { SEA_LION, SeaLionSwimmer } from '../src/creatures/seaLion';
import { CaveLobsters, LOBSTER } from '../src/environment/cave/CaveLobsters';
import {
  chamberDepth,
  wallDistance,
} from '../src/environment/cave/CaveTerrain';
import {
  KelpEnvironment,
  wallRockLayout,
} from '../src/environment/kelp/KelpEnvironment';
import {
  stalkPlacements,
  wallStalkPlacements,
} from '../src/environment/kelp/KelpStalks';
import { kelpFloor } from '../src/environment/kelp/KelpTerrain';
import {
  OUTER_CRUISERS,
  outerCruisers,
  reefObstacles,
} from '../src/environment/outer/OuterCreatures';
import { outerReefLayout } from '../src/environment/outer/OuterReefLayout';
import { OUTER_SCHOOLS } from '../src/environment/outer/OuterSchools';
import { LANES, PassingLanes } from '../src/environment/outer/PassingLanes';
import { WALL_VISITORS } from '../src/environment/outer/WallVisitors';
import { WALL_VISITOR_IDS } from '../src/config/visitors';
import type { PlayerPresence } from '../src/fish/FishDiverReaction';
import {
  ColliderGrid,
  TerrainCollisionWorld,
} from '../src/player/terrainCollision';
import {
  createSwimState,
  integrateSwimming,
  type SwimTuning,
} from '../src/player/swimming';
import { easeInKelp } from '../src/environment/kelp/KelpTerrain';

const v = (x: number, y: number, z: number): Vec3 => ({ x, y, z });
const tuning: SwimTuning = {
  speed: 1.68,
  feel: 'natural',
  reducedMotion: false,
};
const presence = (p: Vec3, active = true): PlayerPresence => ({
  position: p,
  velocity: v(0, 0, 0),
  active,
});

describe('v0.6 Passes 036–038: the outer reef is a tank', () => {
  it('keeps every reef fish school inside the glass', () => {
    const g = OUTER.glass;
    for (const s of OUTER_SCHOOLS) {
      expect(s.at.z - s.spread.z, s.species).toBeGreaterThan(g.z);
      expect(Math.abs(s.at.x) + s.spread.x, s.species).toBeLessThan(
        g.halfWidth,
      );
    }
  });
  it('passes the big animals close by the glass or far out, always outside it', () => {
    const obstacles = reefObstacles(outerReefLayout().placements),
      groups = [
        OUTER_CRUISERS,
        WALL_VISITOR_IDS.map((id) => WALL_VISITORS[id]),
      ];
    for (const set of groups) {
      const cruisers = outerCruisers(obstacles, set),
        groupOf = set.flatMap((g, i) => g.members.map(() => i)),
        lanes = new PassingLanes(cruisers, groupOf),
        far = v(0, 200, 200);
      let close = 0,
        away = 0;
      // Out of sight for half an hour of simulated time, in 0.5 s steps.
      for (let t = 0; t < 3600; t++) {
        lanes.update(0.5, true, far);
        for (const c of cruisers) {
          c.update(0.5);
          // Its body (and its group's lanes) stay beyond the glass at all times.
          expect(c.position.z + c.species.radius, c.species.id).toBeLessThan(
            OUTER.glass.z,
          );
        }
        for (let i = 0; i < set.length; i++) {
          const lead = cruisers[groupOf.indexOf(i)];
          if (Math.abs(lead.lane - lanes.shiftFor(i, true)) < 1e-9) close++;
          else away++;
        }
      }
      // Both kinds of pass happen.
      expect(close).toBeGreaterThan(0);
      expect(away).toBeGreaterThan(0);
    }
    expect(LANES.close).toBeLessThan(LANES.far);
  });
  it('brings a newly arrived visitor close by the glass on its first pass', () => {
    const obstacles = reefObstacles(outerReefLayout().placements),
      set = WALL_VISITOR_IDS.map((id) => WALL_VISITORS[id]),
      cruisers = outerCruisers(obstacles, set),
      groupOf = set.flatMap((g, i) => g.members.map(() => i)),
      lanes = new PassingLanes(cruisers, groupOf);
    for (let i = 0; i < set.length; i++) {
      lanes.passClose(i);
      expect(cruisers[groupOf.indexOf(i)].lane).toBeCloseTo(
        lanes.shiftFor(i, true),
        9,
      );
    }
  });
});

describe('v0.6 Pass 036: the kelp forest is walled in', () => {
  const env = new KelpEnvironment(),
    world = new TerrainCollisionWorld(
      new ColliderGrid(env.colliders),
      KELP.bounds,
      kelpFloor,
    );
  it('stops the swimmer at its rock walls, sides and far end', () => {
    const w = KELP.walls,
      dir = v(0, 0, 0);
    for (const [dx, dz] of [
      [1, 0],
      [-1, 0],
      [0, -1],
    ]) {
      const s = createSwimState(v(0, 6, -45));
      for (let i = 0; i < 60 * 60; i++) {
        dir.x = dx;
        dir.y = 0;
        dir.z = dz;
        easeInKelp(s.position, dir);
        integrateSwimming(s, dir, 1 / 60, tuning, KELP.bounds, world);
      }
      expect(Math.abs(s.position.x)).toBeLessThan(w.x);
      expect(s.position.z).toBeGreaterThan(w.farZ);
    }
  });
  it('grows its kelp and piles its rocks inside the walls, with a dense band along them', () => {
    const w = KELP.walls,
      wall = wallStalkPlacements();
    expect(wall.length).toBeGreaterThan(100);
    for (const s of [...stalkPlacements(), ...wall]) {
      expect(Math.abs(s.x)).toBeLessThan(w.x);
      expect(s.z).toBeGreaterThan(w.farZ);
    }
    expect(wallRockLayout().length).toBeGreaterThan(30);
  });
  it('disposes once', () => {
    env.dispose();
    env.dispose();
    expect(env.root.children).toHaveLength(0);
  });
});

describe('v0.6 Pass 036: the sea cave is tank-sized and roofed', () => {
  it('is a rounded box about the tank’s size, its roof over the swimmer', () => {
    const c = CAVE.chamber;
    expect(c.rx * 2).toBeGreaterThan(30);
    expect(c.rx * 2).toBeLessThan(40);
    expect(c.rz * 2).toBeLessThan(32);
    // Boxy: the corners reach well beyond an ellipsoid's.
    const corner = v(c.x + c.rx * 0.8, c.y, c.z + c.rz * 0.8);
    expect(chamberDepth(corner)).toBeLessThan(1);
    // A roof about 12 m above the sand, everywhere away from the walls.
    for (const [x, z] of [
      [0, -20],
      [-8, -28],
      [9, -16],
    ]) {
      expect(wallDistance(v(x, 12.4, z))).toBeLessThan(1.6);
      expect(chamberDepth(v(x, 14.5, z))).toBeGreaterThan(1);
    }
  });
});

describe('v0.6 Pass 035: lobsters hide from a close swimmer', () => {
  it('backs into its crack when the swimmer comes near, and creeps out again after', () => {
    const spot = { x: 0, y: 0, z: 0, yaw: 0 },
      l = new CaveLobsters([spot]),
      bodies = l.root.children[0],
      z = () => {
        if (!(bodies instanceof THREE.InstancedMesh)) throw Error('bodies');
        return bodies.instanceMatrix.array[14];
      };
    const out = z();
    for (let i = 0; i < 30; i++)
      l.update(1 / 30, true, false, presence(v(0, 0.5, 1.5)));
    // Retreated along -z (it faces +z out of the crack).
    expect(z()).toBeLessThan(out - LOBSTER.retreat * 0.8);
    for (let i = 0; i < 30 * 8; i++)
      l.update(1 / 30, true, false, presence(v(0, 0.5, 10)));
    expect(z()).toBeCloseTo(out, 3);
    l.dispose();
  });
});

describe('v0.6 Pass 039: the playful sea lion', () => {
  const limits = {
    ground: () => 0,
    top: 18,
    minX: -30,
    maxX: 30,
    minZ: -80,
    maxZ: -12,
  };
  it('comes over, circles the swimmer at a distance, then darts off and rests', () => {
    const lion = new SeaLionSwimmer(limits),
      eye = v(-4, 6, -30),
      moods: string[] = [];
    let closest = Infinity;
    for (let i = 0; i < 10 * 120; i++) {
      lion.update(0.1, presence(eye));
      const p = lion.position;
      if (moods[moods.length - 1] !== lion.mood) moods.push(lion.mood);
      closest = Math.min(
        closest,
        Math.hypot(p.x - eye.x, p.y - eye.y, p.z - eye.z),
      );
      // Always within the forest's limits.
      expect(p.y).toBeGreaterThanOrEqual(1.1 - 1e-9);
      expect(p.y).toBeLessThanOrEqual(limits.top + 1e-9);
      expect(Math.abs(p.x)).toBeLessThanOrEqual(30 + 1e-9);
    }
    // It starts within notice range, so it comes straight over.
    expect(moods.slice(0, 4)).toEqual(['approach', 'play', 'leave', 'roam']);
    expect(closest).toBeGreaterThanOrEqual(SEA_LION.personal - 1e-9);
  });
  it('ignores a swimmer who is not playing, and never rolls with reduced motion', () => {
    const lion = new SeaLionSwimmer(limits),
      eye = v(-4, 6, -30);
    for (let i = 0; i < 600; i++) lion.update(0.1, presence(eye, false));
    expect(lion.mood).toBe('roam');
    const calm = new SeaLionSwimmer(limits);
    let roll = 0;
    for (let i = 0; i < 600; i++) {
      calm.update(0.1, presence(eye), true);
      roll = Math.max(roll, Math.abs(calm.roll));
    }
    expect(roll).toBe(0);
  });
});
