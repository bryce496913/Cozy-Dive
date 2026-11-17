import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { CAVE, KELP, OUTER } from '../src/config/passage';
import type { Vec3 } from '../src/config/world';
import { BARRACUDA, BarracudaVisit } from '../src/creatures/barracuda';
import {
  GULL,
  GullDive,
  RareCruise,
  SEA_BASS,
  SEAL,
  SeaOtter,
  ShySeal,
} from '../src/creatures/kelpEncounters';
import { OctopusMind } from '../src/creatures/octopus';
import {
  blinkOn,
  CleaningVisit,
  LionfishFan,
  SleepingTurtle,
} from '../src/creatures/caveEncounters';
import {
  caveNooks,
  ledgeColliders,
  nooksClear,
} from '../src/environment/cave/CaveNooks';
import { KelpCritters } from '../src/environment/kelp/KelpCritters';
import { KELP_CRUISERS } from '../src/environment/kelp/KelpLife';
import {
  CleaningEncounter,
  CuriousWrasse,
  GREAT_WHITE,
  ParrotGrazers,
  RarePass,
  WRASSE,
} from '../src/creatures/reefEncounters';
import { createPose } from '../src/environment/outer/PosedFish';
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
  PASSING_DEEPEST,
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

describe('v0.6 Pass 042: barracuda circling out in the blue', () => {
  it('comes now and then from out of sight, circles beyond the glass, then leaves', () => {
    const visit = new BarracudaVisit(),
      pose = { x: 0, y: 0, z: 0, yaw: 0, effort: 0 },
      states = new Set<string>();
    let circled = 0;
    // An hour of simulated time in 0.1 s steps.
    for (let t = 0; t < 36000; t++) {
      visit.update(0.1);
      states.add(visit.state);
      if (visit.state === 'circling') circled++;
      if (visit.state === 'away')
        expect(visit.centre.z).toBeCloseTo(BarracudaVisit.hiddenZ(), 6);
      if (t % 50 === 0)
        for (let i = 0; i < BARRACUDA.count; i += 7) {
          visit.pose(i, pose);
          // Always beyond the glass, every fish.
          expect(pose.z).toBeLessThan(OUTER.glass.z - 2);
          expect(Math.abs(pose.x)).toBeLessThan(OUTER.glass.halfWidth);
        }
    }
    expect([...states].sort()).toEqual([
      'arriving',
      'away',
      'circling',
      'leaving',
    ]);
    // A small chance: it is not there most of the time.
    expect(circled / 36000).toBeLessThan(0.5);
    expect(circled).toBeGreaterThan(0);
  });
  it('is away when the swimmer arrives, deep in the haze', () => {
    const visit = new BarracudaVisit(7);
    visit.come();
    visit.arrive();
    expect(visit.present).toBe(false);
    expect(OUTER.glass.z - visit.centre.z).toBeGreaterThanOrEqual(30);
  });
  it('brings the far passes a little closer than before', () => {
    expect(LANES.far).toBeLessThan(9);
    expect(LANES.far).toBeGreaterThan(LANES.close + 3);
  });
});

