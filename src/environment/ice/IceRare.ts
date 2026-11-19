import { squidGeometry } from './SquidGeometry';
import * as THREE from 'three';
import type { AssetId } from '../../assets/AssetRegistry';
import type { AssetLoader } from '../../assets/AssetLoader';
import type { IceLimits } from '../../creatures/iceLife';
import { RARE_IDS, RareDirector, type RareId } from '../../creatures/iceRare';
import type { SightCandidate } from '../../discovery/journal';
import { ICE_SIGHTS } from '../../discovery/sights';
import type { PlayerPresence } from '../../fish/FishDiverReaction';
import { createPose, PosedFish } from '../outer/PosedFish';
import { SoloCreature } from '../outer/SoloCreature';

/**
 * v0.6 Pass 048: the rare encounters under the ice, drawn: each animal's authored model (leased
 * from the fish loader, shown only while its encounter runs), the toothfish on the fish rig, and the
 * colossal squid's eyes built in code (two great glowing eyes that shine through the murk, and the
 * faint shape of its mantle). Moved by `RareDirector`. Owns everything it creates.
 */
const LOOK: Record<
  Exclude<RareId, 'toothfish' | 'colossal-squid'>,
  { asset: AssetId; scale: number; name: string }
> = {
  'leopard-seal': { asset: 'leopardSeal', scale: 1, name: 'Leopard seal' },
  'minke-whale': { asset: 'minkeWhale', scale: 2.5, name: 'Minke whale' },
  'killer-whales': { asset: 'killerWhale', scale: 2.3, name: 'Killer whale' },
  'polar-bear': { asset: 'polarBear', scale: 1, name: 'Polar bear' },
};
/** How far (beyond its size) each can be seen from (m): the big ones and the squid from afar. */
const SEEN: Record<RareId, number> = {
  'leopard-seal': 2.5,
  'minke-whale': 6,
  'killer-whales': 5,
  toothfish: 2,
  'colossal-squid': 22,
  'polar-bear': 2,
};
const SIGHT: Record<RareId, { readonly id: string; readonly label: string }> = {
  'leopard-seal': ICE_SIGHTS.leopardSeal,
  'minke-whale': ICE_SIGHTS.minke,
  'killer-whales': ICE_SIGHTS.orca,
  toothfish: ICE_SIGHTS.toothfish,
  'colossal-squid': ICE_SIGHTS.squid,
  'polar-bear': ICE_SIGHTS.polarBear,
};

export class IceRare {
  readonly root = new THREE.Group();
  readonly director: RareDirector;
  readonly ready: Promise<boolean>;
  /** Sighting candidates, by encounter (only while it is under way do they count). */
  private readonly candidates = new Map<RareId, SightCandidate[]>();
  private readonly bodies = new Map<RareId, SoloCreature[]>();
  private readonly pending = new Set<SoloCreature>();
  private toothfish?: PosedFish;
  private readonly squid = new THREE.Group();
  private readonly squidBody: THREE.Mesh;
  private squidTime = 0;
  private readonly eyeMaterial: THREE.MeshBasicMaterial;
  private readonly mantleMaterial: THREE.MeshBasicMaterial;
  private readonly geometries: THREE.BufferGeometry[] = [];
  private disposed = false;

