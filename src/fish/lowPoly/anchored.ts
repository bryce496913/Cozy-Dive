import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import {
  colorRegions,
  fin,
  profileBody,
  taperedCurve,
} from '../../geometry/lowPoly/geometry';
import { lowPolyMaterial } from '../../rendering/lowPoly/resources';
import type { LoadedAsset } from '../../assets/AssetValidation';
export const ANCHORED_FISH_PARTS = [
  'HorseBody',
  'HorseTail',
  'HorseDorsal',
  'HorseLeftFin',
  'HorseRightFin',
  'FrogBody',
  'FrogFoot',
  'FrogJaw',
  'FrogLure',
] as const;
export type AnchoredFishPart = (typeof ANCHORED_FISH_PARTS)[number];
function sheet(points: readonly (readonly [number, number])[]) {
  return fin(
    points,
    points.map(() => 0.004),
  );
}
function combine(parts: THREE.BufferGeometry[]) {
  parts.forEach((g) => g.deleteAttribute('uv'));
  const result = mergeGeometries(parts);
  parts.forEach((g) => g.dispose());
  if (!result) throw Error('Anchored fish attributes');
  return result;
}
/** Geometry in the existing controller's pivot coordinates. +Z is the face of both animals. */
export function anchoredFishGeometry(
  name: AnchoredFishPart,
): THREE.BufferGeometry {
  let raw: THREE.BufferGeometry;
  if (name === 'HorseBody') {
    const body = taperedCurve(
      [
        [0, 0.3, -0.03],
        [0, 0.48, -0.015],
        [0, 0.66, -0.08],
        [0, 0.84, -0.1],
        [0, 1, -0.025],
        [0, 1.025, 0.07],
        [0, 0.985, 0.17],
        [0, 0.984, 0.34],
      ],
      [0.025, 0.095, 0.085, 0.045, 0.055, 0.075, 0.035, 0.022],
      10,
    );
    const crown = sheet([
      [-0.045, 0],
      [-0.035, 0.075],
      [0, 0.045],
      [0.035, 0.085],
      [0.05, 0],
    ]);
    crown.rotateX(Math.PI / 2);
    crown.translate(0, 1.075, 0.015);
    const chestKeel = sheet([
      [-0.13, 0],
      [-0.04, 0.055],
      [0.1, 0.03],
      [0.16, 0],
    ]);
    chestKeel.rotateZ(Math.PI / 2);
    chestKeel.translate(0, 0.68, -0.095);
    raw = combine([body, crown, chestKeel]);
  } else if (name === 'HorseTail')
    raw = taperedCurve(
      [
        [0, 0, -0.03],
        [0, -0.15, -0.06],
        [0, -0.275, 0.035],
        [0, -0.285, 0.18],
        [0, -0.18, 0.25],
        [0, -0.1, 0.16],
        [0, -0.15, 0.095],
        [0, -0.2, 0.14],
      ],
      [0.025, 0.022, 0.019, 0.016, 0.014, 0.012, 0.009, 0.005],
      6,
    );
  else if (name === 'HorseDorsal') {
    raw = sheet([
      [-0.11, 0],
      [-0.08, -0.09],
      [0.08, -0.12],
      [0.12, 0],
    ]);
    raw.rotateZ(Math.PI / 2);
  } else if (name === 'HorseLeftFin' || name === 'HorseRightFin') {
    raw = sheet([
      [0, 0],
      [0.07, -0.02],
      [0.085, 0.025],
      [0.015, 0.04],
    ]);
    raw.rotateX(Math.PI / 2);
  } else if (name === 'FrogBody') {
    const body = profileBody(
      [
        { x: -0.39, width: 0.025, height: 0.025, y: 0.2 },
        { x: -0.25, width: 0.13, height: 0.16, y: 0.24 },
        { x: -0.05, width: 0.24, height: 0.25, y: 0.29 },
        { x: 0.2, width: 0.28, height: 0.21, lowerHeight: 0.14, y: 0.3 },
        { x: 0.375, width: 0.17, height: 0.11, lowerHeight: 0.05, y: 0.28 },
      ],
      10,
    );
    body.rotateY(-Math.PI / 2);
    const dorsal = sheet([
      [-0.28, 0],
      [-0.16, -0.17],
      [0.05, -0.12],
      [0.19, 0],
    ]);
    dorsal.rotateX(Math.PI / 2);
    dorsal.rotateY(-Math.PI / 2);
    dorsal.translate(0, 0.43, 0);
    raw = combine([body, dorsal]);
  } else if (name === 'FrogFoot') {
    const arm = taperedCurve(
      [
        [0.19, 0.25, 0.035],
        [0.27, 0.1, 0.15],
        [0.37, 0.028, 0.27],
      ],
      [0.045, 0.035, 0.02],
      6,
    );
    const web = sheet([
      [0.3, 0.19],
      [0.4, 0.21],
      [0.43, 0.25],
      [0.42, 0.34],
      [0.32, 0.33],
    ]);
    web.translate(0, 0.023, 0);
    raw = combine([arm, web]);
  } else if (name === 'FrogJaw') {
    raw = profileBody(
      [
        { x: 0.15, width: 0.1, height: 0.04, y: 0.23 },
        { x: 0.32, width: 0.17, height: 0.065, y: 0.225 },
        { x: 0.41, width: 0.16, height: 0.016, y: 0.25 },
      ],
      10,
    );
    raw.rotateY(-Math.PI / 2);
    raw.translate(0, -0.31, -0.16);
  } else
    raw = taperedCurve(
      [
        [0, 0, 0],
        [0, 0.12, 0.05],
        [0, 0.17, 0.11],
        [0, 0.15, 0.19],
        [0, 0.11, 0.22],
      ],
      [0.009, 0.008, 0.007, 0.009, 0.023],
      6,
    );
  const horse = name.startsWith('Horse');
  const g = colorRegions(
    raw,
    horse
      ? ['#87966d', '#b9bd8e', '#596f53']
      : ['#a99b76', '#c3b897', '#737c59'],
    (p) =>
      p.y > (horse ? 0.85 : 0.42) ? 1 : p.y < (horse ? 0.45 : 0.2) ? 2 : 0,
  );
  raw.dispose();
  // Readable, flat eye patches on the head; keep them in the body geometry and palette.
  if (name === 'HorseBody' || name === 'FrogBody') {
    const parts = [g];
    for (const sign of [-1, 1]) {
      const eye = sheet([
        [-0.018, 0],
        [0, -0.018],
        [0.018, 0],
        [0, 0.018],
      ]);
      eye.rotateZ(Math.PI / 2);
      eye.translate(
        sign * (horse ? 0.071 : 0.243),
        horse ? 1.033 : 0.415,
        horse ? 0.07 : 0.25,
      );
      const colored = colorRegions(eye, ['#24382e'], () => 0);
      eye.dispose();
      parts.push(colored);
    }
    const merged = combine(parts);
    merged.setAttribute(
      'uv',
      new THREE.BufferAttribute(
        new Float32Array(merged.getAttribute('position').count * 2),
        2,
      ),
    );
    merged.computeBoundingBox();
    merged.computeBoundingSphere();
    return merged;
  }
  g.setAttribute(
    'uv',
    new THREE.BufferAttribute(
      new Float32Array(g.getAttribute('position').count * 2),
      2,
    ),
  );
  return g;
}
const pivots: Partial<Record<AnchoredFishPart, [number, number, number]>> = {
  HorseTail: [0, 0.33, 0],
  HorseDorsal: [0, 0.59, -0.14],
  HorseLeftFin: [0.045, 0.97, 0.02],
  HorseRightFin: [-0.045, 0.97, 0.02],
  FrogJaw: [0, 0.31, 0.16],
  FrogLure: [0, 0.455, 0.275],
};
/** The mixed library still owns the anemone/moray. Replace only these nine fish parts before
 * it enters the existing cache; dispose superseded resources only when no remaining part uses them. */
