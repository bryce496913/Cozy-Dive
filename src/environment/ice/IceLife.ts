import * as THREE from 'three';
import type { AssetId } from '../../assets/AssetRegistry';
import type { AssetLease, AssetLoader } from '../../assets/AssetLoader';
import { ICE } from '../../config/passage';
import type { Vec3 } from '../../config/world';
import {
  AdelieGroup,
  EmperorDives,
  IcefishRest,
  iceLimits,
  Notothens,
  WeddellSeal,
} from '../../creatures/iceLife';
import type { SightCandidate } from '../../discovery/journal';
import { ICE_SIGHTS } from '../../discovery/sights';
import type { PlayerPresence } from '../../fish/FishDiverReaction';
import { createPose, PosedFish } from '../outer/PosedFish';
import { SoloCreature } from '../outer/SoloCreature';
import { IceCritters } from './IceCritters';

/**
 * v0.6 Pass 047: everyday life under the ice:
 *   - emperor penguins diving in through the breathing holes, trailing bubbles, and back out;
 *   - a little group of Adélie penguins zipping about just under the ice;
 *   - a Weddell seal hanging by a breathing hole, rising to breathe, and calling (its trills);
 *   - icefish resting on the seabed; bald notothens tucked under the ice;
 *   - and the small life (`IceCritters`): krill, sea butterflies, comb jellies, sea spiders, ribbon
 *     worms.
 * Each part loads on its own and is left out if it cannot; nothing is added once let go. Owns
 * everything it creates.
 */
const LENGTH = { icefish: 0.75, notothen: 0.42 } as const;
/** The Weddell seal: the harbour seal's model, larger and darker. */
const WEDDELL_LOOK = { scale: 1.75, tint: 0x6a7480 } as const;

export class IceLife {
  readonly root = new THREE.Group();
  readonly sightings: SightCandidate[] = [];
  readonly ready: Promise<boolean>;
  readonly emperors: EmperorDives;
  readonly adelies: AdelieGroup;
  readonly seal: WeddellSeal;
  readonly icefish: IcefishRest;
  readonly notothens: Notothens;
  readonly critters: IceCritters;
  private readonly bodies: SoloCreature[] = [];
  private readonly pending = new Set<SoloCreature>();
  private emperorBodies: SoloCreature[] = [];
  private icefishFish?: PosedFish;
  private notothenFish?: PosedFish;
  private readonly textures = new Map<string, THREE.Texture>();
  private disposed = false;

