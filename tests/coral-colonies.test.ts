import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { BRANCHING_COLONIES } from '../src/config/coralColonies';
import { Aquarium } from '../src/environment/Aquarium';
import { channelWeight } from '../src/environment/outer/OuterTerrain';
import {
  OUTER_REEF,
  inCleftClear,
  outerReefLayout,
} from '../src/environment/outer/OuterReefLayout';
import { placementMatrix } from '../src/environment/outer/OuterReef';
import { OUTER } from '../src/config/passage';
import { ReefAsset } from '../validation/ReefAsset';

/** V0.7 Pass 077: naturally grown branching colonies, with colliders that keep routes clear. */
const reef = new ReefAsset();
const tris = (name: string) =>
  reef.primitives(name).reduce((s, p) => s + p.indices.length / 3, 0);
/** A colony's collider point sets (colony space), straight from the library. */
const colliderPoints = (i: number) => {
  const out: number[][] = [];
  for (let k = 0; ; k++) {
    const name = `COLLIDER_Coral_Branching_${i}_${k}`;
    if (!reef.has(name)) break;
    out.push(Array.from(reef.primitive(name).positions));
  }
  return out;
};

describe('V0.7 Pass 077 branching colony forms', () => {
  it('gives each colony its own archetype, with no tall single trunk', () => {
    expect(new Set(BRANCHING_COLONIES.map((c) => c.archetype)).size).toBe(3);
    for (const c of BRANCHING_COLONIES) {
      expect(c.primaries).toHaveLength(5); // one random draw each: placement is unchanged
      let top = 0,
        reach = 0;
      for (const [a, b] of c.primaries) {
        top = Math.max(top, a[1], b[1]);
        reach = Math.max(reach, Math.hypot(a[0], a[2]), Math.hypot(b[0], b[2]));
        // No primary rises near-vertically for more than 0.55 m (the old trunk rose 1.25 m).
        const rise = b[1] - a[1],
          run = Math.hypot(b[0] - a[0], b[2] - a[2]);
        if (run < rise * 0.35) expect(rise).toBeLessThan(0.55);
      }
      // Colonies are now about as broad as they are tall (the old frame was 1.8 m by 0.7 m).
      expect(top).toBeLessThan(1.05);
      expect(reach * 2).toBeGreaterThan(top);
      // ...and stay inside the tank's reserved 0.95 m formation footprint.
      expect(reach).toBeLessThan(0.86);
    }
  });

  it('builds the tank colliders from the same primaries, inside the reserved footprint', () => {
    const q = new Aquarium();
    try {
      const branching = q.hardscape.formations.filter(
        (f) => f.kind === 'branching',
      );
      expect(branching).toHaveLength(3);
      for (const f of branching) {
        expect(f.colliders).toHaveLength(5);
        for (const c of f.colliders) {
          expect(
            Math.max(
              Math.abs(c.min.x - f.position.x),
              Math.abs(c.max.x - f.position.x),
              Math.abs(c.min.z - f.position.z),
              Math.abs(c.max.z - f.position.z),
            ),
          ).toBeLessThan(0.95);
          expect(c.max.y - f.position.y).toBeLessThan(1.1);
        }
      }
    } finally {
      q.dispose();
    }
  });

  it.each([0, 1, 2])(
    'authors colony %i as one grounded surface within budget, with a stable distance level',
    (i) => {
      const near = tris(`Coral_Branching_${i}`),
        far = tris(`Coral_Branching_${i}_LOD1`),
        tips = tris(`Coral_Branching_${i}_Tips`);
      expect(near).toBeLessThan(42000);
      expect(far).toBeLessThan(near * 0.35);
      expect(tips).toBeGreaterThan(0);
      expect(near + tips).toBeLessThan(52000); // the Pass 069 colonies were 49k-55k
      // Grounded: the encrusting foot reaches below the colony origin, around its centre.
      for (const level of ['', '_LOD1']) {
        const p = reef.primitive(`Coral_Branching_${i}${level}`).positions;
        let low = Infinity,
          footed = 0;
        for (let k = 0; k < p.length; k += 3) {
          low = Math.min(low, p[k + 1]);
          if (p[k + 1] < 0.02 && Math.hypot(p[k], p[k + 2]) < 0.3) footed++;
        }
        expect(low).toBeLessThan(-0.03);
        expect(footed).toBeGreaterThan(20);
      }
      expect(colliderPoints(i)).toHaveLength(5);
    },
  );

  it('keeps every outer-reef colony clear of the gully, the tunnel mouth and the cleft', () => {
    const layout = outerReefLayout();
    let checked = 0;
    for (const p of layout.placements) {
      if (p.family !== 'branching') continue;
      const m = placementMatrix(p),
        v = new THREE.Vector3();
      for (const pts of colliderPoints(p.template))
        for (let k = 0; k < pts.length; k += 3) {
          v.set(pts[k], pts[k + 1], pts[k + 2]).applyMatrix4(m);
          expect(channelWeight(v.x, v.z)).toBeLessThan(0.6);
          expect(
            Math.abs(v.x) < OUTER_REEF.mouthClear.halfWidth &&
              v.z > OUTER.cliffZ - OUTER_REEF.mouthClear.depth,
          ).toBe(false);
          expect(inCleftClear(v.x, v.z, 0)).toBe(false);
        }
      checked++;
    }
    expect(checked).toBeGreaterThan(10);
  });
});
