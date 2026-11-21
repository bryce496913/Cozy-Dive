import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { organicTube, smoothed } from './organicGeometry';

/**
 * V0.7 Pass 079 (playtest: "the ice and cave areas still feel empty ... add larger plant life"):
 * tall, swaying algae that give a big open floor vertical structure, as the kelp does in the kelp
 * forest. Two forms, both instanced (one draw each), vertex-coloured, with a `sway` attribute
 * (0 at the holdfast, 1 at the tip) that bends them in the current in the vertex shader:
 *
 * - **Strap algae:** a short stipe carrying one long, flat, wavy-edged strap blade (as the giant
 *   Antarctic brown alga *Himantothallus* does, and the strap kelps of sea caves), 1.5-4 m tall.
 * - **Bushy algae:** a stipe forking into many fine branching fronds (as *Desmarestia*), about 1 m.
 *
 * Allocation-free per frame; owns its geometry and materials.
 */
type RGB = readonly [number, number, number];

function random(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/** Colour and sway (by height, 0 at the base) for a position-only part. */
function finish(
  g: THREE.BufferGeometry,
  height: number,
  base: RGB,
  tip: RGB,
): THREE.BufferGeometry {
  const out = smoothed(g),
    p = out.getAttribute('position'),
    col = new Float32Array(p.count * 3),
    sway = new Float32Array(p.count);
  for (let i = 0; i < p.count; i++) {
    const u = Math.max(0, Math.min(1, p.getY(i) / height)),
      speck = 0.92 + 0.08 * Math.sin(i * 12.9898);
    for (let k = 0; k < 3; k++)
      col[i * 3 + k] = (base[k] + (tip[k] - base[k]) * u) * speck;
    sway[i] = u;
  }
  out.setAttribute('color', new THREE.BufferAttribute(col, 3));
  out.setAttribute('sway', new THREE.BufferAttribute(sway, 1));
  return out;
}

/** One strap alga, unit-ish: `height` m tall, its blade curving over in a gentle arc. */
export function strapAlgaGeometry(
  height: number,
  seed: number,
  base: RGB,
  tip: RGB,
): THREE.BufferGeometry {
  const rand = random(seed),
    parts: THREE.BufferGeometry[] = [];
  const stipe = height * 0.12;
  parts.push(
    organicTube(
      [
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(0.01, stipe * 0.5, 0),
        new THREE.Vector3(0, stipe, 0.01),
      ],
      (u) => 0.03 * (1 - 0.4 * u) + 0.02 * Math.exp(-u * 12),
      6,
      7,
    ),
  );
  // The blade: a long ribbon widening then tapering, its margins rippled, leaning over.
  const rows = 40,
    cols = 5,
    lean = 0.25 + rand() * 0.25,
    twist = (rand() - 0.5) * 0.6,
    width = height * (0.1 + rand() * 0.04),
    pos: number[] = [],
    idx: number[] = [];
  for (let i = 0; i <= rows; i++) {
    const u = i / rows,
      y = stipe + (height - stipe) * u * (1 - 0.18 * lean * u),
      bend = lean * height * u * u * 0.5,
      w = width * Math.sin(Math.PI * Math.min(1, 0.08 + u * 0.95)) ** 0.6,
      a = twist * u;
    for (let j = 0; j <= cols; j++) {
      const x = (j / cols - 0.5) * 2,
        ripple = x * x * w * 0.12 * Math.sin(u * 16 + x * 1.5 + seed),
        lx = x * w * 0.5,
        lz = ripple + bend;
      pos.push(
        lx * Math.cos(a) - lz * Math.sin(a),
        y,
        lx * Math.sin(a) + lz * Math.cos(a),
      );
    }
  }
  for (let i = 0; i < rows; i++)
    for (let j = 0; j < cols; j++) {
      const q = i * (cols + 1) + j;
      idx.push(q, q + cols + 1, q + 1, q + 1, q + cols + 1, q + cols + 2);
    }
  const blade = new THREE.BufferGeometry();
  blade.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  blade.setIndex(idx);
  parts.push(blade);
  const merged = mergeGeometries(
    parts.map((g) => finish(g, height, base, tip)),
    false,
  );
  parts.forEach((g) => g.dispose());
  if (!merged) throw Error('Strap alga could not be built');
  return merged;
}

/** One bushy alga about `height` m tall: a stipe forking into fine branching fronds. */
export function bushyAlgaGeometry(
  height: number,
  seed: number,
  base: RGB,
  tip: RGB,
): THREE.BufferGeometry {
  const rand = random(seed),
    parts: THREE.BufferGeometry[] = [];
  const grow = (
    from: THREE.Vector3,
    dir: THREE.Vector3,
    length: number,
    r: number,
    depth: number,
  ) => {
    const end = from.clone().addScaledVector(dir, length),
      mid = from
        .clone()
        .lerp(end, 0.5)
        .add(
          new THREE.Vector3(
            (rand() - 0.5) * length * 0.2,
            0,
            (rand() - 0.5) * length * 0.2,
          ),
        );
    parts.push(organicTube([from, mid, end], (u) => r * (1 - 0.55 * u), 6, 5));
    if (depth <= 0) return;
    const n = depth > 1 ? 4 : 5;
    for (let k = 0; k < n; k++) {
      const a = rand() * Math.PI * 2,
        d = new THREE.Vector3(Math.cos(a) * 0.55, 0.85, Math.sin(a) * 0.55)
          .add(dir.clone().multiplyScalar(0.4))
          .normalize();
      grow(
        from.clone().lerp(end, 0.55 + rand() * 0.45),
        d,
        length * (0.55 + rand() * 0.15),
        r * 0.6,
        depth - 1,
      );
    }
  };
  grow(
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0, 1, 0),
    height * 0.45,
    0.024,
    2,
  );
  const merged = mergeGeometries(
    parts.map((g) => finish(g, height, base, tip)),
    false,
  );
  parts.forEach((g) => g.dispose());
  if (!merged) throw Error('Bushy alga could not be built');
  return merged;
}

