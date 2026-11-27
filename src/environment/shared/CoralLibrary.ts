import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export type CoralFamily =
  'branching' | 'massive' | 'brain' | 'plate' | 'fan' | 'soft';

export interface CoralBuild {
  readonly family: CoralFamily;
  readonly seed: number;
  readonly detail?: 0 | 1;
}

function rng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function finish(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const expanded = parts.map((part) => {
    part.computeVertexNormals();
    const geometry = part.index ? part.toNonIndexed() : part;
    if (geometry !== part) part.dispose();
    geometry.deleteAttribute('uv');
    return geometry;
  });
  const geometry = mergeGeometries(expanded, false)!;
  expanded.forEach((part) => part.dispose());
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

function tone(geometry: THREE.BufferGeometry, family: CoralFamily): void {
  const position = geometry.getAttribute('position');
  const color = new Float32Array(position.count * 3);
  const base =
    family === 'brain'
      ? [0.92, 0.72, 0.6]
      : family === 'massive'
        ? [0.82, 0.68, 0.6]
        : family === 'plate'
          ? [0.86, 0.72, 0.82]
          : family === 'fan'
            ? [0.72, 0.45, 0.62]
            : family === 'soft'
              ? [0.88, 0.55, 0.62]
              : [0.78, 0.55, 0.48];
  for (let i = 0; i < position.count; i++) {
    const height = Math.max(0, Math.min(1, position.getY(i)));
    const shade = 0.78 + height * 0.2;
    color.set(
      base.map((channel) => channel * shade),
      i * 3,
    );
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(color, 3));
}

function taperedBranch(
  points: readonly THREE.Vector3[],
  startRadius: number,
  endRadius: number,
  sides: number,
): THREE.BufferGeometry {
  const curve = new THREE.CatmullRomCurve3([...points]),
    segments = Math.max(3, points.length * 2),
    vertices: number[] = [],
    indices: number[] = [],
    tangent = new THREE.Vector3(),
    normal = new THREE.Vector3(),
    binormal = new THREE.Vector3(),
    previous = new THREE.Vector3(0, 0, 1);
  for (let row = 0; row <= segments; row++) {
    const t = row / segments,
      centre = curve.getPoint(t);
    curve.getTangent(t, tangent).normalize();
    normal.crossVectors(tangent, previous);
    if (normal.lengthSq() < 1e-5) normal.set(1, 0, 0);
    normal.normalize();
    binormal.crossVectors(tangent, normal).normalize();
    previous.copy(normal);
    const radius = THREE.MathUtils.lerp(startRadius, endRadius, t);
    for (let side = 0; side < sides; side++) {
      const angle = (side / sides) * Math.PI * 2,
        radial = normal
          .clone()
          .multiplyScalar(Math.cos(angle) * radius)
          .addScaledVector(binormal, Math.sin(angle) * radius);
      vertices.push(
        centre.x + radial.x,
        centre.y + radial.y,
        centre.z + radial.z,
      );
    }
  }
  for (let row = 0; row < segments; row++)
    for (let side = 0; side < sides; side++) {
      const a = row * sides + side,
        b = row * sides + ((side + 1) % sides),
        c = a + sides,
        d = b + sides;
      indices.push(a, c, b, b, c, d);
    }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(vertices, 3),
  );
  geometry.setIndex(indices);
  return geometry;
}

