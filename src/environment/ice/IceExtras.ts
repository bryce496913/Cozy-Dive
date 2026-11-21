import * as THREE from 'three';
import {
  GELATINOUS_PRESETS,
  gelatinousMaterial,
} from '../../rendering/Gelatinous';
import {
  organicTube,
  polarSheet,
  smoothed,
  toned,
} from '../shared/organicGeometry';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { ICE } from '../../config/passage';
import type { Vec3 } from '../../config/world';
import type { SightCandidate } from '../../discovery/journal';
import { ICE_SIGHTS } from '../../discovery/sights';
import type { PlayerPresence } from '../../fish/FishDiverReaction';
import { iceFloor } from './IceTerrain';
import { IceUnderside } from './IceUnderside';

/**
 * v0.6 Pass 052 (playtest: "there needs to be a lot more life, creatures and environment in here";
 * "everything needs more detail"; "there are no creatures"). Built in code, instanced, one draw per
 * kind, allocation-free per frame. Owns its GPU resources.
 *
 * Under the ice:
 *   - brinicles: hollow fingers of ice hanging from the sea ice, with branching spurs;
 *   - platelet ice: a glittering layer of loose ice plates under the sea ice.
 * On the seabed:
 *   - dropstones (dropped from melting icebergs) and white clumps of anchor ice;
 *   - beds of Antarctic scallops, some clapping their shells now and then;
 *   - red sea urchins, brittle stars, sea cucumbers and swaying sea pens;
 *   - giant isopods crawling slowly over the bottom.
 * In mid-water, where the swimmer is:
 *   - big Antarctic jellyfish, pulsing slowly, trailing frilled arms and long tentacles;
 *   - chains of salps drifting and undulating.
 */
export const ICE_EXTRAS = {
  seed: 52301,
  brinicles: 26,
  platelets: 900,
  dropstones: 70,
  anchorIce: 45,
  scallops: 280,
  clappers: 48,
  urchins: 150,
  brittleStars: 130,
  cucumbers: 45,
  seaPens: 45,
  isopods: 10,
  jellies: 7,
  salpChains: 8,
  salpLength: 12,
} as const;

type RGB = readonly [number, number, number];
function random(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}
/** Positions, normals and a colour (with a little speckle) only, non-indexed, so parts merge. */
function coloured(
  g: THREE.BufferGeometry,
  c: RGB,
  speck = 0.1,
): THREE.BufferGeometry {
  // V0.7 Pass 068: creased normals (smooth across gentle bends), kept through the merge.
  const out = smoothed(g);
  const n = out.getAttribute('position').count,
    col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const k = 1 - speck + speck * Math.abs(Math.sin(i * 12.9898));
    col[i * 3] = c[0] * k;
    col[i * 3 + 1] = c[1] * k;
    col[i * 3 + 2] = c[2] * k;
  }
  out.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  return out;
}
function merge(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const m = mergeGeometries(parts, false);
  parts.forEach((g) => g.dispose());
  if (!m) throw Error('Ice detail could not be built');
  return m;
}
/** A tapered limb from a to b. */
function limb(
  a: THREE.Vector3,
  b: THREE.Vector3,
  r0: number,
  r1: number,
  c: RGB,
  sides = 5,
) {
  const d = b.clone().sub(a),
    g = new THREE.CylinderGeometry(r1, r0, d.length(), Math.max(sides, 5), 1);
  g.translate(0, d.length() / 2, 0);
  g.applyQuaternion(
    new THREE.Quaternion().setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      d.normalize(),
    ),
  );
  g.translate(a.x, a.y, a.z);
  return coloured(g, c, 0.05);
}
const v3 = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

// ------------------------------------------------------------------ shapes (unit-ish, at the origin)

/** A brinicle: a long, slightly twisting finger of ice with spurs, hanging down from y 0. */
function brinicleGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [],
    ice: RGB = [0.78, 0.9, 1];
  // The main finger: tapering rings, a little lumpy.
  const g = new THREE.CylinderGeometry(0.16, 0.012, 1, 9, 14, true),
    p = g.getAttribute('position');
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i),
      a = Math.atan2(p.getZ(i), p.getX(i)),
      lump = 1 + 0.18 * Math.sin(a * 3 + y * 11) * Math.sin(y * 17);
    p.setXYZ(
      i,
      p.getX(i) * lump + 0.04 * Math.sin(y * 4),
      y - 0.5,
      p.getZ(i) * lump,
    );
  }
  parts.push(coloured(g, ice, 0.15));
  // Spurs branching off down its length.
  for (let k = 0; k < 6; k++) {
    const y = -0.15 - k * 0.13,
      a = k * 2.4,
      r = 0.12 * (1 + y);
    parts.push(
      limb(
        v3(Math.cos(a) * r * 0.5, y, Math.sin(a) * r * 0.5),
        v3(Math.cos(a) * (r + 0.12), y - 0.1, Math.sin(a) * (r + 0.12)),
        0.03,
        0.004,
        ice,
        4,
      ),
    );
  }
  return merge(parts);
}
/** A dropstone: a rounded, worn boulder (unit size), sitting on y 0. */
function dropstoneGeometry(): THREE.BufferGeometry {
  const g = new THREE.IcosahedronGeometry(0.5, 2),
    p = g.getAttribute('position');
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i),
      y = p.getY(i),
      z = p.getZ(i),
      k = 1 + 0.12 * Math.sin(x * 7 + z * 5) + 0.08 * Math.sin(y * 9);
    p.setXYZ(i, x * k, Math.max(-0.1, y * k * 0.75) + 0.3, z * k);
  }
  return coloured(g, [0.36, 0.36, 0.38], 0.25);
}
/** Anchor ice: a clump of white crystal blades on the bottom (unit size). */
function anchorIceGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [],
    rand = random(77);
  for (let k = 0; k < 14; k++) {
    const blade = new THREE.BoxGeometry(
      0.02,
      0.18 + rand() * 0.3,
      0.12 + rand() * 0.12,
    );
    blade.translate(0, 0.12, 0);
    blade.rotateZ((rand() - 0.5) * 1.6);
    blade.rotateY(rand() * Math.PI);
    blade.translate((rand() - 0.5) * 0.4, 0, (rand() - 0.5) * 0.4);
    parts.push(coloured(blade, [0.88, 0.95, 1], 0.1));
  }
  return merge(parts);
}
/** A scallop: a ribbed fan shell (about 8 cm), hinge at the origin, opening towards +z. */
/** An Antarctic scallop (about 10 cm across), hinge at -z, lying on y 0, slightly agape: two
 * ribbed, fan-shaped valves with ears at the hinge, and a row of tiny blue mantle eyes. */
