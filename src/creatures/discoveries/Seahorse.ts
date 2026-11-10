import * as THREE from 'three';
import type { PlantPlacement } from '../../environment/HabitatRegions';
import { safeFishPosition, type FishHabitat } from '../../fish/FishHabitat';
import type { PlayerPresence } from '../../fish/FishDiverReaction';
import {
  discoveryView,
  occludedFromChannel,
  type DiscoveryHome,
} from './DiscoveryHabitat';
import {
  ellipsoid,
  finGeometry,
  mergeParts,
  tint,
  tube,
} from './DiscoveryGeometry';

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
  readonly material = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.86,
  });
  readonly finMaterial = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.85,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.55,
    depthWrite: false,
    forceSinglePass: true,
  });
  readonly geometries: readonly THREE.BufferGeometry[];
  readonly home: DiscoveryHome;
  readonly vegetation: PlantPlacement;
  readonly gripPoint: THREE.Vector3;
  gripping = true;
  awareness = 0;
  private readonly basis = new THREE.Quaternion();
  private readonly hover = new THREE.Vector3();
  private disposed = false;
  constructor(h: FishHabitat, plants: readonly PlantPlacement[]) {
    this.root.name = 'Hidden seahorse';
    this.root.scale.setScalar(SEAHORSE_SCALE);
    const k = SEAHORSE_SCALE;
    const body: THREE.BufferGeometry[] = [],
      green = 0x89956a,
      ridge = 0x697954;
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0.3, 0),
      new THREE.Vector3(0, 0.49, -0.015),
      new THREE.Vector3(0, 0.7, -0.11),
      new THREE.Vector3(0, 0.9, -0.1),
      new THREE.Vector3(0, 1.01, 0.06),
    ]);
    const torso = new THREE.TubeGeometry(curve, 24, 0.085, 10, false),
      p = torso.attributes.position;
    for (let i = 0; i <= 24; i++) {
      const t = i / 24,
        c = curve.getPoint(t),
        factor = t < 0.55 ? 0.8 + Math.sin((t / 0.55) * Math.PI) * 0.48 : 0.65;
      for (let j = 0; j <= 10; j++) {
        const k = i * 11 + j;
        p.setXYZ(
          k,
          c.x + (p.getX(k) - c.x) * factor * 0.73,
          c.y + (p.getY(k) - c.y) * factor,
          c.z + (p.getZ(k) - c.z) * factor,
        );
      }
    }
    torso.computeVertexNormals();
    body.push(tint(torso, green, 0.1));
    for (let i = 2; i < 17; i += 2) {
      const t = i / 24,
        c = curve.getPoint(t),
        tangent = curve.getTangent(t);
      const ring = new THREE.TorusGeometry(
        t < 0.55 ? 0.085 : 0.06,
        0.007,
        5,
        10,
      );
      ring.scale(0.73, 1, 1);
      ring.applyQuaternion(
        new THREE.Quaternion().setFromUnitVectors(
          new THREE.Vector3(0, 0, 1),
          tangent,
        ),
      );
      ring.translate(c.x, c.y, c.z);
      body.push(tint(ring, ridge));
    }
    body.push(ellipsoid(0, 1.005, 0.075, 0.07, 0.088, 0.095, green, 0.08));
    const snout = new THREE.CylinderGeometry(0.024, 0.039, 0.22, 10);
    snout.rotateX(Math.PI / 2);
    snout.translate(0, 0.984, 0.232);
    body.push(tint(snout, green));
    body.push(ellipsoid(0, 0.984, 0.346, 0.025, 0.025, 0.01, ridge));
    for (const side of [-1, 1]) {
      body.push(
        ellipsoid(side * 0.065, 1.031, 0.108, 0.018, 0.02, 0.02, 0xb7a867),
      );
      body.push(
        ellipsoid(side * 0.078, 1.033, 0.112, 0.01, 0.012, 0.012, 0x1f2d25),
      );
    }
    for (let i = 0; i < 4; i++)
      body.push(
        ellipsoid(
          0,
          1.075 + i * 0.008,
          0.025 - i * 0.034,
          0.016,
          0.029,
          0.015,
          ridge,
        ),
      );
    const bodyGeometry = mergeParts(body);
    this.root.add(new THREE.Mesh(bodyGeometry, this.material));
    const tailPoints = [
      [0, 0.33, -0.03],
      [0, 0.18, -0.06],
      [0, 0.055, 0.035],
      [0, 0.045, 0.18],
      [0, 0.15, 0.25],
      [0, 0.23, 0.16],
      [0, 0.18, 0.095],
      [0, 0.13, 0.14],
    ].map(([x, y, z]) => new THREE.Vector3(x, y - 0.33, z));
    const tailGeometry = tube(tailPoints, 0.022, green, 28);
    const tailCurve = new THREE.CatmullRomCurve3(tailPoints),
      tp = tailGeometry.attributes.position;
    for (let i = 0; i <= 28; i++) {
      const c = tailCurve.getPoint(i / 28),
        factor = 1 - (i / 28) * 0.6;
      for (let j = 0; j <= 6; j++) {
        const k = i * 7 + j;
        tp.setXYZ(
          k,
          c.x + (tp.getX(k) - c.x) * factor,
          c.y + (tp.getY(k) - c.y) * factor,
          c.z + (tp.getZ(k) - c.z) * factor,
        );
      }
    }
    tailGeometry.computeVertexNormals();
    this.tail.position.y = 0.33;
    this.tail.add(new THREE.Mesh(tailGeometry, this.material));
    this.root.add(this.tail);
    const dorsal = finGeometry(
      [
        new THREE.Vector3(0, -0.11, 0),
        new THREE.Vector3(0, -0.08, -0.09),
        new THREE.Vector3(0, 0.08, -0.12),
        new THREE.Vector3(0, 0.12, 0),
      ],
      0xb9bc87,
    );
    this.dorsal = new THREE.Mesh(dorsal, this.finMaterial);
    this.dorsal.position.set(0, 0.59, -0.14);
    this.root.add(this.dorsal);
    const pectoral = finGeometry(
      [
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(0.07, -0.02, -0.015),
        new THREE.Vector3(0.085, 0.025, -0.018),
        new THREE.Vector3(0.015, 0.04, 0),
      ],
      0xb0b982,
    );
    this.leftPectoral = new THREE.Mesh(pectoral, this.finMaterial);
    this.rightPectoral = new THREE.Mesh(pectoral, this.finMaterial);
    for (const [fin, side] of [
      [this.leftPectoral, 1],
      [this.rightPectoral, -1],
    ] as const) {
      fin.geometry = pectoral;
      fin.material = this.finMaterial;
      fin.position.set(side * 0.045, 0.97, 0.02);
      fin.scale.x = side;
      this.root.add(fin);
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
    this.root.position.set(
      this.home.position.x + this.hover.x,
      this.home.position.y + this.hover.y,
      this.home.position.z + this.hover.z,
    );
    this.root.quaternion.copy(this.basis);
    this.root.rotateY(Math.sin(time * 0.09) * 0.045 + this.awareness * 0.14);
    this.tail.scale.set(1, 1 - 0.04 * grip, 1 - 0.06 * grip);
    this.dorsal.rotation.y = Math.sin(time * Math.PI * 16) * 0.18;
    this.leftPectoral.rotation.y = Math.sin(time * Math.PI * 9) * 0.14;
    this.rightPectoral.rotation.y = -Math.sin(time * Math.PI * 9 + 0.8) * 0.14;
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
