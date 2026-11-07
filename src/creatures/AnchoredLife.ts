import { HiddenLife } from './discoveries/HiddenLife';
import type { DiscoverySurfaceGroup } from './discoveries/DiscoveryHabitat';
import * as THREE from 'three';
import { Anemone } from './Anemone';
import { Moray } from './Moray';
import type { FishHabitat } from '../fish/FishHabitat';
import type { ConvexCollider } from '../player/collision';
import type { PlantPlacement } from '../environment/HabitatRegions';
import type { OrnamentAnchor } from '../environment/ornaments/OrnamentSystem';
import type { PlayerPresence } from '../fish/FishDiverReaction';
/** Environment lifecycle bridge; individual creatures keep their own behavior/rendering ownership. */
export class AnchoredLife {
  readonly root = new THREE.Group();
  readonly anemone: Anemone;
  readonly moray: Moray;
  readonly hidden: HiddenLife;
  private disposed = false;
  constructor(
    h: FishHabitat,
    supports: readonly ConvexCollider[],
    plants: readonly PlantPlacement[],
    anchors: readonly OrnamentAnchor[],
    surfaces: readonly DiscoverySurfaceGroup[],
  ) {
    this.root.name = 'Anchored marine life';
    this.anemone = new Anemone(h, supports, plants);
    try {
      this.moray = new Moray(h, anchors);
    } catch (error) {
      this.anemone.dispose();
      throw error;
    }
    try {
      this.hidden = new HiddenLife(h, plants, surfaces);
    } catch (error) {
      this.anemone.dispose();
      this.moray.dispose();
      throw error;
    }
    this.root.add(this.anemone.root, this.moray.root, this.hidden.root);
  }
  update(
    dt: number,
    active: boolean,
    reduced: boolean,
    player?: PlayerPresence,
  ): void {
    if (this.disposed) return;
    this.hidden.update(dt, active, reduced, player);
    this.anemone.update(dt, active, reduced);
    this.moray.update(dt, active, reduced, player);
  }
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.root.removeFromParent();
    this.hidden.dispose();
    this.anemone.dispose();
    this.moray.dispose();
    this.root.clear();
  }
}
