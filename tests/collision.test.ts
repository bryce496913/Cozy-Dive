import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { AQUARIUM, COLLISION, SPAWN, type Vec3 } from '../src/config/world';
import { Aquarium } from '../src/environment/Aquarium';
import { CollisionWorld, type ConvexCollider } from '../src/player/collision';
import {
  createSwimState,
  integrateSwimming,
  resetSwimming,
  type SwimTuning,
} from '../src/player/swimming';

const tuning: SwimTuning = {
  speed: 2.8,
  feel: 'natural',
  reducedMotion: false,
};
const roomy = {
  min: { x: -20, y: -20, z: -20 },
  max: { x: 20, y: 20, z: 20 },
  clearance: 0.65,
};
function box(min: Vec3, max: Vec3): ConvexCollider {
  return {
    min,
    max,
    planes: [
      { x: 1, y: 0, z: 0, offset: max.x },
      { x: -1, y: 0, z: 0, offset: -min.x },
      { x: 0, y: 1, z: 0, offset: max.y },
      { x: 0, y: -1, z: 0, offset: -min.y },
      { x: 0, y: 0, z: 1, offset: max.z },
      { x: 0, y: 0, z: -1, offset: -min.z },
    ],
  };
}
const cube = box({ x: -1, y: -1, z: -1 }, { x: 1, y: 1, z: 1 });
function clear(world: CollisionWorld, p: Vec3): void {
  expect(world.colliders.some((c) => world.contains(c, p.x, p.y, p.z))).toBe(
    false,
  );
  for (const axis of ['x', 'y', 'z'] as const) {
    expect(p[axis]).toBeGreaterThanOrEqual(
      world.bounds.min[axis] + world.bounds.clearance - 1e-8,
    );
    expect(p[axis]).toBeLessThanOrEqual(
      world.bounds.max[axis] - world.bounds.clearance + 1e-8,
    );
  }
}
function move(
  world: CollisionWorld,
  start: Vec3,
  end: Vec3,
  velocity = { x: 0, y: 0, z: 0 },
) {
  const s = { position: { ...end }, velocity: { ...velocity } };
  world.move(s, start.x, start.y, start.z);
  return s;
}
describe('swept player collision', () => {
  it('blocks even a large displacement through a rock with nonzero velocity', () => {
    const world = new CollisionWorld([cube], roomy);
    const s = move(
      world,
      { x: -5, y: 0, z: 0 },
      { x: 5, y: 0, z: 0 },
      { x: 30, y: 0, z: 0 },
    );
    expect(s.position.x).toBeCloseTo(-1 - COLLISION.playerRadius, 4);
    expect(s.velocity.x).toBe(0);
    clear(world, s.position);
  });
  it('preserves tangential momentum and slides along a face', () => {
    const world = new CollisionWorld([cube], roomy);
    const s = move(
      world,
      { x: -3, y: 0, z: 0 },
      { x: 0, y: 0.3, z: 0.8 },
      { x: 3, y: 0.3, z: 0.8 },
    );
    expect(s.position.x).toBeCloseTo(-1.28, 4);
    expect(s.position.z).toBeCloseTo(0.8, 4);
    expect(s.position.y).toBeCloseTo(0.3, 4);
    expect(s.velocity).toEqual({ x: 0, y: 0.3, z: 0.8 });
    clear(world, s.position);
  });
  it.each([1, -1])(
    'blocks vertical approach (%s) without removing horizontal velocity',
    (sign) => {
      const world = new CollisionWorld([cube], roomy);
      const s = move(
        world,
        { x: 0, y: -sign * 3, z: 0 },
        { x: 0.2, y: 0, z: 0.1 },
        { x: 0.2, y: sign * 3, z: 0.1 },
      );
      expect(s.position.y).toBeCloseTo(-sign * 1.28, 4);
      expect(s.velocity.y).toBe(0);
      expect(s.velocity.x).toBe(0.2);
      clear(world, s.position);
    },
  );
  it('keeps repeated contact stable and allows immediate reversal', () => {
    const world = new CollisionWorld([cube], roomy);
    const s = createSwimState({ x: -3, y: 0, z: 0 });
    for (let i = 0; i < 600; i++)
      integrateSwimming(s, { x: 1, y: 0, z: 0 }, 1 / 60, tuning, roomy, world);
    const x = s.position.x;
    for (let i = 0; i < 300; i++) {
      integrateSwimming(s, { x: 1, y: 0, z: 0 }, 1 / 60, tuning, roomy, world);
      expect(Math.abs(s.position.x - x)).toBeLessThan(0.00003);
      clear(world, s.position);
    }
    for (let i = 0; i < 120; i++)
      integrateSwimming(s, { x: -1, y: 0, z: 0 }, 1 / 60, tuning, roomy, world);
    expect(s.position.x).toBeLessThan(-3);
  });
  it('handles corners and overlapping hulls without jitter or trapping', () => {
    const colliders = [
      box({ x: 0, y: -10, z: -10 }, { x: 2, y: 10, z: 10 }),
      box({ x: -10, y: -10, z: 0 }, { x: 10, y: 10, z: 2 }),
    ];
    const world = new CollisionWorld(colliders, roomy);
    let p = { x: -2, y: 0, z: -2 };
    for (let i = 0; i < 100; i++) {
      const s = move(
        world,
        p,
        { x: p.x + 0.1, y: 0, z: p.z + 0.1 },
        { x: 1, y: 0, z: 1 },
      );
      p = s.position;
      clear(world, p);
    }
    expect(p.x).toBeCloseTo(-0.28, 4);
    expect(p.z).toBeCloseTo(-0.28, 4);
    const out = move(
      world,
      p,
      { x: p.x - 1, y: 0, z: p.z - 1 },
      { x: -1, y: 0, z: -1 },
    );
    expect(out.position.x).toBeLessThan(-1);
    expect(out.position.z).toBeLessThan(-1);
    clear(world, out.position);
  });
  it('recovers an initial overlap locally from the union rather than oscillating between rocks', () => {
    const world = new CollisionWorld(
      [cube, box({ x: 0.5, y: -1, z: -1 }, { x: 2.5, y: 1, z: 1 })],
      roomy,
    );
    const p = { x: 0.75, y: 0, z: 0 };
    const s = move(world, p, p, { x: 0, y: -1, z: 0 });
    clear(world, s.position);
    expect(
      Math.hypot(s.position.x - p.x, s.position.y - p.y, s.position.z - p.z),
    ).toBeLessThan(1.4);
    const once = { ...s.position };
    world.move(s, once.x, once.y, once.z);
    expect(s.position).toEqual(once);
  });
  it('resolves scenery/glass intersections together', () => {
    const world = new CollisionWorld(
      [box({ x: 16, y: 0, z: -1 }, { x: 19, y: 2, z: 1 })],
      AQUARIUM,
    );
    const s = move(
      world,
      { x: 15, y: 1, z: -3 },
      { x: 19, y: 1, z: 2 },
      { x: 4, y: 0, z: 5 },
    );
    clear(world, s.position);
  });
  it('does not alter open-water swimming', () => {
    const a = createSwimState({ x: 0, y: 7, z: 9 }),
      b = createSwimState({ x: 0, y: 7, z: 9 });
    const world = new CollisionWorld([cube], roomy);
    for (let i = 0; i < 120; i++) {
      integrateSwimming(a, { x: 0.2, y: 0.1, z: -0.2 }, 1 / 60, tuning, roomy);
      integrateSwimming(
        b,
        { x: 0.2, y: 0.1, z: -0.2 },
        1 / 60,
        tuning,
        roomy,
        world,
      );
    }
    expect(b).toEqual(a);
  });
  it('agrees at 30, 60, and 120 FPS during collision and sliding', () => {
    const world = new CollisionWorld([cube], roomy);
    const results = [30, 60, 120].map((fps) => {
      const s = createSwimState({ x: -3, y: 0, z: 0 });
      for (let i = 0; i < fps * 4; i++)
        integrateSwimming(
          s,
          { x: 0.9, y: 0.1, z: 0.3 },
          1 / fps,
          tuning,
          roomy,
          world,
        );
      clear(world, s.position);
      return s;
    });
    for (const s of results.slice(1))
      for (const axis of ['x', 'y', 'z'] as const) {
        expect(s.position[axis]).toBeCloseTo(results[0].position[axis], 4);
        expect(s.velocity[axis]).toBeCloseTo(results[0].velocity[axis], 4);
      }
  });
  it('preserves breathing clocks/neutral depth at contact and resumes safely', () => {
    const world = new CollisionWorld([cube], roomy);
    const s = createSwimState({ x: 0, y: 1.3, z: 0 });
    let min = Infinity,
      max = -Infinity;
    for (let i = 0; i < 3600; i++) {
      integrateSwimming(s, { x: 0, y: 0, z: 0 }, 1 / 60, tuning, roomy, world);
      clear(world, s.position);
      if (i > 3000) {
        min = Math.min(min, s.position.y);
        max = Math.max(max, s.position.y);
      }
    }
    expect(max - min).toBeGreaterThan(0.01);
    expect(max - min).toBeLessThan(0.13);
    expect(s.neutralDepth).toBe(1.3);
    const before = { ...s.position };
    resetSwimming(s);
    expect(s.position).toEqual(before);
    integrateSwimming(s, { x: 0, y: 0, z: 0 }, 1 / 60, tuning, roomy, world);
    expect(Math.abs(s.position.y - before.y)).toBeLessThan(0.0001);
    clear(world, s.position);
  });
});

