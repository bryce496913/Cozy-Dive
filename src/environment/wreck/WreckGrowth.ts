import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import {
  encrustingSponge,
  foliosePlate,
  vaseSponge,
} from '../shared/GrowthForms';

/**
 * Playtest (higher-quality coral on the wreck): the growth that covers it, as on the SS Yongala,
 * built from smooth, tapered, continuous tubes (not joined rods) with smooth shading, each kind
 * shaped after the real thing:
 *   - **sea fans** (gorgonians): a fine, dense lattice of twigs in one plane over a translucent web;
 *   - **soft corals** (Dendronephthya): a pale trunk branching into twigs, each tipped with a bunch
 *     of coloured polyps;
 *   - **black coral**: feathery bottle-brush trees, and spiralling **wire coral**;
 *   - **barrel sponges**, ridged with dark open tops, and smooth **encrusting sponges**;
 *   - **plate corals** standing out from the hull in shelves, and **feather stars**;
 *   - **hydroids**, fine and pale.
 * Every geometry is unit-scale on y 0 (it grows up +y), coloured white-to-pale so each instance's
 * colour shows through, and shared by an instanced mesh. Pure (no GPU resources).
 */
type RGB = readonly [number, number, number];

function random(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}
/** Positions, smooth normals and a grey colour from `shade(t, position)`, non-indexed, to merge. */
function finish(
  g: THREE.BufferGeometry,
  shade: (p: THREE.Vector3) => number,
): THREE.BufferGeometry {
  g.computeVertexNormals();
  const out = g.index ? g.toNonIndexed() : g;
  if (out !== g) g.dispose();
  for (const name of Object.keys(out.attributes))
    if (name !== 'position' && name !== 'normal') out.deleteAttribute(name);
  const p = out.getAttribute('position'),
    c = new Float32Array(p.count * 3),
    v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    const k = Math.max(0, Math.min(1, shade(v.fromBufferAttribute(p, i))));
    c[i * 3] = c[i * 3 + 1] = c[i * 3 + 2] = k;
  }
  out.setAttribute('color', new THREE.Float32BufferAttribute(c, 3));
  return out;
}
function merge(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const m = mergeGeometries(parts, false);
  parts.forEach((g) => g.dispose());
  if (!m) throw Error('Wreck growth could not be built');
  return m;
}

/**
 * A smooth tube along `path`, tapering from `r0` to `r1`, with `sides` round it: one continuous
 * surface (frames carried along the path, so it never twists or seams), shaded by `shade(t)`.
 */
