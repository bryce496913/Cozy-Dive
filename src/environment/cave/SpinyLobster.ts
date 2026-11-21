import * as THREE from 'three';
import { organicTube, polarSheet, smoothed } from '../shared/organicGeometry';
import { articulated, limb, merged, podomere, tinted } from './CaveLobsters';

/**
 * v0.6 Pass 053 (visual consistency): the spiny lobster rebuilt to the creature standard. Same
 * contract as the Pass 041 body: facing +z, underside at y 0, about 0.45 m from horns to tail fan,
 * one vertex-coloured geometry (the long antennae stay separate). What it adds over the old
 * stretched sphere and boxes:
 *   - a cephalothorax shaped as a lobster's: a squarish, slightly tapering carapace with a cervical
 *     groove, forward-raked spines in rows along its top and flanks, and pale spots;
 *   - two big, curved horns over stalked eyes, and short forked antennules;
 *   - an abdomen of six overlapping tergites, each with a groove, a pair of pale spots, and
 *     pointed pleura curving down its sides;
 *   - a real tail fan: a rounded telson between two pairs of paddle-shaped uropods, banded;
 *   - five pairs of walking legs, banded orange and cream. V0.7 Pass 078: articulated podomeres
 *     that overlap at each joint (`podomere`), not cylinders meeting at a ball.
 * Colour: deep red-brown, the spines darker, spots and bands pale yellow-cream.
 */
type RGB = readonly [number, number, number];
const SHELL: RGB = [0.5, 0.17, 0.09],
  SHELL_LIGHT: RGB = [0.62, 0.25, 0.12],
  SPINE: RGB = [0.3, 0.09, 0.05],
  SPOT: RGB = [0.92, 0.8, 0.48],
  LEG: RGB = [0.8, 0.5, 0.22],
  BAND: RGB = [0.95, 0.85, 0.62],
  EYE: RGB = [0.03, 0.03, 0.03];
const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

