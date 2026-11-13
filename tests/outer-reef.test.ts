import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { OUTER } from '../src/config/passage';
import type { Vec3 } from '../src/config/world';
import { boxCollider } from '../src/environment/passage/Crevice';
import { LevelInstances } from '../src/environment/outer/LevelInstances';
import {
  hullTop,
  placementMatrix,
  seatOnRocks,
} from '../src/environment/outer/OuterReef';
import {
  OUTER_REEF,
  ROCK_HALF,
  buildable,
  outerReefLayout,
} from '../src/environment/outer/OuterReefLayout';
import {
  OUTER_SCHOOLS,
  outerInterests,
  outerSpecies,
} from '../src/environment/outer/OuterSchools';
import {
  channelCentre,
  channelWeight,
  dropWeight,
  easeAtEdges,
  easeFactor,
  seabedHeight,
} from '../src/environment/outer/OuterTerrain';
import { reefObstacles } from '../src/environment/outer/OuterCreatures';
import { WATER_LIGHT, depthShade } from '../src/environment/outer/WaterDome';
import { spawnFish } from '../src/fish/FishSpawner';
import { FishSimulation } from '../src/fish/FishMovement';
import { safeFishPosition } from '../src/fish/FishHabitat';
import type { ConvexCollider } from '../src/player/collision';
import { createSwimState, integrateSwimming } from '../src/player/swimming';
import {
  ColliderGrid,
  TerrainCollisionWorld,
} from '../src/player/terrainCollision';

const v = (x: number, y: number, z: number): Vec3 => ({ x, y, z });

describe('Pass 026 outer seabed and edges', () => {
  it('has a sand gully, a reef top near the sand level and a wall falling into the deep', () => {
    // The gully is lower than the reef beside it, from the cliff to the lip.
    for (let z = OUTER.cliffZ - 4; z > OUTER.dropOff.start; z -= 4) {
      const c = channelCentre(z);
      expect(channelWeight(c, z)).toBeCloseTo(1, 6);
      expect(seabedHeight(c, z)).toBeLessThan(seabedHeight(c + 6, z));
    }
    // The reef top stays within a metre or two of the sand level.
    for (let x = -36; x <= 36; x += 6)
      for (let z = OUTER.cliffZ - 2; z > OUTER.dropOff.start; z -= 4) {
        expect(seabedHeight(x, z)).toBeGreaterThan(OUTER.floorY - 2);
        expect(seabedHeight(x, z)).toBeLessThan(OUTER.floorY + 2.5);
      }
    // The lip is close to the tunnel, and the wall below it is steep and deep.
    expect(OUTER.cliffZ - OUTER.dropOff.start).toBeLessThanOrEqual(30);
    expect(dropWeight(OUTER.dropOff.start + 1)).toBe(0);
    expect(dropWeight(OUTER.dropOff.end - 1)).toBe(1);
    const fall =
      seabedHeight(0, OUTER.dropOff.start + 1) -
      seabedHeight(0, OUTER.dropOff.end - 1);
    expect(fall).toBeGreaterThan(OUTER.dropOff.depth - 2);
    expect(
      fall / (OUTER.dropOff.start - OUTER.dropOff.end + 2),
    ).toBeGreaterThan(3);
    // Beyond the wall's foot the bottom keeps falling away, out of reach.
    expect(seabedHeight(0, OUTER.dropOff.end - 40)).toBeLessThan(
      seabedHeight(0, OUTER.dropOff.end - 2) - 10,
    );
  });
  it('slows outward swimming to a hover near every edge, and leaves the rest alone', () => {
    const r = OUTER.reach,
      lip = OUTER.dropOff.start;
    const eased = (p: Vec3, d: Vec3) => easeAtEdges(p, { ...d });
    // Inside the reach nothing changes, in any direction.
    for (const d of [
      v(1, 0, 0),
      v(-1, 0, 0),
      v(0, 1, 0),
      v(0, -1, 0),
      v(0, 0, -1),
    ])
      expect(eased(v(0, 3, -45), d)).toEqual(d);
    // Out over the blue: slower the further past the lip, then stopped.
    let previous = 1;
    for (let past = 0; past <= r.past + r.stop + 1; past += 0.5) {
      const k = -eased(v(0, 0, lip - past), v(0, 0, -1)).z;
      expect(k).toBeLessThanOrEqual(previous + 1e-12);
      previous = k;
    }
    expect(-eased(v(0, 0, lip - r.past), v(0, 0, -1)).z).toBeCloseTo(
      r.crawl,
      9,
    );
    expect(eased(v(0, 0, lip - r.past - r.stop), v(0, 0, -1)).z).toBeCloseTo(
      0,
      9,
    );
    // Swimming back towards the reef is never slowed.
    expect(eased(v(0, 0, lip - r.past - r.stop), v(0, 0, 1)).z).toBe(1);
    // Down the wall, up high and at both sides alike.
    expect(
      eased(v(0, r.down - r.depth - r.stop, -60), v(0, -1, 0)).y,
    ).toBeCloseTo(0, 9);
    expect(eased(v(0, r.down - r.depth - r.stop, -60), v(0, 1, 0)).y).toBe(1);
    expect(eased(v(0, r.up + r.rise + r.stop, -45), v(0, 1, 0)).y).toBeCloseTo(
      0,
      9,
    );
    for (const side of [-1, 1]) {
      const x = side * (r.halfWidth + r.side + r.stop);
      expect(eased(v(x, 3, -45), v(side, 0, 0)).x).toBeCloseTo(0, 9);
      expect(eased(v(x, 3, -45), v(-side, 0, 0)).x).toBe(-side);
    }
    // A little way out over the blue (5-8 m past the lip) before it all but stops.
    expect(r.past).toBeGreaterThanOrEqual(5);
    expect(r.past).toBeLessThanOrEqual(8);
    expect(easeFactor(-1, 3)).toBe(1);
  });
  it('fades into darker blue with depth', () => {
    expect(depthShade(WATER_LIGHT.from + 1)).toBe(0);
    expect(depthShade(WATER_LIGHT.to - 1)).toBe(1);
    let previous = 0;
    for (let y = WATER_LIGHT.from; y >= WATER_LIGHT.to; y -= 1) {
      expect(depthShade(y)).toBeGreaterThanOrEqual(previous);
      previous = depthShade(y);
    }
  });
});

