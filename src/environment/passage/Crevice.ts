import * as THREE from 'three';
import { CREVICE, CREVICE_FRAME } from '../../config/passage';
import type { ConvexCollider } from '../../player/collision';
import { createRockGeometry } from '../RockGeometry';
import { rockCollider } from '../rockCollider';

/**
 * v0.4 Pass 023: the hidden crevice. A rock outcrop against the tank's back glass, built from
 * convex boulders fitted around an open channel. The channel opens on the outcrop's +x side,
 * towards the right bank (out of view from the usual swim start), and runs into darkness: an
 * irregular rock tube inside it (Pass 026 playtest; it was a dark box), rock like the boulders,
 * darkened by soft veils that are dark at the centre and clear at the rock edges, deepening to
 * black at the threshold, where the swimmer passes into the outer waters. Every boulder is a real convex collider, so the channel is
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
  // Pass 026 playtest: more rock around the mouth, so it reads as a gap in a jumble of boulders.
  // None reaches into the channel's space (y 0.6-2.6, z -13.05 to -11.15 beyond the mouth) or
  // the "Return to the tank" spot (x 6.4, y 1.6, z -12.1).
  // A low overhang just above the swimmer's way in, casting the mouth into shadow.
  { min: [5.0, 2.75, -13.5], max: [6.4, 3.7, -10.8], seed: 7108 },
  // Buttresses either side of the opening (the room side clear of the seagrass at x 5, z -11).
  { min: [5.1, -0.3, -14.1], max: [6.5, 2.5, -13.2], seed: 7109 },
  { min: [5.3, -0.3, -10.95], max: [6.3, 2.0, -10.0], seed: 7110 },
  // Low rocks in front, swum over, hiding the bottom of the opening.
  { min: [6.1, -0.3, -12.7], max: [7.0, 0.5, -11.8], seed: 7111 },
  { min: [5.6, -0.3, -11.5], max: [6.4, 0.75, -10.9], seed: 7112 },
  // A tall standing rock further out on the glass side, screening it from the alley.
  { min: [7.1, -0.3, -14.0], max: [8.0, 3.1, -13.2], seed: 7113 },
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
    // The tube is rock like the boulders (and dressed with them); darkness comes from soft veils
    // inside it, dark at the centre where the swimmer goes and clear at the rock edges.
    const tube = new THREE.Mesh(channelTube(), rock);
    tube.name = 'Crevice rock tube';
    this.geometries.push(tube.geometry);
    rocks.push(tube);
    this.root.add(tube);
    const veils = new THREE.Mesh(darknessVeils(), veilMaterial());
    veils.name = 'Crevice darkness';
    veils.renderOrder = 1;
    this.geometries.push(veils.geometry);
    this.materials.push(veils.material);
    this.root.add(veils);
    this.rocks = rocks;
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
/**
 * Pass 026 playtest: the channel's inside as an irregular rock tube instead of a dark box. Its
 * section is a lumpy oval that only ever bulges outward from the channel (never into the space the
 * swimmer can reach); where it starts, inside the boulders, it flares out so its rim tucks behind
 * them. It is the boulders' own rock; the veils below make its middle dark.
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
    const x = x0 + ((x1 - x0) * i) / steps;
    for (let j = 0; j <= around; j++) {
      const a = (j / around) * Math.PI * 2,
        r = tubeRadius(x, ((j % around) / around) * Math.PI * 2);
      positions.push(
        x,
        cy + Math.sin(a) * CREVICE.halfHeight * r,
        cz + Math.cos(a) * CREVICE.halfDepth * r,
      );
      const tone = 0.78 + 0.22 * noise(x * 4.1, a * 3.3);
      colors.push(tone, tone, tone);
    }
  }
  for (let i = 0; i < steps; i++)
    for (let j = 0; j < around; j++) {
      const a = i * (around + 1) + j,
        b = a + around + 1;
      // Wound to face inwards (the rock material is single-sided).
      indices.push(a, a + 1, b, a + 1, b + 1, b);
    }
  // A cap closes the far end (behind the darkest veil).
  const centre = positions.length / 3;
  positions.push(x0, cy, cz);
  colors.push(0.8, 0.8, 0.8);
  for (let j = 0; j < around; j++) indices.push(centre, j, j + 1);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  g.setIndex(indices);
  g.computeVertexNormals();
  g.computeBoundingSphere();
  return g;
}
/**
 * Soft darkness inside the tube: a few ovals across the channel, from just inside the mouth to
 * the threshold, each nearly opaque at its centre and clear at its rim, so looking in the middle
 * is dark while the rock around the edges keeps its colour. Deeper ones are darker.
 */
export const VEILS = { at: [4.3, 3.85, 3.4, 2.95], rim: 1.25 } as const;
/** A veil's opacity at its centre (deeper is darker). */
export function veilOpacity(x: number): number {
  return 0.4 + 0.5 * (1 - linerShade(x));
}
function darknessVeils(): THREE.BufferGeometry {
  const positions: number[] = [],
    colors: number[] = [],
    indices: number[] = [],
    around = 28,
    // Radius fraction and opacity fraction of each ring, centre to rim.
    rings: readonly (readonly [number, number])[] = [
      [0, 1],
      [0.45, 1],
      [0.75, 0.45],
      [1, 0],
    ];
  for (const x of VEILS.at) {
    const alpha = veilOpacity(x),
      first = positions.length / 3;
    for (const [r, f] of rings)
      for (let j = 0; j < around; j++) {
        const a = (j / around) * Math.PI * 2;
        positions.push(
          x,
          CREVICE.centre.y + Math.sin(a) * CREVICE.halfHeight * VEILS.rim * r,
          CREVICE.centre.z + Math.cos(a) * CREVICE.halfDepth * VEILS.rim * r,
        );
        colors.push(0, 0, 0, alpha * f);
      }
    for (let k = 0; k < rings.length - 1; k++)
      for (let j = 0; j < around; j++) {
        const a = first + k * around + j,
          b = first + k * around + ((j + 1) % around);
        indices.push(a, b, a + around, b, b + around, a + around);
      }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 4));
  g.setIndex(indices);
  g.computeBoundingSphere();
  return g;
}
function veilMaterial(): THREE.MeshBasicMaterial {
  const m = new THREE.MeshBasicMaterial({
    vertexColors: true,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  m.name = 'Crevice darkness';
  return m;
}
