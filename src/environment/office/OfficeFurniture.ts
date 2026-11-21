import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { organicTube } from '../shared/organicGeometry';

/**
 * V0.7 Pass 079: modelled forms for the office furniture, replacing plain boxes and poles. Each
 * builder returns indexed geometry with normals in its own local frame, ready for the office
 * batcher (which bakes position, colour and box-projected UVs). Pure and allocation-light; no
 * new materials or draws.
 */

const smooth = (a: number, b: number, x: number): number => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/**
 * A rounded box with subdivided faces (unlike `RoundedBoxGeometry`, whose flat faces have no
 * interior vertices), so it can be dished, bent and swelled smoothly. Indexed, with normals.
 */
export function softBox(
  w: number,
  h: number,
  d: number,
  r: number,
  segments = 10,
): THREE.BufferGeometry {
  const g = new THREE.BoxGeometry(
      w,
      h,
      d,
      segments,
      Math.max(2, Math.round((segments * h) / Math.max(w, d))),
      segments,
    ),
    p = g.getAttribute('position'),
    ix = w / 2 - r,
    iy = h / 2 - r,
    iz = d / 2 - r,
    c = new THREE.Vector3(),
    v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    c.set(
      Math.max(-ix, Math.min(ix, v.x)),
      Math.max(-iy, Math.min(iy, v.y)),
      Math.max(-iz, Math.min(iz, v.z)),
    );
    v.sub(c);
    if (v.lengthSq() > 1e-12) v.setLength(r);
    p.setXYZ(i, c.x + v.x, c.y + v.y, c.z + v.z);
  }
  g.deleteAttribute('uv');
  const merged = mergeVertices(g, 1e-6);
  g.dispose();
  merged.computeVertexNormals();
  return merged;
}

/**
 * An upholstered cushion `w` x `h` x `d` (front edge at -z): its top dished toward the middle
 * where it is sat on, and rolled down over the front edge (a "waterfall" seat).
 */
export function contouredCushion(
  w: number,
  h: number,
  d: number,
  dish = 0.012,
  waterfall = 0.02,
): THREE.BufferGeometry {
  const g = softBox(w, h, d, Math.min(h * 0.45, 0.03), 12),
    p = g.getAttribute('position');
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i),
      y = p.getY(i),
      z = p.getZ(i),
      top = smooth(-h * 0.1, h * 0.5, y),
      u = (2 * x) / w,
      v = (2 * z) / d,
      sink = dish * Math.max(0, 1 - u * u) * Math.max(0, 1 - v * v) * top,
      roll = waterfall * smooth(0.45, 1, -v) * top;
    p.setY(i, y - sink - roll);
  }
  g.computeVertexNormals();
  return g;
}

/**
 * A curved back shell `w` x `h` x `t`: bent round the sitter (its sides come forward, toward -z)
 * with a lumbar swell low down and a slightly narrower top.
 */
export function backShell(
  w: number,
  h: number,
  t: number,
  bend = 0.04,
  lumbar = 0.012,
): THREE.BufferGeometry {
  const g = softBox(w, h, t, Math.min(t * 0.45, 0.03), 12),
    p = g.getAttribute('position');
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i),
      y = p.getY(i),
      z = p.getZ(i),
      u = (2 * x) / w,
      taper = 1 - 0.08 * smooth(-0.1, 0.5, y / h);
    p.setXYZ(
      i,
      x * taper,
      y,
      z -
        bend * u * u -
        lumbar * Math.exp(-(((y + h * 0.18) / (h * 0.22)) ** 2)),
    );
  }
  g.computeVertexNormals();
  return g;
}

/** A spoke `length` long along +x from the hub, tapering and dipping toward its tip. */
export function taperedSpoke(
  length: number,
  width: number,
  height: number,
): THREE.BufferGeometry {
  const g = new RoundedBoxGeometry(length, height, width, 2, height * 0.45),
    p = g.getAttribute('position');
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i) + length / 2,
      t = x / length,
      k = 1 - 0.45 * t;
    p.setXYZ(i, x, p.getY(i) * k - 0.012 * t * t, p.getZ(i) * k);
  }
  g.computeVertexNormals();
  return g;
}

/** A twin-wheel caster: two wheels on an axle along x, under a small hood. Floor contact at y 0. */
export function twinCaster(radius = 0.028): THREE.BufferGeometry[] {
  const parts: THREE.BufferGeometry[] = [];
  for (const s of [-1, 1]) {
    const wheel = new THREE.CylinderGeometry(radius, radius, radius * 0.55, 12);
    wheel.rotateZ(Math.PI / 2);
    wheel.translate(s * radius * 0.4, radius, 0);
    parts.push(wheel);
  }
  const hood = new THREE.SphereGeometry(
    radius * 0.75,
    12,
    6,
    0,
    Math.PI * 2,
    0,
    Math.PI / 2,
  );
  hood.scale(1, 0.8, 1.15);
  hood.translate(0, radius * 1.35, 0);
  parts.push(hood);
  return parts;
}

/** A round tube through `points` (bent steel), with normals. */
export function bentTube(
  points: readonly THREE.Vector3[],
  radius: number,
  segments = 40,
  sides = 10,
): THREE.BufferGeometry {
  const g = organicTube(points, () => radius, segments, sides);
  g.computeVertexNormals();
  return g;
}

/** A square leg `h` tall, tapering from `w0` at the top to `w1` at the foot (origin at the foot). */
export function taperedLeg(
  h: number,
  w0: number,
  w1: number,
): THREE.BufferGeometry {
  const g = new RoundedBoxGeometry(w0, h, w0, 2, Math.min(w1 * 0.3, 0.006)),
    p = g.getAttribute('position');
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i) + h / 2,
      k = (w1 + (w0 - w1) * (y / h)) / w0;
    p.setXYZ(i, p.getX(i) * k, y, p.getZ(i) * k);
  }
  g.computeVertexNormals();
  return g;
}

/**
 * A frame-and-panel door `w` x `h` (facing -x, its face at x 0): four rails round a recessed
 * panel. Returns [frame parts, panel] in door space (centre of the door at y 0, z 0).
 */
export function panelDoor(
  w: number,
  h: number,
  rail = 0.055,
  depth = 0.018,
): { frame: THREE.BufferGeometry[]; panel: THREE.BufferGeometry } {
  const frame: THREE.BufferGeometry[] = [];
  const box = (sy: number, sz: number, y: number, z: number) => {
    const g = new RoundedBoxGeometry(depth, sy, sz, 2, 0.004);
    g.translate(-depth / 2, y, z);
    return g;
  };
  frame.push(box(rail, w, h / 2 - rail / 2, 0));
  frame.push(box(rail, w, -h / 2 + rail / 2, 0));
  frame.push(box(h - rail * 2, rail, 0, w / 2 - rail / 2));
  frame.push(box(h - rail * 2, rail, 0, -w / 2 + rail / 2));
  // The panel sits back from the rails, with a small raised field in its middle.
  const panel = new RoundedBoxGeometry(
    depth * 0.45,
    h - rail * 2,
    w - rail * 2,
    2,
    0.003,
  );
  panel.translate(-depth * 0.225, 0, 0);
  return { frame, panel };
}
