import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { KELP } from '../../config/passage';
import { kelpFloor, laneWeight } from './KelpTerrain';

/**
 * v0.6 Pass 032: giant kelp. A few stalk templates (a thin, gently wandering stipe with blades all
 * the way up and a canopy spreading at the surface), drawn instanced: one draw per template. The
 * whole forest sways slowly together, each stalk on its own phase, in the vertex shader; with
 * reduced motion it stands still. Owns its geometries and material.
 */
export const STALKS = {
  /** Template heights (m); the canopy reaches the surface for the tallest. */
  heights: [15.5, 18.5, KELP.surfaceY - 0.6],
  count: 150,
  seed: 32032,
  /** Sway at the top (m), and its slow periods (s). */
  sway: 1.5,
  periods: [17, 23],
  /** Keep the tunnel's exit and the sandy lane open. */
  exitClear: { halfWidth: 5, depth: 6 },
} as const;

export interface StalkPlacement {
  readonly x: number;
  readonly z: number;
  readonly y: number;
  readonly template: number;
  readonly yaw: number;
  readonly scale: number;
}
function random(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}
/** Where the kelp grows (pure, deterministic): in loose groves over the rock, off the lane and exit. */
export function stalkPlacements(
  count: number = STALKS.count,
  seed: number = STALKS.seed,
): StalkPlacement[] {
  const f = KELP.forest,
    rand = random(seed),
    out: StalkPlacement[] = [];
  // Grove centres first, then stalks scattered around them, so the forest has glades between.
  const groves: { x: number; z: number }[] = [];
  for (let i = 0; i < 26; i++)
    groves.push({
      x: -f.halfWidth + rand() * f.halfWidth * 2,
      z: f.minZ + rand() * (f.maxZ - f.minZ),
    });
  for (let tries = 0; out.length < count && tries < count * 40; tries++) {
    const g = groves[Math.floor(rand() * groves.length)],
      a = rand() * Math.PI * 2,
      d = Math.sqrt(rand()) * 6,
      x = g.x + Math.cos(a) * d,
      z = g.z + Math.sin(a) * d,
      template = Math.floor(rand() * STALKS.heights.length),
      yaw = rand() * Math.PI * 2,
      scale = 0.88 + rand() * 0.2;
    if (
      Math.abs(x) > f.halfWidth ||
      z < f.minZ ||
      z > f.maxZ ||
      laneWeight(x, z) > 0.05 ||
      (Math.abs(x) < STALKS.exitClear.halfWidth &&
        z > KELP.tunnel.wallZ - STALKS.exitClear.depth) ||
      out.some((s) => Math.hypot(s.x - x, s.z - z) < 1.4)
    )
      continue;
    out.push({ x, z, y: kelpFloor(x, z) - 0.15, template, yaw, scale });
  }
  return out;
}

