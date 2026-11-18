import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/**
 * v0.6 Pass 053 (visual consistency): the kelp forest's sea star and urchin, rebuilt from a flat
 * extruded star and a sparse spiky ball. Same contracts as before (lying on y 0, about 0.22 m and
 * 0.3 m across), and still tinted per instance: their vertex colours are light, carrying only the
 * pattern, so `setColorAt` gives each its colour.
 *   - sea star: an ochre-style star: a domed central disc and five thick, rounded arms that taper
 *     and curl a little, their upper surface a net of raised pale knobs (the spines' reticulation),
 *     the arm tips lifted;
 *   - urchin: a domed test with banded ambulacra and a dense coat of tapering spines of mixed
 *     lengths, longer round the equator, pale-tipped.
 */
function shaded(
  g: THREE.BufferGeometry,
  tone: (p: THREE.Vector3) => number,
): THREE.BufferGeometry {
  // Every part needs the same attributes to merge: normals for those built without them.
  if (!g.getAttribute('normal')) g.computeVertexNormals();
  const out = g.index ? g.toNonIndexed() : g;
  if (out !== g) g.dispose();
  for (const name of Object.keys(out.attributes))
    if (name !== 'position' && name !== 'normal') out.deleteAttribute(name);
  const p = out.getAttribute('position'),
    c = new Float32Array(p.count * 3),
    v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.set(p.getX(i), p.getY(i), p.getZ(i));
    const k = tone(v);
    c[i * 3] = c[i * 3 + 1] = c[i * 3 + 2] = k;
  }
  out.setAttribute('color', new THREE.Float32BufferAttribute(c, 3));
  return out;
}
function merge(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const m = mergeGeometries(parts, false);
  parts.forEach((g) => g.dispose());
  if (!m) throw Error('Kelp shape could not be built');
  m.computeVertexNormals();
  return m;
}

/** A sea star lying on y 0, about 0.22 m across. */
export function seaStarShape(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  // The disc: a low dome.
  const disc = new THREE.SphereGeometry(
    1,
    20,
    8,
    0,
    Math.PI * 2,
    0,
    Math.PI / 2,
  );
  disc.scale(0.034, 0.02, 0.034);
  parts.push(shaded(disc, () => 0.85));
  // Five arms: tubes along a gently curling path, round above and flatter below, tapering.
  for (let a = 0; a < 5; a++) {
    const base = (a / 5) * Math.PI * 2 + 0.3,
      curl = 0.25 * Math.sin(a * 2.3),
      steps = 10,
      around = 10,
      pos: number[] = [],
      idx: number[] = [];
    for (let i = 0; i <= steps; i++) {
      const u = i / steps,
        ang = base + curl * u * u,
        r = 0.02 + u * 0.09,
        cx = Math.cos(ang) * r,
        cz = Math.sin(ang) * r,
        width = 0.021 * (1 - 0.75 * u) + 0.003,
        height = 0.017 * (1 - 0.7 * u) + 0.003,
        lift = 0.004 + 0.012 * u * u * u,
        nx = -Math.sin(ang),
        nz = Math.cos(ang);
      for (let j = 0; j <= around; j++) {
        const t = (j / around) * Math.PI * 2,
          s = Math.cos(t),
          up = Math.sin(t),
          // Flatter underneath, where it grips the rock.
          y = up > 0 ? up * height : up * height * 0.3;
        pos.push(
          cx + nx * s * width,
          lift + y + height * 0.3,
          cz + nz * s * width,
        );
      }
    }
    for (let i = 0; i < steps; i++)
      for (let j = 0; j < around; j++) {
        const p0 = i * (around + 1) + j,
          p1 = p0 + around + 1;
        idx.push(p0, p0 + 1, p1, p0 + 1, p1 + 1, p1);
      }
    const arm = new THREE.BufferGeometry();
    arm.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    arm.setIndex(idx);
    parts.push(shaded(arm, () => 0.82));
    // A rounded tip.
    const tipAng = base + curl,
      tip = new THREE.SphereGeometry(0.0045, 6, 4);
    tip.translate(
      Math.cos(tipAng) * 0.111,
      0.004 + 0.012 + 0.005,
      Math.sin(tipAng) * 0.111,
    );
    parts.push(shaded(tip, () => 0.8));
    // The net of raised pale knobs along the arm's top.
    for (let k = 0; k < 14; k++) {
      const u = 0.08 + (k / 14) * 0.85,
        ang = base + curl * u * u,
        r = 0.02 + u * 0.09,
        side = ((k % 3) - 1) * 0.55,
        width = 0.021 * (1 - 0.75 * u) + 0.003,
        height = 0.017 * (1 - 0.7 * u) + 0.003,
        lift = 0.004 + 0.012 * u * u * u,
        knob = new THREE.SphereGeometry(0.0028 * (1 - 0.5 * u) + 0.0012, 5, 3);
      knob.translate(
        Math.cos(ang) * r - Math.sin(ang) * side * width,
        lift + height * (1.3 - 0.4 * Math.abs(side)),
        Math.sin(ang) * r + Math.cos(ang) * side * width,
      );
      parts.push(shaded(knob, () => 1));
    }
  }
  // A ring of knobs round the disc.
  for (let k = 0; k < 10; k++) {
    const a = (k / 10) * Math.PI * 2,
      knob = new THREE.SphereGeometry(0.003, 5, 3);
    knob.translate(Math.cos(a) * 0.022, 0.019, Math.sin(a) * 0.022);
    parts.push(shaded(knob, () => 1));
  }
  return merge(parts);
}

/** A purple urchin on y 0, about 0.3 m across its spines. */
export function urchinShape(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  // The test: a domed sphere with five paler ambulacral bands from top to bottom.
  const test = new THREE.SphereGeometry(0.06, 24, 14);
  test.scale(1, 0.72, 1);
  test.translate(0, 0.04, 0);
  parts.push(
    shaded(test, (p) => {
      const a = Math.atan2(p.z, p.x);
      return 0.55 + 0.2 * Math.max(0, Math.cos(a * 5)) ** 4;
    }),
  );
  // Spines: a dense, even coat (a Fibonacci sphere), longer round the equator, none underneath.
  const n = 150,
    up = new THREE.Vector3(0, 1, 0),
    d = new THREE.Vector3(),
    q = new THREE.Quaternion();
  for (let i = 0; i < n; i++) {
    const y = 1 - (i / (n - 1)) * 1.6,
      r = Math.sqrt(Math.max(0, 1 - y * y)),
      a = i * 2.39996;
    d.set(Math.cos(a) * r, y, Math.sin(a) * r).normalize();
    if (d.y < -0.45) continue;
    const len = 0.07 + 0.05 * (1 - Math.abs(d.y)) + 0.015 * Math.sin(i * 7.1),
      spine = new THREE.ConeGeometry(0.0045, len, 4);
    spine.translate(0, len / 2 + 0.05, 0);
    q.setFromUnitVectors(up, d);
    spine.applyQuaternion(q);
    spine.scale(1, 0.72, 1);
    spine.translate(0, 0.04, 0);
    // Pale tips: brighter towards the end of each spine.
    parts.push(
      shaded(spine, (p) => {
        const out = Math.hypot(p.x, (p.y - 0.04) / 0.72, p.z);
        return 0.6 + 0.4 * Math.min(1, Math.max(0, (out - 0.08) / 0.07));
      }),
    );
  }
  return merge(parts);
}
