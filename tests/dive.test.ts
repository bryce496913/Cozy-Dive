import { describe, expect, it } from 'vitest';
import { AQUARIUM, SPAWN } from '../src/config/world';
import {
  OFFICE,
  OFFICE_FOOTPRINTS,
  STAND_FOOTPRINT,
  TANK,
  TANK_SCALE,
} from '../src/config/office';
import {
  DIVE,
  DivePath,
  aquariumToOffice,
  canDive,
  canSurface,
  glassClarity,
  interruptedChoice,
  officeToAquarium,
  tankDistance,
  tankFront,
  type DiveFrame,
  type Pose,
} from '../src/player/dive';

const frame = (): DiveFrame => ({
  space: 'office',
  x: 0,
  y: 0,
  z: 0,
  yaw: 0,
  pitch: 0,
  veil: 0,
  fog: 0,
  bubbles: 0,
  water: 0,
  outlook: 1,
});
const close = (a: Pose, b: Pose, eps = 1e-9) => {
  expect(a.x).toBeCloseTo(b.x, 9);
  expect(a.y).toBeCloseTo(b.y, 9);
  expect(a.z).toBeCloseTo(b.z, 9);
  expect(Math.cos(a.yaw - b.yaw)).toBeGreaterThan(1 - eps);
  expect(a.pitch).toBeCloseTo(b.pitch, 9);
};
/** Frames sampled densely; returns the index where the space changes. */
function sampleAll(path: DivePath) {
  const frames: DiveFrame[] = [];
  for (let t = 0; t <= path.duration + 1e-9; t += 1 / 240)
    frames.push(path.sample(t, frame()));
  return frames;
}
// About a metre in front of the tank's glass, a little off its middle (Pass 027: from the tank).
const inFront: Pose = {
  x: TANK.position.x - 1.35,
  y: OFFICE.eyeHeight,
  z: TANK.position.z + 0.15,
  yaw: -Math.PI / 2 + 0.2,
  pitch: -0.1,
};

describe('Pass 021 tank frame', () => {
  it('maps aquarium and office poses both ways, and places the front glass facing the room', () => {
    const p: Pose = { x: 5, y: 7, z: -3, yaw: 0.4, pitch: -0.2 };
    close(officeToAquarium(aquariumToOffice(p)), p);
    const f = tankFront();
    expect(f.out.x).toBeCloseTo(-1, 9);
    expect(f.out.z).toBeCloseTo(0, 9);
    expect(f.x).toBeCloseTo(TANK.position.x - TANK.size.z / 2, 9);
    expect(f.y).toBeCloseTo(TANK.position.y + TANK.size.y / 2, 9);
    // Looking down the aquarium from its front (yaw 0) is looking into the tank from the room.
    expect(
      aquariumToOffice({ x: 0, y: 0, z: 0, yaw: 0, pitch: 0 }).yaw,
    ).toBeCloseTo(-Math.PI / 2, 9);
  });
});

