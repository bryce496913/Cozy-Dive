import * as THREE from 'three';

/**
 * V0.8 Pass 092: organic forms for the code-built reef growth (sponges and plating corals on the
 * wreck, in the cave and under the ice). The Pass 088 audit found these still read as manufactured:
 * barrel and glass sponges were lathes with even cosine ridges, tube sponges plain cylinders,
 * encrusting sponges squashed hemispheres and the wreck's plate coral two flat discs on a cylinder
 * foot. These builders replace them with continuous, irregular growth:
 *
 *   - **`vaseSponge`**: one closed surface from a flared foot spread over the substrate, up an
 *     irregular, leaning wall (broken, knobbly ridges; lumps; growth constrictions), over a thick,
 *     uneven rolled lip and down a dark atrium to its floor;
 *   - **`encrustingSponge`**: a lobed crust thick in the middle and feathered into the substrate at
 *     its margin, raised into volcano-like oscula with dark openings;
 *   - **`foliosePlate`**: overlapping, cupped laminae whorling up out of an encrusting base (no
 *     stalk), each thick at its root and thin at a wavy, pale growing margin, with growth rings.
 *
 * All are unit-scale, grow up +y from y = 0 (their feet reach a little below it, into the surface
 * they are set on), and carry smooth normals and a grey vertex tone (the instance colour shows
 * through it): pale ridge crests and growing margins, dark grooves, pits and interiors, silted
 * feet. Deterministic per seed, pure (no GPU resources), non-indexed (they merge with the other
 * growth geometry).
 */

/** Smooth deterministic noise in about -1..1, from a few seeded plane waves. */
export function noiseField(
  seed: number,
  waves = 7,
): (x: number, y: number, z: number) => number {
  let s = seed >>> 0;
  const next = () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
  const k: number[] = [];
  for (let i = 0; i < waves; i++) {
    const a = next() * Math.PI * 2,
      b = Math.acos(next() * 2 - 1),
      f = 0.6 + next() * 0.9;
    k.push(
      Math.sin(b) * Math.cos(a) * f,
      Math.cos(b) * f,
      Math.sin(b) * Math.sin(a) * f,
      next() * Math.PI * 2,
    );
  }
  const norm = 1 / Math.sqrt(waves / 2);
  return (x, y, z) => {
    let v = 0;
    for (let i = 0; i < k.length; i += 4)
      v += Math.sin(x * k[i] + y * k[i + 1] + z * k[i + 2] + k[i + 3]);
    return v * norm * 0.7;
  };
}

/**
 * Build from a grid of rows (each `sides` points round, wrapping without a seam) with an optional
 * pole closing the last row: smooth normals on the shared grid, then non-indexed.
 */
function wrapGrid(
  rows: readonly (readonly [number, number, number, number][])[],
  pole?: readonly [number, number, number, number],
): THREE.BufferGeometry {
  const sides = rows[0].length,
    pos: number[] = [],
    tone: number[] = [],
    idx: number[] = [];
  for (const row of rows)
    for (const [x, y, z, k] of row) {
      pos.push(x, y, z);
      tone.push(k, k, k);
    }
  for (let i = 0; i + 1 < rows.length; i++)
    for (let j = 0; j < sides; j++) {
      const a = i * sides + j,
        b = i * sides + ((j + 1) % sides),
        c = a + sides,
        d = b + sides;
      idx.push(a, c, b, b, c, d);
    }
  if (pole) {
    const centre = rows.length * sides,
      last = (rows.length - 1) * sides;
    pos.push(pole[0], pole[1], pole[2]);
    tone.push(pole[3], pole[3], pole[3]);
    for (let j = 0; j < sides; j++)
      idx.push(last + j, centre, last + ((j + 1) % sides));
  }
  return finishIndexed(pos, tone, idx);
}

function finishIndexed(
  pos: number[],
  tone: number[],
  idx: number[],
): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute(
    'color',
    new THREE.Float32BufferAttribute(
      tone.map((t) => Math.max(0, Math.min(1, t))),
      3,
    ),
  );
  g.setIndex(idx);
  g.computeVertexNormals();
  const out = g.toNonIndexed();
  g.dispose();
  return out;
}