export function scallopGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [],
    ribs = 18,
    // V0.7 Pass 068: each valve is a ringed polar sheet, so its dome, radial ribs and growth lines
    // actually show (the old single-ring disc was flat inside its rim).
    valve = (side: 1 | -1, tone: RGB, gape: number) =>
      toned(
        coloured(
          polarSheet(
            (r, a, out) => {
              const rib = 0.06 * Math.pow(Math.abs(Math.cos(a * ribs)), 3) * r,
                dome = Math.sqrt(Math.max(0, 1 - r * r * 0.85)) * 0.3,
                growth = 0.012 * Math.sin(r * 26) * r;
              out.set(
                Math.sin(a) * r * 0.05,
                side * (dome + rib + growth) * 0.05 +
                  0.012 +
                  (side > 0 ? gape * r : 0),
                Math.cos(a) * r * 0.05 - 0.022,
              );
            },
            -Math.PI * 0.42,
            Math.PI * 0.42,
            3,
            30,
          ),
          tone,
          0.2,
        ),
        // Concentric growth bands, paler toward the rim.
        (x, _y, z) => {
          const r = Math.hypot(x, z + 0.022) / 0.05;
          return 0.86 + 0.14 * r + 0.08 * Math.sin(r * 30);
        },
      );
  parts.push(valve(1, [0.82, 0.6, 0.52], 0.008));
  parts.push(valve(-1, [0.72, 0.6, 0.58], 0));
  // The ears either side of the hinge: small flattened, rounded wings.
  for (const side of [-1, 1]) {
    const ear = new THREE.SphereGeometry(1, 10, 6);
    ear.scale(0.011, 0.0028, 0.007);
    ear.translate(side * 0.011, 0.012, -0.022);
    parts.push(coloured(ear, [0.78, 0.6, 0.54], 0.15));
  }
  // Mantle eyes along the gape.
  for (let k = 0; k < 16; k++) {
    const a = -Math.PI * 0.38 + (k / 15) * Math.PI * 0.76,
      eye = new THREE.SphereGeometry(0.0013, 4, 3);
    eye.translate(Math.sin(a) * 0.047, 0.0135, Math.cos(a) * 0.047 - 0.022);
    parts.push(coloured(eye, [0.15, 0.35, 0.85], 0.05));
  }
  return merge(parts);
}
/** A sea urchin: a dark red test bristling with spines (about 7 cm across). */
export function urchinGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [],
    test = new THREE.SphereGeometry(0.035, 12, 8);
  test.scale(1, 0.7, 1);
  test.translate(0, 0.025, 0);
  parts.push(coloured(test, [0.5, 0.12, 0.14], 0.2));
  const dirs = new THREE.IcosahedronGeometry(1, 1),
    dp = dirs.getAttribute('position'),
    seen = new Set<string>();
  for (let i = 0; i < dp.count; i++) {
    const d = v3(dp.getX(i), dp.getY(i), dp.getZ(i)).normalize();
    const key = `${d.x.toFixed(2)},${d.y.toFixed(2)},${d.z.toFixed(2)}`;
    if (seen.has(key) || d.y < -0.4) continue;
    seen.add(key);
    const base = v3(d.x * 0.03, 0.025 + d.y * 0.022, d.z * 0.03);
    parts.push(
      limb(
        base,
        base.clone().addScaledVector(d, 0.045),
        0.003,
        0.0006,
        [0.62, 0.2, 0.25],
        3,
      ),
    );
  }
  dirs.dispose();
  return merge(parts);
}
/** A brittle star: a small disc and five long, wavy, banded arms (about 25 cm across).
 * V0.7 Pass 068: a soft pentagonal dome and five continuous, tapering, slightly flattened arms
 * (one surface each, banded by position) instead of chains of cylinders. */
