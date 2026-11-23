import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { ICE } from '../src/config/passage';
import {
  IceEnvironment,
  holeEdge,
  seaIceSheet,
} from '../src/environment/ice/IceEnvironment';
import {
  GROWTH_SITES,
  ShipwreckModel,
  onBoatDeck,
} from '../src/environment/wreck/ShipwreckModel';
import { SHIP } from '../src/environment/wreck/WreckLayout';
import { testGeology } from '../validation/geologyModel';

/** V0.8 Pass 093: final environment polish. */

describe('V0.8 Pass 093 under the ice', () => {
  it('cuts the breathing holes along their own smooth outline (no sawtooth crown)', () => {
    const g = seaIceSheet(ICE.ceiling),
      p = g.getAttribute('position'),
      key = (i: number) => `${p.getX(i).toFixed(4)},${p.getZ(i).toFixed(4)}`,
      edges = new Map<string, [number, number, number]>();
    // Boundary edges are the ones only one triangle has.
    for (let t = 0; t < p.count; t += 3)
      for (const [a, b] of [
        [t, t + 1],
        [t + 1, t + 2],
        [t + 2, t],
      ]) {
        const k = [key(a), key(b)].sort().join('|'),
          e = edges.get(k);
        edges.set(k, e ? [e[0], e[1], e[2] + 1] : [a, b, 1]);
      }
    for (const h of ICE.holes) {
      let rim = 0,
        worst = 0;
      for (const [a, b, n] of edges.values()) {
        if (n !== 1) continue;
        for (const i of [a, b]) {
          const x = p.getX(i),
            z = p.getZ(i),
            d = Math.hypot(x - h.x, z - h.z);
          if (d > h.r * 2) continue;
          rim++;
          worst = Math.max(
            worst,
            Math.abs(d - holeEdge(h, Math.atan2(z - h.z, x - h.x))),
          );
        }
      }
      expect(rim, `hole at ${h.x}, ${h.z}`).toBeGreaterThan(20);
      // Every vertex of the hole's edge lies on its outline (the dropped grid triangles left
      // teeth up to a grid cell, 0.5 m, deep).
      expect(worst, `hole at ${h.x}, ${h.z}`).toBeLessThan(0.01);
    }
    g.dispose();
  });

  it('builds the dropstones and outcrops from authored rock, solid, at the same places', () => {
    const code = new IceEnvironment(),
      authored = new IceEnvironment(testGeology()),
      rock = (e: IceEnvironment) => {
        let n = 0;
        e.root.traverse((o) => {
          if (o instanceof THREE.Mesh && o.name === 'Dropstones')
            n = o.geometry.getAttribute('position').count;
        });
        return n;
      };
    expect(authored.stones).toEqual(code.stones);
    expect(rock(authored)).toBeGreaterThan(rock(code) * 2);
    // Every stone now carries collision (only those over a metre did).
    expect(authored.colliders.length).toBeGreaterThan(code.colliders.length);
    code.dispose();
    authored.dispose();
  }, 60_000);
});

describe('V0.8 Pass 093 shipwreck', () => {
  it('settles more of its growth on the decks (the same sites, rebalanced)', () => {
    expect(GROWTH_SITES).toHaveLength(30);
    const deck = GROWTH_SITES.filter((s) => s.side === 0).length;
    // 7 of the 30 sites were on the decks before this pass (23%); now 11 (37%).
    expect(deck).toBeGreaterThanOrEqual(11);
  });

  it('grows colonies on the boat deck, clear of the wheelhouse and the funnel', () => {
    const model = new ShipwreckModel(),
      roof = SHIP.bridge.top + 0.22,
      m = new THREE.Matrix4(),
      at = new THREE.Vector3();
    let onRoof = 0;
    model.root.traverse((o) => {
      if (!(o instanceof THREE.InstancedMesh) || !/Wreck /.test(o.name)) return;
      for (let i = 0; i < o.count; i++) {
        o.getMatrixAt(i, m);
        at.setFromMatrixPosition(m);
        if (Math.abs(at.y - roof) < 0.01) {
          onRoof++;
          expect(onBoatDeck(at.x, at.z)).toBe(true);
        }
      }
    });
    // Colonies that settle over the deckhouse now grow on its roof (they were dropped).
    expect(onRoof).toBeGreaterThanOrEqual(4);
    model.dispose();
  });
});
