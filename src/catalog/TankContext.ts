import * as THREE from 'three';
import { clearFishRoute } from '../fish/FishHabitat';
import { SPAWN } from '../config/world';
import type { Aquarium } from '../environment/Aquarium';
import type { PlacementContext, KeepOut } from './catalog';
import { substrateHeight } from '../environment/HabitatRegions';
import { hullTop } from '../environment/outer/OuterReef';
import { integrationRoutes } from '../environment/SwimRoutes';
import { CREVICE } from '../config/passage';
/** Snapshot protected homes/routes once the authored presentation has settled. */
export function tankContext(q: Aquarium): PlacementContext {
  const life = q.anchoredLife;
  const keepOut: KeepOut[] = [
    ...q.ornaments.colliders,
    ...q.hardscape.colliders,
    ...q.crevice.colliders,
  ].map((c, i) => ({ name: `structure-${i}`, min: c.min, max: c.max }));
  for (const home of [
    life.anemone.host,
    life.moray.anchor,
    ...life.hidden.homes,
  ]) {
    const p = home.position,
      r = Math.max(2, home.homeRadius);
    keepOut.push({
      name: home.id,
      min: { x: p.x - r, y: p.y - r, z: p.z - r },
      max: { x: p.x + r, y: p.y + r, z: p.z + r },
    });
  }
  keepOut.push({
    name: 'crevice and return alley',
    min: { x: CREVICE.outcrop.minX - 0.5, y: -1, z: -14 },
    max: { x: 9, y: 6, z: -9.3 },
  });
  const routes = integrationRoutes(q).map((r) => r.points);
  for (const object of [life.anemone.root, life.moray.head]) {
    const target = new THREE.Vector3();
    object.getWorldPosition(target);
    let found = false;
    for (const lift of [0.9, 1.4, 2]) {
      for (const reach of [1.6, 2.2, 3]) {
        const p = {
          x: target.x - Math.sign(target.x) * reach,
          y: target.y + lift,
          z: target.z + 0.4,
        };
        const points = [
          SPAWN,
          { ...SPAWN, y: 11 },
          { x: p.x, y: 11, z: p.z },
          p,
        ];
        if (
          points.every(
            (v, i) =>
              !i ||
              clearFishRoute(points[i - 1], v, 0.65, q.fish.simulation.habitat),
          )
        ) {
          routes.push(points);
          found = true;
          break;
        }
      }
      if (found) break;
    }
    if (!found) throw Error('No protected creature viewing route');
  }
  routes.push([
    { x: 0, y: 4.6, z: 9 },
    { x: 0, y: 4.6, z: -12 },
  ]);
  return {
    keepOut,
    routes,
    surface: (x, z) => {
      let y = substrateHeight(x, z) + 0.04;
      for (const c of q.rockColliders) y = Math.max(y, hullTop(c, x, z));
      return y;
    },
  };
}
