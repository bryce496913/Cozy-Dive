import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/**
 * v0.6 Pass 052 (playtest: "the cave is very broken"): the octopus's den, rebuilt as one solid,
 * closed rock mound rather than an open shell. A lumpy dome of reef rock sits behind the den's
 * mouth (the mouth faces +z at the origin); its front is hollowed into a deep, dark pocket the
 * octopus backs into, and a ring of boulders sits on the mound (each seated on its surface, none
 * floating). The bottom sinks a little into the sand so no edge shows. Unit size: about 1.1 m
 * wide, 0.65 m high, the pocket about 0.5 m deep. Vertex colours: rock, darker low down, near
 * black inside the pocket.
 */
export const OCTOPUS_DEN = {
  /** Mound half-extents (m) and how far behind the mouth its middle sits. */
  width: 0.58,
  height: 0.62,
  length: 0.62,
  behind: 0.42,
  /** The pocket: half-width and height of its mouth, and how deep it goes (m). */
  mouth: { half: 0.24, high: 0.22, deep: 0.5 },
  boulders: 9,
} as const;

/** Smooth step from 0 at `a` to 1 at `b`. */
const step = (a: number, b: number, x: number): number => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
/** Cheap, deterministic lumpiness (a few sines), in about [-1, 1]. */
const lumps = (x: number, y: number, z: number): number =>
  0.5 * Math.sin(x * 7.1 + z * 3.3) * Math.sin(y * 6.3 + x * 2.1) +
  0.3 * Math.sin(x * 15.7 - y * 11.3 + z * 9.1) +
  0.2 * Math.sin(z * 23.1 + y * 17.9);

function colourise(
  g: THREE.BufferGeometry,
  /** Brightness by height (m). */
  shade: (y: number) => number,
): THREE.BufferGeometry {
  const p = g.getAttribute('position'),
    c = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i),
      y = p.getY(i),
      z = p.getZ(i),
      v = shade(y),
      speck = 0.92 + 0.08 * Math.sin(x * 71 + y * 53) * Math.sin(z * 67);
    // Warm grey-brown reef rock.
    c[i * 3] = v * speck * 1.0;
    c[i * 3 + 1] = v * speck * 0.93;
    c[i * 3 + 2] = v * speck * 0.84;
  }
  g.setAttribute('color', new THREE.Float32BufferAttribute(c, 3));
  return g;
}

/**
 * `skirt` (unit metres) lets the mound reach down below its pocket's floor to the ground, for a
 * den set up on a wall (the cave's moray crack); 0 sits it on the sand as usual.
 */
export function octopusDenGeometry(skirt = 0): THREE.BufferGeometry {
  const { width, height, length, behind, mouth } = OCTOPUS_DEN;
  // The mound: a lumpy dome, hollowed at the front into the pocket.
  const mound = new THREE.SphereGeometry(1, 40, 24);
  const p = mound.getAttribute('position'),
    pocket = new Float32Array(p.count);
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i),
      y = p.getY(i),
      z = p.getZ(i);
    const n = lumps(x, y, z);
    // Squash into a low dome; the lower half is pressed flat into the sand.
    x *= width * (1 + 0.1 * n);
    z *= length * (1 + 0.1 * n);
    y =
      y > 0 ? y * height * (1 + 0.12 * n) : y * (0.06 + skirt * (1 + 0.15 * n));
    z -= behind;
    // The pocket: the front face, low down, pushed back into the mound and narrowing inside.
    const across = 1 - step(mouth.half * 0.55, mouth.half * 1.25, Math.abs(x)),
      up = 1 - step(mouth.high * 0.7, mouth.high * 1.45, y),
      front = step(-behind - 0.05, -behind + length * 0.75, z),
      k = across * up * front;
    if (k > 0) {
      const into = mouth.deep * k;
      z -= into;
      // Its walls close in a little towards the back, and the floor stays on the sand.
      x *= 1 - 0.25 * k;
      y = Math.max(0.005, y * (1 - 0.15 * k));
    }
    pocket[i] = k;
    p.setXYZ(i, x, Math.max(-0.04 - skirt * 1.2, y), z);
  }
  mound.computeVertexNormals();
  colourise(mound, (y) => 0.62 + 0.38 * step(0, 0.5, y));
  // Darken the pocket, nearly black at the back.
  const c = mound.getAttribute('color');
  for (let i = 0; i < c.count; i++) {
    const dark = 1 - 0.93 * step(0.05, 0.6, pocket[i]);
    c.setXYZ(i, c.getX(i) * dark, c.getY(i) * dark, c.getZ(i) * dark);
  }
  mound.deleteAttribute('uv');
  const parts: THREE.BufferGeometry[] = [mound.toNonIndexed()];
  mound.dispose();
  // Boulders seated on the mound's surface round the mouth and over the top.
  for (let b = 0; b < OCTOPUS_DEN.boulders; b++) {
    const a = -0.2 + (b / (OCTOPUS_DEN.boulders - 1)) * (Math.PI + 0.4),
      r = 0.09 + 0.05 * Math.abs(Math.sin(b * 2.3)),
      rock = new THREE.IcosahedronGeometry(r, 1),
      rp = rock.getAttribute('position');
    for (let i = 0; i < rp.count; i++) {
      const x = rp.getX(i),
        y = rp.getY(i),
        z = rp.getZ(i),
        d = 1 + 0.18 * lumps(x * 6 + b, y * 6, z * 6);
      rp.setXYZ(i, x * d * 1.25, y * d * 0.8, z * d);
    }
    rock.rotateY(b * 1.9);
    // On the dome's surface: round the arch above the mouth, then back over the sides.
    const sx = Math.cos(a),
      sy = Math.sin(a) * 0.9 + 0.1,
      ex = sx * width * 0.92,
      ey = Math.max(r * 0.55, sy * height * 0.88),
      ez = -behind + length * 0.55 * (1 - Math.abs(sx) * 0.4) - 0.08 * (b % 3);
    rock.translate(ex, ey, ez);
    rock.computeVertexNormals();
    colourise(rock, (y) => 0.7 + 0.3 * step(0, 0.6, y));
    rock.deleteAttribute('uv');
    // (Icosahedra are already non-indexed, like the mound after conversion.)
    parts.push(rock);
  }
  const merged = mergeGeometries(parts);
  parts.forEach((g) => g.dispose());
  if (!merged) throw Error('Octopus den geometry could not be built');
  merged.computeBoundingSphere();
  return merged;
}