export function brittleStarGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [],
    disc = new THREE.SphereGeometry(1, 25, 8, 0, Math.PI * 2, 0, Math.PI / 2),
    dp = disc.getAttribute('position');
  for (let i = 0; i < dp.count; i++) {
    const x = dp.getX(i),
      y = dp.getY(i),
      z = dp.getZ(i),
      lobe = 1 + 0.14 * Math.cos(5 * Math.atan2(z, x));
    dp.setXYZ(i, x * 0.026 * lobe, y * 0.012 + 0.003, z * 0.026 * lobe);
  }
  parts.push(
    toned(coloured(disc, [0.6, 0.45, 0.4], 0.12), (x, _y, z) =>
      Math.hypot(x, z) < 0.012 ? 0.8 : 1,
    ),
  );
  for (let a = 0; a < 5; a++) {
    const base = (a / 5) * Math.PI * 2,
      pts: THREE.Vector3[] = [];
    for (let k = 0; k <= 7; k++) {
      const u = k / 7,
        ang = base + 0.35 * Math.sin(u * 4 + a),
        r = 0.016 + u * 0.13;
      pts.push(
        v3(
          Math.cos(ang) * r,
          0.006 + 0.004 * Math.sin(u * 6) + 0.006 * u * u,
          Math.sin(ang) * r,
        ),
      );
    }
    const arm = organicTube(pts, (u) => 0.0058 * (1 - 0.82 * u), 14, 5, 0.7);
    parts.push(
      toned(coloured(arm, [0.62, 0.48, 0.42], 0.06), (x, _y, z) =>
        Math.sin(Math.hypot(x, z) * 140) > 0.35 ? 0.72 : 1,
      ),
    );
  }
  return merge(parts);
}
/** A sea cucumber: a plump, warty sausage (about 25 cm long) along x. */
/** A lathe body along x: `radius(u)` from tail (u 0) to head (u 1), flattened beneath (`sole`). */
function latheBody(
  length: number,
  radius: (u: number) => number,
  sole: number,
  rings = 18,
  sides = 14,
): THREE.BufferGeometry {
  const pos: number[] = [],
    idx: number[] = [];
  for (let i = 0; i <= rings; i++) {
    const u = i / rings,
      x = (u - 0.5) * length,
      r = radius(u);
    for (let j = 0; j <= sides; j++) {
      const a = (j / sides) * Math.PI * 2,
        y = Math.sin(a) * r,
        z = Math.cos(a) * r;
      pos.push(x, y < 0 ? y * sole : y, z);
    }
  }
  for (let i = 0; i < rings; i++)
    for (let j = 0; j < sides; j++) {
      const a = i * (sides + 1) + j,
        b = a + sides + 1;
      idx.push(a, b, a + 1, a + 1, b, b + 1);
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}
/** A sea cucumber (about 25 cm long) along x, its mouth at +x: a soft, tapering, warty body,
 * a flat sole of tube feet, rows of pointed papillae along the back, and a crown of branched
 * feeding tentacles. */
export function cucumberGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [],
    radius = (u: number) =>
      0.042 *
      Math.pow(Math.sin(Math.PI * (0.06 + 0.88 * u)), 0.55) *
      (1 + 0.06 * Math.sin(u * 23)),
    body = latheBody(0.24, radius, 0.45),
    p = body.getAttribute('position');
  // A slightly bent, lumpy body.
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i),
      y = p.getY(i),
      z = p.getZ(i),
      wart =
        1 + 0.07 * Math.max(0, Math.sin(x * 140) * Math.sin(z * 110 + y * 60));
    p.setXYZ(i, x, y * wart + 0.02 * Math.cos(x * 9), z * wart);
  }
  body.translate(0, 0.03, 0);
  parts.push(coloured(body, [0.78, 0.46, 0.34], 0.18));
  // Papillae: two rows of soft points along the back, and a row each side.
  for (let k = 0; k < 9; k++) {
    const u = 0.12 + (k / 8) * 0.76,
      x = (u - 0.5) * 0.24,
      r = radius(u);
    for (const a of [-0.45, 0.45, -1.35, 1.35]) {
      const base = v3(
          x,
          0.03 + Math.cos(a) * r * 0.95 + 0.02 * Math.cos(x * 9),
          Math.sin(a) * r,
        ),
        tip = base
          .clone()
          .add(v3(0, Math.cos(a), Math.sin(a)).multiplyScalar(0.016));
      parts.push(limb(base, tip, 0.0055, 0.001, [0.92, 0.6, 0.45], 5));
    }
  }
  // Tube feet: short pale nubs in three rows along the sole.
  for (let k = 0; k < 12; k++)
    for (const z of [-0.016, 0, 0.016]) {
      const x = -0.1 + k * 0.018,
        a = v3(x, 0.016, z);
      parts.push(
        limb(
          a,
          a.clone().add(v3(0, -0.013, 0)),
          0.0028,
          0.0018,
          [0.95, 0.8, 0.7],
          4,
        ),
      );
    }
  // Ten branched feeding tentacles round the mouth.
  for (let k = 0; k < 10; k++) {
    const a = (k / 10) * Math.PI * 2,
      root = v3(0.118, 0.035 + Math.sin(a) * 0.012, Math.cos(a) * 0.012),
      tip = v3(0.145, 0.045 + Math.sin(a) * 0.03, Math.cos(a) * 0.03);
    parts.push(limb(root, tip, 0.0035, 0.0018, [0.98, 0.88, 0.76], 4));
    for (const t of [-1, 1])
      parts.push(
        limb(
          tip,
          tip
            .clone()
            .add(v3(0.01, Math.sin(a + t) * 0.008, Math.cos(a + t) * 0.008)),
          0.0018,
          0.0006,
          [1, 0.92, 0.82],
          3,
        ),
      );
  }
  return merge(parts);
}
/** A sea pen: a stalk with a feathery plume of leaves (unit height), base at y 0.
 * V0.7 Pass 068: the leaves are curved, flattened, tapering blades sweeping up from the rachis,
 * each fringed with polyps, instead of flat boxes. */
export function seaPenGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  parts.push(
    coloured(
      organicTube(
        [v3(0, 0, 0), v3(0.01, 0.35, 0), v3(0, 0.7, 0.005), v3(0, 1, 0)],
        (u) => 0.03 - 0.018 * u,
        10,
        7,
      ),
      [0.9, 0.75, 0.55],
      0.08,
    ),
  );
  for (let k = 0; k < 14; k++) {
    const y = 0.35 + k * 0.045,
      len = 0.17 * (1 - k / 18);
    for (const side of [-1, 1]) {
      const yaw = k * 0.3,
        dir = v3(Math.cos(yaw) * side, 0, -Math.sin(yaw) * side),
        at = (t: number) =>
          v3(0, y + t * len * 0.45, 0).addScaledVector(dir, 0.012 + t * len),
        blade = organicTube(
          [at(0), at(0.5), at(1)],
          (u) => 0.016 * (1 - 0.7 * u),
          3,
          5,
          0.28,
        );
      parts.push(
        toned(coloured(blade, [0.98, 0.85, 0.6], 0.12), (_x, yy) =>
          yy > y + len * 0.3 ? 1.05 : 0.92,
        ),
      );
    }
  }
  return merge(parts);
}
/** A giant isopod: a segmented, armoured oval (about 18 cm long) along x, legs beneath. */
/** A giant isopod (about 18 cm long) along x, head at +x: a domed, armoured carapace of
 * overlapping plates (pereonites) with flared edges, a broad tail fan (pleotelson and uropods),
 * compound eyes, two pairs of antennae and seven pairs of jointed walking legs. */
