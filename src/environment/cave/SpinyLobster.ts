import * as THREE from 'three';
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

/** A spine: a slim cone from `base` along `dir` (unit), `length` long. */
function spine(
  base: THREE.Vector3,
  dir: THREE.Vector3,
  length: number,
  radius: number,
): THREE.BufferGeometry {
  return limb(
    base,
    base.clone().addScaledVector(dir, length),
    radius,
    radius * 0.08,
    SPINE,
  );
}
/** A small pale spot, flush on the shell. */
function spot(at: THREE.Vector3, r: number): THREE.BufferGeometry {
  const g = new THREE.SphereGeometry(r, 6, 4);
  g.scale(1, 0.35, 1);
  g.translate(at.x, at.y, at.z);
  return tinted(g, SPOT);
}

export function spinyLobsterBody(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  // The carapace: a squarish tube, tapering a little forward, with a groove a third of the way back.
  const shell = new THREE.SphereGeometry(1, 28, 16),
    sp = shell.getAttribute('position');
  for (let i = 0; i < sp.count; i++) {
    const x = sp.getX(i),
      y = sp.getY(i),
      z = sp.getZ(i),
      // Squarer cross-section (flattened sides and top), slimmer forward.
      sq = (a: number) => Math.sign(a) * Math.abs(a) ** 0.75,
      taper = 1 - 0.18 * Math.max(0, z),
      groove = 1 - 0.07 * Math.exp(-(((z + 0.15) / 0.08) ** 2));
    sp.setXYZ(
      i,
      sq(x) * 0.058 * taper * groove,
      sq(y) * 0.05 * taper * groove,
      z * 0.125,
    );
  }
  shell.translate(0, 0.068, 0.075);
  parts.push(tinted(shell, SHELL));
  // Rows of forward-raked spines along its top and upper flanks, and pale spots between them.
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
        dir = v(side * 0.3, 0.85, 0.45).normalize();
      parts.push(
        spine(
          v(x, height - Math.abs(z - 0.08) * 0.1, z),
          dir,
          0.016 - row * 0.002,
          0.004,
        ),
      );
      if (k % 2 && row > 0)
        parts.push(spot(v(x * 0.85, height - 0.012, z + 0.012), 0.006));
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
  // The abdomen: six overlapping tergites, each grooved, spotted, with pointed pleura.
  for (let i = 0; i < 6; i++) {
    const z = -0.065 - i * 0.04,
      w = 0.056 - i * 0.004,
      h = 0.034 - i * 0.002,
      seg = new THREE.SphereGeometry(
        1,
        18,
        8,
        0,
        Math.PI * 2,
        0,
        Math.PI * 0.62,
      );
    seg.scale(w, h, 0.03);
    seg.translate(0, 0.036 - i * 0.002, z);
    parts.push(tinted(seg, i % 2 ? SHELL_LIGHT : SHELL));
    // The groove across it.
    const groove = new THREE.TorusGeometry(w * 0.92, 0.0025, 4, 18, Math.PI);
    groove.translate(0, 0.036 - i * 0.002, z + 0.004);
    parts.push(tinted(groove, SPINE));
    for (const side of [-1, 1]) {
      parts.push(
        spot(v(side * w * 0.45, 0.036 - i * 0.002 + h * 0.85, z), 0.007),
      );
      // A pleuron: a pointed plate curving down the side.
      const pl = new THREE.ConeGeometry(0.014, 0.034, 4);
      pl.scale(1, 1, 0.35);
      pl.rotateZ(side * (Math.PI - 0.35));
      pl.translate(side * (w + 0.004), 0.02 - i * 0.002, z);
      parts.push(tinted(pl, SHELL));
    }
  }
  // The tail fan: a rounded telson between two pairs of paddles, banded at their tips.
  const fan = (
    angle: number,
    length: number,
    width: number,
    centre: boolean,
  ) => {
    const g = new THREE.SphereGeometry(1, 14, 6);
    g.scale(width, 0.006, length);
    g.translate(0, 0, -length * 0.9);
    g.rotateY(angle);
    g.translate(0, 0.028, -0.29);
    parts.push(tinted(g, centre ? SHELL_LIGHT : SHELL));
    const tip = new THREE.SphereGeometry(1, 12, 4);
    tip.scale(width * 0.8, 0.005, length * 0.22);
    tip.translate(0, 0.0015, -length * 1.65);
    tip.rotateY(angle);
    tip.translate(0, 0.028, -0.29);
    parts.push(tinted(tip, SPOT));
  };
  fan(0, 0.04, 0.026, true);
  for (const side of [-1, 1]) {
    fan(side * 0.4, 0.045, 0.024, false);
    fan(side * 0.8, 0.042, 0.022, false);
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