describe('Pass 021 dive', () => {
  it('glides to the glass, then continues in the aquarium from the identical viewpoint', () => {
    const path = new DivePath('dive', inFront, false),
      frames = sampleAll(path),
      i = frames.findIndex((f) => f.space === 'aquarium');
    expect(i).toBeGreaterThan(0);
    // Office frames before the switch, aquarium frames after: one switch only.
    expect(frames.slice(0, i).every((f) => f.space === 'office')).toBe(true);
    expect(frames.slice(i).every((f) => f.space === 'aquarium')).toBe(true);
    // At the switch the office pose and the aquarium pose are the same viewpoint.
    const last = path.sample(DIVE.approach + DIVE.lean - 1e-12, frame()),
      first = path.sample(DIVE.approach + DIVE.lean + 1e-12, frame());
    expect(last.space).toBe('office');
    expect(first.space).toBe('aquarium');
    close(officeToAquarium(last), first, 1e-6);
    expect(first.fog).toBeCloseTo(DIVE.outsideFog, 6);
    // The water-contact wash peaks exactly at the crossing, on both sides of it.
    expect(last.veil).toBeCloseTo(DIVE.contactVeil, 6);
    expect(first.veil).toBeCloseTo(DIVE.contactVeil, 6);
    // The camera is then so close to the glass that the whole view is glass (no office edges).
    const f = tankFront(),
      gap = Math.hypot(last.x - f.x, last.z - f.z),
      halfHeight = gap * Math.tan((66 * Math.PI) / 360);
    expect(gap).toBeCloseTo(DIVE.switchGap, 6);
    expect(halfHeight).toBeLessThan(TANK.size.y / 2 - Math.abs(last.y - f.y));
    expect(halfHeight * 2.2).toBeLessThan(TANK.size.x / 2);
    // It ends at the usual swim start under normal haze, after a brief splash.
    const end = path.sample(path.duration, frame());
    expect(end.space).toBe('aquarium');
    close(end, { ...SPAWN, yaw: 0, pitch: -0.06 });
    expect(end.fog).toBeCloseTo(DIVE.insideFog, 9);
    expect(Math.max(...frames.map((f) => f.veil))).toBeGreaterThan(0.2);
    expect(Math.max(...frames.map((f) => f.veil))).toBeLessThan(0.5);
    expect(path.end.space).toBe('aquarium');
    expect(path.duration).toBeCloseTo(
      DIVE.approach + DIVE.lean + DIVE.settle,
      9,
    );
  });
  it('moves smoothly, never through furniture, at most a few centimetres a frame', () => {
    const frames = sampleAll(new DivePath('dive', inFront, false));
    for (let k = 1; k < frames.length; k++) {
      const a = frames[k - 1],
        b = frames[k];
      if (a.space !== b.space) continue;
      const step = Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
      expect(step).toBeLessThan(a.space === 'office' ? 0.02 : 0.25);
      expect(
        Math.abs(Math.atan2(Math.sin(b.yaw - a.yaw), Math.cos(b.yaw - a.yaw))),
      ).toBeLessThan(0.02);
    }
    for (const f of frames.filter((f) => f.space === 'office'))
      for (const box of OFFICE_FOOTPRINTS.filter(
        (b) => b !== STAND_FOOTPRINT,
      )) {
        const cx = Math.max(box.min.x, Math.min(f.x, box.max.x)),
          cz = Math.max(box.min.z, Math.min(f.z, box.max.z));
        expect(Math.hypot(f.x - cx, f.z - cz)).toBeGreaterThan(0.05);
      }
    for (const f of frames.filter((f) => f.space === 'aquarium')) {
      expect(f.y).toBeGreaterThan(AQUARIUM.min.y);
      expect(f.y).toBeLessThan(AQUARIUM.max.y);
    }
  });
  it('with reduced motion fades out, cuts and fades in without gliding', () => {
    const path = new DivePath('dive', inFront, true),
      frames = sampleAll(path);
    expect(path.duration).toBeCloseTo(DIVE.fade * 2, 9);
    for (const f of frames.filter((f) => f.space === 'office'))
      close(f, inFront);
    const cut = frames.findIndex((f) => f.space === 'aquarium');
    expect(frames[cut - 1].veil).toBeGreaterThan(0.99);
    expect(frames[cut].veil).toBeGreaterThan(0.99);
    expect(frames[frames.length - 1].veil).toBeLessThan(1e-6);
  });
});

describe('Pass 021 surfacing', () => {
  it('rises to the glass, passes out from the identical viewpoint and stands up in the room', () => {
    const from: Pose = {
        x: -4,
        y: AQUARIUM.max.y - 1.5,
        z: 3,
        yaw: 0.6,
        pitch: 0.2,
      },
      path = new DivePath('surface', from, false),
      frames = sampleAll(path),
      i = frames.findIndex((f) => f.space === 'office');
    expect(i).toBeGreaterThan(0);
    expect(frames.slice(i).every((f) => f.space === 'office')).toBe(true);
    const t = path.switchTime,
      last = path.sample(t - 1e-12, frame()),
      first = path.sample(t + 1e-12, frame());
    expect(last.space).toBe('aquarium');
    expect(first.space).toBe('office');
    close(aquariumToOffice(last), first, 1e-6);
    // Ends standing at eye height a step back from the tank, clear of furniture, facing the room.
    const end = path.sample(path.duration, frame());
    expect(end.y).toBeCloseTo(OFFICE.eyeHeight, 9);
    const f = tankFront();
    // A step out from the glass, in front of where the swimmer was (aquarium x -4).
    expect((end.x - f.x) * f.out.x + (end.z - f.z) * f.out.z).toBeCloseTo(
      1.05,
      6,
    );
    expect(end.z - f.z).toBeCloseTo(-4 * TANK_SCALE, 6);
    expect(-Math.sin(end.yaw)).toBeCloseTo(-1, 6); // looking -x, into the room
    for (const box of OFFICE_FOOTPRINTS) {
      const cx = Math.max(box.min.x, Math.min(end.x, box.max.x)),
        cz = Math.max(box.min.z, Math.min(end.z, box.max.z));
      expect(Math.hypot(end.x - cx, end.z - cz)).toBeGreaterThan(
        OFFICE.playerRadius,
      );
    }
    expect(path.end.space).toBe('office');
  });
});

