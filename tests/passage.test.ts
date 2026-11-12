import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import {
  CREVICE,
  CREVICE_FRAME,
  OUTER,
  PASSAGE,
  TUNNEL_FRAME,
} from '../src/config/passage';
import { AQUARIUM, type Vec3 } from '../src/config/world';
import { Aquarium } from '../src/environment/Aquarium';
import {
  TUBE,
  linerShade,
  tubeRadius,
} from '../src/environment/passage/Crevice';
import { OuterEnvironment } from '../src/environment/outer/OuterEnvironment';
import { CollisionWorld } from '../src/player/collision';
import {
  depthPast,
  frameTurn,
  headingOf,
  inChannel,
  mapPoint,
  mapVector,
  mouthDistance,
  passageDarkness,
  passageTarget,
  returnPose,
} from '../src/player/passage';
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
const at = (dx: number, dy = 0, dz = 0): Vec3 =>
  v(CREVICE_FRAME.origin.x + dx, CREVICE.centre.y + dy, CREVICE.centre.z + dz);

describe('Pass 023 passage mapping', () => {
  it('maps the crevice threshold onto the tunnel start, turning the look with it', () => {
    const p = mapPoint(
      CREVICE_FRAME.origin,
      CREVICE_FRAME,
      TUNNEL_FRAME,
      v(0, 0, 0),
    );
    expect(p.x).toBeCloseTo(TUNNEL_FRAME.origin.x, 9);
    expect(p.y).toBeCloseTo(TUNNEL_FRAME.origin.y, 9);
    expect(p.z).toBeCloseTo(TUNNEL_FRAME.origin.z, 9);
    // Looking into the crevice is looking down the tunnel.
    const yaw =
      headingOf(CREVICE_FRAME.forward) + frameTurn(CREVICE_FRAME, TUNNEL_FRAME);
    expect(Math.cos(yaw - headingOf(TUNNEL_FRAME.forward))).toBeCloseTo(1, 9);
    // A point 1 m past the threshold is 1 m down the tunnel; sideways offsets carry across.
    const q = mapPoint(
      at(-1, 0.3, 0.2),
      CREVICE_FRAME,
      TUNNEL_FRAME,
      v(0, 0, 0),
    );
    expect(depthPast(TUNNEL_FRAME, q)).toBeCloseTo(1, 9);
    expect(q.y - TUNNEL_FRAME.origin.y).toBeCloseTo(0.3, 9);
    // Swimming into the crevice (−x) is swimming down the tunnel.
    const vel = mapVector(
      v(-1.2, 0.1, 0),
      CREVICE_FRAME,
      TUNNEL_FRAME,
      v(0, 0, 0),
    );
    expect(
      vel.x * TUNNEL_FRAME.forward.x + vel.z * TUNNEL_FRAME.forward.z,
    ).toBeCloseTo(1.2, 9);
    expect(vel.y).toBeCloseTo(0.1, 9);
  });
  it('round-trips exactly, so swimming back out returns to the same place', () => {
    for (const p of [at(0.4, -0.5, 0.4), at(-0.9, 0.6, -0.5), at(2.5, 0, 0)]) {
      const there = mapPoint(p, CREVICE_FRAME, TUNNEL_FRAME, v(0, 0, 0)),
        back = mapPoint(there, TUNNEL_FRAME, CREVICE_FRAME, v(0, 0, 0));
      expect(back.x).toBeCloseTo(p.x, 9);
      expect(back.y).toBeCloseTo(p.y, 9);
      expect(back.z).toBeCloseTo(p.z, 9);
    }
    expect(
      frameTurn(CREVICE_FRAME, TUNNEL_FRAME) +
        frameTurn(TUNNEL_FRAME, CREVICE_FRAME),
    ).toBeCloseTo(0, 9);
  });
  it('swaps only past the threshold inside the channel, only when the far side is ready, with hysteresis', () => {
    const h = PASSAGE.hysteresis;
    expect(passageTarget('aquarium', at(-h * 2), true)).toBe('outer');
    expect(passageTarget('aquarium', at(-h * 2), false)).toBe('aquarium');
    expect(passageTarget('aquarium', at(-h / 2), true)).toBe('aquarium');
    expect(passageTarget('aquarium', at(1), true)).toBe('aquarium');
    // Beyond the channel's ends or outside its cross-section, never.
    expect(
      passageTarget(
        'aquarium',
        v(-6, CREVICE.centre.y, CREVICE.centre.z),
        true,
      ),
    ).toBe('aquarium');
    expect(passageTarget('aquarium', at(-0.5, 3), true)).toBe('aquarium');
    expect(inChannel(at(0))).toBe(true);
    expect(inChannel(v(0, 4, 0))).toBe(false);
    // In the tunnel: back out past its start returns; anywhere along it stays.
    const tunnel = (d: number) =>
      v(
        TUNNEL_FRAME.origin.x,
        TUNNEL_FRAME.origin.y,
        TUNNEL_FRAME.origin.z - d,
      );
    expect(passageTarget('outer', tunnel(-h * 2), true)).toBe('aquarium');
    expect(passageTarget('outer', tunnel(-h / 2), true)).toBe('outer');
    expect(passageTarget('outer', tunnel(5), true)).toBe('outer');
    // Hovering exactly at the threshold never flickers.
    const p = at(0);
    expect(passageTarget('aquarium', p, true)).toBe('aquarium');
    const q = mapPoint(p, CREVICE_FRAME, TUNNEL_FRAME, v(0, 0, 0));
    expect(passageTarget('outer', q, true)).toBe('outer');
  });
  it('is darkest at the threshold, identically on both sides, and clear away from it', () => {
    const inside = passageDarkness('aquarium', at(0)),
      across = passageDarkness(
        'outer',
        mapPoint(at(0), CREVICE_FRAME, TUNNEL_FRAME, v(0, 0, 0)),
      );
    expect(inside).toBeCloseTo(PASSAGE.darkPeak, 9);
    expect(across).toBeCloseTo(PASSAGE.darkPeak, 9);
    for (const d of [0.5, 1.2, 2.4]) {
      const a = passageDarkness('aquarium', at(d)),
        b = passageDarkness(
          'outer',
          mapPoint(at(-d), CREVICE_FRAME, TUNNEL_FRAME, v(0, 0, 0)),
        );
      expect(a).toBeCloseTo(b, 9);
      expect(a).toBeLessThan(inside);
    }
    expect(passageDarkness('aquarium', v(0, 5, 0))).toBe(0);
    expect(passageDarkness('aquarium', at(PASSAGE.darkReach + 0.1))).toBe(0);
  });
  it('returns to the tank just outside the mouth, facing out, inside the tank', () => {
    const r = returnPose();
    expect(mouthDistance(r)).toBeCloseTo(PASSAGE.returnGap, 9);
    expect(r.x).toBeGreaterThan(CREVICE.mouthX);
    expect(-Math.sin(r.yaw)).toBeCloseTo(1, 9); // looking +x, out of the crack
    expect(r.x).toBeLessThan(AQUARIUM.max.x - AQUARIUM.clearance);
  });
});