describe('Pass 024/026 reef layout', () => {
  const layout = outerReefLayout();
  it('is deterministic and dresses the reef generously', () => {
    expect(outerReefLayout()).toEqual(layout);
    const count = (f: string) =>
      layout.placements.filter((p) => p.family === f).length;
    expect(layout.heads).toHaveLength(OUTER_REEF.heads);
    // Pass 026: a dense reef top, little bare sand, and fans down the wall.
    expect(count('rock')).toBeGreaterThan(150);
    expect(
      count('massive') + count('branching') + count('plate'),
    ).toBeGreaterThan(200);
    expect(count('soft') + count('fan')).toBeGreaterThan(120);
    expect(count('blade') + count('grass')).toBeGreaterThan(80);
    const onWall = layout.placements.filter(
      (p) =>
        (p.family === 'fan' || p.family === 'soft') &&
        p.position.z < OUTER.dropOff.start - 0.5,
    );
    expect(onWall.length).toBeGreaterThan(20);
  });
  it('keeps bommies apart, off the gully, clear of the tunnel mouth and inside the reef', () => {
    for (const h of layout.heads) {
      expect(buildable(h.x, h.z, 2.5)).toBe(true);
      expect(h.y).toBeCloseTo(seabedHeight(h.x, h.z), 9);
      for (const o of layout.heads)
        if (o !== h)
          expect(Math.hypot(o.x - h.x, o.z - h.z)).toBeGreaterThanOrEqual(
            OUTER_REEF.headSpacing,
          );
    }
    // Nothing stands in the open water right below the tunnel mouth.
    for (const p of layout.placements)
      if (p.family === 'rock' || p.family === 'backdrop')
        expect(
          Math.abs(p.position.x) < OUTER_REEF.mouthClear.halfWidth &&
            p.position.z > OUTER.cliffZ - OUTER_REEF.mouthClear.depth,
        ).toBe(false);
  });
  it('half-buries rocks in the sand and sets everything else on it', () => {
    for (const p of layout.placements) {
      const ground = seabedHeight(p.position.x, p.position.z);
      if (p.family === 'rock' || p.family === 'backdrop') {
        // The bottom of the rock is below the sand; its crown above it.
        expect(p.position.y - ROCK_HALF * p.scale.y).toBeLessThan(ground);
        expect(p.position.y + ROCK_HALF * p.scale.y).toBeGreaterThan(ground);
      } else if (
        p.family === 'blade' ||
        p.family === 'grass' ||
        p.family === 'shell' ||
        p.family === 'rubble'
      )
        expect(Math.abs(p.position.y - ground)).toBeLessThan(0.1);
    }
  });
  it('seats colonies on the rock actually beneath them (exact convex tops)', () => {
    const box = boxCollider([-1, 0, -1], [1, 2, 1]);
    expect(hullTop(box, 0, 0)).toBeCloseTo(2, 9);
    expect(hullTop(box, 3, 0)).toBe(-Infinity);
    // A tilted top: a plane rising with x.
    const n = new THREE.Vector3(-0.5, 1, 0).normalize();
    const wedge: ConvexCollider = {
      ...box,
      planes: [
        ...box.planes.filter((p) => p.y <= 0),
        { x: n.x, y: n.y, z: n.z, offset: n.y * 2 },
      ],
    };
    expect(hullTop(wedge, 0.5, 0)).toBeCloseTo(2.25, 9);
    const seated = seatOnRocks(
      [
        {
          family: 'massive',
          template: 0,
          position: v(0, 9, 0),
          yaw: 0,
          scale: v(1, 1, 1),
        },
        {
          family: 'massive',
          template: 0,
          position: v(5, 9, 0),
          yaw: 0,
          scale: v(1, 1, 1),
        },
        {
          family: 'rock',
          template: 0,
          position: v(0, 9, 0),
          yaw: 0,
          scale: v(1, 1, 1),
        },
      ],
      [box],
      () => 0.3,
    );
    expect(seated[0].position.y).toBeCloseTo(2 - 0.12, 9);
    expect(seated[1].position.y).toBeCloseTo(0.3 - 0.12, 9);
    expect(seated[2].position.y).toBe(9); // rocks are not moved
  });
});