/** One stalk template: stipe, blades and canopy, with a height channel for the sway (pure). */
export function stalkTemplate(
  height: number,
  seed: number,
): THREE.BufferGeometry {
  const rand = random(seed),
    parts: THREE.BufferGeometry[] = [],
    lean = (y: number) => 0.35 * Math.sin(y * 0.21 + seed) * (y / height);
  // The stipe: a thin wandering tube, thinner towards the top.
  const segments = Math.ceil(height / 0.9),
    path: THREE.Vector3[] = [];
  for (let i = 0; i <= segments; i++) {
    const y = (i / segments) * height;
    path.push(
      new THREE.Vector3(
        lean(y),
        y,
        0.25 * Math.sin(y * 0.17 + seed * 0.5) * (y / height),
      ),
    );
  }
  const stipe = new THREE.TubeGeometry(
    new THREE.CatmullRomCurve3(path),
    segments,
    0.045,
    5,
    false,
  );
  parts.push(stipe);
  // Blades: alternating up the stipe, each a long, narrow, gently curved strip.
  const blade = (
    y: number,
    angle: number,
    length: number,
    width: number,
    droop: number,
  ) => {
    const steps = 4,
      positions: number[] = [],
      indices: number[] = [],
      dx = Math.cos(angle),
      dz = Math.sin(angle),
      bx = lean(y),
      bz = 0.25 * Math.sin(y * 0.17 + seed * 0.5) * (y / height);
    for (let i = 0; i <= steps; i++) {
      const t = i / steps,
        r = t * length,
        w = width * Math.sin(Math.PI * Math.min(1, t * 1.15 + 0.05)),
        // Up first, then out and drooping (or lifting, for the canopy).
        lift = r * (0.9 - t * 0.9) + droop * t * t;
      for (const side of [-1, 1])
        positions.push(
          bx + dx * r * 0.7 - dz * w * side * 0.5,
          y + lift,
          bz + dz * r * 0.7 + dx * w * side * 0.5,
        );
    }
    for (let i = 0; i < steps; i++) {
      const a = i * 2;
      indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    g.setIndex(indices);
    return g;
  };
  for (let y = 1.1; y < height - 0.8; y += 0.75 + rand() * 0.35)
    parts.push(
      blade(
        y,
        rand() * Math.PI * 2,
        0.9 + rand() * 0.5,
        0.2 + rand() * 0.08,
        -0.3,
      ),
    );
  // The canopy: long blades spreading at the top, floating near the surface.
  for (let i = 0; i < 7; i++)
    parts.push(
      blade(
        height - 0.4,
        (i / 7) * Math.PI * 2 + rand() * 0.5,
        2.2 + rand() * 1.4,
        0.3,
        0.6,
      ),
    );
  // Positions only (normals are computed once, after merging), so every part has the same layout.
  const flat = parts.map((p) => {
    const g = p.index ? p.toNonIndexed() : p.clone();
    for (const name of Object.keys(g.attributes))
      if (name !== 'position') g.deleteAttribute(name);
    return g;
  });
  const merged = mergeGeometries(flat, false);
  flat.forEach((g) => g.dispose());
  parts.forEach((p) => p.dispose());
  if (!merged) throw Error('Kelp template could not be built');
  // Colour: golden olive, deeper towards the holdfast, lighter where the sun reaches the canopy.
  const pos = merged.getAttribute('position'),
    colors = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const t = Math.max(0, Math.min(1, pos.getY(i) / height)),
      k = 0.55 + 0.45 * t + 0.06 * Math.sin(i * 12.9898);
    colors[i * 3] = 0.62 * k;
    colors[i * 3 + 1] = 0.52 * k;
    colors[i * 3 + 2] = 0.2 * k;
  }
  merged.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  merged.computeVertexNormals();
  merged.computeBoundingSphere();
  return merged;
}

/**
 * v0.6 Pass 032: a small stand of kelp for the tank (three stalks), in unit height with blank UVs,
 * ready for the tank's plant conversion and sway (like the library's plants).
 */
export function kelpPatchGeometry(): THREE.BufferGeometry {
  const stalks = [
      { h: 7.5, x: -0.5, z: 0.2, seed: 11 },
      { h: 9, x: 0.45, z: -0.3, seed: 23 },
      { h: 10, x: 0.05, z: 0.5, seed: 37 },
    ].map((s) => {
      const g = stalkTemplate(s.h, s.seed);
      g.translate(s.x, 0, s.z);
      return g;
    }),
    merged = mergeGeometries(stalks, false);
  stalks.forEach((g) => g.dispose());
  if (!merged) throw Error('Kelp patch could not be built');
  merged.computeBoundingBox();
  const top = merged.boundingBox!.max.y;
  merged.scale(1 / top, 1 / top, 1 / top);
  merged.setAttribute(
    'uv',
    new THREE.BufferAttribute(
      new Float32Array(merged.getAttribute('position').count * 2),
      2,
    ),
  );
  merged.computeVertexNormals();
  merged.computeBoundingBox();
  merged.computeBoundingSphere();
  return merged;
}

