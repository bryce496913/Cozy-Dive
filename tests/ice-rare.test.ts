import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { ICE } from '../src/config/passage';
import type { Vec3 } from '../src/config/world';
import { iceLimits } from '../src/creatures/iceLife';
import {
  RARE,
  RARE_IDS,
  RareDirector,
  LEOPARD,
  type RareId,
} from '../src/creatures/iceRare';
import type { SightCandidate } from '../src/discovery/journal';
import { SIGHTS } from '../src/discovery/sights';
import { IceRare } from '../src/environment/ice/IceRare';
import { iceFloor } from '../src/environment/ice/IceTerrain';
import { createPose } from '../src/environment/outer/PosedFish';
import type { PlayerPresence } from '../src/fish/FishDiverReaction';
import { AssetLoader } from '../src/assets/AssetLoader';

const v = (x: number, y: number, z: number): Vec3 => ({ x, y, z });
const presence = (p: Vec3, active = true): PlayerPresence => ({
  position: p,
  velocity: v(0, 0, 0),
  active,
});
const limits = iceLimits(iceFloor);
const eye = v(0, 6, -14);
/** In the water and inside the tank (or up in the ice above it, passing through a hole). */
const contained = (p: Vec3, id: RareId) => {
  if (p.y > ICE.ceiling - 0.5) {
    expect(
      ICE.holes.some((h) => Math.hypot(p.x - h.x, p.z - h.z) < h.r + 0.6),
      `${id} in a hole`,
    ).toBe(true);
    return;
  }
  expect(p.x).toBeGreaterThanOrEqual(limits.minX - 1e-6);
  expect(p.x).toBeLessThanOrEqual(limits.maxX + 1e-6);
  expect(p.z).toBeGreaterThanOrEqual(limits.minZ - 1e-6);
  expect(p.z).toBeLessThanOrEqual(limits.maxZ + 1e-6);
  expect(p.y).toBeGreaterThan(iceFloor(p.x, p.z));
};

describe('v0.6 Pass 048: rare encounters under the ice', () => {
  it('none comes in the first minute; then one at a time, never the same twice running, and reproducibly', () => {
    const run = (seed: number) => {
      const d = new RareDirector(createPose, limits, seed),
        order: RareId[] = [];
      let first = -1,
        t = 0;
      for (let i = 0; i < 10 * 3600; i++, t += 0.1) {
        const was = d.current?.id;
        d.update(0.1, presence(eye), false);
        const now = d.current?.id;
        if (now && now !== was) {
          if (first < 0) first = t;
          order.push(now);
        }
        // One at a time.
        expect(
          RARE_IDS.filter((id) => d.encounters[id].active).length,
        ).toBeLessThanOrEqual(1);
      }
      return { first, order };
    };
    const a = run(48011),
      b = run(48011);
    expect(a).toEqual(b);
    expect(a.first).toBeGreaterThanOrEqual(RARE.first[0]);
    expect(a.order.length).toBeGreaterThan(5);
    for (let i = 1; i < a.order.length; i++)
      expect(a.order[i]).not.toBe(a.order[i - 1]);
    // Occasional: well under one an hour per kind on average... and at most about one every 3 minutes.
    expect(a.order.length).toBeLessThan(3600 / RARE.gap[0]);
  });
  for (const id of RARE_IDS)
    it(`${id}: enters out of sight or through a hole, keeps to the water, gives the swimmer room, and leaves`, () => {
      const d = new RareDirector(createPose, limits, 7);
      expect(d.bring(id, eye)).toBe(true);
      const e = d.encounters[id];
      // Its entrance: far from the swimmer, or up in a hole in the ice.
      for (const p of e.poses) {
        const far =
            Math.hypot(p.position.x - eye.x, p.position.z - eye.z) >=
            RARE.hidden - 1e-6,
          above = p.position.y > ICE.ceiling - 0.5;
        expect(far || above, `${id} enters unseen`).toBe(true);
      }
      let closest = Infinity,
        steps = 0;
      while (e.active && steps++ < 10 * 600) {
        d.update(0.1, presence(eye), false);
        for (const p of e.poses) {
          if (p.position.y < ICE.ceiling - 0.5)
            closest = Math.min(
              closest,
              Math.hypot(
                p.position.x - eye.x,
                p.position.y - eye.y,
                p.position.z - eye.z,
              ),
            );
          contained(p.position, id);
        }
      }
      expect(e.active, `${id} leaves`).toBe(false);
      expect(d.current).toBeUndefined();
      if (id === 'leopard-seal')
        expect(closest).toBeGreaterThan(LEOPARD.look - 1.6);
      if (id === 'minke-whale' || id === 'killer-whales')
        expect(closest).toBeGreaterThan(7.5);
    });
  it('holds still while paused (not active), and carries on after', () => {
    const d = new RareDirector(createPose, limits, 7);
    d.bring('leopard-seal', eye);
    for (let i = 0; i < 30; i++) d.update(0.1, presence(eye), false);
    const p = d.encounters['leopard-seal'].poses[0].position,
      before = { ...p };
    // The scene does not update its encounters while paused (`active` false): nothing moves.
    expect({ ...p }).toEqual(before);
    for (let i = 0; i < 30; i++) d.update(0.1, presence(eye), false);
    expect(Math.hypot(p.x - before.x, p.z - before.z)).toBeGreaterThan(0.1);
  });
  it('with reduced motion the squid’s eyes do not blink, and the leopard seal circles more gently', () => {
    const d = new RareDirector(createPose, limits, 7);
    d.bring('colossal-squid', eye);
    let dips = 0,
      last = 0;
    for (let i = 0; i < 140; i++) {
      d.update(0.1, presence(eye), true);
      if (d.squid.glow < last - 0.3) dips++;
      last = d.squid.glow;
    }
    expect(dips).toBe(0);
  });
  it('an animal counts as seen only while its encounter is under way', () => {
    const list: SightCandidate[] = [],
      loader = new AssetLoader(() => new Promise(() => undefined)),
      rare = new IceRare(loader, limits, list),
      camera = new THREE.PerspectiveCamera();
    expect(list).toHaveLength(0);
    rare.director.bring('minke-whale', eye);
    rare.update(0.1, true, false, presence(eye), camera);
    expect(list.map((c) => c.id)).toEqual(['species:minke-whale']);
    while (rare.director.current)
      rare.update(0.1, true, false, presence(eye), camera);
    rare.update(0.1, true, false, presence(eye), camera);
    expect(list).toHaveLength(0);
    // Arriving again clears anything under way.
    rare.director.bring('toothfish', eye);
    rare.update(0.1, true, false, presence(eye), camera);
    rare.arrive();
    expect(list).toHaveLength(0);
    expect(rare.director.current).toBeUndefined();
    rare.dispose();
    loader.dispose();
  });
  it('names its sights once', () => {
    for (const id of [
      'species:leopard-seal',
      'species:minke-whale',
      'species:killer-whale',
      'species:antarctic-toothfish',
      'species:colossal-squid',
      'species:polar-bear',
    ])
      expect(SIGHTS.some((s) => s.id === id)).toBe(true);
    expect(new Set(SIGHTS.map((s) => s.id)).size).toBe(SIGHTS.length);
  });
});
