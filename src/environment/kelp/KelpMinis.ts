import * as THREE from 'three';
import type { AssetLease, AssetLoader } from '../../assets/AssetLoader';
import type { Vec3 } from '../../config/world';
import type { SightCandidate } from '../../discovery/journal';
import { KELP_SIGHTS } from '../../discovery/sights';
import type { KelpEnvironment } from './KelpEnvironment';
import { kelpSeabed } from './KelpTerrain';
import { animateKelpMini, kelpMiniExplore } from './KelpMiniAnimation';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export const KELP_MINI_NODES = {
  seadragon: 'Weedy_Seadragon',
  shawl: 'Spanish_Shawl',
  fringehead: 'Sarcastic_Fringehead',
  octopus: 'Red_Octopus',
} as const;
export type KelpMiniKind = keyof typeof KELP_MINI_NODES;
export const KELP_MINI_SIGHTS = {
  seadragon: KELP_SIGHTS.seadragon,
  shawl: KELP_SIGHTS.nudibranch,
  fringehead: KELP_SIGHTS.fringehead,
  octopus: KELP_SIGHTS.redOctopus,
} as const;
export const KELP_MINI_TUNING = {
  reach: 2.2,
  cone: 0.4,
  spacing: 5,
  vegetation: 0.85,
} as const;
export interface KelpMiniHome {
  readonly kind: KelpMiniKind;
  readonly position: Vec3;
  readonly normal: Vec3;
  readonly view: Vec3;
  readonly boulder: number;
}
interface Stalk {
  readonly x: number;
  readonly z: number;
}

/** Static dressing envelopes include urchin spines, anemones, stars and cobbles. Built once. */
export function kelpMiniObstacles(root: THREE.Object3D): THREE.Box3[] {
  const boxes: THREE.Box3[] = [],
    matrix = new THREE.Matrix4(),
    world = new THREE.Matrix4();
  root.updateMatrixWorld(true);
  root.traverse((o) => {
    if (!(o instanceof THREE.Mesh)) return;
    o.geometry.computeBoundingBox();
    const box = o.geometry.boundingBox!;
    if (o instanceof THREE.InstancedMesh) {
      for (let i = 0; i < o.count; i++) {
        o.getMatrixAt(i, matrix);
        world.multiplyMatrices(o.matrixWorld, matrix);
        boxes.push(box.clone().applyMatrix4(world).expandByScalar(0.04));
      }
    } else
      boxes.push(box.clone().applyMatrix4(o.matrixWorld).expandByScalar(0.04));
  });
  return boxes;
}

