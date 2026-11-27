import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { Vec3 } from '../../config/world';
import { OCTOPUS, OctopusMind, type OctopusDen } from '../../creatures/octopus';
import type { SightCandidate } from '../../discovery/journal';
import type { PlayerPresence } from '../../fish/FishDiverReaction';
import { octopusDenGeometry } from './OctopusDen';
import { profileBody } from '../../geometry/lowPoly/geometry';

/**
 * v0.6 Pass 043: an octopus, built and animated in code. A soft, wrinkled mantle with two raised
 * eyes, and eight tapering arms whose curls ripple as it rests and reach and trail as it creeps;
 * its skin takes on the colour of sand or rock and flushes dark when it is startled. It lives in a
 * den: v0.6 Pass 052, a solid mound of rock with a deep dark pocket (was the lobsters' open hood). The arms are one small mesh rewritten
 * each frame (no allocations). Owns its GPU resources.
 */
const ARMS = 8,
  SEGMENTS = 12,
  SIDES = 6;

/**
 * V0.8 Pass 096: the octopus's parts as shared factories, so the aquarium's octopus is this same
 * animal (it was a separate, simplified build). The mantle with its raised eyes, in body units.
 */
export function octopusMantleGeometry(): THREE.BufferGeometry {
  // A deliberately faceted continuous mantle: narrow at the rear, full over the organs, and
  // tapering into the head. It replaces the procedurally wrinkled sphere.
  const mantle = profileBody(
    [
      { x: -0.21, width: 0.035, height: 0.045, y: 0.14 },
      { x: -0.16, width: 0.09, height: 0.105, y: 0.145 },
      { x: -0.08, width: 0.125, height: 0.125, y: 0.13 },
      { x: 0.01, width: 0.12, height: 0.112, y: 0.115 },
      { x: 0.08, width: 0.1, height: 0.085, y: 0.105 },
      { x: 0.13, width: 0.065, height: 0.055, y: 0.1 },
    ],
    10,
  );
  mantle.rotateY(-Math.PI / 2);
  mantle.deleteAttribute('uv');
  const eyes = [-1, 1].map((s) => {
    const e = profileBody(
      [
        { x: -0.024, width: 0.014, height: 0.014 },
        { x: 0, width: 0.026, height: 0.024 },
        { x: 0.026, width: 0.012, height: 0.012 },
      ],
      6,
    );
    e.rotateZ(Math.PI / 2);
    e.translate(s * 0.07, 0.155, 0.075);
    return e;
  });
  const parts = [mantle, ...eyes].map((g) => g.toNonIndexed());
  [mantle, ...eyes].forEach((g) => g.dispose());
  parts.forEach((g, k) => {
    const n = g.getAttribute('position').count,
      c = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const y = g.getAttribute('position').getY(i),
        x = g.getAttribute('position').getX(i),
        z = g.getAttribute('position').getZ(i),
        region = z < -0.09 ? 0.84 : x > 0.045 ? 1.04 : 0.94;
      const v = k ? 0.35 : region * (0.9 + 0.3 * y);
      c[i * 3] = v;
      c[i * 3 + 1] = v * 0.95;
      c[i * 3 + 2] = v * 0.9;
    }
    g.setAttribute('color', new THREE.Float32BufferAttribute(c, 3));
    g.deleteAttribute('uv');
  });
  const merged = new THREE.BufferGeometry();
  const total = parts.reduce((n, g) => n + g.getAttribute('position').count, 0),
    pos = new Float32Array(total * 3),
    nor = new Float32Array(total * 3),
    col = new Float32Array(total * 3);
  let o = 0;
  for (const g of parts) {
    const n = g.getAttribute('position').count;
    pos.set(g.getAttribute('position').array, o * 3);
    nor.set(g.getAttribute('normal').array, o * 3);
    col.set(g.getAttribute('color').array, o * 3);
    o += n;
    g.dispose();
  }
  merged.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  merged.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  merged.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return merged;
}
/** The eight arms' ring mesh (its positions and normals written by `poseOctopusArms`). */
export function octopusArmsGeometry(): {
  readonly geometry: THREE.BufferGeometry;
  readonly positions: Float32Array;
  readonly normals: Float32Array;
} {
  // The arms: rings of `SIDES` round each arm's centreline, rewritten each frame.
  const ringVerts = (SEGMENTS + 1) * SIDES,
    armVerts = ringVerts + 2,
    verts = ARMS * armVerts,
    positions = new Float32Array(verts * 3),
    normals = new Float32Array(verts * 3);
  const colours2 = new Float32Array(verts * 3),
    index: number[] = [];
  for (let a = 0; a < ARMS; a++)
    for (let j = 0; j <= SEGMENTS; j++)
      for (let s = 0; s < SIDES; s++) {
        const v = a * armVerts + j * SIDES + s,
          // Paler suckers underneath.
          under = s === SIDES / 2 || s === SIDES / 2 - 1 ? 1.3 : 1,
          tone = 0.92 + 0.08 * (1 - j / SEGMENTS);
        colours2[v * 3] = tone * under;
        colours2[v * 3 + 1] = tone * 0.95 * under;
        colours2[v * 3 + 2] = tone * 0.9 * under;
        if (j < SEGMENTS) {
          const n = (s + 1) % SIDES,
            a0 = v,
            b0 = a * armVerts + j * SIDES + n,
            a1 = v + SIDES,
            b1 = b0 + SIDES;
          index.push(a0, a1, b0, b0, a1, b1);
        }
      }
  for (let a = 0; a < ARMS; a++) {
    const base = a * armVerts,
      root = base + ringVerts,
      tip = root + 1;
    for (let s = 0; s < SIDES; s++) {
      const next = (s + 1) % SIDES;
      index.push(root, base + next, base + s);
      index.push(
        tip,
        base + SEGMENTS * SIDES + s,
        base + SEGMENTS * SIDES + next,
      );
    }
    for (const v of [root, tip]) {
      colours2[v * 3] = 0.94;
      colours2[v * 3 + 1] = 0.89;
      colours2[v * 3 + 2] = 0.85;
    }
  }
  const armGeometry = new THREE.BufferGeometry();
  armGeometry.setAttribute(
    'position',
    new THREE.BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage),
  );
  armGeometry.setAttribute(
    'normal',
    new THREE.BufferAttribute(normals, 3).setUsage(THREE.DynamicDrawUsage),
  );
  armGeometry.setAttribute('color', new THREE.BufferAttribute(colours2, 3));
  armGeometry.setIndex(index);
  return { geometry: armGeometry, positions, normals };
}
/**
 * Write the arms' rings: `t` the ripple clock (s), `moving` 0..1 of creeping speed, `curl` how
 * far the tips curl, `inDen` how far it is tucked into its den. `centre` is scratch, (SEGMENTS + 1) * 3.
 */