describe('Pass 021 prompts', () => {
  it.each([-26, 0, 13, 14, 40])(
    'never offers tank surfacing in outer waters at y=%s',
    (y) => {
      expect(canSurface(y, 'outer')).toBe(false);
    },
  );
  it('offers the dive only near the tank and looking at it, and surfacing only near the surface', () => {
    expect(canDive(inFront)).toBe(true);
    expect(canDive({ ...inFront, yaw: inFront.yaw + Math.PI })).toBe(false);
    expect(canDive({ ...OFFICE.spawn, yaw: -Math.PI / 2, pitch: 0 })).toBe(
      false,
    );
    expect(canSurface(AQUARIUM.max.y - AQUARIUM.clearance)).toBe(true);
    expect(canSurface(SPAWN.y)).toBe(false);
  });
});

describe('Pass 021 refinements', () => {
  it('clears the tank glass only over the last half metre before the switch', () => {
    const f = tankFront(),
      at = (d: number) => ({ x: f.x + f.out.x * d, z: f.z + f.out.z * d });
    expect(glassClarity(at(1.2))).toBe(0);
    expect(glassClarity(at(DIVE.switchGap + 0.5))).toBe(0);
    expect(glassClarity(at(DIVE.switchGap))).toBe(1);
    expect(glassClarity(at(DIVE.switchGap + 0.25))).toBeCloseTo(0.5, 9);
    // Monotonic as the dive approaches.
    let previous = -1;
    for (let d = 1; d >= DIVE.switchGap; d -= 0.01) {
      const c = glassClarity(at(d));
      expect(c).toBeGreaterThanOrEqual(previous);
      previous = c;
    }
  });
  it('measures the bubbling distance from the tank, which shrinks as the dive approaches', () => {
    const path = new DivePath('dive', inFront, false),
      f = frame();
    const start = tankDistance(path.sample(0, f)),
      touch = tankDistance(path.sample(DIVE.approach + DIVE.lean - 1e-9, f));
    expect(touch).toBeLessThan(start);
    expect(touch).toBeLessThan(0.6);
  });
});

describe('Pass 021 interruptions', () => {
  it('resumes when the destination is chosen and cancels back to the start otherwise', () => {
    const dive = new DivePath('dive', inFront, false),
      surface = new DivePath(
        'surface',
        { x: -3, y: AQUARIUM.max.y - 1.5, z: 4, yaw: 0.3, pitch: 0.1 },
        false,
      );
    expect(interruptedChoice(dive, 'aquarium')).toBe('resume');
    expect(interruptedChoice(dive, 'office')).toBe('cancel');
    expect(interruptedChoice(surface, 'office')).toBe('resume');
    expect(interruptedChoice(surface, 'aquarium')).toBe('cancel');
    // Cancelling restores exactly where E was pressed, in the space it was pressed in.
    expect(dive.start.space).toBe('office');
    close(dive.start.pose, inFront);
    expect(surface.start.space).toBe('aquarium');
    close(surface.start.pose, {
      x: -3,
      y: AQUARIUM.max.y - 1.5,
      z: 4,
      yaw: 0.3,
      pitch: 0.1,
    });
    // The start is a copy: later changes to the caller's pose do not move it.
    const from = { ...inFront },
      path = new DivePath('dive', from, true);
    from.x += 5;
    expect(path.start.pose.x).toBeCloseTo(inFront.x, 9);
  });
});

