import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { KELP } from '../../config/passage';
import { inGrottoClear, kelpFloor, laneWeight } from './KelpTerrain';

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
      inGrottoClear(x, z, 0.6) ||
      (Math.abs(x) < STALKS.exitClear.halfWidth &&
        z > KELP.tunnel.wallZ - STALKS.exitClear.depth) ||
      out.some((s) => Math.hypot(s.x - x, s.z - z) < 1.4)
    )
      continue;
    out.push({ x, z, y: kelpFloor(x, z) - 0.15, template, yaw, scale });
  }
  return out;
}

/**
 * v0.6 Pass 036: the dense band of kelp in front of the forest's rock walls (sides and far end),
 * so the walls read as a thicket of kelp over rock: two staggered rows, close together (pure).
 */
export function wallStalkPlacements(seed = 36011): StalkPlacement[] {
  const rand = random(seed),
    w = KELP.walls,
    out: StalkPlacement[] = [];
  const add = (x: number, z: number) =>
    out.push({
      x,
      z,
      y: kelpFloor(x, z) - 0.15,
      template: Math.floor(rand() * STALKS.heights.length),
      yaw: rand() * Math.PI * 2,
      scale: 0.95 + rand() * 0.2,
    });
  for (const [inset, step, offset] of [
    [1.2, 2.2, 0],
    [3, 3.2, 1.1],
  ] as const) {
    // The side walls, from the tunnel's wall to the far end.
    for (const side of [-1, 1])
      for (
        let z = KELP.tunnel.wallZ - 2 - offset;
        z > w.farZ + inset;
        z -= step
      )
        add(side * (w.x - inset - rand() * 0.6), z + (rand() - 0.5) * 0.8);
    // The far wall.
    for (let x = -w.x + inset + offset; x < w.x - inset; x += step)
      add(x + (rand() - 0.5) * 0.8, w.farZ + inset + rand() * 0.6);
  }
  return out;
}

/**
 * One kelp plant template: a holdfast sending up several stipes that lean apart a little, each
 * hung with long, wavy golden-brown blades all the way up and spreading into a canopy at the top.
 * Positions and colours only; normals are computed once after merging (pure).
 */
export function stalkTemplate(
  height: number,
  seed: number,
): THREE.BufferGeometry {
  const rand = random(seed),
    parts: THREE.BufferGeometry[] = [];
  /** Give a part its own colour (blades shade lighter towards their tips; see `blade`). */
  const tone = (g: THREE.BufferGeometry, r: number, gr: number, b: number) => {
    const n = g.getAttribute('position').count,
      existing = g.getAttribute('color'),
      c = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const k = existing ? existing.getX(i) : 1;
      c[i * 3] = r * k;
      c[i * 3 + 1] = gr * k;
      c[i * 3 + 2] = b * k;
    }
    g.setAttribute('color', new THREE.Float32BufferAttribute(c, 3));
    return g;
  };
  // The holdfast: a tangle of root-like haptera spreading over the rock.
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2 + rand() * 0.4,
      reach = 0.35 + rand() * 0.3,
      curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(0, 0.25, 0),
        new THREE.Vector3(
          Math.cos(a) * reach * 0.45,
          0.22 + rand() * 0.08,
          Math.sin(a) * reach * 0.45,
        ),
        new THREE.Vector3(Math.cos(a) * reach, 0.02, Math.sin(a) * reach),
      ]);
    parts.push(
      tone(
        new THREE.TubeGeometry(curve, 5, 0.025 + rand() * 0.015, 4, false),
        0.3,
        0.22,
        0.1,
      ),
    );
  }
  const stipes = 3;
  for (let k = 0; k < stipes; k++) {
    const tall = height * (k === 0 ? 1 : 0.72 + rand() * 0.22),
      lean = rand() * Math.PI * 2,
      spread = 0.25 + rand() * 0.35,
      phase = rand() * 6;
    // A gently wandering centreline that leans out from the holdfast.
    const at = (y: number) => {
      const t = y / tall;
      return new THREE.Vector3(
        Math.cos(lean) * spread * t + 0.3 * Math.sin(y * 0.21 + phase) * t,
        y,
        Math.sin(lean) * spread * t + 0.25 * Math.cos(y * 0.17 + phase) * t,
      );
    };
    const segments = Math.ceil(tall / 0.9),
      path: THREE.Vector3[] = [];
    for (let i = 0; i <= segments; i++) path.push(at((i / segments) * tall));
    parts.push(
      tone(
        new THREE.TubeGeometry(
          new THREE.CatmullRomCurve3(path),
          segments,
          0.04,
          4,
          false,
        ),
        0.42,
        0.34,
        0.12,
      ),
    );
    // Blades every 30-45 cm, each hanging from the stipe on its own side, trailing up and out.
    // Each blade grows from a small gas bulb (a pneumatocyst) that holds it up in the water.
    for (let y = 0.7; y < tall - 0.6; y += 0.3 + rand() * 0.15) {
      const base = at(y),
        angle = rand() * Math.PI * 2,
        bulb = new THREE.IcosahedronGeometry(0.05 + rand() * 0.02, 0);
      bulb.scale(1, 1.4, 1);
      bulb.translate(
        base.x + Math.cos(angle) * 0.06,
        base.y + 0.04,
        base.z + Math.sin(angle) * 0.06,
      );
      parts.push(tone(bulb, 0.62, 0.5, 0.16));
      const v = 0.85 + rand() * 0.3;
      parts.push(
        tone(
          blade(
            base,
            angle,
            1.1 + rand() * 0.7,
            0.24 + rand() * 0.1,
            0.2,
            rand,
          ),
          0.7 * v,
          0.5 * v,
          0.15 * v,
        ),
      );
    }
    // The canopy: long blades fanning out where the stipe reaches the top.
    for (let i = 0; i < 6; i++) {
      const v = 0.9 + rand() * 0.25;
      parts.push(
        tone(
          blade(
            at(tall - 0.3),
            (i / 6) * Math.PI * 2 + rand() * 0.6,
            2 + rand() * 1.6,
            0.32,
            -0.9,
            rand,
          ),
          0.78 * v,
          0.56 * v,
          0.17 * v,
        ),
      );
    }
  }
  // Positions and colours only (normals are computed once, after merging), so every part has
  // the same layout.
  const flat = parts.map((p) => {
    const g = p.index ? p.toNonIndexed() : p.clone();
    for (const name of Object.keys(g.attributes))
      if (name !== 'position' && name !== 'color') g.deleteAttribute(name);
    return g;
  });
  parts.forEach((p) => p.dispose());
  const merged = mergeGeometries(flat, false);
  flat.forEach((g) => g.dispose());
  if (!merged) throw Error('Kelp template could not be built');
  // Deeper towards the holdfast, brighter where the sun reaches the canopy.
  const pos = merged.getAttribute('position'),
    tones = merged.getAttribute('color'),
    colors = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const t = Math.max(0, Math.min(1, pos.getY(i) / height)),
      k = 0.62 + 0.38 * t,
      n = 0.92 + 0.08 * Math.sin(i * 0.731);
    colors[i * 3] = tones.getX(i) * k * n;
    colors[i * 3 + 1] = tones.getY(i) * k * n;
    colors[i * 3 + 2] = tones.getZ(i) * k * n;
  }
  merged.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  merged.computeVertexNormals();
  merged.computeBoundingSphere();
  return merged;
}
/**
 * A kelp blade: a long, narrow strip with a wavy edge, rising from `base` towards `angle`, then
 * trailing out; `lift` bends its tip up (positive) or lets it hang flat (negative, the canopy).
 */