describe('v0.6 Pass 043: the outer reef’s newer life', () => {
  it('passes every big animal within sight of the swimmer (no deeper than the limit)', () => {
    for (const g of [
      ...OUTER_CRUISERS,
      ...WALL_VISITOR_IDS.map((id) => WALL_VISITORS[id]),
    ]) {
      const low = Math.min(...g.members.map((m) => m.up));
      for (const w of g.waypoints)
        expect(w.y + low, g.species).toBeGreaterThanOrEqual(PASSING_DEEPEST);
    }
  });
  it('keeps the new reef schools inside the glass', () => {
    for (const s of OUTER_SCHOOLS) {
      expect(s.at.z - s.spread.z, s.species).toBeGreaterThan(OUTER.glass.z);
      expect(Math.abs(s.at.x) + s.spread.x).toBeLessThan(OUTER.glass.halfWidth);
    }
    expect(
      OUTER_SCHOOLS.filter((s) => s.species === 'moorish-idol').every(
        (s) => s.count === 2,
      ),
    ).toBe(true);
  });
  it('grazes coral to coral, biting each a few times', () => {
    const corals = [v(0, 1, -40), v(3, 1.2, -42), v(-2, 0.8, -44)],
      g = new ParrotGrazers(corals, createPose);
    let bites = 0;
    for (let i = 0; i < 60 * 30; i++) {
      g.update(1 / 30);
      bites += g.bitCount;
      for (const p of g.poses) expect(p.position.y).toBeGreaterThan(0.5);
    }
    expect(bites).toBeGreaterThan(10);
  });
  it('the wrasse comes for a look, never closer than it means to, then leaves', () => {
    const w = new CuriousWrasse(createPose(), {
        ground: () => 0,
        minX: -27,
        maxX: 27,
        minZ: -57,
        maxZ: -35,
        top: 11,
      }),
      eye = v(0, 4, -45),
      moods = new Set<string>();
    let closest = Infinity;
    for (let i = 0; i < 120 * 10; i++) {
      w.update(0.1, presence(eye));
      moods.add(w.mood);
      const p = w.pose.position;
      closest = Math.min(
        closest,
        Math.hypot(p.x - eye.x, p.y - eye.y, p.z - eye.z),
      );
    }
    expect([...moods]).toEqual(
      expect.arrayContaining(['approach', 'look', 'leave', 'roam']),
    );
    expect(closest).toBeGreaterThan(WRASSE.look - 1);
  });
  it('signals the sunfish by gathering the bannerfish first; cleans it beyond the glass, then it sinks', () => {
    const c = new CleaningEncounter(createPose),
      seen: string[] = [];
    c.begin();
    for (let i = 0; i < 10 * 400; i++) {
      c.update(0.1);
      if (seen[seen.length - 1] !== c.state) seen.push(c.state);
      for (const b of c.bannerfish)
        expect(b.pose.position.z).toBeLessThan(OUTER.glass.z);
      if (c.state === 'cleaning') {
        const s = c.sunfish.pose.position;
        // Close to the glass, within sight.
        expect(OUTER.glass.z - s.z).toBeLessThan(6);
        expect(s.y).toBeGreaterThan(PASSING_DEEPEST);
      }
      if (c.state === 'idle' && seen.length > 1) break;
    }
    expect(seen).toEqual([
      'gathering',
      'rising',
      'cleaning',
      'sinking',
      'idle',
    ]);
  });
  it('is rare: the sunfish comes in well under a fifth of the time', () => {
    const c = new CleaningEncounter(createPose, 99);
    let cleaning = 0;
    for (let i = 0; i < 10 * 3600 * 2; i++) {
      c.update(0.1);
      if (c.state === 'cleaning') cleaning++;
    }
    expect(cleaning / (10 * 3600 * 2)).toBeLessThan(0.2);
  });
  it('passes the great white the length of the glass, close by but outside it', () => {
    const pass = new RarePass(createPose());
    pass.begin();
    let closest = Infinity,
      steps = 0;
    while (pass.passing && steps++ < 20000) {
      pass.update(0.1);
      const p = pass.swim.pose.position;
      expect(p.z + GREAT_WHITE.radius).toBeLessThan(OUTER.glass.z);
      if (Math.abs(p.x) < OUTER.glass.halfWidth)
        closest = Math.min(closest, OUTER.glass.z - p.z);
    }
    expect(pass.passing).toBe(false);
    expect(closest).toBeLessThan(GREAT_WHITE.gap + GREAT_WHITE.radius + 1);
  });
  it('the octopus creeps out, and hides in its den when the swimmer comes close', () => {
    const den = { x: 0, y: 0, z: 0, yaw: 0 },
      o = new OctopusMind(
        den,
        [v(3, 0, 1)],
        () => 0,
        (x) => x > 2,
      );
    for (let i = 0; i < 10 * 60; i++) o.update(0.1, presence(v(0, 3, 30)));
    const moods = new Set<string>();
    for (let i = 0; i < 10 * 60; i++) {
      o.update(0.1, presence(v(o.position.x + 1, 0.5, o.position.z)));
      moods.add(o.mood);
    }
    expect(o.mood).toBe('hidden');
    expect(o.tucked).toBeGreaterThan(0.9);
    for (let i = 0; i < 10 * 30; i++) o.update(0.1, presence(v(0, 3, 30)));
    expect(o.mood).not.toBe('hidden');
  });
});