function branching(seed: number, detail: 0 | 1): THREE.BufferGeometry {
  const random = rng(seed),
    parts: THREE.BufferGeometry[] = [],
    base = new THREE.IcosahedronGeometry(0.32, detail);
  base.scale(1.45, 0.28, 1.2);
  base.translate(0, 0.08, 0);
  parts.push(base);
  const count = detail ? 7 : 5;
  for (let branch = 0; branch < count; branch++) {
    const angle = (branch / count) * Math.PI * 2 + random() * 0.55,
      start = new THREE.Vector3(
        Math.cos(angle) * 0.12,
        0.1,
        Math.sin(angle) * 0.12,
      ),
      shoulder = new THREE.Vector3(
        Math.cos(angle) * (0.24 + random() * 0.16),
        0.35 + random() * 0.2,
        Math.sin(angle) * (0.24 + random() * 0.16),
      ),
      tip = shoulder
        .clone()
        .add(
          new THREE.Vector3(
            Math.cos(angle + (random() - 0.5) * 0.7) * (0.25 + random() * 0.22),
            0.34 + random() * 0.28,
            Math.sin(angle + (random() - 0.5) * 0.7) * (0.25 + random() * 0.22),
          ),
        );
    parts.push(
      taperedBranch([start, shoulder, tip], 0.11, 0.045, detail ? 7 : 5),
    );
    if (detail || branch % 2 === 0) {
      const fork = shoulder.clone().lerp(tip, 0.58),
        forkAngle = angle + (branch % 2 ? -1 : 1) * (0.65 + random() * 0.35),
        forkTip = fork
          .clone()
          .add(
            new THREE.Vector3(
              Math.cos(forkAngle) * (0.18 + random() * 0.14),
              0.22 + random() * 0.18,
              Math.sin(forkAngle) * (0.18 + random() * 0.14),
            ),
          );
      parts.push(taperedBranch([fork, forkTip], 0.065, 0.03, detail ? 6 : 5));
    }
  }
  return finish(parts);
}

function massive(
  seed: number,
  brain: boolean,
  detail: 0 | 1,
): THREE.BufferGeometry {
  const random = rng(seed),
    sides = detail ? 18 : 12,
    rings = detail ? 7 : 5,
    vertices: number[] = [],
    indices: number[] = [];
  for (let ring = 0; ring <= rings; ring++) {
    const t = ring / rings,
      radius =
        Math.sin(t * Math.PI * 0.88) * (0.72 + 0.08 * Math.sin(t * 9 + seed));
    for (let side = 0; side < sides; side++) {
      const angle = (side / sides) * Math.PI * 2,
        lobe =
          1 +
          0.1 * Math.sin(angle * 3 + seed) +
          0.05 * Math.sin(angle * 7 + ring),
        ridge = brain ? 0.025 * Math.sin(angle * 5 + t * 22) : 0;
      vertices.push(
        Math.cos(angle) * (radius * lobe + ridge),
        t * 0.82 + (random() - 0.5) * 0.018,
        Math.sin(angle) * (radius * (0.9 + 0.08 * Math.sin(angle * 2)) + ridge),
      );
    }
  }
  for (let ring = 0; ring < rings; ring++)
    for (let side = 0; side < sides; side++) {
      const a = ring * sides + side,
        b = ring * sides + ((side + 1) % sides),
        c = a + sides,
        d = b + sides;
      indices.push(a, c, b, b, c, d);
    }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(vertices, 3),
  );
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry.toNonIndexed();
}

function plate(seed: number, detail: 0 | 1): THREE.BufferGeometry {
  const random = rng(seed),
    parts: THREE.BufferGeometry[] = [],
    layers = detail ? 4 : 3;
  for (let layer = 0; layer < layers; layer++) {
    const sides = detail ? 18 : 12,
      vertices: number[] = [],
      indices: number[] = [],
      reach = 0.72 - layer * 0.11,
      lift = 0.13 + layer * 0.2,
      offset = new THREE.Vector2(
        (random() - 0.5) * 0.18,
        (random() - 0.5) * 0.18,
      );
    vertices.push(offset.x, lift + 0.08, offset.y);
    for (let side = 0; side < sides; side++) {
      const angle = (side / sides) * Math.PI * 2,
        radius = reach * (0.84 + random() * 0.25),
        y = lift + 0.04 * Math.sin(angle * (3 + layer) + seed);
      vertices.push(
        offset.x + Math.cos(angle) * radius,
        y,
        offset.y + Math.sin(angle) * radius,
      );
    }
    for (let side = 0; side < sides; side++)
      indices.push(0, side + 1, ((side + 1) % sides) + 1);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      'position',
      new THREE.Float32BufferAttribute(vertices, 3),
    );
    geometry.setIndex(indices);
    parts.push(geometry);
  }
  const base = new THREE.IcosahedronGeometry(0.28, 1);
  base.scale(1.4, 0.35, 1.2);
  base.translate(0, 0.05, 0);
  parts.push(base);
  return finish(parts);
}