  constructor(
    private readonly loader: AssetLoader,
    limits: IceLimits,
    /** The world's sighting list (the encounter under way is kept in it). */
    private readonly sightings: SightCandidate[],
  ) {
    this.root.name = 'Under-ice rare encounters';
    this.director = new RareDirector(createPose, limits);
    // The squid: two great eyes (each a quarter-metre across) and the dim shape of its mantle.
    this.eyeMaterial = new THREE.MeshBasicMaterial({
      name: 'Squid eyes',
      color: 0xfff2c0,
      transparent: true,
      opacity: 0,
      fog: false,
      depthWrite: false,
    });
    this.mantleMaterial = new THREE.MeshBasicMaterial({
      name: 'Squid mantle',
      color: 0x13202a,
      transparent: true,
      opacity: 0,
    });
    const eye = new THREE.SphereGeometry(0.13, 14, 10),
      mantle = squidGeometry();
    this.geometries.push(eye, mantle);
    for (const s of [-1, 1]) {
      const m = new THREE.Mesh(eye, this.eyeMaterial);
      m.position.set(s * 0.45, 0.05, 0);
      this.squid.add(m);
    }
    const body = new THREE.Mesh(mantle, this.mantleMaterial);
    this.squidBody = body;
    this.squid.add(body);
    this.squid.name = 'Colossal squid';
    this.squid.visible = false;
    this.root.add(this.squid);
    for (const id of RARE_IDS)
      this.candidates.set(
        id,
        this.director.encounters[id].poses.map((p) => ({
          ...SIGHT[id],
          position: p.position,
          radius: SEEN[id],
        })),
      );
    this.ready = this.load();
  }
  private shown?: RareId;
  /**
   * Keep the world's sighting list holding only the encounter under way (so an animal counts as
   * seen only while it is really there): its candidates go in when it starts and out when it ends.
   */
  private syncSightings(list: SightCandidate[]): void {
    const now = this.director.current?.id;
    if (now === this.shown) return;
    for (const c of this.shown ? (this.candidates.get(this.shown) ?? []) : []) {
      const i = list.indexOf(c);
      if (i >= 0) list.splice(i, 1);
    }
    if (now) list.push(...(this.candidates.get(now) ?? []));
    this.shown = now;
  }
  private async solo(id: RareId, i: number): Promise<void> {
    const look = LOOK[id as keyof typeof LOOK],
      pose = this.director.encounters[id].poses[i],
      body = new SoloCreature(
        this.loader,
        look.asset,
        pose,
        look.scale,
        `${look.name} ${i + 1}`,
        28,
      );
    this.pending.add(body);
    const ok = await body.ready;
    this.pending.delete(body);
    if (!ok || this.disposed) {
      body.dispose();
      throw Error(`${look.asset} could not be loaded`);
    }
    body.root.visible = false;
    this.root.add(body.root);
    const list = this.bodies.get(id) ?? [];
    list.push(body);
    this.bodies.set(id, list);
  }
  private async part(
    build: () => Promise<void>,
    what: string,
  ): Promise<boolean> {
    try {
      await build();
      return !this.disposed;
    } catch (error) {
      if (!this.disposed)
        console.error(`Cozy Diver: the ${what} could not be loaded.`, error);
      return false;
    }
  }
  private async load(): Promise<boolean> {
    const results = await Promise.all([
      ...(Object.keys(LOOK) as (keyof typeof LOOK)[]).map((id) =>
        this.part(async () => {
          await Promise.all(
            this.director.encounters[id].poses.map((_, i) => this.solo(id, i)),
          );
        }, LOOK[id].name),
      ),
      this.part(async () => {
        const lease = await this.loader.acquire('toothfish');
        if (this.disposed) {
          lease.release();
          throw Error('toothfish');
        }
        this.toothfish = new PosedFish(
          [lease],
          [...this.director.encounters.toothfish.poses],
          'Antarctic toothfish',
          1.7,
          8,
        );
        this.toothfish.visible = false;
        this.root.add(this.toothfish.root);
      }, 'toothfish'),
    ]);
    if (this.disposed) return false;
    // Shown (out of sight above the ice) until the first update, so the warm-up compiles them.
    for (const list of this.bodies.values())
      for (const b of list) b.root.visible = true;
    if (this.toothfish) this.toothfish.visible = true;
    this.squid.visible = true;
    return results.some(Boolean);
  }
  /** The swimmer has come under the ice: the rare ones start over. */
  arrive(): void {
    this.director.arrive();
    this.syncSightings(this.sightings);
  }
  update(
    dt: number,
    active: boolean,
    reducedMotion: boolean,
    player: PlayerPresence,
    camera: THREE.Camera,
  ): void {
    if (this.disposed) return;
    if (active && dt > 0) this.director.update(dt, player, reducedMotion);
    this.syncSightings(this.sightings);
    const now = this.director.current?.id;
    for (const [id, list] of this.bodies)
      for (const b of list) {
        b.root.visible = now === id;
        if (now === id) b.update(camera);
      }
    if (this.toothfish) {
      this.toothfish.visible = now === 'toothfish';
      if (now === 'toothfish') this.toothfish.update(camera);
    }
    const glow = this.director.squid.glow,
      p = this.director.squid.poses[0];
    this.squid.visible = now === 'colossal-squid';
    this.squid.position.set(p.position.x, p.position.y, p.position.z);
    this.squid.rotation.y = p.yaw + Math.PI / 2;
    this.eyeMaterial.opacity = glow;
    this.mantleMaterial.opacity = 0.55 * glow;
    if (active && !reducedMotion) this.squidTime += Math.min(dt, 0.1);
    const stroke = Math.sin(this.squidTime * 0.8);
    if (this.squidBody.morphTargetInfluences) {
      this.squidBody.morphTargetInfluences[0] = Math.max(0, -stroke);
      this.squidBody.morphTargetInfluences[1] = Math.max(0, stroke);
    }
  }
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.director.arrive();
    this.syncSightings(this.sightings);
    this.root.removeFromParent();
    this.pending.forEach((b) => b.dispose());
    this.pending.clear();
    for (const list of this.bodies.values()) list.forEach((b) => b.dispose());
    this.toothfish?.dispose();
    // v0.6 Pass 059: the toothfish is found only here; let its model go with the world.
    this.loader.evictUnused('toothfish');
    this.geometries.forEach((g) => g.dispose());
    this.eyeMaterial.dispose();
    this.mantleMaterial.dispose();
    this.root.clear();
  }
}
