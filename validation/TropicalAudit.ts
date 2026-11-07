import * as THREE from 'three';
import type { Aquarium } from '../src/environment/Aquarium';
import { AQUARIUM } from '../src/config/world';

/** Validation-only snapshot: no production instrumentation or per-frame traversal. */
export function tropicalSnapshot(q: Aquarium) {
  const l = q.anchoredLife,
    h = l.hidden;
  q.root.updateMatrixWorld(true);
  const geometries = new Set<THREE.BufferGeometry>(),
    materials = new Set<THREE.Material>();
  let finite = true;
  q.root.traverse((o) => {
    finite &&= o.matrixWorld.elements.every(Number.isFinite);
    if (
      o instanceof THREE.Mesh ||
      o instanceof THREE.Points ||
      o instanceof THREE.LineSegments
    ) {
      geometries.add(o.geometry);
      for (const m of Array.isArray(o.material) ? o.material : [o.material])
        materials.add(m);
    }
  });
  const homeDistance = (
    p: THREE.Vector3,
    home: { x: number; y: number; z: number },
  ) => Math.hypot(p.x - home.x, p.y - home.y, p.z - home.z);
  return {
    population: q.fish.simulation.fish.reduce<Record<string, number>>(
      (r, f) => {
        r[f.species.id] = (r[f.species.id] || 0) + 1;
        return r;
      },
      {},
    ),
    geometries: geometries.size,
    materials: materials.size,
    finite,
    ornaments: q.ornaments.models.length,
    hulls: q.collision.colliders.length,
    hiddenAnimals: h.homes.length,
    seahorseDistance: homeDistance(
      h.seahorse.root.position,
      h.seahorse.home.position,
    ),
    frogfishDistance: homeDistance(
      h.frogfish.root.position,
      h.frogfish.home.position,
    ),
    nudibranchs: h.nudibranchs.animals.map((a) => {
      const plane = a.home.support.planes[a.home.planeIndex],
        p = a.pose.position;
      return {
        id: a.id,
        distance: homeDistance(p, a.home.position),
        surfaceDistance:
          plane.x * p.x + plane.y * p.y + plane.z * p.z - plane.offset,
      };
    }),
    moray: {
      state: l.moray.behavior.state,
      elapsed: l.moray.behavior.elapsed,
      extension: l.moray.behavior.extension,
      time: l.moray.behavior.time,
    },
    clocks: [
      l.anemone.clock.time,
      l.moray.clock.time,
      h.clock.time,
      h.clock.sample,
      q.plants.clock.time,
    ],
    chest: {
      time: q.ornaments.chest.time,
      cycle: q.ornaments.chest.cycle,
      openings: q.ornaments.chest.openings,
      bursts: q.ornaments.bubbles.bursts,
      active: q.ornaments.bubbles.activeCount,
      drawn: q.ornaments.bubbles.mesh.count,
    },
    bubblesInside: (() => {
      const b = q.ornaments.bubbles,
        matrix = new THREE.Matrix4(),
        p = new THREE.Vector3();
      for (let i = 0; i < b.mesh.count; i++) {
        b.mesh.getMatrixAt(i, matrix);
        p.setFromMatrixPosition(matrix);
        if (
          !matrix.elements.every(Number.isFinite) ||
          p.y >= AQUARIUM.max.y ||
          p.y < AQUARIUM.min.y
        )
          return false;
      }
      return true;
    })(),
  };
}
