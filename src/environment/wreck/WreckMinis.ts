import * as THREE from 'three';
import type { AssetLease, AssetLoader } from '../../assets/AssetLoader';
import type { Vec3 } from '../../config/world';
import type { SightCandidate } from '../../discovery/journal';
import { WRECK_SIGHTS } from '../../discovery/sights';
import type { PlayerPresence } from '../../fish/FishDiverReaction';
import type { WreckEnvironment } from './WreckEnvironment';
import { WRECK } from '../../config/wreck';
import { CollisionWorld } from '../../player/collision';
import {
  DECK_TOP,
  SHIP,
  SHIP_POSE,
  hullX,
  wreckColliders,
} from './WreckLayout';
import { WreckMiniOcclusion } from './WreckMiniOcclusion';
import { animateWreckMini } from './WreckMiniAnimation';

export const WRECK_MINI_NODES = {
  skeleton: 'Skeleton_Shrimp',
  wolf: 'Juvenile_Wolf_Eel',
  crab: 'Decorator_Crab',
  greenling: 'Painted_Greenling',
} as const;
export type WreckMiniKind = keyof typeof WRECK_MINI_NODES;
export const WRECK_MINI_SIGHTS = {
  skeleton: WRECK_SIGHTS.skeleton,
  wolf: WRECK_SIGHTS.wolf,
  crab: WRECK_SIGHTS.decorator,
  greenling: WRECK_SIGHTS.greenling,
} as const;
export const WRECK_MINI_TUNING = {
  reach: 1.8,
  cone: 0.42,
  minSpacing: 2,
  approach: 1.1,
  retreatRate: 1.6,
} as const;
export interface WreckMiniHome {
  readonly position: THREE.Vector3;
  readonly rotation: THREE.Quaternion;
  readonly view: THREE.Vector3;
  readonly target: THREE.Vector3;
  readonly attachment: string;
  readonly instance?: number;
}
/** Only opaque structural meshes; the shrimp's own hydroid fronds must not hide its identity. */
export function wreckMiniSolids(
  environment: Pick<WreckEnvironment, 'ship'>,
): THREE.Mesh[] {
  return environment.ship.root.children.filter(
    (o): o is THREE.Mesh =>
      o instanceof THREE.Mesh && !(o instanceof THREE.InstancedMesh),
  );
}