describe('generated aquarium collider geometry', () => {
  it('matches the actual deterministic transformed rock geometry and keeps spawn safe', () => {
    const a = new Aquarium(),
      b = new Aquarium();
    try {
      expect(a.collision.colliders).toEqual(b.collision.colliders);
      expect(a.collision.colliders).toHaveLength(34);
      const rocks = a.root.children.filter(
        (child): child is THREE.Mesh =>
          child instanceof THREE.Mesh &&
          child.geometry.type === 'IcosahedronGeometry',
      );
      expect(rocks).toHaveLength(89);
      for (let i = 0; i < 34; i++) {
        const rock = rocks[i],
          collider = a.collision.colliders[i];
        const vertices = rock.geometry.getAttribute('position');
        const vertex = new THREE.Vector3();
        expect(collider.planes.length).toBe(80);
        let maxOutside = -Infinity;
        for (let j = 0; j < vertices.count; j++) {
          vertex.fromBufferAttribute(vertices, j).applyMatrix4(rock.matrix);
          for (const p of collider.planes)
            maxOutside = Math.max(
              maxOutside,
              p.x * vertex.x + p.y * vertex.y + p.z * vertex.z - p.offset,
            );
        }
        expect(maxOutside).toBeLessThan(1e-6);
        expect(
          a.collision.contains(
            collider,
            rock.position.x,
            rock.position.y,
            rock.position.z,
          ),
        ).toBe(true);
      }
      clear(a.collision, SPAWN);
      const s = move(a.collision, SPAWN, SPAWN);
      expect(s.position).toEqual(SPAWN);
    } finally {
      a.dispose();
      b.dispose();
    }
  });
  it('allows travel through the open sand channel and above the banks', () => {
    const aquarium = new Aquarium();
    try {
      const s = createSwimState({ ...SPAWN });
      for (let i = 0; i < 1200; i++) {
        integrateSwimming(
          s,
          { x: 0, y: 0, z: -1 },
          1 / 60,
          tuning,
          AQUARIUM,
          aquarium.collision,
        );
        clear(aquarium.collision, s.position);
      }
      expect(s.position.z).toBeCloseTo(-13.35, 4);
    } finally {
      aquarium.dispose();
    }
  });
});

it('keeps varied routes through the actual rocky banks outside overlapping hulls', () => {
  const aquarium = new Aquarium();
  try {
    for (const side of [-1, 1]) {
      const s = createSwimState({ x: 0, y: 1.4, z: 9 });
      for (let i = 0; i < 3600; i++) {
        const segment = Math.floor(i / 240);
        const d = {
          x: side * Math.cos(segment * 0.8) * 0.7,
          y: Math.sin(segment * 1.1) * 0.2,
          z: -Math.sin(segment * 0.7) * 0.7,
        };
        integrateSwimming(s, d, 1 / 60, tuning, AQUARIUM, aquarium.collision);
        clear(aquarium.collision, s.position);
      }
    }
  } finally {
    aquarium.dispose();
  }
});