describe('Pass 023 hidden crevice', () => {
  const a = new Aquarium(),
    world = a.collision,
    blocked = (p: Vec3) =>
      world.colliders.some((c) => world.contains(c, p.x, p.y, p.z));
  it('keeps the central sand channel clear and sits in the back-right corner', () => {
    for (const box of a.crevice.colliders)
      expect(box.min.x).toBeGreaterThan(0.7);
    for (let z = -13; z <= 12; z += 0.5)
      expect(blocked(v(0, 1.5, z))).toBe(false);
  });
  it('has a clear channel from the mouth to past the threshold', () => {
    for (let x = CREVICE.endX + 0.4; x <= CREVICE.mouthX + 1; x += 0.2)
      for (const dy of [-0.6, 0, 0.6])
        for (const dz of [-0.55, 0, 0.55])
          expect(
            blocked(v(x, CREVICE.centre.y + dy, CREVICE.centre.z + dz)),
            `${x}`,
          ).toBe(false);
  });
  it('lets a swimmer in through the mouth to the threshold, and nowhere else', () => {
    const s = createSwimState(
      v(CREVICE.mouthX + 1.2, CREVICE.centre.y, CREVICE.centre.z),
    );
    for (let i = 0; i < 60 * 8; i++)
      integrateSwimming(s, v(-1, 0, 0), 1 / 60, tuning, AQUARIUM, world);
    expect(depthPast(CREVICE_FRAME, s.position)).toBeGreaterThan(
      PASSAGE.hysteresis,
    );
    // From inside, every direction either stays in the channel or leaves by the mouth.
    const dirs: Vec3[] = [];
    for (const x of [-1, 0, 1])
      for (const y of [-1, 0, 1])
        for (const z of [-1, 0, 1]) if (x || y || z) dirs.push(v(x, y, z));
    for (const d of dirs) {
      const n = Math.hypot(d.x, d.y, d.z),
        e = createSwimState(at(0.6));
      for (let i = 0; i < 60 * 10; i++)
        integrateSwimming(
          e,
          v(d.x / n, d.y / n, d.z / n),
          1 / 60,
          tuning,
          AQUARIUM,
          world,
        );
      const p = e.position,
        stayed =
          p.x >= CREVICE.endX - 0.05 &&
          Math.abs(p.y - CREVICE.centre.y) <= CREVICE.halfHeight &&
          Math.abs(p.z - CREVICE.centre.z) <= CREVICE.halfDepth;
      expect(stayed || p.x > CREVICE.mouthX - 0.5, JSON.stringify(d)).toBe(
        true,
      );
    }
  });
  it('maps every reachable point near the threshold to open tunnel', () => {
    const outer = new OuterEnvironment(),
      w = new CollisionWorld(outer.colliders, OUTER.bounds);
    try {
      for (const dx of [0.3, 0, -0.6, -0.9])
        for (const dy of [-0.72, 0, 0.72])
          for (const dz of [-0.67, 0, 0.67]) {
            const q = mapPoint(
              at(dx, dy, dz),
              CREVICE_FRAME,
              TUNNEL_FRAME,
              v(0, 0, 0),
            );
            expect(
              outer.colliders.some((c) => w.contains(c, q.x, q.y, q.z)),
            ).toBe(false);
          }
    } finally {
      outer.dispose();
    }
  });
});

