import * as THREE from 'three';
import type { AssetLoader } from '../assets/AssetLoader';
import type { TankCreatureId } from '../config/babies';
import { babyDefinition } from '../config/babies';
import type { Vec3 } from '../config/world';
import { TankBaby } from '../creatures/babies/TankBaby';
import type {
  BabyNeighbour,
  BabyHabitat,
} from '../creatures/babies/BabyNavigation';
import type { FishHabitat } from '../fish/FishHabitat';
import type { PlayerPresence } from '../fish/FishDiverReaction';
import { acquireCollectionArt, type CollectionArt } from './TankCollectionArt';
interface Rig {
  readonly baby: TankBaby;
  readonly art: CollectionArt;
  readonly root: THREE.Group;
  isNear: boolean;
}
/** Lazy environment owner. Only hierarchy, opacity material and simulation belong to each baby. */
export class TankBabies {
  readonly root = new THREE.Group();
  readonly animals: TankBaby[] = [];
  ready: Promise<void> = Promise.resolve();
  private readonly rigs: Rig[] = [];
  private readonly desired = new Set<TankCreatureId>();
  private readonly pending = new Set<TankCreatureId>();
  private readonly eye = new THREE.Vector3();
  private readonly spawn: Vec3 = { x: 0, y: 4.6, z: 9 };
  private disposed = false;
  private readonly failed = new Set<TankCreatureId>();
  constructor(
    private readonly loader: Pick<AssetLoader, 'acquire' | 'evictUnused'>,
    private readonly habitat: BabyHabitat & { refresh?: () => void },
    private readonly fish: FishHabitat,
    private readonly onError: (message: string) => void = () => {},
    private readonly occupants: readonly BabyNeighbour[] = [],
  ) {
    this.root.name = 'Little tank visitors';
    fish.residents = this.animals;
  }
  get empty(): boolean {
    return !this.desired.size && !this.pending.size && !this.rigs.length;
  }
  set(ids: readonly TankCreatureId[], eye: Readonly<Vec3>) {
    if (this.disposed) return;
    this.spawn.x = eye.x;
    this.spawn.y = eye.y;
    this.spawn.z = eye.z;
    this.desired.clear();
    ids.forEach((id) => this.desired.add(id));
    for (const r of this.rigs)
      r.baby.returning = !this.desired.has(r.baby.definition.id);
    const tasks: Promise<void>[] = [];
    for (const id of this.desired)
      if (
        !this.pending.has(id) &&
        !this.rigs.some((r) => r.baby.definition.id === id)
      ) {
        this.failed.delete(id);
        this.pending.add(id);
        tasks.push(this.load(id));
      }
    this.ready = Promise.all([this.ready, ...tasks]).then(() => {});
  }
  private async load(id: TankCreatureId) {
    const d = babyDefinition(id);
    let art: CollectionArt | undefined;
    try {
      art = await acquireCollectionArt(d, this.loader);
      if (this.disposed || !this.desired.has(id)) {
        art.dispose();
        return;
      }
      const baby = new TankBaby(d, this.habitat, this.spawn, [
          ...this.occupants,
          ...this.animals,
        ]),
        root = new THREE.Group();
      root.name = d.label;
      root.scale.setScalar(d.scale);
      root.rotation.order = 'YZX';
      root.add(art.model);
      this.root.add(root);
      art.far.visible = false;
      this.animals.push(baby);
      this.rigs.push({ baby, art, root, isNear: true });
      root.position.set(baby.position.x, baby.position.y, baby.position.z);
    } catch {
      art?.dispose();
      if (!this.disposed && this.desired.has(id)) {
        this.failed.add(id);
        this.onError(
          'A little visitor could not arrive. You can try again from the catalog.',
        );
      }
    } finally {
      this.pending.delete(id);
    }
  }
  /** Edits happen outside the simulation loop; the existing actor position is retained. */
  replan() {
    this.habitat.refresh?.();
    for (const baby of this.animals) baby.replan();
  }
  intersects(c: import('../player/collision').ConvexCollider): boolean {
    for (const b of this.animals) {
      const p = b.position,
        h = b.radius,
        v = b.halfHeight;
      if (
        p.x + h >= c.min.x &&
        p.x - h <= c.max.x &&
        p.y + v >= c.min.y &&
        p.y - v <= c.max.y &&
        p.z + h >= c.min.z &&
        p.z - h <= c.max.z
      )
        return true;
    }
    return false;
  }
  update(
    dt: number,
    active: boolean,
    reduced: boolean,
    player: PlayerPresence | undefined,
    camera: THREE.Camera,
  ) {
    if (this.disposed) return;
    camera.getWorldPosition(this.eye);
    if (player?.active) {
      this.spawn.x = player.position.x;
      this.spawn.y = player.position.y;
      this.spawn.z = player.position.z;
    }
    for (let i = this.rigs.length - 1; i >= 0; i--) {
      const r = this.rigs[i],
        b = r.baby;
      b.update(dt, active, reduced, player, this.animals);
      if (b.finished) {
        this.release(i);
        continue;
      }
      const p = b.position,
        distance = Math.hypot(
          p.x - this.eye.x,
          p.y - this.eye.y,
          p.z - this.eye.z,
        );
      r.isNear = distance < (r.isNear ? 4.4 : 4);
      r.art.near.visible = r.isNear;
      r.art.far.visible = !r.isNear;
      r.root.position.set(p.x, p.y, p.z);
      r.root.rotation.set(0, b.yaw, 0);
      r.art.update(b.opacity, b.effort, reduced ? 0 : b.time);
    }
  }
  get nearCount(): number {
    let n = 0;
    for (const r of this.rigs) if (r.isNear) n++;
    return n;
  }
  private release(index: number) {
    const r = this.rigs[index];
    r.root.removeFromParent();
    r.root.clear();
    r.art.dispose();
    this.animals.splice(this.animals.indexOf(r.baby), 1);
    this.rigs.splice(index, 1);
  }
  /** Reset is immediate even while paused; ordinary returns fade on the simulation clock. */
  clear() {
    this.desired.clear();
    for (let i = this.rigs.length - 1; i >= 0; i--) this.release(i);
  }
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.clear();
    if (this.fish.residents === this.animals) this.fish.residents = undefined;
    this.root.removeFromParent();
    this.root.clear();
  }
}
