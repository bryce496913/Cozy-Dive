import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { COLLECTION } from '../src/collection/registry';
import { TANK_BABIES } from '../src/config/babies';
import {
  RARE_CREATURES,
  RARE_CREATURE_IDS,
} from '../src/creatures/lowPoly/rareCatalog';
import { SIGHTS } from '../src/discovery/sights';
import { anchoredFishGeometry } from '../src/fish/lowPoly/anchored';
import {
  FROGFISH_GULP,
  FROGFISH_YAWN,
  frogfishGape,
  frogfishStep,
} from '../src/creatures/discoveries/Frogfish';

describe('Pass 021 rare and secret creature migration', () => {
  it('accounts for all 31 identities once with stable album and discovery contracts', () => {
    expect(RARE_CREATURES).toHaveLength(31);
    expect(new Set(RARE_CREATURE_IDS).size).toBe(31);

    const album = new Map(COLLECTION.map((entry) => [entry.id, entry]));
    const sights = new Set(SIGHTS.map(({ id }) => id));
    for (const creature of RARE_CREATURES) {
      const entry = album.get(creature.id);
      expect(entry, creature.id).toBeDefined();
      expect(entry!.section, creature.id).toBe(creature.habitat);
      if (entry!.discovery === 'sighting')
        expect(sights.has(creature.id), creature.id).toBe(true);
    }
  });

  it('keeps every eligible rare discovery attached to its canonical tank model', () => {
    const babies = new Map(TANK_BABIES.map((baby) => [baby.sighting, baby]));
    for (const creature of RARE_CREATURES) {
      const entry = COLLECTION.find(({ id }) => id === creature.id)!;
      if (entry.tank?.slot !== 'animal') continue;
      const baby = babies.get(creature.id);
      expect(baby, creature.id).toBeDefined();
      expect(baby!.id, creature.id).toBe(entry.tank.key);
      if (entry.model.type === 'asset') {
        expect(baby!.asset, creature.id).toBe(entry.model.asset);
        expect(baby!.nodes, creature.id).toEqual(entry.model.nodes);
      }
    }
  });

  it('retains a continuous tapered seahorse silhouette and distinct articulated fins', () => {
    const body = anchoredFishGeometry('HorseBody');
    const tail = anchoredFishGeometry('HorseTail');
    const dorsal = anchoredFishGeometry('HorseDorsal');
    const pectoral = anchoredFishGeometry('HorseLeftFin');
    const box = new THREE.Box3();
    body.computeBoundingBox();
    tail.computeBoundingBox();
    box.copy(body.boundingBox!);
    expect(box.max.y - box.min.y).toBeGreaterThan(0.7);
    expect(tail.boundingBox!.max.y - tail.boundingBox!.min.y).toBeGreaterThan(
      0.2,
    );
    expect(tail.getAttribute('position').count).toBeGreaterThan(60);
    expect(dorsal.getAttribute('position').count).toBeGreaterThan(3);
    expect(pectoral.getAttribute('position').count).toBeGreaterThan(3);
    for (const geometry of [body, tail, dorsal, pectoral]) geometry.dispose();
  });

  it('retains frogfish respiration, occasional yawning and rare planted steps', () => {
    const gulp = frogfishGape(FROGFISH_GULP.period / 2);
    const yawn = frogfishGape(FROGFISH_YAWN.start + FROGFISH_YAWN.open);
    expect(gulp).toBeGreaterThan(0);
    expect(yawn).toBeGreaterThan(gulp);

    const rest = { x: 0, z: 0, walking: true, stride: 1 };
    frogfishStep(40, rest);
    expect(rest.walking).toBe(false);
    const step = { ...rest };
    frogfishStep(108, step);
    expect(step.walking).toBe(true);
    expect(step.stride).toBeGreaterThan(0);
    expect(Math.hypot(step.x - rest.x, step.z - rest.z)).toBeGreaterThan(0);
  });
});
