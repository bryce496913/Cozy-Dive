import * as THREE from 'three';
import { AQUARIUM, COLLISION, type Vec3 } from '../../config/world';
import { safeFishPosition, type HabitatInterest } from '../../fish/FishHabitat';
import type { FishEntity } from '../../fish/FishEntity';
import type { PlayerPresence } from '../../fish/FishDiverReaction';
import type { ConvexCollider } from '../../player/collision';
import { rockCollider } from '../rockCollider';
import {
  OrnamentGeometry,
  modelColliders,
  type OrnamentKind,
  type OrnamentModel,
} from './OrnamentGeometry';
import { placeOrnament } from './OrnamentPlacement';
import { ChestClock } from './OrnamentAnimation';
import { OrnamentBubbles } from './OrnamentBubbles';

interface MutableLid extends ConvexCollider {
  planes: { x: number; y: number; z: number; offset: number }[];
  min: Vec3;
  max: Vec3;
}
export interface OrnamentSurfaceGroup {
  readonly id: OrnamentKind;
  readonly colliders: readonly ConvexCollider[];
}
export interface OrnamentAnchor extends HabitatInterest {
  readonly anchorId: string;
  readonly ornament: OrnamentKind;
}
/** Environment-owned resources, active-time animation and static/dynamic convex components. */
export class OrnamentSystem {
  readonly root = new THREE.Group();
  readonly models: readonly OrnamentModel[];
  readonly colliders: readonly ConvexCollider[];
  readonly surfaceGroups: readonly OrnamentSurfaceGroup[];
  readonly vegetationColliders: readonly ConvexCollider[];
  readonly anchors: readonly OrnamentAnchor[];
  readonly geometry = new OrnamentGeometry();
  readonly chest = new ChestClock();
  readonly bubbles = new OrnamentBubbles();
  readonly outflow: THREE.Points;
  readonly outflowGeometry = new THREE.BufferGeometry();
  readonly outflowMaterial = new THREE.PointsMaterial({
    color: 0xadc8c4,
    size: 0.025,
    transparent: true,
    opacity: 0.22,
    depthWrite: false,
  });
  readonly lidCollider: MutableLid;
  private sourcePlanes: readonly {
    x: number;
    y: number;
    z: number;
    offset: number;
  }[];
  private readonly lidBox: THREE.Box3;
  private readonly normalMatrix = new THREE.Matrix3();
  private readonly normal = new THREE.Vector3();
  private readonly point = new THREE.Vector3();
  private readonly bounds = new THREE.Box3();
  private readonly hingeWorld = new THREE.Vector3();
  private readonly bubbleOrigin = new THREE.Vector3();
  private flowTime = 0;
  private disposed = false;
  constructor(existing: readonly ConvexCollider[]) {
    this.root.name = 'Home aquarium ornaments';
    const surfaceGroups: OrnamentSurfaceGroup[] = [];
    const models: OrnamentModel[] = [],
      solids: ConvexCollider[] = [],
      reserved: THREE.Box3[] = [];
    for (const kind of [
      'filter',
      'arch',
      'shipwreck',
      'log',
      'statue',
      'chest',
    ] as const) {
      const m = this.geometry.create(kind);
      reserved.push(placeOrnament(m, [...existing, ...solids], reserved));
      this.root.add(m.root);
      models.push(m);
      const hulls = modelColliders(m);
      solids.push(...hulls);
      surfaceGroups.push({ id: kind, colliders: hulls });
    }
    this.models = models;
    this.surfaceGroups = surfaceGroups;
    const lid = models.find((m) => m.kind === 'chest')!.lid!;
    this.sourcePlanes = rockCollider(lid.geometry, new THREE.Matrix4()).planes;
    this.lidCollider = {
      planes: this.sourcePlanes.map((p) => ({ ...p })),
      min: { x: 0, y: 0, z: 0 },
      max: { x: 0, y: 0, z: 0 },
    };
    lid.geometry.computeBoundingBox();
    this.lidBox = lid.geometry.boundingBox!.clone();
    this.syncLid();
    solids.push(this.lidCollider);
    this.colliders = solids;
    const clearanceGeometry = new THREE.BoxGeometry(1.95, 2.15, 1.45);
    const chestRoot = models.find((m) => m.kind === 'chest')!.root;
    const clearanceTransform = chestRoot.matrixWorld
      .clone()
      .multiply(new THREE.Matrix4().makeTranslation(0, 1.075, 0));
    this.vegetationColliders = [
      ...solids.filter((c) => c !== this.lidCollider),
      rockCollider(clearanceGeometry, clearanceTransform),
    ];
    clearanceGeometry.dispose();
    const specs: readonly [
      OrnamentKind,
      string,
      Vec3,
      Vec3,
      HabitatInterest['kind'],
    ][] = [
      [
        'arch',
        'arch-shadow',
        { x: 0, y: 1.35, z: 0 },
        { x: 0, y: 0, z: 1 },
        'shaded-overhang',
      ],
      [
        'shipwreck',
        'shipwreck-crevice',
        { x: 0, y: 1.02, z: 1.08 },
        { x: 0, y: 0, z: 1 },
        'sheltered-crevice',
      ],
      [
        'log',
        'log-interior',
        { x: 0, y: 1.28, z: 0 },
        { x: 0, y: 0, z: 1 },
        'sheltered-crevice',
      ],
      [
        'statue',
        'statue-rear',
        { x: 0, y: 1.1, z: -1.6 },
        { x: 0, y: 0, z: -1 },
        'shaded-overhang',
      ],
      [
        'chest',
        'chest-nearby',
        { x: 0, y: 1.1, z: 2.2 },
        { x: 0, y: 0, z: 1 },
        'sandy-floor',
      ],
      [
        'filter',
        'filter-corner',
        { x: 0, y: 0, z: 1.9 },
        { x: 0, y: 0, z: 1 },
        'reef-face',
      ],
    ];
    const habitat = { bounds: AQUARIUM, rocks: [...existing, ...solids] };
    this.anchors = specs.map(([kind, anchorId, p, n, k]) => {
      const m = models.find((v) => v.kind === kind)!;
      const position = new THREE.Vector3(p.x, p.y, p.z).applyMatrix4(
        m.root.matrixWorld,
      );
      const normal = new THREE.Vector3(n.x, n.y, n.z).transformDirection(
        m.root.matrixWorld,
      );
      if (!safeFishPosition(position, 0.65, habitat))
        throw new Error(`Unsafe ornament anchor: ${anchorId}`);
      return {
        kind: k,
        anchorId,
        ornament: kind,
        position: { x: position.x, y: position.y, z: position.z },
        normal: { x: normal.x, y: normal.y, z: normal.z },
      };
    });
    this.root.add(this.bubbles.mesh);
    this.outflowGeometry.setAttribute(
      'position',
      new THREE.BufferAttribute(new Float32Array(12 * 3), 3),
    );
    this.outflow = new THREE.Points(this.outflowGeometry, this.outflowMaterial);
    this.outflow.name = 'Subtle local filter outflow';
    models.find((m) => m.kind === 'filter')!.root.add(this.outflow);
    this.drawOutflow();
  }
  /** Replace hinge-local shape while preserving the shared moving collider identity. */
  setLidCollisionGeometry(geometry?: THREE.BufferGeometry): void {
    const source =
      geometry ?? this.models.find((m) => m.kind === 'chest')!.lid!.geometry;
    this.sourcePlanes = rockCollider(source, new THREE.Matrix4()).planes;
    this.lidCollider.planes = this.sourcePlanes.map((p) => ({ ...p }));
    source.computeBoundingBox();
    this.lidBox.copy(source.boundingBox!);
    this.syncLid();
  }
  private syncLid(): void {
    const m = this.models.find((m) => m.kind === 'chest')!;
    m.root.updateMatrixWorld(true);
    const matrix = m.lid!.matrixWorld;
    this.normalMatrix.getNormalMatrix(matrix);
    this.sourcePlanes.forEach((p, i) => {
      this.normal
        .set(p.x, p.y, p.z)
        .applyMatrix3(this.normalMatrix)
        .normalize();
      this.point
        .set(p.x * p.offset, p.y * p.offset, p.z * p.offset)
        .applyMatrix4(matrix);
      const out = this.lidCollider.planes[i];
      out.x = this.normal.x;
      out.y = this.normal.y;
      out.z = this.normal.z;
      out.offset = this.normal.dot(this.point);
    });
    this.bounds.copy(this.lidBox).applyMatrix4(matrix);
    Object.assign(this.lidCollider.min, this.bounds.min);
    Object.assign(this.lidCollider.max, this.bounds.max);
  }
  private drawOutflow(): void {
    const p = this.outflowGeometry.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const t = (this.flowTime * 0.24 + i / 12) % 1;
      p.setXYZ(
        i,
        Math.sin(i * 2.4) * 0.09,
        0.85 + Math.sin(i * 1.2 + t) * 0.045,
        1 + t * 0.85,
      );
    }
    p.needsUpdate = true;
    this.outflowGeometry.computeBoundingSphere();
  }
  update(
    dt: number,
    active: boolean,
    reduced: boolean,
    player?: PlayerPresence,
    fish: readonly FishEntity[] = [],
  ): void {
    if (this.disposed || !active || !Number.isFinite(dt) || dt <= 0) return;
    const m = this.models.find((m) => m.kind === 'chest')!;
    m.hinge!.getWorldPosition(this.hingeWorld);
    // Hold the whole cycle before any potential sweep reaches an occupant. No push/recovery is needed.
    const near = (p: Readonly<Vec3>, r: number): boolean =>
      Math.hypot(
        p.x - this.hingeWorld.x,
        p.y - this.hingeWorld.y,
        p.z - this.hingeWorld.z,
      ) <
      1.52 + r + 0.12;
    const blocked =
      (!!player && near(player.position, COLLISION.playerRadius)) ||
      fish.some((f) => near(f.position, f.radius));
    const opened = this.chest.update(dt, active, reduced, blocked);
    m.hinge!.rotation.x = -this.chest.angle;
    this.syncLid();
    if (opened && !reduced) {
      this.bubbleOrigin.set(0, 0.95, 0.05).applyMatrix4(m.root.matrixWorld);
      this.bubbles.emit(this.bubbleOrigin);
    }
    this.bubbles.update(dt, active, reduced);
    if (!reduced) {
      this.flowTime += Math.min(dt, 0.1);
      this.drawOutflow();
    }
  }
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.root.removeFromParent();
    this.bubbles.dispose();
    for (const m of this.models) for (const g of m.geometries) g.dispose();
    this.geometry.materials.forEach((m) => m.dispose());
    this.outflowGeometry.dispose();
    this.outflowMaterial.dispose();
    this.root.clear();
  }
}
