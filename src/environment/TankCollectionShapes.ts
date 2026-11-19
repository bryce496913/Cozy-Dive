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
import { lionBody, rayGeometry, shrimpGeometry } from './cave/CaveVisitors';
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
function tube(points: THREE.Vector3[], radius: number) {
  return new THREE.TubeGeometry(
    new THREE.CatmullRomCurve3(points),
    32,
    radius,
    8,
    false,
  );
}
function spider() {
  const parts: THREE.BufferGeometry[] = [new THREE.SphereGeometry(0.05, 12, 8)];
  for (const side of [-1, 1])
    for (let i = 0; i < 4; i++) {
      const hip = new THREE.Vector3(side * 0.02, 0, (i - 1.5) * 0.025),
        knee = new THREE.Vector3(side * 0.16, 0.05, (i - 1.5) * 0.1),
        foot = new THREE.Vector3(side * 0.28, -0.08, (i - 1.5) * 0.18);
      parts.push(tube([hip, knee, foot], 0.009));
    }
  return join(parts);
}
function octopus() {
  const parts: THREE.BufferGeometry[] = [];
  const mantle = new THREE.SphereGeometry(1, 20, 14);
  mantle.scale(0.12, 0.17, 0.14);
  mantle.translate(0, 0.12, -0.05);
  parts.push(mantle);
  for (let arm = 0; arm < 8; arm++) {
    const a = (arm / 8) * Math.PI * 2,
      points: THREE.Vector3[] = [];
    for (let j = 0; j <= 12; j++) {
      const t = j / 12,
        r = 0.08 + 0.3 * t;
      points.push(
        new THREE.Vector3(
          Math.cos(a + t * 0.5) * r,
          0.015 + Math.sin(t * 5) * 0.015,
          Math.sin(a + t * 0.5) * r,
        ),
      );
    }
    const curve = new THREE.CatmullRomCurve3(points),
      g = new THREE.TubeGeometry(curve, 24, 1, 8, false),
      p = g.getAttribute('position');
    for (let ring = 0; ring <= 24; ring++) {
      const t = ring / 24,
        c = curve.getPointAt(t),
        r = 0.025 * (1 - t) + 0.002;
      for (let j = 0; j <= 8; j++) {
        const i = ring * 9 + j;
        p.setXYZ(
          i,
          c.x + (p.getX(i) - c.x) * r,
          c.y + (p.getY(i) - c.y) * r,
          c.z + (p.getZ(i) - c.z) * r,
        );
      }
    }
    g.computeVertexNormals();
    parts.push(g);
  }
  return join(parts);
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
      const parts = [lionBody()];
      for (let i = 0; i < 13; i++) {
        const ray = rayGeometry();
        ray.scale(1, 0.14, 1);
        ray.rotateX((i / 12 - 0.5) * 1.2);
        ray.translate(0, 0.09, 0.08 - i * 0.014);
        parts.push(ray);
      }
      for (const side of [-1, 1])
        for (let i = 0; i < 8; i++) {
          const ray = rayGeometry();
          ray.scale(1, 0.18, 1);
          ray.rotateZ(side * (0.6 + i * 0.18));
          ray.translate(side * 0.025, 0.05, 0.05 - i * 0.012);
          parts.push(ray);
        }
      return join(parts);
    }
    case 'octopus':
      return octopus();
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
      return spider();
    case 'ribbon-worm':
      return tube(
        Array.from(
          { length: 18 },
          (_, i) => new THREE.Vector3(Math.sin(i * 0.6) * 0.025, 0, i * 0.04),
        ),
        0.012,
      );
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
