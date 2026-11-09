import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { ASSET_REGISTRY } from '../src/assets/AssetRegistry';
import { NUDIBRANCH_VARIANTS } from '../src/creatures/discoveries/Nudibranchs';
import { ReefAsset } from '../validation/ReefAsset';

const anchored = new ReefAsset(
  'public/assets/models/creatures/anchored-life.glb',
);
const accepted = new ReefAsset('tools/art/pass015/anchored-life.pass013.glb');
const slugs = new ReefAsset('public/assets/models/creatures/nudibranchs.glb');
const SKINS = [
  'HorseBody',
  'HorseTail',
  'FrogBody',
  'FrogFoot',
  'FrogLure',
  'MorayBody',
  'MorayDorsal',
  'MorayHead',
  'MorayJaw',
  'AnemoneTissue',
];
const bounds = (p: Float32Array): THREE.Box3 =>
  new THREE.Box3().setFromArray(p);

describe('Pass 015 re-authored anchored creatures', () => {
  it('keeps every accepted node, hierarchy root and controller-local frame', () => {
    for (const node of accepted.doc.nodes) {
      expect(anchored.has(node.name), node.name).toBe(true);
      const now = anchored.node(node.name);
      expect(now.translation ?? [0, 0, 0]).toEqual(
        node.translation ?? [0, 0, 0],
      );
      expect(now.rotation).toEqual(node.rotation);
      expect(now.scale).toEqual(node.scale);
    }
    for (const name of ASSET_REGISTRY.anchored.requiredNodes)
      expect(anchored.has(name), name).toBe(true);
  });
  it('adds only millimetre-scale relief and authored colour to the accepted skins', () => {
    for (const name of SKINS) {
      const before = accepted.primitive(name),
        after = anchored.primitive(name);
      expect(after.attributes, name).toContain('COLOR_0');
      expect(after.positions.every(Number.isFinite), name).toBe(true);
      expect(after.positions.length, name).toBeGreaterThanOrEqual(
        before.positions.length,
      );
      const a = bounds(before.positions),
        b = bounds(after.positions);
      // Relief never grows a part by more than 1.2 cm in any direction (anemone bulbs, rings).
      expect(b.min.distanceTo(a.min), name).toBeLessThan(0.012 * Math.sqrt(3));
      expect(b.max.distanceTo(a.max), name).toBeLessThan(0.012 * Math.sqrt(3));
    }
    // The seated frogfish keeps its sole on the deck: no relief below the accepted underside.
    const frog = bounds(anchored.primitive('FrogBody').positions);
    expect(frog.min.y).toBeGreaterThanOrEqual(
      bounds(accepted.primitive('FrogBody').positions).min.y - 1e-4,
    );
  });
  it('preserves the moray centreline parameter in UV.v for GPU unfolding', () => {
    const body = anchored.primitive('MorayBody');
    expect(body.uvs).toBeDefined();
    let worst = 0;
    for (let i = 0; i < body.positions.length / 3; i++)
      worst = Math.max(
        worst,
        Math.abs(body.positions[i * 3 + 2] - (1 - body.uvs![i * 2 + 1])),
      );
    // Local z is the centreline parameter (glTF stores V flipped: z = 1 - v, exactly as in the
    // accepted Pass 013 export); relief only moves it by the skin-fold amplitude.
    expect(worst).toBeLessThan(0.01);
  });
});

describe('Pass 015 authored nudibranchs', () => {
  it('provides one detailed species per accepted variant inside its validated surface envelope', () => {
    expect(ASSET_REGISTRY.nudibranchs.requiredNodes).toHaveLength(
      NUDIBRANCH_VARIANTS.length,
    );
    NUDIBRANCH_VARIANTS.forEach((variant, i) => {
      const node = slugs.node(`Nudibranch_${i + 1}`);
      expect(node.extras?.species).toBe(variant.id);
      const p = slugs.primitive(node.name);
      for (const attr of ['POSITION', 'NORMAL', 'TEXCOORD_0', 'COLOR_0'])
        expect(p.attributes).toContain(attr);
      expect(p.indices.length / 3).toBeGreaterThan(4000);
      let reach = 0,
        low = Infinity,
        high = -Infinity;
      for (let k = 0; k < p.positions.length; k += 3) {
        reach = Math.max(reach, Math.hypot(p.positions[k], p.positions[k + 2]));
        low = Math.min(low, p.positions[k + 1]);
        high = Math.max(high, p.positions[k + 1]);
      }
      // surfaceHome validated a 0.285 crawling radius and 0.26 body height (3 mm ripple margin).
      expect(reach).toBeLessThan(0.285);
      expect(low).toBeGreaterThanOrEqual(-1e-5);
      expect(high).toBeLessThan(0.26 - 0.003);
    });
  });
});
