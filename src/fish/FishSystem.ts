import type { PlayerPresence } from './FishDiverReaction';
import * as THREE from 'three';
import { angleDifference } from './FishEntity';
import { FishGeometry, type FishVisual } from './FishGeometry';
import type { FishHabitat } from './FishHabitat';
import { FishSimulation } from './FishMovement';
import { spawnFish } from './FishSpawner';
import { FISH_SPECIES, FISH_TIMING, type FishSpecies } from './FishSpecies';

const interpolate = (a: number, b: number, alpha: number): number =>
  a + (b - a) * alpha;

/** Environment-owned bridge: pure simulation + shared species resources + individual poses. */
export class FishSystem {
  readonly root = new THREE.Group();
  readonly simulation: FishSimulation;
  readonly templates: readonly FishGeometry[];
  readonly visuals: readonly FishVisual[];
  private disposed = false;
  constructor(
    habitat: FishHabitat,
    species: readonly FishSpecies[] = FISH_SPECIES,
    seed: number = FISH_TIMING.seed,
  ) {
    this.root.name = 'Freshwater fish';
    this.simulation = new FishSimulation(
      spawnFish(habitat, species, seed),
      habitat,
    );
    this.templates = species.map((s) => new FishGeometry(s));
    this.visuals = this.simulation.fish.map((fish) => {
      const template = this.templates.find((t) => t.species === fish.species)!;
      const visual = template.create(fish.size);
      visual.root.name = `${fish.species.name} ${fish.id + 1}`;
      this.root.add(visual.root);
      return visual;
    });
    this.update(0, false, false);
  }
  update(
    dt: number,
    active: boolean,
    reducedMotion: boolean,
    player?: PlayerPresence,
  ): void {
    if (this.disposed) return;
    this.simulation.advance(dt, active, player);
    const alpha = this.simulation.alpha;
    for (let i = 0; i < this.simulation.fish.length; i++) {
      const fish = this.simulation.fish[i],
        visual = this.visuals[i];
      visual.root.position.set(
        interpolate(fish.previousPosition.x, fish.position.x, alpha),
        interpolate(fish.previousPosition.y, fish.position.y, alpha),
        interpolate(fish.previousPosition.z, fish.position.z, alpha),
      );
      const yaw =
          fish.previousYaw +
          angleDifference(fish.yaw, fish.previousYaw) * alpha,
        pitch = interpolate(fish.previousPitch, fish.pitch, alpha);
      visual.root.rotation.set(
        reducedMotion ? 0 : interpolate(fish.previousBank, fish.bank, alpha),
        yaw,
        pitch +
          (reducedMotion
            ? 0
            : interpolate(
                fish.behavior.previousGesture,
                fish.behavior.gesture,
                alpha,
              )),
        'YZX',
      );
      const phase =
        fish.previousPhase +
        angleDifference(fish.phase, fish.previousPhase) * alpha;
      const ratio = Math.min(
        1.4,
        Math.hypot(fish.velocity.x, fish.velocity.y, fish.velocity.z) /
          (fish.species.speed * fish.speedFactor),
      );
      visual.rear.rotation.y =
        Math.sin(phase - 0.45) *
        0.045 *
        (0.3 + 0.7 * ratio) *
        (reducedMotion ? 0.5 : 1);
      visual.tail.rotation.y =
        Math.sin(phase) * fish.species.tailAngle * (0.25 + 0.75 * ratio);
      visual.leftPectoral.rotation.y = 0.45 + Math.sin(phase + 0.6) * 0.14;
      visual.rightPectoral.rotation.y = -0.45 - Math.sin(phase + 0.6) * 0.14;
    }
  }
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.root.removeFromParent();
    this.root.clear();
    for (const template of this.templates) template.dispose();
  }
}
