import * as THREE from 'three';
import type { PlantSpecies } from './PlantSpecies';
/** A complete rosette/tuft per template. No rectangular leaf silhouettes or separate leaf draws. */
export function createPlantGeometry(
  species: PlantSpecies,
  seed: number,
): THREE.BufferGeometry {
  let state = seed >>> 0;
  const random = (): number => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
  const positions: number[] = [],
    colors: number[] = [],
    motion: number[] = [],
    indices: number[] = [];
  const count = Math.round(
    species.leaves[0] + random() * (species.leaves[1] - species.leaves[0]),
  );
  const color = new THREE.Color(species.color),
    segments = species.id === 'dwarf-hairgrass' ? 8 : 16,
    columns =
      species.id === 'dwarf-hairgrass'
        ? 2
        : species.id === 'amazon-sword' || species.id === 'anubias'
          ? 5
          : 3;
  for (let leaf = 0; leaf < count; leaf++) {
    const angle = leaf * 2.39996 + random() * 0.8,
      length = 0.65 + random() * 0.35,
      phase = random() * 6.283185;
    const width = species.width * (0.8 + random() * 0.4),
      reach = species.reach * (0.7 + random() * 0.3),
      baseX = (random() - 0.5) * 0.07,
      baseZ = (random() - 0.5) * 0.07;
    const start = positions.length / 3;
    for (let row = 0; row <= segments; row++) {
      const t = row / segments;
      let profile = Math.sin(Math.PI * t) ** 0.7;
      if (species.id === 'vallisneria') profile = Math.sin(Math.PI * t) ** 0.35;
      if (species.id === 'dwarf-hairgrass') profile = (1 - t) * 0.85 + 0.01;
      const stem =
        species.id === 'anubias'
          ? 0.38
          : species.id === 'amazon-sword'
            ? 0.18
            : 0;
      if (stem > 0)
        profile =
          t < stem
            ? 0.04
            : Math.sin((Math.PI * (t - stem)) / (1 - stem)) ** 0.65;
      if (species.id === 'anubias' && t >= stem) {
        const u = (t - stem) / (1 - stem);
        profile = Math.sqrt(Math.max(0, 1 - (2 * u - 1) ** 2));
      }
      if (species.id === 'java-fern')
        profile *= 1 + 0.12 * Math.sin(t * 24 + phase);
      profile = Math.max(0.003, profile);
      const radial = reach * t ** 1.7,
        y = length * t * (1 - (species.id === 'anubias' ? 0.2 : 0.07) * t);
      for (let column = 0; column < columns; column++) {
        const side = (column / (columns - 1)) * 2 - 1,
          lateral = side * width * profile * 0.5;
        const twist = Math.sin(t * 3 + phase) * t * 0.12;
        const xx = radial + lateral * Math.sin(twist),
          zz = lateral * Math.cos(twist);
        positions.push(
          baseX + xx * Math.cos(angle) - zz * Math.sin(angle),
          y - side * side * width * profile * 0.07,
          baseZ + xx * Math.sin(angle) + zz * Math.cos(angle),
        );
        const vein = 1.02 - 0.08 * Math.abs(side),
          gradient = (0.76 + t * 0.23) * (0.94 + 0.09 * Math.sin(phase));
        colors.push(
          color.r * gradient * vein,
          color.g * gradient * vein,
          color.b * gradient * vein,
        );
        motion.push(
          t * t * species.sway,
          phase,
          (2 * t * species.sway) / length,
          species.frequency,
        );
      }
    }
    for (let row = 0; row < segments; row++)
      for (let col = 0; col < columns - 1; col++) {
        const a = start + row * columns + col,
          b = a + columns;
        indices.push(a, b, a + 1, b, b + 1, a + 1);
      }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  g.setAttribute('plantMotion', new THREE.Float32BufferAttribute(motion, 4));
  g.setIndex(indices);
  g.computeVertexNormals();
  g.computeBoundingBox();
  g.computeBoundingSphere();
  g.name = species.name;
  return g;
}
