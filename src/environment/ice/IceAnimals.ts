import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/**
 * Playtest ("the large creatures under the ice are blobs; the polar bear is very bad"): the big
 * animals, rebuilt in code to the standard of the rest of the world. Each is lofted from measured
 * cross-sections into one smooth body, with real fins, flippers, flukes, legs and features, and its
 * own markings; its skin carries a fine texture (grain, or combed fur) in a small generated map,
 * normal map and roughness map. Each keeps its predecessor's name, size and swimming morphs
 * (`Stroke_Left` / `Stroke_Right` on `Body` and `Body_LOD1`), so everything that drives them is
 * unchanged:
 *   - **killer whale**: black and white, eye patch, grey saddle, tall dorsal fin, flukes beating;
 *   - **minke whale**: slender, pointed rostrum, throat grooves, white-banded flippers;
 *   - **leopard seal**: long body, great reptilian head with its long gape, spotted silver belly;
 *   - **harbour / Weddell seal**: plump, mottled, dog-like head, whiskers;
 *   - **emperor** and **Adélie penguins**: proper heads and bills, flippers that flap;
 *   - **polar bear**: cream fur, long neck, small head and round ears, paddling forelegs.
 * All face +x, centred on the origin, metres. Pure geometry and data textures (owned by the asset
 * cache that builds them, disposed with it).
 */
type RGB = readonly [number, number, number];
type V3 = THREE.Vector3;
/** How a part moves with the swimming stroke: its point `p` displaced for a stroke of `sign`. */
type Stroke = (p: V3, sign: number, out: V3) => void;
const still: Stroke = (p, _s, out) => void out.copy(p);

const smooth = (t: number): number => {
  const c = Math.max(0, Math.min(1, t));
  return c * c * (3 - 2 * c);
};
/** A smooth curve through (u, value) knots (Catmull-Rom), sampled at `u`. */
function profile(
  knots: readonly (readonly [number, number])[],
): (u: number) => number {
  return (u) => {
    if (u <= knots[0][0]) return knots[0][1];
    for (let i = 0; i + 1 < knots.length; i++) {
      const [u0, v0] = knots[i],
        [u1, v1] = knots[i + 1];
      if (u > u1) continue;
      const t = (u - u0) / (u1 - u0),
        vm = knots[Math.max(0, i - 1)][1],
        vp = knots[Math.min(knots.length - 1, i + 2)][1],
        t2 = t * t,
        t3 = t2 * t;
      return Math.max(
        0,
        0.5 *
          (2 * v0 +
            (-vm + v1) * t +
            (2 * vm - 5 * v0 + 4 * v1 - vp) * t2 +
            (-vm + 3 * v0 - 3 * v1 + vp) * t3),
      );
    }
    return knots[knots.length - 1][1];
  };
}
/** A cheap repeatable hash in 0..1. */
const hash = (a: number, b: number): number => {
  const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
  return s - Math.floor(s);
};
/** Spots: 1 inside a spot on a jittered grid of cells (`cu` × `ca` over u and angle), else 0. */
function spots(
  u: number,
  a: number,
  cu: number,
  ca: number,
  size: number,
  chance: number,
): number {
  const x = u * cu,
    y = (a / (Math.PI * 2)) * ca,
    ix = Math.floor(x),
    iy = Math.floor(y);
  if (hash(ix, iy) > chance) return 0;
  const cx = ix + 0.25 + 0.5 * hash(iy, ix),
    cy = iy + 0.25 + 0.5 * hash(ix + 7, iy + 3);
  return Math.hypot(x - cx, y - cy) < size * (0.6 + 0.6 * hash(ix + 1, iy + 9))
    ? 1
    : 0;
}

interface Part {
  readonly geometry: THREE.BufferGeometry;
  readonly stroke: Stroke;
}
/** Adds a colour attribute from `colour(position)`. */
function paint(
  g: THREE.BufferGeometry,
  colour: (p: V3) => RGB,
): THREE.BufferGeometry {
  const p = g.getAttribute('position'),
    c = new Float32Array(p.count * 3),
    v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++)
    c.set(colour(v.fromBufferAttribute(p, i)), i * 3);
  g.setAttribute('color', new THREE.Float32BufferAttribute(c, 3));
  return g;
}

