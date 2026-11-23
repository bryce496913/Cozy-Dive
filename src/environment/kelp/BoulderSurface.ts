import type * as THREE from 'three';

/** A point on a surface (world space) and its outward unit normal. */
export interface Seat {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  /** Surface normal there (unit). */
  readonly nx: number;
  readonly ny: number;
  readonly nz: number;
}

/** The ellipsoid a boulder's seats are addressed on: centre and radii (m). */
export interface BoulderFrame {
  readonly x: number;
  readonly cy: number;
  readonly z: number;
  /** Horizontal and vertical radii. */
  readonly rx: number;
  readonly ry: number;
}

const AZ = 32,
  EL = 12,
  EL_MIN = -0.4,
  EL_MAX = Math.PI / 2;

/**
 * V0.8 Pass 091: an authored rock's outer surface, for seating life on it. The kelp forest's sea
 * stars, anemones and nudibranchs are addressed by (azimuth, elevation) on an ellipsoid round each
 * boulder; on the code-built ovoids that ellipsoid was the rock. The authored rock is fractured,
 * stepped and undercut, so this samples its real outer surface once at build time: the placed
 * mesh's vertices binned by direction from the frame's centre (in the ellipsoid's normalized space,
 * so a bin's elevation is the ellipsoid's), keeping the outermost radius and the normals there.
 * A lookup is a bilinear blend of four bins, allocation-free, so creeping nudibranchs can follow it
 * every frame.
 */
export class BoulderSurface {
  private readonly radius = new Float32Array(AZ * EL);
  private readonly normal = new Float32Array(AZ * EL * 3);

  constructor(
    geometry: THREE.BufferGeometry,
    private readonly frame: BoulderFrame,
  ) {
    const p = geometry.getAttribute('position'),
      n = geometry.getAttribute('normal'),
      bins = new Int32Array(p.count).fill(-1),
      rs = new Float32Array(p.count);
    const { x, cy, z, rx, ry } = frame;
    for (let i = 0; i < p.count; i++) {
      const u = (p.getX(i) - x) / rx,
        v = (p.getY(i) - cy) / ry,
        w = (p.getZ(i) - z) / rx,
        e = Math.atan2(v, Math.hypot(u, w));
      if (e < EL_MIN) continue;
      const a = Math.atan2(w, u),
        ai = Math.floor(((a + Math.PI) / (Math.PI * 2)) * AZ) % AZ,
        ei = Math.min(
          EL - 1,
          Math.floor(((e - EL_MIN) / (EL_MAX - EL_MIN)) * EL),
        ),
        k = ei * AZ + ai;
      bins[i] = k;
      rs[i] = Math.hypot(u, v, w);
      if (rs[i] > this.radius[k]) this.radius[k] = rs[i];
    }
    // Normals of the outer skin only (within 8% of the bin's outermost), not of cavities behind it.
    for (let i = 0; i < p.count; i++) {
      const k = bins[i];
      if (k < 0 || rs[i] < this.radius[k] * 0.92) continue;
      this.normal[k * 3] += n.getX(i);
      this.normal[k * 3 + 1] += n.getY(i);
      this.normal[k * 3 + 2] += n.getZ(i);
    }
    this.fillGaps();
  }

  /** The surface point in direction (azimuth a, elevation e) and its normal. */
  seat(a: number, e: number): Seat {
    const fa = (((a + Math.PI) / (Math.PI * 2)) * AZ - 0.5 + AZ * 4) % AZ,
      fe = Math.min(
        EL - 1,
        Math.max(0, ((e - EL_MIN) / (EL_MAX - EL_MIN)) * EL - 0.5),
      ),
      a0 = Math.floor(fa),
      e0 = Math.floor(fe),
      ta = fa - a0,
      te = fe - e0,
      a1 = (a0 + 1) % AZ,
      e1 = Math.min(EL - 1, e0 + 1);
    const k00 = e0 * AZ + a0,
      k01 = e0 * AZ + a1,
      k10 = e1 * AZ + a0,
      k11 = e1 * AZ + a1,
      w00 = (1 - ta) * (1 - te),
      w01 = ta * (1 - te),
      w10 = (1 - ta) * te,
      w11 = ta * te,
      R = this.radius,
      N = this.normal,
      r = R[k00] * w00 + R[k01] * w01 + R[k10] * w10 + R[k11] * w11,
      nx =
        N[k00 * 3] * w00 +
        N[k01 * 3] * w01 +
        N[k10 * 3] * w10 +
        N[k11 * 3] * w11,
      ny =
        N[k00 * 3 + 1] * w00 +
        N[k01 * 3 + 1] * w01 +
        N[k10 * 3 + 1] * w10 +
        N[k11 * 3 + 1] * w11,
      nz =
        N[k00 * 3 + 2] * w00 +
        N[k01 * 3 + 2] * w01 +
        N[k10 * 3 + 2] * w10 +
        N[k11 * 3 + 2] * w11;
    const l = Math.hypot(nx, ny, nz) || 1,
      { x, cy, z, rx, ry } = this.frame,
      ce = Math.cos(e);
    return {
      x: x + rx * r * ce * Math.cos(a),
      y: cy + ry * r * Math.sin(e),
      z: z + rx * r * ce * Math.sin(a),
      nx: nx / l,
      ny: ny / l,
      nz: nz / l,
    };
  }

  /** Bins no vertex fell in take their neighbours' average; normals are made unit. */
  private fillGaps(): void {
    for (let pass = 0; pass < 8; pass++) {
      let empty = 0;
      for (let ei = 0; ei < EL; ei++)
        for (let ai = 0; ai < AZ; ai++) {
          const k = ei * AZ + ai;
          if (this.radius[k] > 0) continue;
          let r = 0,
            c = 0;
          for (const [da, de] of [
            [1, 0],
            [-1, 0],
            [0, 1],
            [0, -1],
          ]) {
            const e2 = ei + de;
            if (e2 < 0 || e2 >= EL) continue;
            const j = e2 * AZ + ((ai + da + AZ) % AZ);
            if (this.radius[j] <= 0) continue;
            r += this.radius[j];
            for (let d = 0; d < 3; d++)
              this.normal[k * 3 + d] += this.normal[j * 3 + d];
            c++;
          }
          if (c) this.radius[k] = r / c;
          else empty++;
        }
      if (!empty) break;
    }
    for (let k = 0; k < AZ * EL; k++) {
      if (this.radius[k] <= 0) this.radius[k] = 1;
      const l = Math.hypot(
        this.normal[k * 3],
        this.normal[k * 3 + 1],
        this.normal[k * 3 + 2],
      );
      if (l > 0) for (let d = 0; d < 3; d++) this.normal[k * 3 + d] /= l;
      else this.normal[k * 3 + 1] = 1;
    }
  }
}