  constructor(
    private readonly loader: AssetLoader,
    ground: (x: number, z: number) => number,
    stones: readonly { x: number; y: number; z: number; size: number }[],
  ) {
    this.root.name = 'Under-ice life';
    const limits = iceLimits(ground);
    this.emperors = new EmperorDives(createPose, limits);
    this.adelies = new AdelieGroup(createPose, limits);
    this.seal = new WeddellSeal(createPose(), limits, 0);
    // Icefish rest near the stones on the open seabed.
    const homes: Vec3[] = stones
      .filter(
        (s) => Math.abs(s.x) < ICE.walls.x - 5 && s.z < ICE.tunnel.wallZ - 8,
      )
      .slice(0, 6)
      .map((s) => ({ x: s.x + s.size, y: s.y, z: s.z + s.size * 0.5 }));
    this.icefish = new IcefishRest(
      createPose,
      limits,
      homes.length ? homes : [{ x: -4, y: 0, z: -34 }],
    );
    this.notothens = new Notothens(createPose, limits);
    this.critters = new IceCritters(limits, stones);
    this.root.add(this.critters.root);
    this.sightings.push(...this.critters.sightings);
    this.ready = this.load();
  }
  private async solo(
    id: AssetId,
    pose: ReturnType<typeof createPose>,
    name: string,
    scale = 1,
    tint?: number,
  ): Promise<SoloCreature> {
    const body = new SoloCreature(this.loader, id, pose, scale, name, 16, tint);
    this.pending.add(body);
    const ok = await body.ready;
    this.pending.delete(body);
    if (!ok || this.disposed) {
      body.dispose();
      throw Error(`${id} could not be loaded`);
    }
    this.root.add(body.root);
    this.bodies.push(body);
    return body;
  }
  private async lease(id: AssetId, n: number): Promise<AssetLease[]> {
    const all = await Promise.allSettled(
        Array.from({ length: n }, () => this.loader.acquire(id)),
      ),
      ok = all.flatMap((r) => (r.status === 'fulfilled' ? [r.value] : []));
    if (ok.length !== n || this.disposed) {
      ok.forEach((l) => l.release());
      throw Error(`${id} could not be loaded`);
    }
    return ok;
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
      this.part(async () => {
        this.emperorBodies = await Promise.all(
          this.emperors.divers.map((d, i) =>
            this.solo(
              'emperorPenguin',
              d.swim.pose,
              `Emperor penguin ${i + 1}`,
            ),
          ),
        );
        this.emperors.divers.forEach((d) =>
          this.sightings.push({
            ...ICE_SIGHTS.emperor,
            position: d.swim.pose.position,
            radius: 1.2,
          }),
        );
      }, 'emperor penguins'),
      this.part(async () => {
        await Promise.all(
          this.adelies.swims.map((s, i) =>
            this.solo('adeliePenguin', s.pose, `Adélie penguin ${i + 1}`),
          ),
        );
        this.sightings.push({
          ...ICE_SIGHTS.adelie,
          position: this.adelies.swims[0].pose.position,
          radius: 1.5,
        });
      }, 'Adélie penguins'),
      this.part(async () => {
        await this.solo(
          'harbourSeal',
          this.seal.pose,
          'Weddell seal',
          WEDDELL_LOOK.scale,
          WEDDELL_LOOK.tint,
        );
        this.sightings.push({
          ...ICE_SIGHTS.weddell,
          position: this.seal.pose.position,
          radius: 2.5,
        });
      }, 'Weddell seal'),
      this.part(async () => {
        const poses = this.icefish.fish.map((f) => f.swim.pose);
        this.icefishFish = new PosedFish(
          await this.lease('icefish', poses.length),
          poses,
          'Icefish',
          LENGTH.icefish,
          10,
          this.textures,
        );
        this.root.add(this.icefishFish.root);
        poses.forEach(
          (p, i) =>
            i % 2 === 0 &&
            this.sightings.push({
              ...ICE_SIGHTS.icefish,
              position: p.position,
              radius: 0.8,
            }),
        );
      }, 'icefish'),
      this.part(async () => {
        const poses = this.notothens.swims.map((s) => s.pose);
        this.notothenFish = new PosedFish(
          await this.lease('notothen', poses.length),
          poses,
          'Bald notothens',
          LENGTH.notothen,
          12,
          this.textures,
        );
        this.root.add(this.notothenFish.root);
        poses.forEach(
          (p, i) =>
            i % 4 === 0 &&
            this.sightings.push({
              ...ICE_SIGHTS.notothen,
              position: p.position,
              radius: 0.6,
            }),
        );
      }, 'bald notothens'),
    ]);
    if (this.disposed) return false;
    this.place(undefined);
    // Shown until the first update (out of sight above the ice), so the warm-up compiles them.
    for (const b of this.emperorBodies) b.root.visible = true;
    return results.some(Boolean);
  }
  /** The seal called this frame: where from (for its trill), or undefined. */
  get call(): Readonly<Vec3> | undefined {
    return this.seal.called ? this.seal.pose.position : undefined;
  }
  private place(camera: THREE.Camera | undefined): void {
    this.emperorBodies.forEach((b, i) => {
      b.root.visible = this.emperors.present(i);
    });
    for (const b of this.bodies) b.update(camera);
    this.icefishFish?.update(camera);
    this.notothenFish?.update(camera);
  }
  update(
    dt: number,
    active: boolean,
    reducedMotion: boolean,
    player: PlayerPresence,
    camera: THREE.Camera,
  ): void {
    if (this.disposed) return;
    if (active && dt > 0) {
      this.emperors.update(dt, player);
      if (!reducedMotion)
        for (let i = 0; i < this.emperors.bubbleCount; i++) {
          const b = this.emperors.bubbles[i];
          this.critters.bubble(b.x, b.y, b.z);
        }
      this.adelies.update(dt, player);
      this.seal.update(dt, player);
      this.icefish.update(dt, player);
      this.notothens.update(dt, player);
    } else this.seal.called = false;
    this.critters.update(dt, active, reducedMotion, player);
    this.place(camera);
  }
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.sightings.length = 0;
    this.root.removeFromParent();
    this.pending.forEach((b) => b.dispose());
    this.pending.clear();
    this.bodies.forEach((b) => b.dispose());
    this.icefishFish?.dispose();
    this.notothenFish?.dispose();
    this.critters.dispose();
    this.root.clear();
  }
}
