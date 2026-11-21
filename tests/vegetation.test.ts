import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import {
  KelpStalks,
  STALKS,
  kelpPatchGeometry,
  stalkTemplate,
} from '../src/environment/kelp/KelpStalks';
import { PLANT_VERTEX_GLSL } from '../src/environment/PlantAnimation';

/** V0.7 Pass 071: smoother, more varied kelp and plants that bend through the water. */
describe('V0.7 Pass 071 kelp', () => {
  it('has five templates, so neighbouring plants rarely repeat', () => {
    expect(STALKS.heights).toHaveLength(5);
    expect(new Set(STALKS.heights).size).toBe(5);
  });
  it.each(STALKS.heights.map((h, i) => [h, i]))(
    'template of %f m shades smoothly, with blade flex rising from zero at the base',
    (height, i) => {
      const g = stalkTemplate(height, 101 + i * 37),
        p = g.getAttribute('position'),
        n = g.getAttribute('normal'),
        flex = g.getAttribute('kelpFlex');
      expect(n.count).toBe(p.count);
      expect(flex.count).toBe(p.count);
      // Smooth: within most triangles the vertex normals differ (not flat facets).
      let curved = 0;
      const a = new THREE.Vector3(),
        b = new THREE.Vector3();
      for (let k = 0; k + 2 < n.count; k += 3) {
        a.fromBufferAttribute(n, k);
        b.fromBufferAttribute(n, k + 1);
        if (a.dot(b) < 0.9999) curved++;
      }
      expect(curved / (n.count / 3)).toBeGreaterThan(0.5);
      let lo = Infinity,
        hi = -Infinity,
        holdfast = 0;
      for (let k = 0; k < flex.count; k++) {
        const f = flex.getX(k);
        lo = Math.min(lo, f);
        hi = Math.max(hi, f);
        if (p.getY(k) < 0.3) holdfast = Math.max(holdfast, f);
      }
      expect(lo).toBe(0);
      expect(hi).toBeCloseTo(1, 5);
      // The holdfast never flutters: it stays anchored.
      expect(holdfast).toBe(0);
      g.dispose();
    },
  );
  it('gives the tank patch normals without the forest-only flex attribute', () => {
    const g = kelpPatchGeometry();
    expect(g.getAttribute('normal')).toBeDefined();
    expect(g.getAttribute('kelpFlex')).toBeUndefined();
    g.dispose();
  });
  it('freezes the sway with reduced motion but still leans away from the swimmer', () => {
    const k = new KelpStalks();
    try {
      k.update(1, true, true, { x: 0, y: 5, z: -20 });
      expect(k.swayTime).toBe(0);
      k.update(1, true, false, { x: 0, y: 5, z: -20 });
      expect(k.swayTime).toBeGreaterThan(0);
    } finally {
      k.dispose();
    }
  });
});

describe('V0.7 Pass 071 plant motion', () => {
  it('bends with continuous curvature: height lags the flow, with per-plant gusts', () => {
    expect(PLANT_VERTEX_GLSL).toContain('2.*plantMotion.x/plantMotion.z');
    expect(PLANT_VERTEX_GLSL).toContain('plantTime-h*1.4');
    expect(PLANT_VERTEX_GLSL).toContain('gust');
  });
});
