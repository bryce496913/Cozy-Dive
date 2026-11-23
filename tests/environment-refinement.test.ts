import { testGeology } from '../validation/geologyModel';
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { limestoneGeometry } from '../src/environment/shared/LimestoneGeometry';
import { carveConvexHull } from '../src/environment/RockGeometry';
import { rockCollider } from '../src/environment/rockCollider';
import { IceGarden } from '../src/environment/ice/IceGarden';
import {
  backShell,
  contouredCushion,
} from '../src/environment/office/OfficeFurniture';

/** V0.7 Pass 079: secondary environment art, with collision and habitats unchanged. */
describe('V0.7 Pass 079 cave boulders', () => {
  it.each([
    [34100, 0],
    [34113, 1],
    [34126, 2],
  ])(
    'limestone %i/%i carves inside its hull, with the same collider and bounds as before',
    (seed, family) => {
      const plain = limestoneGeometry(seed, family),
        carved = limestoneGeometry(seed, family, true),
        m = new THREE.Matrix4().compose(
          new THREE.Vector3(3, 1, -20),
          new THREE.Quaternion().setFromAxisAngle(
            new THREE.Vector3(0, 1, 0),
            0.7,
          ),
          new THREE.Vector3(2.4, 1.5, 2.1),
        );
      plain.computeBoundingBox();
      carved.computeBoundingBox();
      expect(
        carved.boundingBox!.min.distanceTo(plain.boundingBox!.min),
      ).toBeLessThan(1e-6);
      expect(
        carved.boundingBox!.max.distanceTo(plain.boundingBox!.max),
      ).toBeLessThan(1e-6);
      const a = rockCollider(plain, m),
        b = rockCollider(carved, m);
      expect(b.planes.length).toBe(a.planes.length);
      for (const k of ['x', 'y', 'z'] as const) {
        expect(Math.abs(b.min[k] - a.min[k])).toBeLessThan(1e-5);
        expect(Math.abs(b.max[k] - a.max[k])).toBeLessThan(1e-5);
      }
      // Every rendered vertex lies inside the collider (routes can only get roomier).
      const local = rockCollider(carved, new THREE.Matrix4()),
        p = carved.getAttribute('position'),
        v = new THREE.Vector3();
      for (let i = 0; i < p.count; i++) {
        v.fromBufferAttribute(p, i);
        for (const pl of local.planes)
          expect(pl.x * v.x + pl.y * v.y + pl.z * v.z - pl.offset).toBeLessThan(
            1e-5,
          );
      }
      plain.dispose();
      carved.dispose();
    },
  );
  it('cuts deeper into the silhouette with massing than the plain carve', () => {
    const hull = Array.from(
      new THREE.IcosahedronGeometry(1, 1)
        .toNonIndexed()
        .getAttribute('position').array,
    );
    const depth = (g: THREE.BufferGeometry) => {
      const p = g.getAttribute('position');
      let sum = 0;
      for (let i = 0; i < p.count; i++)
        sum += 1 - new THREE.Vector3().fromBufferAttribute(p, i).length();
      return sum / p.count;
    };
    const plain = carveConvexHull(hull, 0, 3, 7),
      massed = carveConvexHull(hull, 0, 3, 7, {
        cuts: 3,
        cutLow: 0.5,
        clefts: 2,
        cleftDepth: 0.2,
        cleftWidth: 0.16,
      });
    expect(depth(massed)).toBeGreaterThan(depth(plain) * 1.15);
  });
});

describe('V0.7 Pass 079 under-ice garden', () => {
  it('keeps every species and count, gathered into clumps with open sand lanes', () => {
    const g = new IceGarden([]);
    try {
      const counts = Object.fromEntries(
        g.root.children.map((m) => [m.name, (m as THREE.InstancedMesh).count]),
      );
      expect(counts['Glass sponges']).toBe(110);
      expect(counts['Soft corals']).toBe(120);
      expect(counts['Antarctic sea stars']).toBe(110);
      expect(counts['Feather stars']).toBe(50);
      // Sponges and corals keep out of the three sand lanes.
      const lane = (x: number, z: number) =>
        [-12, 0.5, 12].some(
          (base, k) =>
            Math.abs(x - (base + 2.6 * Math.sin(z * 0.11 + k * 1.9))) < 1.6,
        );
      const m = new THREE.Matrix4(),
        p = new THREE.Vector3();
      let inLanes = 0,
        total = 0;
      for (const name of ['Glass sponges', 'Soft corals']) {
        const mesh = g.root.getObjectByName(name) as THREE.InstancedMesh;
        for (let i = 0; i < mesh.count; i++) {
          mesh.getMatrixAt(i, m);
          p.setFromMatrixPosition(m);
          if (lane(p.x, p.z)) inLanes++;
          total++;
        }
      }
      expect(inLanes / total).toBeLessThan(0.03);
      expect(g.spots.sponge.length).toBeGreaterThan(0);
    } finally {
      g.dispose();
    }
  });
});

