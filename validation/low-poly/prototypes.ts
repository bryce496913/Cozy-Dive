/** Inspection-only models. No roster registration or production scene imports. */
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import {
  addPose,
  colorRegions,
  fin,
  forkedBranch,
  mirrored,
  polyhedron,
  profileBody,
  taperedCurve,
} from '../../src/geometry/lowPoly/geometry';
import { LowPolyResources } from '../../src/rendering/lowPoly/resources';
import type { MaterialRole } from '../../src/rendering/lowPoly/resources';
import { creatureStroke } from '../../src/environment/creatureStroke';

export const prototypeIds = ['fish', 'ray', 'coral', 'rock', 'plant'] as const;
export type PrototypeId = (typeof prototypeIds)[number];
const palette = {
  fish: ['#318f91', '#a2d4b9', '#155969', '#172f32'],
  ray: ['#41677a', '#bbc9ba', '#294958'],
  coral: ['#c76e59', '#e4a379', '#9e4e47'],
  rock: ['#6d8176', '#97a391', '#536960'],
  plant: ['#4b8764', '#8cae65', '#315a48'],
};
const roles: Record<PrototypeId, MaterialRole> = {
  fish: 'body',
  ray: 'body',
  coral: 'coral',
  rock: 'rock',
  plant: 'plant',
};
function combine(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
  for (const p of parts) p.deleteAttribute('uv');
  const result = mergeGeometries(parts);
  parts.forEach((p) => p.dispose());
  if (!result) throw Error('Prototype attributes disagree');
  return result;
}
function shape(id: PrototypeId): THREE.BufferGeometry {
  if (id === 'fish') {
    const body = profileBody([
      { x: -1, width: 0.025, height: 0.08 },
      { x: -0.65, width: 0.09, height: 0.13 },
      { x: -0.15, width: 0.25, height: 0.4, lowerHeight: 0.3 },
      { x: 0.4, width: 0.25, height: 0.35, lowerHeight: 0.25 },
      { x: 0.72, width: 0.14, height: 0.19, lowerHeight: 0.16 },
      { x: 0.86, width: 0.035, height: 0.075 },
    ]);
    const tail = fin(
      [
        [-0.94, 0],
        [-1.45, -0.35],
        [-1.29, 0],
        [-1.45, 0.35],
      ],
      [0.035, 0.008, 0.016, 0.008],
      1,
    );
    tail.rotateX(Math.PI / 2);
    const dorsal = fin(
      [
        [-0.65, 0],
        [-0.28, -0.28],
        [0.32, -0.17],
        [0.43, 0],
      ],
      [0.04, 0.008, 0.01, 0.04],
      1,
    );
    dorsal.rotateX(Math.PI / 2);
    dorsal.translate(0, 0.26, 0);
    const pectoral = fin(
      [
        [0.35, 0.14],
        [-0.2, 0.55],
        [-0.32, 0.25],
      ],
      [0.04, 0.008, 0.02],
      1,
    );
    pectoral.translate(0, -0.05, 0);
    const other = mirrored(pectoral, 'z');
    const eye = fin(
      [
        [0.62, 0.09],
        [0.66, 0.05],
        [0.7, 0.09],
        [0.66, 0.13],
      ],
      [0.008, 0.008, 0.008, 0.008],
    );
    eye.rotateX(-Math.PI / 2);
    eye.translate(0, 0, 0.177);
    const eyeOther = mirrored(eye, 'z');
    return combine([body, tail, dorsal, pectoral, other, eye, eyeOther]);
  }
  if (id === 'ray')
    return profileBody(
      [
        { x: -1.8, width: 0.018, height: 0.018 },
        { x: -0.7, width: 0.04, height: 0.035 },
        { x: -0.43, width: 0.45, height: 0.09, lowerHeight: 0.04 },
        { x: -0.12, width: 1.05, height: 0.11, lowerHeight: 0.05 },
        { x: 0.2, width: 0.74, height: 0.15, lowerHeight: 0.05 },
        { x: 0.55, width: 0.3, height: 0.1, lowerHeight: 0.04 },
        { x: 0.7, width: 0.12, height: 0.055, lowerHeight: 0.035 },
      ],
      12,
    );
  if (id === 'coral') return forkedBranch().rotateY(Math.PI / 2);
  if (id === 'rock')
    return polyhedron(
      [
        [-0.8, -0.3, -0.5],
        [0.6, -0.3, -0.6],
        [0.85, -0.3, 0.35],
        [-0.7, -0.3, 0.55],
        [-0.65, 0.3, -0.35],
        [0.2, 0.6, -0.4],
        [0.65, 0.25, 0.3],
        [-0.35, 0.5, 0.45],
      ],
      27,
    );
  const parts = [
    taperedCurve(
      [
        [0, 0, 0],
        [0.02, 0.4, 0],
        [-0.04, 0.9, 0.01],
        [0.08, 1.4, 0],
      ],
      [0.035, 0.03, 0.022, 0.008],
    ),
  ];
  for (let i = 0; i < 5; i++) {
    const leaf = fin(
      [
        [0, 0],
        [0.2, -0.13],
        [0.65, -0.12],
        [0.95, 0],
        [0.6, 0.12],
        [0.2, 0.1],
      ],
      [0.03, 0.025, 0.012, 0.004, 0.012, 0.025],
      1,
    );
    leaf.rotateZ(0.45);
    leaf.rotateY(i * 2.4);
    leaf.translate(0, 0.18 + i * 0.22, 0);
    parts.push(leaf);
  }
  return combine(parts);
}
export function prototypeGeometry(id: PrototypeId): THREE.BufferGeometry {
  const raw = shape(id);
  const geometry = colorRegions(raw, palette[id], (p) => {
    if (
      id === 'fish' &&
      p.x > 0.61 &&
      p.x < 0.71 &&
      p.y > 0.04 &&
      p.y < 0.14 &&
      Math.abs(p.z) > 0.17
    )
      return 3;
    if (id === 'fish' || id === 'ray')
      return p.y < -0.03 ? 1 : p.y > 0.18 ? 2 : 0;
    if (id === 'coral') return p.y > 1.3 ? 1 : p.y < 0.3 ? 2 : 0;
    if (id === 'plant') return p.y > 1 ? 1 : p.y < 0.25 ? 2 : 0;
    return p.y > 0.25 ? 1 : p.y < 0 ? 2 : 0;
  });
  raw.dispose();
  if (id !== 'rock' && id !== 'coral')
    for (const sign of [-1, 1])
      addPose(
        geometry,
        sign === 1 ? 'Stroke_Left' : 'Stroke_Right',
        (p, out) => {
          if (id === 'fish')
            out.z += sign * 0.23 * Math.pow(Math.max(0, 0.5 - p.x) / 1.95, 2);
          if (id === 'ray') {
            out.y += sign * 0.25 * p.z * p.z;
            out.z += sign * 0.1 * Math.max(0, -p.x - 0.4);
          }
          if (id === 'plant') out.x += sign * 0.12 * p.y * p.y;
        },
      );
  return geometry;
}
export function createPrototype(resources: LowPolyResources, id: PrototypeId) {
  const geometry = resources.geometry(`inspection:${id}:v1`, () =>
    prototypeGeometry(id),
  );
  const material = resources.material({ role: roles[id], vertexColors: true });
  const mesh = new THREE.Mesh(geometry.value, material.value);
  const left = mesh.morphTargetDictionary?.Stroke_Left,
    right = mesh.morphTargetDictionary?.Stroke_Right;
  let disposed = false;
  return {
    mesh,
    update(time: number, reducedMotion = false) {
      if (left !== undefined && right !== undefined)
        creatureStroke(
          mesh,
          { left, right },
          reducedMotion
            ? 0
            : Math.sin(time * (id === 'plant' ? 0.6 : 1.7)) * 0.8,
        );
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      mesh.removeFromParent();
      geometry.release();
      material.release();
    },
  };
}