describe('Pass 024 detail levels', () => {
  it('draws each copy at the level its distance calls for, and nothing beyond the last', () => {
    const near = new THREE.BoxGeometry(),
      far = new THREE.BoxGeometry(),
      material = new THREE.MeshBasicMaterial(),
      at = (z: number) => new THREE.Matrix4().makeTranslation(0, 0, z),
      set = new LevelInstances(
        'test',
        [
          { geometry: near, until: 10 },
          { geometry: far, until: 30 },
          { geometry: null, until: Infinity },
        ],
        material,
        [at(-5), at(-15), at(-25), at(-50), at(-90)],
      );
    set.update(0, 0, 0);
    expect(set.counts()).toEqual([1, 2, 0]);
    expect(set.drawn).toHaveLength(2);
    // From z -50: the copy there is near, the one at z -25 (25 m) far, the rest beyond reach.
    set.update(0, 0, -50);
    expect(set.counts()).toEqual([1, 1, 0]);
    set.dispose();
    near.dispose();
    far.dispose();
    material.dispose();
  });
  it('builds placement matrices from position, heading and scale', () => {
    const m = placementMatrix({
        family: 'rock',
        template: 0,
        position: v(1, 2, 3),
        yaw: Math.PI / 2,
        scale: v(2, 3, 4),
      }),
      p = new THREE.Vector3(1, 0, 0).applyMatrix4(m);
    expect(p.x).toBeCloseTo(1, 9);
    expect(p.y).toBeCloseTo(2, 9);
    expect(p.z).toBeCloseTo(3 - 2, 9);
  });
});

describe('Pass 024 outer collision', () => {
  const boxes: ConvexCollider[] = [];
  for (let i = 0; i < 60; i++) {
    const x = -50 + (i % 10) * 10,
      z = -40 - Math.floor(i / 10) * 12;
    boxes.push(boxCollider([x, -1, z], [x + 2, 3, z + 2]));
  }
  it('finds every collider near a point, once, without scanning them all', () => {
    const grid = new ColliderGrid(boxes),
      out: ConvexCollider[] = [];
    for (const [x, z] of [
      [0, -60],
      [-48, -40],
      [35, -95],
      [0, 0],
    ] as const) {
      grid.query(x, z, 3, out);
      const expected = boxes.filter(
        (c) =>
          c.max.x >= x - 3 &&
          c.min.x <= x + 3 &&
          c.max.z >= z - 3 &&
          c.min.z <= z + 3,
      );
      for (const c of expected) expect(out).toContain(c);
      expect(new Set(out).size).toBe(out.length);
      expect(out.length).toBeLessThan(10);
    }
  });
  it('keeps the swimmer above the seabed and out of the rocks', () => {
    const world = new TerrainCollisionWorld(
        new ColliderGrid(boxes),
        OUTER.bounds,
        seabedHeight,
      ),
      s = createSwimState(v(1, 6, -45)),
      tuning = { speed: 1.68, feel: 'natural' as const, reducedMotion: false };
    // Dive straight down: stops just above the sand, never below it.
    for (let i = 0; i < 60 * 10; i++)
      integrateSwimming(s, v(0, -1, 0), 1 / 60, tuning, OUTER.bounds, world);
    const floor =
      seabedHeight(s.position.x, s.position.z) + OUTER.bounds.clearance;
    expect(s.position.y).toBeGreaterThanOrEqual(floor - 1e-9);
    expect(s.position.y).toBeLessThan(floor + 0.05);
    // Swim along the reef into a rock: blocked by it.
    const rock = boxes.find(
      (b) => b.min.x > -20 && b.max.x < 20 && b.max.y - b.min.y > 1.5,
    )!;
    const y = (rock.min.y + rock.max.y) / 2,
      z = (rock.min.z + rock.max.z) / 2,
      r = createSwimState(v(rock.min.x - 3, y, z));
    for (let i = 0; i < 60 * 8; i++)
      integrateSwimming(r, v(1, 0, 0), 1 / 60, tuning, OUTER.bounds, world);
    expect(r.position.x).toBeLessThan(rock.max.x);
  });
});

