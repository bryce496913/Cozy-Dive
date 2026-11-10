import { describe, expect, it } from 'vitest';
import { AQUARIUM, SPAWN } from '../src/config/world';
import { OFFICE, OFFICE_FOOTPRINTS, TANK } from '../src/config/office';
import {
  DIVE,
  DivePath,
  aquariumToOffice,
  canDive,
  canSurface,
  officeToAquarium,
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
const inFront: Pose = {
  x: 1.2,
  y: OFFICE.eyeHeight,
  z: 0.15,
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
        (b) => b !== OFFICE_FOOTPRINTS[3],
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
    const t = DIVE.rise + DIVE.out * 0.6,
      last = path.sample(t - 1e-12, frame()),
      first = path.sample(t + 1e-12, frame());
    expect(last.space).toBe('aquarium');
    expect(first.space).toBe('office');
    close(aquariumToOffice(last), first, 1e-6);
    // Ends standing at eye height a step back from the tank, clear of furniture, facing the room.
    const end = path.sample(path.duration, frame());
    expect(end.y).toBeCloseTo(OFFICE.eyeHeight, 9);
    const f = tankFront();
    expect(Math.hypot(end.x - f.x, end.z - f.z)).toBeCloseTo(1.05, 6);
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
