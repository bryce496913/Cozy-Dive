import * as THREE from 'three';
import { OUTER, TUNNEL_FRAME } from '../../config/passage';
import type { ConvexCollider } from '../../player/collision';
import { boxCollider } from '../passage/Crevice';
import { rockCollider } from '../rockCollider';
import { channelWeight, seabedHeight } from './OuterTerrain';

/**
 * v0.4 Pass 023: the outer waters, first version. A dark winding tunnel through a cliff, starting
 * where the tank's crevice channel ends, opens onto open water above a sand plain. This is the
 * placeholder Pass 024 replaces with the full reef: just enough to prove the passage, the world
 * swap, collision and memory. Built in code; owns and disposes everything it creates.
 */
export const OUTER_LAYOUT = {
  /** Tunnel samples per metre of centreline, and wall segments around it. */
  samplesPerMetre: 2.5,
  sides: 18,
  /** Collision slabs: one ring per this many metres, this many around, this thick. */
  ringSpacing: 1.5,
  ringSides: 10,
  slabThickness: 0.6,
  /** Visual walls bulge outward (never inward) by up to this much (m). */
  wallRelief: 0.4,
  /** Over this many metres from the start the tunnel is black, then lightens to the exit. */
  darkLength: 3.5,
} as const;

/** Deterministic value noise for the rock surfaces. */
function hash(a: number, b: number, c: number): number {
  const v = Math.sin(a * 127.1 + b * 311.7 + c * 74.7) * 43758.5453;
  return v - Math.floor(v);
}
function smoothNoise(x: number, y: number, z: number): number {
  const ix = Math.floor(x),
    iy = Math.floor(y),
    iz = Math.floor(z),
    fx = x - ix,
    fy = y - iy,
    fz = z - iz,
    s = (t: number) => t * t * (3 - 2 * t);
  let sum = 0;
  for (let dx = 0; dx <= 1; dx++)
    for (let dy = 0; dy <= 1; dy++)
      for (let dz = 0; dz <= 1; dz++) {
        const w =
          (dx ? s(fx) : 1 - s(fx)) *
          (dy ? s(fy) : 1 - s(fy)) *
          (dz ? s(fz) : 1 - s(fz));
        sum += w * hash(ix + dx, iy + dy, iz + dz);
      }
  return sum;
}

/** The tunnel centreline. */
export function tunnelCurve(): THREE.CatmullRomCurve3 {
  return new THREE.CatmullRomCurve3(
    OUTER.tunnel.map((p) => new THREE.Vector3(p.x, p.y, p.z)),
    false,
    'centripetal',
  );
}
/** Curve parameter where the centreline meets the cliff face (bisection on z). */
export function cliffParameter(curve: THREE.CatmullRomCurve3): number {
  let lo = 0,
    hi = 1;
  const p = new THREE.Vector3();
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    curve.getPointAt(mid, p);
    if (p.z > OUTER.cliffZ) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}
/** Parameter of the tunnel's origin (the passage threshold). */
export function originParameter(curve: THREE.CatmullRomCurve3): number {
  let best = 0,
    bestD = Infinity;
  const p = new THREE.Vector3(),
    o = TUNNEL_FRAME.origin;
  for (let i = 0; i <= 400; i++) {
    curve.getPointAt(i / 400, p);
    const d = Math.hypot(p.x - o.x, p.y - o.y, p.z - o.z);
    if (d < bestD) {
      bestD = d;
      best = i / 400;
    }
  }
  return best;
}

export class OuterEnvironment {
  readonly root = new THREE.Group();
  readonly colliders: readonly ConvexCollider[];
  /** Pass 024: the seabed (terrain) and the rock surfaces the reef dresses. */
  readonly sand: THREE.Mesh;
  private readonly rockMeshes: readonly THREE.Mesh[];
  /** Where the tunnel opens onto the open water (for tests and the camera's first views). */
  readonly exit: THREE.Vector3;
  private readonly geometries: THREE.BufferGeometry[] = [];
  private readonly materials: THREE.Material[] = [];
  private disposed = false;