export interface VaseSpec {
  readonly seed: number;
  /** Height (unit-scale pieces use about 1). */
  readonly height: number;
  /** Outer radius at height fraction u (0 foot, 1 rim). */
  readonly radius: (u: number) => number;
  /** Wall thickness at the rim. */
  readonly wall: number;
  /** How far down the atrium reaches, as a fraction of the height (its floor's height). */
  readonly floor: number;
  /** Ridges round the wall, their depth (fraction of radius) and how broken they are (0..1). */
  readonly ridges: number;
  readonly ridgeDepth: number;
  readonly ridgeBreak: number;
  /** Lumps (fraction of radius), and growth constrictions up the wall. */
  readonly lumps: number;
  readonly rings: number;
  /** How uneven the rim's height is (fraction of height). */
  readonly lipWave: number;
  /** Lean of the axis at the rim (x, z, in units of height). */
  readonly lean: readonly [number, number];
  /** How far the foot spreads over the substrate (fraction of the foot radius). */
  readonly flare: number;
  readonly sides?: number;
  readonly segments?: number;
}

/** A sponge vase: foot, wall, rolled lip, dark atrium. See the module comment. */
export function vaseSponge(spec: VaseSpec): THREE.BufferGeometry {
  const sides = spec.sides ?? 44,
    seg = spec.segments ?? 16,
    H = spec.height,
    n1 = noiseField(spec.seed),
    n2 = noiseField(spec.seed + 101),
    n3 = noiseField(spec.seed + 202),
    phase = n3(0.3, 0.7, 0.1) * 3,
    lip = (a: number) =>
      H * (1 + spec.lipWave * n2(Math.cos(a) * 1.6, 0.5, Math.sin(a) * 1.6)),
    axis = (y: number): [number, number] => {
      const t = Math.max(0, y / H);
      return [spec.lean[0] * H * t * t, spec.lean[1] * H * t * t];
    },
    // Radial multiplier of the wall at angle a and height fraction u.
    wallAt = (a: number, u: number) => {
      const c = Math.cos(a),
        s = Math.sin(a),
        // Ridges wander in angle and break up along their length.
        wander = 0.55 * n1(c * 1.3, u * 2.2, s * 1.3),
        crest = 0.5 + 0.5 * Math.cos(spec.ridges * a + phase + wander * 2.4),
        broken =
          1 -
          spec.ridgeBreak *
            (0.5 + 0.5 * n2(c * 3.1, u * 5.3 + a * 0.2, s * 3.1)),
        ridge = spec.ridgeDepth * (crest * crest * crest - 0.35) * broken,
        lump = spec.lumps * n3(c * 1.9, u * 2.6, s * 1.9),
        ring =
          spec.rings > 0
            ? -0.035 *
              Math.max(
                0,
                Math.sin(u * Math.PI * spec.rings + 1.3 * n1(c, u, s)),
              )
            : 0;
      return { k: 1 + ridge + lump + ring, crest: crest * broken };
    };
  type P = [number, number, number, number];
  const rows: P[][] = [];
  const ring = (f: (a: number) => P) => {
    const row: P[] = [];
    for (let j = 0; j < sides; j++) row.push(f((j / sides) * Math.PI * 2));
    rows.push(row);
  };
  const at = (a: number, r: number, y: number, k: number): P => {
    const [ax, az] = axis(y);
    return [ax + Math.cos(a) * r, y, az + Math.sin(a) * r, k];
  };
  // The foot, spreading into the substrate (below y 0), silted dark.
  const r0 = spec.radius(0);
  for (const [t, y] of [
    [1, -0.04 * H],
    [0.55, -0.005 * H],
  ] as const)
    ring((a) => {
      // Smooth lobes only (the ridges frayed it into points), spreading over the surface.
      const spread =
          1 +
          spec.flare *
            t *
            (0.8 + 0.4 * n3(Math.cos(a) * 1.6, 0, Math.sin(a) * 1.6)),
        lump = 1 + spec.lumps * n3(Math.cos(a) * 1.9, 0, Math.sin(a) * 1.9);
      return at(a, r0 * spread * lump, y, 0.42 + 0.12 * (1 - t));
    });
  // The outer wall.
  for (let i = 0; i <= seg; i++) {
    const u = i / seg;
    ring((a) => {
      const w = wallAt(a, u),
        y = u * lip(a) * 0.985;
      return at(
        a,
        spec.radius(u) * w.k,
        y,
        // Silted foot, paler crests, a lighter band below the lip.
        0.5 +
          0.28 * Math.min(1, u * 2.5) +
          0.16 * w.crest -
          0.06 +
          0.08 * u * u,
      );
    });
  }
  // Over the rolled lip.
  for (const [ang, k] of [
    [0.6, 0.92],
    [1.2, 0.9],
    [1.9, 0.72],
    [2.5, 0.5],
  ] as const)
    ring((a) => {
      const w = wallAt(a, 1),
        rOut = spec.radius(1) * w.k,
        half = spec.wall * 0.5,
        mid = rOut - half;
      return at(
        a,
        mid + Math.cos(ang) * half,
        lip(a) * 0.985 + Math.sin(ang) * half * 0.9,
        k,
      );
    });
  // Down the atrium: dark, darker with depth.
  for (let i = seg; i >= 0; i--) {
    const u = spec.floor + (1 - spec.floor) * (i / seg);
    ring((a) => {
      const w = wallAt(a, u),
        rIn = Math.max(
          spec.radius(u) * w.k - spec.wall * (0.75 + 0.25 * (1 - u)),
          spec.radius(u) * 0.25,
        ),
        y = u * lip(a) * 0.985,
        depth = (1 - u) / Math.max(1e-3, 1 - spec.floor);
      return at(a, rIn, y, 0.34 - 0.24 * depth);
    });
  }
  const [px, pz] = axis(spec.floor * H);
  return wrapGrid(rows, [px, spec.floor * H - spec.wall * 0.3, pz, 0.08]);
}

