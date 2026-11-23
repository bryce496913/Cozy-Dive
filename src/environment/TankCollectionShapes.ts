import {
  cushionGeometry,
  tubeClusterGeometry,
  squirtClusterGeometry,
} from './cave/CaveEncrusting';
import { patchGeometry, angelBody, angelWing } from './ice/IceUnderside';
import { wormPlumes } from './outer/ChristmasTreeWorms';
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { TankCreatureId } from '../config/babies';
import { crabBody } from './cave/CaveCrabs';
import { spinyLobsterBody } from './cave/SpinyLobster';
import { lobsterAntennae } from './cave/CaveLobsters';
import {
  LION_RAYS,
  lionBody,
  lionRayPose,
  rayGeometry,
  shrimpGeometry,
} from './cave/CaveVisitors';
import {
  spongeGeometry,
  softCoralGeometry,
  featherStarGeometry,
} from './ice/IceGarden';
import {
  scallopGeometry,
  urchinGeometry,
  brittleStarGeometry,
  cucumberGeometry,
  seaPenGeometry,
  isopodGeometry,
  salpGeometry,
  jellyBellGeometry,
  jellyArmsGeometry,
} from './ice/IceExtras';
import {
  combJellyShape,
  krillShape,
  seaButterflyShape,
} from './ice/IceCritterShapes';
import { squidGeometry } from './ice/SquidGeometry';
import {
  ribbonWormRestGeometry,
  seaSpiderRestGeometry,
} from './ice/IceCritters';
import { octopusRestGeometry } from './shared/Octopus';
import { anemoneColumn, anemoneCrown } from './kelp/KelpDressing';
import { seaStarShape } from './kelp/KelpShapes';
import { spanishShawlGeometry } from './kelp/SpanishShawl';

/** Combine procedural parts without losing their existing vertex colours. Owned by the caller. */
function join(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const clean = parts.map((g) => {
    const out = g.index ? g.toNonIndexed() : g;
    if (out !== g) g.dispose();
    for (const key of Object.keys(out.attributes))
      if (!['position', 'normal', 'color'].includes(key))
        out.deleteAttribute(key);
    if (!out.hasAttribute('color'))
      out.setAttribute(
        'color',
        new THREE.Float32BufferAttribute(
          new Float32Array(out.getAttribute('position').count * 3).fill(1),
          3,
        ),
      );
    return out;
  });
  const result = mergeGeometries(clean);
  clean.forEach((g) => g.dispose());
  return result;
}
export function collectionShape(id: TankCreatureId): THREE.BufferGeometry {
  switch (id) {
    case 'encrusting-sponge':
      return cushionGeometry();
    case 'tube-sponge':
      return tubeClusterGeometry();
    case 'sea-squirt':
      return squirtClusterGeometry();
    case 'mysid':
      return krillShape();
    case 'ice-algae': {
      const g = patchGeometry();
      g.rotateX(Math.PI);
      return g;
    }
    case 'sea-angel': {
      const left = angelWing(),
        right = angelWing();
      left.translate(0, 0.02, 0);
      right.rotateY(Math.PI);
      right.translate(0, 0.02, 0);
      return join([angelBody(), left, right]);
    }
    case 'christmas-tree-worm':
      return wormPlumes();
    case 'spanish-shawl':
      return spanishShawlGeometry();
    case 'kelp-crab':
    case 'rock-crab':
      return crabBody();
    case 'spiny-lobster': {
      const antennae = lobsterAntennae();
      antennae.translate(0, 0.1, 0.17);
      return join([spinyLobsterBody(), antennae]);
    }
    case 'cleaner-shrimp':
      return shrimpGeometry();
    case 'lionfish': {
      // V0.8 Pass 095: the same rebuilt fish as the cave's, its fins half spread.
      const parts = [lionBody()],
        pose = new THREE.Matrix4();
      for (let r = 0; r < LION_RAYS; r++) {
        const ray = rayGeometry();
        ray.applyMatrix4(lionRayPose(r, 0.5, pose));
        parts.push(ray);
      }
      return join(parts);
    }
    case 'octopus':
      return octopusRestGeometry();
    case 'glass-sponge':
      return spongeGeometry();
    case 'antarctic-soft-coral':
      return softCoralGeometry();
    case 'antarctic-anemone':
      return join([anemoneColumn(), anemoneCrown()]);
    case 'antarctic-sea-star':
      return seaStarShape();
    case 'feather-star':
      return featherStarGeometry();
    case 'antarctic-krill':
      return krillShape();
    case 'giant-sea-spider':
      return seaSpiderRestGeometry();
    case 'ribbon-worm':
      return ribbonWormRestGeometry();
    case 'sea-butterfly':
      return seaButterflyShape();
    case 'comb-jelly':
      return combJellyShape();
    case 'colossal-squid':
      return squidGeometry();
    case 'antarctic-jellyfish':
      return join([jellyBellGeometry(), jellyArmsGeometry()]);
    case 'salp':
      return salpGeometry();
    case 'antarctic-sea-urchin':
      return urchinGeometry();
    case 'brittle-star':
      return brittleStarGeometry();
    case 'sea-cucumber':
      return cucumberGeometry();
    case 'antarctic-scallop':
      return scallopGeometry();
    case 'sea-pen':
      return seaPenGeometry();
    case 'giant-isopod':
      return isopodGeometry();
    default:
      throw Error(`No collection geometry for ${id}`);
  }
}
