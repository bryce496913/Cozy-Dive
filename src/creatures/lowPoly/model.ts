import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import {
  addPose,
  colorRegions,
  fin,
  profileBody,
} from '../../geometry/lowPoly/geometry';
import { lowPolyMaterial } from '../../rendering/lowPoly/resources';
import type { LoadedAsset } from '../../assets/AssetValidation';
import { largeCreatureDesign, type LargeCreatureId } from './designs';

function sheet(
  points: readonly (readonly [number, number])[],
  thickness = 0.012,
) {
  return fin(
    points,
    points.map(() => thickness),
  );
}
function join(parts: THREE.BufferGeometry[]) {
  for (const p of parts) p.deleteAttribute('uv');
  const g = mergeGeometries(parts);
  parts.forEach((p) => p.dispose());
  if (!g) throw Error('Large-creature attributes mismatch');
  g.setAttribute(
    'uv',
    new THREE.BufferAttribute(
      new Float32Array(g.getAttribute('position').count * 2),
      2,
    ),
  );
  return g;
}

/** A species-authored silhouette in normalized coordinates. Appendages are joined into one
 * morphing surface because the existing controllers intentionally address Body as one Mesh. */
export function largeCreatureGeometry(
  id: LargeCreatureId,
): THREE.BufferGeometry {
  const d = largeCreatureDesign(id),
    parts: THREE.BufferGeometry[] = [];
  const upright = d.family === 'penguin' || d.family === 'bear';
  const sections = upright
    ? [
        { x: -0.46, width: 0.08, height: 0.08 },
        { x: -0.3, width: d.width * 0.72, height: d.depth * 0.72 },
        { x: -0.05, width: d.width, height: d.depth },
        { x: 0.2, width: d.width * 0.82, height: d.depth * 0.84 },
        { x: 0.39, width: d.width * 0.55, height: d.depth * 0.52 },
        { x: 0.5, width: 0.025, height: 0.025 },
      ]
    : [
        { x: -0.5, width: 0.018, height: 0.018 },
        { x: -0.34, width: d.width * 0.45, height: d.depth * 0.46 },
        { x: -0.12, width: d.width, height: d.depth },
        { x: 0.16, width: d.width * 0.94, height: d.depth * 0.9 },
        {
          x: 0.39,
          width: d.width * (0.55 + d.snout),
          height: d.depth * (0.48 + d.snout * 0.5),
        },
        {
          x: 0.5,
          width: Math.max(0.025, d.width * d.snout),
          height: Math.max(0.025, d.depth * d.snout),
        },
      ];
  parts.push(profileBody(sections, 8));

  if (d.family === 'ray') {
    const wing = sheet(
      [
        [-0.3, 0],
        [-0.08, d.appendage],
        [0.24, d.appendage * 0.72],
        [0.42, 0.08],
        [0.24, 0.03],
        [-0.15, 0.025],
      ],
      0.018,
    );
    parts.push(wing);
    const tail = sheet(
      [
        [-0.32, 0.018],
        [-0.5, 0.015],
        [-0.5 - d.tail, 0],
        [-0.34, -0.018],
      ],
      0.01,
    );
    parts.push(tail);
  } else if (d.family === 'turtle') {
    for (const side of [-1, 1]) {
      const f = sheet(
        [
          [0.22, 0.04],
          [0.05, side * d.appendage],
          [-0.18, side * d.appendage * 0.72],
          [-0.1, 0.05],
        ],
        0.018,
      );
      parts.push(f);
    }
    const shell = profileBody(
      [
        { x: -0.3, width: d.width * 1.05, height: d.depth * 0.7 },
        { x: 0.23, width: d.width, height: d.depth * 0.72 },
      ],
      8,
    );
    parts.push(shell);
  } else if (d.family === 'sunfish') {
    for (const side of [-1, 1]) {
      const f = sheet(
        [
          [-0.15, 0],
          [-0.04, side * d.appendage],
          [0.16, side * d.appendage * 0.82],
          [0.2, 0],
        ],
        0.014,
      );
      parts.push(f);
    }
  } else if (d.family === 'penguin') {
    for (const side of [-1, 1]) {
      const f = sheet(
        [
          [0.14, 0.03],
          [-0.03, side * d.appendage],
          [-0.28, side * d.appendage * 0.55],
          [-0.18, 0.04],
        ],
        0.018,
      );
      parts.push(f);
    }
    const beak = sheet(
      [
        [0.39, 0.025],
        [0.5 + d.snout, 0],
        [0.39, -0.025],
      ],
      0.035,
    );
    parts.push(beak);
  } else if (
    d.family === 'pinniped' ||
    d.family === 'otter' ||
    d.family === 'bear'
  ) {
    for (const side of [-1, 1]) {
      const f = sheet(
        [
          [0.12, 0.02],
          [-0.02, side * d.appendage],
          [-0.22, side * d.appendage * 0.78],
          [-0.14, 0.025],
        ],
        0.025,
      );
      parts.push(f);
    }
    const hind = sheet(
      [
        [-0.34, 0.02],
        [-0.5, -d.appendage * 0.55],
        [-0.46, 0],
        [-0.5, d.appendage * 0.55],
      ],
      0.02,
    );
    parts.push(hind);
  } else {
    const dorsal = sheet(
      [
        [-0.2, 0.02],
        [-0.08, d.appendage],
        [0.14, 0.02],
      ],
      0.015,
    );
    dorsal.rotateX(Math.PI / 2);
    parts.push(dorsal);
    for (const side of [-1, 1]) {
      const p = sheet(
        [
          [0.16, 0.03],
          [-0.02, side * d.appendage],
          [-0.2, side * d.appendage * 0.65],
          [-0.12, 0.03],
        ],
        0.012,
      );
      parts.push(p);
    }
    const vertical = d.family === 'whale';
    const tail = sheet(
      [
        [-0.34, 0.025],
        [-0.5, vertical ? d.tail : d.tail],
        [-0.43, 0],
        [-0.5, vertical ? -d.tail : -d.tail],
        [-0.34, -0.025],
      ],
      0.018,
    );
    if (!vertical) tail.rotateX(Math.PI / 2);
    parts.push(tail);
    if (id === 'hammerhead') {
      const head = sheet(
        [
          [0.36, -d.snout],
          [0.5, -d.snout],
          [0.5, d.snout],
          [0.36, d.snout],
        ],
        0.05,
      );
      parts.push(head);
    }
  }
  let raw = join(parts);
  raw = colorRegions(raw, d.palette, (p) => {
    if (d.markings === 'orca')
      return p.y < -0.02 || (p.x > 0.18 && Math.abs(p.z) > 0.08) ? 1 : 0;
    if (d.markings === 'penguin')
      return p.y < 0.01 && p.x > 0.02 ? 1 : p.x > 0.25 ? 2 : 0;
    if (d.markings === 'tips')
      return p.x < -0.42 || Math.abs(p.z) > d.width * 1.3 ? 3 : p.y < 0 ? 1 : 0;
    if (d.markings === 'spots')
      return (Math.floor((p.x + 0.55) * 13) + Math.floor((p.z + 0.5) * 17)) %
        5 ===
        0
        ? 2
        : p.y < -0.02
          ? 1
          : 0;
    if (d.markings === 'saddles')
      return p.y > 0 && Math.sin((p.x + 0.5) * 28) > 0.45 ? 2 : p.y < 0 ? 1 : 0;
    if (d.markings === 'mottled')
      return Math.sin(p.x * 31 + p.z * 23) > 0.55 ? 2 : p.y < -0.04 ? 1 : 0;
    return p.y < -0.03 ? 1 : 0;
  });
  const axis = d.family === 'whale' ? 'y' : 'z';
  for (const sign of [1, -1])
    addPose(raw, sign > 0 ? 'Stroke_Left' : 'Stroke_Right', (p, out) => {
      const rear = Math.max(0, Math.min(1, (-p.x + 0.08) / 0.62));
      if (d.family === 'ray')
        out.y += sign * 0.1 * Math.max(0, Math.abs(p.z) - d.width * 0.35);
      else if (
        d.family === 'penguin' ||
        d.family === 'pinniped' ||
        d.family === 'turtle' ||
        d.family === 'otter' ||
        d.family === 'bear'
      )
        out.y += sign * 0.12 * Math.max(0, Math.abs(p.z) - d.width * 0.55);
      else out[axis] += sign * 0.11 * rear * rear;
    });
  raw.computeBoundingBox();
  const size = raw.boundingBox!.getSize(new THREE.Vector3());
  raw.scale(
    d.target / Math.max(size.x, size.y, size.z),
    d.target / Math.max(size.x, size.y, size.z),
    d.target / Math.max(size.x, size.y, size.z),
  );
  raw.computeBoundingBox();
  raw.computeBoundingSphere();
  return raw;
}

export function largeCreatureAsset(
  id: LargeCreatureId,
  rootName: string,
  required: readonly string[],
): LoadedAsset {
  const geometry = largeCreatureGeometry(id),
    material = lowPolyMaterial({ role: 'body', vertexColors: true });
  material.name = 'Crafted_Large_Creature';
  material.userData.largeCreature = true;
  const scene = new THREE.Group(),
    root = new THREE.Group();
  root.name = rootName;
  scene.add(root);
  scene.userData.largeCreature = id;
  for (const name of ['Body', 'Body_LOD1']) {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = name;
    root.add(mesh);
  }
  for (const name of required)
    if (!scene.getObjectByName(name)) {
      const pivot = new THREE.Group();
      pivot.name = name;
      root.add(pivot);
    }
  return { scene, scenes: [scene], animations: [] };
}