describe('Pass 024 outer fish', () => {
  const layout = outerReefLayout();
  it('gathers each school over the reef top, and they all find room to spawn', () => {
    const species = outerSpecies(reefObstacles(layout.placements));
    expect(species).toHaveLength(OUTER_SCHOOLS.length);
    // Coarse obstacles like the runtime's: a box per rock or colony.
    const rocks = layout.placements
      .filter((p) =>
        ['rock', 'backdrop', 'branching', 'massive', 'plate'].includes(
          p.family,
        ),
      )
      .map((p) => {
        const r = ROCK_HALF * Math.max(p.scale.x, p.scale.z),
          h =
            (p.family === 'rock' || p.family === 'backdrop' ? ROCK_HALF : 2) *
            p.scale.y;
        return boxCollider(
          [p.position.x - r, p.position.y - h, p.position.z - r],
          [p.position.x + r, p.position.y + h, p.position.z + r],
        );
      });
    const fish = spawnFish(
      {
        bounds: OUTER.bounds,
        rocks,
        interests: outerInterests(layout),
        substrateHeight: seabedHeight,
        floorHeight: seabedHeight,
      },
      species,
      24024,
    );
    expect(fish).toHaveLength(OUTER_SCHOOLS.reduce((n, s) => n + s.count, 0));
    for (const f of fish) {
      expect(f.position.y).toBeGreaterThan(
        seabedHeight(f.position.x, f.position.z),
      );
      expect(f.position.z).toBeLessThan(OUTER.cliffZ);
    }
  });
});

it('adds bounded entrance and wall shoals at reachable swimming depths', () => {
  const species = outerSpecies(() => -35);
  expect(species.reduce((sum, s) => sum + s.count, 0)).toBe(235);
  const wall = OUTER_SCHOOLS.map((s, i) => ({
    layout: s,
    species: species[i],
  })).filter((s) => s.layout.waterLevel !== undefined);
  expect(wall).toHaveLength(2);
  for (const s of wall) {
    expect(s.layout.at.z).toBeLessThan(OUTER.dropOff.start);
    expect(s.species.region.y).toBe(s.layout.waterLevel);
    expect(s.species.depth[0]).toBeGreaterThan(OUTER.reach.down);
    expect(s.species.depth[1]).toBeLessThan(OUTER.reach.up);
  }
  for (const s of outerSpecies(() => 8)) {
    expect(s.region.y).toBeGreaterThan(8);
    expect(s.depth[0]).toBeGreaterThan(8);
  }
});

it('keeps mid-water shoals above rising terrain without teleporting them', () => {
  const habitat = {
    bounds: OUTER.bounds,
    rocks: [],
    floorHeight: (x: number) => Math.max(-12, Math.min(3, x * 2)),
  };
  const species = outerSpecies(() => -35)
    .filter((_, i) => OUTER_SCHOOLS[i].waterLevel !== undefined)
    .map((s) => ({
      ...s,
      count: 6,
      region: { x: -4, y: -3, z: -65 },
      spread: { x: 1, y: 0.5, z: 2 },
    }));
  const fish = spawnFish(habitat, species, 24024);
  const simulation = new FishSimulation(fish, habitat);
  let unsafe = false,
    largestStep = 0;
  for (let frame = 0; frame < 30 * 90; frame++) {
    const previous = fish.map((f) => ({ ...f.position }));
    simulation.advance(1 / 30, true);
    fish.forEach((f, i) => {
      unsafe ||= !safeFishPosition(f.position, f.radius, habitat);
      largestStep = Math.max(
        largestStep,
        Math.hypot(
          f.position.x - previous[i].x,
          f.position.y - previous[i].y,
          f.position.z - previous[i].z,
        ),
      );
    });
  }
  expect(unsafe).toBe(false);
  expect(largestStep).toBeLessThan(0.1);
});