export function poseOctopusArms(
  positions: Float32Array,
  normals: Float32Array,
  centre: Float32Array,
  t: number,
  moving: number,
  curl: number,
  inDen: number,
): void {
  const ringVerts = (SEGMENTS + 1) * SIDES,
    armVerts = ringVerts + 2;
  for (let a = 0; a < ARMS; a++) {
    // Arms fan round the body; moving, the front ones reach ahead and the rest trail behind.
    const base = ((a + 0.5) / ARMS) * Math.PI * 2,
      reach = 0.5 + 0.5 * Math.cos(base),
      len = 0.42 * (1 - 0.45 * inDen) * (1 + 0.25 * moving * (reach - 0.4)),
      ripple = t * (1.2 + 1.6 * moving) + a * 1.3;
    for (let j = 0; j <= SEGMENTS; j++) {
      const u = j / SEGMENTS,
        // Swing towards the back while moving; ripple and curl up towards the tip.
        swing =
          base +
          0.35 * moving * (1 - reach) * u +
          0.25 * Math.sin(ripple + u * 4) * u,
        r = 0.07 + len * u,
        lift =
          curl * 0.12 * u * u * (0.6 + 0.4 * Math.sin(ripple * 0.7 + u * 3)) +
          0.015 * (1 - u),
        inward = curl * 0.08 * u * u * u;
      centre[j * 3] = Math.sin(swing) * (r - inward);
      centre[j * 3 + 1] = lift;
      centre[j * 3 + 2] = Math.cos(swing) * (r - inward);
    }
    for (let j = 0; j <= SEGMENTS; j++) {
      const u = j / SEGMENTS,
        thick = 0.032 * (1 - u) + 0.005,
        k = Math.min(j, SEGMENTS - 1),
        tx = centre[(k + 1) * 3] - centre[k * 3],
        ty = centre[(k + 1) * 3 + 1] - centre[k * 3 + 1],
        tz = centre[(k + 1) * 3 + 2] - centre[k * 3 + 2],
        tl = Math.hypot(tx, ty, tz) || 1;
      // A frame round the centreline: side = tangent × up, up' = side × tangent.
      let sx = -tz / tl,
        sz = tx / tl;
      const sl = Math.hypot(sx, sz) || 1;
      sx /= sl;
      sz /= sl;
      const ux = -(sz * ty) / tl,
        uy = (sz * tx - sx * tz) / tl,
        uz = (sx * ty) / tl;
      for (let s = 0; s < SIDES; s++) {
        const ang = (s / SIDES) * Math.PI * 2,
          c = Math.cos(ang),
          sn = Math.sin(ang),
          nx = sx * c + ux * sn,
          ny = uy * sn,
          nz = sz * c + uz * sn,
          v = (a * armVerts + j * SIDES + s) * 3;
        positions[v] = centre[j * 3] + nx * thick;
        positions[v + 1] = centre[j * 3 + 1] + ny * thick * 0.8;
        positions[v + 2] = centre[j * 3 + 2] + nz * thick;
        normals[v] = nx;
        normals[v + 1] = ny;
        normals[v + 2] = nz;
      }
    }
    for (const [vertex, j, direction] of [
      [a * armVerts + ringVerts, 0, -1],
      [a * armVerts + ringVerts + 1, SEGMENTS, 1],
    ] as const) {
      const v = vertex * 3,
        k = j ? SEGMENTS - 1 : 0,
        tx = centre[(k + 1) * 3] - centre[k * 3],
        ty = centre[(k + 1) * 3 + 1] - centre[k * 3 + 1],
        tz = centre[(k + 1) * 3 + 2] - centre[k * 3 + 2],
        length = Math.hypot(tx, ty, tz) || 1;
      positions[v] = centre[j * 3];
      positions[v + 1] = centre[j * 3 + 1];
      positions[v + 2] = centre[j * 3 + 2];
      normals[v] = (direction * tx) / length;
      normals[v + 1] = (direction * ty) / length;
      normals[v + 2] = (direction * tz) / length;
    }
  }
}
/** The whole octopus at rest (mantle and arms, merged): the aquarium's resident. */
export function octopusRestGeometry(): THREE.BufferGeometry {
  const arms = octopusArmsGeometry();
  poseOctopusArms(
    arms.positions,
    arms.normals,
    new Float32Array((SEGMENTS + 1) * 3),
    0,
    0,
    1,
    0,
  );
  const mantle = octopusMantleGeometry(),
    flat = arms.geometry.toNonIndexed();
  arms.geometry.dispose();
  const merged = mergeGeometries([mantle, flat], false);
  mantle.dispose();
  flat.dispose();
  if (!merged) throw Error('Octopus could not be built');
  return merged;
}