/** Four stable seats on the drawn ship. No new den, colony, collision shape or navigation route. */
export function wreckMiniHomes(
  environment: Pick<WreckEnvironment, 'ship'>,
): Record<WreckMiniKind, WreckMiniHome> {
  const ship = environment.ship.root;
  ship.updateMatrixWorld(true);
  const solids = wreckMiniSolids(environment),
    ray = new THREE.Raycaster(),
    hits: THREE.Intersection[] = [];
  const shipRotation = new THREE.Quaternion().setFromRotationMatrix(SHIP_POSE),
    up = new THREE.Vector3(0, 1, 0).applyQuaternion(shipRotation);
  const matrix = new THREE.Matrix4(),
    world = new THREE.Matrix4(),
    v = new THREE.Vector3(),
    size = new THREE.Vector3(),
    rotation = new THREE.Quaternion();
  const cast = (a: THREE.Vector3, b: THREE.Vector3) => {
    const direction = b.clone().sub(a);
    ray.far = direction.length();
    ray.set(a, direction.normalize());
    hits.length = 0;
    ray.intersectObjects(solids, false, hits);
    return hits[0];
  };
  const boxes: { box: THREE.Box3; mesh: THREE.InstancedMesh; index: number }[] =
    [];
  for (const o of ship.children)
    if (o instanceof THREE.InstancedMesh && !o.name.includes('encrusting')) {
      o.geometry.computeBoundingBox();
      for (let i = 0; i < o.count; i++) {
        o.getMatrixAt(i, matrix);
        world.multiplyMatrices(o.matrixWorld, matrix);
        boxes.push({
          box: o.geometry
            .boundingBox!.clone()
            .applyMatrix4(world)
            .expandByScalar(0.015),
          mesh: o,
          index: i,
        });
      }
    }
  const collision = new CollisionWorld(wreckColliders(), WRECK.bounds, 0.35);
  const inverse = SHIP_POSE.clone().invert();
  const homes = {} as Record<WreckMiniKind, WreckMiniHome>;
  const reserved: THREE.Vector3[] = [];
  const viewing = (
    at: THREE.Vector3,
    q: THREE.Quaternion,
    target: THREE.Vector3,
  ) => {
    for (let i = 0; i < 12; i++) {
      const angle = (i * Math.PI) / 6,
        eye = at
          .clone()
          .add(
            new THREE.Vector3(
              Math.sin(angle) * 0.9,
              0.65,
              Math.cos(angle) * 0.9,
            ).applyQuaternion(q),
          );
      if (
        collision.colliders.some((c) =>
          collision.contains(c, eye.x, eye.y, eye.z),
        )
      )
        continue;
      if (
        boxes.some((b) => b.box.clone().expandByScalar(0.12).containsPoint(eye))
      )
        continue;
      const hit = cast(eye, target);
      if (!hit || hit.distance > eye.distanceTo(target) - 0.025) return eye;
    }
    return undefined;
  };
  const pick = (
    kind: 'skeleton' | 'crab' | 'greenling',
    name: string,
    anchor: THREE.Vector3,
  ) => {
    const growth = ship.getObjectByName(name);
    if (!(growth instanceof THREE.InstancedMesh))
      throw Error(`Missing wreck substrate ${name}`);
    const candidates: {
      index: number;
      local: THREE.Vector3;
      matrix: THREE.Matrix4;
    }[] = [];
    for (let i = 0; i < growth.count; i++) {
      growth.getMatrixAt(i, matrix);
      v.setFromMatrixPosition(matrix);
      if (
        v.y < DECK_TOP - 0.05 ||
        v.z < -43 ||
        v.z > -24 ||
        Math.abs(v.x) < 2.15
      )
        continue;
      if (
        new THREE.Vector3(0, 1, 0).transformDirection(matrix).y < 0.98 ||
        (kind === 'skeleton' && Math.abs(v.x) > SHIP.half - 0.65)
      )
        continue;
      candidates.push({ index: i, local: v.clone(), matrix: matrix.clone() });
    }
    candidates.sort(
      (a, b) =>
        a.local.distanceToSquared(anchor) - b.local.distanceToSquared(anchor),
    );
    for (const c of candidates) {
      world.multiplyMatrices(growth.matrixWorld, c.matrix);
      world.decompose(v, rotation, size);
      for (const distance of kind === 'skeleton' ? [0] : [0.25, 0.4, 0.6, 0.85])
        for (let i = 0; i < (kind === 'skeleton' ? 1 : 12); i++) {
          let at: THREE.Vector3, q: THREE.Quaternion;
          if (kind === 'skeleton') {
            // A real vertex on a lower hydroid stem, not an imaginary offset in open water.
            const p = growth.geometry.getAttribute('position');
            let nearest = Infinity,
              index = 0;
            for (let j = 0; j < p.count; j++) {
              const d =
                p.getX(j) ** 2 + (p.getY(j) - 0.035) ** 2 + p.getZ(j) ** 2;
              if (d < nearest) {
                nearest = d;
                index = j;
              }
            }
            at = new THREE.Vector3()
              .fromBufferAttribute(p, index)
              .applyMatrix4(world);
            q = rotation.clone();
          } else {
            const a = (i * Math.PI) / 6,
              centre = v
                .clone()
                .add(
                  new THREE.Vector3(
                    Math.sin(a) * distance,
                    0,
                    Math.cos(a) * distance,
                  ).applyQuaternion(shipRotation),
                );
            const hit = cast(
              centre.clone().addScaledVector(up, 1),
              centre.clone().addScaledVector(up, -1),
            );
            if (!hit || hit.object.name !== 'Wreck decks') continue;
            at = hit.point.clone().addScaledVector(up, 0.012);
            const shipAt = at.clone().applyMatrix4(inverse);
            if (Math.abs(shipAt.x) > SHIP.half - 0.65) continue;
            if (
              kind === 'crab' &&
              Math.abs(shipAt.x) < SHIP.hatch.half + 0.45
            ) {
              shipAt.x =
                Math.sign(shipAt.x || c.local.x || 1) *
                (SHIP.hatch.half + 0.46);
              at.copy(shipAt.applyMatrix4(SHIP_POSE));
            }
            q = shipRotation.clone();
            const envelope = new THREE.Box3().setFromCenterAndSize(
              at
                .clone()
                .add(
                  new THREE.Vector3(
                    kind === 'greenling' ? 0.08 : 0,
                    0.08,
                    0,
                  ).applyQuaternion(q),
                ),
              new THREE.Vector3(kind === 'greenling' ? 0.46 : 0.28, 0.22, 0.34),
            );
            if (
              kind !== 'crab' &&
              boxes.some((b) => b.box.intersectsBox(envelope))
            )
              continue;
          }
          if (
            reserved.some(
              (p) => p.distanceTo(at) < WRECK_MINI_TUNING.minSpacing,
            )
          )
            continue;
          const target = at
              .clone()
              .add(
                new THREE.Vector3(
                  0,
                  kind === 'skeleton' ? 0.1 : 0.06,
                  0,
                ).applyQuaternion(q),
              ),
            view = viewing(at, q, target);
          if (!view) continue;
          homes[kind] = {
            position: at,
            rotation: q,
            view,
            target,
            attachment: name,
            instance: c.index,
          };
          reserved.push(at);
          return;
        }
    }
    throw Error(`No clear wreck microhabitat for ${kind}`);
  };
  // The small eel occupies the upper-forward margin of the existing breach, clear of its route.
  const z = SHIP.breach.foreZ + 0.45,
    y = SHIP.breach.high - 0.45;
  const at = new THREE.Vector3(hullX(z, y) - 0.1, y, z).applyMatrix4(SHIP_POSE),
    q = shipRotation
      .clone()
      .multiply(
        new THREE.Quaternion().setFromAxisAngle(
          new THREE.Vector3(0, 1, 0),
          Math.PI / 2,
        ),
      );
  const target = at
    .clone()
    .add(new THREE.Vector3(0, 0.075, 0.21).applyQuaternion(q));
  homes.wolf = {
    position: at,
    rotation: q,
    target,
    view: target.clone().add(new THREE.Vector3(0, 0.25, 1).applyQuaternion(q)),
    attachment: 'Existing starboard hull breach',
  };
  reserved.push(at);
  pick('skeleton', 'Wreck hydroids', new THREE.Vector3(-2.8, DECK_TOP, -39));
  pick('crab', 'Wreck soft corals', new THREE.Vector3(2.8, DECK_TOP, -27));
  pick(
    'greenling',
    'Wreck encrusting mats',
    new THREE.Vector3(-2.8, DECK_TOP, -34),
  );
  return homes;
}
interface Animal {
  kind: WreckMiniKind;
  root: THREE.Group;
  mesh?: THREE.Mesh;
  sight: SightCandidate & { position: Vec3 };
}
/** Four meshes, four pose updates, one shared lease. No schooling or new scenery. */
export class WreckMinis {
  readonly root = new THREE.Group();
  readonly sightings: SightCandidate[] = [];
  readonly homes: Record<WreckMiniKind, WreckMiniHome>;
  private readonly animals: Animal[] = [];
  private readonly occlusion: WreckMiniOcclusion<WreckMiniKind>;
  private lease?: AssetLease;
  private loader?: Pick<AssetLoader, 'evictUnused'>;
  private pending?: Promise<boolean>;
  private disposed = false;
  private time = 0;
  private retreat = 0;
  private readonly materials: THREE.Material[] = [];
  constructor(environment: Pick<WreckEnvironment, 'ship'>) {
    this.root.name = 'Wreck rare miniatures';
    this.homes = wreckMiniHomes(environment);
    this.occlusion = new WreckMiniOcclusion(
      wreckMiniSolids(environment),
      this.homes,
      WRECK_MINI_TUNING.reach,
    );
    for (const kind of Object.keys(WRECK_MINI_NODES) as WreckMiniKind[]) {
      const h = this.homes[kind],
        root = new THREE.Group();
      root.name = kind;
      root.position.copy(h.position);
      root.quaternion.copy(h.rotation);
      root.visible = false;
      this.root.add(root);
      const sight: Animal['sight'] = {
        ...WRECK_MINI_SIGHTS[kind],
        position: { x: h.target.x, y: h.target.y, z: h.target.z },
        radius: 0.08,
        reach: WRECK_MINI_TUNING.reach,
        cone: WRECK_MINI_TUNING.cone,
        visibleFrom: (eye) => this.occlusion.visible(kind, eye, sight.position),
      };
      this.animals.push({ kind, root, sight });
    }
  }
  load(loader: Pick<AssetLoader, 'acquire' | 'evictUnused'>): Promise<boolean> {
    return (this.pending ??= this.loadModels(loader));
  }
  private async loadModels(
    loader: Pick<AssetLoader, 'acquire' | 'evictUnused'>,
  ): Promise<boolean> {
    let lease: AssetLease;
    try {
      lease = await loader.acquire('wreckMinis');
    } catch {
      return false;
    }
    if (
      this.disposed ||
      Object.values(WRECK_MINI_NODES).some(
        (n) => !(lease.model.getObjectByName(n) instanceof THREE.Mesh),
      )
    ) {
      lease.release();
      loader.evictUnused('wreckMinis');
      return false;
    }
    this.lease = lease;
    this.loader = loader;
    this.occlusion.warmUp();
    for (const a of this.animals) {
      const mesh = lease.model.getObjectByName(
        WRECK_MINI_NODES[a.kind],
      ) as THREE.Mesh;
      mesh.removeFromParent();
      mesh.position.set(0, 0, 0);
      mesh.quaternion.identity();
      mesh.scale.setScalar(1);
      const own = (m: THREE.Material) => {
        const c = m.clone();
        this.materials.push(c);
        return c;
      };
      mesh.material = Array.isArray(mesh.material)
        ? mesh.material.map(own)
        : own(mesh.material);
      a.root.add(mesh);
      a.mesh = mesh;
      a.root.visible = true;
      this.sightings.push(a.sight);
    }
    this.update(0, false, false);
    return true;
  }
  update(
    dt: number,
    active: boolean,
    reduced: boolean,
    player?: PlayerPresence,
  ): void {
    if (this.disposed) return;
    const step = Math.min(0.1, Math.max(0, dt));
    if (active && !reduced) {
      this.time += step;
      const p = this.homes.wolf.target,
        eye = player?.position;
      const near =
        eye &&
        Math.hypot(eye.x - p.x, eye.y - p.y, eye.z - p.z) <
          WRECK_MINI_TUNING.approach;
      this.retreat +=
        ((near ? 0.75 : 0) - this.retreat) *
        (1 - Math.exp(-WRECK_MINI_TUNING.retreatRate * step));
    }
    const t = reduced ? 0 : this.time;
    for (const a of this.animals) {
      if (!a.mesh) continue;
      animateWreckMini(
        a.mesh,
        t,
        a.kind === 'wolf' && !reduced ? this.retreat : 0,
      );
    }
  }
  get loaded(): boolean {
    return !!this.lease;
  }
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.sightings.length = 0;
    this.occlusion.dispose();
    this.root.removeFromParent();
    this.root.clear();
    this.materials.forEach((m) => m.dispose());
    this.lease?.release();
    this.loader?.evictUnused('wreckMinis');
    this.lease = undefined;
  }
}
