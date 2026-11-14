import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import {
  CLEFT,
  CLEFT_FRAME,
  CREVICE,
  CREVICE_FRAME,
  KELP_FRAME,
  OUTER,
  PASSAGE,
  TUNNEL_FRAME,
  cleftFromTank,
  cleftToTank,
} from '../src/config/passage';
import type { Vec3 } from '../src/config/world';
import { OuterEnvironment } from '../src/environment/outer/OuterEnvironment';
import { OuterCleft } from '../src/environment/outer/OuterCleft';
import {
  CLEFT_CLEAR,
  ROCK_HALF,
  outerReefLayout,
} from '../src/environment/outer/OuterReefLayout';
import { seabedHeight } from '../src/environment/outer/OuterTerrain';
import {
  cleftDistance,
  crossing,
  depthPast,
  frameTurn,
  headingOf,
  inCleft,
  mapPoint,
  passageDarkness,
} from '../src/player/passage';
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
/** A point in the cleft, given as an offset from the tank crevice's threshold (tank coordinates). */
const cleftAt = (dx: number, dy = 0, dz = 0): Vec3 =>
  cleftFromTank(
    v(
      CREVICE_FRAME.origin.x + dx,
      CREVICE.centre.y + dy,
      CREVICE.centre.z + dz,
    ),
    v(0, 0, 0),
  );
const ready = { outer: true, kelp: true };

