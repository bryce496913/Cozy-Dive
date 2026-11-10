import * as THREE from 'three';

/**
 * Pass 019 hotfix: a sculpted moray head in place of the earlier ellipsoid. A long tapering snout
 * over a deep gape, a raised brow behind small forward-set eyes, tubular front nostrils, a hinged
 * lower jaw with fine teeth, and gill openings. Local frame: +z towards the snout, y up, origin at
 * the end of the body centreline. Skin vertices carry `moraySkinMask` 1 so the shared moray shader
 * mottles them like the body; eyes, mouth lining and teeth keep their own colours (mask 0).
 */

const SKIN = 0xffffff;
const LINING = 0x5b4440;
const TOOTH = 0xe9e4d2;
/** A flat strip inside the lip line following the head's taper (mouth lining). */
function lining(
  y: number,
  inset: number,
  facingUp: boolean,
): THREE.BufferGeometry {
  const p: number[] = [],
    index: number[] = [],
    steps = 16;
  for (let i = 0; i <= steps; i++) {
    const u = 0.06 + (0.9 * i) / steps,
      w = profile(u).w * inset,
      z = Z0 + (Z1 - Z0) * u;
    p.push(-w, y, z, w, y, z);
    if (i < steps) {
      const a = i * 2;
      index.push(
        ...(facingUp
          ? [a, a + 1, a + 2, a + 1, a + 3, a + 2]
          : [a, a + 2, a + 1, a + 1, a + 2, a + 3]),
      );
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
  g.setIndex(index);
  g.computeVertexNormals();
  return g;
}
/** Hinge of the lower jaw in head space. */
export const MORAY_JAW_HINGE = new THREE.Vector3(0, -0.012, -0.07);

function paint(
  g: THREE.BufferGeometry,
  color: number,
  skin: boolean,
): THREE.BufferGeometry {
  const c = new THREE.Color(color),
    count = g.attributes.position.count,
    rgb = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) c.toArray(rgb, i * 3);
  g.setAttribute('color', new THREE.BufferAttribute(rgb, 3));
  g.setAttribute(
    'moraySkinMask',
    new THREE.BufferAttribute(new Float32Array(count).fill(skin ? 1 : 0), 1),
  );
  return g;
}

/** Worley F1/F2 over a jittered 3D grid (cell size `cell`), deterministic per cell. */
function worley(
  x: number,
  y: number,
  z: number,
  cell: number,
): [number, number] {
  const cx = Math.floor(x / cell),
    cy = Math.floor(y / cell),
    cz = Math.floor(z / cell);
  let d1 = Infinity,
    d2 = Infinity;
  for (let i = -1; i <= 1; i++)
    for (let j = -1; j <= 1; j++)
      for (let k = -1; k <= 1; k++) {
        const gx = cx + i,
          gy = cy + j,
          gz = cz + k,
          h = (n: number) => {
            const v =
              Math.sin(gx * 127.1 + gy * 311.7 + gz * 74.7 + n * 53.3) *
              43758.5453;
            return v - Math.floor(v);
          };
        const d = Math.hypot(
          (gx + h(1)) * cell - x,
          (gy + h(2)) * cell - y,
          (gz + h(3)) * cell - z,
        );
        if (d < d1) {
          d2 = d1;
          d1 = d;
        } else if (d < d2) d2 = d;
      }
  return [d1, d2];
}

/**
 * The authored body's reticulated skin (Pass 015 `honeycomb`): a dark net over a warm cream
 * ground, lighter on the underside. Pattern space is the head's own, offset as in Pass 015.
 */
function reticulate(g: THREE.BufferGeometry): THREE.BufferGeometry {
  const p = g.attributes.position,
    n = g.attributes.normal,
    color = g.attributes.color,
    srgb = new THREE.Color(),
    cell = 0.075;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i),
      y = p.getY(i),
      z = p.getZ(i) + 2.6,
      [d1, d2] = worley(x, y, z, cell),
      net = Math.exp(-(((d2 - d1) / (cell * 0.12)) ** 2)),
      ground = 0.9 + 0.1 * Math.sin(x * 23 + z * 17) * Math.cos(y * 19),
      belly = Math.min(1, Math.max(0, -n.getY(i) / 0.8)) * 0.25;
    const k = 1 - net * 0.88;
    let r = 0.88 * ground * k + 0.2 * net * 0.88,
      gg = 0.8 * ground * k + 0.14 * net * 0.88,
      b = 0.5 * ground * k + 0.08 * net * 0.88;
    r = r * (1 - belly) + 0.86 * belly;
    gg = gg * (1 - belly) + 0.82 * belly;
    b = b * (1 - belly) + 0.64 * belly;
    // Pass 015 wrote these as sRGB colour; vertex colours are linear in three.js.
    srgb.setRGB(r, gg, b, THREE.SRGBColorSpace);
    color.setXYZ(i, srgb.r, srgb.g, srgb.b);
  }
  return g;
}