export function taperedTube(
  path: readonly THREE.Vector3[],
  r0: number,
  r1: number,
  sides: number,
  shade: (t: number) => number = () => 1,
): THREE.BufferGeometry {
  const n = path.length,
    positions: number[] = [],
    shades: number[] = [],
    index: number[] = [],
    tangent = new THREE.Vector3(),
    normal = new THREE.Vector3(),
    binormal = new THREE.Vector3(),
    prev = new THREE.Vector3();
  for (let i = 0; i < n; i++) {
    const a = path[Math.max(0, i - 1)],
      b = path[Math.min(n - 1, i + 1)];
    tangent.subVectors(b, a).normalize();
    if (i === 0) {
      // Any normal to start, then carried along (parallel transport).
      normal.set(0, 0, 1);
      if (Math.abs(tangent.dot(normal)) > 0.9) normal.set(1, 0, 0);
    } else normal.copy(prev);
    normal.addScaledVector(tangent, -normal.dot(tangent)).normalize();
    binormal.crossVectors(tangent, normal);
    prev.copy(normal);
    const t = i / (n - 1),
      r = r0 + (r1 - r0) * t;
    for (let k = 0; k < sides; k++) {
      const a2 = (k / sides) * Math.PI * 2,
        cx = Math.cos(a2) * r,
        cy = Math.sin(a2) * r;
      positions.push(
        path[i].x + normal.x * cx + binormal.x * cy,
        path[i].y + normal.y * cx + binormal.y * cy,
        path[i].z + normal.z * cx + binormal.z * cy,
      );
      shades.push(shade(t));
    }
  }
  for (let i = 0; i + 1 < n; i++)
    for (let k = 0; k < sides; k++) {
      const a = i * sides + k,
        b = i * sides + ((k + 1) % sides),
        c = (i + 1) * sides + k,
        d = (i + 1) * sides + ((k + 1) % sides);
      index.push(a, c, b, b, c, d);
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.setIndex(index);
  g.computeVertexNormals();
  const out = g.toNonIndexed();
  g.dispose();
  // Shade per vertex, carried through the de-indexing by position along the path.
  const p = out.getAttribute('position'),
    c = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) {
    // Nearest ring by projecting onto the path (cheap: the path is short).
    let best = 0,
      bestD = Infinity;
    for (let j = 0; j < n; j++) {
      const d =
        (p.getX(i) - path[j].x) ** 2 +
        (p.getY(i) - path[j].y) ** 2 +
        (p.getZ(i) - path[j].z) ** 2;
      if (d < bestD) {
        bestD = d;
        best = j;
      }
    }
    const k = Math.max(0, Math.min(1, shades[best * sides]));
    c[i * 3] = c[i * 3 + 1] = c[i * 3 + 2] = k;
  }
  out.setAttribute('color', new THREE.Float32BufferAttribute(c, 3));
  return out;
}
/** Points along a gently curving path from `from`, heading `dir`, `length` long. */
function curve(
  from: THREE.Vector3,
  dir: THREE.Vector3,
  length: number,
  bend: THREE.Vector3,
  steps = 4,
): THREE.Vector3[] {
  const out: THREE.Vector3[] = [],
    d = dir.clone().normalize(),
    p = from.clone();
  out.push(p.clone());
  for (let i = 1; i <= steps; i++) {
    d.addScaledVector(bend, 1 / steps).normalize();
    p.addScaledVector(d, length / steps);
    out.push(p.clone());
  }
  return out;
}

/**
 * A gorgonian sea fan: a fine lattice in one plane (x-y). Twigs branch out in a fan, and the
 * neighbouring ones are joined by cross-links (as a real fan's branches fuse into a net), so it is
 * see-through and lacy, not a solid sheet.
 */
export function seaFan(seed = 3): THREE.BufferGeometry {
  const rand = random(seed),
    parts: THREE.BufferGeometry[] = [],
    levels: { p: THREE.Vector3; a: number }[][] = [];
  const grow = (
    from: THREE.Vector3,
    angle: number,
    length: number,
    radius: number,
    depth: number,
    level: number,
  ) => {
    const dir = new THREE.Vector3(Math.sin(angle), Math.cos(angle), 0),
      bend = new THREE.Vector3((rand() - 0.5) * 0.3, 0, (rand() - 0.5) * 0.04),
      path = curve(from, dir, length, bend, level < 2 ? 3 : 1);
    parts.push(
      taperedTube(path, radius, radius * 0.75, level < 3 ? 4 : 3, () => 0.95),
    );
    const tip = path[path.length - 1];
    (levels[level] ??= []).push({ p: tip, a: angle });
    if (depth === 0) return;
    const spread = 0.26 + rand() * 0.16;
    grow(
      tip,
      angle - spread,
      length * 0.8,
      radius * 0.75,
      depth - 1,
      level + 1,
    );
    grow(
      tip,
      angle + spread,
      length * 0.78,
      radius * 0.75,
      depth - 1,
      level + 1,
    );
  };
  grow(new THREE.Vector3(), 0, 0.14, 0.02, 6, 0);
  // Cross-links between neighbours across the fan, in its outer levels: the net.
  for (let l = 3; l < levels.length; l++) {
    const row = [...levels[l]].sort((x, y) => x.a - y.a);
    for (let i = 0; i + 1 < row.length; i++) {
      const a = row[i].p,
        b = row[i + 1].p;
      if (a.distanceTo(b) > 0.14) continue;
      parts.push(taperedTube([a, b], 0.004, 0.004, 3, () => 0.85));
    }
  }
  return merge(parts);
}

