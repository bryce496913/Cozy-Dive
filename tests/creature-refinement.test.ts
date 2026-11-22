import { describe, expect, it } from 'vitest';
import { ReefAsset } from '../validation/ReefAsset';

/** V0.8 Pass 084: marine creature artistic refinement. */
const asset = (id: string) =>
  new ReefAsset(`public/assets/models/creatures/${id}.glb`);
const vertices = (id: string) => {
  const p = asset(id).primitive('Body').positions,
    out: [number, number, number][] = [];
  for (let i = 0; i < p.length; i += 3) out.push([p[i], p[i + 1], p[i + 2]]);
  return out;
};
/** Body depth and width (fractions of length) in 16 stations from tail to snout. */
function profile(id: string): number[] {
  const v = vertices(id);
  const x0 = Math.min(...v.map((p) => p[0])),
    x1 = Math.max(...v.map((p) => p[0])),
    L = x1 - x0,
    bins = 16,
    depth = new Array<number>(bins).fill(0),
    width = new Array<number>(bins).fill(0),
    lo = new Array<number>(bins).fill(Infinity),
    hi = new Array<number>(bins).fill(-Infinity);
  for (const [x, y, z] of v) {
    const k = Math.min(bins - 1, Math.floor(((x - x0) / L) * bins));
    lo[k] = Math.min(lo[k], y);
    hi[k] = Math.max(hi[k], y);
    width[k] = Math.max(width[k], Math.abs(z) / L);
  }
  for (let k = 0; k < bins; k++) depth[k] = (hi[k] - lo[k]) / L;
  return [...depth, ...width];
}

const SHARKS = [
  'reef-shark',
  'whitetip-shark',
  'great-white-shark',
  'leopard-shark',
  'nurse-shark',
  'hammerhead',
];

describe('V0.8 Pass 084 species silhouettes', () => {
  it('gives every shark its own body plan, not a resized generic body', () => {
    const profiles = SHARKS.map(profile);
    for (let i = 0; i < SHARKS.length; i++)
      for (let j = i + 1; j < SHARKS.length; j++) {
        const diff = profiles[i].reduce(
          (sum, a, k) => sum + Math.abs(a - profiles[j][k]),
          0,
        );
        // Summed over 32 stations; the Pass 067 lofted sharks differed by almost nothing.
        expect(diff, `${SHARKS[i]} vs ${SHARKS[j]}`).toBeGreaterThan(0.12);
      }
  });

  it('gives the harbour seal a head distinct from its body (no longer a tube)', () => {
    const p = profile('harbour-seal');
    const depth = p.slice(0, 16);
    // A neck narrower than both the chest and the head.
    const neck = Math.min(...depth.slice(12, 14)),
      chest = Math.max(...depth.slice(5, 10));
    expect(neck).toBeLessThan(chest * 0.8);
  });

  it('keeps the polar bear paws broad and flat rather than ball-shaped', () => {
    const v = vertices('polar-bear');
    const y0 = Math.min(...v.map((p) => p[1])),
      x0 = Math.min(...v.map((p) => p[0])),
      L = Math.max(...v.map((p) => p[0])) - x0;
    // The lowest part of the forepaws (front half of the animal, below the body).
    const paw = v.filter((p) => p[1] < y0 + 0.05 * L && p[0] > x0 + 0.5 * L);
    expect(paw.length).toBeGreaterThan(20);
    const spanX =
      Math.max(...paw.map((p) => p[0])) - Math.min(...paw.map((p) => p[0]));
    expect(spanX).toBeGreaterThan(0.08 * L);
  });
});