export function isopodGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [],
    half = (u: number) =>
      0.042 * Math.pow(Math.sin(Math.PI * (0.04 + 0.92 * u)), 0.42),
    shell = new THREE.SphereGeometry(1, 40, 14, 0, Math.PI * 2, 0, Math.PI / 2),
    p = shell.getAttribute('position');
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i),
      y = p.getY(i),
      z = p.getZ(i),
      u = (x + 1) / 2,
      // Ridges where each plate overlaps the next, and edges that flare out and down.
      plate = 1 + 0.08 * Math.pow(Math.abs(Math.sin(u * Math.PI * 8)), 6),
      w = half(u) / 0.042;
    p.setXYZ(i, x * 0.09, y * 0.026 * plate * w + 0.004, z * 0.045 * w * plate);
  }
  parts.push(coloured(shell, [0.66, 0.6, 0.55], 0.14));
  // The tail fan: a rounded plate and two paddles either side.
  const tail = new THREE.CylinderGeometry(
    0.03,
    0.03,
    0.006,
    16,
    1,
    false,
    0,
    Math.PI,
  );
  tail.rotateY(Math.PI / 2);
  tail.translate(-0.09, 0.008, 0);
  parts.push(coloured(tail, [0.62, 0.55, 0.5], 0.12));
  for (const side of [-1, 1])
    parts.push(
      limb(
        v3(-0.085, 0.005, side * 0.02),
        v3(-0.12, 0.004, side * 0.034),
        0.006,
        0.004,
        [0.6, 0.52, 0.47],
        5,
      ),
    );
  // Compound eyes and antennae.
  for (const side of [-1, 1]) {
    const eye = new THREE.SphereGeometry(0.007, 8, 6);
    eye.scale(1, 0.7, 1);
    eye.translate(0.082, 0.014, side * 0.024);
    parts.push(coloured(eye, [0.08, 0.08, 0.1], 0.05));
    parts.push(
      limb(
        v3(0.09, 0.01, side * 0.012),
        v3(0.14, 0.022, side * 0.05),
        0.0026,
        0.0009,
        [0.55, 0.48, 0.44],
        4,
      ),
    );
    parts.push(
      limb(
        v3(0.092, 0.008, side * 0.006),
        v3(0.115, 0.016, side * 0.018),
        0.002,
        0.0008,
        [0.55, 0.48, 0.44],
        4,
      ),
    );
  }
  // Seven pairs of legs, each in two segments: out, then down to the sand.
  for (let k = 0; k < 7; k++)
    for (const side of [-1, 1]) {
      const x = 0.06 - k * 0.019,
        hip = v3(x, 0.004, side * 0.028),
        knee = v3(x + 0.004, 0.012, side * 0.05),
        foot = v3(x + 0.008 - k * 0.002, -0.004, side * 0.06);
      parts.push(limb(hip, knee, 0.003, 0.0024, [0.56, 0.48, 0.43], 4));
      parts.push(limb(knee, foot, 0.0024, 0.0012, [0.6, 0.52, 0.46], 4));
    }
  return merge(parts);
}
/** A salp: a clear barrel (about 12 cm long) along x, with muscle bands and a dark gut. */
/** A salp (about 12 cm long) along x: a clear, open-ended barrel ringed by raised muscle bands,
 * a dark gut nucleus and a pale gill bar inside. */
export function salpGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [],
    bands = 7,
    radius = (u: number) =>
      0.034 *
      Math.pow(Math.sin(Math.PI * (0.12 + 0.76 * u)), 0.35) *
      (1 + 0.07 * Math.pow(Math.abs(Math.cos(u * Math.PI * bands)), 12)),
    body = latheBody(0.12, radius, 1, 28, 16);
  parts.push(coloured(body, [0.78, 0.9, 0.97], 0.04));
  // Muscle bands: thin pale hoops.
  for (let k = 1; k < bands; k++) {
    const u = k / bands,
      hoop = new THREE.TorusGeometry(radius(u) * 1.01, 0.0016, 4, 18);
    hoop.rotateY(Math.PI / 2);
    hoop.translate((u - 0.5) * 0.12, 0, 0);
    parts.push(coloured(hoop, [0.9, 0.97, 1], 0.03));
  }
  const gut = new THREE.SphereGeometry(0.011, 8, 6);
  gut.scale(1.4, 1, 1);
  gut.translate(-0.035, 0.012, 0);
  parts.push(coloured(gut, [0.62, 0.32, 0.14], 0.1));
  parts.push(
    limb(
      v3(-0.03, 0.01, 0),
      v3(0.035, -0.012, 0),
      0.0022,
      0.0018,
      [0.95, 0.85, 0.7],
      4,
    ),
  );
  return merge(parts);
}
/**
 * A jellyfish bell (about 0.6 m across), rim at y 0. V0.7 Pass 078: a thick mesoglea dome (its
 * margin rounded into scalloped lappets) with sixteen darker radial canals, four horseshoe gonads
 * showing through the crown and a pale ring canal at the margin; drawn with the gelatinous
 * material, the dark organs stay opaque inside the clear bell.
 */