describe('v0.6 Pass 044: the kelp forest’s newer life', () => {
  const limits = {
    ground: () => 0,
    surface: 22,
    minX: -21,
    maxX: 21,
    minZ: -57,
    maxZ: -11,
  };
  it('floats the otter on its back at the surface, diving for an urchin now and then', () => {
    const o = new SeaOtter(createPose(), limits, [v(-5, 0.3, -32)]),
      moods = new Set<string>();
    for (let i = 0; i < 10 * 200; i++) {
      o.update(0.1);
      moods.add(o.mood);
      expect(o.pose.position.y).toBeLessThan(22);
    }
    expect([...moods]).toEqual(
      expect.arrayContaining(['float', 'dive', 'forage', 'rise']),
    );
  });
  it('keeps the seal at a distance: it watches, and backs off from a swimmer who comes close', () => {
    const s = new ShySeal(createPose(), limits),
      eye = v(4, 8, -38);
    let watched = false;
    for (let i = 0; i < 10 * 120; i++) {
      // The swimmer follows it.
      const p = s.pose.position;
      eye.x += (p.x - eye.x) * 0.002;
      eye.z += (p.z - eye.z) * 0.002;
      s.update(0.1, presence(eye));
      if (s.mood === 'watch') {
        watched = true;
        expect(
          Math.hypot(p.x - eye.x, p.y - eye.y, p.z - eye.z),
        ).toBeGreaterThan(SEAL.shy - 2.5);
      }
    }
    expect(watched).toBe(true);
  });
  it('brings the giant sea bass in from out of sight, slowly past the swimmer, and away', () => {
    const b = new RareCruise(createPose(), limits),
      eye = v(0, 6, -30);
    expect(b.begin(presence(eye))).toBe(true);
    const p = b.swim.pose.position;
    expect(Math.hypot(p.x - eye.x, p.y - eye.y, p.z - eye.z)).toBeGreaterThan(
      SEA_BASS.hidden,
    );
    let closest = Infinity;
    for (let i = 0; i < 10 * 300 && b.present; i++) {
      b.update(0.1, presence(eye));
      closest = Math.min(
        closest,
        Math.hypot(p.x - eye.x, p.y - eye.y, p.z - eye.z),
      );
    }
    expect(closest).toBeLessThan(SEA_BASS.pass + 2);
    expect(closest).toBeGreaterThan(2);
    expect(b.present).toBe(false);
  });
  it('the gull plunges in, pecks at the sand near the swimmer, and flies off', () => {
    const g = new GullDive(createPose(), limits),
      eye = v(0, 6, -30),
      moods: string[] = [];
    let pecks = 0;
    g.begin(eye);
    for (let i = 0; i < 10 * 120; i++) {
      g.update(0.1, presence(eye));
      if (g.pecked) pecks++;
      if (moods[moods.length - 1] !== g.mood) moods.push(g.mood);
      if (!g.present) break;
    }
    expect(moods).toEqual(['plunge', 'down', 'peck', 'up', 'away']);
    expect(pecks).toBeGreaterThanOrEqual(GULL.pecks[0]);
  });
  it('builds the critters and the leopard sharks low over the sand', () => {
    const boulder = { x: 0, y: 0, z: -30, size: 2, height: 1.2, yaw: 0 },
      c = new KelpCritters([boulder], [{ x: 2, y: 0, z: -30 }]);
    for (let i = 0; i < 100; i++)
      c.update(0.1, true, false, presence(v(2, 1, -29)));
    expect(c.sightings.length).toBeGreaterThan(0);
    c.dispose();
    c.dispose();
    const leopards = KELP_CRUISERS.filter((g) => g.species === 'leopard-shark');
    expect(leopards.length).toBeGreaterThan(0);
    for (const g of leopards)
      for (const w of g.waypoints) expect(w.y).toBeLessThan(1);
  });
});

