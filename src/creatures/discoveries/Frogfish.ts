import * as THREE from 'three';
import type { FishHabitat } from '../../fish/FishHabitat';
import type { PlayerPresence } from '../../fish/FishDiverReaction';
import {
  surfaceHome,
  type SurfaceHome,
  type DiscoverySurfaceGroup,
} from './DiscoveryHabitat';
import {
  ellipsoid,
  mergeParts,
  tint,
  tube,
  finGeometry,
} from './DiscoveryGeometry';
const PERCHES = [
  [-0.06, -0.03],
  [0.06, -0.03],
  [0.06, 0.07],
  [-0.06, 0.07],
] as const;
export interface FrogfishMotion {
  x: number;
  z: number;
  walking: boolean;
  stride: number;
}
export function frogfishStep(time: number, out: FrogfishMotion): void {
  const cycle = Math.floor(time / 112),
    phase = time % 112,
    from = PERCHES[cycle % 4],
    to = PERCHES[(cycle + 1) % 4],
    t = Math.max(0, Math.min(1, (phase - 104) / 8)),
    ease = t * t * (3 - 2 * t);
  out.x = from[0] + (to[0] - from[0]) * ease;
  out.z = from[1] + (to[1] - from[1]) * ease;
  out.walking = phase >= 104;
  out.stride = t;
}
/** Still, warty, limb-finned perch animal with rare small walking steps. */
export class Frogfish {
  readonly root = new THREE.Group();
  readonly body = new THREE.Group();
  readonly leftFoot: THREE.Mesh;
  readonly rightFoot: THREE.Mesh;
  readonly lure = new THREE.Group();
  readonly material = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.96,
  });
  readonly geometries: readonly THREE.BufferGeometry[];
  readonly home: SurfaceHome;
  walking = false;
  awareness = 0;
  private readonly offset = new THREE.Vector3();
  private readonly step: FrogfishMotion = {
    x: 0,
    z: 0,
    walking: false,
    stride: 0,
  };
  private disposed = false;
  constructor(h: FishHabitat, groups: readonly DiscoverySurfaceGroup[]) {
    this.root.name = 'Hidden frogfish';
    const skin = 0xb38b64,
      shade = 0x826647,
      parts: THREE.BufferGeometry[] = [];
    const body = ellipsoid(0, 0.29, -0.04, 0.265, 0.27, 0.3, skin, 0.16),
      head = ellipsoid(0, 0.285, 0.16, 0.29, 0.23, 0.23, skin, 0.16);
    const v = head.attributes.position;
    for (let i = 0; i < v.count; i++) v.setZ(i, Math.min(v.getZ(i), 0.375));
    for (let i = 0; i < v.count; i++) {
      const x = v.getX(i),
        y = v.getY(i),
        z = v.getZ(i);
      v.setXYZ(
        i,
        x * (1 + 0.035 * Math.sin(y * 43 + z * 37)),
        y + 0.01 * Math.sin(x * 57 + z * 41),
        Math.min(0.375, z + 0.007 * Math.sin(x * 39 + y * 41)),
      );
    }
    head.computeVertexNormals();
    for (const g of [body, head]) {
      const p = g.attributes.position,
        c = g.attributes.color,
        color = new THREE.Color();
      for (let i = 0; i < p.count; i++) {
        const field =
          Math.sin(p.getX(i) * 37 + p.getY(i) * 23) *
          Math.cos(p.getZ(i) * 31 - p.getY(i) * 17);
        color.setHex(field > 0.3 ? 0x92704f : field < -0.3 ? 0xc1a57a : skin);
        c.setXYZ(i, color.r, color.g, color.b);
      }
    }

    parts.push(body, head);
    parts.push(ellipsoid(0, 0.25, 0.394, 0.164, 0.105, 0.012, 0x454d3d));
    const lip = new THREE.TorusGeometry(0.16, 0.025, 7, 22);
    lip.scale(1.1, 0.65, 1);
    lip.translate(0, 0.25, 0.414);
    parts.push(tint(lip, shade));
    for (const side of [-1, 1]) {
      parts.push(
        ellipsoid(side * 0.226, 0.43, 0.26, 0.027, 0.029, 0.026, 0xb59b63),
      );
      parts.push(
        ellipsoid(side * 0.24, 0.438, 0.282, 0.015, 0.018, 0.015, 0x263127),
      );
    }
    for (let i = 0; i < 27; i++) {
      const a = i * 2.39996,
        y = 0.19 + (i % 6) * 0.055,
        r = Math.sqrt(Math.max(0.05, 1 - ((y - 0.29) / 0.29) ** 2));
      parts.push(
        ellipsoid(
          Math.cos(a) * 0.24 * r,
          y,
          -0.04 + Math.sin(a) * 0.28 * r,
          0.025 + (i % 3) * 0.004,
          0.022,
          0.025,
          i % 3 ? skin : shade,
        ),
      );
    }
    const tail = new THREE.CylinderGeometry(0.022, 0.09, 0.14, 8);
    tail.rotateX(Math.PI / 2);
    tail.scale(1.1, 0.7, 1);
    tail.translate(0, 0.2, -0.36);
    parts.push(tint(tail, shade));
    const bodyGeometry = mergeParts(parts);
    this.body.add(new THREE.Mesh(bodyGeometry, this.material));
    this.root.add(this.body);
    const footParts = [
      tube(
        [
          new THREE.Vector3(0.19, 0.25, 0.035),
          new THREE.Vector3(0.29, 0.08, 0.18),
          new THREE.Vector3(0.38, 0.025, 0.29),
        ],
        0.036,
        shade,
      ),
    ];
    for (const z of [0.24, 0.29, 0.34])
      footParts.push(ellipsoid(0.39, 0.026, z, 0.045, 0.026, 0.015, skin));
    const arm = footParts[0],
      ap = arm.attributes.position,
      armCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(0.19, 0.25, 0.035),
        new THREE.Vector3(0.29, 0.08, 0.18),
        new THREE.Vector3(0.38, 0.025, 0.29),
      ]);
    for (let i = 0; i <= 10; i++) {
      const c = armCurve.getPoint(i / 10),
        factor = 1 - (i / 10) * 0.6;
      for (let j = 0; j <= 6; j++) {
        const k = i * 7 + j;
        ap.setXYZ(
          k,
          c.x + (ap.getX(k) - c.x) * factor,
          c.y + (ap.getY(k) - c.y) * factor,
          c.z + (ap.getZ(k) - c.z) * factor,
        );
      }
    }
    arm.computeVertexNormals();
    footParts.push(
      finGeometry(
        [
          new THREE.Vector3(0.28, 0.02, 0.18),
          new THREE.Vector3(0.3, 0.02, 0.34),
          new THREE.Vector3(0.43, 0.02, 0.35),
          new THREE.Vector3(0.43, 0.02, 0.23),
        ],
        skin,
      ),
    );
    const footGeometry = mergeParts(footParts);
    this.leftFoot = new THREE.Mesh(footGeometry, this.material);
    this.rightFoot = new THREE.Mesh(footGeometry, this.material);
    for (const [mesh, side] of [
      [this.leftFoot, 1],
      [this.rightFoot, -1],
    ] as const) {
      mesh.geometry = footGeometry;
      mesh.material = this.material;
      mesh.scale.x = side;
      this.root.add(mesh);
    }
    const lureGeometry = mergeParts([
      tube(
        [
          new THREE.Vector3(0, 0, 0),
          new THREE.Vector3(0, 0.17, 0.1),
          new THREE.Vector3(0, 0.11, 0.22),
        ],
        0.008,
        shade,
      ),
      ellipsoid(0, 0.11, 0.22, 0.024, 0.029, 0.023, 0xc0b797),
    ]);
    this.lure.position.set(0, 0.54, 0.1);
    this.lure.add(new THREE.Mesh(lureGeometry, this.material));
    this.body.add(this.lure);
    this.geometries = [bodyGeometry, footGeometry, lureGeometry];
    try {
      this.home = surfaceHome('frogfish', groups, h, 0.53, 0.56, 0.78);
    } catch (error) {
      this.dispose();
      throw error;
    }
    this.pose(0);
  }
  respond(dt: number, player?: PlayerPresence): void {
    const p = this.home.position,
      near =
        player?.active &&
        Math.hypot(
          player.position.x - p.x,
          player.position.y - p.y - 0.3,
          player.position.z - p.z,
        ) < 1
          ? 1
          : 0;
    this.awareness += (near - this.awareness) * -Math.expm1(-0.8 * dt);
  }
  pose(time: number): void {
    if (this.disposed) return;
    const phase = this.step;
    frogfishStep(time, phase);
    this.walking = phase.walking;
    this.offset.set(phase.x, 0, phase.z);
    this.root.position
      .copy(this.offset)
      .applyQuaternion(this.home.rotation)
      .add(this.home.position);
    this.root.quaternion.copy(this.home.rotation);
    this.root.rotateY(Math.sin(time * 0.023) * 0.035 + this.awareness * 0.04);
    this.body.scale.y = 1 + Math.sin(time * 0.8) * 0.007;
    this.lure.rotation.z = Math.sin(time * 0.27) * 0.045;
    this.leftFoot.position.y = this.walking
      ? Math.max(0, Math.sin(phase.stride * Math.PI * 4)) * 0.018
      : 0;
    this.rightFoot.position.y = this.walking
      ? Math.max(0, -Math.sin(phase.stride * Math.PI * 4)) * 0.018
      : 0;
  }
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.root.removeFromParent();
    this.root.clear();
    this.geometries?.forEach((g) => g.dispose());
    this.material.dispose();
  }
}
