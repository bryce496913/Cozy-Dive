import { describe, expect, it } from 'vitest';
import { MOUTH_ARCH, mouthArch } from '../src/environment/shared/MouthArch';
import { ICE_DETAIL, iceForm } from '../src/environment/ice/IceForms';

/** V0.8 Pass 086: the shipwreck, sea cave and under-ice art overhaul. */
describe('V0.8 Pass 086 tunnel-mouth arch', () => {
  const tube = { x: -3, y: 3.2, radius: 1.45 };
  const arch = (out: 1 | -1) =>
    mouthArch(tube, -36, out, { stone: [0.44, 0.4, 0.31], seed: 86010 });

  it('never narrows the passage beyond its lip', () => {
    const g = arch(1),
      p = g.getAttribute('position');
    for (let i = 0; i < p.count; i++) {
      const r = Math.hypot(p.getX(i) - tube.x, p.getY(i) - tube.y);
      expect(r).toBeGreaterThan(tube.radius - MOUTH_ARCH.lipIn - 1e-4);
      expect(Number.isFinite(p.getZ(i))).toBe(true);
    }
    g.dispose();
  });

  it('stands proud of the face toward the opening, and faces that way', () => {
    for (const out of [1, -1] as const) {
      const g = arch(out),
        p = g.getAttribute('position'),
        n = g.getAttribute('normal');
      let proud = 0,
        facing = 0,
        rim = 0;
      for (let i = 0; i < p.count; i++) {
        const r = Math.hypot(p.getX(i) - tube.x, p.getY(i) - tube.y);
        if (r < tube.radius + 0.2 || r > tube.radius + 1.4) continue;
        rim++;
        if ((p.getZ(i) + 36) * out > 0.2) proud++;
        if (n.getZ(i) * out > 0) facing++;
      }
      // Most of the band just outside the hole is rock standing out of the face (not a flat
      // collar), and its surface faces into the water it opens to.
      expect(proud / rim).toBeGreaterThan(0.6);
      expect(facing / rim).toBeGreaterThan(0.8);
      g.dispose();
    }
  });

  it('is built of distinct masses, not a uniform ring', () => {
    const g = arch(1),
      p = g.getAttribute('position'),
      cols = MOUTH_ARCH.around + 1,
      ring = Math.round(MOUTH_ARCH.rings * 0.45),
      heights: number[] = [];
    for (let j = 0; j < MOUTH_ARCH.around; j++)
      heights.push(p.getZ(ring * cols + j) + 36);
    const mean = heights.reduce((s, h) => s + h, 0) / heights.length,
      spread = Math.sqrt(
        heights.reduce((s, h) => s + (h - mean) ** 2, 0) / heights.length,
      );
    expect(spread).toBeGreaterThan(0.12);
    g.dispose();
  });
});

describe('V0.8 Pass 086 sculpted ice', () => {
  it('sculpts each kind within its budget, finite and smooth', () => {
    for (const kind of ['wall', 'berg', 'column', 'shard', 'chunk'] as const) {
      const g = iceForm({
        kind,
        size: [8, 12, 7],
        at: [0, -2, -30],
        yaw: 0.3,
        seed: 86100,
        deep: 0.5,
        ground: 0,
      });
      const p = g.getAttribute('position');
      expect(p.count / 3).toBeLessThanOrEqual(20 * (ICE_DETAIL[kind] + 1) ** 2);
      for (let i = 0; i < p.array.length; i++)
        expect(Number.isFinite(p.array[i])).toBe(true);
      g.dispose();
    }
  });
});