/** Closed loft through `rings` (each ring the same point count), capped at both ends. */
function loft(rings: THREE.Vector3[][]): THREE.BufferGeometry {
  const n = rings[0].length,
    p: number[] = [],
    uv: number[] = [],
    index: number[] = [];
  rings.forEach((ring, i) =>
    ring.forEach((v, j) => {
      p.push(v.x, v.y, v.z);
      // Around the head and along it, at the body skin's texel density.
      uv.push(j / n, (i / (rings.length - 1)) * 0.16);
    }),
  );
  for (let i = 0; i < rings.length - 1; i++)
    for (let j = 0; j < n; j++) {
      const a = i * n + j,
        b = i * n + ((j + 1) % n),
        c = a + n,
        d = b + n;
      index.push(a, b, c, b, d, c);
    }
  for (const [ringIndex, flip] of [
    [0, true],
    [rings.length - 1, false],
  ] as const) {
    const center = rings[ringIndex]
      .reduce((s, v) => s.add(v), new THREE.Vector3())
      .multiplyScalar(1 / n);
    const k = p.length / 3;
    p.push(center.x, center.y, center.z);
    uv.push(0.5, ringIndex ? 0.16 : 0);
    for (let j = 0; j < n; j++) {
      const a = ringIndex * n + j,
        b = ringIndex * n + ((j + 1) % n);
      index.push(...(flip ? [k, b, a] : [k, a, b]));
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(index);
  g.computeVertexNormals();
  return g;
}

const Z0 = -0.12,
  Z1 = 0.34;
/** Head half-width, brow height above the mouth line and jaw depth along the head (u 0 -> 1). */
function profile(u: number): { w: number; top: number; jaw: number } {
  const snout = Math.pow(Math.max(0, 1 - u), 0.35);
  return {
    w: 0.17 * (1 - 0.55 * u ** 2.1) * (0.35 + 0.65 * snout),
    top:
      (0.15 * (1 - 0.52 * u ** 1.7) +
        0.028 * Math.exp(-(((u - 0.36) / 0.16) ** 2))) *
      (0.3 + 0.7 * snout),
    jaw: 0.085 * (1 - 0.45 * u ** 1.5) * (0.3 + 0.7 * snout),
  };
}

export interface MorayHeadParts {
  /** Textured-skin surfaces (with UVs) and small coloured details, for head and lower jaw. */
  readonly headSkin: THREE.BufferGeometry;
  readonly head: THREE.BufferGeometry[];
  /** Lower jaw parts in jaw space (pivot at `MORAY_JAW_HINGE`). */
  readonly jawSkin: THREE.BufferGeometry;
  readonly jaw: THREE.BufferGeometry[];
}

export function morayHeadParts(): MorayHeadParts {
  const stations = 64,
    around = 72,
    upper: THREE.Vector3[][] = [],
    lower: THREE.Vector3[][] = [];
  for (let i = 0; i <= stations; i++) {
    const u = i / stations,
      z = Z0 + (Z1 - Z0) * u,
      { w, top, jaw } = profile(u),
      upperRing: THREE.Vector3[] = [],
      lowerRing: THREE.Vector3[] = [];
    for (let j = 0; j < around; j++) {
      const a = (j / around) * Math.PI * 2;
      // Upper head: domed above the lip line, a shallow palate below it.
      const sy = Math.sin(a),
        x = Math.cos(a) * w * (sy < 0 ? 0.94 : 1),
        bump =
          sy > 0
            ? 0.006 * Math.sin(z * 61 + a * 7) * Math.cos(z * 37 - a * 5)
            : 0;
      upperRing.push(
        new THREE.Vector3(x, sy > 0 ? sy * top + bump : sy * 0.012, z),
      );
      // Lower jaw: a keel-shaped chin with a flat floor of the mouth.
      lowerRing.push(
        new THREE.Vector3(
          Math.cos(a) * w * 0.92,
          sy < 0
            ? sy * jaw * (0.85 + 0.15 * Math.abs(Math.cos(a)))
            : sy * 0.006,
          z,
        ),
      );
    }
    upper.push(upperRing);
    if (u > 0.04 && u < 0.985) lower.push(lowerRing);
  }
  const headSkin = reticulate(paint(loft(upper), SKIN, true));
  // Mouth lining: a dark palate just inside the lip line, facing down into the gape.
  const head: THREE.BufferGeometry[] = [
    paint(lining(-0.013, 0.88, false), LINING, false),
  ];
  // Eyes: small, high and well forward, under a slight brow ridge.
  for (const side of [-1, 1]) {
    const u = 0.58,
      { w, top } = profile(u),
      z = Z0 + (Z1 - Z0) * u,
      cx = side * w * 0.8,
      cy = top * 0.62;
    const eye = new THREE.SphereGeometry(0.021, 14, 10);
    eye.scale(0.7, 1, 1);
    eye.translate(cx, cy, z);
    head.push(paint(eye, 0xd8c47a, false));
    const pupil = new THREE.SphereGeometry(0.011, 10, 8);
    pupil.translate(cx + side * 0.012, cy, z + 0.004);
    head.push(paint(pupil, 0x111613, false));
    const glint = new THREE.SphereGeometry(0.0035, 6, 4);
    glint.translate(cx + side * 0.019, cy + 0.006, z + 0.009);
    head.push(paint(glint, 0xf2f1e6, false));
    // Tubular anterior nostril near the snout tip.
    const nu = 0.93,
      np = profile(nu),
      nz = Z0 + (Z1 - Z0) * nu,
      nostril = new THREE.CylinderGeometry(0.0045, 0.006, 0.026, 8);
    nostril.rotateX(Math.PI / 2 - 0.5);
    nostril.translate(side * np.w * 0.55, np.top * 0.62, nz + 0.012);
    head.push(paint(nostril, 0x8a8466, false));
    // Small round gill opening behind the head.
    const gill = new THREE.SphereGeometry(0.014, 10, 8);
    gill.scale(0.4, 1, 1.3);
    gill.translate(side * profile(0.08).w * 0.93, -0.004, Z0 + 0.04);
    head.push(paint(gill, 0x2b2c26, false));
  }
  // Fine teeth along the upper lip, pointing down.
  const teeth = (
    y: number,
    down: boolean,
    out: THREE.BufferGeometry[],
    dz = 0,
  ) => {
    for (const side of [-1, 1])
      for (let k = 0; k < 9; k++) {
        const u = 0.3 + k * 0.075,
          { w } = profile(u),
          z = Z0 + (Z1 - Z0) * u,
          tooth = new THREE.ConeGeometry(0.0045, 0.02 - k * 0.0008, 5);
        if (down) tooth.rotateX(Math.PI);
        tooth.translate(side * w * 0.8, y + (down ? -0.01 : 0.01), z + dz);
        out.push(paint(tooth, TOOTH, false));
      }
  };
  teeth(-0.006, true, head);
  const jawSkin = reticulate(paint(loft(lower), SKIN, true));
  const jaw: THREE.BufferGeometry[] = [
    paint(lining(0.007, 0.8, true), LINING, false),
  ];
  teeth(0.004, false, jaw);
  // Express the jaw in its hinge frame.
  for (const g of [jawSkin, ...jaw])
    g.translate(-MORAY_JAW_HINGE.x, -MORAY_JAW_HINGE.y, -MORAY_JAW_HINGE.z);
  return { headSkin, head, jawSkin, jaw };
}
