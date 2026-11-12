import * as THREE from 'three';
import { CREVICE, CREVICE_FRAME } from '../../config/passage';
import type { ConvexCollider } from '../../player/collision';
import { createRockGeometry } from '../RockGeometry';
import { rockCollider } from '../rockCollider';

/**
 * v0.4 Pass 023: the hidden crevice. A rock outcrop against the tank's back glass, built from
 * convex boulders fitted around an open channel. The channel opens on the outcrop's +x side,
 * towards the right bank (out of view from the usual swim start), and runs into darkness: an
 * irregular rock tube inside it (Pass 026 playtest; it was a dark box) flares into the boulders at
 * the mouth and fades from the rock's colour to black at the threshold, where the swimmer passes
 * into the outer waters. Every boulder is a real convex collider, so the channel is
 * the only way in. The crevice owns and disposes its geometry and materials.
 */
interface BoulderSpec {
  readonly min: readonly [number, number, number];
  readonly max: readonly [number, number, number];
  readonly seed: number;
}
const c = CREVICE,
  top = c.centre.y + c.halfHeight,
  front = c.centre.z + c.halfDepth,
  back = c.centre.z - c.halfDepth;
/** Boulders around the channel (box extents; each rock fills its box). */
export const CREVICE_BOULDERS: readonly BoulderSpec[] = [
  // Roof, room-side wall, glass-side wall and the far end cap: these bound the channel.
  { min: [0.75, top, -14], max: [5.4, c.outcrop.maxY, -10.3], seed: 7101 },
  { min: [0.75, -0.3, front], max: [4.8, 2.9, -9.9], seed: 7102 },
  { min: [0.75, -0.3, -14.2], max: [5.2, 2.9, back], seed: 7103 },
  { min: [0.75, -0.3, -13.8], max: [c.endX - 0.05, 3.0, -10.4], seed: 7104 },
  // Shoulders that make it read as one outcrop and keep the crack in shadow.
  { min: [1.2, 3.8, -12.9], max: [4.4, 4.9, -10.6], seed: 7105 },
  { min: [4.9, 2.7, -13.8], max: [5.7, 4.0, -11.4], seed: 7106 },
  // (Kept clear of the seagrass that grows at the mouth, x 5.0, z -11.0.)
  { min: [4.3, -0.2, -10.95], max: [4.85, 1.3, -10.1], seed: 7107 },
];
/** The tube is fully lit this far inside the mouth, fading to black towards the threshold. */
const LINER_INSET = 0.9;

export class Crevice {
  readonly root = new THREE.Group();
  readonly colliders: readonly ConvexCollider[];
  /** Boulder meshes (the authored reef dresses them in its rock material). */
  readonly rocks: readonly THREE.Mesh[];
  private readonly geometries: THREE.BufferGeometry[] = [];
  private readonly materials: THREE.Material[] = [];
  private disposed = false;

  constructor() {
    this.root.name = 'Hidden crevice';
    const rock = new THREE.MeshStandardMaterial({
      color: 0x6f7f78,
      roughness: 0.96,
      vertexColors: true,
      metalness: 0,
    });
    this.materials.push(rock);
    const colliders: ConvexCollider[] = [],
      rocks: THREE.Mesh[] = [],
      box = new THREE.Box3(),
      size = new THREE.Vector3(),
      centre = new THREE.Vector3();
    CREVICE_BOULDERS.forEach((spec, i) => {
      const geometry = createRockGeometry(spec.seed, i % 4);
      geometry.computeBoundingBox();
      box.copy(geometry.boundingBox!);
      box.getSize(size);
      box.getCenter(centre);
      const mesh = new THREE.Mesh(geometry, rock);
      mesh.name = `Crevice rock ${i}`;
      mesh.scale.set(
        (spec.max[0] - spec.min[0]) / size.x,
        (spec.max[1] - spec.min[1]) / size.y,
        (spec.max[2] - spec.min[2]) / size.z,
      );
      mesh.position.set(
        (spec.min[0] + spec.max[0]) / 2 - centre.x * mesh.scale.x,
        (spec.min[1] + spec.max[1]) / 2 - centre.y * mesh.scale.y,
        (spec.min[2] + spec.max[2]) / 2 - centre.z * mesh.scale.z,
      );
      mesh.updateMatrix();
      mesh.matrixAutoUpdate = false;
      colliders.push(rockCollider(geometry, mesh.matrix));
      this.geometries.push(geometry);
      rocks.push(mesh);
      this.root.add(mesh);
    });
    // Rounded boulders leave gaps where they meet; thin plates just behind the rock tube seal
    // the channel, so its mouth is the only way in or out.
    colliders.push(...channelSeals());
    this.colliders = colliders;
    this.rocks = rocks;
    const liner = new THREE.Mesh(channelTube(), channelMaterial());
    liner.name = 'Crevice rock tube';
    this.geometries.push(liner.geometry);
    this.materials.push(liner.material);
    this.root.add(liner);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.root.removeFromParent();
    this.root.clear();
    this.geometries.forEach((g) => g.dispose());
    this.materials.forEach((m) => m.dispose());
  }
}