export interface OctopusColours {
  readonly sand: number;
  readonly rock: number;
  readonly alarm: number;
}

export class Octopus {
  readonly root = new THREE.Group();
  readonly mind: OctopusMind;
  readonly sightings: SightCandidate[] = [];
  private readonly body = new THREE.Group();
  private readonly arms: THREE.Mesh;
  private readonly mantle: THREE.Mesh;
  private readonly den: THREE.Mesh;
  private readonly skin: THREE.MeshStandardMaterial;
  private readonly denMaterial: THREE.MeshStandardMaterial;
  private readonly positions: Float32Array;
  private readonly normals: Float32Array;
  private readonly centre = new Float32Array((SEGMENTS + 1) * 3);
  private readonly sand: THREE.Color;
  private readonly rock: THREE.Color;
  private readonly alarm: THREE.Color;
  private readonly sightAt: Vec3 = { x: 0, y: 0, z: 0 };
  private time = 0;
  private disposed = false;

  constructor(
    den: OctopusDen,
    rocks: readonly Readonly<Vec3>[],
    ground: (x: number, z: number) => number,
    onRock: (x: number, z: number) => boolean,
    colours: OctopusColours,
    sight: { readonly id: string; readonly label: string },
    private readonly size = 1.5,
    seed?: number,
  ) {
    this.root.name = 'Octopus';
    this.mind = new OctopusMind(den, rocks, ground, onRock, seed);
    this.sand = new THREE.Color(colours.sand);
    this.rock = new THREE.Color(colours.rock);
    this.alarm = new THREE.Color(colours.alarm);
    this.skin = new THREE.MeshStandardMaterial({
      name: 'Octopus skin',
      color: colours.rock,
      vertexColors: true,
      roughness: 0.55,
    });
    // The den, at its home.
    this.denMaterial = new THREE.MeshStandardMaterial({
      name: 'Octopus den',
      vertexColors: true,
      roughness: 0.9,
    });
    this.den = new THREE.Mesh(octopusDenGeometry(), this.denMaterial);
    this.den.name = 'Octopus den';
    this.den.position.set(den.x, den.y - 0.03, den.z);
    this.den.rotation.y = den.yaw;
    this.den.scale.setScalar(size * 0.9);
    this.mantle = new THREE.Mesh(octopusMantleGeometry(), this.skin);
    this.mantle.name = 'Octopus mantle';
    // The arms: rings of `SIDES` round each arm's centreline, rewritten each frame.
    const arms = octopusArmsGeometry(),
      armGeometry = arms.geometry;
    this.positions = arms.positions;
    this.normals = arms.normals;
    this.arms = new THREE.Mesh(armGeometry, this.skin);
    this.arms.name = 'Octopus arms';
    this.arms.frustumCulled = false;
    this.body.add(this.mantle, this.arms);
    this.body.scale.setScalar(size);
    this.root.add(this.den, this.body);
    this.sightings.push({
      id: sight.id,
      label: sight.label,
      position: this.sightAt,
      radius: 0.8,
    });
    this.pose();
  }
  /** Write the arms' rings for the current motion. */
  private pose(): void {
    const m = this.mind,
      t = this.time,
      moving = Math.min(1, m.speed / OCTOPUS.creep),
      curl = 1 - 0.6 * moving,
      inDen = m.tucked;
    poseOctopusArms(
      this.positions,
      this.normals,
      this.centre,
      t,
      moving,
      curl,
      inDen,
    );
    const g = this.arms.geometry;
    g.getAttribute('position').needsUpdate = true;
    g.getAttribute('normal').needsUpdate = true;
    // Place it: into the den's mouth as it tucks, breathing (the mantle swells), facing its way.
    const d = m.den,
      back = OCTOPUS.tuck * inDen;
    this.body.position.set(
      m.position.x - Math.sin(d.yaw) * back,
      m.position.y,
      m.position.z - Math.cos(d.yaw) * back,
    );
    this.body.rotation.y = m.heading;
    this.mantle.scale.setScalar(1 + 0.04 * Math.sin(t * 1.6));
    this.sightAt.x = m.position.x;
    this.sightAt.y = m.position.y + 0.2;
    this.sightAt.z = m.position.z;
    // Its colour: sand or rock, darkening with alarm.
    this.skin.color
      .copy(this.sand)
      .lerp(this.rock, m.blend)
      .lerp(this.alarm, 0.75 * m.alarm);
    this.body.scale.setScalar(this.size * (1 - 0.25 * inDen));
  }
  update(
    dt: number,
    active: boolean,
    reducedMotion: boolean,
    player: PlayerPresence,
  ): void {
    if (this.disposed || !active || !(dt > 0)) return;
    const step = Math.min(dt, 0.1);
    this.time += reducedMotion ? step * 0.4 : step;
    this.mind.update(step, player);
    this.pose();
  }
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.root.removeFromParent();
    this.root.clear();
    this.arms.geometry.dispose();
    this.mantle.geometry.dispose();
    this.den.geometry.dispose();
    this.skin.dispose();
    this.denMaterial.dispose();
    this.sightings.length = 0;
  }
}
