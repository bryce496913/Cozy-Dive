import * as THREE from 'three';
import { organicTube, smoothed } from '../shared/organicGeometry';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/**
 * v0.6 Pass 053 (visual consistency): the small drifting life under the ice, rebuilt from capsules
 * and discs into readable animals at their small size. Each stays light (the krill are drawn 520
 * times), vertex-coloured, with the same facing and scale as before.
 *   - krill: a curved, segmented shrimp: carapace, five tapering abdominal segments bent down, a
 *     fanned tail, big stalked black eyes, long antennae and a fringe of swimming legs;
 *   - sea butterfly: a coiled, glassy shell with a dark gut showing through, and two broad, veined
 *     wing-lobes held up and out;
 *   - comb jelly: a clear lobed oval with eight iridescent comb rows (bands of tiny combs, not
 *     smooth rings), a pale mouth and two trailing tentacles.
 */
type RGB = readonly [number, number, number];
function paint(g: THREE.BufferGeometry, c: RGB): THREE.BufferGeometry {
  // V0.7 Pass 068: creased normals (smooth across gentle bends), kept through the merge.
  const out = smoothed(g);
  const n = out.getAttribute('position').count,
    col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) col.set(c, i * 3);
  out.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  return out;
}
function merge(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const g = mergeGeometries(parts, false);
  parts.forEach((p) => p.dispose());
  if (!g) throw Error('Ice critter could not be built');
  return g;
}
function stick(
  a: THREE.Vector3,
  b: THREE.Vector3,
  r: number,
  c: RGB,
  sides = 3,
) {
  const d = b.clone().sub(a),
    g = new THREE.CylinderGeometry(r * 0.4, r, d.length(), sides, 1);
  g.translate(0, d.length() / 2, 0);
  g.applyQuaternion(
    new THREE.Quaternion().setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      d.normalize(),
    ),
  );
  g.translate(a.x, a.y, a.z);
  return paint(g, c);
}
const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

/** A krill facing +z, about 4 cm long. */
export function krillShape(): THREE.BufferGeometry {
  const pink: RGB = [0.95, 0.45, 0.4],
    clear: RGB = [0.98, 0.7, 0.62],
    parts: THREE.BufferGeometry[] = [];
  const shell = new THREE.SphereGeometry(1, 6, 4);
  shell.scale(0.0045, 0.0045, 0.009);
  shell.translate(0, 0.001, 0.011);
  parts.push(paint(shell, pink));
  // Five abdominal segments, tapering and bending gently down.
  for (let i = 0; i < 5; i++) {
    const seg = new THREE.SphereGeometry(1, 5, 4),
      r = 0.0042 - i * 0.0005;
    seg.scale(r, r, 0.0042);
    seg.translate(0, -i * i * 0.0004, -0.002 - i * 0.0055);
    parts.push(paint(seg, i % 2 ? clear : pink));
  }
  // A fanned tail.
  for (const a of [-0.45, 0, 0.45]) {
    const fin = new THREE.ConeGeometry(0.0022, 0.007, 3);
    fin.rotateX(-Math.PI / 2);
    fin.scale(1, 0.3, 1);
    fin.rotateY(a);
    fin.translate(0, -0.007, -0.029);
    parts.push(paint(fin, clear));
  }
  for (const s of [-1, 1]) {
    // Big stalked black eyes.
    const eye = new THREE.SphereGeometry(0.0022, 4, 3);
    eye.translate(s * 0.0035, 0.0022, 0.019);
    parts.push(paint(eye, [0.03, 0.02, 0.02]));
    // Long antennae.
    parts.push(
      stick(
        v(s * 0.0015, 0.001, 0.02),
        v(s * 0.007, 0.004, 0.045),
        0.0005,
        pink,
      ),
    );
  }
  // A fringe of swimming legs under the thorax.
  for (let k = 0; k < 3; k++)
    for (const s of [-1, 1])
      parts.push(
        stick(
          v(s * 0.0015, -0.003, 0.012 - k * 0.0045),
          v(s * 0.004, -0.008, 0.01 - k * 0.0045),
          0.0006,
          clear,
        ),
      );
  return merge(parts);
}

