import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { ASSET_REGISTRY } from '../src/assets/AssetRegistry';
import { NUDIBRANCH_VARIANTS } from '../src/creatures/discoveries/Nudibranchs';
import {
  FROGFISH_JAW_HINGE,
  FROGFISH_LURE_BASE,
  FROGFISH_YAWN,
} from '../src/creatures/discoveries/Frogfish';
import { ReefAsset } from '../validation/ReefAsset';

const anchored = new ReefAsset(
  'public/assets/models/creatures/anchored-life.glb',
);
const accepted = new ReefAsset('tools/art/pass015/anchored-life.pass013.glb');
const slugs = new ReefAsset('public/assets/models/creatures/nudibranchs.glb');
// The frogfish was re-authored from scratch after Pass 015 (see its own suite below), so only the
// other creatures are held to the Pass 015 "relief and colour only" contract.
const SKINS = [
  'HorseBody',
  'HorseTail',
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

describe('re-authored frogfish with a hinged jaw', () => {
  const PARTS = ['FrogBody', 'FrogJaw', 'FrogLure', 'FrogFoot'] as const;
  const hinge = new THREE.Vector3(
      FROGFISH_JAW_HINGE.x,
      FROGFISH_JAW_HINGE.y,
      FROGFISH_JAW_HINGE.z,
    ),
    lureBase = new THREE.Vector3(
      FROGFISH_LURE_BASE.x,
      FROGFISH_LURE_BASE.y,
      FROGFISH_LURE_BASE.z,
    );
  /** Every vertex of a part in the frogfish body frame (jaw at a given gape, lure on its pivot). */
  const bodyFrame = (
    name: (typeof PARTS)[number],
    gape = 0,
  ): THREE.Vector3[] => {
    const out: THREE.Vector3[] = [],
      jaw = new THREE.Matrix4()
        .makeTranslation(hinge.x, hinge.y, hinge.z)
        .multiply(new THREE.Matrix4().makeRotationX(gape));
    for (const p of anchored.primitives(name))
      for (let i = 0; i < p.positions.length; i += 3) {
        const v = new THREE.Vector3().fromArray(p.positions, i);
        if (name === 'FrogJaw') v.applyMatrix4(jaw);
        if (name === 'FrogLure') v.add(lureBase);
        out.push(v);
      }
    return out;
  };
  it('ships the jaw, lure, body and foot as untransformed children of the frogfish root', () => {
    const root = anchored.node('Frogfish'),
      children = (root.children ?? []).map((i) => anchored.doc.nodes[i]);
    expect(children.map((n) => n.name).sort()).toEqual([...PARTS].sort());
    for (const node of children) {
      expect(node.translation ?? [0, 0, 0], node.name).toEqual([0, 0, 0]);
      expect(node.rotation, node.name).toBeUndefined();
      expect(node.scale, node.name).toBeUndefined();
      for (const p of anchored.primitives(node.name)) {
        expect(p.attributes, node.name).toContain('COLOR_0');
        expect(p.attributes, node.name).toContain('TEXCOORD_0');
        expect(p.positions.every(Number.isFinite), node.name).toBe(true);
      }
    }
    expect(
      anchored
        .primitives('FrogBody')
        .map((p) => p.material)
        .sort(),
    ).toEqual(['FrogIris', 'FrogMouth', 'FrogSkin15']);
    expect(
      anchored
        .primitives('FrogJaw')
        .map((p) => p.material)
        .sort(),
    ).toEqual(['FrogMouth', 'FrogSkin15']);
  });
  it('stays inside the validated perch envelope, seated on its sole, at every gape', () => {
    // Surface-home footprint used to choose the perch (Frogfish.ts: 0.53 x 0.56 x 0.78 local).
    for (const gape of [0, FROGFISH_YAWN.gape])
      for (const name of PARTS) {
        const box = new THREE.Box3().setFromPoints(bodyFrame(name, gape));
        expect(box.min.y, `${name} ${gape}`).toBeGreaterThanOrEqual(0);
        expect(box.max.y, `${name} ${gape}`).toBeLessThanOrEqual(0.78);
        expect(Math.max(-box.min.x, box.max.x), name).toBeLessThan(0.53);
        expect(Math.max(-box.min.z, box.max.z), name).toBeLessThan(0.56);
      }
  });
  it('closes the jaw flush with the head and grows the lure from the snout', () => {
    const body = bodyFrame('FrogBody'),
      jaw = bodyFrame('FrogJaw'),
      nearest = (p: THREE.Vector3): number =>
        Math.min(...body.map((b) => b.distanceTo(p)));
    // The mouth corners (the jaw's lateral extremes) coincide with the head's surface.
    const left = jaw.reduce((a, b) => (b.x < a.x ? b : a)),
      right = jaw.reduce((a, b) => (b.x > a.x ? b : a));
    expect(nearest(left)).toBeLessThan(0.002);
    expect(nearest(right)).toBeLessThan(0.002);
    // The closed jaw reaches as far forward as the snout above it (no gap or overbite).
    const front = (v: THREE.Vector3[]): number =>
      Math.max(...v.map((p) => p.z));
    expect(Math.abs(front(jaw) - front(body))).toBeLessThan(0.04);
    expect(nearest(lureBase)).toBeLessThan(0.03);
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
