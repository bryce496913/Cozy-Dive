import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { TANK_BABIES, babyDefinition } from '../src/config/babies';
import {
  SMALL_CREATURE_IDS,
  SMALL_CREATURES,
} from '../src/creatures/lowPoly/smallCatalog';
import {
  smallAnimalMode,
  smallAnimalSeatY,
  smallAnimalShelter,
} from '../src/creatures/babies/SmallAnimalHabitat';
import { crabBody } from '../src/environment/cave/CaveCrabs';
import { spinyLobsterBody } from '../src/environment/cave/SpinyLobster';
import { spanishShawlGeometry } from '../src/environment/kelp/SpanishShawl';
import { seaStarShape, urchinShape } from '../src/environment/kelp/KelpShapes';

const triangles = (g: THREE.BufferGeometry) =>
  (g.index ? g.index.count : g.getAttribute('position').count) / 3;

describe('Pass 020 small-creature migration', () => {
  it('has one semantic owner and aquarium definition for every assigned identity', () => {
    expect(SMALL_CREATURE_IDS).toHaveLength(34);
    expect(new Set(SMALL_CREATURE_IDS).size).toBe(SMALL_CREATURE_IDS.length);
    for (const id of SMALL_CREATURE_IDS) {
      const record = SMALL_CREATURES[id];
      expect(record?.source, id).toBeTruthy();
      expect(record?.habitat.length, id).toBeGreaterThan(0);
      expect(
        TANK_BABIES.filter((d) => d.id === id),
        id,
      ).toHaveLength(1);
    }
  });

  it('uses explicit biological contact rather than name-pattern guesses', () => {
    expect(smallAnimalMode(babyDefinition('sea-angel'))).toBe('pelagic');
    expect(smallAnimalMode(babyDefinition('mysid'))).toBe('hover');
    expect(smallAnimalMode(babyDefinition('antarctic-sea-star'))).toBe(
      'bottom',
    );
    expect(smallAnimalShelter(babyDefinition('decorator-crab'))).toBe(true);
    expect(smallAnimalShelter(babyDefinition('antarctic-sea-urchin'))).toBe(
      false,
    );
  });

  it('seats asymmetric bottom geometry exactly on its navigation envelope', () => {
    const d = babyDefinition('spiny-lobster'),
      scale = 1.7,
      min = -0.08,
      y = smallAnimalSeatY(d, min, scale)!;
    expect((min + y) * scale).toBeCloseTo(-d.halfHeight, 10);
    expect(
      smallAnimalSeatY(babyDefinition('sea-angel'), min, scale),
    ).toBeUndefined();
    expect(smallAnimalSeatY(d, min, 0)).toBeUndefined();
  });

  it.each([
    ['rock crab', crabBody, 4500],
    ['spiny lobster', spinyLobsterBody, 22000],
    ['purple urchin', urchinShape, 3500],
    ['sea star', seaStarShape, 6000],
    ['Spanish shawl', spanishShawlGeometry, 9000],
  ] as const)(
    '%s stays a single finite palette mesh within its close-view budget',
    (_name, build, budget) => {
      const g = build(),
        p = g.getAttribute('position');
      expect(g.index).toBeNull();
      expect(g.getAttribute('normal').count).toBe(p.count);
      expect(g.getAttribute('color').count).toBe(p.count);
      expect([...p.array].every(Number.isFinite)).toBe(true);
      expect(triangles(g)).toBeLessThan(budget);
      g.dispose();
    },
  );
});