describe('V0.7 Pass 079 office furniture forms', () => {
  it('dishes the cushion top and rolls its front edge, inside its nominal size', () => {
    const g = contouredCushion(0.5, 0.08, 0.48, 0.014, 0.024);
    g.computeBoundingBox();
    const b = g.boundingBox!;
    expect(b.max.x - b.min.x).toBeLessThanOrEqual(0.5 + 1e-6);
    expect(b.max.z - b.min.z).toBeLessThanOrEqual(0.48 + 1e-6);
    // The top is lower in the middle than near the back edge.
    const p = g.getAttribute('position');
    let centre = -Infinity,
      rear = -Infinity;
    for (let i = 0; i < p.count; i++) {
      if (Math.abs(p.getX(i)) < 0.06 && Math.abs(p.getZ(i)) < 0.06)
        centre = Math.max(centre, p.getY(i));
      if (Math.abs(p.getX(i)) < 0.06 && p.getZ(i) > 0.17)
        rear = Math.max(rear, p.getY(i));
    }
    expect(centre).toBeLessThan(rear - 0.005);
    expect(g.getAttribute('normal')).toBeDefined();
    g.dispose();
  });
  it('bends the back shell round the sitter', () => {
    const g = backShell(0.48, 0.54, 0.055, 0.045, 0.014),
      p = g.getAttribute('position');
    let edge = Infinity,
      middle = Infinity;
    for (let i = 0; i < p.count; i++) {
      if (Math.abs(p.getX(i)) > 0.2) edge = Math.min(edge, p.getZ(i));
      if (Math.abs(p.getX(i)) < 0.02) middle = Math.min(middle, p.getZ(i));
    }
    expect(edge).toBeLessThan(middle - 0.02);
    g.dispose();
  });
});

describe('V0.7 Pass 079 follow-up: large life, formations and tunnels', () => {
  it('sways the algae on simulation time, frozen with reduced motion', async () => {
    const { SwayingAlgae, strapAlgaGeometry } =
      await import('../src/environment/shared/LargeLife');
    const a = new SwayingAlgae(
      'test',
      strapAlgaGeometry(3, 1, [0.3, 0.2, 0.1], [0.5, 0.4, 0.2]),
      [{ x: 0, y: 0, z: 0, scale: 1, yaw: 0 }],
      0.3,
    );
    try {
      const sway = a.geometry.getAttribute('sway');
      let lo = Infinity,
        hi = -Infinity;
      for (let i = 0; i < sway.count; i++) {
        lo = Math.min(lo, sway.getX(i));
        hi = Math.max(hi, sway.getX(i));
      }
      // Anchored at the holdfast, free at the tip.
      expect(lo).toBe(0);
      expect(hi).toBeGreaterThan(0.9);
      a.update(1, true, true);
      expect((a as unknown as { time: { value: number } }).time.value).toBe(0);
      a.update(1, true, false);
      expect(
        (a as unknown as { time: { value: number } }).time.value,
      ).toBeGreaterThan(0);
    } finally {
      a.dispose();
    }
  });
  it('keeps the ice formations and algae out of the sand lanes and the holes, and solid', async () => {
    const { IceEnvironment } =
      await import('../src/environment/ice/IceEnvironment');
    const { inIceLane } = await import('../src/environment/ice/IceGarden');
    const { ICE } = await import('../src/config/passage');
    const env = new IceEnvironment();
    try {
      const m = new THREE.Matrix4(),
        p = new THREE.Vector3();
      for (const name of ['Giant strap algae', 'Bushy brown algae']) {
        const mesh = env.root.getObjectByName(name) as THREE.InstancedMesh;
        expect(mesh.count).toBeGreaterThan(20);
        for (let i = 0; i < mesh.count; i++) {
          mesh.getMatrixAt(i, m);
          p.setFromMatrixPosition(m);
          expect(inIceLane(p.x, p.z)).toBe(false);
        }
      }
      // The outcrops' boulders are solid and keep clear of the breathing holes' light.
      const big = env.stones.filter((s) => s.size > 2);
      expect(big.length).toBeGreaterThanOrEqual(4);
      for (const s of big)
        for (const h of ICE.holes)
          expect(Math.hypot(s.x - h.x, s.z - h.z)).toBeGreaterThan(h.r + 1);
      expect(env.colliders.length).toBeGreaterThan(40);
    } finally {
      env.dispose();
    }
  });
  it('makes the cave pillars solid from sand to roof', async () => {
    const { CaveEnvironment } =
      await import('../src/environment/cave/CaveEnvironment');
    const env = new CaveEnvironment(testGeology());
    try {
      for (const [x, z] of [
        [-15.3, -22.6],
        [15.4, -25],
      ]) {
        const solid = (y: number) =>
          env.colliders.some((c) =>
            c.planes.every(
              (pl) => pl.x * x + pl.y * y + pl.z * z - pl.offset < 0.05,
            ),
          );
        expect(solid(1)).toBe(true);
        expect(solid(5)).toBe(true);
      }
    } finally {
      env.dispose();
    }
  });
  it('carries a tunnel on into darkness instead of ending it in a flat disc', async () => {
    const { tunnelThroat } = await import('../src/environment/shared/RockTube');
    const g = tunnelThroat({ x: 0, y: 3, radius: 1.45 }, -40, -1, 4),
      p = g.getAttribute('position'),
      c = g.getAttribute('color');
    let near = -Infinity,
      far = Infinity,
      darkest = Infinity;
    for (let i = 0; i < p.count; i++) {
      near = Math.max(near, p.getZ(i));
      far = Math.min(far, p.getZ(i));
      darkest = Math.min(darkest, c.getX(i));
    }
    expect(near - far).toBeGreaterThan(3.9);
    expect(darkest).toBe(0);
    g.dispose();
  });
});