/** An axis-aligned box as a convex collider. */
export function boxCollider(
  min: readonly [number, number, number],
  max: readonly [number, number, number],
): ConvexCollider {
  return {
    planes: [
      { x: 1, y: 0, z: 0, offset: max[0] },
      { x: -1, y: 0, z: 0, offset: -min[0] },
      { x: 0, y: 1, z: 0, offset: max[1] },
      { x: 0, y: -1, z: 0, offset: -min[1] },
      { x: 0, y: 0, z: 1, offset: max[2] },
      { x: 0, y: 0, z: -1, offset: -min[2] },
    ],
    min: { x: min[0], y: min[1], z: min[2] },
    max: { x: max[0], y: max[1], z: max[2] },
  };
}
/** Plates around the channel: roof, floor, both sides and the far end. */
function channelSeals(): ConvexCollider[] {
  const t = 0.35,
    x0 = CREVICE.endX - t,
    // They stop just inside the mouth (the rocks frame the mouth itself).
    x1 = CREVICE.mouthX - 0.45,
    y0 = CREVICE.centre.y - CREVICE.halfHeight,
    y1 = CREVICE.centre.y + CREVICE.halfHeight,
    z0 = CREVICE.centre.z - CREVICE.halfDepth,
    z1 = CREVICE.centre.z + CREVICE.halfDepth;
  return [
    boxCollider([x0, y1, z0 - t], [x1, y1 + t, z1 + t]),
    boxCollider([x0, y0 - t, z0 - t], [x1, y0, z1 + t]),
    boxCollider([x0, y0 - t, z1], [x1, y1 + t, z1 + t]),
    boxCollider([x0, y0 - t, z0 - t], [x1, y1 + t, z0]),
    boxCollider([x0, y0 - t, z0 - t], [CREVICE.endX, y1 + t, z1 + t]),
  ];
}

/** Darkness of the liner at x (1 = the rock's shade at the mouth, 0 = black). */
export function linerShade(x: number): number {
  // Already half in shadow where the tube begins, black by the threshold.
  const mouth = CREVICE.mouthX - LINER_INSET + 0.9,
    dark = CREVICE_FRAME.origin.x + 0.4,
    t = Math.max(0, Math.min(1, (x - dark) / (mouth - dark)));
  return t * t;
}

/** Deterministic, smooth value noise in [0, 1] for the tube's rock. */
function noise(x: number, y: number): number {
  const h = (i: number, j: number) => {
    const v = Math.sin(i * 127.1 + j * 311.7) * 43758.5453;
    return v - Math.floor(v);
  };
  const ix = Math.floor(x),
    iy = Math.floor(y),
    fx = x - ix,
    fy = y - iy,
    sx = fx * fx * (3 - 2 * fx),
    sy = fy * fy * (3 - 2 * fy),
    a = h(ix, iy),
    b = h(ix + 1, iy),
    c = h(ix, iy + 1),
    d = h(ix + 1, iy + 1);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}
/** The tube's rock colour where light reaches it (it fades to black deeper in). */
// Linear values: shadowed green-grey rock, like the boulders' undersides.
const TUBE_ROCK = [0.085, 0.105, 0.09] as const;
/**
 * Pass 026 playtest: the channel's inside as an irregular rock tube instead of a dark box. Its
 * section is a lumpy oval that only ever bulges outward from the channel (never into the space the
 * swimmer can reach); towards the mouth it flares out so its rim tucks behind the boulders, and
 * it is lit like rock there, fading gradually to black towards the threshold and the far end.
 */
export const TUBE = {
  steps: 40,
  around: 36,
  inset: 1.25,
  flare: 0.3,
  bump: 0.26,
} as const;
export function tubeRadius(x: number, angle: number): number {
  const start = CREVICE.mouthX - TUBE.inset,
    flare = Math.max(0, Math.min(1, (x - (start - 0.5)) / 0.5));
  return (
    1 +
    0.03 +
    TUBE.bump *
      (0.65 * noise(x * 2.3, angle * 1.9 + 3.1) +
        0.35 * noise(x * 6.1, angle * 5.3 + 7.7)) +
    TUBE.flare * flare * flare
  );
}
function channelTube(): THREE.BufferGeometry {
  const x0 = CREVICE.endX,
    // It starts in the shadow well inside: the boulders themselves form the mouth and the first
    // metre or so of the passage, so the eye meets rock, then darkness, never an outline.
    x1 = CREVICE.mouthX - TUBE.inset,
    { steps, around } = TUBE,
    cy = CREVICE.centre.y,
    cz = CREVICE.centre.z;
  const positions: number[] = [],
    colors: number[] = [],
    indices: number[] = [];
  for (let i = 0; i <= steps; i++) {
    const x = x0 + ((x1 - x0) * i) / steps,
      k = linerShade(x);
    for (let j = 0; j <= around; j++) {
      const a = (j / around) * Math.PI * 2,
        r = tubeRadius(x, ((j % around) / around) * Math.PI * 2);
      positions.push(
        x,
        cy + Math.sin(a) * CREVICE.halfHeight * r,
        cz + Math.cos(a) * CREVICE.halfDepth * r,
      );
      const tone = (0.6 + 0.8 * noise(x * 4.1, a * 3.3)) * k;
      colors.push(
        TUBE_ROCK[0] * tone,
        TUBE_ROCK[1] * tone,
        TUBE_ROCK[2] * tone,
      );
    }
  }
  for (let i = 0; i < steps; i++)
    for (let j = 0; j < around; j++) {
      const a = i * (around + 1) + j,
        b = a + around + 1;
      indices.push(a, b, a + 1, a + 1, b, b + 1);
    }
  // A dark cap closes the far end.
  const centre = positions.length / 3;
  positions.push(x0, cy, cz);
  colors.push(0, 0, 0);
  for (let j = 0; j < around; j++) indices.push(centre, j + 1, j);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  g.setIndex(indices);
  g.computeVertexNormals();
  g.computeBoundingSphere();
  return g;
}
function channelMaterial(): THREE.MeshStandardMaterial {
  const m = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.97,
    metalness: 0,
    side: THREE.DoubleSide,
  });
  m.name = 'Crevice rock tube';
  return m;
}