export function jellyBellGeometry(): THREE.BufferGeometry {
  const g = new THREE.SphereGeometry(
      0.32,
      48,
      18,
      0,
      Math.PI * 2,
      0,
      Math.PI * 0.55,
    ),
    p = g.getAttribute('position');
  for (let i = 0; i < p.count; i++) {
    const a = Math.atan2(p.getZ(i), p.getX(i)),
      y = p.getY(i),
      edge = 1 - y / 0.32,
      // Lappets: rounded scallops that deepen toward the margin.
      scallop =
        1 + 0.045 * Math.pow(Math.abs(Math.cos(a * 8)), 0.6) * edge ** 2,
      lift = 0.018 * edge ** 3 * (1 - Math.abs(Math.cos(a * 8)));
    p.setXYZ(i, p.getX(i) * scallop, y * 0.75 + lift, p.getZ(i) * scallop);
  }
  const out = coloured(g, [0.96, 0.62, 0.42], 0.06),
    c = out.getAttribute('color'),
    pp = out.getAttribute('position');
  for (let i = 0; i < c.count; i++) {
    const x = pp.getX(i),
      z = pp.getZ(i),
      y = pp.getY(i),
      a = Math.atan2(z, x),
      r = Math.hypot(x, z) / 0.33;
    let k = 1;
    // Radial canals: fine dark lines from the crown to the margin.
    const canal = Math.pow(Math.abs(Math.cos(a * 8)), 40);
    k *= 1 - 0.35 * canal * Math.min(1, r * 1.6);
    // Four horseshoe gonads around the crown (dark, so they read as organs).
    const ring = Math.exp(-(((r - 0.33) / 0.09) ** 2)),
      lobes = 0.5 + 0.5 * Math.cos(a * 4);
    k *= 1 - 0.62 * ring * lobes * (y > 0.12 ? 1 : 0);
    // A pale ring canal just inside the margin.
    if (y < 0.03) k *= 1.12;
    c.setXYZ(
      i,
      c.getX(i) * k,
      c.getY(i) * k * (1 - 0.25 * ring * lobes),
      c.getZ(i) * k * (1 - 0.35 * ring * lobes),
    );
  }
  return out;
}
/** A ruffled ribbon hanging from `top`: `length` long, `width` wide, turned `yaw` about y. */
function oralArm(
  top: THREE.Vector3,
  length: number,
  width: number,
  yaw: number,
  seed: number,
): THREE.BufferGeometry {
  const rows = 26,
    cols = 7,
    pos: number[] = [],
    idx: number[] = [];
  for (let i = 0; i <= rows; i++) {
    const u = i / rows,
      w = width * (1 - 0.7 * u) * (0.8 + 0.2 * Math.sin(u * 9 + seed)),
      sway = 0.06 * Math.sin(u * 3.2 + seed) * u;
    for (let j = 0; j <= cols; j++) {
      const x = (j / cols - 0.5) * 2,
        // The frilled margins ruffle out of the ribbon's plane; the middle stays a firm midrib.
        ruffle = x * x * w * 0.55 * Math.sin(u * 38 + x * 2.5 + seed),
        lx = x * w * 0.5,
        lz = ruffle + sway;
      pos.push(
        top.x + lx * Math.cos(yaw) - lz * Math.sin(yaw),
        top.y - u * length,
        top.z + lx * Math.sin(yaw) + lz * Math.cos(yaw),
      );
    }
  }
  const w = cols + 1;
  for (let i = 0; i < rows; i++)
    for (let j = 0; j < cols; j++) {
      const q = i * w + j;
      idx.push(q, q + w, q + 1, q + 1, q + w, q + w + 1);
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  return g;
}
/** V0.7 Pass 078: four ruffled oral-arm ribbons (were stacked boxes) and smooth, curling
 * tentacles (were three-sided cylinder chains), with the same reach as before. */
export function jellyArmsGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [],
    rand = random(911);
  for (let a = 0; a < 4; a++) {
    const base = (a / 4) * Math.PI * 2 + Math.PI / 4;
    parts.push(
      coloured(
        oralArm(
          v3(Math.cos(base) * 0.05, 0.05, Math.sin(base) * 0.05),
          1.3,
          0.13,
          base + Math.PI / 2,
          a * 1.7,
        ),
        [0.98, 0.7, 0.55],
        0.08,
      ),
    );
  }
  for (let t = 0; t < 24; t++) {
    const a = (t / 24) * Math.PI * 2,
      len = 1.2 + rand() * 1.4,
      pts: THREE.Vector3[] = [];
    for (let k = 0; k <= 6; k++) {
      const u = k / 6;
      pts.push(
        v3(
          Math.cos(a) * (0.3 - 0.08 * u) + 0.05 * Math.sin(u * 5 + t),
          -len * u,
          Math.sin(a) * (0.3 - 0.08 * u) + 0.04 * Math.cos(u * 4 + t),
        ),
      );
    }
    parts.push(
      coloured(
        organicTube(pts, (u) => 0.006 - 0.0035 * u, 24, 5),
        [0.95, 0.6, 0.45],
        0.06,
      ),
    );
  }
  return merge(parts);
}
/** A flat, hexagonal platelet of ice (about 8 cm across). */
function plateletGeometry(): THREE.BufferGeometry {
  const g = new THREE.CylinderGeometry(0.05, 0.05, 0.004, 6);
  return coloured(g, [0.85, 0.95, 1], 0.1);
}

// ------------------------------------------------------------------ the collection

interface Jelly {
  readonly root: THREE.Group;
  readonly bell: THREE.Mesh;
  readonly arms: THREE.Mesh;
  readonly centre: Vec3;
  readonly at: Vec3;
  readonly radius: number;
  readonly phase: number;
  readonly scale: number;
}
interface Crawler {
  readonly home: Vec3;
  readonly radius: number;
  angle: number;
  readonly speed: number;
  readonly at: Vec3;
}

export class IceExtras {
  readonly root = new THREE.Group();
  readonly sightings: SightCandidate[] = [];
  private readonly geometries: THREE.BufferGeometry[] = [];
  private readonly materials: THREE.Material[] = [];
  private readonly scallops: THREE.InstancedMesh;
  private readonly scallopBase: THREE.Matrix4[] = [];
  private readonly clapPhase: number[] = [];
  private readonly pens: THREE.InstancedMesh;
  private readonly penBase: {
    x: number;
    y: number;
    z: number;
    h: number;
    phase: number;
  }[] = [];
  private readonly isopods: THREE.InstancedMesh;
  private readonly crawlers: Crawler[] = [];
  private readonly salps: THREE.InstancedMesh;
  private readonly chains: {
    centre: Vec3;
    radius: number;
    speed: number;
    phase: number;
    at: Vec3;
    height: number;
  }[] = [];
  private readonly jellies: Jelly[] = [];
  private readonly m = new THREE.Matrix4();
  private readonly q = new THREE.Quaternion();
  private readonly e = new THREE.Euler();
  private readonly p = new THREE.Vector3();
  private readonly s = new THREE.Vector3();
  private time = 0;
  /** The algae film under the ice, and the sea angels. */
  private readonly underside = new IceUnderside();
  private disposed = false;