describe('V0.7 Pass 079 tunnel collar', () => {
  it.each([1, -1] as const)('faces its open side (out %i)', async (out) => {
    const { mouthCollar } = await import('../src/environment/shared/RockTube');
    const g = mouthCollar({ x: 0, y: 3, radius: 1.45 }, -8, out),
      n = g.getAttribute('normal');
    let sum = 0;
    for (let i = 0; i < n.count; i++) sum += n.getZ(i);
    expect(Math.sign(sum)).toBe(out);
    g.dispose();
  });
});

describe('V0.7 Pass 079 tunnel walls', () => {
  it.each([
    [1.8, -8.3],
    [-8.3, 1.8],
  ])('faces every wall inward (from %f to %f)', async (from, to) => {
    const { rockTubeGeometry } =
      await import('../src/environment/shared/RockTube');
    const g = rockTubeGeometry({ x: 0, y: 4, radius: 1.45, from, to, dark: 0 }),
      p = g.getAttribute('position'),
      idx = g.getIndex()!,
      a = new THREE.Vector3(),
      b = new THREE.Vector3(),
      c = new THREE.Vector3();
    let inward = 0;
    for (let f = 0; f < idx.count; f += 3) {
      a.fromBufferAttribute(p, idx.getX(f));
      b.fromBufferAttribute(p, idx.getX(f + 1));
      c.fromBufferAttribute(p, idx.getX(f + 2));
      const n = b.clone().sub(a).cross(c.clone().sub(a)),
        toAxis = new THREE.Vector3(-a.x, 4 - a.y, 0);
      if (n.dot(toAxis) > 0) inward++;
    }
    // Single-sided materials draw the walls from inside the tunnel.
    expect(inward / (idx.count / 3)).toBeGreaterThan(0.98);
    g.dispose();
  });
});

describe('V0.7 Pass 079 tunnel throat winding', () => {
  it.each([1, -1] as const)('faces the axis (dir %i)', async (dir) => {
    const { tunnelThroat } = await import('../src/environment/shared/RockTube');
    const g = tunnelThroat({ x: 0, y: 3, radius: 1.45 }, 0, dir, 4),
      p = g.getAttribute('position'),
      idx = g.getIndex()!,
      a = new THREE.Vector3(),
      b = new THREE.Vector3(),
      c = new THREE.Vector3();
    let inward = 0,
      walls = 0;
    for (let f = 0; f < idx.count; f += 3) {
      a.fromBufferAttribute(p, idx.getX(f));
      b.fromBufferAttribute(p, idx.getX(f + 1));
      c.fromBufferAttribute(p, idx.getX(f + 2));
      const n = b.clone().sub(a).cross(c.clone().sub(a)),
        centre = a.clone().add(b).add(c).divideScalar(3),
        toAxis = new THREE.Vector3(-centre.x, 3 - centre.y, -dir * 0.3);
      walls++;
      if (n.dot(toAxis) > 0) inward++;
    }
    expect(inward / walls).toBeGreaterThan(0.95);
    g.dispose();
  });
});