function fan(seed: number, detail: 0 | 1): THREE.BufferGeometry {
  const random = rng(seed),
    parts: THREE.BufferGeometry[] = [],
    root = new THREE.Vector3(0, 0.03, 0);
  const base = new THREE.SphereGeometry(0.16, detail ? 8 : 6, 4);
  base.scale(1.5, 0.28, 0.8);
  base.translate(0, 0.025, 0);
  parts.push(base);
  for (let branch = -3; branch <= 3; branch++) {
    const x = branch * 0.13,
      bend = (random() - 0.5) * 0.12,
      tip = new THREE.Vector3(
        x * 1.25 + bend,
        0.72 + 0.22 * (1 - Math.abs(branch) / 4),
        0,
      );
    parts.push(
      taperedBranch(
        [root, new THREE.Vector3(x * 0.5, 0.38, 0), tip],
        0.035,
        0.012,
        detail ? 6 : 4,
      ),
    );
    if (branch < 3) {
      const nextX = (branch + 1) * 0.13,
        rungY = 0.32 + (branch + 3) * 0.07;
      parts.push(
        taperedBranch(
          [
            new THREE.Vector3(x * 0.7, rungY, 0),
            new THREE.Vector3(nextX * 0.7, rungY + 0.08, 0),
          ],
          0.014,
          0.01,
          4,
        ),
      );
    }
  }
  return finish(parts);
}

function soft(seed: number, detail: 0 | 1): THREE.BufferGeometry {
  const random = rng(seed),
    parts: THREE.BufferGeometry[] = [],
    lobes = detail ? 7 : 5;
  const base = new THREE.SphereGeometry(0.25, 8, 5);
  base.scale(1.3, 0.35, 1.1);
  base.translate(0, 0.06, 0);
  parts.push(base);
  for (let lobe = 0; lobe < lobes; lobe++) {
    const angle = (lobe / lobes) * Math.PI * 2 + random() * 0.45,
      start = new THREE.Vector3(
        Math.cos(angle) * 0.1,
        0.09,
        Math.sin(angle) * 0.1,
      ),
      tip = new THREE.Vector3(
        Math.cos(angle) * (0.24 + random() * 0.18),
        0.55 + random() * 0.35,
        Math.sin(angle) * (0.24 + random() * 0.18),
      );
    parts.push(
      taperedBranch(
        [start, start.clone().lerp(tip, 0.55), tip],
        0.095,
        0.045,
        detail ? 7 : 5,
      ),
    );
    const crown = new THREE.SphereGeometry(
      0.07 + random() * 0.025,
      detail ? 8 : 6,
      detail ? 5 : 4,
    );
    crown.scale(1.1, 0.75, 1.1);
    crown.translate(tip.x, tip.y, tip.z);
    parts.push(crown);
  }
  return finish(parts);
}

export function coralGeometry({
  family,
  seed,
  detail = 1,
}: CoralBuild): THREE.BufferGeometry {
  const geometry =
    family === 'branching'
      ? branching(seed, detail)
      : family === 'massive' || family === 'brain'
        ? massive(seed, family === 'brain', detail)
        : family === 'plate'
          ? plate(seed, detail)
          : family === 'fan'
            ? fan(seed, detail)
            : soft(seed, detail);
  tone(geometry, family);
  geometry.name = `Pass022_${family}_${seed}_${detail}`;
  return geometry;
}

/** Preserve the existing anchored-base/current shader contract for flexible coral families. */
export function coralMotion(
  geometry: THREE.BufferGeometry,
  sway: number,
  frequency: number,
  phase = 0,
): THREE.BufferGeometry {
  const position = geometry.getAttribute('position'),
    motion = new Float32Array(position.count * 4);
  geometry.computeBoundingBox();
  const box = geometry.boundingBox!,
    height = Math.max(0.001, box.max.y - Math.min(0, box.min.y));
  for (let i = 0; i < position.count; i++) {
    const t = Math.max(
      0,
      Math.min(1, (position.getY(i) - Math.min(0, box.min.y)) / height),
    );
    const flex = t < 0.1 ? 0 : t * t * sway;
    motion.set([flex, phase, 2 * flex, frequency], i * 4);
  }
  geometry.setAttribute('plantMotion', new THREE.BufferAttribute(motion, 4));
  return geometry;
}
