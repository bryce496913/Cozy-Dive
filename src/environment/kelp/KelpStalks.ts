import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { KELP } from '../../config/passage';
import {
  inGrottoClear,
  kelpFloor,
  laneWeight,
  overSinkhole,
} from './KelpTerrain';

/**
 * v0.6 Pass 032: giant kelp. A few stalk templates (a thin, gently wandering stipe with blades all
 * the way up and a canopy spreading at the surface), drawn instanced: one draw per template. The
 * whole forest sways slowly together, each stalk on its own phase, in the vertex shader; with
 * reduced motion it stands still. Owns its geometries and material.
 */
export const STALKS = {
  /** Template heights (m); the canopy reaches the surface for the tallest. */
  // V0.7 Pass 071: five templates (was three), so neighbouring plants rarely repeat.
  // V0.8 Pass 085: seven, from young plants well below the canopy to the tallest at the surface,
  // each with its own number of stipes, so stands vary in size and density.
  heights: [14.5, 16, 17.5, 19, KELP.surfaceY - 0.6, 11.5, 13],
  /** Stipes per template (same order). */
  stipes: [3, 4, 2, 3, 5, 2, 3],
  /**
   * V0.8 Pass 085: the current's heading (radians about +y). Plants lean and blades trail down
   * it, each plant within `currentSpread` of it, so the forest flows one way without repeating.
   */
  current: 0.6,
  currentSpread: 0.9,
  count: 110,
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
/**
 * V0.8 Pass 085: a plant's heading from a uniform draw: within `currentSpread` of the current, so
 * every plant's blades trail broadly downstream (a template's blades trail along its local +x).
 */
export function downstream(u: number): number {
  return STALKS.current + (u - 0.5) * 2 * STALKS.currentSpread;
}
/** A rock's footprint on the seabed: centre and across (m). */
export interface RockFootprint {
  readonly x: number;
  readonly z: number;
  readonly size: number;
}
/**
 * V0.8 Pass 091: how far from a rock's centre, as a share of its across, a holdfast may grip the
 * sand, plus a margin for the holdfast itself (m): closer than this the stalk would grow out of the
 * rock, so it grows at the rock's foot instead.
 */
export const ROCK_HOLDFAST = { share: 0.5, margin: 0.3 } as const;
/** True if a holdfast at (x, z) would be inside one of `rocks`. */
export function inRock(
  x: number,
  z: number,
  rocks: readonly RockFootprint[],
): boolean {
  return rocks.some(
    (r) =>
      Math.hypot(r.x - x, r.z - z) <
      r.size * ROCK_HOLDFAST.share + ROCK_HOLDFAST.margin,
  );
}
/**
 * Where the kelp grows (pure, deterministic): in loose groves over the rock, off the lane and exit,
 * and (V0.8 Pass 091) never out of a boulder: holdfasts grip the seabed round the rocks' feet.
 */
export function stalkPlacements(
  count: number = STALKS.count,
  seed: number = STALKS.seed,
  rocks: readonly RockFootprint[] = [],
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
      yaw = downstream(rand()),
      scale = 0.88 + rand() * 0.2;
    if (
      Math.abs(x) > f.halfWidth ||
      z < f.minZ ||
      z > f.maxZ ||
      laneWeight(x, z) > 0.05 ||
      inGrottoClear(x, z, 0.6) ||
      // Kelp grows close round the sinkhole (hiding it), but not out of its mouth.
      overSinkhole(x, z, 0.4) ||
      (Math.abs(x) < STALKS.exitClear.halfWidth &&
        z > KELP.tunnel.wallZ - STALKS.exitClear.depth) ||
      out.some((s) => Math.hypot(s.x - x, s.z - z) < 1.4) ||
      inRock(x, z, rocks)
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
export function wallStalkPlacements(
  seed = 36011,
  rocks: readonly RockFootprint[] = [],
): StalkPlacement[] {
  const rand = random(seed),
    w = KELP.walls,
    out: StalkPlacement[] = [];
  // (inX, inZ): the way into the forest from this wall. V0.8 Pass 091: a stalk that would grow out
  // of a wall rock steps out in front of it, so it grips the sand at the rock's foot.
  const add = (x: number, z: number, inX: number, inZ: number) => {
    for (let step = 0; step < 16 && inRock(x, z, rocks); step++) {
      x += inX * 0.3;
      z += inZ * 0.3;
    }
    out.push({
      x,
      z,
      y: kelpFloor(x, z) - 0.15,
      template: Math.floor(rand() * STALKS.heights.length),
      yaw: downstream(rand()),
      scale: 0.95 + rand() * 0.2,
    });
  };
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
        add(
          side * (w.x - inset - rand() * 0.6),
          z + (rand() - 0.5) * 0.8,
          -side,
          0,
        );
    // The far wall.
    for (let x = -w.x + inset + offset; x < w.x - inset; x += step)
      add(x + (rand() - 0.5) * 0.8, w.farZ + inset + rand() * 0.6, 0, 1);
  }
  return out;
}

/**
 * V0.8 Pass 085: a tube along `curve` whose radius tapers from `r0` to `r1` (Three's TubeGeometry
 * has one radius), six sides; positions only (colour and flex are added by the template).
 */
function taperedTube(
  curve: THREE.Curve<THREE.Vector3>,
  segments: number,
  r0: number,
  r1: number,
): THREE.BufferGeometry {
  const sides = 6,
    frames = curve.computeFrenetFrames(segments, false),
    positions: number[] = [],
    indices: number[] = [],
    p = new THREE.Vector3();
  for (let i = 0; i <= segments; i++) {
    const t = i / segments,
      r = r0 + (r1 - r0) * Math.sqrt(t);
    curve.getPointAt(t, p);
    const n = frames.normals[i],
      b = frames.binormals[i];
    for (let j = 0; j <= sides; j++) {
      const a = (j / sides) * Math.PI * 2,
        c = Math.cos(a),
        s = Math.sin(a);
      positions.push(
        p.x + r * (c * n.x + s * b.x),
        p.y + r * (c * n.y + s * b.y),
        p.z + r * (c * n.z + s * b.z),
      );
    }
  }
  for (let i = 0; i < segments; i++)
    for (let j = 0; j < sides; j++) {
      const a = i * (sides + 1) + j,
        b = a + sides + 1;
      indices.push(a, b, a + 1, b, b + 1, a + 1);
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.setIndex(indices);
  return g;
}

/**
 * One kelp plant template: a holdfast sending up several stipes that lean apart a little, each
 * hung with long, wavy golden-brown blades all the way up and spreading into a canopy at the top.
 * Positions and colours only; normals are computed once after merging (pure).
 */
export function stalkTemplate(
  height: number,
  seed: number,
  stipes = 3,
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
        new THREE.TubeGeometry(curve, 6, 0.025 + rand() * 0.015, 5, false),
        0.3,
        0.22,
        0.1,
      ),
    );
  }
  // V0.8 Pass 085: the holdfast's crown, a low knotted mound the stipes rise out of, so they
  // grow from it instead of from a point among the haptera.
  const crown = new THREE.SphereGeometry(
    0.24,
    10,
    6,
    0,
    Math.PI * 2,
    0,
    Math.PI / 2,
  );
  crown.scale(1, 0.75, 1);
  crown.translate(0, 0.08, 0);
  parts.push(tone(crown, 0.32, 0.24, 0.1));
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
    // V0.8 Pass 085: tapering, thick at the holdfast and fine under the canopy.
    parts.push(
      tone(
        taperedTube(new THREE.CatmullRomCurve3(path), segments, 0.06, 0.022),
        0.42,
        0.34,
        0.12,
      ),
    );
    // Blades every 30-45 cm, each hanging from the stipe on its own side, trailing up and out.
    // Each blade grows from a small gas bulb (a pneumatocyst) that holds it up in the water.
    // V0.8 Pass 085: fewer, longer blades (one every 50-75 cm), trailing broadly downstream (+x),
    // arching out and drooping, the lowest heaviest.
    for (let y = 0.7; y < tall - 0.6; y += 0.5 + rand() * 0.25) {
      const base = at(y),
        angle = (rand() - 0.5) * 2.6,
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
            1.3 + rand() * 0.9,
            0.17 + rand() * 0.07,
            0.1,
            rand,
            0.75 - 0.35 * (y / tall),
          ),
          0.7 * v,
          0.5 * v,
          0.15 * v,
        ),
      );
    }
    // The canopy: long blades fanning out where the stipe reaches the top, lying out down the
    // current (V0.8 Pass 085: four to eight, mostly downstream, so canopies differ).
    const canopy = 4 + Math.floor(rand() * 5);
    for (let i = 0; i < canopy; i++) {
      const v = 0.9 + rand() * 0.25;
      parts.push(
        tone(
          blade(
            at(tall - 0.3),
            (rand() - 0.5) * 3.4,
            2.2 + rand() * 1.8,
            0.32,
            -0.9,
            rand,
            0.35,
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
  // V0.7 Pass 071: smooth normals per part (computed while indexed and kept through the merge;
  // recomputing after de-indexing shaded every facet flat), and a flex weight for the blade flutter
  // (0 on holdfast, stipe and bulbs; rising along each blade).
  const flat = parts.map((p) => {
    for (const name of Object.keys(p.attributes))
      if (name !== 'position' && name !== 'color' && name !== 'kelpFlex')
        p.deleteAttribute(name);
    p.computeVertexNormals();
    if (!p.getAttribute('kelpFlex'))
      p.setAttribute(
        'kelpFlex',
        new THREE.Float32BufferAttribute(
          new Float32Array(p.getAttribute('position').count),
          1,
        ),
      );
    const g = p.index ? p.toNonIndexed() : p.clone();
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
  merged.computeBoundingSphere();
  return merged;
}
/**
 * A kelp blade (V0.8 Pass 085): a long, lanceolate, ruffled strip on a short stalk, rising from
 * `base` toward `angle`, arching out and then drooping with the current (`droop`), twisting along
 * its length; `lift` lets a canopy blade lie out flat. Ten segments of four quads across (edge,
 * blade, blade, edge) with a gentle cupped cross-section and ruffled, wavy margins, so it catches
 * the light as a curved, living sheet (Pass 071's blades were straight, angular strips).
 */
function blade(
  base: THREE.Vector3,
  angle: number,
  length: number,
  width: number,
  lift: number,
  rand: () => number,
  droop = 0.5,
): THREE.BufferGeometry {
  const steps = 10,
    across = [-1, -0.4, 0.4, 1],
    positions: number[] = [],
    flex: number[] = [],
    light: number[] = [],
    indices: number[] = [],
    dx = Math.cos(angle),
    dz = Math.sin(angle),
    rise = 0.55 + rand() * 0.3,
    sag = droop * (0.7 + rand() * 0.6),
    ripple = rand() * 6,
    swerve = (rand() - 0.5) * 0.35,
    twist = (rand() - 0.5) * 2.4,
    cup = 0.12 + rand() * 0.1;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps,
      // Lanceolate: a short narrow stalk, widest about a third along, a long taper to a soft tip.
      w =
        width *
        Math.min(1, t * 6 + 0.12) *
        Math.pow(Math.max(0, 1 - Math.pow(t, 1.7)), 0.75) *
        (1 + 0.12 * Math.sin(t * 9 + ripple)),
      // The centreline arches out and up, then droops toward the tip.
      out = t * length * 0.8,
      up = length * (rise * t - sag * t * t) + lift * t * t,
      side = length * swerve * Math.sin(Math.PI * t),
      cx = base.x + dx * out - dz * side,
      cz = base.z + dz * out + dx * side,
      cy = base.y + up,
      // Twisting: the blade's across direction turns about its length.
      tw = twist * t,
      ax = -dz * Math.cos(tw),
      az = dx * Math.cos(tw),
      ay = Math.sin(tw);
    for (const s of across) {
      const half = w * 0.5 * s,
        // Cupped across its width, ruffled along its margins.
        edge = Math.abs(s) > 0.9 ? 1 : 0,
        ruffle =
          edge *
          w *
          (0.16 * Math.sin(t * 13 + ripple + s) + 0.06 * Math.sin(t * 29)),
        bow = -cup * w * (1 - s * s) + ruffle;
      positions.push(cx + ax * half, cy + ay * half + bow, cz + az * half);
      flex.push(t);
      const k = (0.72 + 0.42 * t) * (Math.abs(s) < 0.5 ? 0.92 : 1);
      light.push(k, k, k);
    }
  }
  const cols = across.length;
  for (let i = 0; i < steps; i++)
    for (let c = 0; c < cols - 1; c++) {
      const a = i * cols + c;
      indices.push(a, a + 1, a + cols, a + 1, a + cols + 1, a + cols);
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(light, 3));
  g.setAttribute('kelpFlex', new THREE.Float32BufferAttribute(flex, 1));
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
  merged.deleteAttribute('kelpFlex');
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
  float h = clamp(position.y / kelpHeight, 0.0, 1.0);
  // V0.7 Pass 071: continuous bending, not a rigid lean: the sway is a slow wave travelling up
  // the stipe (each height lags the one below), so the plant curves through the water. Slow,
  // uneven gusts (on each plant's own phase) keep the forest from swaying in step.
  float gust = 0.72 + 0.28 * sin(kelpTime * 0.071 + phase * 0.37) * sin(kelpTime * 0.043 + phase);
  float reach = pow(h, 1.4) * kelpSway * gust;
  float lag = position.y * 0.11;
  transformed.x += sin(kelpTime * kelpRate.x + phase - lag) * reach;
  transformed.z += cos(kelpTime * kelpRate.y + phase * 1.3 - lag * 0.8) * reach * 0.6;
  // Blades flutter along their length: small, quicker, and stronger toward their tips.
  float flutter = kelpFlex * kelpFlex * 0.14 * (0.4 + 0.6 * h);
  transformed.y += sin(kelpTime * 0.9 + phase * 3.0 + position.y * 1.3 + position.x * 2.1) * flutter;
  transformed.x += sin(kelpTime * 0.7 + phase * 2.0 + position.y * 0.9) * flutter * 0.6;
  // Playtest: stalks lean aside as the swimmer passes through, most at the swimmer's height and
  // not at the holdfast, easing off over a couple of metres. (World offset into the instance's
  // frame: its rotation is yaw only and its scale uniform, so the inverse is the transpose / s².)
  vec3 world = (instanceMatrix * vec4(transformed, 1.0)).xyz;
  vec3 away = world - kelpSwimmer.xyz;
  float across = length(away.xz);
  float near = 1.0 - smoothstep(0.0, kelpPushRadius, across);
  float level = 1.0 - smoothstep(0.0, 3.5, abs(away.y));
  float bend = clamp(position.y / 1.5, 0.0, 1.0);
  vec2 dir = across > 1e-3 ? away.xz / across : vec2(1.0, 0.0);
  vec3 push = vec3(dir.x, 0.0, dir.y) * near * level * bend * kelpSwimmer.w;
  mat3 m = mat3(instanceMatrix);
  transformed += (transpose(m) * push) / max(dot(m[0], m[0]), 1e-4);
}`;
/** Playtest: how far, and how strongly (m), stalks lean away from the swimmer. */
export const KELP_PUSH = { radius: 1.8, strength: 0.9, follow: 4 } as const;

export class KelpStalks {
  readonly root = new THREE.Group();
  readonly placements: readonly StalkPlacement[];
  readonly material: THREE.MeshStandardMaterial;
  private readonly time = { value: 0 };
  /** The swimmer's position (xyz) and push strength (w), eased so the kelp springs back. */
  private readonly swimmer = { value: new THREE.Vector4(0, -1000, 0, 0) };
  private readonly geometries: THREE.BufferGeometry[] = [];
  private disposed = false;
  /** @param rocks V0.8 Pass 091: the forest's boulders and wall rocks, which the kelp grows round. */
  constructor(rocks: readonly RockFootprint[] = []) {
    this.root.name = 'Giant kelp';
    // v0.6 Pass 036: the forest, and the dense kelp along its walls.
    this.placements = [
      ...stalkPlacements(STALKS.count, STALKS.seed, rocks),
      ...wallStalkPlacements(undefined, rocks),
    ];
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
      shader.uniforms.kelpSwimmer = this.swimmer;
      shader.uniforms.kelpPushRadius = { value: KELP_PUSH.radius };
      shader.uniforms.kelpRate = {
        value: new THREE.Vector2(
          (Math.PI * 2) / STALKS.periods[0],
          (Math.PI * 2) / STALKS.periods[1],
        ),
      };
      shader.vertexShader =
        'attribute float kelpFlex;\nuniform float kelpTime;\nuniform float kelpHeight;\nuniform float kelpSway;\nuniform vec2 kelpRate;\nuniform vec4 kelpSwimmer;\nuniform float kelpPushRadius;\n' +
        shader.vertexShader.replace('#include <begin_vertex>', SWAY_VERTEX);
    };
    // A stable key, so the program is compiled once and shared.
    this.material.customProgramCacheKey = () => 'cozy-kelp-sway-2';
    const m = new THREE.Matrix4(),
      q = new THREE.Quaternion(),
      e = new THREE.Euler(),
      s = new THREE.Vector3(),
      p = new THREE.Vector3();
    STALKS.heights.forEach((height, t) => {
      const geometry = stalkTemplate(height, 101 + t * 37, STALKS.stipes[t]);
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
  update(
    dt: number,
    active: boolean,
    reducedMotion: boolean,
    swimmer?: { x: number; y: number; z: number },
  ): void {
    if (this.disposed || !active || !(dt > 0)) return;
    // The lean follows the swimmer smoothly (it still happens with reduced motion: it is the
    // world answering the player, not camera motion).
    const s = this.swimmer.value,
      k = 1 - Math.exp(-KELP_PUSH.follow * Math.min(dt, 0.1));
    if (swimmer) {
      if (s.y < -999) s.set(swimmer.x, swimmer.y, swimmer.z, 0);
      s.x += (swimmer.x - s.x) * k;
      s.y += (swimmer.y - s.y) * k;
      s.z += (swimmer.z - s.z) * k;
    }
    s.w += ((swimmer ? KELP_PUSH.strength : 0) - s.w) * k;
    if (reducedMotion) return;
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