/** The sway, applied to every stalk vertex by height: none at the holdfast, most at the canopy. */
const SWAY_VERTEX = /* glsl */ `
#include <begin_vertex>
{
  vec4 base = instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
  float phase = base.x * 0.21 + base.z * 0.13;
  float reach = pow(clamp(position.y / kelpHeight, 0.0, 1.0), 1.4) * kelpSway;
  transformed.x += sin(kelpTime * kelpRate.x + phase + position.y * 0.07) * reach;
  transformed.z += cos(kelpTime * kelpRate.y + phase * 1.3) * reach * 0.6;
}`;

export class KelpStalks {
  readonly root = new THREE.Group();
  readonly placements: readonly StalkPlacement[];
  readonly material: THREE.MeshStandardMaterial;
  private readonly time = { value: 0 };
  private readonly geometries: THREE.BufferGeometry[] = [];
  private disposed = false;
  constructor() {
    this.root.name = 'Giant kelp';
    this.placements = stalkPlacements();
    const time = this.time,
      tallest = Math.max(...STALKS.heights);
    this.material = new THREE.MeshStandardMaterial({
      name: 'Kelp',
      vertexColors: true,
      roughness: 0.78,
      metalness: 0,
      side: THREE.DoubleSide,
    });
    this.material.onBeforeCompile = (shader) => {
      shader.uniforms.kelpTime = time;
      shader.uniforms.kelpHeight = { value: tallest };
      shader.uniforms.kelpSway = { value: STALKS.sway };
      shader.uniforms.kelpRate = {
        value: new THREE.Vector2(
          (Math.PI * 2) / STALKS.periods[0],
          (Math.PI * 2) / STALKS.periods[1],
        ),
      };
      shader.vertexShader =
        'uniform float kelpTime;\nuniform float kelpHeight;\nuniform float kelpSway;\nuniform vec2 kelpRate;\n' +
        shader.vertexShader.replace('#include <begin_vertex>', SWAY_VERTEX);
    };
    // A stable key, so the program is compiled once and shared.
    this.material.customProgramCacheKey = () => 'cozy-kelp-sway';
    const m = new THREE.Matrix4(),
      q = new THREE.Quaternion(),
      e = new THREE.Euler(),
      s = new THREE.Vector3(),
      p = new THREE.Vector3();
    STALKS.heights.forEach((height, t) => {
      const geometry = stalkTemplate(height, 101 + t * 37);
      this.geometries.push(geometry);
      const mine = this.placements.filter((k) => k.template === t),
        mesh = new THREE.InstancedMesh(
          geometry,
          this.material,
          Math.max(1, mine.length),
        );
      mesh.name = `Kelp stalks ${t}`;
      mesh.count = mine.length;
      mine.forEach((k, i) => {
        e.set(0, k.yaw, 0);
        q.setFromEuler(e);
        s.setScalar(k.scale);
        p.set(k.x, k.y, k.z);
        mesh.setMatrixAt(i, m.compose(p, q, s));
      });
      mesh.instanceMatrix.needsUpdate = true;
      mesh.computeBoundingSphere();
      // The sway moves vertices beyond the static bounds; the forest is large, so draw it whole.
      mesh.frustumCulled = false;
      this.root.add(mesh);
    });
  }
  /** Advance the sway (seconds of simulation). Frozen with reduced motion or while paused. */
  update(dt: number, active: boolean, reducedMotion: boolean): void {
    if (this.disposed || !active || reducedMotion || !(dt > 0)) return;
    this.time.value += Math.min(dt, 0.1);
  }
  get swayTime(): number {
    return this.time.value;
  }
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.root.removeFromParent();
    this.root.clear();
    this.geometries.forEach((g) => g.dispose());
    this.material.dispose();
  }
}