/** Mix two colours. */
const blend = (a: RGB, b: RGB, t: number): RGB => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
];
const scaled = (a: RGB, k: number): RGB => [a[0] * k, a[1] * k, a[2] * k];
/** Scattered round pale spots on a 2-D field (1 in a spot, 0 between). */
function spotAt(a: number, b: number): number {
  const ca = Math.floor(a),
    cb = Math.floor(b),
    h = (Math.sin(ca * 127.1 + cb * 311.7) * 43758.5453) % 1,
    ja = ca + 0.5 + 0.3 * Math.sin(h * 40),
    jb = cb + 0.5 + 0.3 * Math.cos(h * 53),
    d = Math.hypot(a - ja, b - jb);
  return Math.abs(h) > 0.45 ? Math.max(0, Math.min(1, (0.28 - d) * 12)) : 0;
}
/** Smooth (creased) normals and a per-vertex colour from position, ready to merge. */
function painted(
  g: THREE.BufferGeometry,
  colour: (x: number, y: number, z: number) => RGB,
): THREE.BufferGeometry {
  const out = smoothed(g),
    p = out.getAttribute('position'),
    c = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) {
    const k = colour(p.getX(i), p.getY(i), p.getZ(i)),
      speck = 0.94 + 0.06 * Math.sin(i * 12.9898);
    c.set([k[0] * speck, k[1] * speck, k[2] * speck], i * 3);
  }
  out.setAttribute('color', new THREE.Float32BufferAttribute(c, 3));
  return out;
}
export function spinyLobsterBody(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  // The carapace. V0.7 Pass 078: a squarish, tapering shell (finer than before) whose surface is
  // covered in small tubercles and crossed by the cervical groove, painted per vertex: red-brown,
  // darker in the groove and between tubercles, with pale cream spots (they were stuck-on balls).
  const shell = new THREE.SphereGeometry(1, 44, 26),
    sp = shell.getAttribute('position');
  for (let i = 0; i < sp.count; i++) {
    const x = sp.getX(i),
      y = sp.getY(i),
      z = sp.getZ(i),
      sq = (a: number) => Math.sign(a) * Math.abs(a) ** 0.75,
      taper = 1 - 0.18 * Math.max(0, z),
      groove = 1 - 0.08 * Math.exp(-(((z + 0.15) / 0.07) ** 2)),
      // Tubercles: a lattice of small bumps over the top and flanks.
      bump =
        1 +
        0.035 *
          Math.max(0, Math.sin(z * 34) * Math.sin(Math.atan2(y, x) * 14)) *
          Math.max(0, y + 0.2);
    sp.setXYZ(
      i,
      sq(x) * 0.058 * taper * groove * bump,
      sq(y) * 0.05 * taper * groove * bump,
      z * 0.125,
    );
  }
  shell.translate(0, 0.068, 0.075);
  parts.push(
    painted(shell, (x, y, z) => {
      const groove = Math.exp(-(((z - 0.075 + 0.15 * 0.125) / 0.012) ** 2)),
        spot = spotAt(x * 40, z * 40) * (y > 0.075 ? 1 : 0.4),
        shade = 0.85 + 0.25 * Math.min(1, Math.max(0, (y - 0.03) / 0.08));
      return blend(
        scaled(SHELL, shade * (1 - 0.35 * groove)),
        SPOT,
        spot * 0.85,
      );
    }),
  );
  // Rows of forward-raked spines along its top and upper flanks (eight-sided, curving forward).
  for (const [row, side, height] of [
    [0, 0, 0.118],
    [1, -1, 0.106],
    [1, 1, 0.106],
    [2, -1, 0.085],
    [2, 1, 0.085],
  ] as const) {
    for (let k = 0; k < 7; k++) {
      const z = -0.03 + k * 0.03,
        x = side * (row === 1 ? 0.035 : 0.053),
        dir = v(side * 0.3, 0.85, 0.45).normalize(),
        base = v(x, height - Math.abs(z - 0.08) * 0.1, z);
      parts.push(
        podomere(
          base,
          base.clone().addScaledVector(dir, 0.016 - row * 0.002),
          0.0042,
          0.0006,
          SPINE,
          SPINE,
          SPINE,
          6,
          0.12,
        ),
      );
    }
  }
  // The two big curved horns over the eyes, and the eyes on short stalks.
  for (const side of [-1, 1]) {
    const a = v(side * 0.026, 0.108, 0.185),
      b = v(side * 0.034, 0.135, 0.215),
      c = v(side * 0.03, 0.15, 0.245);
    parts.push(
      limb(a, b, 0.012, 0.009, SHELL_LIGHT),
      limb(b, c, 0.009, 0.002, SPINE),
    );
    parts.push(
      limb(
        v(side * 0.016, 0.092, 0.192),
        v(side * 0.03, 0.104, 0.205),
        0.006,
        0.005,
        SHELL,
      ),
    );
    const eye = new THREE.SphereGeometry(0.009, 10, 8);
    eye.translate(side * 0.033, 0.107, 0.208);
    parts.push(tinted(eye, EYE));
    // Antennules: a short banded stalk, forking into two fine whips.
    const base = v(side * 0.01, 0.075, 0.2),
      fork = v(side * 0.016, 0.1, 0.27);
    parts.push(limb(base, fork, 0.004, 0.003, LEG));
    for (const lift of [0.03, -0.005])
      parts.push(
        limb(fork, v(side * 0.03, 0.1 + lift, 0.33), 0.0018, 0.0006, BAND),
      );
  }
  // The abdomen. V0.7 Pass 078: one continuous, gently arched tail (it was six loose half-balls):
  // each of its six segments a domed tergite with a groove at its hinge and a pair of pale spots,
  // overhanging curved pleural plates with rounded points down each side, flattened beneath.
  const segs = 6,
    tailFrom = -0.05,
    tailTo = -0.3,
    tail = organicTube(
      [v(0, 0.045, tailFrom), v(0, 0.04, -0.15), v(0, 0.03, tailTo)],
      (u) => {
        const f = (u * segs) % 1,
          dome = Math.sin(Math.PI * f) ** 0.5,
          hinge =
            Math.exp(-((f / 0.08) ** 2)) + Math.exp(-(((1 - f) / 0.08) ** 2));
        return (0.05 - 0.018 * u) * (0.9 + 0.1 * dome - 0.06 * hinge);
      },
      120,
      22,
      0.62,
    );
  parts.push(
    painted(tail, (x, y, z) => {
      const u = (tailFrom - z) / (tailFrom - tailTo),
        f = (u * segs) % 1,
        hinge =
          Math.exp(-((f / 0.06) ** 2)) + Math.exp(-(((1 - f) / 0.06) ** 2)),
        spot =
          Math.exp(-(((f - 0.5) / 0.18) ** 2)) *
          Math.exp(-(((Math.abs(x) - 0.022) / 0.007) ** 2)),
        top = y > 0.025 ? 1 : 0.6;
      return blend(
        scaled(
          (u * segs) % 2 < 1 ? SHELL : SHELL_LIGHT,
          top * (1 - 0.4 * hinge),
        ),
        SPOT,
        spot * (y > 0.03 ? 0.9 : 0),
      );
    }),
  );
  for (let i = 0; i < segs; i++)
    for (const side of [-1, 1]) {
      const u0 = (i + 0.15) / segs,
        u1 = (i + 0.95) / segs,
        z0 = tailFrom + (tailTo - tailFrom) * u0,
        z1 = tailFrom + (tailTo - tailFrom) * u1,
        w = 0.048 - 0.016 * ((i + 0.5) / segs),
        plate = polarSheet(
          (r, a, out) => {
            // A curved plate hanging from the tergite's edge, pointed and rounded at its tip.
            const z = z0 + (z1 - z0) * a,
              reach = 0.026 * (1 - 0.6 * Math.abs(a - 0.4) ** 1.4),
              d = r * reach;
            out.set(
              side * (w * 0.92 + d * 0.35),
              0.032 - i * 0.002 - d,
              z - d * 0.35,
            );
          },
          0,
          1,
          3,
          8,
        );
      parts.push(painted(plate, () => scaled(SHELL, 0.85)));
    }
  // The tail fan: a rounded telson between two pairs of paddles, each finely ribbed, thin, and
  // banded pale at its edge.
  const fan = (
    angle: number,
    length: number,
    width: number,
    centre: boolean,
  ) => {
    const g = polarSheet(
      (r, a, out) => {
        const x = Math.sin(a) * width * r,
          z = -Math.cos(a) * length * r,
          rib = 0.0012 * Math.sin(a * 22),
          lx = x * Math.cos(angle) + z * Math.sin(angle),
          lz = -x * Math.sin(angle) + z * Math.cos(angle);
        out.set(lx, 0.026 + rib - r * r * 0.006, tailTo + lz + 0.004);
      },
      -Math.PI / 2,
      Math.PI / 2,
      6,
      18,
    );
    parts.push(
      painted(g, (x, _y, z) => {
        const r = Math.hypot(x, z - tailTo) / length;
        return blend(
          centre ? SHELL_LIGHT : SHELL,
          SPOT,
          Math.max(0, (r - 0.78) * 4),
        );
      }),
    );
  };
  fan(0, 0.045, 0.026, true);
  for (const side of [-1, 1]) {
    fan(side * 0.42, 0.05, 0.024, false);
    fan(side * 0.82, 0.046, 0.022, false);
  }
  // Five pairs of walking legs. V0.7 Pass 078: each four articulated podomeres (coxa, merus,
  // carpus-propodus, dactyl) that overlap at their joints, banded orange and cream, with a dark
  // claw-tip; no more cylinders meeting at a joint ball.
  for (const side of [-1, 1])
    for (let i = 0; i < 5; i++) {
      const z = 0.14 - i * 0.034,
        hip = v(side * 0.042, 0.04, z),
        coxa = v(side * 0.062, 0.055, z + 0.004),
        knee = v(side * (0.11 + i * 0.004), 0.085, z + 0.02 - i * 0.01),
        ankle = v(side * (0.155 + i * 0.006), 0.035, z + 0.03 - i * 0.016),
        foot = v(side * (0.17 + i * 0.006), 0.0, z + 0.04 - i * 0.02);
      parts.push(
        ...articulated([hip, coxa, knee, ankle], 0.0085, 0.0052, LEG, BAND, 8),
      );
      parts.push(
        podomere(ankle, foot, 0.0052, 0.0014, BAND, SPINE, undefined, 6),
      );
    }
  // The third maxillipeds under the head, folded forward.
  for (const side of [-1, 1])
    parts.push(
      limb(
        v(side * 0.012, 0.035, 0.17),
        v(side * 0.016, 0.02, 0.225),
        0.005,
        0.003,
        LEG,
      ),
    );
  return merged(parts);
}
