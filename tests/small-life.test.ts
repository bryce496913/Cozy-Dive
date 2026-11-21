import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import {
  organicTube,
  polarSheet,
  smoothed,
} from '../src/environment/shared/organicGeometry';
import { crabBody } from '../src/environment/cave/CaveCrabs';
import { spinyLobsterBody } from '../src/environment/cave/SpinyLobster';
import {
  combJellyShape,
  krillShape,
  seaButterflyShape,
} from '../src/environment/ice/IceCritterShapes';
import { featherStarGeometry } from '../src/environment/ice/IceGarden';
import {
  brittleStarGeometry,
  cucumberGeometry,
  isopodGeometry,
  salpGeometry,
  scallopGeometry,
  seaPenGeometry,
  urchinGeometry,
} from '../src/environment/ice/IceExtras';
import { seaStarShape, urchinShape } from '../src/environment/kelp/KelpShapes';
import { spanishShawlGeometry } from '../src/environment/kelp/SpanishShawl';

/** V0.7 Pass 068 (small life): continuous organic forms, smooth shading, unchanged contracts. */

/** Area-weighted share of surface whose vertex normals bend away from the flat triangle normal
 * (0 = faceted). Weighted by area so the tiny flat end caps of spines and limbs don't count. */
function smoothness(g: THREE.BufferGeometry): number {
  const p = g.getAttribute('position'),
    n = g.getAttribute('normal'),
    a = new THREE.Vector3(),
    b = new THREE.Vector3(),
    c = new THREE.Vector3(),
    face = new THREE.Vector3(),
    vn = new THREE.Vector3();
  let bent = 0,
    total = 0;
  for (let i = 0; i + 2 < p.count; i += 3) {
    a.fromBufferAttribute(p, i);
    b.fromBufferAttribute(p, i + 1);
    c.fromBufferAttribute(p, i + 2);
    face.subVectors(c, b).cross(a.clone().sub(b));
    const area = face.length() / 2;
    if (area < 1e-14) continue;
    face.normalize();
    total += area;
    let k = 0;
    for (let j = 0; j < 3; j++) {
      vn.fromBufferAttribute(n, i + j);
      if (Math.abs(vn.dot(face)) < 0.999) k++;
    }
    bent += (area * k) / 3;
  }
  return bent / total;
}

const SMALL: [string, () => THREE.BufferGeometry][] = [
  ['cave crab', crabBody],
  ['spiny lobster', spinyLobsterBody],
  ['sea butterfly', seaButterflyShape],
  ['comb jelly', combJellyShape],
  ['krill', krillShape],
  ['feather star', featherStarGeometry],
  ['scallop', scallopGeometry],
  ['ice urchin', urchinGeometry],
  ['brittle star', brittleStarGeometry],
  ['sea cucumber', cucumberGeometry],
  ['sea pen', seaPenGeometry],
  ['isopod', isopodGeometry],
  ['salp', salpGeometry],
  ['bat star', seaStarShape],
  ['purple urchin', urchinShape],
  ['spanish shawl', spanishShawlGeometry],
];

describe('V0.7 Pass 068 organic geometry helpers', () => {
  it('builds a closed, continuous tube that follows its curve and taper', () => {
    const pts = [
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0.1, 0.05, 0),
      new THREE.Vector3(0.2, 0, 0.05),
    ];
    const g = organicTube(pts, (u) => 0.02 * (1 - 0.8 * u), 10, 6);
    const p = g.getAttribute('position');
    expect(p.count).toBe(11 * 6 + 2);
    // Every ring vertex is used by triangles on both neighbouring segments (no gaps).
    const used = new Uint8Array(p.count);
    const idx = g.getIndex()!;
    for (let i = 0; i < idx.count; i++) used[idx.getX(i)]++;
    expect([...used].every((k) => k >= 3)).toBe(true);
    // The first ring is wider than the last.
    const ring = (r: number) => {
      const c = new THREE.Vector3();
      for (let j = 0; j < 6; j++)
        c.add(new THREE.Vector3().fromBufferAttribute(p, r * 6 + j));
      c.divideScalar(6);
      return new THREE.Vector3().fromBufferAttribute(p, r * 6).distanceTo(c);
    };
    expect(ring(0)).toBeGreaterThan(ring(10) * 3);
  });
  it('gives a polar sheet interior rings, so it can curve', () => {
    const g = polarSheet(
      (r, a, out) => out.set(Math.cos(a) * r, r * r * 0.3, Math.sin(a) * r),
      0,
      Math.PI,
      6,
      12,
    );
    expect(g.getAttribute('position').count).toBe(7 * 13);
  });
  it('shades curved surfaces smoothly but keeps hard edges crisp', () => {
    const sphere = smoothed(new THREE.SphereGeometry(1, 16, 12));
    expect(sphere.index).toBeNull();
    expect(smoothness(sphere)).toBeGreaterThan(0.9);
    const box = smoothed(new THREE.BoxGeometry(1, 1, 1));
    expect(smoothness(box)).toBe(0);
  });
});

describe('V0.7 Pass 068 small creatures', () => {
  it.each(SMALL)(
    '%s keeps its merge contract: non-indexed position, normal (and colour)',
    (name, build) => {
      const g = build();
      expect(g.index).toBeNull();
      const n = g.getAttribute('position').count;
      // The feather star is tinted by its material, not by vertex colour.
      for (const a of name === 'feather star'
        ? ['normal']
        : ['normal', 'color'])
        expect(g.getAttribute(a)?.count, a).toBe(n);
      expect(
        (g.getAttribute('position').array as Float32Array).every(
          Number.isFinite,
        ),
      ).toBe(true);
      g.dispose();
    },
  );
  it.each(SMALL.filter(([n]) => n !== 'krill'))(
    '%s is smooth-shaded (not faceted primitives)',
    (_name, build) => {
      const g = build();
      // Most vertices carry a shared, curved normal; crisp edges remain where intended.
      expect(smoothness(g)).toBeGreaterThan(0.5);
      g.dispose();
    },
  );
  it('keeps the brittle star, scallop and crab at their authored sizes', () => {
    const size = (g: THREE.BufferGeometry) => {
      g.computeBoundingBox();
      return g.boundingBox!.getSize(new THREE.Vector3());
    };
    const star = size(brittleStarGeometry());
    expect(Math.max(star.x, star.z)).toBeGreaterThan(0.22);
    expect(Math.max(star.x, star.z)).toBeLessThan(0.34);
    const scallop = size(scallopGeometry());
    expect(scallop.x).toBeGreaterThan(0.07);
    expect(scallop.x).toBeLessThan(0.12);
    const crab = size(crabBody());
    expect(crab.x).toBeGreaterThan(0.3);
    expect(crab.x).toBeLessThan(0.42);
    expect(crab.y).toBeLessThan(0.12);
  });
});