interface BodySpec {
  readonly length: number;
  readonly rings: number;
  readonly around: number;
  /** Half-width, height above and below the centre line, and the centre line's height (m). */
  readonly width: (u: number) => number;
  readonly top: (u: number) => number;
  readonly bottom: (u: number) => number;
  readonly centre: (u: number) => number;
  /** Colour at a point: u (0 tail … 1 nose), angle round (π/2 on top, -π/2 underneath). */
  readonly colour: (u: number, a: number, p: V3) => RGB;
  /** Small surface relief (m) at (u, a), e.g. throat grooves. */
  readonly relief?: (u: number, a: number) => number;
  /** How many times the skin texture repeats per metre (finer for fur). */
  readonly texels?: number;
}
/** The body: lofted ring by ring, closed at both ends, rings closer together towards them. */
function body(s: BodySpec): THREE.BufferGeometry {
  const positions: number[] = [],
    uvs: number[] = [],
    colours: number[] = [],
    index: number[] = [],
    cols = s.around + 1,
    v = new THREE.Vector3();
  for (let i = 0; i <= s.rings; i++) {
    const u = 0.5 - 0.5 * Math.cos((Math.PI * i) / s.rings),
      x = -s.length / 2 + u * s.length,
      w = Math.max(0.0005, s.width(u)),
      top = Math.max(0.0005, s.top(u)),
      bottom = Math.max(0.0005, s.bottom(u)),
      cy = s.centre(u);
    for (let j = 0; j <= s.around; j++) {
      const a = (j / s.around) * Math.PI * 2 - Math.PI / 2,
        c = Math.cos(a),
        sn = Math.sin(a),
        bump = 1 + (s.relief ? s.relief(u, a) / Math.max(w, 0.01) : 0);
      v.set(x, cy + (sn > 0 ? top : bottom) * sn * bump, w * c * bump);
      positions.push(v.x, v.y, v.z);
      uvs.push(
        u * s.length * (s.texels ?? 3),
        (j / s.around) * (s.texels ?? 3),
      );
      colours.push(...s.colour(u, a, v));
    }
  }
  for (let i = 0; i < s.rings; i++)
    for (let j = 0; j < s.around; j++) {
      const a = i * cols + j,
        b = a + 1,
        c = a + cols,
        d = c + 1;
      index.push(a, b, c, b, d, c);
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  g.setAttribute('color', new THREE.Float32BufferAttribute(colours, 3));
  g.setIndex(index);
  g.computeVertexNormals();
  return g;
}

interface FinSpec {
  readonly root: V3;
  /** Out along the span, and back along the chord (leading edge to trailing), unit vectors. */
  readonly span: V3;
  readonly chord: V3;
  readonly length: number;
  readonly chordAt: (s: number) => number;
  readonly thickAt: (s: number) => number;
  /** Offset back along the chord (sweep), and out of its plane (curl), along the span (m). */
  readonly sweepAt?: (s: number) => number;
  readonly curlAt?: (s: number) => number;
  readonly colour: (s: number, upper: boolean, p: V3) => RGB;
  readonly sections?: number;
}
/** A fin, flipper or fluke: lofted along its span with a streamlined (airfoil) section. */
function fin(f: FinSpec): THREE.BufferGeometry {
  const n = f.sections ?? 10,
    around = 12,
    span = f.span.clone().normalize(),
    chord = f.chord.clone().normalize(),
    normal = new THREE.Vector3().crossVectors(span, chord).normalize(),
    positions: number[] = [],
    uvs: number[] = [],
    colours: number[] = [],
    index: number[] = [],
    v = new THREE.Vector3(),
    cols = around + 1;
  for (let i = 0; i <= n; i++) {
    const s = i / n,
      c = Math.max(0.004, f.chordAt(s)),
      t = Math.max(0.002, f.thickAt(s)),
      centre = f.root
        .clone()
        .addScaledVector(span, f.length * s)
        .addScaledVector(chord, f.sweepAt ? f.sweepAt(s) : 0)
        .addScaledVector(normal, f.curlAt ? f.curlAt(s) : 0);
    for (let j = 0; j <= around; j++) {
      const a = (j / around) * Math.PI * 2,
        // Thickest a third back from the leading edge.
        along = Math.cos(a),
        k = along < 0 ? 0.35 : 0.65,
        thick = Math.sin(a) * t * 0.5 * (1 - 0.6 * Math.max(0, along));
      v.copy(centre)
        .addScaledVector(chord, along * c * k)
        .addScaledVector(normal, thick);
      positions.push(v.x, v.y, v.z);
      uvs.push(s * f.length * 3, (j / around) * c * 3);
      colours.push(...f.colour(s, Math.sin(a) > 0, v));
    }
  }
  for (let i = 0; i < n; i++)
    for (let j = 0; j < around; j++) {
      const a = i * cols + j,
        b = a + 1,
        c = a + cols,
        d = c + 1;
      index.push(a, c, b, b, c, d);
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  g.setAttribute('color', new THREE.Float32BufferAttribute(colours, 3));
  g.setIndex(index);
  g.computeVertexNormals();
  return g;
}

/** A limb (leg, neck): a smooth tube along a path, tapering through `radii`. */
function limb(
  path: readonly V3[],
  radii: readonly number[],
  colour: (t: number, p: V3) => RGB,
  around = 14,
): THREE.BufferGeometry {
  const n = path.length,
    positions: number[] = [],
    uvs: number[] = [],
    colours: number[] = [],
    index: number[] = [],
    cols = around + 1,
    tangent = new THREE.Vector3(),
    normal = new THREE.Vector3(0, 0, 1),
    binormal = new THREE.Vector3(),
    v = new THREE.Vector3();
  for (let i = 0; i < n; i++) {
    tangent
      .subVectors(path[Math.min(n - 1, i + 1)], path[Math.max(0, i - 1)])
      .normalize();
    normal.addScaledVector(tangent, -normal.dot(tangent)).normalize();
    binormal.crossVectors(tangent, normal);
    const t = i / (n - 1);
    for (let j = 0; j <= around; j++) {
      const a = (j / around) * Math.PI * 2;
      v.copy(path[i])
        .addScaledVector(normal, Math.cos(a) * radii[i])
        .addScaledVector(binormal, Math.sin(a) * radii[i]);
      positions.push(v.x, v.y, v.z);
      uvs.push(t * 2, j / around);
      colours.push(...colour(t, v));
    }
  }
  for (let i = 0; i + 1 < n; i++)
    for (let j = 0; j < around; j++) {
      const a = i * cols + j,
        b = a + 1,
        c = a + cols,
        d = c + 1;
      index.push(a, c, b, b, c, d);
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  g.setAttribute('color', new THREE.Float32BufferAttribute(colours, 3));
  g.setIndex(index);
  g.computeVertexNormals();
  return g;
}
/** A small rounded feature (eye, nose, paw, ear), an ellipsoid at `at`. */
function blob(
  at: V3,
  size: V3,
  colour: RGB,
  detail = 12,
): THREE.BufferGeometry {
  const g = new THREE.SphereGeometry(1, detail, Math.max(6, detail - 4));
  g.scale(size.x, size.y, size.z);
  g.translate(at.x, at.y, at.z);
  return paint(g, () => colour);
}

/** Merge the parts, each with its stroke morphs (left: +1, right: -1), into one geometry. */
function assemble(parts: readonly Part[]): THREE.BufferGeometry {
  const v = new THREE.Vector3(),
    o = new THREE.Vector3(),
    ready = parts.map(({ geometry: g, stroke }) => {
      const p = g.getAttribute('position'),
        left = new Float32Array(p.count * 3),
        right = new Float32Array(p.count * 3);
      for (let i = 0; i < p.count; i++) {
        stroke(v.fromBufferAttribute(p, i), 1, o);
        left.set([o.x, o.y, o.z], i * 3);
        stroke(v.fromBufferAttribute(p, i), -1, o);
        right.set([o.x, o.y, o.z], i * 3);
      }
      g.morphAttributes.position = [
        new THREE.Float32BufferAttribute(left, 3),
        new THREE.Float32BufferAttribute(right, 3),
      ];
      return g.index ? g : g;
    });
  const merged = mergeGeometries(ready, false);
  ready.forEach((g) => g.dispose());
  if (!merged) throw Error('An animal could not be built');
  merged.computeVertexNormals();
  return merged;
}

// ------------------------------------------------------------------ skin textures

/** A generated skin: fine grain (`skin`), feathers, or combed fur, as map/normal/roughness. */
function skinTextures(kind: 'skin' | 'feather' | 'fur'): {
  map: THREE.DataTexture;
  normalMap: THREE.DataTexture;
  roughnessMap: THREE.DataTexture;
} {
  const n = 128,
    height = new Float32Array(n * n);
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++) {
      const u = (x / n) * Math.PI * 2,
        w = (y / n) * Math.PI * 2;
      height[y * n + x] =
        kind === 'fur'
          ? // Fine strands lying along the body, broken into irregular tufts.
            0.5 *
              Math.sin(
                w * 37 +
                  Math.sin(u * 5 + w * 2) * 3 +
                  hash(Math.floor(u * 6), Math.floor(w * 9)) * 6,
              ) +
            0.35 *
              Math.sin(
                w * 61 +
                  Math.sin(u * 11) * 2 +
                  hash(Math.floor(u * 9), Math.floor(w * 13)) * 6,
              ) +
            0.25 * (hash(x, y) - 0.5)
          : kind === 'feather'
            ? 0.5 *
              Math.sin(u * 14 + Math.sin(w * 9)) *
              Math.sin(w * 14 + Math.sin(u * 7))
            : 0.5 *
                Math.sin(u * 9 + Math.sin(w * 5) * 2) *
                Math.sin(w * 11 + Math.sin(u * 4) * 2) +
              0.25 * Math.sin(u * 31 + w * 17);
    }
  const map = new Uint8Array(n * n * 4),
    normal = new Uint8Array(n * n * 4),
    rough = new Uint8Array(n * n * 4),
    strength = kind === 'fur' ? 0.8 : kind === 'feather' ? 0.9 : 1.2;
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++) {
      const i = y * n + x,
        h = height[i],
        dx = height[y * n + ((x + 1) % n)] - height[y * n + ((x + n - 1) % n)],
        dy = height[((y + 1) % n) * n + x] - height[((y + n - 1) % n) * n + x],
        l = Math.hypot(dx * strength, dy * strength, 1),
        tone = 1 - (kind === 'fur' ? 0.1 : 0.06) * (0.5 - 0.5 * h);
      map.set([tone * 255, tone * 255, tone * 255, 255], i * 4);
      normal.set(
        [
          ((-dx * strength) / l) * 127.5 + 127.5,
          ((-dy * strength) / l) * 127.5 + 127.5,
          (1 / l) * 127.5 + 127.5,
          255,
        ],
        i * 4,
      );
      const r = 0.85 + 0.15 * h;
      rough.set([255, r * 255, 255, 255], i * 4);
    }
  const make = (data: Uint8Array, srgb: boolean) => {
    const t = new THREE.DataTexture(data, n, n, THREE.RGBAFormat);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.magFilter = THREE.LinearFilter;
    t.minFilter = THREE.LinearMipmapLinearFilter;
    t.generateMipmaps = true;
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    t.needsUpdate = true;
    return t;
  };
  return {
    map: make(map, true),
    normalMap: make(normal, false),
    roughnessMap: make(rough, false),
  };
}

/** The animal as its predecessor's asset: a named root holding `Body` and `Body_LOD1`. */
function animal(
  rootName: string,
  geometry: THREE.BufferGeometry,
  kind: 'skin' | 'feather' | 'fur',
  roughness: number,
): THREE.Group {
  const t = skinTextures(kind),
    material = new THREE.MeshStandardMaterial({
      vertexColors: true,
      map: t.map,
      normalMap: t.normalMap,
      roughnessMap: t.roughnessMap,
      roughness,
      metalness: 0,
      normalScale: new THREE.Vector2(
        kind === 'fur' ? 1 : 0.6,
        kind === 'fur' ? 1 : 0.6,
      ),
    });
  const root = new THREE.Group();
  root.name = rootName;
  for (const name of ['Body', 'Body_LOD1']) {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = name;
    mesh.morphTargetDictionary = { Stroke_Left: 0, Stroke_Right: 1 };
    mesh.morphTargetInfluences = [0, 0];
    root.add(mesh);
  }
  return root;
}

// ------------------------------------------------------------------ strokes

/** Whales: the tail and flukes beat up and down from `pivot` (x) back. */
const verticalStroke =
  (pivot: number, tailX: number, amplitude: number): Stroke =>
  (p, sign, out) => {
    out.copy(p);
    if (p.x >= pivot) return;
    const t = (pivot - p.x) / (pivot - tailX);
    out.y += sign * amplitude * t * t;
  };
/** Seals: the hind body and flippers sweep side to side from `pivot` back. */
const lateralStroke =
  (pivot: number, tailX: number, amplitude: number): Stroke =>
  (p, sign, out) => {
    out.copy(p);
    if (p.x >= pivot) return;
    const t = (pivot - p.x) / (pivot - tailX);
    out.z += sign * amplitude * t * t;
  };
/** A limb or flipper swinging about an axis through its root. */
const swing =
  (root: V3, axis: V3, angle: number): Stroke =>
  (p, sign, out) => {
    out
      .copy(p)
      .sub(root)
      .applyAxisAngle(axis, sign * angle)
      .add(root);
  };

// ------------------------------------------------------------------ killer whale

export function killerWhale(): THREE.Group {
  const L = 2.9,
    width = profile([
      [0, 0.012],
      [0.05, 0.045],
      [0.15, 0.1],
      [0.3, 0.22],
      [0.5, 0.33],
      [0.65, 0.34],
      [0.8, 0.3],
      [0.9, 0.23],
      [0.96, 0.14],
      [1, 0.005],
    ]),
    top = profile([
      [0, 0.02],
      [0.05, 0.075],
      [0.15, 0.15],
      [0.3, 0.27],
      [0.5, 0.36],
      [0.65, 0.37],
      [0.8, 0.33],
      [0.9, 0.25],
      [0.96, 0.15],
      [1, 0.005],
    ]),
    bottom = profile([
      [0, 0.02],
      [0.05, 0.07],
      [0.15, 0.13],
      [0.3, 0.25],
      [0.5, 0.34],
      [0.65, 0.36],
      [0.8, 0.32],
      [0.9, 0.25],
      [0.96, 0.15],
      [1, 0.005],
    ]),
    centre = profile([
      [0, 0.04],
      [0.15, 0.03],
      [0.4, 0],
      [0.85, -0.01],
      [1, -0.05],
    ]),
    black: RGB = [0.025, 0.025, 0.03],
    white: RGB = [0.92, 0.93, 0.94],
    grey: RGB = [0.42, 0.43, 0.45],
    x = (u: number) => -L / 2 + u * L;
  const skin = body({
    length: L,
    rings: 96,
    around: 64,
    width,
    top,
    bottom,
    centre,
    colour: (u, a) => {
      const s = Math.sin(a),
        side = Math.abs(Math.cos(a));
      // The eye patch: an oval just above and behind the eye.
      const eu = (u - 0.875) / 0.045,
        ea = (s - 0.22) / 0.14;
      if (side > 0.45 && eu * eu + ea * ea < 1) return white;
      // Chin and belly white, the lobes sweeping up the flanks behind the dorsal fin.
      const chin = u > 0.74 && s < -0.25 + 0.15 * smooth((u - 0.9) / 0.08),
        belly = u > 0.38 && u <= 0.74 && s < -0.62,
        lobe =
          u > 0.2 &&
          u < 0.42 &&
          s < -0.55 + 0.75 * Math.sin(((u - 0.2) / 0.22) * Math.PI);
      if (chin || belly || lobe) return white;
      // The grey saddle behind the dorsal fin.
      if (u > 0.44 && u < 0.56 && s > 0.72) return grey;
      return black;
    },
  });
  const tailX = x(0),
    pivot = x(0.55),
    stroke = verticalStroke(pivot, tailX, 0.26);
  const dorsal = fin({
    root: new THREE.Vector3(x(0.6), centre(0.6) + top(0.6) - 0.03, 0),
    span: new THREE.Vector3(-0.08, 1, 0),
    chord: new THREE.Vector3(-1, 0, 0),
    length: 0.62,
    chordAt: (s) => 0.5 * Math.pow(1 - s, 0.9) + 0.04,
    thickAt: (s) => 0.07 * (1 - s) + 0.012,
    sweepAt: (s) => 0.12 * s * s,
    colour: () => black,
  });
  const parts: Part[] = [
    { geometry: skin, stroke },
    { geometry: dorsal, stroke },
  ];
  for (const side of [-1, 1]) {
    const root = new THREE.Vector3(x(0.79), centre(0.79) - 0.2, side * 0.24);
    parts.push({
      geometry: fin({
        root,
        span: new THREE.Vector3(-0.25, -0.6, side * 0.76),
        chord: new THREE.Vector3(-1, 0, 0),
        length: 0.46,
        chordAt: (s) => 0.3 * Math.sin(Math.PI * (0.18 + 0.75 * s)) + 0.03,
        thickAt: (s) => 0.05 * (1 - 0.6 * s),
        sweepAt: (s) => 0.08 * s,
        colour: () => black,
      }),
      stroke: swing(root, new THREE.Vector3(1, 0, 0), 0.06),
    });
    // The flukes: broad, swept, notched at the middle; black above and pale below.
    parts.push({
      geometry: fin({
        root: new THREE.Vector3(tailX + 0.05, centre(0), side * 0.01),
        span: new THREE.Vector3(-0.42, 0, side * 0.9),
        chord: new THREE.Vector3(-1, 0, 0),
        length: 0.5,
        chordAt: (s) => 0.26 * (1 - s) + 0.06,
        thickAt: (s) => 0.04 * (1 - s) + 0.008,
        sweepAt: (s) => 0.05 * s,
        curlAt: (s) => 0.02 * s * s,
        colour: (_s, upper) => (upper ? black : [0.72, 0.73, 0.75]),
      }),
      stroke,
    });
    parts.push({
      geometry: blob(
        new THREE.Vector3(
          x(0.905),
          centre(0.905) + 0.02,
          side * (width(0.905) - 0.005),
        ),
        new THREE.Vector3(0.014, 0.012, 0.01),
        [0.01, 0.01, 0.01],
      ),
      stroke: still,
    });
  }
  return animal('Orca_Root', assemble(parts), 'skin', 0.32);
}

// ------------------------------------------------------------------ minke whale

export function minkeWhale(): THREE.Group {
  const L = 2.95,
    width = profile([
      [0, 0.012],
      [0.06, 0.04],
      [0.2, 0.1],
      [0.4, 0.2],
      [0.58, 0.24],
      [0.72, 0.22],
      [0.85, 0.16],
      [0.93, 0.09],
      [1, 0.004],
    ]),
    top = profile([
      [0, 0.02],
      [0.06, 0.07],
      [0.2, 0.15],
      [0.4, 0.25],
      [0.58, 0.27],
      [0.72, 0.23],
      [0.85, 0.14],
      [0.93, 0.07],
      [1, 0.004],
    ]),
    bottom = profile([
      [0, 0.02],
      [0.06, 0.06],
      [0.2, 0.13],
      [0.4, 0.23],
      [0.58, 0.27],
      [0.72, 0.26],
      [0.85, 0.19],
      [0.93, 0.1],
      [1, 0.004],
    ]),
    centre = profile([
      [0, 0.03],
      [0.3, 0],
      [0.8, -0.01],
      [1, -0.03],
    ]),
    back: RGB = [0.2, 0.22, 0.25],
    belly: RGB = [0.8, 0.81, 0.82],
    x = (u: number) => -L / 2 + u * L;
  const skin = body({
    length: L,
    rings: 90,
    around: 56,
    width,
    top,
    bottom,
    centre,
    // Throat grooves: fine pleats under the head.
    relief: (u, a) =>
      u > 0.62 && u < 0.97 && Math.sin(a) < -0.35
        ? -0.004 * Math.max(0, Math.cos(a * 46))
        : 0,
    colour: (u, a) => {
      const s = Math.sin(a);
      // Dark above, pale below, with paler chevrons over the shoulders.
      const line = -0.12 + 0.18 * Math.sin(u * 9),
        chevron =
          u > 0.62 &&
          u < 0.7 &&
          s > 0 &&
          s < 0.55 &&
          Math.abs(Math.cos(a)) > 0.5;
      if (s < line) {
        const groove =
          u > 0.62 && u < 0.97 && s < -0.35 && Math.cos(a * 46) > 0.6;
        return groove ? [0.62, 0.63, 0.65] : belly;
      }
      return chevron ? [0.45, 0.47, 0.5] : back;
    },
  });
  const tailX = x(0),
    stroke = verticalStroke(x(0.5), tailX, 0.24);
  const parts: Part[] = [
    { geometry: skin, stroke },
    {
      // A small, curved (falcate) dorsal fin two-thirds of the way back.
      geometry: fin({
        root: new THREE.Vector3(x(0.34), centre(0.34) + top(0.34) - 0.02, 0),
        span: new THREE.Vector3(-0.5, 1, 0),
        chord: new THREE.Vector3(-1, 0, 0),
        length: 0.2,
        chordAt: (s) => 0.2 * (1 - s) + 0.02,
        thickAt: (s) => 0.035 * (1 - s) + 0.006,
        sweepAt: (s) => 0.1 * s * s,
        colour: () => back,
      }),
      stroke,
    },
  ];
  for (const side of [-1, 1]) {
    const root = new THREE.Vector3(x(0.73), centre(0.73) - 0.15, side * 0.19);
    parts.push({
      // Slim pointed flippers with the minke's white band.
      geometry: fin({
        root,
        span: new THREE.Vector3(-0.35, -0.55, side * 0.76),
        chord: new THREE.Vector3(-1, 0, 0),
        length: 0.4,
        chordAt: (s) => 0.11 * (1 - 0.75 * s) + 0.01,
        thickAt: (s) => 0.03 * (1 - 0.7 * s),
        colour: (s) => (s > 0.28 && s < 0.6 ? [0.9, 0.9, 0.9] : back),
      }),
      stroke: swing(root, new THREE.Vector3(1, 0, 0), 0.05),
    });
    parts.push({
      geometry: fin({
        root: new THREE.Vector3(tailX + 0.05, centre(0), side * 0.01),
        span: new THREE.Vector3(-0.45, 0, side * 0.9),
        chord: new THREE.Vector3(-1, 0, 0),
        length: 0.46,
        chordAt: (s) => 0.24 * (1 - s) + 0.05,
        thickAt: (s) => 0.035 * (1 - s) + 0.007,
        sweepAt: (s) => 0.04 * s,
        colour: (_s, upper) => (upper ? back : [0.7, 0.71, 0.73]),
      }),
      stroke,
    });
    parts.push({
      geometry: blob(
        new THREE.Vector3(
          x(0.885),
          centre(0.885) + 0.01,
          side * (width(0.885) - 0.004),
        ),
        new THREE.Vector3(0.012, 0.01, 0.008),
        [0.02, 0.02, 0.02],
      ),
      stroke: still,
    });
  }
  return animal('Minke_Root', assemble(parts), 'skin', 0.35);
}

// ------------------------------------------------------------------ seals

interface SealSpec {
  readonly root: string;
  readonly length: number;
  readonly width: (u: number) => number;
  readonly top: (u: number) => number;
  readonly bottom: (u: number) => number;
  readonly centre: (u: number) => number;
  readonly colour: (u: number, a: number) => RGB;
  readonly flipper: RGB;
  /** Fore flippers: where (u), how long; the gape's reach back (u), whiskers or not. */
  readonly fore: {
    readonly u: number;
    readonly length: number;
    readonly chord: number;
  };
  readonly hind: number;
  readonly gape: number;
  readonly whiskers: boolean;
  readonly eye: { readonly u: number; readonly size: number };
}
function seal(s: SealSpec): THREE.Group {
  const L = s.length,
    x = (u: number) => -L / 2 + u * L,
    tailX = x(0),
    stroke = lateralStroke(x(0.55), tailX, 0.18 * L);
  const skin = body({
    length: L,
    rings: 70,
    around: 36,
    width: s.width,
    top: s.top,
    bottom: s.bottom,
    centre: s.centre,
    colour: (u, a) => {
      // The mouth: a dark line along the side of the muzzle, back to the gape.
      const sn = Math.sin(a);
      if (
        u > s.gape &&
        Math.abs(sn + 0.2 - (0.25 * (u - s.gape)) / (1 - s.gape)) < 0.05 &&
        Math.abs(Math.cos(a)) > 0.3
      )
        return [0.06, 0.05, 0.05];
      return s.colour(u, a);
    },
  });
  const parts: Part[] = [{ geometry: skin, stroke }];
  for (const side of [-1, 1]) {
    const fu = s.fore.u,
      root = new THREE.Vector3(
        x(fu),
        s.centre(fu) - s.bottom(fu) * 0.55,
        side * s.width(fu) * 0.85,
      );
    parts.push({
      geometry: fin({
        root,
        span: new THREE.Vector3(-0.55, -0.45, side * 0.7),
        chord: new THREE.Vector3(-0.8, 0.2, 0),
        length: s.fore.length,
        chordAt: (t) => s.fore.chord * (1 - 0.55 * t) + 0.01,
        thickAt: (t) => s.fore.chord * 0.35 * (1 - 0.6 * t),
        curlAt: (t) => -0.02 * t,
        colour: () => s.flipper,
      }),
      stroke: swing(root, new THREE.Vector3(0, 0, 1), 0.12),
    });
    // The hind flippers: a pair of fans trailing behind, their digits ridged.
    parts.push({
      geometry: fin({
        root: new THREE.Vector3(tailX + 0.04, s.centre(0), side * 0.012),
        span: new THREE.Vector3(-1, 0, side * 0.28),
        chord: new THREE.Vector3(0, 1, 0),
        length: s.hind,
        chordAt: (t) => s.hind * (0.28 + 0.5 * Math.sin(t * Math.PI * 0.85)),
        thickAt: (t) => 0.025 * (1 - 0.5 * t),
        sweepAt: (t) => -s.hind * 0.25 * t,
        colour: (t, _u, p) =>
          t > 0.4 && Math.abs(Math.sin(p.y * 90)) > 0.85
            ? [s.flipper[0] * 0.6, s.flipper[1] * 0.6, s.flipper[2] * 0.6]
            : s.flipper,
      }),
      stroke,
    });
    const eu = s.eye.u;
    parts.push({
      geometry: blob(
        new THREE.Vector3(
          x(eu),
          s.centre(eu) + s.top(eu) * 0.35,
          side * s.width(eu) * 0.82,
        ),
        new THREE.Vector3(s.eye.size, s.eye.size * 0.9, s.eye.size * 0.7),
        [0.02, 0.02, 0.025],
      ),
      stroke: still,
    });
    if (s.whiskers)
      for (let k = 0; k < 5; k++) {
        const wu = 0.975 - k * 0.006,
          start = new THREE.Vector3(
            x(wu),
            s.centre(wu) - 0.005 - k * 0.004,
            side * s.width(wu) * 0.95,
          ),
          end = start
            .clone()
            .add(new THREE.Vector3(-0.03, -0.01 + k * 0.006, side * 0.07));
        parts.push({
          geometry: limb(
            [start, end],
            [0.0016, 0.0008],
            () => [0.85, 0.82, 0.74],
            4,
          ),
          stroke: still,
        });
      }
  }
  // The nose's two nostrils, dark, at the tip.
  for (const side of [-1, 1])
    parts.push({
      geometry: blob(
        new THREE.Vector3(x(0.995), s.centre(0.995) + 0.004, side * 0.008),
        new THREE.Vector3(0.006, 0.004, 0.004),
        [0.03, 0.03, 0.03],
        8,
      ),
      stroke: still,
    });
  return animal(s.root, assemble(parts), 'skin', 0.45);
}

export function leopardSeal(): THREE.Group {
  const back: RGB = [0.28, 0.3, 0.33],
    silver: RGB = [0.68, 0.7, 0.72];
  return seal({
    root: 'LeopardSeal_Root',
    length: 3.09,
    width: profile([
      [0, 0.02],
      [0.05, 0.07],
      [0.15, 0.13],
      [0.3, 0.2],
      [0.5, 0.24],
      [0.68, 0.22],
      [0.8, 0.16],
      [0.86, 0.14],
      [0.92, 0.15],
      [0.97, 0.08],
      [1, 0.006],
    ]),
    top: profile([
      [0, 0.02],
      [0.05, 0.06],
      [0.15, 0.12],
      [0.3, 0.2],
      [0.5, 0.25],
      [0.68, 0.23],
      [0.8, 0.16],
      [0.86, 0.13],
      [0.92, 0.12],
      [0.97, 0.06],
      [1, 0.006],
    ]),
    bottom: profile([
      [0, 0.02],
      [0.05, 0.06],
      [0.15, 0.12],
      [0.3, 0.2],
      [0.5, 0.25],
      [0.68, 0.23],
      [0.8, 0.17],
      [0.86, 0.14],
      [0.92, 0.12],
      [0.97, 0.06],
      [1, 0.006],
    ]),
    centre: profile([
      [0, 0.02],
      [0.4, 0],
      [0.85, 0.02],
      [1, 0.0],
    ]),
    colour: (u, a) => {
      const s = Math.sin(a),
        under = s < -0.1 + 0.15 * Math.sin(u * 7),
        spot = spots(u, a, 46, 26, 0.32, under ? 0.55 : 0.3);
      if (under) return spot ? [0.3, 0.31, 0.34] : silver;
      return spot ? [0.18, 0.19, 0.21] : back;
    },
    flipper: [0.25, 0.27, 0.3],
    fore: { u: 0.74, length: 0.5, chord: 0.17 },
    hind: 0.38,
    gape: 0.915,
    whiskers: true,
    eye: { u: 0.955, size: 0.022 },
  });
}

export function harbourSeal(): THREE.Group {
  const base: RGB = [0.5, 0.49, 0.46];
  return seal({
    root: 'Seal_Root',
    length: 1.67,
    width: profile([
      [0, 0.02],
      [0.06, 0.07],
      [0.18, 0.15],
      [0.4, 0.23],
      [0.6, 0.23],
      [0.76, 0.17],
      [0.84, 0.13],
      [0.9, 0.13],
      [0.96, 0.075],
      [1, 0.005],
    ]),
    top: profile([
      [0, 0.02],
      [0.06, 0.07],
      [0.18, 0.15],
      [0.4, 0.24],
      [0.6, 0.24],
      [0.76, 0.17],
      [0.84, 0.13],
      [0.9, 0.13],
      [0.96, 0.07],
      [1, 0.005],
    ]),
    bottom: profile([
      [0, 0.02],
      [0.06, 0.06],
      [0.18, 0.14],
      [0.4, 0.23],
      [0.6, 0.24],
      [0.76, 0.18],
      [0.84, 0.13],
      [0.9, 0.11],
      [0.96, 0.06],
      [1, 0.005],
    ]),
    centre: profile([
      [0, 0.02],
      [0.5, 0],
      [0.88, 0.03],
      [1, 0.015],
    ]),
    colour: (u, a) => {
      const s = Math.sin(a),
        k = 0.8 + 0.3 * (s + 1) * -0.25 + 0.25,
        spot = spots(u, a, 40, 30, 0.3, 0.55),
        ring = spots(u + 0.013, a + 0.05, 40, 30, 0.42, 0.55) && !spot;
      const tone: RGB =
        s > 0
          ? [base[0] * 0.75, base[1] * 0.75, base[2] * 0.76]
          : [base[0] * 1.25, base[1] * 1.25, base[2] * 1.22];
      if (spot) return [tone[0] * 0.45, tone[1] * 0.45, tone[2] * 0.45];
      if (ring) return [tone[0] * 1.12, tone[1] * 1.12, tone[2] * 1.1];
      return [tone[0] * k, tone[1] * k, tone[2] * k];
    },
    flipper: [0.3, 0.29, 0.28],
    fore: { u: 0.7, length: 0.22, chord: 0.09 },
    hind: 0.24,
    gape: 0.955,
    whiskers: true,
    eye: { u: 0.925, size: 0.022 },
  });
}

// ------------------------------------------------------------------ penguins

interface PenguinSpec {
  readonly root: string;
  readonly length: number;
  readonly girth: number;
  readonly flipper: number;
  readonly emperor: boolean;
}
function penguin(s: PenguinSpec): THREE.Group {
  const L = s.length,
    g = s.girth,
    bill = s.emperor ? 0.09 : 0.05,
    head = 1 - bill,
    width = profile([
      [0, g * 0.06],
      [0.03, g * 0.28],
      [0.08, g * 0.48],
      [0.2, g * 0.8],
      [0.42, g],
      [0.62, g * 0.9],
      [0.76, g * 0.58],
      [head - 0.06, g * 0.52],
      [head - 0.01, g * 0.34],
      [head + bill * 0.25, g * 0.11],
      [1, 0.003],
    ]),
    top = profile([
      [0, g * 0.06],
      [0.03, g * 0.26],
      [0.08, g * 0.46],
      [0.2, g * 0.82],
      [0.42, g * 1.02],
      [0.62, g * 0.92],
      [0.76, g * 0.6],
      [head - 0.06, g * 0.56],
      [head - 0.01, g * 0.4],
      [head + bill * 0.25, g * 0.12],
      [1, 0.003],
    ]),
    bottom = profile([
      [0, g * 0.06],
      [0.03, g * 0.25],
      [0.08, g * 0.45],
      [0.2, g * 0.85],
      [0.42, g * 1.1],
      [0.62, g],
      [0.76, g * 0.62],
      [head - 0.06, g * 0.5],
      [head - 0.01, g * 0.32],
      [head + bill * 0.25, g * 0.1],
      [1, 0.003],
    ]),
    centre = profile([
      [0, 0.01],
      [0.42, -0.01],
      [0.78, 0.02],
      [head, 0.03],
      [1, 0.015],
    ]),
    black: RGB = [0.04, 0.045, 0.06],
    white: RGB = [0.94, 0.94, 0.92],
    x = (u: number) => -L / 2 + u * L;
  const skin = body({
    length: L,
    rings: 70,
    around: 36,
    width,
    top,
    bottom,
    centre,
    colour: (u, a) => {
      const sn = Math.sin(a),
        side = Math.abs(Math.cos(a));
      if (u > head) {
        // The bill: black, the emperor's lower mandible orange-pink.
        if (s.emperor && sn < -0.15 && u < 0.985) return [0.95, 0.5, 0.36];
        // The Adélie's: short, black, brick-red at its base.
        if (!s.emperor && u < head + bill * 0.45) return [0.45, 0.12, 0.08];
        return black;
      }
      if (u > 0.76) {
        // The head: black; the emperor's golden ear patches, the Adélie's white eye ring.
        if (s.emperor) {
          const eu = (u - (head - 0.07)) / 0.035,
            ea = (sn + 0.12) / 0.3;
          if (side > 0.4 && eu * eu + ea * ea < 1) return [1.0, 0.72, 0.18];
          if (sn < -0.55 && u < head - 0.04) return [0.98, 0.88, 0.6];
        } else {
          const eu = (u - (head - 0.035)) / 0.026,
            ea = (sn - 0.2) / 0.24,
            d = eu * eu + ea * ea;
          if (side > 0.45 && d < 1 && d > 0.3) return white;
        }
        return black;
      }
      // Black back, white front; the emperor's pale gold blushing the upper breast.
      const line = -0.02 + 0.05 * Math.sin(u * 12);
      if (sn > line) return black;
      if (s.emperor && u > 0.66) return [0.98, 0.92, 0.72];
      return white;
    },
  });
  const parts: Part[] = [{ geometry: skin, stroke: still }];
  for (const side of [-1, 1]) {
    const fu = 0.64,
      root = new THREE.Vector3(
        x(fu),
        centre(fu) + 0.01 * L,
        side * width(fu) * 0.92,
      );
    parts.push({
      // The flippers: stiff, flat, tapering blades, black above and white below.
      geometry: fin({
        root,
        span: new THREE.Vector3(-0.35, -0.12, side * 0.93),
        chord: new THREE.Vector3(-1, 0, 0),
        length: s.flipper,
        chordAt: (t) => s.flipper * 0.34 * (1 - 0.7 * t) + 0.008,
        thickAt: (t) => s.flipper * 0.05 * (1 - 0.5 * t),
        sweepAt: (t) => s.flipper * 0.18 * t,
        colour: (_t, upper) => (upper ? black : white),
      }),
      stroke: swing(root, new THREE.Vector3(1, 0, 0), side * 0.7),
    });
    // The feet tucked back under the tail, and the eye.
    parts.push({
      geometry: blob(
        new THREE.Vector3(x(0.07), centre(0.07) - 0.03 * L, side * 0.03 * L),
        new THREE.Vector3(0.07 * L, 0.012 * L, 0.035 * L),
        s.emperor ? [0.08, 0.08, 0.09] : [0.85, 0.55, 0.55],
        10,
      ),
      stroke: still,
    });
    const eu = head - (s.emperor ? 0.045 : 0.035);
    parts.push({
      geometry: blob(
        new THREE.Vector3(
          x(eu),
          centre(eu) + top(eu) * 0.3,
          side * width(eu) * 0.9,
        ),
        new THREE.Vector3(0.011 * L, 0.01 * L, 0.007 * L),
        [0.02, 0.02, 0.02],
        10,
      ),
      stroke: still,
    });
  }
  return animal(s.root, assemble(parts), 'feather', 0.6);
}
export const emperorPenguin = (): THREE.Group =>
  penguin({
    root: 'EmperorPenguin_Root',
    length: 1.32,
    girth: 0.205,
    flipper: 0.36,
    emperor: true,
  });
export const adeliePenguin = (): THREE.Group =>
  penguin({
    root: 'AdeliePenguin_Root',
    length: 0.8,
    girth: 0.135,
    flipper: 0.22,
    emperor: false,
  });

// ------------------------------------------------------------------ polar bear

export function polarBear(): THREE.Group {
  const L = 2.6,
    width = profile([
      [0, 0.03],
      [0.04, 0.2],
      [0.14, 0.31],
      [0.32, 0.33],
      [0.5, 0.31],
      [0.6, 0.26],
      [0.68, 0.17],
      [0.76, 0.15],
      [0.83, 0.15],
      [0.9, 0.14],
      [0.95, 0.09],
      [0.985, 0.06],
      [1, 0.005],
    ]),
    top = profile([
      [0, 0.04],
      [0.04, 0.22],
      [0.14, 0.34],
      [0.32, 0.36],
      [0.5, 0.36],
      [0.6, 0.3],
      [0.68, 0.18],
      [0.76, 0.16],
      [0.83, 0.17],
      [0.9, 0.15],
      [0.95, 0.09],
      [0.985, 0.06],
      [1, 0.005],
    ]),
    bottom = profile([
      [0, 0.04],
      [0.04, 0.2],
      [0.14, 0.31],
      [0.32, 0.33],
      [0.5, 0.32],
      [0.6, 0.26],
      [0.68, 0.17],
      [0.76, 0.15],
      [0.83, 0.13],
      [0.9, 0.12],
      [0.95, 0.07],
      [0.985, 0.05],
      [1, 0.005],
    ]),
    // A swimming bear holds its long neck forward and its head up out of the line of the back.
    centre = profile([
      [0, 0.02],
      [0.4, 0],
      [0.62, 0.05],
      [0.74, 0.13],
      [0.85, 0.19],
      [0.95, 0.2],
      [1, 0.18],
    ]),
    cream: RGB = [0.93, 0.9, 0.82],
    x = (u: number) => -L / 2 + u * L;
  const skin = body({
    length: L,
    rings: 80,
    around: 40,
    width,
    top,
    bottom,
    centre,
    // (The fur's detail is in its texture: geometric ridges read as knitting.)
    texels: 7,
    colour: (u, a) => {
      const s = Math.sin(a),
        // A little yellower underneath and on the legs' insides; the muzzle a touch greyer.
        k = 0.96 + 0.04 * Math.sin(u * 60 + a * 7);
      if (u > 0.985) return [0.04, 0.04, 0.04];
      const tone: RGB =
        s < -0.3 ? [0.9, 0.84, 0.7] : u > 0.95 ? [0.86, 0.83, 0.78] : cream;
      return [tone[0] * k, tone[1] * k, tone[2] * k];
    },
  });
  const parts: Part[] = [{ geometry: skin, stroke: still }];
  const fur = (t: number): RGB => [
    0.92 - 0.04 * t,
    0.88 - 0.05 * t,
    0.78 - 0.06 * t,
  ];
  for (const side of [-1, 1]) {
    // Forelegs: long and thick, reaching down and forward to paddle with huge paws.
    const shoulder = new THREE.Vector3(
        x(0.56),
        centre(0.56) - 0.12,
        side * 0.21,
      ),
      fore = [
        shoulder,
        shoulder.clone().add(new THREE.Vector3(0.1, -0.22, side * 0.04)),
        shoulder.clone().add(new THREE.Vector3(0.16, -0.42, side * 0.06)),
        shoulder.clone().add(new THREE.Vector3(0.2, -0.56, side * 0.06)),
      ],
      foreStroke = swing(shoulder, new THREE.Vector3(0, 0, 1), -0.55);
    parts.push({
      geometry: limb(fore, [0.15, 0.12, 0.095, 0.085], fur),
      stroke: foreStroke,
    });
    const paw = fore[3];
    parts.push({
      geometry: blob(
        paw.clone().add(new THREE.Vector3(0.05, -0.03, 0)),
        new THREE.Vector3(0.15, 0.075, 0.12),
        [0.88, 0.84, 0.74],
        14,
      ),
      stroke: foreStroke,
    });
    // Black pads and claws under the paw.
    parts.push({
      geometry: blob(
        paw.clone().add(new THREE.Vector3(0.07, -0.09, 0)),
        new THREE.Vector3(0.1, 0.02, 0.08),
        [0.06, 0.05, 0.05],
        10,
      ),
      stroke: foreStroke,
    });
    // Hind legs trailing back, their broad feet out behind like rudders.
    const hip = new THREE.Vector3(x(0.14), centre(0.14) - 0.12, side * 0.2),
      hind = [
        hip,
        hip.clone().add(new THREE.Vector3(-0.16, -0.2, side * 0.04)),
        hip.clone().add(new THREE.Vector3(-0.32, -0.26, side * 0.05)),
        hip.clone().add(new THREE.Vector3(-0.44, -0.27, side * 0.05)),
      ],
      hindStroke = swing(hip, new THREE.Vector3(0, 0, 1), 0.18);
    parts.push({
      geometry: limb(hind, [0.17, 0.13, 0.09, 0.08], fur),
      stroke: hindStroke,
    });
    parts.push({
      geometry: blob(
        hind[3].clone().add(new THREE.Vector3(-0.07, 0, 0)),
        new THREE.Vector3(0.15, 0.07, 0.11),
        [0.88, 0.84, 0.74],
        14,
      ),
      stroke: hindStroke,
    });
    // Small round ears set back on the head, and dark eyes.
    parts.push({
      geometry: blob(
        new THREE.Vector3(
          x(0.875),
          centre(0.875) + top(0.875) * 0.9,
          side * 0.085,
        ),
        new THREE.Vector3(0.03, 0.035, 0.022),
        [0.88, 0.85, 0.77],
        10,
      ),
      stroke: still,
    });
    parts.push({
      geometry: blob(
        new THREE.Vector3(
          x(0.935),
          centre(0.935) + top(0.935) * 0.45,
          side * width(0.935) * 0.78,
        ),
        new THREE.Vector3(0.012, 0.011, 0.008),
        [0.02, 0.02, 0.02],
        10,
      ),
      stroke: still,
    });
  }
  // The black nose.
  parts.push({
    geometry: blob(
      new THREE.Vector3(x(0.995), centre(0.995) + 0.02, 0),
      new THREE.Vector3(0.03, 0.025, 0.04),
      [0.03, 0.03, 0.03],
      12,
    ),
    stroke: still,
  });
  // A stub of a tail.
  parts.push({
    geometry: blob(
      new THREE.Vector3(x(0.005), centre(0.01) + 0.06, 0),
      new THREE.Vector3(0.05, 0.04, 0.045),
      cream,
      10,
    ),
    stroke: still,
  });
  return animal('PolarBear_Root', assemble(parts), 'fur', 0.95);
}

/** Every animal built here, by the asset it stands in for. */
export const ICE_ANIMALS = {
  killerWhale,
  minkeWhale,
  leopardSeal,
  harbourSeal,
  emperorPenguin,
  adeliePenguin,
  polarBear,
} as const;
