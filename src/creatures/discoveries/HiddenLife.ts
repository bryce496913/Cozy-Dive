import * as THREE from 'three';
import type { FishHabitat } from '../../fish/FishHabitat';
import type { PlantPlacement } from '../../environment/HabitatRegions';
import type { PlayerPresence } from '../../fish/FishDiverReaction';
import { DiscoveryClock } from './DiscoveryClock';
import { Seahorse } from './Seahorse';
import { Frogfish } from './Frogfish';
import { Nudibranchs } from './Nudibranchs';
import type { DiscoveryHome, DiscoverySurfaceGroup } from './DiscoveryHabitat';
export class HiddenLife {
  readonly root = new THREE.Group();
  readonly clock = new DiscoveryClock();
  readonly seahorse: Seahorse;
  readonly frogfish: Frogfish;
  readonly nudibranchs: Nudibranchs;
  readonly homes: readonly DiscoveryHome[];
  private disposed = false;
  constructor(
    h: FishHabitat,
    plants: readonly PlantPlacement[],
    groups: readonly DiscoverySurfaceGroup[],
  ) {
    this.root.name = 'Hidden marine discoveries';
    this.seahorse = new Seahorse(h, plants);
    try {
      // Pass 019: reef rock tops first, so the frogfish blends into the limestone.
      this.frogfish = new Frogfish(h, [
        ...groups.filter((g) => g.id === 'reef'),
        ...groups.filter((g) => g.id !== 'reef'),
      ]);
    } catch (error) {
      this.seahorse.dispose();
      throw error;
    }
    try {
      this.nudibranchs = new Nudibranchs(h, groups, [
        {
          x: this.frogfish.home.position.x,
          y: this.frogfish.home.position.y,
          z: this.frogfish.home.position.z,
          clearance: 1,
        },
      ]);
    } catch (error) {
      this.seahorse.dispose();
      this.frogfish.dispose();
      throw error;
    }
    this.homes = [
      this.seahorse.home,
      this.frogfish.home,
      ...this.nudibranchs.animals.map((a) => a.home),
    ];
    this.root.add(
      this.seahorse.root,
      this.frogfish.root,
      this.nudibranchs.root,
    );
  }
  update(
    dt: number,
    active: boolean,
    reduced: boolean,
    player?: PlayerPresence,
  ): void {
    if (this.disposed || !active || !Number.isFinite(dt) || dt <= 0) return;
    const elapsed = this.clock.advance(dt, active, reduced);
    this.seahorse.respond(elapsed, player);
    this.frogfish.respond(elapsed, player);
    const time = this.clock.sample;
    this.seahorse.pose(time);
    this.frogfish.pose(time);
    this.nudibranchs.pose(time);
  }
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.root.removeFromParent();
    this.seahorse.dispose();
    this.frogfish.dispose();
    this.nudibranchs.dispose();
    this.root.clear();
  }
}