/** A sea butterfly, about 1 cm, wings out to the sides (x). */
export function seaButterflyShape(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  // V0.7 Pass 068: a small coiled shell as one tapering spiral, not a string of beads.
  const coil: THREE.Vector3[] = [];
  for (let k = 0; k <= 8; k++) {
    const a = k * 0.9;
    coil.push(
      v(
        Math.cos(a) * 0.0018 * (1 - k * 0.06),
        -0.001 - k * 0.0007,
        Math.sin(a) * 0.0018 * (1 - k * 0.06),
      ),
    );
  }
  parts.push(
    paint(
      organicTube(coil, (u) => 0.0029 * (1 - 0.7 * u), 28, 9),
      [0.88, 0.9, 0.86],
    ),
  );
  // Two broad wing-lobes, held up and out, cupped and frilled at the rim, with a darker midrib.
  for (const s of [-1, 1]) {
    // A thin fleshy lobe (both faces shade), tipped up and out, gently cupped.
    const wing = new THREE.SphereGeometry(1, 16, 8),
      wp = wing.getAttribute('position');
    for (let i = 0; i < wp.count; i++) {
      const x = wp.getX(i),
        y = wp.getY(i),
        z = wp.getZ(i);
      wp.setXYZ(i, x * 0.0075, y * 0.0047, z * 0.0009 + 0.0015 * x * x);
    }
    wing.rotateZ(s * 0.35);
    wing.translate(s * 0.0072, 0.0035, 0);
    parts.push(paint(wing, [0.98, 0.62, 0.3]));
    parts.push(
      stick(
        v(s * 0.001, 0.0035, 0),
        v(s * 0.0085, 0.006, 0),
        0.0004,
        [0.85, 0.42, 0.18],
        5,
      ),
    );
  }
  return merge(parts);
}

/** A comb jelly, about 5 cm tall. */
export function combJellyShape(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  // The body: a clear oval, slightly lobed.
  const body = new THREE.SphereGeometry(0.025, 18, 14),
    bp = body.getAttribute('position');
  for (let i = 0; i < bp.count; i++) {
    const a = Math.atan2(bp.getZ(i), bp.getX(i)),
      lobe = 1 + 0.05 * Math.cos(a * 4);
    bp.setXYZ(i, bp.getX(i) * lobe, bp.getY(i) * 1.35, bp.getZ(i) * lobe);
  }
  parts.push(paint(body, [0.85, 0.92, 0.95]));
  // Eight comb rows: bands of tiny combs from pole to pole, alternating bright colours.
  const hues: RGB[] = [
    [0.6, 0.95, 1],
    [1, 0.7, 0.95],
    [0.75, 1, 0.75],
    [1, 0.95, 0.6],
  ];
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2 + Math.PI / 8;
    for (let j = 0; j < 9; j++) {
      const t = -0.8 + (j / 8) * 1.6,
        y = Math.sin(t) * 0.025 * 1.35,
        r = Math.cos(t) * 0.0262,
        comb = new THREE.BoxGeometry(0.0055, 0.0011, 0.0012);
      comb.rotateY(-a);
      comb.translate(Math.cos(a) * r, y, Math.sin(a) * r);
      parts.push(paint(comb, hues[(k + j) % hues.length]));
    }
  }
  // A pale mouth below, and two trailing tentacles.
  const mouth = new THREE.SphereGeometry(0.004, 6, 4);
  mouth.translate(0, -0.032, 0);
  parts.push(paint(mouth, [0.95, 0.85, 0.8]));
  for (const s of [-1, 1])
    parts.push(
      stick(
        v(s * 0.012, -0.01, 0),
        v(s * 0.02, -0.07, 0.01),
        0.0008,
        [0.95, 0.75, 0.8],
      ),
    );
  return merge(parts);
}
