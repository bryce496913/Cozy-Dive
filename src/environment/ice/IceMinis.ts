import * as THREE from 'three';
import type { AssetLease, AssetLoader } from '../../assets/AssetLoader';
import type { Vec3 } from '../../config/world';
import type { SightCandidate } from '../../discovery/journal';
import { ICE_SIGHTS } from '../../discovery/sights';
import { ICE } from '../../config/passage';
import { CollisionWorld } from '../../player/collision';
import type { IceEnvironment } from './IceEnvironment';
import type { IceGarden } from './IceGarden';
import { iceFloor, iceUndersideAt } from './IceTerrain';
import { animateIceMini } from './IceMiniAnimation';
import { WreckMiniOcclusion } from '../wreck/WreckMiniOcclusion';
export const ICE_MINI_NODES = {
  angel: 'Clione_Antarctica',
  slug: 'Tritoniella_Belli',
  isopod: 'Glyptonotus_Antarcticus',
} as const;
export type IceMiniKind = keyof typeof ICE_MINI_NODES;
export const ICE_MINI_SIGHTS = {
  angel: ICE_SIGHTS.seaAngel,
  slug: ICE_SIGHTS.tritoniella,
  isopod: ICE_SIGHTS.isopod,
} as const;
export const ICE_MINI_TUNING = { reach: 1.8, cone: 0.42, spacing: 3 } as const;
export interface IceMiniHome {
  readonly position: THREE.Vector3;
  readonly rotation: THREE.Quaternion;
  readonly target: THREE.Vector3;
  readonly view: THREE.Vector3;
  readonly attachment: string;
}
/** Static opaque surfaces and exact instanced growth, CPU-only wrappers: no new render calls. */
export function iceMiniSolids(
  environment: IceEnvironment,
  ...growth: (THREE.Object3D | undefined)[]
): THREE.Mesh[] {
  const solids: THREE.Mesh[] = [];
  environment.root.updateMatrixWorld(true);
  for (const root of [environment.root, ...growth]) {
    root?.updateMatrixWorld(true);
    root?.traverse((o) => {
      if (!(o instanceof THREE.Mesh)) return;
      const materials = Array.isArray(o.material) ? o.material : [o.material];
      if (materials.every((m) => m.transparent || m.opacity < 0.95)) return;
      if (o instanceof THREE.InstancedMesh) {
        const m = new THREE.Matrix4();
        for (let i = 0; i < o.count; i++) {
          o.getMatrixAt(i, m);
          const cpu = new THREE.Mesh(o.geometry, o.material);
          cpu.name = o.name;
          cpu.matrixAutoUpdate = false;
          cpu.matrixWorld.multiplyMatrices(o.matrixWorld, m);
          cpu.matrix.copy(cpu.matrixWorld);
          solids.push(cpu);
        }
      } else solids.push(o);
    });
  }
  return solids;
}
/** Repeatable growth/rock margins, away from the tunnel, breathing holes and large-animal beds. */
export function iceMiniHomes(
  environment: IceEnvironment,
  solids: THREE.Mesh[],
): Record<IceMiniKind, IceMiniHome> {
  const homes = {} as Record<IceMiniKind, IceMiniHome>,
    world = new CollisionWorld(environment.colliders, ICE.bounds, 0.3),
    bed = environment.root.getObjectByName('Ice seabed')!,
    ray = new THREE.Raycaster(),
    hits: THREE.Intersection[] = [];
  const cast = (
    a: THREE.Vector3,
    b: THREE.Vector3,
    meshes: THREE.Object3D[],
  ) => {
    const d = b.clone().sub(a);
    ray.far = d.length();
    ray.set(a, d.normalize());
    hits.length = 0;
    ray.intersectObjects(meshes, false, hits);
    return hits[0];
  };
  const obstacles = solids
    .filter((s) => s.parent === null)
    .map((s) => {
      s.geometry.computeBoundingBox();
      return {
        mesh: s,
        box: s.geometry.boundingBox!.clone().applyMatrix4(s.matrixWorld),
      };
    });
  for (const kind of Object.keys(ICE_MINI_NODES) as IceMiniKind[]) {
    const anchor =
      kind === 'angel'
        ? { x: -9, z: -19 }
        : kind === 'slug'
          ? { x: -8, z: -23 }
          : { x: 11, z: -28 };
    const seeds =
      kind === 'slug'
        ? solids
            .filter((s) => s.name === 'Soft corals')
            .map((s) =>
              new THREE.Vector3().setFromMatrixPosition(s.matrixWorld),
            )
        : kind === 'isopod'
          ? environment.stones.map((s) => new THREE.Vector3(s.x, s.y, s.z))
          : [new THREE.Vector3(anchor.x, 0, anchor.z)];
    seeds.sort(
      (a, b) =>
        Math.hypot(a.x - anchor.x, a.z - anchor.z) -
        Math.hypot(b.x - anchor.x, b.z - anchor.z),
    );
    let chosen: IceMiniHome | undefined;
    for (const seed of seeds) {
      for (let j = 0; j < 96 && !chosen; j++) {
        const angle = ((j % 24) * Math.PI) / 12;
        const stone = environment.stones.find(
          (s) => s.x === seed.x && s.z === seed.z,
        );
        const r =
          kind === 'angel'
            ? Math.floor(j / 24) * 0.35
            : kind === 'slug'
              ? 0.35 + Math.floor(j / 24) * 0.15
              : (stone?.size ?? 1) * 0.8 + 0.35 + Math.floor(j / 24) * 0.25;
        const x = seed.x + Math.sin(angle) * r,
          z = seed.z + Math.cos(angle) * r;
        if (
          Math.abs(x) > 19 ||
          z > -14 ||
          z < -54 ||
          ICE.holes.some((h) => Math.hypot(x - h.x, z - h.z) < h.r + 1.5)
        )
          continue;
        if (
          Object.values(homes).some(
            (h) => Math.hypot(h.position.x - x, h.position.z - z) < 3,
          )
        )
          continue;
        let y = 9;
        if (kind !== 'angel') {
          y = -Infinity;
          for (const dx of [-0.12, 0, 0.12])
            for (const dz of [-0.18, 0, 0.18]) {
              const hit = cast(
                new THREE.Vector3(x + dx, 2, z + dz),
                new THREE.Vector3(x + dx, -3, z + dz),
                [bed],
              );
              if (hit) y = Math.max(y, hit.point.y + 0.006);
            }
          if (!Number.isFinite(y)) continue;
        } else if (iceUndersideAt(x, z) - y < 3) continue;
        const at = new THREE.Vector3(x, y, z),
          target = at
            .clone()
            .add(new THREE.Vector3(0, kind === 'angel' ? 0.065 : 0.04, 0));
        const footprint = new THREE.Box3().setFromCenterAndSize(
          at.clone().add(new THREE.Vector3(0, 0.09, 0)),
          new THREE.Vector3(0.31, 0.18, 0.42),
        );
        if (obstacles.some((o) => o.box.intersectsBox(footprint))) continue;
        if (world.colliders.some((c) => world.contains(c, x, y + 0.1, z)))
          continue;
        for (let k = 0; k < 16; k++) {
          const a = (k * Math.PI) / 8,
            view = target
              .clone()
              .add(
                new THREE.Vector3(
                  Math.sin(a) * 0.75,
                  kind === 'angel' ? 0.08 : 0.5,
                  Math.cos(a) * 0.75,
                ),
              );
          if (
            world.colliders.some((c) =>
              world.contains(c, view.x, view.y, view.z),
            )
          )
            continue;
          if (
            obstacles.some((o) =>
              o.box.clone().expandByScalar(0.2).containsPoint(view),
            )
          )
            continue;
          const hit = cast(view, target, solids);
          if (hit && hit.distance < view.distanceTo(target) - 0.01) continue;
          chosen = {
            position: at,
            rotation: new THREE.Quaternion(),
            target,
            view,
            attachment:
              kind === 'angel'
                ? 'Under-ice water'
                : kind === 'slug'
                  ? 'Existing soft-coral margin'
                  : 'Existing dropstone margin',
          };
          break;
        }
      }
      if (chosen) break;
    }
    if (!chosen) throw Error('No Antarctic microhabitat for ' + kind);
    homes[kind] = chosen;
  }
  return homes;
}
interface Animal {
  kind: IceMiniKind;
  root: THREE.Group;
  mesh?: THREE.Mesh;
  sight: SightCandidate & { position: Vec3 };
}
/** Three meshes, three pose updates, one shared lease. No schooling or new scenery. */
export class IceMinis {
  readonly root = new THREE.Group();
  readonly sightings: SightCandidate[] = [];
  readonly homes: Record<IceMiniKind, IceMiniHome>;
  private readonly animals: Animal[] = [];
  private readonly occlusion: WreckMiniOcclusion<IceMiniKind>;
  private lease?: AssetLease;
  private loader?: Pick<AssetLoader, 'evictUnused'>;
  private pending?: Promise<boolean>;
  private disposed = false;
  private time = 0;
  private readonly materials: THREE.Material[] = [];
  constructor(
    environment: IceEnvironment,
    garden: IceGarden,
    extra?: THREE.Object3D,
  ) {
    this.root.name = 'Antarctic rare miniatures';
    const solids = iceMiniSolids(environment, garden.root, extra);
    this.homes = iceMiniHomes(environment, solids);
    this.occlusion = new WreckMiniOcclusion(
      solids,
      this.homes,
      ICE_MINI_TUNING.reach + 0.2,
    );
    for (const kind of Object.keys(ICE_MINI_NODES) as IceMiniKind[]) {
      const h = this.homes[kind],
        root = new THREE.Group();
      root.name = kind;
      root.position.copy(h.position);
      root.quaternion.copy(h.rotation);
      root.visible = false;
      this.root.add(root);
      const sight: Animal['sight'] = {
        ...ICE_MINI_SIGHTS[kind],
        position: { x: h.target.x, y: h.target.y, z: h.target.z },
        radius: 0.08,
        reach: ICE_MINI_TUNING.reach,
        cone: ICE_MINI_TUNING.cone,
        visibleFrom: (eye) =>
          eye.y > iceFloor(eye.x, eye.z) + 0.005 &&
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
      lease = await loader.acquire('iceMinis');
    } catch {
      return false;
    }
    if (
      this.disposed ||
      Object.values(ICE_MINI_NODES).some(
        (n) => !(lease.model.getObjectByName(n) instanceof THREE.Mesh),
      )
    ) {
      lease.release();
      loader.evictUnused('iceMinis');
      return false;
    }
    this.lease = lease;
    this.loader = loader;
    this.occlusion.warmUp();
    for (const a of this.animals) {
      const mesh = lease.model.getObjectByName(
        ICE_MINI_NODES[a.kind],
      ) as THREE.Mesh;
      mesh.removeFromParent();
      mesh.position.set(0, 0, 0);
      mesh.quaternion.identity();
      mesh.scale.setScalar(1);
      const own = (m: THREE.Material) => {
        const c = m.clone();
        if (a.kind === 'angel') c.depthWrite = false;
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
    for (const a of this.animals) {
      if (!a.mesh) continue;
      animateIceMini(a.mesh, t);
      const h = this.homes[a.kind];
      // Confined exploration, checked against a padded home footprint at placement time.
      const dx =
        a.kind === 'angel'
          ? 0.025 * Math.sin(t * 0.14)
          : 0.008 * (1 - Math.cos(t * 0.06));
      const dz =
        a.kind === 'angel'
          ? 0.025 * Math.sin(t * 0.1)
          : 0.008 * Math.sin(t * 0.06);
      const dy = a.kind === 'angel' ? 0.025 * Math.sin(t * 0.2) : 0;
      a.root.position.set(
        h.position.x + dx,
        h.position.y + dy,
        h.position.z + dz,
      );
      a.sight.position.x = h.target.x + dx;
      a.sight.position.y = h.target.y + dy;
      a.sight.position.z = h.target.z + dz;
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
    this.loader?.evictUnused('iceMinis');
    this.lease = undefined;
  }
}
