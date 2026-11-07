import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { PlantSpecies } from './PlantSpecies';

/** Species-specific marine forms share one merged, current-deformed template per variant. */
export function createPlantGeometry(
  species: PlantSpecies,
  seed: number,
): THREE.BufferGeometry {
  let state = seed >>> 0;
  const random = () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
  const parts: THREE.BufferGeometry[] = [],
    tint = new THREE.Color(species.color);
  const add = (g: THREE.BufferGeometry, phase: number) => {
    if (!g.attributes.normal) g.computeVertexNormals();
    if (g.index) {
      const expanded = g.toNonIndexed();
      g.dispose();
      g = expanded;
    }
    g.deleteAttribute('uv');
    const p = g.attributes.position,
      colors: number[] = [],
      motion: number[] = [];
    for (let i = 0; i < p.count; i++) {
      if (species.category === 'coral' && p.getY(i) < 0) p.setY(i, 0);
      const t = Math.max(0, Math.min(1, p.getY(i))),
        shade = 0.8 + t * 0.18 + Math.sin(phase) * 0.025;
      colors.push(tint.r * shade, tint.g * shade, tint.b * shade);
      motion.push(
        t * t * species.sway,
        phase,
        2 * t * species.sway,
        species.frequency,
      );
    }
    g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    g.setAttribute('plantMotion', new THREE.Float32BufferAttribute(motion, 4));
    parts.push(g);
  };
  const tube = (
    from: THREE.Vector3,
    to: THREE.Vector3,
    radius: number,
    phase: number,
  ) => {
    const curve = new THREE.CatmullRomCurve3([
      from,
      from
        .clone()
        .lerp(to, 0.5)
        .add(new THREE.Vector3(0.018, 0, 0.012)),
      to,
    ]);
    const g = new THREE.TubeGeometry(curve, 4, radius, 6, false);
    add(g, phase);
  };
  const count =
    species.id === 'sea-fan'
      ? 1
      : Math.round(
          species.leaves[0] +
            random() * (species.leaves[1] - species.leaves[0]),
        );
  for (let stem = 0; stem < count; stem++) {
    const angle = stem * 2.39996 + random() * 0.5,
      phase = random() * Math.PI * 2,
      length = 0.7 + random() * 0.3;
    const end = new THREE.Vector3(
      Math.cos(angle) * species.reach * 0.65,
      length,
      Math.sin(angle) * species.reach * 0.65,
    );
    const base = new THREE.Vector3(
      (random() - 0.5) * 0.04,
      0,
      (random() - 0.5) * 0.04,
    );
    if (species.category === 'coral') {
      const foot = new THREE.CircleGeometry(0.025, 16);
      foot.rotateX(-Math.PI / 2);
      foot.translate(base.x, 0, base.z);
      add(foot, phase);
    }
    if (species.category === 'seagrass') {
      const positions: number[] = [],
        indices: number[] = [];
      const rows = species.id === 'turtle-grass-meadow' ? 8 : 16,
        columns = species.id === 'turtle-grass-meadow' ? 2 : 3;
      for (let row = 0; row <= rows; row++) {
        const t = row / rows,
          profile =
            t < 0.87
              ? 0.8 + 0.2 * Math.sin(t * Math.PI)
              : Math.max(0.002, (1 - t) / 0.13);
        for (let col = 0; col < columns; col++) {
          const side = (col / (columns - 1)) * 2 - 1,
            lateral = side * species.width * profile * 0.5;
          positions.push(
            base.x + end.x * t * t - lateral * Math.sin(angle),
            length * t,
            base.z + end.z * t * t + lateral * Math.cos(angle),
          );
        }
      }
      for (let row = 0; row < rows; row++)
        for (let col = 0; col < columns - 1; col++) {
          const a = row * columns + col,
            b = a + columns;
          indices.push(a, b, a + 1, b, b + 1, a + 1);
        }
      const g = new THREE.BufferGeometry();
      g.setAttribute(
        'position',
        new THREE.Float32BufferAttribute(positions, 3),
      );
      g.setIndex(indices);
      add(g, phase);
    } else if (species.id === 'halimeda') {
      tube(base, end, 0.012, phase);
      for (let pad = 0; pad < 5; pad++) {
        const t = 0.18 + pad * 0.16,
          p = base.clone().lerp(end, t),
          g = new THREE.SphereGeometry(0.085 + random() * 0.015, 8, 6);
        g.scale(1, 0.85, 0.18);
        g.rotateY(angle);
        g.translate(p.x, p.y, p.z);
        add(g, phase);
      }
    } else if (species.id === 'caulerpa') {
      tube(base, end, 0.009, phase);
      for (let row = 1; row <= 7; row++)
        for (const side of [-1, 1]) {
          const t = row / 8,
            p = base.clone().lerp(end, t),
            tip = p
              .clone()
              .add(
                new THREE.Vector3(
                  Math.cos(angle) * 0.09 * Math.sin(Math.PI * t) * side,
                  0.055,
                  Math.sin(angle) * 0.09 * Math.sin(Math.PI * t) * side,
                ),
              );
          const g = new THREE.SphereGeometry(
            0.045 * Math.sin(Math.PI * t),
            6,
            4,
          );
          g.scale(1.6, 0.28, 0.55);
          g.rotateY(-angle);
          g.translate(tip.x, tip.y, tip.z);
          add(g, phase);
        }
    } else if (species.id === 'sea-fan') {
      // A connected gorgonian branching lattice.
      const root = base.clone().lerp(end, 0.12),
        fanAngle = angle * 0.08;
      tube(base, root, 0.018, phase);
      for (let branch = -3; branch <= 3; branch++) {
        const tip = new THREE.Vector3(
          Math.cos(fanAngle) * branch * 0.105,
          length * (0.8 + 0.2 * (1 - Math.abs(branch) / 3)),
          Math.sin(fanAngle) * branch * 0.105,
        );
        tube(root, tip, 0.009, phase);
        for (let rung = 1; rung <= 4; rung++) {
          const p = root.clone().lerp(tip, rung / 5),
            q = p.clone().add(new THREE.Vector3(0.1, 0.075, 0));
          tube(p, q, 0.005, phase);
        }
      }
    } else {
      const soft = species.id === 'soft-coral';
      tube(base, end, soft ? 0.06 : 0.012, phase);
      if (soft) {
        const cap = new THREE.SphereGeometry(0.06, 8, 6);
        cap.translate(end.x, end.y, end.z);
        add(cap, phase);
      }
      for (let branch = 0; branch < 3; branch++) {
        const t = 0.25 + branch * 0.2,
          p = base.clone().lerp(end, t),
          a = angle + branch * 2.3;
        const tip = p
          .clone()
          .add(
            new THREE.Vector3(
              Math.cos(a) * 0.16,
              soft ? 0.16 : 0.23,
              Math.sin(a) * 0.16,
            ),
          );
        tube(p, tip, soft ? 0.045 : 0.007, phase);
        if (soft) {
          const polyp = new THREE.SphereGeometry(0.045, 8, 6);
          polyp.scale(1, 0.85, 1);
          polyp.translate(tip.x, tip.y, tip.z);
          add(polyp, phase);
        } else {
          tube(
            tip.clone().lerp(p, 0.3),
            tip.clone().add(new THREE.Vector3(0.06, 0.08, -0.04)),
            0.004,
            phase,
          );
        }
      }
    }
  }
  const result = mergeGeometries(parts, false)!;
  parts.forEach((g) => g.dispose());
  // A non-indexed merged source keeps category forms efficient; expose an index for shared tooling.
  result.setIndex(
    Array.from({ length: result.attributes.position.count }, (_, i) => i),
  );
  result.computeBoundingBox();
  result.computeBoundingSphere();
  result.name = species.name;
  return result;
}