/** A Dendronephthya soft coral: a pale trunk, branching, its twigs tipped with polyp bunches. */
export function softCoral(seed = 5): THREE.BufferGeometry {
  const rand = random(seed),
    parts: THREE.BufferGeometry[] = [],
    up = new THREE.Vector3(0, 1, 0);
  const trunk = curve(
    new THREE.Vector3(),
    up,
    0.32,
    new THREE.Vector3(0.08, 0, 0.04),
    4,
  );
  // Pale, translucent-looking trunk; the colour gathers in the polyps.
  parts.push(taperedTube(trunk, 0.075, 0.045, 7, (t) => 0.72 + 0.08 * t));
  // V0.7 Pass 069: polyp clusters are short, fleshy catkins continuing each twig (they were loose
  // low-poly spheres floating at the tips).
  const bunch = (at: THREE.Vector3) => {
    for (let i = 0; i < 3; i++) {
      const a = rand() * Math.PI * 2,
        lobe = curve(
          at,
          new THREE.Vector3(Math.cos(a) * 0.5, 1, Math.sin(a) * 0.5),
          0.05 + rand() * 0.03,
          new THREE.Vector3(),
          3,
        );
      parts.push(taperedTube(lobe, 0.026 + rand() * 0.006, 0.014, 8, () => 1));
    }
  };
  for (let b = 0; b < 6; b++) {
    const a = (b / 6) * Math.PI * 2 + rand() * 0.5,
      from = trunk[2 + (b % 3)],
      dir = new THREE.Vector3(Math.cos(a) * 0.8, 0.9, Math.sin(a) * 0.8),
      branch = curve(
        from,
        dir,
        0.18 + rand() * 0.08,
        new THREE.Vector3(0, 0.3, 0),
        3,
      );
    parts.push(taperedTube(branch, 0.035, 0.022, 5, () => 0.8));
    const end = branch[branch.length - 1];
    for (let k = 0; k < 2; k++) {
      const twig = curve(
        end,
        new THREE.Vector3(
          Math.cos(a + (k - 0.5)) * 0.6,
          1,
          Math.sin(a + (k - 0.5)) * 0.6,
        ),
        0.08 + rand() * 0.05,
        new THREE.Vector3(),
        2,
      );
      parts.push(taperedTube(twig, 0.02, 0.014, 4, () => 0.9));
      bunch(twig[twig.length - 1]);
    }
  }
  bunch(trunk[trunk.length - 1]);
  return merge(parts);
}

/** A black coral tree: a slender curving stem with feathery side branchlets all the way up. */
export function blackCoral(seed = 7): THREE.BufferGeometry {
  const rand = random(seed),
    parts: THREE.BufferGeometry[] = [];
  const stem = curve(
    new THREE.Vector3(),
    new THREE.Vector3(0, 1, 0),
    1,
    new THREE.Vector3(0.25, 0, 0.1),
    10,
  );
  parts.push(taperedTube(stem, 0.03, 0.008, 5, (t) => 0.6 + 0.3 * t));
  for (let i = 2; i < stem.length; i++) {
    const t = i / (stem.length - 1),
      count = 3;
    for (let k = 0; k < count; k++) {
      const a = i * 2.4 + (k / count) * Math.PI * 2,
        dir = new THREE.Vector3(Math.cos(a), 0.6, Math.sin(a)),
        length = (0.22 + rand() * 0.08) * (1 - 0.6 * t),
        branch = curve(stem[i], dir, length, new THREE.Vector3(0, -0.3, 0), 3);
      // Paler towards their tips, where the polyps are.
      parts.push(taperedTube(branch, 0.008, 0.003, 3, (s) => 0.65 + 0.35 * s));
    }
  }
  return merge(parts);
}
/** Wire coral: a single long, slender stem curling in a loose spiral. */
export function wireCoral(): THREE.BufferGeometry {
  const path: THREE.Vector3[] = [];
  for (let i = 0; i <= 28; i++) {
    const t = i / 28,
      a = t * Math.PI * 5;
    path.push(
      new THREE.Vector3(
        Math.cos(a) * 0.06 * t,
        t * 1.2,
        Math.sin(a) * 0.06 * t,
      ),
    );
  }
  return taperedTube(path, 0.016, 0.006, 5, (t) => 0.8 + 0.2 * t);
}