describe('Pass 032 the cleft to the kelp forest', () => {
  it('is the tank crevice turned half round, against the cliff, opening west', () => {
    const p = v(3.1, 2.2, -11.4),
      q = cleftToTank(cleftFromTank(p, v(0, 0, 0)), v(0, 0, 0));
    expect(q.x).toBeCloseTo(p.x, 12);
    expect(q.y).toBeCloseTo(p.y, 12);
    expect(q.z).toBeCloseTo(p.z, 12);
    // The threshold frame is the crevice's, turned: deeper in runs east (+x).
    const o = cleftFromTank(CREVICE_FRAME.origin, v(0, 0, 0));
    expect(CLEFT_FRAME.origin).toEqual(o);
    expect(CLEFT_FRAME.forward).toEqual({ x: 1, z: -0 });
    // The mouth faces west, away from the tunnel, and the side that lay on the glass lies on the cliff.
    const mouth = cleftAt(CREVICE.mouthX - CREVICE_FRAME.origin.x);
    expect(mouth.x).toBeLessThan(CLEFT_FRAME.origin.x);
    expect(mouth.x).toBeLessThan(-12);
    const glassSide = cleftFromTank(v(4, 1, -14.2), v(0, 0, 0));
    expect(glassSide.z).toBeCloseTo(OUTER.cliffZ, 0);
    expect(cleftDistance(mouth)).toBeLessThan(0.01);
  });
  it('turns its rock and colliders with it, sealed except at the mouth', () => {
    const cleft = new OuterCleft(),
      outer = new OuterEnvironment();
    try {
      cleft.root.updateMatrixWorld(true);
      const w = new TerrainCollisionWorld(
        new ColliderGrid([...outer.colliders, ...cleft.colliders]),
        OUTER.bounds,
        seabedHeight,
      );
      const blocked = (p: Vec3) =>
        w.colliders.some((c) => w.contains(c, p.x, p.y, p.z));
      // The channel is open from deep inside out past the mouth, as in the tank.
      for (
        let dx = CREVICE.endX + 0.4 - CREVICE_FRAME.origin.x;
        dx <= CREVICE.mouthX + 1 - CREVICE_FRAME.origin.x;
        dx += 0.2
      )
        for (const dy of [-0.6, 0, 0.6])
          for (const dz of [-0.55, 0, 0.55])
            expect(blocked(cleftAt(dx, dy, dz)), `${dx}`).toBe(false);
      // A swimmer heading east from the mouth reaches the threshold and beyond.
      const s = createSwimState(
        cleftAt(CREVICE.mouthX + 1.2 - CREVICE_FRAME.origin.x),
      );
      for (let i = 0; i < 60 * 8; i++)
        integrateSwimming(s, v(1, 0, 0), 1 / 60, tuning, OUTER.bounds, w);
      expect(depthPast(CLEFT_FRAME, s.position)).toBeGreaterThan(
        PASSAGE.hysteresis,
      );
      expect(inCleft(s.position)).toBe(true);
      // Its rock sits on the reef top: the base buried in sand, nothing floating below the channel.
      const base = cleftAt(0, -CREVICE.halfHeight);
      expect(base.y).toBeGreaterThan(seabedHeight(base.x, base.z));
      // Rocks are turned as the colliders are: every boulder (and the tube) lies in the cleft's area.
      for (const rock of cleft.rocks) {
        const box = new THREE.Box3().setFromObject(rock),
          c = box.getCenter(new THREE.Vector3());
        expect(c.z, rock.name).toBeGreaterThan(OUTER.cliffZ - 6);
        expect(c.z, rock.name).toBeLessThan(OUTER.cliffZ + 1);
        expect(c.x, rock.name).toBeLessThan(-8);
      }
    } finally {
      cleft.dispose();
      outer.dispose();
    }
  });
  it('keeps the outer reef out of the cleft, without disturbing the rest of the reef', () => {
    const layout = outerReefLayout();
    for (const p of layout.placements) {
      const small =
          p.family === 'rubble' || p.family === 'shell' || p.family === 'blade',
        reach = small ? 0.3 : 0.6 * ROCK_HALF * Math.max(p.scale.x, p.scale.z);
      expect(
        p.position.x > CLEFT_CLEAR.minX - reach &&
          p.position.x < CLEFT_CLEAR.maxX + reach &&
          p.position.z > CLEFT_CLEAR.z - reach,
        `${p.family} ${p.position.x},${p.position.z}`,
      ).toBe(false);
    }
    // The bommie that screens the cleft from the reef top is still there.
    expect(
      layout.heads.some((h) => Math.hypot(h.x + 9.67, h.z + 37.5) < 0.05),
    ).toBe(true);
  });
  it('crosses to the kelp forest only past the threshold, when it is ready, and back', () => {
    const past = cleftAt(-PASSAGE.hysteresis * 2),
      short = cleftAt(-PASSAGE.hysteresis / 2);
    expect(crossing('outer', past, ready)?.target).toBe('kelp');
    expect(crossing('outer', past, { outer: true, kelp: false })).toBeNull();
    expect(crossing('outer', short, ready)).toBeNull();
    // Outside the channel, the same depth past the threshold is just reef.
    expect(crossing('outer', v(past.x, past.y + 4, past.z), ready)).toBeNull();
    // The crossing maps the threshold onto the kelp tunnel's start, turning the look with it.
    const c = crossing('outer', past, ready)!;
    expect(c.from).toBe(CLEFT_FRAME);
    expect(c.to).toBe(KELP_FRAME);
    const o = mapPoint(CLEFT_FRAME.origin, c.from, c.to, v(0, 0, 0));
    expect(o.x).toBeCloseTo(KELP_FRAME.origin.x, 9);
    expect(o.y).toBeCloseTo(KELP_FRAME.origin.y, 9);
    expect(o.z).toBeCloseTo(KELP_FRAME.origin.z, 9);
    const yaw = headingOf(CLEFT_FRAME.forward) + frameTurn(c.from, c.to);
    expect(Math.cos(yaw - headingOf(KELP_FRAME.forward))).toBeCloseTo(1, 9);
    // Back from the kelp tunnel's start, into the cleft.
    const back = v(0, KELP_FRAME.origin.y, PASSAGE.hysteresis * 2);
    expect(crossing('kelp', back, ready)?.target).toBe('outer');
    expect(crossing('kelp', v(0, KELP_FRAME.origin.y, -2), ready)).toBeNull();
    // The tank's own passage is unchanged.
    expect(
      crossing(
        'aquarium',
        v(CREVICE_FRAME.origin.x - 0.2, CREVICE.centre.y, CREVICE.centre.z),
        ready,
      )?.target,
    ).toBe('outer');
    expect(
      crossing('outer', v(0, TUNNEL_FRAME.origin.y, 0.2), ready)?.target,
    ).toBe('aquarium');
  });
  it('darkens towards the cleft threshold, and only inside the cleft', () => {
    expect(passageDarkness('outer', cleftAt(0))).toBeCloseTo(
      PASSAGE.darkPeak,
      9,
    );
    expect(passageDarkness('outer', cleftAt(1.5))).toBeLessThan(
      PASSAGE.darkPeak,
    );
    // At the same depth past the threshold but out on the reef, no darkness.
    const p = cleftAt(0);
    expect(passageDarkness('outer', v(p.x, p.y, p.z - 6))).toBe(0);
    expect(
      passageDarkness('kelp', v(0, KELP_FRAME.origin.y, -0.2)),
    ).toBeGreaterThan(0.9);
    expect(passageDarkness('kelp', v(10, KELP_FRAME.origin.y, -0.2))).toBe(0);
    expect(CLEFT.preload).toBeLessThan(CLEFT.release);
  });
});