describe('Pass 021 prompt region', () => {
  const f = tankFront(),
    facing = Math.atan2(f.out.x, f.out.z),
    // Offsets out of the glass and along it, looking straight at the glass centre.
    at = (ahead: number, along: number): Pose => {
      const x = f.x + f.out.x * ahead + f.out.z * along,
        z = f.z + f.out.z * ahead - f.out.x * along;
      return {
        x,
        y: OFFICE.eyeHeight,
        z,
        yaw: Math.atan2(x - f.x, z - f.z),
        pitch: -0.1,
      };
    };
  it('offers the dive only in front of the glass, not beside or behind the tank', () => {
    expect(canDive(at(0.8, 0))).toBe(true);
    expect(canDive(at(0.8, TANK.size.x / 2))).toBe(true);
    // Beside the tank, still looking at the glass centre.
    expect(canDive(at(0.3, TANK.size.x / 2 + 0.4))).toBe(false);
    // Level with or behind the glass.
    expect(canDive(at(0.05, 0.2))).toBe(false);
    expect(canDive(at(-0.3, 0.2))).toBe(false);
    expect(facing).toBeCloseTo(-Math.PI / 2, 9);
  });
  it('from anywhere it is offered, the dive path stays clear of the furniture', () => {
    let offered = 0;
    for (let ahead = 0; ahead <= 1.6; ahead += 0.1)
      for (let along = -1.2; along <= 1.2; along += 0.1) {
        const from = at(ahead, along);
        if (!canDive(from)) continue;
        // Pass 027: only where the player can stand (the glass office is snug around the tank).
        const standable = OFFICE_FOOTPRINTS.every((box) => {
          const cx = Math.max(box.min.x, Math.min(from.x, box.max.x)),
            cz = Math.max(box.min.z, Math.min(from.z, box.max.z));
          return Math.hypot(from.x - cx, from.z - cz) >= OFFICE.playerRadius;
        });
        if (!standable) continue;
        offered++;
        const frames = sampleAll(new DivePath('dive', from, false));
        for (const fr of frames.filter((fr) => fr.space === 'office'))
          for (const box of OFFICE_FOOTPRINTS.filter(
            (b) => b !== STAND_FOOTPRINT,
          )) {
            const cx = Math.max(box.min.x, Math.min(fr.x, box.max.x)),
              cz = Math.max(box.min.z, Math.min(fr.z, box.max.z));
            expect(Math.hypot(fr.x - cx, fr.z - cz)).toBeGreaterThan(0.05);
          }
      }
    expect(offered).toBeGreaterThan(50);
  }, 20000);
});

describe('Pass 022 surfacing where you are', () => {
  const near = (x: number, z: number): Pose => ({
    x,
    y: AQUARIUM.max.y - 1.5,
    z,
    yaw: 0.4,
    pitch: 0.1,
  });
  it.each([-18, -12, -4, 0, 5, 13, 18])(
    'from aquarium x %s, leaves through the nearest glass and stands clear of the furniture',
    (x) => {
      const from = near(x, -6),
        path = new DivePath('surface', from, false),
        f = tankFront(),
        exitX = Math.max(-15, Math.min(15, x));
      // The view crosses at the switch from the identical viewpoint, at the exit point.
      const last = path.sample(path.switchTime - 1e-12, frame()),
        first = path.sample(path.switchTime + 1e-12, frame());
      expect(last.space).toBe('aquarium');
      expect(first.space).toBe('office');
      close(aquariumToOffice(last), first, 1e-6);
      expect(last.x).toBeCloseTo(exitX, 6);
      // Stands in front of that part of the glass, at eye height, facing the room.
      const end = path.sample(path.duration, frame());
      expect(end.z - f.z).toBeCloseTo(exitX * TANK_SCALE, 6);
      expect(end.y).toBeCloseTo(OFFICE.eyeHeight, 9);
      for (const box of OFFICE_FOOTPRINTS) {
        const cx = Math.max(box.min.x, Math.min(end.x, box.max.x)),
          cz = Math.max(box.min.z, Math.min(end.z, box.max.z));
        expect(Math.hypot(end.x - cx, end.z - cz)).toBeGreaterThan(
          OFFICE.playerRadius,
        );
      }
      // Smooth throughout: no frame-to-frame jumps within a space.
      const frames = sampleAll(path);
      for (let k = 1; k < frames.length; k++) {
        const a = frames[k - 1],
          b = frames[k];
        if (a.space !== b.space) continue;
        const step = Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
        expect(step).toBeLessThan(a.space === 'office' ? 0.02 : 0.25);
      }
    },
  );
  it('takes longer to rise from further back, within bounds', () => {
    const close1 = new DivePath('surface', near(0, 11), false),
      far = new DivePath('surface', near(0, -13), false);
    expect(far.switchTime).toBeGreaterThan(close1.switchTime);
    expect(close1.switchTime - DIVE.out * 0.6).toBeGreaterThanOrEqual(
      DIVE.riseMin - 1e-9,
    );
    expect(far.switchTime - DIVE.out * 0.6).toBeLessThanOrEqual(
      DIVE.riseMax + 1e-9,
    );
  });
});