/**
 * A barrel sponge (Xestospongia): V0.8 Pass 092, a thick-walled, slightly leaning barrel widening
 * to its rim, deeply but irregularly ridged (broken, wandering ridges, knobbly lumps), its foot
 * spread over the plate, its uneven rolled lip opening into a dark atrium (was a lathe with even
 * cosine ridges).
 */
export function barrelSponge(): THREE.BufferGeometry {
  return vaseSponge({
    seed: 9201,
    height: 0.74,
    radius: (u) => 0.27 + 0.17 * Math.sin(u * Math.PI * 0.8) + 0.07 * u,
    wall: 0.1,
    floor: 0.4,
    ridges: 11,
    ridgeDepth: 0.16,
    ridgeBreak: 0.55,
    lumps: 0.05,
    rings: 0,
    lipWave: 0.07,
    lean: [0.06, -0.03],
    flare: 0.4,
  });
}
/**
 * An encrusting sponge: V0.8 Pass 092, a lobed crust thick at its middle and feathered into the
 * plate at its margin, its surface raised into volcano-like oscula with dark openings (was a
 * squashed, uniformly lumpy hemisphere).
 */
export function cushionSponge(): THREE.BufferGeometry {
  return encrustingSponge({
    seed: 9202,
    radius: 1,
    thickness: 0.46,
    lobes: 0.3,
    oscula: 5,
    osculumHeight: 0.55,
    relief: 0.3,
  });
}

/**
 * V0.8 Pass 086: an encrusting mat: a thin, irregular, lobed crust of coralline algae, sponge and
 * turf, a few centimetres proud, nodular on top and feathered at its rim. Colonies stand on these
 * so they grow out of the steel rather than sitting on bare plate.
 */
export function encrustingMat(): THREE.BufferGeometry {
  const rings = 6,
    sides = 28,
    pos: number[] = [],
    idx: number[] = [];
  pos.push(0, 0.05, 0);
  for (let i = 1; i <= rings; i++) {
    const d = i / rings;
    for (let j = 0; j < sides; j++) {
      const a = (j / sides) * Math.PI * 2,
        lobe = 1 + 0.16 * Math.sin(a * 3 + 0.7) + 0.08 * Math.sin(a * 7 + 2.1),
        r = 0.5 * d * lobe,
        x = Math.cos(a) * r,
        z = Math.sin(a) * r,
        nodules =
          0.012 * Math.max(0, Math.sin(x * 31 + 1.3) * Math.sin(z * 29)),
        y = 0.05 * (1 - d * d) + nodules * (1 - d) - 0.02 * d * d;
      pos.push(x, y, z);
    }
  }
  for (let j = 0; j < sides; j++) idx.push(0, 1 + ((j + 1) % sides), 1 + j);
  for (let i = 1; i < rings; i++)
    for (let j = 0; j < sides; j++) {
      const a = 1 + (i - 1) * sides + j,
        b = 1 + (i - 1) * sides + ((j + 1) % sides),
        c = a + sides,
        d = b + sides;
      idx.push(a, b, d, a, d, c);
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  // Darkening toward the rim, where it thins into the plate.
  return finish(g, (v) => 0.62 + 5 * Math.max(0, v.y));
}

/**
 * A plate coral: V0.8 Pass 092, a foliose colony: cupped laminae whorling up out of an encrusting
 * base, thick at their roots and thin at wavy, pale growing margins with growth rings (was two flat
 * discs, a mirrored underside and a cylinder foot).
 */
export function plateCoral(): THREE.BufferGeometry {
  return foliosePlate({
    seed: 9203,
    laminae: 7,
    reach: 0.5,
    rise: 0.08,
    thickness: 0.055,
    cup: 0.08,
    base: 0.16,
  });
}

/** A feather star: ten curling, feathery arms from a small central disc. */
export function featherStar(seed = 11): THREE.BufferGeometry {
  const rand = random(seed),
    parts: THREE.BufferGeometry[] = [];
  const disc = new THREE.SphereGeometry(0.04, 8, 5);
  disc.scale(1, 0.5, 1);
  disc.translate(0, 0.03, 0);
  parts.push(finish(disc, () => 0.6));
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2,
      path: THREE.Vector3[] = [];
    for (let k = 0; k <= 8; k++) {
      const t = k / 8,
        reach = 0.04 + t * 0.28,
        lift =
          0.03 +
          Math.sin(t * Math.PI * 0.9) * 0.12 -
          t * t * 0.05 +
          (rand() - 0.5) * 0.01;
      path.push(
        new THREE.Vector3(Math.cos(a) * reach, lift, Math.sin(a) * reach),
      );
    }
    parts.push(taperedTube(path, 0.009, 0.004, 3, (t) => 0.75 + 0.25 * t));
    // Pinnules: fine combs along each arm.
    for (let k = 2; k < 8; k++) {
      const p = path[k],
        side = new THREE.Vector3(-Math.sin(a), 0, Math.cos(a));
      for (const s of [-1, 1])
        parts.push(
          taperedTube(
            [
              p,
              p
                .clone()
                .addScaledVector(side, s * 0.035)
                .add(new THREE.Vector3(0, -0.01, 0)),
            ],
            0.003,
            0.002,
            3,
            () => 0.9,
          ),
        );
    }
  }
  return merge(parts);
}