export function rebuildAnchoredFish(asset: LoadedAsset): LoadedAsset {
  const oldGeometry = new Set<THREE.BufferGeometry>(),
    oldMaterials = new Set<THREE.Material>(),
    oldTextures = new Set<THREE.Texture>();
  const nodes = ANCHORED_FISH_PARTS.map((name) => {
    const node = asset.scene.getObjectByName(name);
    if (!node?.parent) throw Error(`Missing anchored fish part ${name}`);
    return node;
  });
  const replacements: THREE.BufferGeometry[] = [];
  try {
    for (const name of ANCHORED_FISH_PARTS)
      replacements.push(anchoredFishGeometry(name));
  } catch (error) {
    replacements.forEach((g) => g.dispose());
    throw error;
  }
  const material = lowPolyMaterial({ role: 'body', vertexColors: true });
  material.userData.coreFish = true;
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i],
      name = ANCHORED_FISH_PARTS[i];
    node.traverse((part) => {
      if (!(part instanceof THREE.Mesh)) return;
      oldGeometry.add(part.geometry);
      for (const m of Array.isArray(part.material)
        ? part.material
        : [part.material]) {
        oldMaterials.add(m);
        for (const v of Object.values(m))
          if (v instanceof THREE.Texture) oldTextures.add(v);
      }
    });
    // GLTFLoader represents multi-material primitives as a Group, not necessarily a Mesh.
    const replacement = new THREE.Mesh(replacements[i], material);
    replacement.name = name;
    replacement.position.copy(node.position);
    replacement.quaternion.copy(node.quaternion);
    replacement.scale.copy(node.scale);
    node.parent!.add(replacement);
    node.removeFromParent();
    if (pivots[name]) replacement.position.set(...pivots[name]);
    if (name === 'HorseRightFin') replacement.scale.x = -1;
  }

  asset.scene.traverse((o) => {
    if (o instanceof THREE.Mesh) {
      oldGeometry.delete(o.geometry);
      for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
        oldMaterials.delete(m);
        for (const v of Object.values(m))
          if (v instanceof THREE.Texture) oldTextures.delete(v);
      }
    }
  });
  oldGeometry.forEach((g) => g.dispose());
  oldMaterials.forEach((m) => m.dispose());
  oldTextures.forEach((t) => t.dispose());
  return asset;
}