export interface AlgaPlacement {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly scale: number;
  readonly yaw: number;
}

/** The vertex bend: tips lag in the current, each plant on its own phase (from its position). */
const SWAY_GLSL = /* glsl */ `
  #ifdef USE_INSTANCING
    vec3 swayAt = instanceMatrix[3].xyz;
  #else
    vec3 swayAt = vec3(0.0);
  #endif
  float swayPhase = swayAt.x * 0.37 + swayAt.z * 0.29;
  float swayK = sway * sway * swayAmount;
  transformed.x += swayK * sin(swayTime * 0.55 + swayPhase - sway * 1.3);
  transformed.z += swayK * 0.6 * cos(swayTime * 0.42 + swayPhase * 1.3 - sway * 1.1);
`;

/** Instanced, swaying algae of one form: build, animate (`update`) and dispose. */
export class SwayingAlgae {
  readonly mesh: THREE.InstancedMesh;
  private readonly material: THREE.MeshStandardMaterial;
  private readonly time = { value: 0 };
  private disposed = false;
  constructor(
    name: string,
    readonly geometry: THREE.BufferGeometry,
    placements: readonly AlgaPlacement[],
    amount: number,
    roughness = 0.7,
  ) {
    this.material = new THREE.MeshStandardMaterial({
      name,
      vertexColors: true,
      roughness,
      side: THREE.DoubleSide,
    });
    const amountUniform = { value: amount };
    this.material.onBeforeCompile = (shader) => {
      shader.uniforms.swayTime = this.time;
      shader.uniforms.swayAmount = amountUniform;
      shader.vertexShader = shader.vertexShader
        .replace(
          '#include <common>',
          '#include <common>\nattribute float sway;\nuniform float swayTime;\nuniform float swayAmount;',
        )
        .replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>\n${SWAY_GLSL}`,
        );
    };
    this.material.customProgramCacheKey = () => 'cozy-swaying-algae-v1';
    this.mesh = new THREE.InstancedMesh(
      geometry,
      this.material,
      placements.length,
    );
    this.mesh.name = name;
    const m = new THREE.Matrix4(),
      q = new THREE.Quaternion(),
      up = new THREE.Vector3(0, 1, 0);
    placements.forEach((p, i) => {
      q.setFromAxisAngle(up, p.yaw);
      m.compose(
        new THREE.Vector3(p.x, p.y, p.z),
        q,
        new THREE.Vector3(p.scale, p.scale, p.scale),
      );
      this.mesh.setMatrixAt(i, m);
    });
    this.mesh.computeBoundingSphere();
  }
  /** Simulation time only; frozen with reduced motion. */
  update(dt: number, active: boolean, reducedMotion: boolean): void {
    if (this.disposed || !active || reducedMotion || !(dt > 0)) return;
    this.time.value += Math.min(dt, 0.1);
  }
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.mesh.removeFromParent();
    this.mesh.dispose();
    this.geometry.dispose();
    this.material.dispose();
  }
}
