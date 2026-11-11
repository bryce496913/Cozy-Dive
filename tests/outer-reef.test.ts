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
  edgeCurrent,
  seabedHeight,
} from '../src/environment/outer/OuterTerrain';
import { spawnFish } from '../src/fish/FishSpawner';
import type { ConvexCollider } from '../src/player/collision';
import { createSwimState, integrateSwimming } from '../src/player/swimming';
import {
  ColliderGrid,
  TerrainCollisionWorld,
} from '../src/player/terrainCollision';

const v = (x: number, y: number, z: number): Vec3 => ({ x, y, z });

describe('Pass 024 outer seabed and edges', () => {
  it('has a winding channel, a gentle reef flat and a drop-off into deep water', () => {
    // The channel is lower than the sand beside it, all along the reef.
    for (let z = OUTER.cliffZ - 4; z > OUTER.dropOff.start; z -= 6) {
      const c = channelCentre(z);
      expect(channelWeight(c, z)).toBeCloseTo(1, 6);
      expect(seabedHeight(c, z)).toBeLessThan(seabedHeight(c + 9, z));
    }
    // The reef flat stays within a metre or two of the sand level.
    for (let x = -36; x <= 36; x += 6)
      for (let z = OUTER.cliffZ - 2; z > OUTER.dropOff.start; z -= 6) {
        expect(seabedHeight(x, z)).toBeGreaterThan(OUTER.floorY - 2);
        expect(seabedHeight(x, z)).toBeLessThan(OUTER.floorY + 2.5);
      }
    // Over the drop-off it falls away by its full depth.
    expect(dropWeight(OUTER.dropOff.start + 1)).toBe(0);
    expect(dropWeight(OUTER.dropOff.end - 1)).toBe(1);
    expect(seabedHeight(0, OUTER.dropOff.end - 5)).toBeLessThan(
      OUTER.floorY - OUTER.dropOff.depth + 2,
    );
    // Always inside the swimmable volume.
    for (let z = OUTER.cliffZ; z > OUTER.bounds.min.z; z -= 5)
      expect(seabedHeight(0, z)).toBeGreaterThan(OUTER.bounds.min.y);
  });
  it('turns the swimmer back gently near the edges, and nowhere else', () => {
    const out = v(0, 0, 0),
      r = OUTER.reef;
    expect(edgeCurrent(v(0, 5, -60), out)).toEqual({ x: 0, y: -0, z: 0 });
    edgeCurrent(v(r.maxX + OUTER.edgeWidth, 5, -60), out);
    expect(out.x).toBeCloseTo(-OUTER.edgeCurrent, 6);
    edgeCurrent(v(r.minX - OUTER.edgeWidth / 2, 5, -60), out);
    expect(out.x).toBeGreaterThan(0);
    expect(out.x).toBeLessThan(OUTER.edgeCurrent);
    edgeCurrent(v(0, 5, r.minZ - OUTER.edgeWidth), out);
    expect(out.z).toBeCloseTo(OUTER.edgeCurrent, 6);
    edgeCurrent(v(0, r.maxY + OUTER.edgeWidth, -60), out);
    expect(out.y).toBeCloseTo(-OUTER.edgeCurrent, 6);
    // The current never points outward, and is never stronger than its limit.
    for (let x = -60; x <= 60; x += 3) {
      edgeCurrent(v(x, 5, -60), out);
      expect(out.x * Math.sign(x)).toBeLessThanOrEqual(0);
      expect(Math.abs(out.x)).toBeLessThanOrEqual(OUTER.edgeCurrent + 1e-9);
    }
  });
});

describe('Pass 024 reef layout', () => {
  const layout = outerReefLayout();
  it('is deterministic and dresses the reef generously', () => {
    expect(outerReefLayout()).toEqual(layout);
    const count = (f: string) =>
      layout.placements.filter((p) => p.family === f).length;
    expect(layout.heads).toHaveLength(OUTER_REEF.heads);
    expect(count('rock')).toBeGreaterThan(50);
    expect(
      count('massive') + count('branching') + count('plate'),
    ).toBeGreaterThan(40);
    expect(count('soft') + count('fan')).toBeGreaterThan(15);
    expect(count('blade') + count('grass')).toBeGreaterThan(200);
  });
  it('keeps coral heads apart, off the channel, clear of the tunnel mouth and inside the reef', () => {
    for (const h of layout.heads) {
      expect(buildable(h.x, h.z, 4)).toBe(true);
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
      s = createSwimState(v(1, 6, -60)),
      tuning = { speed: 1.68, feel: 'natural' as const, reducedMotion: false };
    // Dive straight down: stops just above the sand, never below it.
    for (let i = 0; i < 60 * 10; i++)
      integrateSwimming(s, v(0, -1, 0), 1 / 60, tuning, OUTER.bounds, world);
    const floor =
      seabedHeight(s.position.x, s.position.z) + OUTER.bounds.clearance;
    expect(s.position.y).toBeGreaterThanOrEqual(floor - 1e-9);
    expect(s.position.y).toBeLessThan(floor + 0.05);
    // Swim along the sand into a rock: blocked by it.
    const r = createSwimState(v(-5, 1.5, -39));
    for (let i = 0; i < 60 * 8; i++)
      integrateSwimming(r, v(1, 0, 0), 1 / 60, tuning, OUTER.bounds, world);
    expect(r.position.x).toBeLessThan(0);
  });
});

describe('Pass 024 outer fish', () => {
  const layout = outerReefLayout();
  it('gathers each school beside a coral head, and they all find room to spawn', () => {
    const species = outerSpecies(layout.heads);
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