/** A hydroid clump: fine, pale feathery plumes. */
export function hydroid(seed = 13): THREE.BufferGeometry {
  const rand = random(seed),
    parts: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 6; i++) {
    const a = i * 2.4,
      stem = curve(
        new THREE.Vector3(),
        new THREE.Vector3(Math.cos(a) * 0.35, 1, Math.sin(a) * 0.35),
        0.28 + rand() * 0.08,
        new THREE.Vector3((rand() - 0.5) * 0.2, 0, (rand() - 0.5) * 0.2),
        4,
      );
    parts.push(taperedTube(stem, 0.006, 0.003, 3, () => 0.9));
    for (let k = 1; k < stem.length; k++)
      for (const s of [-1, 1]) {
        const p = stem[k],
          side = new THREE.Vector3(
            Math.cos(a + s * 1.5),
            0.5,
            Math.sin(a + s * 1.5),
          );
        parts.push(
          taperedTube(
            [p, p.clone().addScaledVector(side, 0.045)],
            0.003,
            0.0015,
            3,
            () => 1,
          ),
        );
      }
  }
  return merge(parts);
}

/** How a kind of growth sits: upright, standing out across the current (fans), or as a shelf. */
export type GrowthMode = 'up' | 'fan' | 'shelf' | 'crust';
/**
 * V0.8 Pass 092: what a kind of growth is made of, so it answers the light as that material:
 * sponge (velvety, the roughest), coral tissue (living polyps and soft tissue, a softer sheen) and
 * mineral crust (coralline algae and calcareous turf, dead matte).
 */
