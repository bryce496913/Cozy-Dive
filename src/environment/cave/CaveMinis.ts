import * as THREE from 'three';
import type { AssetLease, AssetLoader } from '../../assets/AssetLoader';
import type { Vec3 } from '../../config/world';
import type { SightCandidate } from '../../discovery/journal';
import { CAVE_SIGHTS } from '../../discovery/sights';
import { CAVE } from '../../config/passage';
import { CollisionWorld } from '../../player/collision';
import { CaveEnvironment, CAVE_ROCKS } from './CaveEnvironment';
import { CAVE_LIFE } from './CaveLife';
import { caveFloor } from './CaveTerrain';
import { caveNooks } from './CaveNooks';
import { animateCaveMini, caveBurrow } from './CaveMiniAnimation';
import { WreckMiniOcclusion } from '../wreck/WreckMiniOcclusion';
export const CAVE_MINI_NODES = {
  gazer: 'Stargazer',
  frog: 'Psychedelic_Frogfish',
  shrimp: 'Banded_Coral_Shrimp',
  wonderpus: 'Wonderpus',
} as const;
export type CaveMiniKind = keyof typeof CAVE_MINI_NODES;
export const CAVE_MINI_SIGHTS = {
  gazer: CAVE_SIGHTS.stargazer,
  frog: CAVE_SIGHTS.psychedelic,
  shrimp: CAVE_SIGHTS.bandedCoral,
  wonderpus: CAVE_SIGHTS.wonderpus,
} as const;
export const CAVE_MINI_TUNING = {
  reach: 1.8,
  cone: 0.42,
  spacing: 3,
  sharkClearance: 2.8,
} as const;
export interface CaveMiniHome {
  readonly position: THREE.Vector3;
  readonly rotation: THREE.Quaternion;
  readonly target: THREE.Vector3;
  readonly view: THREE.Vector3;
  readonly attachment: string;
  readonly shelter?: THREE.Vector3;
}
export function caveMiniSolids(
  environment: CaveEnvironment,
  extra?: THREE.Object3D,
): THREE.Mesh[] {
  const meshes: THREE.Mesh[] = [];
  for (const root of [environment.root, extra])
    root?.traverse((o) => {
      if (
        o instanceof THREE.Mesh &&
        !(o instanceof THREE.InstancedMesh) &&
        /Cave (wall|sand|boulders|tunnel|back tunnel|ledge|formations)/.test(
          o.name,
        )
      )
        meshes.push(o);
    });
  return meshes;
}
/** Seats on real sand, beside the cave's existing rocks and cracks, away from shark beds/routes. */
export function caveMiniHomes(
  environment: CaveEnvironment,
  dressing?: THREE.Object3D,
  structures?: THREE.Object3D,
): Record<CaveMiniKind, CaveMiniHome> {
  environment.root.updateMatrixWorld(true);
  dressing?.updateMatrixWorld(true);
  const solids = caveMiniSolids(environment, structures),
    sand = environment.root.getObjectByName('Cave sand')!,
    rock = environment.root.getObjectByName('Cave boulders')!;
  const ray = new THREE.Raycaster(),
    hits: THREE.Intersection[] = [],
    world = new CollisionWorld(environment.colliders, CAVE.bounds, 0),
    swimmer = new CollisionWorld(environment.colliders, CAVE.bounds, 0.3);
  const nooks = caveNooks(environment.skylightTop),
    reserved: THREE.Vector3[] = [],
    homes = {} as Record<CaveMiniKind, CaveMiniHome>;
  const blocked = (p: Vec3, radius = 0) =>
    environment.colliders.some((c) =>
      world.contains(c, p.x, p.y + radius, p.z),
    );
  const cast = (
    a: THREE.Vector3,
    b: THREE.Vector3,
    objects: THREE.Object3D[],
  ) => {
    const d = b.clone().sub(a);
    ray.far = d.length();
    ray.set(a, d.normalize());
    hits.length = 0;
    ray.intersectObjects(objects, true, hits);
    return hits[0];
  };
  const forbidden = [
    ...CAVE_LIFE.resting.map((p) => ({ x: p.x, y: 0, z: p.z })),
    nooks.nurse.at,
    nooks.swell.at,
    nooks.turtle.bed,
    { x: nooks.octopus.x, y: 0, z: nooks.octopus.z },
  ];
  const decoration: THREE.Box3[] = [];
  dressing?.traverse((o) => {
    if (!(o instanceof THREE.InstancedMesh) || /motes|polyp/i.test(o.name))
      return;
    o.geometry.computeBoundingBox();
    const m = new THREE.Matrix4(),
      w = new THREE.Matrix4();
    for (let i = 0; i < o.count; i++) {
      o.getMatrixAt(i, m);
      w.multiplyMatrices(o.matrixWorld, m);
      decoration.push(o.geometry.boundingBox!.clone().applyMatrix4(w));
    }
  });
  const anchors = {
    gazer: { x: -3, z: -18 },
    frog: { x: -6, z: -32 },
    shrimp: { x: 13, z: -28 },
    wonderpus: { x: -5.5, z: -12.5 },
  };
  for (const kind of Object.keys(CAVE_MINI_NODES) as CaveMiniKind[]) {
    const anchor = anchors[kind];
    let chosen: CaveMiniHome | undefined;
    const seeds =
      kind === 'shrimp'
        ? environment.cracks.map((p) => ({
            x: p.x,
            z: p.z,
            angle: p.yaw,
            attachment: 'Existing boulder crack',
          }))
        : kind === 'frog'
          ? CAVE_ROCKS.map((r) => ({
              x: r.x,
              z: r.z,
              angle: Math.atan2(-r.x, -23 - r.z),
              attachment: 'Sheltered boulder margin',
              size: r.size,
            }))
          : [
              {
                ...anchor,
                angle: 0,
                attachment:
                  kind === 'gazer'
                    ? 'Existing cave sand'
                    : 'Entrance sand beside shelter',
              },
            ];
    seeds.sort(
      (a, b) =>
        Math.hypot(a.x - anchor.x, a.z - anchor.z) -
        Math.hypot(b.x - anchor.x, b.z - anchor.z),
    );
    for (const seed of seeds) {
      for (let j = 0; j < 64 && !chosen; j++) {
        const angle = seed.angle + ((j % 16) * Math.PI) / 8,
          r =
            kind === 'frog'
              ? ('size' in seed ? Number(seed.size) : 2) *
                (0.52 + Math.floor(j / 16) * 0.12)
              : kind === 'shrimp'
                ? 0.4 + Math.floor(j / 16) * 0.15
                : Math.floor(j / 16) * 0.55;
        const x = seed.x + Math.sin(angle) * r,
          z = seed.z + Math.cos(angle) * r;
        if (
          (Math.abs(x) < 3 && z > -13) ||
          z < -36 ||
          forbidden.some(
            (p) =>
              Math.hypot(p.x - x, p.z - z) < CAVE_MINI_TUNING.sharkClearance,
          ) ||
          reserved.some((p) => Math.hypot(p.x - x, p.z - z) < 3)
        )
          continue;
        const floor = cast(
          new THREE.Vector3(x, 2, z),
          new THREE.Vector3(x, -3, z),
          [sand],
        );
        if (!floor) continue;
        const at = floor.point.clone().add(new THREE.Vector3(0, 0.008, 0));
        if (
          kind === 'frog' &&
          environment.cracks.some((p) => Math.hypot(p.x - x, p.z - z) < 1.2)
        )
          continue;
        if (
          blocked(at, 0.06) ||
          [
            [-0.16, -0.18],
            [-0.16, 0.18],
            [0.22, -0.18],
            [0.22, 0.18],
          ].some(([dx, dz]) =>
            blocked({ x: x + dx, y: at.y + 0.06, z: z + dz }),
          )
        )
          continue;
        if (
          decoration.some((b) =>
            b
              .clone()
              .expandByScalar(kind === 'wonderpus' ? 0.27 : 0.15)
              .containsPoint(at.clone().add(new THREE.Vector3(0, 0.06, 0))),
          )
        )
          continue;
        let shelter: THREE.Vector3 | undefined;
        if (kind === 'frog' || kind === 'shrimp') {
          const inward = new THREE.Vector3(
            seed.x - x,
            0,
            seed.z - z,
          ).normalize();
          const near = at.clone().addScaledVector(inward, 0.32);
          const hit = cast(
            near.clone().add(new THREE.Vector3(0, 0.14, 0)),
            near.clone().add(new THREE.Vector3(0, 1.5, 0)),
            [rock],
          );
          // A nearby actual overhang or rock face, not a made-up shelter position.
          const face =
            hit ??
            cast(
              at.clone().add(new THREE.Vector3(0, 0.12, 0)),
              at
                .clone()
                .add(new THREE.Vector3(0, 0.12, 0))
                .addScaledVector(inward, 0.9),
              [rock],
            );
          if (!face) continue;
          shelter = face.point.clone();
          if (
            kind === 'shrimp' &&
            environment.cracks.some((p) => Math.hypot(p.x - x, p.z - z) < 0.46)
          )
            continue;
        }
        if (kind === 'wonderpus' && Math.hypot(x - anchor.x, z - anchor.z) > 2)
          continue;
        const rotation = new THREE.Quaternion();
        if (kind === 'gazer' && floor.face)
          rotation.setFromUnitVectors(
            new THREE.Vector3(0, 1, 0),
            floor.face.normal
              .clone()
              .transformDirection(floor.object.matrixWorld),
          );
        const target = at
          .clone()
          .add(
            new THREE.Vector3(
              0,
              kind === 'gazer' ? 0.02 : kind === 'wonderpus' ? 0.09 : 0.06,
              0,
            ),
          );
        if (kind === 'gazer')
          target.add(new THREE.Vector3(0, 0, 0.08).applyQuaternion(rotation));
        for (let k = 0; k < 12; k++) {
          const a = (k * Math.PI) / 6,
            view = at
              .clone()
              .add(
                new THREE.Vector3(Math.sin(a) * 0.95, 0.65, Math.cos(a) * 0.95),
              );
          if (
            swimmer.colliders.some((c) =>
              swimmer.contains(c, view.x, view.y, view.z),
            )
          )
            continue;
          if (
            decoration.some((box) =>
              box.clone().expandByScalar(0.2).containsPoint(view),
            )
          )
            continue;
          let screened = false;
          for (let step = 1; step < 5; step++) {
            const p = view.clone().lerp(target, step / 5);
            if (decoration.some((box) => box.containsPoint(p))) {
              screened = true;
              break;
            }
          }
          if (screened) continue;
          const hit = cast(view, target, solids);
          if (hit && hit.distance < view.distanceTo(target) - 0.025) continue;
          chosen = {
            position: at,
            rotation,
            target,
            view,
            attachment: seed.attachment,
            shelter,
          };
          break;
        }
      }
      if (chosen) break;
    }
    if (!chosen) throw Error(`No cave microhabitat for ${kind}`);
    homes[kind] = chosen;
    reserved.push(chosen.position);
  }
  return homes;
}
interface Animal {
  kind: CaveMiniKind;
  root: THREE.Group;
  mesh?: THREE.Mesh;
  sight: SightCandidate & { position: Vec3 };
}
/** Four meshes, four pose updates, one shared lease. No schooling or new scenery. */
export class CaveMinis {
  readonly root = new THREE.Group();
  readonly sightings: SightCandidate[] = [];
  readonly homes: Record<CaveMiniKind, CaveMiniHome>;
  private readonly animals: Animal[] = [];
  private readonly occlusion: WreckMiniOcclusion<CaveMiniKind>;
  private lease?: AssetLease;
  private loader?: Pick<AssetLoader, 'evictUnused'>;
  private pending?: Promise<boolean>;
  private disposed = false;
  private time = 0;
  private poseTime = 0;
  private readonly materials: THREE.Material[] = [];
  constructor(
    environment: CaveEnvironment,
    dressing?: THREE.Object3D,
    structures?: THREE.Object3D,
  ) {
    this.root.name = 'Cave rare miniatures';
    this.homes = caveMiniHomes(environment, dressing, structures);
    const solids = caveMiniSolids(environment, structures);
    // Nearby static formations/rubble also obstruct sightings, without adding any render mesh.
    dressing?.updateMatrixWorld(true);
    dressing?.traverse((o) => {
      if (
        !(o instanceof THREE.InstancedMesh) ||
        !/Cave formations|Cave rubble/.test(o.name)
      )
        return;
      o.geometry.computeBoundingBox();
      const m = new THREE.Matrix4(),
        world = new THREE.Matrix4();
      for (let i = 0; i < o.count; i++) {
        o.getMatrixAt(i, m);
        world.multiplyMatrices(o.matrixWorld, m);
        const box = o.geometry.boundingBox!.clone().applyMatrix4(world);
        if (
          !Object.values(this.homes).some(
            (h) => box.distanceToPoint(h.target) < CAVE_MINI_TUNING.reach + 0.2,
          )
        )
          continue;
        const cpu = new THREE.Mesh(o.geometry, o.material);
        cpu.matrixAutoUpdate = false;
        cpu.matrix.copy(world);
        cpu.matrixWorld.copy(world);
        solids.push(cpu);
      }
    });
    this.occlusion = new WreckMiniOcclusion(
      solids,
      this.homes,
      CAVE_MINI_TUNING.reach + 0.2,
    );
    for (const kind of Object.keys(CAVE_MINI_NODES) as CaveMiniKind[]) {
      const h = this.homes[kind],
        root = new THREE.Group();
      root.name = kind;
      root.position.copy(h.position);
      root.quaternion.copy(h.rotation);
      root.visible = false;
      this.root.add(root);
      const sight: Animal['sight'] = {
        ...CAVE_MINI_SIGHTS[kind],
        position: { x: h.target.x, y: h.target.y, z: h.target.z },
        radius: 0.08,
        reach: CAVE_MINI_TUNING.reach,
        cone: CAVE_MINI_TUNING.cone,
        visibleFrom: (eye) =>
          eye.y > caveFloor(eye.x, eye.z) + 0.005 &&
          (kind !== 'wonderpus' ||
            caveBurrow('Wonderpus', this.poseTime) < 0.85) &&
          this.occlusion.visible(kind, eye, sight.position),
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
      lease = await loader.acquire('caveMinis');
    } catch {
      return false;
    }
    if (
      this.disposed ||
      Object.values(CAVE_MINI_NODES).some(
        (n) => !(lease.model.getObjectByName(n) instanceof THREE.Mesh),
      )
    ) {
      lease.release();
      loader.evictUnused('caveMinis');
      return false;
    }
    this.lease = lease;
    this.loader = loader;
    this.occlusion.warmUp();
    for (const a of this.animals) {
      const mesh = lease.model.getObjectByName(
        CAVE_MINI_NODES[a.kind],
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
  update(dt: number, active: boolean, reduced: boolean): void {
    if (this.disposed) return;
    if (active && !reduced) this.time += Math.min(0.1, Math.max(0, dt));
    const t = reduced ? 0 : this.time;
    this.poseTime = t;
    for (const a of this.animals) {
      if (!a.mesh) continue;
      animateCaveMini(a.mesh, t, true);
      const h = this.homes[a.kind];
      a.sight.position.y =
        h.target.y +
        (a.kind === 'gazer'
          ? 0.074 * (1 - caveBurrow('Stargazer', t))
          : a.kind === 'wonderpus'
            ? -0.15 * caveBurrow('Wonderpus', t)
            : 0);
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
    this.loader?.evictUnused('caveMinis');
    this.lease = undefined;
  }
}
