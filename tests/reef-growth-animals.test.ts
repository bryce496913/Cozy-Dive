import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import {
  barrelSponge,
  cushionSponge,
  plateCoral,
} from '../src/environment/wreck/WreckGrowth';
import {
  cushionGeometry,
  tubeClusterGeometry,
} from '../src/environment/cave/CaveEncrusting';
import { spongeGeometry } from '../src/environment/ice/IceGarden';
import { ReefAsset } from '../validation/ReefAsset';

/** V0.8 Pass 092: reef growth and the remaining marine animals. */

const points = (g: THREE.BufferGeometry) => {
  const p = g.getAttribute('position'),
    out: THREE.Vector3[] = [];
  for (let i = 0; i < p.count; i++)
    out.push(new THREE.Vector3().fromBufferAttribute(p, i));
  return out;
};
const tones = (g: THREE.BufferGeometry) => {
  const c = g.getAttribute('color'),
    out: number[] = [];
  for (let i = 0; i < c.count; i++) out.push(c.getX(i));
  return out;
};
/** Outer radius round the axis at height y (+-band), at `n` headings. */
function ring(v: readonly THREE.Vector3[], y: number, band: number, n = 24) {
  const r = new Array<number>(n).fill(0);
  for (const p of v) {
    if (Math.abs(p.y - y) > band) continue;
    const k =
      Math.floor(((Math.atan2(p.z, p.x) + Math.PI) / (Math.PI * 2)) * n) % n;
    r[k] = Math.max(r[k], Math.hypot(p.x, p.z));
  }
  return r;
}
/**
 * How narrow the colony is between its foot and its broadest level: the smallest horizontal reach
 * of any band from just above the foot up to the broadest band, over the broadest band's reach.
 * A table on a stalk scores low (its stalk); a colony grown from a broad base does not.
 */
function waist(v: readonly THREE.Vector3[]) {
  const y0 = Math.min(...v.map((p) => p.y)),
    y1 = Math.max(...v.map((p) => p.y)),
    bands = 16,
    reach = new Array<number>(bands).fill(0);
  for (const p of v) {
    const k = Math.min(bands - 1, Math.floor(((p.y - y0) / (y1 - y0)) * bands));
    reach[k] = Math.max(reach[k], Math.hypot(p.x, p.z));
  }
  const top = reach.indexOf(Math.max(...reach));
  return Math.min(...reach.slice(1, Math.max(2, top))) / reach[top];
}

describe('V0.8 Pass 092 reef growth', () => {
  it.each([
    ['barrel sponge', barrelSponge, 0.74],
    ['glass sponge', spongeGeometry, 1],
  ] as const)(
    'grows the %s as an irregular vase (no lathe), with a dark atrium and a foot in the substrate',
    (_n, build, height) => {
      const g = build(),
        v = points(g),
        r = ring(v, height * 0.5, height * 0.06),
        mean = r.reduce((s, x) => s + x, 0) / r.length;
      // A lathe is round to the vertex; an irregular, leaning, ridged wall is not.
      expect(Math.max(...r) / Math.min(...r)).toBeGreaterThan(1.15);
      expect(mean).toBeGreaterThan(0);
      expect(Math.min(...v.map((p) => p.y))).toBeLessThan(-0.01 * height);
      const t = tones(g);
      expect(Math.min(...t)).toBeLessThan(0.15);
      expect(Math.max(...t)).toBeGreaterThan(0.8);
      g.dispose();
    },
  );

  it.each([
    ['wreck encrusting sponge', cushionSponge],
    ['cave cushion', cushionGeometry],
  ] as const)(
    'feathers the %s into its substrate, lobed, with dark oscula',
    (_n, build) => {
      const g = build(),
        v = points(g),
        bottom = Math.min(...v.map((p) => p.y)),
        r = ring(v, bottom, 1e-3);
      expect(bottom).toBeLessThan(0);
      expect(
        Math.max(...r) / Math.min(...r.filter((x) => x > 0)),
      ).toBeGreaterThan(1.2);
      expect(Math.min(...tones(g))).toBeLessThan(0.2);
      g.dispose();
    },
  );

  it('stands the cave tube sponges on one shared base, not on the bare rock', () => {
    const g = tubeClusterGeometry(),
      v = points(g),
      foot = v.filter((p) => p.y < 0.005);
    // The base spreads well beyond the tubes' own footprint.
    expect(Math.max(...foot.map((p) => Math.hypot(p.x, p.z)))).toBeGreaterThan(
      0.08,
    );
    g.dispose();
  });

  it('grows the wreck plate coral from a broad base, not a stalk', () => {
    const g = plateCoral();
    // Was two discs on a 0.05 to 0.08 cylinder foot (0.16 of the plate's reach).
    expect(waist(points(g))).toBeGreaterThan(0.3);
    g.dispose();
  });

  it.each([0, 1, 2])(
    'grows library plate coral %i from a broad base, not a mushroom stalk',
    (i) => {
      const p = new ReefAsset(
          'public/assets/models/reef/reef-environment.glb',
        ).primitive(`Coral_Plate_${i}`).positions,
        v: THREE.Vector3[] = [];
      for (let k = 0; k < p.length; k += 3)
        v.push(new THREE.Vector3(p[k], p[k + 1], p[k + 2]));
      // The shipped tables stood on trunks of about 0.16 m radius under 0.84 m tiers (0.19).
      expect(waist(v)).toBeGreaterThan(0.4);
    },
  );
});

