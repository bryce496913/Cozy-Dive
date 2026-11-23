import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import type { AssetLoader } from '../src/assets/AssetLoader';
import { BOLT, SharkBolt, type BoltWorld } from '../src/creatures/sharkBolt';
import { RestingSharks } from '../src/environment/cave/RestingSharks';
import { CAVE_LIFE } from '../src/environment/cave/CaveLife';

/**
 * V0.8 Pass 097: the startled whitetips' tail. The morphs were driven correctly but far too
 * weakly for the dash (a rod sliding along); these follow the stroke through rest, startle, dash
 * and settle, and through repeated startles.
 */

/** A stand-in for the whitetip's lease: Body and Body_LOD1 carrying the authored morph names. */
function fakeLoader(): Pick<AssetLoader, 'acquire' | 'evictUnused'> {
  return {
    acquire: async () => {
      const model = new THREE.Group();
      for (const name of ['Body', 'Body_LOD1']) {
        const m = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.4, 0.5));
        m.name = name;
        m.morphTargetDictionary = { Stroke_Left: 0, Stroke_Right: 1 };
        m.morphTargetInfluences = [0, 0];
        model.add(m);
      }
      return { model, animations: [], release: () => undefined };
    },
    evictUnused: () => undefined,
  };
}
type Probe = {
  rigs: {
    bolt: SharkBolt;
    near: THREE.Mesh;
    root: THREE.Group;
  }[];
};
// The rigs are private to RestingSharks; the test reads their state (it does not change it).
const probe = (s: RestingSharks) => s as unknown as Probe;
const weight = (m: THREE.Mesh) => {
  const w = m.morphTargetInfluences!;
  return w[0] - w[1];
};

async function sharks() {
  const s = new RestingSharks(
    CAVE_LIFE.resting,
    // Only `acquire` and `evictUnused` are used by RestingSharks; the stand-in provides those.
    fakeLoader() as AssetLoader,
    CAVE_LIFE.settle,
  );
  expect(await s.ready).toBe(true);
  return s;
}

describe('V0.8 Pass 097 resting whitetip tails', () => {
  it('beats the tail hard through the dash, in time with its speed, and fades as it settles', async () => {
    const s = await sharks(),
      rig = probe(s).rigs[0],
      at = rig.root.position,
      eye = { x: at.x + 1.5, y: at.y + 0.5, z: at.z },
      player = {
        active: true,
        position: eye,
        velocity: { x: 0, y: 0, z: 0 },
      };
    let dashPeak = 0,
      crossings = 0,
      last = 0,
      dashTime = 0;
    const settleWeights: number[] = [];
    for (let i = 0; i < 30 * 30; i++) {
      s.update(1 / 30, true, false, player);
      const w = weight(rig.near),
        mood = rig.bolt.mood;
      // The model shows exactly the stroke the bolt computed.
      if (mood !== 'rest') expect(w).toBeCloseTo(rig.bolt.effort, 10);
      if (mood === 'flee' && rig.bolt.speed > 2) {
        dashPeak = Math.max(dashPeak, Math.abs(w));
        if (Math.sign(w) !== Math.sign(last) && last !== 0) crossings++;
        dashTime += 1 / 30;
      }
      if (mood === 'settle') settleWeights.push(Math.abs(w));
      last = w;
      if (rig.bolt.resting && i > 30) break;
    }
    // Strong beats while dashing (the stroke morph overdriven past its cruising weight of 1)...
    expect(dashPeak).toBeGreaterThan(1.5);
    // ...at a rate matching its speed (base plus per m/s: about 2.3 Hz at the dash).
    const hz = crossings / 2 / dashTime;
    expect(hz).toBeGreaterThan(1.8);
    expect(hz).toBeLessThan(2.9);
    // Beats ease while it cruises to settle and fade as it touches down.
    expect(Math.max(...settleWeights)).toBeLessThan(dashPeak);
    expect(rig.bolt.resting).toBe(true);
    expect(rig.bolt.sway).toBe(0);
    s.dispose();
  }, 30000);

  it('keeps its tail working through repeated startles (no frozen rig)', async () => {
    const s = await sharks(),
      rig = probe(s).rigs[0],
      player = {
        active: true,
        position: { x: 0, y: 0, z: 0 },
        velocity: { x: 0, y: 0, z: 0 },
      };
    for (let round = 0; round < 4; round++) {
      // Wait out its calm, then come close where it now lies.
      let moving = 0,
        range = 0,
        min = Infinity,
        max = -Infinity;
      for (let i = 0; i < 30 * 40; i++) {
        const at = rig.root.position;
        player.position = { x: at.x + 1.2, y: at.y + 0.4, z: at.z };
        s.update(1 / 30, true, false, player);
        if (rig.bolt.mood === 'flee') {
          moving++;
          min = Math.min(min, weight(rig.near));
          max = Math.max(max, weight(rig.near));
        }
        if (moving && rig.bolt.resting) break;
      }
      range = max - min;
      expect(moving, `round ${round}`).toBeGreaterThan(30);
      expect(range, `round ${round}`).toBeGreaterThan(2.5);
    }
    s.dispose();
  }, 60000);

  it('is gentler with reduced motion (no flinch bend, no sway) and still while paused', async () => {
    const s = await sharks(),
      rig = probe(s).rigs[0],
      at = rig.root.position,
      player = {
        active: true,
        position: { x: at.x + 1.5, y: at.y + 0.5, z: at.z },
        velocity: { x: 0, y: 0, z: 0 },
      };
    let peak = 0;
    for (let i = 0; i < 30 * 4; i++) {
      s.update(1 / 30, true, true, player);
      if (rig.bolt.mood === 'flinch') expect(weight(rig.near)).toBe(0);
      expect(rig.bolt.sway).toBe(0);
      peak = Math.max(peak, Math.abs(weight(rig.near)));
    }
    expect(peak).toBeGreaterThan(0.3);
    expect(peak).toBeLessThan(BOLT.dashStroke * (1 + BOLT.thrust) * 0.6 + 1e-9);
    // Paused (inactive, or no time): nothing moves.
    const before = weight(rig.near),
      p = { ...rig.root.position };
    s.update(1 / 30, false, true, player);
    s.update(0, true, true, player);
    expect(weight(rig.near)).toBe(before);
    expect(rig.root.position).toEqual(p);
    s.dispose();
  }, 30000);
});

describe('V0.8 Pass 097 bolt stroke', () => {
  it('beats hardest while gaining speed, and sways the body against the tail', () => {
    const world: BoltWorld = {
      floor: () => 0,
      over: () => 0,
      avoid: () => undefined,
      settleAt: () => ({ x: 30, z: 0, yaw: 0 }),
    };
    const b = new SharkBolt({ x: 0, z: 0, yaw: 0 }, 0.15, 0.15);
    expect(b.startle({ x: -1, y: 0.5, z: 0 })).toBe(true);
    let early = 0,
      late = 0;
    for (let i = 0; i < 30 * 3; i++) {
      b.update(1 / 30, world, false, { x: -1, y: 0.5, z: 0 });
      if (b.mood === 'flee') {
        if (b.moodTime < 0.6) early = Math.max(early, Math.abs(b.effort));
        else if (b.moodTime < 2) late = Math.max(late, Math.abs(b.effort));
        // The head swings opposite the tail.
        expect(Math.sign(b.sway) * Math.sign(b.effort)).toBeLessThanOrEqual(0);
      }
    }
    expect(early).toBeGreaterThan(late);
  });
});
