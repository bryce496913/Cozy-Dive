import * as THREE from 'three';
import { smoothed } from '../shared/organicGeometry';
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
 *     lengths, longer round the equator, paler-tipped. Unlike the star, it carries its own purple:
 *     the dressing's instance tint is near white and only varies it.
 */
type RGB = readonly [number, number, number];
const WHITE: RGB = [1, 1, 1];
/** Vertex colours: `base` scaled by `tone` at each vertex. */
function shaded(
  g: THREE.BufferGeometry,
  tone: (p: THREE.Vector3) => number,
  base: RGB = WHITE,
): THREE.BufferGeometry {
  // V0.7 Pass 068: creased normals (smooth across gentle bends), kept through the merge.
  const out = smoothed(g);
  const p = out.getAttribute('position'),
    c = new Float32Array(p.count * 3),
    v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.set(p.getX(i), p.getY(i), p.getZ(i));
    const k = tone(v);
    c[i * 3] = Math.min(1, base[0] * k);
    c[i * 3 + 1] = Math.min(1, base[1] * k);
    c[i * 3 + 2] = Math.min(1, base[2] * k);
  }
  out.setAttribute('color', new THREE.Float32BufferAttribute(c, 3));
  return out;
}
function merge(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const m = mergeGeometries(parts, false);
  parts.forEach((g) => g.dispose());
  if (!m) throw Error('Kelp shape could not be built');
  return m;
}

/** A sea star lying on y 0, about 0.22 m across. */
export function seaStarShape(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  // The disc: a low dome.
  const disc = new THREE.SphereGeometry(
    1,
    12,
    4,
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
      steps = 8,
      around = 8,
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
      tip = new THREE.SphereGeometry(0.0045, 5, 3);
    tip.translate(
      Math.cos(tipAng) * 0.111,
      0.004 + 0.012 + 0.005,
      Math.sin(tipAng) * 0.111,
    );
    parts.push(shaded(tip, () => 0.8));
    // The net of raised pale knobs along the arm's top.
    for (let k = 0; k < 8; k++) {
      const u = 0.08 + (k / 8) * 0.85,
        ang = base + curl * u * u,
        r = 0.02 + u * 0.09,
        side = ((k % 3) - 1) * 0.55,
        width = 0.021 * (1 - 0.75 * u) + 0.003,
        height = 0.017 * (1 - 0.7 * u) + 0.003,
        lift = 0.004 + 0.012 * u * u * u,
        knob = new THREE.SphereGeometry(0.0032 * (1 - 0.5 * u) + 0.0014, 4, 2);
      knob.translate(
        Math.cos(ang) * r - Math.sin(ang) * side * width,
        lift + height * (1.3 - 0.4 * Math.abs(side)),
        Math.sin(ang) * r + Math.cos(ang) * side * width,
      );
      parts.push(shaded(knob, () => 1));
    }
  }
  // A ring of knobs round the disc.
  for (let k = 0; k < 5; k++) {
    const a = (k / 5) * Math.PI * 2 + 0.93,
      knob = new THREE.SphereGeometry(0.0034, 4, 2);
    knob.translate(Math.cos(a) * 0.022, 0.019, Math.sin(a) * 0.022);
    parts.push(shaded(knob, () => 1));
  }
  return merge(parts);
}

/** The urchin's own purple (the instance tint only varies it slightly), as before Pass 053. */
const TEST: RGB = [0.2, 0.06, 0.22],
  SPINE: RGB = [0.32, 0.12, 0.38];
/** A purple urchin on y 0, about 0.3 m across its spines. */
export function urchinShape(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  // The test: a domed sphere with five paler ambulacral bands from top to bottom.
  const test = new THREE.SphereGeometry(0.06, 14, 9);
  test.scale(1, 0.72, 1);
  test.translate(0, 0.04, 0);
  parts.push(
    shaded(
      test,
      (p) => {
        const a = Math.atan2(p.z, p.x);
        return 1 + 0.6 * Math.max(0, Math.cos(a * 5)) ** 4;
      },
      TEST,
    ),
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
      // Open-ended: the base sits inside the test.
      spine = new THREE.ConeGeometry(0.0045, len, 6, 1, true);
    spine.translate(0, len / 2 + 0.05, 0);
    q.setFromUnitVectors(up, d);
    spine.applyQuaternion(q);
    spine.scale(1, 0.72, 1);
    spine.translate(0, 0.04, 0);
    // Pale tips: brighter towards the end of each spine.
    parts.push(
      shaded(
        spine,
        (p) => {
          const out = Math.hypot(p.x, (p.y - 0.04) / 0.72, p.z);
          return 1 + 0.9 * Math.min(1, Math.max(0, (out - 0.08) / 0.07));
        },
        SPINE,
      ),
    );
  }
  return merge(parts);
}
