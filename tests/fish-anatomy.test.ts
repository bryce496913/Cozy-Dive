import { describe, expect, it } from 'vitest';
import { ReefAsset } from '../validation/ReefAsset';

/** V0.8 Pass 090: species-specific fish anatomy. */
const body = (file: string) => {
  const p = new ReefAsset(`public/assets/models/fish/${file}.glb`).primitive(
      'Body',
    ).positions,
    out: [number, number, number][] = [];
  for (let i = 0; i < p.length; i += 3) out.push([p[i], p[i + 1], p[i + 2]]);
  return out;
};

/**
 * Dorsal and ventral outline in 16 stations, tail to snout, measured from the mid-body section's
 * centre and divided by the fish's own greatest depth: shape only, so a resized or deepened copy
 * of one body scores as the same fish.
 */
function outline(file: string): number[] {
  const v = body(file),
    x0 = Math.min(...v.map((p) => p[0])),
    L = Math.max(...v.map((p) => p[0])) - x0,
    bins = 16,
    top = new Array<number>(bins).fill(-Infinity),
    bot = new Array<number>(bins).fill(Infinity);
  for (const [x, y] of v) {
    const k = Math.min(bins - 1, Math.floor(((x - x0) / L) * bins));
    top[k] = Math.max(top[k], y);
    bot[k] = Math.min(bot[k], y);
  }
  const depth = Math.max(...top.map((t, i) => t - bot[i])),
    centre = (top[8] + bot[8]) / 2;
  return [
    ...top.map((t) => (t - centre) / depth),
    ...bot.map((b) => (centre - b) / depth),
  ];
}
const diff = (a: number[], b: number[]) =>
  a.reduce((s, x, i) => s + Math.abs(x - b[i]), 0);

/** The species that shared one body family's profile in Pass 066. */
const FAMILIES = {
  robust: ['napoleon', 'seabass', 'parrotfish', 'sheephead', 'trevally'],
  disc: ['butterflyfish', 'bannerfish', 'idol', 'bluetang'],
  oval: ['assessor', 'cardinalfish', 'chromis', 'clownfish', 'gramma'],
  elongate: ['firefish', 'icefish', 'notothen', 'toothfish'],
};

describe('V0.8 Pass 090 fish anatomy', () => {
  it.each(Object.entries(FAMILIES))(
    'gives every %s species its own silhouette, not a resized shared body',
    (_family, members) => {
      const shapes = members.map(outline);
      for (let i = 0; i < members.length; i++)
        for (let j = i + 1; j < members.length; j++)
          // Summed over 32 values. Pass 066's families scored 0.000-0.006 (one shared profile per
          // family, rescaled); Pass 090's closest pair scores 0.32.
          expect(
            diff(shapes[i], shapes[j]),
            `${members[i]} vs ${members[j]}`,
          ).toBeGreaterThan(0.2);
    },
  );

  it('narrows the jacks and tangs to a slim peduncle', () => {
    for (const file of ['trevally', 'bluetang']) {
      const o = outline(file),
        depth = (k: number) => o[k] + o[16 + k];
      expect(depth(0), file).toBeLessThan(depth(9) * 0.2);
    }
  });
});