/** Homes are selected on the actual drawn rock/sand, with a clear near viewing corridor. */
export function kelpMiniHomes(
  environment: Pick<KelpEnvironment, 'root' | 'boulders'>,
  stalks: readonly Stalk[],
  obstacles: readonly THREE.Box3[] = [],
): Readonly<Record<KelpMiniKind, KelpMiniHome>> {
  environment.root.updateMatrixWorld(true);
  const ray = new THREE.Raycaster(),
    origin = new THREE.Vector3(),
    direction = new THREE.Vector3();
  const hits: THREE.Intersection[] = [];
  const cast = (a: Vec3, b: Vec3) => {
    origin.set(a.x, a.y, a.z);
    direction.set(b.x - a.x, b.y - a.y, b.z - a.z);
    ray.far = direction.length();
    direction.normalize();
    ray.set(origin, direction);
    hits.length = 0;
    ray.intersectObject(environment.root, true, hits);
    return hits[0];
  };
  const screened = (p: Vec3, margin: number = KELP_MINI_TUNING.vegetation) =>
    stalks.some((s) => Math.hypot(s.x - p.x, s.z - p.z) < margin);
  const taken: Vec3[] = [];
  const envelope = new THREE.Box3(),
    centre = new THREE.Vector3(),
    extent = new THREE.Vector3(0.42, 0.36, 0.42);
  const anchors: Record<KelpMiniKind, { x: number; z: number }> = {
    seadragon: { x: -9, z: -24 },
    shawl: { x: 10, z: -29 },
    fringehead: { x: 13, z: -43 },
    octopus: { x: -14, z: -39 },
  };
  const homes = {} as Record<KelpMiniKind, KelpMiniHome>;
  for (const kind of Object.keys(KELP_MINI_NODES) as KelpMiniKind[]) {
    const anchor = anchors[kind];
    const order = environment.boulders
      .map((b, index) => ({ b, index }))
      .filter(
        ({ b }) =>
          Math.abs(b.x) < 18 &&
          b.z < -15 &&
          b.z > -52 &&
          Math.hypot(b.x + 10.4, b.z + 47.1) > 5,
      )
      .sort(
        (a, b) =>
          Math.hypot(a.b.x - anchor.x, a.b.z - anchor.z) -
          Math.hypot(b.b.x - anchor.x, b.b.z - anchor.z),
      );
    let chosen: KelpMiniHome | undefined;
    for (const { b, index } of order) {
      for (let n = 0; n < 16 && !chosen; n++) {
        const angle = (n * Math.PI) / 8,
          nx = Math.sin(angle),
          nz = Math.cos(angle);
        let p: Vec3,
          normal: Vec3 = { x: 0, y: 1, z: 0 };
        if (kind === 'shawl') {
          const target = { x: b.x, y: b.y + b.height * 0.35, z: b.z };
          const hit = cast(
            {
              x: b.x + nx * (b.size + 2),
              y: b.y + b.height + 1,
              z: b.z + nz * (b.size + 2),
            },
            target,
          );
          if (!hit?.face) continue;
          const norm = hit.face.normal
            .clone()
            .transformDirection(hit.object.matrixWorld);
          if (norm.y < 0.25) continue;
          normal = { x: norm.x, y: norm.y, z: norm.z };
          p = {
            x: hit.point.x + norm.x * 0.008,
            y: hit.point.y + norm.y * 0.008,
            z: hit.point.z + norm.z * 0.008,
          };
        } else {
          const r = b.size * 0.65 + 0.45;
          p = { x: b.x + nx * r, y: 0, z: b.z + nz * r };
          const hit = cast(
            { x: p.x, y: b.y + b.height + 3, z: p.z },
            { x: p.x, y: -3, z: p.z },
          );
          if (!hit) continue;
          p.y = hit.point.y + 0.008;
          // Ground animals stay on sand, in shelter beside the existing formation.
          if (Math.abs(p.y - kelpSeabed(p.x, p.z)) > 0.25) continue;
          if (hit.face) {
            const n = hit.face.normal
              .clone()
              .transformDirection(hit.object.matrixWorld);
            normal = { x: n.x, y: n.y, z: n.z };
          }
          if (kind === 'seadragon') {
            p.y += 1.3;
            normal = { x: 0, y: 1, z: 0 };
          }
          if (
            environment.boulders.some(
              (o) => Math.hypot(o.x - p.x, o.z - p.z) < o.size * 0.5 + 0.24,
            )
          )
            continue;
        }
        centre.set(p.x, p.y + 0.09, p.z);
        envelope.setFromCenterAndSize(centre, extent);
        if (
          obstacles.some((box) => box.intersectsBox(envelope)) ||
          screened(p) ||
          taken.some(
            (q) => Math.hypot(q.x - p.x, q.z - p.z) < KELP_MINI_TUNING.spacing,
          )
        )
          continue;
        for (const turn of [0, 0.8, -0.8, 1.6, -1.6, Math.PI]) {
          const view = {
            x: p.x + Math.sin(angle + turn) * 1.1,
            y: p.y + 0.65,
            z: p.z + Math.cos(angle + turn) * 1.1,
          };
          if (screened(view, 0.45)) continue;
          let clear = true;
          for (let j = 1; j <= 5; j++) {
            const u = j / 5,
              q = {
                x: p.x + (view.x - p.x) * u,
                y: p.y + (view.y - p.y) * u,
                z: p.z + (view.z - p.z) * u,
              };
            if (screened(q, 0.5)) {
              clear = false;
              break;
            }
          }
          if (!clear) continue;
          const end = {
            x: p.x + normal.x * 0.07,
            y: p.y + normal.y * 0.07,
            z: p.z + normal.z * 0.07,
          };
          const hit = cast(view, end);
          if (
            hit &&
            hit.distance <
              Math.hypot(view.x - end.x, view.y - end.y, view.z - end.z) - 0.03
          )
            continue;
          chosen = { kind, position: p, normal, view, boulder: index };
          break;
        }
      }
      if (chosen) break;
    }
    if (!chosen) throw Error(`No clear kelp microhabitat for ${kind}`);
    homes[kind] = chosen;
    taken.push(chosen.position);
  }
  return homes;
}
interface Animal {
  kind: KelpMiniKind;
  root: THREE.Group;
  mesh?: THREE.Mesh;
  sight: SightCandidate & { position: Vec3 };
}
/** One canonical library; no fallback duplicates or discoverable placeholders. */
export class KelpMinis {
  readonly root = new THREE.Group();
  readonly sightings: SightCandidate[] = [];
  readonly homes: Readonly<Record<KelpMiniKind, KelpMiniHome>>;
  private animals: Animal[] = [];
  private lease?: AssetLease;
  private loader?: Pick<AssetLoader, 'evictUnused'>;
  private materials: THREE.Material[] = [];
  private pending?: Promise<boolean>;
  private hydroidGeometry?: THREE.BufferGeometry;
  private disposed = false;
  private time = 0;
  private readonly ray = new THREE.Raycaster();
  private readonly origin = new THREE.Vector3();
  private readonly direction = new THREE.Vector3();
  private readonly hits: THREE.Intersection[] = [];
  constructor(
    private readonly environment: Pick<KelpEnvironment, 'root' | 'boulders'>,
    stalks: readonly Stalk[],
    private readonly dressing?: THREE.Object3D,
  ) {
    this.root.name = 'Kelp rare miniatures';
    this.homes = kelpMiniHomes(
      environment,
      stalks,
      dressing ? kelpMiniObstacles(dressing) : [],
    );
    for (const kind of Object.keys(KELP_MINI_NODES) as KelpMiniKind[]) {
      const h = this.homes[kind],
        root = new THREE.Group();
      root.name = KELP_MINI_NODES[kind];
      root.position.set(h.position.x, h.position.y, h.position.z);
      if (kind !== 'seadragon')
        root.quaternion.setFromUnitVectors(
          new THREE.Vector3(0, 1, 0),
          new THREE.Vector3(h.normal.x, h.normal.y, h.normal.z),
        );
      const sight: Animal['sight'] = {
        ...KELP_MINI_SIGHTS[kind],
        position: {
          x: h.position.x + h.normal.x * 0.04,
          y: h.position.y + h.normal.y * 0.04,
          z: h.position.z + h.normal.z * 0.04,
        },
        radius: 0.08,
        reach: KELP_MINI_TUNING.reach,
        cone: KELP_MINI_TUNING.cone,
        visibleFrom: (eye) => this.visible(eye, sight.position),
      };
      this.animals.push({ kind, root, sight });
      this.root.add(root);
      root.visible = false;
    }
  }
  private visible(eye: Readonly<Vec3>, at: Readonly<Vec3>): boolean {
    this.origin.set(eye.x, eye.y, eye.z);
    this.direction.set(at.x - eye.x, at.y - eye.y, at.z - eye.z);
    this.ray.far = Math.max(0, this.direction.length() - 0.035);
    this.direction.normalize();
    this.ray.set(this.origin, this.direction);
    this.hits.length = 0;
    this.ray.intersectObject(this.environment.root, true, this.hits);
    if (this.hits.length) return false;
    if (this.dressing) this.ray.intersectObject(this.dressing, true, this.hits);
    return this.hits.length === 0;
  }
  load(loader: Pick<AssetLoader, 'acquire' | 'evictUnused'>): Promise<boolean> {
    return (this.pending ??= this.loadModels(loader));
  }
  private async loadModels(
    loader: Pick<AssetLoader, 'acquire' | 'evictUnused'>,
  ): Promise<boolean> {
    let lease: AssetLease;
    try {
      lease = await loader.acquire('kelpMinis');
    } catch {
      return false;
    }
    if (
      this.disposed ||
      Object.values(KELP_MINI_NODES).some(
        (n) => !(lease.model.getObjectByName(n) instanceof THREE.Mesh),
      )
    ) {
      lease.release();
      loader.evictUnused('kelpMinis');
      return false;
    }
    this.lease = lease;
    this.loader = loader;
    for (const a of this.animals) {
      const mesh = lease.model.getObjectByName(
        KELP_MINI_NODES[a.kind],
      ) as THREE.Mesh;
      mesh.removeFromParent();
      mesh.position.set(0, 0, 0);
      mesh.quaternion.identity();
      mesh.scale.setScalar(1);
      const clone = (m: THREE.Material) => {
        const c = m.clone();
        this.materials.push(c);
        return c;
      };
      mesh.material = Array.isArray(mesh.material)
        ? mesh.material.map(clone)
        : clone(mesh.material);
      a.root.add(mesh);
      a.mesh = mesh;
      a.root.visible = true;
      this.sightings.push(a.sight);
    }
    // A tiny hydroid patch beside the reused shawl home makes its feeding substrate legible.
    const parts: THREE.BufferGeometry[] = [];
    for (let i = 0; i < 9; i++) {
      const x = 0.035 + (i % 3) * 0.009,
        z = -0.035 + Math.floor(i / 3) * 0.018,
        h = 0.018 + (i % 4) * 0.004;
      const stem = new THREE.CylinderGeometry(0.0008, 0.001, h, 5);
      stem.translate(x, h / 2, z);
      parts.push(stem);
      for (let j = 0; j < 5; j++) {
        const a = (j * Math.PI * 2) / 5,
          g = new THREE.SphereGeometry(0.0018, 5, 4);
        g.translate(x + Math.cos(a) * 0.003, h + Math.sin(a) * 0.003, z);
        parts.push(g);
      }
    }
    this.hydroidGeometry = mergeGeometries(parts, false) ?? undefined;
    parts.forEach((g) => g.dispose());
    if (this.hydroidGeometry) {
      const m = new THREE.MeshStandardMaterial({
        color: 0xb58c59,
        roughness: 0.85,
      });
      this.materials.push(m);
      const patch = new THREE.Mesh(this.hydroidGeometry, m),
        shawl = this.animals.find((a) => a.kind === 'shawl')!;
      patch.name = 'Spanish shawl hydroid feeding patch';
      patch.position.copy(shawl.root.position);
      patch.quaternion.copy(shawl.root.quaternion);
      this.root.add(patch);
    }
    this.update(0, false, false);
    return true;
  }
  update(dt: number, active: boolean, reduced: boolean): void {
    if (this.disposed) return;
    if (active && !reduced) this.time += Math.min(Math.max(dt, 0), 0.1);
    const t = reduced ? 0 : this.time;
    for (const a of this.animals) {
      if (!a.mesh) continue;
      animateKelpMini(a.mesh, t);
      const h = this.homes[a.kind];
      if (a.kind === 'seadragon')
        a.root.position.set(
          h.position.x + 0.04 * Math.sin(t * 0.2),
          h.position.y + 0.025 * Math.sin(t * 0.37),
          h.position.z + 0.025 * Math.sin(t * 0.17),
        );
      if (a.kind === 'octopus')
        a.root.position.set(
          h.position.x + 0.025 * kelpMiniExplore(t),
          h.position.y,
          h.position.z + 0.015 * kelpMiniExplore(t),
        );
      if (a.kind === 'shawl')
        a.root.position.set(
          h.position.x + 0.004 * Math.sin(t * 0.08),
          h.position.y,
          h.position.z,
        );
      a.sight.position.x = a.root.position.x + h.normal.x * 0.04;
      a.sight.position.y = a.root.position.y + h.normal.y * 0.04;
      a.sight.position.z = a.root.position.z + h.normal.z * 0.04;
    }
  }
  positionOf(kind: KelpMiniKind): Readonly<Vec3> {
    return this.animals.find((a) => a.kind === kind)!.root.position;
  }
  get loaded(): boolean {
    return !!this.lease;
  }
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.sightings.length = 0;
    this.root.removeFromParent();
    this.root.clear();
    this.materials.forEach((m) => m.dispose());
    this.hydroidGeometry?.dispose();
    this.lease?.release();
    this.loader?.evictUnused('kelpMinis');
    this.lease = undefined;
  }
}