describe('v0.6 Pass 045: the sea cave’s newer life', () => {
  it('puts its nooks inside the cave, clear of the sharks’ places and the pool of light', () => {
    const n = caveNooks(14);
    expect(nooksClear(n)).toBe(true);
    for (const p of [n.turtle.bed, n.nurse.at, n.station.patch, n.moray.mouth])
      expect(wallDistance(p)).toBeGreaterThan(-0.5);
    // The ledge is a roof over the sleeping shark.
    expect(n.ledge.y).toBeGreaterThan(n.nurse.at.y + 0.5);
    expect(ledgeColliders(n).length).toBeGreaterThan(0);
  });
  it('the turtle sleeps, rises to breathe at the hole in the roof, and comes back to its bed', () => {
    const bed = v(10, 0.6, -16),
      air = v(3.5, 13, -27),
      t = new SleepingTurtle(createPose(), bed, 2, air),
      moods: string[] = [];
    t.wake();
    for (let i = 0; i < 10 * 400; i++) {
      t.update(0.1);
      if (moods[moods.length - 1] !== t.mood) moods.push(t.mood);
      if (moods.length > 1 && t.mood === 'asleep') break;
    }
    expect(moods).toEqual(['rising', 'breathing', 'sinking', 'asleep']);
    expect(t.pose.position.x).toBeCloseTo(bed.x, 3);
  });
  it('a soldierfish comes to the cleaners, the shrimps climb on it, and it leaves', () => {
    const c = new CleaningVisit(
        createPose(),
        v(-17, 4, -23.5),
        v(1, 0, 0),
        v(-14, 3.7, -23.5),
      ),
      moods = new Set<string>();
    c.call();
    let onFish = 0;
    for (let i = 0; i < 10 * 60; i++) {
      c.update(0.1);
      moods.add(c.mood);
      if (c.mood === 'cleaning') {
        const p = c.fish.pose.position;
        onFish = Math.max(
          onFish,
          c.shrimps.filter(
            (s) => Math.hypot(s.x - p.x, s.y - p.y, s.z - p.z) < 0.3,
          ).length,
        );
      }
    }
    expect([...moods]).toEqual(
      expect.arrayContaining(['coming', 'cleaning', 'leaving']),
    );
    expect(onFish).toBeGreaterThan(1);
  });
  it('the lionfish fans out at a close swimmer, turned to them, and settles after', () => {
    const l = new LionfishFan(v(0, 1, 0), 0);
    for (let i = 0; i < 30; i++) l.update(0.1, presence(v(2, 1, 0)));
    expect(l.spread).toBeGreaterThan(0.9);
    expect(l.heading).toBeCloseTo(Math.PI / 2, 1);
    for (let i = 0; i < 100; i++) l.update(0.1, presence(v(10, 1, 0)));
    expect(l.spread).toBeLessThan(0.1);
  });
  it('the flashlight fish’s lights are mostly lit, shuttered now and then', () => {
    let lit = 0;
    for (let t = 0; t < 100; t += 0.05) if (blinkOn(3, t)) lit++;
    expect(lit / 2000).toBeGreaterThan(0.8);
    expect(lit).toBeLessThan(2000);
  });
});