function blade(
  base: THREE.Vector3,
  angle: number,
  length: number,
  width: number,
  lift: number,
  rand: () => number,
): THREE.BufferGeometry {
  const steps = 8,
    positions: number[] = [],
    indices: number[] = [],
    dx = Math.cos(angle),
    dz = Math.sin(angle),
    rise = 0.55 + rand() * 0.3,
    ripple = rand() * 6;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps,
      r = t * length,
      w =
        width *
        Math.sin(Math.PI * Math.min(1, t * 1.05 + 0.08)) *
        (1 + 0.15 * Math.sin(t * 9 + ripple)) *
        // Ruffled edges, as giant kelp blades have.
        (1 + 0.08 * Math.sin(t * 31 + ripple * 2)),
      up = r * rise * (1 - t * 0.6) + lift * t * t;
    for (const side of [-1, 1])
      positions.push(
        base.x + dx * r * 0.75 - dz * w * side * 0.5,
        base.y +
          up +
          side *
            w *
            (0.12 * Math.sin(t * 7 + ripple) + 0.05 * Math.sin(t * 23)),
        base.z + dz * r * 0.75 + dx * w * side * 0.5,
      );
  }
  for (let i = 0; i < steps; i++) {
    const a = i * 2;
    indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  // Lightness (in the red channel; `tone` multiplies it in): darker at the base, paler at the tip.
  const light: number[] = [];
  for (let i = 0; i <= steps; i++) {
    const k = 0.75 + 0.4 * (i / steps);
    light.push(k, k, k, k, k, k);
  }
  g.setAttribute('color', new THREE.Float32BufferAttribute(light, 3));
  g.setIndex(indices);
  return g;
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
    // v0.6 Pass 036: the forest, and the dense kelp along its walls.
    this.placements = [...stalkPlacements(), ...wallStalkPlacements()];
    const time = this.time,
      tallest = Math.max(...STALKS.heights);
    this.material = new THREE.MeshStandardMaterial({
      name: 'Kelp',
      vertexColors: true,
      roughness: 0.7,
      metalness: 0,
      // A little light seems to come through the blades, as it does in sunlit kelp.
      emissive: 0x3a2306,
      emissiveIntensity: 0.45,
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