export type GrowthSurface = 'sponge' | 'tissue' | 'crust';
export interface GrowthKind {
  readonly name: string;
  readonly surface: GrowthSurface;
  readonly build: () => THREE.BufferGeometry;
  readonly count: number;
  /** Share placed on the decks (the rest on the hull's sides). */
  readonly onDeck: number;
  readonly size: readonly [number, number];
  readonly palette: readonly RGB[];
  readonly mode: GrowthMode;
}
/** Everything growing on the wreck, as on the Yongala: hardly a bare plate left. */
export const WRECK_GROWTH: readonly GrowthKind[] = [
  {
    // V0.8 Pass 086: the mats the colonies grow from (laid first, under everything else).
    name: 'Wreck encrusting mats',
    surface: 'crust',
    build: encrustingMat,
    count: 170,
    onDeck: 0.35,
    size: [0.3, 0.75],
    // Close to the plating's own film and rust, a little warmer: mats read as part of the
    // steel's crust, not as cut-out shapes laid on it.
    palette: [
      [0.46, 0.34, 0.33],
      [0.48, 0.4, 0.28],
      [0.36, 0.38, 0.26],
      [0.42, 0.32, 0.36],
      [0.5, 0.44, 0.34],
    ],
    mode: 'crust',
  },
  {
    name: 'Wreck encrusting sponges',
    surface: 'sponge',
    build: cushionSponge,
    count: 220,
    onDeck: 0.5,
    size: [0.07, 0.3],
    palette: [
      [0.9, 0.5, 0.2],
      [0.92, 0.8, 0.35],
      [0.85, 0.3, 0.25],
      [0.55, 0.32, 0.55],
    ],
    mode: 'up',
  },
  {
    name: 'Wreck barrel sponges',
    surface: 'sponge',
    build: barrelSponge,
    count: 55,
    onDeck: 0.8,
    size: [0.35, 0.8],
    palette: [
      [0.62, 0.36, 0.26],
      [0.8, 0.5, 0.3],
      [0.55, 0.3, 0.45],
      [0.75, 0.6, 0.35],
    ],
    mode: 'up',
  },
  {
    name: 'Wreck soft corals',
    surface: 'tissue',
    build: softCoral,
    count: 150,
    onDeck: 0.5,
    size: [0.5, 1.1],
    palette: [
      [1.0, 0.45, 0.65],
      [0.95, 0.3, 0.35],
      [0.75, 0.4, 0.9],
      [1.0, 0.6, 0.3],
      [1.0, 0.85, 0.85],
      [0.95, 0.75, 0.3],
    ],
    mode: 'up',
  },
  {
    name: 'Wreck sea fans',
    surface: 'tissue',
    build: seaFan,
    count: 75,
    onDeck: 0.12,
    size: [1.1, 2.3],
    palette: [
      [0.85, 0.25, 0.2],
      [0.95, 0.55, 0.2],
      [0.95, 0.85, 0.35],
      [0.7, 0.3, 0.55],
    ],
    mode: 'fan',
  },
  {
    name: 'Wreck black coral',
    surface: 'tissue',
    build: blackCoral,
    count: 45,
    onDeck: 0.25,
    size: [0.9, 1.7],
    palette: [
      [0.4, 0.42, 0.25],
      [0.48, 0.38, 0.24],
      [0.35, 0.45, 0.34],
    ],
    mode: 'up',
  },
  {
    name: 'Wreck wire coral',
    surface: 'tissue',
    build: wireCoral,
    count: 50,
    onDeck: 0.2,
    size: [0.7, 1.4],
    palette: [
      [0.9, 0.35, 0.2],
      [0.95, 0.78, 0.3],
      [0.5, 0.6, 0.35],
    ],
    mode: 'up',
  },
  {
    name: 'Wreck plate corals',
    surface: 'tissue',
    build: plateCoral,
    count: 60,
    onDeck: 0.25,
    size: [0.6, 1.4],
    palette: [
      [0.62, 0.55, 0.38],
      [0.5, 0.58, 0.42],
      [0.6, 0.45, 0.5],
    ],
    mode: 'shelf',
  },
  {
    name: 'Wreck feather stars',
    surface: 'tissue',
    build: featherStar,
    count: 50,
    onDeck: 0.5,
    size: [0.8, 1.5],
    palette: [
      [0.95, 0.8, 0.25],
      [0.9, 0.9, 0.85],
      [0.85, 0.35, 0.2],
      [0.25, 0.22, 0.2],
    ],
    mode: 'up',
  },
  {
    name: 'Wreck hydroids',
    surface: 'tissue',
    build: hydroid,
    count: 120,
    onDeck: 0.45,
    size: [0.6, 1.4],
    palette: [
      [0.9, 0.88, 0.8],
      [0.75, 0.7, 0.55],
    ],
    mode: 'up',
  },
];