describe('Pass 022 pause-screen switch', () => {
  it('fades out where you are and back in at the other space, without moving', () => {
    const swimPose: Pose = { x: 3, y: 6, z: 2, yaw: 1, pitch: -0.2 },
      path = new DivePath('switch', inFront, false, {
        space: 'aquarium',
        pose: swimPose,
      });
    expect(path.start.space).toBe('office');
    expect(path.end.space).toBe('aquarium');
    expect(path.duration).toBeCloseTo(DIVE.fade * 2, 9);
    expect(path.switchTime).toBeCloseTo(DIVE.fade, 9);
    const frames = sampleAll(path);
    for (const f of frames) close(f, f.space === 'office' ? inFront : swimPose);
    // Fully veiled at the cut, clear at both ends.
    const before = path.sample(DIVE.fade - 1e-9, frame()),
      after = path.sample(DIVE.fade + 1e-9, frame());
    expect(before.veil).toBeGreaterThan(0.999);
    expect(after.veil).toBeGreaterThan(0.999);
    expect(frames[0].veil).toBeLessThan(1e-6);
    expect(path.sample(path.duration, frame()).veil).toBeLessThan(1e-6);
    expect(after.fog).toBeCloseTo(DIVE.insideFog, 9);
    // Choosing the destination again resumes it; the origin cancels it.
    expect(interruptedChoice(path, 'aquarium')).toBe('resume');
    expect(interruptedChoice(path, 'office')).toBe('cancel');
    // And back the other way.
    const back = new DivePath('switch', swimPose, false, {
      space: 'office',
      pose: inFront,
    });
    expect(back.start.space).toBe('aquarium');
    expect(back.end.space).toBe('office');
  });
});

describe('Pass 022 sound crossfade', () => {
  const swim: Pose = { x: -2, y: AQUARIUM.max.y - 1.5, z: 3, yaw: 0, pitch: 0 };
  it.each([
    ['dive', false],
    ['dive', true],
    ['surface', false],
    ['surface', true],
    ['switch', false],
  ] as const)(
    '%s (reduced %s) moves the soundscape smoothly from one space to the other',
    (kind, reduced) => {
      const path =
          kind === 'dive'
            ? new DivePath('dive', inFront, reduced)
            : kind === 'surface'
              ? new DivePath('surface', swim, reduced)
              : new DivePath('switch', inFront, true, {
                  space: 'aquarium',
                  pose: swim,
                }),
        frames = sampleAll(path),
        from = path.start.space === 'office' ? 0 : 1,
        to = 1 - from;
      expect(frames[0].water).toBeCloseTo(from, 9);
      expect(path.sample(path.duration, frame()).water).toBeCloseTo(to, 9);
      // One way only, without jumps (also across the switch, where it is halfway).
      for (let k = 1; k < frames.length; k++) {
        const step = (frames[k].water - frames[k - 1].water) * (to - from);
        expect(step).toBeGreaterThanOrEqual(-1e-12);
        expect(Math.abs(frames[k].water - frames[k - 1].water)).toBeLessThan(
          0.02,
        );
      }
      const at = path.sample(path.switchTime, frame());
      expect(at.water).toBeCloseTo(0.5, 6);
    },
  );
});

describe('dive backdrop continuity', () => {
  it('keeps entry blue through the scene switch and smoothly reveals the room while settling', () => {
    const path = new DivePath('dive', inFront, false);
    for (const time of [0, path.switchTime - 0.0001, path.switchTime])
      expect(path.sample(time, frame()).outlook).toBe(0);
    expect(path.sample(path.switchTime + 0.0001, frame()).outlook).toBeLessThan(
      1e-6,
    );
    const settling = path.duration - path.switchTime;
    expect(
      path.sample(path.switchTime + settling / 2, frame()).outlook,
    ).toBeCloseTo(0.5, 10);
    let previous = 0;
    for (let i = 0; i <= 100; i++) {
      const time = path.switchTime + (settling * i) / 100;
      const reveal = path.sample(time, frame()).outlook;
      expect(reveal).toBeGreaterThanOrEqual(previous);
      expect(reveal).toBeLessThanOrEqual(1);
      expect(path.sample(time, frame()).outlook).toBe(reveal); // Paused sampling cannot advance it.
      previous = reveal;
    }
    expect(path.sample(path.duration, frame()).outlook).toBe(1);
    expect(path.sample(path.duration + 100, frame()).outlook).toBe(1);
  });
  it('leaves the backdrop fully revealed for reduced motion, surfacing and pause-screen fades', () => {
    const paths = [
      new DivePath('dive', inFront, true),
      new DivePath('surface', { ...inFront, x: -4, y: 12.6, z: 2 }, false),
      new DivePath('surface', { ...inFront, x: -4, y: 12.6, z: 2 }, true),
      new DivePath('switch', inFront, false),
    ];
    for (const path of paths)
      for (const time of [0, path.switchTime, path.duration / 2, path.duration])
        expect(path.sample(time, frame()).outlook).toBe(1);
  });
});
