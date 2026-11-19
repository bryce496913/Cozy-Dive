import { describe, expect, it } from 'vitest';
import type { PlayerPresence } from '../src/fish/FishDiverReaction';
import { createPose } from '../src/environment/outer/PosedFish';
import { ReefCleaningStation } from '../src/creatures/reefCleaners';
import { SealPup, WeddellSeal, iceLimits } from '../src/creatures/iceLife';
import { caveNooks, nooksClear } from '../src/environment/cave/CaveNooks';
import { CAVE_ROCKS } from '../src/environment/cave/CaveEnvironment';
import { ICE } from '../src/config/passage';

const run = (n: number, step: (dt: number) => void) => {
  for (let i = 0; i < n; i++) step(1 / 30);
};
const away: PlayerPresence = {
  active: true,
  position: { x: 100, y: 0, z: 100 },
  velocity: { x: 0, y: 0, z: 0 },
};

describe('reef cleaning station', () => {
  it('a client comes, is cleaned with the wrasse at its side, and leaves', () => {
    const s = new ReefCleaningStation(createPose(), createPose(), {
      x: 0,
      y: -10,
      z: -40,
    });
    s.call();
    let cleaned = false;
    run(30 * 120, () => {
      s.update(1 / 30, away);
      if (s.mood === 'cleaning') {
        cleaned = true;
        const c = s.client.pose.position,
          w = s.wrasse.pose.position;
        expect(Math.hypot(c.x - w.x, c.y - w.y, c.z - w.z)).toBeLessThan(1);
      }
    });
    expect(cleaned).toBe(true);
  });
  it('a close swimmer only ends the visit, calmly', () => {
    const s = new ReefCleaningStation(createPose(), createPose(), {
      x: 0,
      y: -10,
      z: -40,
    });
    s.call();
    run(30 * 60, () => s.update(1 / 30, away));
    const near: PlayerPresence = {
      active: true,
      position: { x: 0, y: -9.4, z: -40 },
      velocity: { x: 0, y: 0, z: 0 },
    };
    s.update(1 / 30, near);
    expect(['leaving', 'waiting']).toContain(s.mood);
  });
});

describe('Weddell seal pup', () => {
  it('stays close to its mother, below the ice', () => {
    const limits = iceLimits(() => 0),
      mother = new WeddellSeal(createPose(), limits, 0),
      pup = new SealPup(createPose(), mother.pose, limits);
    run(30 * 300, (dt) => {
      mother.update(dt, away);
      pup.update(dt);
      const m = mother.pose.position,
        p = pup.pose.position;
      expect(Math.hypot(m.x - p.x, m.z - p.z)).toBeLessThan(5);
      if (m.y <= ICE.ceiling) expect(p.y).toBeLessThan(ICE.ceiling);
    });
  });
});

describe('swell shark', () => {
  it('lies in the gap between the boulders, clear of the others', () => {
    const n = caveNooks(20);
    expect(nooksClear(n)).toBe(true);
    for (const r of CAVE_ROCKS)
      expect(
        Math.hypot(r.x - n.swell.at.x, r.z - n.swell.at.z),
      ).toBeGreaterThan(r.size * 0.45);
  });
});