export interface CrustSpec {
  readonly seed: number;
  /** Radius and thickness (unit-scale pieces use about 1 and 0.3). */
  readonly radius: number;
  readonly thickness: number;
  /** How lobed the margin is (fraction of radius). */
  readonly lobes: number;
  /** Number of oscula and their height (fraction of thickness). */
  readonly oscula: number;
  readonly osculumHeight: number;
  /** Low surface relief (fraction of thickness). */
  readonly relief: number;
}

/** An encrusting sponge: lobed, feathered into the substrate, with raised oscula. */
export function encrustingSponge(spec: CrustSpec): THREE.BufferGeometry {
  const sides = 56,
    rings = 20,
    R = spec.radius,
    T = spec.thickness,
    n1 = noiseField(spec.seed),
    n2 = noiseField(spec.seed + 77);
  let s = spec.seed >>> 0;
  const rand = () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
  const margin = (a: number) =>
    R *
    (1 +
      spec.lobes * n1(Math.cos(a) * 1.4, 0.2, Math.sin(a) * 1.4) +
      0.4 * spec.lobes * n2(Math.cos(a) * 3.3, 0.9, Math.sin(a) * 3.3));
  // Oscula sit on the thicker inner part, apart.
  const vents: [number, number, number][] = [];
  for (let tries = 0; vents.length < spec.oscula && tries < 200; tries++) {
    const a = rand() * Math.PI * 2,
      d = Math.sqrt(rand()) * 0.6,
      x = Math.cos(a) * d * R,
      z = Math.sin(a) * d * R,
      w = R * (0.13 + 0.08 * rand());
    if (
      vents.some(([vx, vz, vw]) => Math.hypot(vx - x, vz - z) < (vw + w) * 1.3)
    )
      continue;
    vents.push([x, z, w]);
  }
  /** Height and tone of the crust at (x, z), `dome` 0 at the margin to 1 at the crown. */
  const surface = (x: number, z: number, dome: number): [number, number] => {
    // Two octaves of relief, and a crown that rises unevenly (not one smooth dome).
    const relief =
        spec.relief *
        (n2((x * 3) / R, 0.3, (z * 3) / R) +
          0.5 * n1((x * 7.5) / R, 1.7, (z * 7.5) / R)),
      crown = 1 + 0.35 * n1((x * 1.4) / R, 2.9, (z * 1.4) / R);
    let y = T * dome * crown * (1 + relief) - 0.04 * T,
      k = 0.66 + 0.16 * dome + 0.12 * relief;
    for (const [vx, vz, vw] of vents) {
      const q = Math.hypot(x - vx, z - vz) / vw;
      if (q > 2) continue;
      // A raised chimney with a dark opening at its top.
      y += T * spec.osculumHeight * Math.exp(-q * q * 1.6) * dome;
      const pit = Math.exp(-q * q * 9);
      y -= T * spec.osculumHeight * 1.4 * pit * dome;
      k = k * (1 - 0.8 * pit) + 0.08 * (1 - Math.exp(-q * q * 1.6));
    }
    return [y, k];
  };
  type P = [number, number, number, number];
  const rows: P[][] = [];
  // From the feathered margin (tucked under y 0) in toward the crown.
  for (let i = 0; i < rings; i++) {
    const t = 1 - i / rings,
      row: P[] = [];
    for (let j = 0; j < sides; j++) {
      const a = (j / sides) * Math.PI * 2,
        r = margin(a) * (i === 0 ? 1.04 : t),
        x = Math.cos(a) * r,
        z = Math.sin(a) * r;
      if (i === 0) row.push([x, -0.08 * T, z, 0.5]);
      else {
        const [y, k] = surface(x, z, Math.pow(Math.max(0, 1 - t * t), 0.55));
        row.push([x, y, z, k]);
      }
    }
    rows.push(row);
  }
  const [cy, ck] = surface(0, 0, 1);
  return wrapGrid(rows, [0, cy, 0, ck]);
}