  constructor(
    stones: readonly { x: number; y: number; z: number; size: number }[],
  ) {
    this.root.name = 'Under-ice detail';
    const rand = random(ICE_EXTRAS.seed),
      w = ICE.walls,
      top = ICE.ceiling,
      minX = -w.x + 3,
      maxX = w.x - 3,
      nearZ = ICE.tunnel.wallZ - 4,
      farZ = w.farZ + 3,
      spot = (): { x: number; z: number } => ({
        x: minX + rand() * (maxX - minX),
        z: farZ + rand() * (nearZ - farZ),
      }),
      inHole = (x: number, z: number, margin: number) =>
        ICE.holes.some((h) => Math.hypot(x - h.x, z - h.z) < h.r + margin),
      onStone = (x: number, z: number) =>
        stones.some((st) => Math.hypot(st.x - x, st.z - z) < st.size * 0.7);
    const detail = this.own(
      new THREE.MeshStandardMaterial({
        name: 'Ice life',
        vertexColors: true,
        roughness: 0.7,
      }),
    );
    const ice = this.own(
      new THREE.MeshStandardMaterial({
        name: 'Ice detail',
        vertexColors: true,
        // V0.7 Pass 080: on the ice template (see the 'Ice' material): less glassy, half the glow.
        roughness: 0.35,
        metalness: 0,
        flatShading: true,
        emissive: 0x123c5a,
        emissiveIntensity: 0.3,
      }),
    );
    // Brinicles from the sea ice (their tops sunk into it), clear of the holes.
    const brinicles = this.instanced(
      brinicleGeometry(),
      ice,
      ICE_EXTRAS.brinicles,
      'Brinicles',
    );
    let n = 0;
    for (let tries = 0; n < ICE_EXTRAS.brinicles && tries < 400; tries++) {
      const { x, z } = spot();
      if (inHole(x, z, 2.5)) continue;
      const len = 0.8 + rand() * rand() * 1.8,
        wide = 0.8 + rand() * 0.6;
      this.e.set(0, rand() * 6.3, 0);
      this.m.compose(
        this.p.set(x, top + 0.4, z),
        this.q.setFromEuler(this.e),
        this.s.set(wide, len + 0.4, wide),
      );
      brinicles.setMatrixAt(n++, this.m);
    }
    brinicles.count = n;
    // Platelet ice: a loose layer of plates just under the ice, tilted every way.
    const platelets = this.instanced(
      plateletGeometry(),
      ice,
      ICE_EXTRAS.platelets,
      'Platelet ice',
    );
    n = 0;
    for (let tries = 0; n < ICE_EXTRAS.platelets && tries < 3000; tries++) {
      const { x, z } = spot();
      if (inHole(x, z, 0.6)) continue;
      this.e.set((rand() - 0.5) * 2.4, rand() * 6.3, (rand() - 0.5) * 2.4);
      const k = 0.7 + rand() * 1.2;
      this.m.compose(
        this.p.set(x, top - 0.05 - rand() * 0.55, z),
        this.q.setFromEuler(this.e),
        this.s.set(k, 1, k),
      );
      platelets.setMatrixAt(n++, this.m);
    }
    platelets.count = n;
    // On the seabed: a helper to scatter a kind.
    const scatter = (
      mesh: THREE.InstancedMesh,
      count: number,
      size: () => number,
      where: () => { x: number; z: number } = spot,
      lift = 0,
      tilt = 0.15,
    ): { x: number; y: number; z: number }[] => {
      const placed: { x: number; y: number; z: number }[] = [];
      for (let tries = 0; placed.length < count && tries < count * 8; tries++) {
        const { x, z } = where();
        if (x < minX || x > maxX || z < farZ || z > nearZ || onStone(x, z))
          continue;
        const y = iceFloor(x, z) + lift,
          k = size();
        this.e.set((rand() - 0.5) * tilt, rand() * 6.3, (rand() - 0.5) * tilt);
        this.m.compose(
          this.p.set(x, y, z),
          this.q.setFromEuler(this.e),
          this.s.setScalar(k),
        );
        mesh.setMatrixAt(placed.length, this.m);
        placed.push({ x, y, z });
      }
      mesh.count = placed.length;
      mesh.instanceMatrix.needsUpdate = true;
      return placed;
    };
    // Patches: points loosely gathered round a few centres.
    const patches = (k: number, spread: number) => {
      const centres = Array.from({ length: k }, spot);
      return () => {
        const c = centres[Math.floor(rand() * centres.length)],
          a = rand() * 6.3,
          r = Math.sqrt(rand()) * spread;
        return { x: c.x + Math.cos(a) * r, z: c.z + Math.sin(a) * r };
      };
    };
    scatter(
      this.instanced(
        dropstoneGeometry(),
        detail,
        ICE_EXTRAS.dropstones,
        'Dropstones',
      ),
      ICE_EXTRAS.dropstones,
      () => 0.25 + rand() * rand() * 1.2,
      spot,
      -0.08,
      0.5,
    );
    scatter(
      this.instanced(
        anchorIceGeometry(),
        ice,
        ICE_EXTRAS.anchorIce,
        'Anchor ice',
      ),
      ICE_EXTRAS.anchorIce,
      () => 0.8 + rand() * 1.6,
      patches(6, 3),
    );
    const urchinAt = scatter(
      this.instanced(
        urchinGeometry(),
        detail,
        ICE_EXTRAS.urchins,
        'Sea urchins',
      ),
      ICE_EXTRAS.urchins,
      () => 0.8 + rand() * 0.6,
      patches(7, 2.6),
    );
    const brittleAt = scatter(
      this.instanced(
        brittleStarGeometry(),
        detail,
        ICE_EXTRAS.brittleStars,
        'Brittle stars',
      ),
      ICE_EXTRAS.brittleStars,
      () => 0.8 + rand() * 0.7,
    );
    const cucumberAt = scatter(
      this.instanced(
        cucumberGeometry(),
        detail,
        ICE_EXTRAS.cucumbers,
        'Sea cucumbers',
      ),
      ICE_EXTRAS.cucumbers,
      () => 0.8 + rand() * 0.8,
    );
    // Scallop beds (kept so a few can clap).
    this.scallops = this.instanced(
      scallopGeometry(),
      detail,
      ICE_EXTRAS.scallops,
      'Antarctic scallops',
    );
    const scallopWhere = patches(6, 2.2);
    for (
      let tries = 0;
      this.scallopBase.length < ICE_EXTRAS.scallops && tries < 3000;
      tries++
    ) {
      const { x, z } = scallopWhere();
      if (x < minX || x > maxX || z < farZ || z > nearZ || onStone(x, z))
        continue;
      this.e.set((rand() - 0.5) * 0.3, rand() * 6.3, (rand() - 0.5) * 0.3);
      const base = new THREE.Matrix4().compose(
        new THREE.Vector3(x, iceFloor(x, z), z),
        new THREE.Quaternion().setFromEuler(this.e),
        new THREE.Vector3().setScalar(1.6 + rand() * 0.8),
      );
      this.scallops.setMatrixAt(this.scallopBase.length, base);
      this.scallopBase.push(base);
      this.clapPhase.push(rand() * 20);
    }
    this.scallops.count = this.scallopBase.length;
    // Sea pens, swaying.
    this.pens = this.instanced(
      seaPenGeometry(),
      detail,
      ICE_EXTRAS.seaPens,
      'Sea pens',
    );
    const penWhere = patches(5, 3);
    for (
      let tries = 0;
      this.penBase.length < ICE_EXTRAS.seaPens && tries < 600;
      tries++
    ) {
      const { x, z } = penWhere();
      if (x < minX || x > maxX || z < farZ || z > nearZ || onStone(x, z))
        continue;
      this.penBase.push({
        x,
        y: iceFloor(x, z) - 0.05,
        z,
        h: 0.5 + rand() * 0.6,
        phase: rand() * 6.3,
      });
    }
    this.pens.count = this.penBase.length;
    // Giant isopods crawling slow circles.
    this.isopods = this.instanced(
      isopodGeometry(),
      detail,
      ICE_EXTRAS.isopods,
      'Giant isopods',
    );
    for (let i = 0; i < ICE_EXTRAS.isopods; i++) {
      const { x, z } = spot();
      this.crawlers.push({
        home: { x, y: 0, z },
        radius: 1 + rand() * 2,
        angle: rand() * 6.3,
        speed: (0.03 + rand() * 0.03) * (rand() < 0.5 ? -1 : 1),
        at: { x, y: 0, z },
      });
    }
    this.isopods.count = this.crawlers.length;
    // Salp chains drifting in mid-water.
    this.salps = this.instanced(
      salpGeometry(),
      // V0.7 Pass 078: a clear barrel whose muscle bands and dark gut show through.
      this.own(gelatinousMaterial(GELATINOUS_PRESETS.salp)),
      ICE_EXTRAS.salpChains * ICE_EXTRAS.salpLength,
      'Salp chains',
    );
    for (let c = 0; c < ICE_EXTRAS.salpChains; c++) {
      const { x, z } = spot();
      this.chains.push({
        centre: { x: x * 0.7, y: 0, z },
        radius: 3 + rand() * 5,
        speed: (0.025 + rand() * 0.02) * (c % 2 ? 1 : -1),
        phase: rand() * 6.3,
        at: { x, y: 0, z },
        height: 3.5 + rand() * 6,
      });
    }
    // Jellyfish: big, slow, in mid-water.
    const bell = jellyBellGeometry(),
      arms = jellyArmsGeometry();
    this.geometries.push(bell, arms);
    // V0.7 Pass 078: a clear bell, thicker toward its margin, its gonads and arms showing.
    const jellyMaterial = this.own(
      gelatinousMaterial(GELATINOUS_PRESETS.jellyfish),
    );
    for (let j = 0; j < ICE_EXTRAS.jellies; j++) {
      const { x, z } = spot(),
        root = new THREE.Group(),
        b = new THREE.Mesh(bell, jellyMaterial),
        a = new THREE.Mesh(arms, jellyMaterial),
        scale = 0.9 + rand() * 0.9;
      root.name = `Antarctic jellyfish ${j + 1}`;
      root.add(b, a);
      root.scale.setScalar(scale);
      this.root.add(root);
      // High enough that their long tentacles (up to about 4.7 m) clear the seabed.
      const at = { x, y: 7 + rand() * 4, z };
      this.jellies.push({
        root,
        bell: b,
        arms: a,
        centre: { x: x * 0.8, y: at.y, z },
        at,
        radius: 2 + rand() * 4,
        phase: rand() * 6.3,
        scale,
      });
      this.sightings.push({
        ...ICE_SIGHTS.jellyfish,
        position: at,
        radius: 2.5 * scale,
      });
    }
    // Sightings for the rest (a few of each, close by).
    for (const p of urchinAt.slice(0, 12))
      this.sightings.push({ ...ICE_SIGHTS.urchin, position: p, radius: 0.8 });
    for (const p of brittleAt.slice(0, 12))
      this.sightings.push({
        ...ICE_SIGHTS.brittleStar,
        position: p,
        radius: 0.8,
      });
    for (const p of cucumberAt.slice(0, 10))
      this.sightings.push({ ...ICE_SIGHTS.cucumber, position: p, radius: 0.9 });
    for (const b of this.scallopBase.slice(0, 20)) {
      const at = new THREE.Vector3().setFromMatrixPosition(b);
      this.sightings.push({
        ...ICE_SIGHTS.scallop,
        position: { x: at.x, y: at.y, z: at.z },
        radius: 0.9,
      });
    }
    for (const p of this.penBase.slice(0, 12))
      this.sightings.push({ ...ICE_SIGHTS.seaPen, position: p, radius: 1 });
    for (const c of this.crawlers)
      this.sightings.push({
        ...ICE_SIGHTS.isopod,
        position: c.at,
        radius: 0.8,
      });
    for (const c of this.chains)
      this.sightings.push({ ...ICE_SIGHTS.salp, position: c.at, radius: 2 });
    this.root.add(this.underside.root);
    this.sightings.push(...this.underside.sightings);
    this.update(0, true, false);
  }
  private own<T extends THREE.Material>(m: T): T {
    this.materials.push(m);
    return m;
  }
  private instanced(
    g: THREE.BufferGeometry,
    m: THREE.Material,
    count: number,
    name: string,
  ): THREE.InstancedMesh {
    this.geometries.push(g);
    const mesh = new THREE.InstancedMesh(g, m, count);
    mesh.name = name;
    mesh.frustumCulled = false;
    this.root.add(mesh);
    return mesh;
  }
  /** Animate: scallops clapping, sea pens swaying, isopods crawling, salps and jellies drifting. */
  update(
    dt: number,
    active: boolean,
    reducedMotion: boolean,
    player?: PlayerPresence,
  ): void {
    if (this.disposed || !active) return;
    this.underside.update(dt, active, reducedMotion);
    const step = Math.min(Math.max(dt, 0), 0.1);
    this.time += reducedMotion ? step * 0.4 : step;
    const t = this.time;
    // Scallops: a few clap now and then (a quick snap of the upper shell, a little hop).
    for (
      let i = 0;
      i < Math.min(ICE_EXTRAS.clappers, this.scallopBase.length);
      i++
    ) {
      const cycle = (t + this.clapPhase[i]) % 9,
        snap =
          cycle < 0.6 && !reducedMotion ? Math.sin((cycle / 0.6) * Math.PI) : 0;
      this.m.copy(this.scallopBase[i]);
      this.p.setFromMatrixPosition(this.m);
      this.m.setPosition(this.p.x, this.p.y + 0.05 * snap, this.p.z);
      this.s.set(1, 1 + 0.6 * snap, 1);
      this.m.scale(this.s);
      this.scallops.setMatrixAt(i, this.m);
    }
    this.scallops.instanceMatrix.needsUpdate = true;
    // Sea pens sway in the current.
    this.penBase.forEach((b, i) => {
      this.e.set(
        0.12 * Math.sin(t * 0.5 + b.phase),
        b.phase,
        0.1 * Math.sin(t * 0.37 + b.phase * 1.7),
      );
      this.m.compose(
        this.p.set(b.x, b.y, b.z),
        this.q.setFromEuler(this.e),
        this.s.set(b.h, b.h, b.h),
      );
      this.pens.setMatrixAt(i, this.m);
    });
    this.pens.instanceMatrix.needsUpdate = true;
    // Isopods crawl slow circles over the bottom.
    this.crawlers.forEach((c, i) => {
      c.angle += (c.speed / c.radius) * step;
      c.at.x = c.home.x + Math.cos(c.angle) * c.radius;
      c.at.z = c.home.z + Math.sin(c.angle) * c.radius;
      c.at.y = iceFloor(c.at.x, c.at.z);
      const heading = Math.atan2(
        -Math.cos(c.angle) * Math.sign(c.speed),
        -Math.sin(c.angle) * Math.sign(c.speed),
      );
      this.e.set(0, heading, 0);
      this.m.compose(
        this.p.set(c.at.x, c.at.y, c.at.z),
        this.q.setFromEuler(this.e),
        this.s.setScalar(1.8),
      );
      this.isopods.setMatrixAt(i, this.m);
    });
    this.isopods.instanceMatrix.needsUpdate = true;
    // Salp chains: a slow loop, the chain undulating along its length.
    this.chains.forEach((c, k) => {
      const a = c.phase + t * c.speed;
      c.at.x = c.centre.x + Math.cos(a) * c.radius;
      c.at.z = c.centre.z + Math.sin(a) * c.radius;
      c.at.y = c.height + 0.6 * Math.sin(t * 0.13 + c.phase);
      const dirX = -Math.sin(a) * Math.sign(c.speed),
        dirZ = Math.cos(a) * Math.sign(c.speed),
        heading = Math.atan2(-dirZ, dirX);
      for (let i = 0; i < ICE_EXTRAS.salpLength; i++) {
        const back = i * 0.11,
          wave = 0.12 * Math.sin(t * 0.9 - i * 0.6 + c.phase);
        this.e.set(0.4 * Math.sin(i * 1.3), heading + wave * 2, 0);
        this.m.compose(
          this.p.set(
            c.at.x - dirX * back - dirZ * wave,
            c.at.y + 0.05 * Math.sin(i + t),
            c.at.z - dirZ * back + dirX * wave,
          ),
          this.q.setFromEuler(this.e),
          this.s.setScalar(1.4),
        );
        this.salps.setMatrixAt(k * ICE_EXTRAS.salpLength + i, this.m);
      }
    });
    this.salps.instanceMatrix.needsUpdate = true;
    // Jellyfish: pulsing, drifting slow circles, edging away from a swimmer who comes very close.
    for (const j of this.jellies) {
      const pulse = reducedMotion ? 0 : Math.sin(t * 1.1 + j.phase),
        a = j.phase + t * 0.02;
      j.at.x = j.centre.x + Math.cos(a) * j.radius;
      j.at.z = j.centre.z + Math.sin(a) * j.radius;
      j.at.y =
        j.centre.y +
        0.4 * Math.sin(t * 0.21 + j.phase) +
        0.12 * Math.max(0, pulse);
      if (player?.active) {
        const e = player.position,
          d = Math.hypot(j.at.x - e.x, j.at.y - e.y, j.at.z - e.z);
        if (d < 2.5 && d > 1e-3) {
          const push = (2.5 - d) * 0.5;
          j.centre.x += ((j.at.x - e.x) / d) * push * step;
          j.centre.z += ((j.at.z - e.z) / d) * push * step;
        }
      }
      j.root.position.set(j.at.x, j.at.y, j.at.z);
      j.bell.scale.set(1 + 0.08 * pulse, 1 - 0.14 * pulse, 1 + 0.08 * pulse);
      j.arms.rotation.set(
        0.06 * Math.sin(t * 0.4 + j.phase),
        t * 0.03,
        0.06 * Math.cos(t * 0.33 + j.phase),
      );
    }
  }
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.underside.dispose();
    this.root.removeFromParent();
    this.root.clear();
    this.geometries.forEach((g) => g.dispose());
    this.materials.forEach((m) => m.dispose());
    for (const mesh of [this.scallops, this.pens, this.isopods, this.salps])
      mesh.dispose();
    this.sightings.length = 0;
  }
}