  constructor() {
    this.root.name = 'Outer waters';
    const colliders: ConvexCollider[] = [];
    const curve = tunnelCurve(),
      end = cliffParameter(curve);
    this.exit = curve.getPointAt(end);
    const rock = this.own(
      new THREE.MeshStandardMaterial({
        color: 0x7d8a80,
        vertexColors: true,
        roughness: 0.97,
        metalness: 0,
        side: THREE.DoubleSide,
      }),
    );
    this.rockMeshes = [
      this.add(this.tunnelMesh(curve, end), rock, 'Passage tunnel'),
      this.add(this.cliffMesh(), rock, 'Cliff face'),
      this.add(this.wallMesh(), rock, 'Outer wall'),
    ];
    colliders.push(...this.tunnelColliders(curve, end));
    colliders.push(...this.cliffColliders());
    this.sand = this.add(
      this.sandMesh(),
      this.own(
        new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 }),
      ),
      'Outer seabed',
    );
    this.root.add(this.motes());
    this.root.add(this.shafts());
    this.colliders = colliders;
  }
  /**
   * Pass 024: once the reef library is ready, the seabed and the tunnel and cliff wear its sand and
   * rock (the reef owns those materials; the originals are kept and restored).
   */
  dress(sand?: THREE.Material, rock?: THREE.Material): void {
    if (sand) this.sand.material = sand;
    if (rock) for (const m of this.rockMeshes) m.material = rock;
  }
  undress(): void {
    this.sand.material = this.materials[1];
    for (const m of this.rockMeshes) m.material = this.materials[0];
  }

  private own<T extends THREE.Material>(m: T): T {
    this.materials.push(m);
    return m;
  }
  private add(
    geometry: THREE.BufferGeometry,
    material: THREE.Material,
    name: string,
  ): THREE.Mesh {
    this.geometries.push(geometry);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = name;
    mesh.matrixAutoUpdate = false;
    mesh.updateMatrix();
    this.root.add(mesh);
    return mesh;
  }

  /** Inside-facing tube from just behind the origin to the cliff, darkest at its start. */
  private tunnelMesh(
    curve: THREE.CatmullRomCurve3,
    end: number,
  ): THREE.BufferGeometry {
    const L = OUTER_LAYOUT,
      length = curve.getLength() * end,
      rings = Math.ceil(length * L.samplesPerMetre),
      positions: number[] = [],
      colors: number[] = [],
      indices: number[] = [];
    const p = new THREE.Vector3(),
      t = new THREE.Vector3(),
      n = new THREE.Vector3(),
      b = new THREE.Vector3(),
      up = new THREE.Vector3(0, 1, 0);
    const start = originParameter(curve);
    for (let i = 0; i <= rings; i++) {
      const u = (i / rings) * end;
      curve.getPointAt(u, p);
      curve.getTangentAt(u, t);
      b.crossVectors(t, up).normalize();
      n.crossVectors(b, t).normalize();
      // Distance along the tunnel past the threshold (negative behind it).
      const along = (u - start) * curve.getLength();
      const light = Math.max(
          0,
          Math.min(1, (along - L.darkLength) / (length * 0.75)),
        ),
        shade = 0.03 + 0.55 * light * light;
      for (let j = 0; j <= L.sides; j++) {
        const a = (j / L.sides) * Math.PI * 2,
          ca = Math.cos(a),
          sa = Math.sin(a),
          coarse = smoothNoise(
            p.x * 0.9 + ca * 2,
            p.y * 0.9 + sa * 2,
            p.z * 0.9,
          ),
          fine = smoothNoise(p.x * 3.1 + ca * 5, p.y * 3.1 + sa * 5, p.z * 3.1),
          bump = L.wallRelief * (0.75 * coarse + 0.25 * fine),
          r = OUTER.tunnelRadius + bump;
        positions.push(
          p.x + (n.x * ca + b.x * sa) * r,
          p.y + (n.y * ca + b.y * sa) * r,
          p.z + (n.z * ca + b.z * sa) * r,
        );
        // Recesses darker than ridges; faint mineral banding along the tunnel.
        const band = 0.5 + 0.5 * Math.sin(p.z * 1.7 + coarse * 4),
          tone = shade * (0.55 + 0.6 * fine + 0.25 * band);
        colors.push(tone * 0.62, tone * 0.66, tone * 0.6);
      }
    }
    for (let i = 0; i < rings; i++)
      for (let j = 0; j < L.sides; j++) {
        const a = i * (L.sides + 1) + j,
          c = a + L.sides + 1;
        indices.push(a, c, a + 1, a + 1, c, c + 1);
      }
    // Close the dark start behind the threshold.
    curve.getPointAt(0, p);
    const cap = positions.length / 3;
    positions.push(p.x, p.y, p.z);
    colors.push(0, 0, 0);
    for (let j = 0; j < L.sides; j++) indices.push(cap, j, j + 1);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    g.setIndex(indices);
    g.computeVertexNormals();
    return g;
  }

  /** Rings of slabs around the tunnel (and a cap behind its start): the only way through. */
  private tunnelColliders(
    curve: THREE.CatmullRomCurve3,
    end: number,
  ): ConvexCollider[] {
    const L = OUTER_LAYOUT,
      R = OUTER.tunnelRadius,
      length = curve.getLength() * end,
      rings = Math.ceil(length / L.ringSpacing),
      out: ConvexCollider[] = [];
    const slab = new THREE.BoxGeometry(1, 1, 1),
      p0 = new THREE.Vector3(),
      p1 = new THREE.Vector3(),
      mid = new THREE.Vector3(),
      t = new THREE.Vector3(),
      n = new THREE.Vector3(),
      b = new THREE.Vector3(),
      radial = new THREE.Vector3(),
      tangential = new THREE.Vector3(),
      up = new THREE.Vector3(0, 1, 0),
      basis = new THREE.Matrix4(),
      scale = new THREE.Matrix4();
    const width = 2 * (R + L.slabThickness) * Math.tan(Math.PI / L.ringSides),
      overlap = 1.25;
    for (let i = 0; i < rings; i++) {
      const u0 = (i / rings) * end,
        u1 = ((i + 1) / rings) * end;
      curve.getPointAt(u0, p0);
      curve.getPointAt(u1, p1);
      mid.addVectors(p0, p1).multiplyScalar(0.5);
      t.subVectors(p1, p0);
      const segment = t.length();
      t.normalize();
      b.crossVectors(t, up).normalize();
      n.crossVectors(b, t).normalize();
      for (let j = 0; j < L.ringSides; j++) {
        const a = (j / L.ringSides) * Math.PI * 2;
        radial
          .copy(n)
          .multiplyScalar(Math.cos(a))
          .addScaledVector(b, Math.sin(a));
        tangential.crossVectors(t, radial).normalize();
        basis.makeBasis(tangential, radial, t);
        basis.setPosition(
          mid.x + radial.x * (R + L.slabThickness / 2),
          mid.y + radial.y * (R + L.slabThickness / 2),
          mid.z + radial.z * (R + L.slabThickness / 2),
        );
        scale.makeScale(
          width * overlap,
          L.slabThickness,
          segment + L.slabThickness,
        );
        out.push(rockCollider(slab, basis.clone().multiply(scale)));
      }
    }
    slab.dispose();
    // Behind the start: a solid cap.
    curve.getPointAt(0, p0);
    out.push(
      boxCollider(
        [p0.x - R - 1, p0.y - R - 1, p0.z],
        [p0.x + R + 1, p0.y + R + 1, OUTER.bounds.max.z + 1],
      ),
    );
    return out;
  }

  /** The cliff: a rough rock face across the whole width, open only at the tunnel mouth. */
  private cliffMesh(): THREE.BufferGeometry {
    const R = OUTER.tunnelRadius + 0.15,
      g = new THREE.RingGeometry(R, 95, 56, 28),
      pos = g.getAttribute('position'),
      colors: number[] = [];
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i),
        y = pos.getY(i),
        r = Math.hypot(x, y),
        rough = smoothNoise(x * 0.25, y * 0.25, 3.1),
        fine = smoothNoise(x * 1.3, y * 1.3, 7.7);
      // Recessed around the mouth, rougher further out, leaning back slightly with height.
      const depth =
        Math.min(1.2, (r - R) * 0.6) + rough * 2.4 + fine * 0.45 + y * 0.05;
      pos.setXYZ(
        i,
        this.exit.x + x,
        this.exit.y + y,
        OUTER.cliffZ + Math.max(0, depth),
      );
      const tone = 0.32 + rough * 0.22 + fine * 0.08;
      colors.push(tone * 0.86, tone * 0.92, tone * 0.88);
    }
    g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    g.computeVertexNormals();
    return g;
  }
  private cliffColliders(): ConvexCollider[] {
    const R = OUTER.tunnelRadius,
      e = this.exit,
      b = OUTER.bounds,
      z0 = OUTER.cliffZ,
      z1 = b.max.z + 1;
    // Everything behind the cliff face is rock, except the tunnel (sealed by its own slabs).
    return [
      boxCollider([b.min.x - 1, b.min.y - 1, z0], [e.x - R, b.max.y + 1, z1]),
      boxCollider([e.x + R, b.min.y - 1, z0], [b.max.x + 1, b.max.y + 1, z1]),
      boxCollider([e.x - R, e.y + R, z0], [e.x + R, b.max.y + 1, z1]),
      boxCollider([e.x - R, b.min.y - 1, z0], [e.x + R, e.y - R, z1]),
    ].map((c) => this.clipToTunnel(c));
  }
  /**
   * The cliff blocks run back through the rock; where the winding tunnel passes inside them they
   * stop short of it, so only the tunnel's own slabs bound it there.
   */
  private clipToTunnel(c: ConvexCollider): ConvexCollider {
    const depth = 1.4;
    return boxCollider(
      [c.min.x, c.min.y, c.min.z],
      [c.max.x, c.max.y, Math.min(c.max.z, OUTER.cliffZ + depth)],
    );
  }

  /**
   * The seabed as a height field over `from`..`to` (z), with sand UVs. Pass 026 splits it: the
   * reef top (sand, lighter in the gully) and the wall (rock, darkening with depth).
   */
  private terrainMesh(
    from: number,
    to: number,
    depthSegments: number,
    tone: (x: number, y: number, z: number) => number,
  ): THREE.BufferGeometry {
    const b = OUTER.bounds,
      w = b.max.x - b.min.x + 60,
      d = from - to,
      g = new THREE.PlaneGeometry(w, d, 150, depthSegments);
    g.rotateX(-Math.PI / 2);
    g.translate(0, 0, from - d / 2);
    const pos = g.getAttribute('position'),
      colors: number[] = [];
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i),
        z = pos.getZ(i),
        y = seabedHeight(x, z) + 0.03 * Math.sin(x * 2.2 + z * 0.9);
      pos.setY(i, y);
      const t = tone(x, y, z);
      colors.push(t, t * 0.97, t * 0.9);
    }
    g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    g.computeVertexNormals();
    return g;
  }
  private sandMesh(): THREE.BufferGeometry {
    return this.terrainMesh(
      OUTER.cliffZ + 2,
      OUTER.dropOff.start - 1,
      44,
      (x, _y, z) =>
        (0.78 + 0.1 * smoothNoise(x * 0.4, z * 0.4, 4.2)) *
        (1 - 0.18 * channelWeight(x, z)),
    );
  }
  /** The wall below the lip and the deep beyond it, fading to near-black with depth. */
  private wallMesh(): THREE.BufferGeometry {
    const lip = OUTER.dropOff.start;
    return this.terrainMesh(
      lip + 1.5,
      OUTER.bounds.min.z - 30,
      120,
      (x, y, z) => {
        const deep = Math.max(0, Math.min(1, -y / OUTER.dropOff.depth));
        return (
          (0.42 + 0.14 * smoothNoise(x * 0.3, y * 0.3, z * 0.3)) *
          (1 - 0.88 * deep * deep * (3 - 2 * deep))
        );
      },
    );
  }

  /** Slow motes in the open water. */
  private motes(): THREE.Points {
    const count = 1600,
      data = new Float32Array(count * 3),
      b = OUTER.bounds;
    for (let i = 0; i < count; i++) {
      data[i * 3] = b.min.x + hash(i, 1, 2) * (b.max.x - b.min.x);
      // Pass 026: densest around the reef top and the lip, drifting down into the blue.
      data[i * 3 + 1] = -18 + hash(i, 3, 4) * 36;
      data[i * 3 + 2] = OUTER.cliffZ - 1 - hash(i, 5, 6) * 55;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(data, 3));
    this.geometries.push(g);
    const points = new THREE.Points(
      g,
      this.own(
        new THREE.PointsMaterial({
          color: 0xcdeedd,
          size: 0.05,
          transparent: true,
          opacity: 0.35,
          depthWrite: false,
        }),
      ),
    );
    points.name = 'Outer motes';
    return points;
  }
  /** Broad light shafts from the far surface, slanting down past the lip into the blue. */
  private shafts(): THREE.Group {
    const group = new THREE.Group(),
      g = new THREE.CylinderGeometry(0.8, 5, 60, 14, 1, true),
      m = this.own(
        new THREE.MeshBasicMaterial({
          color: 0xc9f0dc,
          transparent: true,
          opacity: 0.016,
          depthWrite: false,
          side: THREE.DoubleSide,
          blending: THREE.AdditiveBlending,
        }),
      );
    this.geometries.push(g);
    for (let i = 0; i < 7; i++) {
      const beam = new THREE.Mesh(g, m);
      beam.position.set(-27 + i * 9, 12, -46 - (i % 3) * 9);
      beam.rotation.set(0.18, 0, -0.2);
      group.add(beam);
    }
    group.name = 'Outer light shafts';
    return group;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.root.removeFromParent();
    this.root.clear();
    this.geometries.forEach((g) => g.dispose());
    this.materials.forEach((m) => m.dispose());
  }
}