export interface PlateSpec {
  readonly seed: number;
  /** Number of laminae, their reach and the height the whorl rises to (unit-scale ~1). */
  readonly laminae: number;
  readonly reach: number;
  readonly rise: number;
  /** Thickness at a lamina's root, and how much its rim cups upward. */
  readonly thickness: number;
  readonly cup: number;
  /** Radius of the encrusting base the whorl grows out of. */
  readonly base: number;
}

/**
 * A foliose plating colony: laminae whorling up and out of an encrusting base. Each lamina is a
 * closed lens (top and underside meeting at a rounded margin), thick at its root and thin at its
 * wavy growing edge, with concentric growth rings.
 */
export function foliosePlate(spec: PlateSpec): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const n1 = noiseField(spec.seed),
    n2 = noiseField(spec.seed + 31);
  // The colony's own skeleton: a low, lumpy crust flush with the substrate (each lamina grows out
  // of it, the upper ones out of the lower ones' roots), wide, never a stalk.
  const heapHeight = spec.rise * 0.5 + spec.base * 0.45,
    heapRadius = spec.base * 1.1;
  parts.push(
    encrustingSponge({
      seed: spec.seed + 5,
      radius: heapRadius,
      thickness: heapHeight,
      lobes: 0.2,
      oscula: 0,
      osculumHeight: 0,
      relief: 0.2,
    }),
  );
  /** The heap's radius at height y (its dome profile, inverted), a little inside it. */
  const heapAt = (y: number) =>
    heapRadius *
    0.75 *
    Math.sqrt(
      Math.max(0.05, 1 - Math.pow(Math.min(1, y / heapHeight), 1 / 0.55)),
    );
  const golden = 2.39996;
  for (let L = 0; L < spec.laminae; L++) {
    const f = spec.laminae > 1 ? L / (spec.laminae - 1) : 0,
      heading = L * golden + n1(L, 0.3, 0.7),
      // Lower laminae reach furthest; upper ones are younger and smaller.
      reach =
        spec.reach * (1 - 0.38 * f) * (0.9 + 0.2 * (0.5 + 0.5 * n2(L, 1, 2))),
      // Broad laminae (half-angle about 1.1 to 1.5 rad) that overlap round the whorl.
      span = 1.1 + 0.4 * (0.5 + 0.5 * n1(L * 1.7, 2, 0.4)),
      y0 = spec.base * 0.2 + spec.rise * f,
      // Upturned into a cupped rosette (a foliose whorl), each lamina its own angle.
      tilt = 0.3 + 0.12 * n2(L * 2.3, 0.1, 1.1),
      root = heapAt(y0),
      dRows = 14,
      sCols = 18,
      pos: number[] = [],
      tone: number[] = [];
    const point = (d: number, s: number, side: 1 | -1) => {
      const ang = heading + s * span * (0.75 + 0.25 * d),
        edge =
          reach * (1 + 0.12 * n1(Math.cos(ang) * 2.5, L, Math.sin(ang) * 2.5)),
        r = root + d * (edge - root),
        lens =
          Math.sqrt(Math.max(0, 1 - s * s)) *
          Math.sqrt(Math.max(0, 1 - d ** 6)),
        t = spec.thickness * (1 - 0.72 * d) * lens,
        mid =
          y0 +
          tilt * r +
          spec.cup * (r / reach) ** 2 * reach +
          0.03 * reach * d * n2(Math.cos(ang) * 4, L * 0.5, Math.sin(ang) * 4),
        y = mid + (side * t) / 2,
        // Growth rings, a pale growing margin, a darker underside.
        rings = 0.5 + 0.5 * Math.sin((r / reach) * 22 + 2 * n1(r * 3, L, ang)),
        k =
          side > 0
            ? 0.56 + 0.18 * rings + 0.26 * Math.pow(d, 4)
            : 0.45 + 0.08 * rings + 0.2 * Math.pow(d, 4);
      pos.push(Math.cos(ang) * r, y, Math.sin(ang) * r);
      tone.push(k, k, k);
    };
    // Top then underside over the same (d, s) grid; their boundary rows coincide (closed lens).
    for (const side of [1, -1] as const)
      for (let i = 0; i <= dRows; i++)
        for (let j = 0; j <= sCols; j++)
          point(i / dRows, (j / sCols) * 2 - 1, side);
    const stride = sCols + 1,
      under = (dRows + 1) * stride,
      topIdx: number[] = [],
      underIdx: number[] = [];
    for (let i = 0; i < dRows; i++)
      for (let j = 0; j < sCols; j++) {
        const a = i * stride + j,
          b = a + 1,
          c = a + stride,
          d = c + 1;
        topIdx.push(a, b, c, b, d, c);
        underIdx.push(
          under + a,
          under + c,
          under + b,
          under + b,
          under + c,
          under + d,
        );
      }
    parts.push(finishIndexed(pos, tone, topIdx));
    // The underside faces down but is shaded like the top (its normals turned up): seen from below
    // a plate otherwise lies in the water's shade and reads as a black hole (as the Pass 086
    // plates did).
    const below = finishIndexed(pos, tone, underIdx),
      nb = below.getAttribute('normal');
    for (let k = 0; k < nb.count; k++)
      nb.setXYZ(k, -nb.getX(k), -nb.getY(k), -nb.getZ(k));
    parts.push(below);
  }
  return mergeAll(parts);
}

/** Merge non-indexed position / normal / colour geometries (and dispose the parts). */
export function mergeAll(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
  let n = 0;
  for (const p of parts) n += p.getAttribute('position').count;
  const out = new THREE.BufferGeometry();
  for (const name of ['position', 'normal', 'color']) {
    const arr = new Float32Array(n * 3);
    let o = 0;
    for (const p of parts) {
      const a = p.getAttribute(name);
      arr.set(a.array as Float32Array, o);
      o += a.count * 3;
    }
    out.setAttribute(name, new THREE.Float32BufferAttribute(arr, 3));
  }
  parts.forEach((p) => p.dispose());
  return out;
}

/** Translate / rotate / scale a growth geometry in place (returns it). */
export function placed(
  g: THREE.BufferGeometry,
  at: readonly [number, number, number],
  scale = 1,
  yaw = 0,
): THREE.BufferGeometry {
  g.applyMatrix4(
    new THREE.Matrix4().compose(
      new THREE.Vector3(...at),
      new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw),
      new THREE.Vector3(scale, scale, scale),
    ),
  );
  return g;
}