describe('Pass 026 playtest: a natural crevice', () => {
  it('lines the channel with a rock tube that never bulges into reachable space', () => {
    // The tube's section is the channel's oval scaled by tubeRadius, so >= 1 keeps every wall at
    // or beyond the channel's own bounds (where the collision plates are).
    for (let x = CREVICE.endX; x <= CREVICE.mouthX; x += 0.05)
      for (let a = 0; a < Math.PI * 2; a += 0.05)
        expect(tubeRadius(x, a)).toBeGreaterThanOrEqual(1);
    // Lumpy rock, not a smooth pipe.
    const radii: number[] = [];
    for (let a = 0; a < Math.PI * 2; a += 0.1) radii.push(tubeRadius(3, a));
    expect(Math.max(...radii) - Math.min(...radii)).toBeGreaterThan(
      TUBE.bump * 0.3,
    );
  });
  it('starts the tube in shadow well inside the mouth, and is black by the threshold', () => {
    const start = CREVICE.mouthX - TUBE.inset;
    expect(TUBE.inset).toBeGreaterThan(1);
    expect(linerShade(start)).toBeLessThanOrEqual(1);
    expect(linerShade(CREVICE_FRAME.origin.x + 0.4)).toBe(0);
    for (let x = CREVICE.endX; x < start; x += 0.1)
      expect(linerShade(x + 0.1)).toBeGreaterThanOrEqual(linerShade(x));
  });
});

describe('Pass 023 outer waters', () => {
  it('can be swum from the tunnel start through the cliff into open water, and is sealed', () => {
    const outer = new OuterEnvironment(),
      w = new CollisionWorld(outer.colliders, OUTER.bounds);
    try {
      const s = createSwimState({ ...TUNNEL_FRAME.origin }),
        pts = OUTER.tunnel;
      let target = 2;
      for (let i = 0; i < 60 * 60 && target < pts.length; i++) {
        const p = pts[target],
          d = v(p.x - s.position.x, p.y - s.position.y, p.z - s.position.z),
          n = Math.hypot(d.x, d.y, d.z);
        if (n < 1.2) {
          target++;
          continue;
        }
        integrateSwimming(
          s,
          v(d.x / n, d.y / n, d.z / n),
          1 / 60,
          tuning,
          OUTER.bounds,
          w,
        );
      }
      expect(s.position.z).toBeLessThan(OUTER.cliffZ);
      // Pushing into the walls from inside the tunnel keeps the swimmer within it.
      const curve = new THREE.CatmullRomCurve3(
        OUTER.tunnel.map((p) => new THREE.Vector3(p.x, p.y, p.z)),
        false,
        'centripetal',
      );
      const samples = curve.getSpacedPoints(400);
      for (const dir of [v(1, 0, 0), v(-1, 0, 0), v(0, 1, 0), v(0, -1, 0)]) {
        const e = createSwimState(v(1.6, 8.5, -10));
        for (let i = 0; i < 60 * 8; i++)
          integrateSwimming(e, dir, 1 / 60, tuning, OUTER.bounds, w);
        const nearest = Math.min(
          ...samples.map((p) => p.distanceTo(e.position as THREE.Vector3)),
        );
        expect(nearest).toBeLessThan(OUTER.tunnelRadius);
      }
      // The cliff is solid away from the tunnel mouth.
      const c = createSwimState(v(9, 7, -40));
      for (let i = 0; i < 60 * 15; i++)
        integrateSwimming(c, v(0, 0, 1), 1 / 60, tuning, OUTER.bounds, w);
      expect(c.position.z).toBeLessThan(OUTER.cliffZ);
    } finally {
      outer.dispose();
    }
  });
  it('disposes everything it created exactly once', () => {
    const outer = new OuterEnvironment(),
      disposed = new Map<object, number>();
    outer.root.traverse((o) => {
      if (o instanceof THREE.Mesh || o instanceof THREE.Points) {
        for (const r of [o.geometry, o.material as THREE.Material])
          if (!disposed.has(r)) {
            disposed.set(r, 0);
            r.addEventListener('dispose', () =>
              disposed.set(r, disposed.get(r)! + 1),
            );
          }
      }
    });
    expect(disposed.size).toBeGreaterThan(5);
    outer.dispose();
    outer.dispose();
    for (const n of disposed.values()) expect(n).toBe(1);
    expect(outer.root.children).toHaveLength(0);
  });
});