describe('V0.8 Pass 092 marine animals', () => {
  const asset = (id: string) =>
    new ReefAsset(`public/assets/models/creatures/${id}.glb`);
  const rootExtras = (a: ReefAsset) =>
    (a.doc.nodes.find((n) => n.name.endsWith('_Root'))?.extras ?? {}) as {
      standards_pass?: string;
    };

  it.each([
    'minke-whale',
    'sea-otter',
    'polar-bear',
    'whale-shark',
    'eagle-ray',
    'manta-ray',
    'great-white-shark',
    'reef-shark',
    'humpback-whale',
  ])('%s is the Pass 092 build', (id) => {
    expect(rootExtras(asset(id)).standards_pass).toBe('092');
  });

  it('gives the minke a slender whale body with flukes wider than it is deep', () => {
    const p = asset('minke-whale').primitive('Body').positions;
    let x0 = Infinity,
      x1 = -Infinity,
      y0 = Infinity,
      y1 = -Infinity,
      z0 = Infinity,
      z1 = -Infinity;
    for (let i = 0; i < p.length; i += 3) {
      x0 = Math.min(x0, p[i]);
      x1 = Math.max(x1, p[i]);
      y0 = Math.min(y0, p[i + 1]);
      y1 = Math.max(y1, p[i + 1]);
      z0 = Math.min(z0, p[i + 2]);
      z1 = Math.max(z1, p[i + 2]);
    }
    const L = x1 - x0;
    // A minke is about seven times as long as it is deep (the Pass 068 loft was a spindle).
    expect((y1 - y0) / L).toBeLessThan(0.25);
    // Flukes (and flippers) spread wider than the body is deep.
    expect(z1 - z0).toBeGreaterThan(y1 - y0);
  });

  it.each(['whale-shark', 'eagle-ray'])(
    'bakes the %s markings into a texture on their own UV set (spots no longer follow triangles)',
    (id) => {
      const a = asset(id),
        material = (
          a.doc as unknown as {
            materials: {
              pbrMetallicRoughness: {
                baseColorTexture?: { texCoord?: number };
              };
            }[];
          }
        ).materials[0],
        prim = a.primitive('Body');
      expect(material.pbrMetallicRoughness.baseColorTexture?.texCoord).toBe(1);
      expect(prim.attributes).toContain('TEXCOORD_1');
      // The vertex colour no longer carries the pattern (it is white).
      const c = prim.colors!,
        scale = Math.max(...c) > 1.5 ? 255 : 1;
      expect(Math.min(...c) / scale).toBeGreaterThan(0.95);
    },
  );

  // Mean length of edges across a colour change over the mean edge: as shipped before this pass
  // 0.82 for the manta (its large patches stay in the mesh), now 0.66.
  it('spends manta triangles on its markings: smaller triangles where its colour changes', () => {
    const prim = asset('manta-ray').primitive('Body'),
      p = prim.positions,
      c = prim.colors!,
      stride = c.length / (p.length / 3),
      scale = Math.max(...c) > 1.5 ? 255 : 1,
      tone = (i: number) =>
        (c[i * stride] + c[i * stride + 1] + c[i * stride + 2]) / (3 * scale),
      len = (a: number, b: number) =>
        Math.hypot(
          p[a * 3] - p[b * 3],
          p[a * 3 + 1] - p[b * 3 + 1],
          p[a * 3 + 2] - p[b * 3 + 2],
        );
    let edge = 0,
      n = 0,
      markEdge = 0,
      marks = 0;
    const f = prim.indices;
    for (let t = 0; t < f.length; t += 3)
      for (const [a, b] of [
        [f[t], f[t + 1]],
        [f[t + 1], f[t + 2]],
        [f[t + 2], f[t]],
      ]) {
        const l = len(a, b);
        edge += l;
        n++;
        if (Math.abs(tone(a) - tone(b)) > 0.15) {
          markEdge += l;
          marks++;
        }
      }
    expect(marks).toBeGreaterThan(100);
    expect(markEdge / marks / (edge / n)).toBeLessThan(0.75);
  });
});
