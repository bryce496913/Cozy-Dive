import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import {
  addPose,
  colorRegions,
  fin,
  profileBody,
  type BodySection,
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

function bodySections(
  id: LargeCreatureId,
  d: ReturnType<typeof largeCreatureDesign>,
): BodySection[] {
  if (d.family === 'ray')
    return [
      { x: -0.5, width: 0.012, height: 0.01 },
      { x: -0.3, width: d.width * 0.48, height: d.depth * 0.42 },
      { x: -0.08, width: d.width, height: d.depth },
      { x: 0.16, width: d.width * 0.92, height: d.depth * 0.92 },
      { x: 0.34, width: d.width * 0.52, height: d.depth * 0.58 },
      { x: 0.48, width: d.width * 0.17, height: d.depth * 0.24 },
    ];
  if (d.family === 'penguin')
    return [
      { x: -0.46, width: 0.035, height: 0.04 },
      { x: -0.3, width: d.width * 0.68, height: d.depth * 0.62 },
      { x: -0.08, width: d.width, height: d.depth },
      { x: 0.12, width: d.width * 0.92, height: d.depth * 0.9, y: 0.01 },
      { x: 0.27, width: d.width * 0.68, height: d.depth * 0.7, y: 0.025 },
      { x: 0.4, width: d.width * 0.52, height: d.depth * 0.52, y: 0.025 },
      { x: 0.48, width: d.width * 0.2, height: d.depth * 0.18, y: 0.012 },
    ];
  if (d.family === 'pinniped' || d.family === 'otter' || d.family === 'bear') {
    const longNeck = id === 'leopardSeal' ? 1.15 : id === 'seaLion' ? 1.08 : 1;
    return [
      { x: -0.5, width: 0.025, height: 0.025 },
      { x: -0.34, width: d.width * 0.52, height: d.depth * 0.5 },
      { x: -0.12, width: d.width, height: d.depth },
      { x: 0.12, width: d.width * 0.94, height: d.depth * 0.92 },
      { x: 0.3, width: d.width * 0.7 * longNeck, height: d.depth * 0.7 },
      { x: 0.42, width: d.width * 0.57, height: d.depth * 0.54, y: 0.012 },
      { x: 0.5, width: d.width * 0.28, height: d.depth * 0.25, y: 0.006 },
    ];
  }
  if (d.family === 'whale') {
    const broadHead =
      id === 'humpbackWhale' ? 1.2 : id === 'killerWhale' ? 1.08 : 0.95;
    return [
      { x: -0.5, width: 0.018, height: 0.018 },
      { x: -0.36, width: d.width * 0.43, height: d.depth * 0.42 },
      { x: -0.16, width: d.width * 0.9, height: d.depth * 0.88 },
      { x: 0.08, width: d.width, height: d.depth },
      { x: 0.28, width: d.width * 0.82, height: d.depth * 0.76, y: 0.008 },
      {
        x: 0.42,
        width: d.width * 0.62 * broadHead,
        height: d.depth * 0.52,
        y: 0.004,
      },
      {
        x: 0.5,
        width: d.width * d.snout * broadHead,
        height: d.depth * d.snout * 0.72,
      },
    ];
  }
  if (d.family === 'turtle')
    return [
      { x: -0.46, width: 0.025, height: 0.025 },
      { x: -0.3, width: d.width * 0.7, height: d.depth * 0.62 },
      { x: -0.08, width: d.width, height: d.depth },
      { x: 0.16, width: d.width * 0.92, height: d.depth * 0.86 },
      { x: 0.34, width: d.width * 0.42, height: d.depth * 0.44 },
      { x: 0.48, width: d.width * 0.18, height: d.depth * 0.2 },
    ];
  if (d.family === 'sunfish')
    return [
      { x: -0.43, width: d.width * 0.18, height: d.depth * 0.52 },
      { x: -0.24, width: d.width * 0.72, height: d.depth * 0.92 },
      { x: 0, width: d.width, height: d.depth },
      { x: 0.24, width: d.width * 0.78, height: d.depth * 0.88 },
      { x: 0.44, width: d.width * 0.3, height: d.depth * 0.42 },
    ];
  const hammer = id === 'hammerhead';
  return [
    { x: -0.5, width: 0.018, height: 0.018 },
    { x: -0.36, width: d.width * 0.42, height: d.depth * 0.44 },
    { x: -0.14, width: d.width, height: d.depth },
    { x: 0.12, width: d.width * 0.94, height: d.depth * 0.88 },
    { x: 0.3, width: d.width * 0.72, height: d.depth * 0.62 },
    {
      x: 0.42,
      width: d.width * (hammer ? 0.42 : 0.58),
      height: d.depth * 0.48,
    },
    {
      x: 0.5,
      width: Math.max(0.025, d.width * d.snout),
      height: Math.max(0.025, d.depth * d.snout),
    },
  ];
}

/** A species-authored silhouette in normalized coordinates. Appendages are joined into one
 * morphing surface because the existing controllers intentionally address Body as one Mesh. */
export function largeCreatureGeometry(
  id: LargeCreatureId,
): THREE.BufferGeometry {
  const d = largeCreatureDesign(id),
    parts: THREE.BufferGeometry[] = [];
  const sections = bodySections(id, d);
  parts.push(profileBody(sections, 10));

  if (d.family === 'ray') {
    const swept = id === 'mantaRay' ? 0.82 : 0.68;
    const wing = sheet(
      [
        [-0.32, 0],
        [-0.12, d.appendage * 0.78],
        [0.16, d.appendage],
        [0.36, d.appendage * swept],
        [0.46, 0.09],
        [0.48, 0],
        [0.46, -0.09],
        [0.36, -d.appendage * swept],
        [0.16, -d.appendage],
        [-0.12, -d.appendage * 0.78],
      ],
      0.018,
    );
    parts.push(wing);
    if (id === 'mantaRay')
      for (const side of [-1, 1]) {
        const lobe = sheet(
          [
            [0.34, side * 0.08],
            [0.53, side * 0.13],
            [0.48, side * 0.04],
          ],
          0.014,
        );
        parts.push(lobe);
      }
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
    for (const side of [-1, 1]) {
      const foot = sheet(
        [
          [-0.28, side * 0.035],
          [-0.46, side * 0.13],
          [-0.42, side * 0.025],
        ],
        0.012,
      );
      parts.push(foot);
    }
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
      const longHumpback = id === 'humpbackWhale';
      const p = sheet(
        longHumpback
          ? [
              [0.2, side * 0.025],
              [0.04, side * d.appendage * 0.62],
              [-0.22, side * d.appendage],
              [-0.34, side * d.appendage * 0.82],
              [-0.16, side * 0.025],
            ]
          : [
              [0.16, side * 0.03],
              [-0.02, side * d.appendage],
              [-0.2, side * d.appendage * 0.65],
              [-0.12, side * 0.03],
            ],
        longHumpback ? 0.016 : 0.012,
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
  // Faceted eye plates provide a readable face without sphere primitives or texture detail.
  if (d.family !== 'ray')
    for (const side of [-1, 1]) {
      const eye = sheet(
        [
          [0.34, 0],
          [0.365, 0.018],
          [0.39, 0],
          [0.365, -0.018],
        ],
        0.006,
      );
      eye.rotateX(Math.PI / 2);
      eye.translate(0, d.depth * 0.14, side * d.width * 0.72);
      parts.push(eye);
    }
  let raw = join(parts);
  raw = colorRegions(raw, d.palette, (p) => {
    if (
      p.x > 0.33 &&
      p.x < 0.4 &&
      p.y > d.depth * 0.08 &&
      Math.abs(p.z) > d.width * 0.62
    )
      return 2;
    if (d.markings === 'orca')
      return p.y < -0.02 || (p.x > 0.18 && Math.abs(p.z) > 0.08) ? 1 : 0;
    if (d.markings === 'penguin')
      return p.y < 0.01 && p.x > 0.02 ? 1 : p.x > 0.25 ? 2 : 0;
    if (d.markings === 'tips')
      return p.x < -0.42 || Math.abs(p.z) > d.width * 1.3 ? 3 : p.y < 0 ? 1 : 0;
    if (d.markings === 'spots')
      return p.y < -0.02
        ? 1
        : Math.sin((p.x + 0.48) * 19) + Math.cos(p.z * 27) > 1.15
          ? 2
          : 0;
    if (d.markings === 'saddles')
      return p.y > 0 && Math.sin((p.x + 0.5) * 28) > 0.45 ? 2 : p.y < 0 ? 1 : 0;
    if (d.markings === 'mottled')
      return p.y < -0.04
        ? 1
        : p.y > 0.02 &&
            ((p.x > -0.32 && p.x < -0.17) ||
              (p.x > 0.02 && p.x < 0.16) ||
              (p.x > 0.3 && p.x < 0.4))
          ? 2
          : 0;
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
