import * as THREE from 'three';
import type { PlantPlacement } from '../../environment/HabitatRegions';
import { safeFishPosition, type FishHabitat } from '../../fish/FishHabitat';
import type { PlayerPresence } from '../../fish/FishDiverReaction';
import {
  discoveryView,
  occludedFromChannel,
  type DiscoveryHome,
} from './DiscoveryHabitat';
import { SEAHORSE_COIL } from './SeahorseGrip';
import { anchoredFishGeometry } from '../../fish/lowPoly/anchored';
import { lowPolyMaterial } from '../../rendering/lowPoly/resources';

/**
 * Pass 019 playtest: the seahorse is 20% of its original modelled size (about 20 cm tall, in
 * proportion with the reef fish). Geometry stays in its authored local units; the root carries
 * the scale, so grip offsets, safety radii and drift are scaled with it.
 */
export const SEAHORSE_SCALE = 0.2;
/** Upright segmented horse/neck anatomy, not a conventional swimming-fish template. */
export class Seahorse {
  readonly root = new THREE.Group();
  readonly tail = new THREE.Group();
  readonly dorsal: THREE.Mesh;
  readonly leftPectoral: THREE.Mesh;
  readonly rightPectoral: THREE.Mesh;
  readonly material = lowPolyMaterial({ role: 'body', vertexColors: true });
  readonly finMaterial = lowPolyMaterial({ role: 'fin', vertexColors: true });
  readonly geometries: readonly THREE.BufferGeometry[];
  readonly home: DiscoveryHome;
  readonly vegetation: PlantPlacement;
  readonly gripPoint: THREE.Vector3;
  gripping = true;
  awareness = 0;
  private readonly basis = new THREE.Quaternion();
  private readonly hover = new THREE.Vector3();
  /** Root anchor used for posing; starts at the home and moves when re-gripped on a branch. */
  private readonly origin = new THREE.Vector3();
  private disposed = false;
  constructor(h: FishHabitat, plants: readonly PlantPlacement[]) {
    this.root.name = 'Hidden seahorse';
    this.root.scale.setScalar(SEAHORSE_SCALE);
    const k = SEAHORSE_SCALE;
    const bodyGeometry = anchoredFishGeometry('HorseBody'),
      tailGeometry = anchoredFishGeometry('HorseTail'),
      dorsal = anchoredFishGeometry('HorseDorsal'),
      pectoral = anchoredFishGeometry('HorseLeftFin');
    this.root.add(new THREE.Mesh(bodyGeometry, this.material));
    this.tail.position.y = 0.33;
    this.tail.add(new THREE.Mesh(tailGeometry, this.material));
    this.root.add(this.tail);
    this.dorsal = new THREE.Mesh(dorsal, this.finMaterial);
    this.dorsal.position.set(0, 0.59, -0.14);
    this.root.add(this.dorsal);
    this.leftPectoral = new THREE.Mesh(pectoral, this.finMaterial);
    this.rightPectoral = new THREE.Mesh(pectoral, this.finMaterial);
    for (const [part, side] of [
      [this.leftPectoral, 1],
      [this.rightPectoral, -1],
    ] as const) {
      part.position.set(side * 0.045, 0.97, 0.02);
      part.scale.x = side;
      this.root.add(part);
    }
    this.geometries = [bodyGeometry, tailGeometry, dorsal, pectoral];
    const candidates = plants
      .filter((p) =>
        ['sea-fan', 'red-macroalgae', 'turtle-grass'].includes(p.species.id),
      )
      .slice()
      .sort(
        (a, b) =>
          (a.species.id === 'sea-fan' ? 0 : 1) -
            (b.species.id === 'sea-fan' ? 0 : 1) ||
          Math.abs(b.position.x) - Math.abs(a.position.x),
      );
    const probe = new THREE.Vector3(),
      world = new THREE.Matrix4(),
      q = new THREE.Quaternion(),
      position = new THREE.Vector3();
    let found:
      | { home: DiscoveryHome; plant: PlantPlacement; grip: THREE.Vector3 }
      | undefined;
    for (const plant of candidates) {
      const forward = new THREE.Vector3(-Math.sign(plant.position.x), 0, 0);
      q.setFromUnitVectors(new THREE.Vector3(0, 0, 1), forward);
      const grip = new THREE.Vector3(
        plant.position.x,
        plant.position.y,
        plant.position.z,
      ).addScaledVector(
        new THREE.Vector3(plant.normal.x, plant.normal.y, plant.normal.z),
        plant.height * 0.22,
      );
      position.copy(grip).addScaledVector(forward, -0.14 * k);
      position.y -= 0.15 * k;
      world.compose(position, q, new THREE.Vector3(k, k, k));
      let safe = true;
      const nearby = h.rocks.filter(
        (r) =>
          r.max.x > position.x - 0.6 &&
          r.min.x < position.x + 0.6 &&
          r.max.y > position.y - 0.1 &&
          r.min.y < position.y + 1.3 &&
          r.max.z > position.z - 0.6 &&
          r.min.z < position.z + 0.6,
      );
      for (const g of [bodyGeometry, tailGeometry]) {
        const vertices = g.attributes.position;
        for (let i = 0; i < vertices.count && safe; i += 2) {
          probe.fromBufferAttribute(vertices, i);
          if (g === tailGeometry) probe.y += 0.33;
          probe.applyMatrix4(world);
          if (
            !safeFishPosition(probe, 0.075 * k, {
              bounds: h.bounds,
              rocks: nearby,
            })
          )
            safe = false;
        }
      }
      if (!safe) continue;
      const target = position.clone().add(new THREE.Vector3(0, 0.65 * k, 0)),
        view = discoveryView(target, forward, h, 1.25);
      if (!view) continue;
      found = {
        plant,
        grip,
        home: {
          id: 'seahorse-home',
          sourceId: `vegetation-${plant.id}-${plant.species.id}`,
          position: { x: position.x, y: position.y, z: position.z },
          orientation: { x: forward.x, y: 0, z: forward.z },
          homeRadius: 0.12,
          habitatKind:
            plant.species.category === 'seagrass'
              ? 'seagrass-meadow'
              : 'coral-edge',
          ...view,
          channelOccluded: occludedFromChannel(target, h),
        },
      };
      this.basis.copy(q);
      break;
    }
    if (!found) {
      this.dispose();
      throw new Error('No safely viewable vegetation home for seahorse.');
    }
    this.home = found.home;
    this.vegetation = found.plant;
    this.gripPoint = found.grip;
    this.origin.set(
      this.home.position.x,
      this.home.position.y,
      this.home.position.z,
    );
    this.pose(0);
  }
  respond(dt: number, player?: PlayerPresence): void {
    const p = this.home.position,
      near =
        player?.active &&
        Math.hypot(
          player.position.x - p.x,
          player.position.y - p.y - 0.55 * SEAHORSE_SCALE,
          player.position.z - p.z,
        ) < 1.5
          ? 1
          : 0;
    this.awareness += (near - this.awareness) * -Math.expm1(-1.5 * dt);
  }
  pose(time: number): void {
    if (this.disposed) return;
    const phase = time % 42;
    this.gripping = phase < 27;
    const smooth = (x: number) => x * x * (3 - 2 * x);
    const grip =
      phase < 24
        ? 1
        : phase < 30
          ? 1 - smooth((phase - 24) / 6)
          : phase < 36
            ? 0
            : smooth((phase - 36) / 6);
    const k = SEAHORSE_SCALE,
      float = (0.008 + 0.02 * (1 - grip)) * k;
    this.hover
      .set(
        Math.sin(time * 0.16) * 0.025 * k,
        Math.sin(time * 0.3) * float,
        (Math.sin(time * 0.11) * 0.025 - this.awareness * 0.025) * k,
      )
      .applyQuaternion(this.basis);
    this.root.position.copy(this.origin).add(this.hover);
    this.root.quaternion.copy(this.basis);
    this.root.rotateY(Math.sin(time * 0.09) * 0.045 + this.awareness * 0.14);
    this.tail.scale.set(1, 1 - 0.04 * grip, 1 - 0.06 * grip);
    this.dorsal.rotation.y = Math.sin(time * Math.PI * 16) * 0.18;
    this.leftPectoral.rotation.y = Math.sin(time * Math.PI * 9) * 0.14;
    this.rightPectoral.rotation.y = -Math.sin(time * Math.PI * 9 + 0.8) * 0.14;
  }
  /**
   * Pass 019: cling to a specific branch (`grip` is where the tail coil sits) facing `forward`
   * (horizontal). Used once the authored sea fan is known; the home and its view are unchanged.
   */
  rehome(grip: THREE.Vector3, forward: THREE.Vector3): void {
    const f = forward.clone().setY(0);
    if (this.disposed || f.lengthSq() < 1e-8) return;
    f.normalize();
    this.basis.setFromUnitVectors(new THREE.Vector3(0, 0, 1), f);
    this.gripPoint.copy(grip);
    this.origin
      .copy(grip)
      .addScaledVector(f, -SEAHORSE_COIL.z * SEAHORSE_SCALE)
      .add(new THREE.Vector3(0, -SEAHORSE_COIL.y * SEAHORSE_SCALE, 0));
    this.pose(0);
  }
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.root.removeFromParent();
    this.root.clear();
    this.geometries?.forEach((g) => g.dispose());
    this.material.dispose();
    this.finMaterial.dispose();
  }
}
