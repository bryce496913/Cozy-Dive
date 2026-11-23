import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import {
  MINIATURES_BEFORE_096,
  MINIATURE_GROWTH,
  TANK_BABIES,
  isLargeMiniature,
  miniatureGrowth,
} from '../src/config/babies';
import { CRUISE_SPECIES } from '../src/config/creatures';
import { CREATURE_LOOKS, FISH_RECOLOR } from '../src/config/creatureLooks';
import { TANK_FISH } from '../src/config/tankFish';
import { TankBaby } from '../src/creatures/babies/TankBaby';
import { Aquarium } from '../src/environment/Aquarium';
import { tankContext } from '../src/catalog/TankContext';
import { TankBabyHabitat } from '../src/environment/TankBabyHabitat';
import { collectionShape } from '../src/environment/TankCollectionShapes';
import {
  ribbonWormRestGeometry,
  seaSpiderRestGeometry,
} from '../src/environment/ice/IceCritters';
import { octopusRestGeometry } from '../src/environment/shared/Octopus';
import { installAuthoredHulls } from '../validation/AuthoredCollision';
import { installReefHulls } from '../validation/ReefAsset';
import { loadTankState, TANK_KEY } from '../src/catalog/catalog';
import type { JournalStore } from '../src/discovery/journal';

/** V0.8 Pass 096: shared creature models and the doubled aquarium miniatures. */

const LARGE = [
  'blacktip-reef-shark',
  'spotted-eagle-ray',
  'green-sea-turtle',
  'leopard-shark',
  'bat-ray',
  'manta-ray',
  'whale-shark',
  'humpback-whale',
  'great-hammerhead',
  'scalloped-hammerhead',
  'whitetip-reef-shark',
  'great-white-shark',
  'ocean-sunfish',
  'sea-otter',
  'harbour-seal',
  'western-gull',
  'california-sea-lion',
  'nurse-shark',
  'swell-shark',
  'emperor-penguin',
  'adelie-penguin',
  'weddell-seal',
  'weddell-seal-pup',
  'leopard-seal',
  'minke-whale',
  'killer-whale',
  'polar-bear',
  'colossal-squid',
];

const bounds = (g: THREE.BufferGeometry) => {
  g.computeBoundingBox();
  return g.boundingBox!.getSize(new THREE.Vector3());
};

describe('V0.8 Pass 096 shared models', () => {
  it('builds the aquarium octopus, sea spider and ribbon worm from the wild animals factories', () => {
    for (const [id, wild] of [
      ['octopus', octopusRestGeometry],
      ['giant-sea-spider', seaSpiderRestGeometry],
      ['ribbon-worm', ribbonWormRestGeometry],
    ] as const) {
      const tank = collectionShape(id),
        own = wild();
      // The same geometry (the tank turns crawlers to face its way; sizes match).
      const flat = (g: THREE.BufferGeometry) =>
        g.index ? g.toNonIndexed() : g;
      expect(flat(tank).getAttribute('position').count, id).toBe(
        flat(own).getAttribute('position').count,
      );
      const a = bounds(tank),
        b = bounds(own);
      expect(Math.max(a.x, a.z), id).toBeCloseTo(Math.max(b.x, b.z), 5);
      expect(a.y, id).toBeCloseTo(b.y, 5);
      tank.dispose();
      own.dispose();
    }
  });

  it('gives every recoloured fish and tinted large animal its wild colour', () => {
    for (const f of TANK_FISH)
      expect(f.tint, f.species).toBe(FISH_RECOLOR[f.species]);
    expect(TANK_FISH.find((f) => f.species === 'cleaner-wrasse')?.asset).toBe(
      'firefish',
    );
    const baby = (id: string) => TANK_BABIES.find((b) => b.id === id)!;
    expect(baby('bat-ray').tint).toBe(CREATURE_LOOKS.batRayTint);
    expect(baby('swell-shark').tint).toBe(CREATURE_LOOKS.swellSharkTint);
    expect(baby('weddell-seal-pup').tint).toBe(CREATURE_LOOKS.weddellPup.tint);
  });

  it('places every large wild animal in the tank on its own wild model', () => {
    for (const s of Object.values(CRUISE_SPECIES))
      expect(TANK_BABIES.find((b) => b.id === s.id)?.asset, s.id).toBe(s.asset);
  });
});

describe('V0.8 Pass 096 doubled miniatures', () => {
  it('doubles exactly the large animals, relative to their previous displayed size', () => {
    expect(
      TANK_BABIES.filter(isLargeMiniature)
        .map((b) => b.id)
        .sort(),
    ).toEqual([...LARGE].sort());
    for (const before of MINIATURES_BEFORE_096) {
      const after = TANK_BABIES.find((b) => b.id === before.id)!,
        g = LARGE.includes(before.id) ? MINIATURE_GROWTH : 1,
        shown = (d: typeof before) => d.scale * (d.size ?? 1);
      expect(shown(after) / shown(before), before.id).toBeCloseTo(g, 10);
      expect(after.radius / before.radius, before.id).toBeCloseTo(g, 10);
      expect(after.halfHeight / before.halfHeight, before.id).toBeCloseTo(
        g,
        10,
      );
      expect(miniatureGrowth(before.id)).toBe(g);
    }
  });

  it('fits every large miniature in the aquarium and keeps it clear of everything while it swims', () => {
    const q = new Aquarium();
    try {
      installAuthoredHulls(q);
      installReefHulls(q);
      const h = new TankBabyHabitat(q, tankContext(q)),
        eye = { x: 0, y: 4.6, z: 9 },
        animals = TANK_BABIES.filter(isLargeMiniature).map(
          (d) => new TankBaby(d, h, eye),
        );
      for (let i = 0; i < 30 * 90; i++)
        for (const b of animals) {
          b.update(1 / 30, true, false, undefined, animals);
          if (i % 15 === 0)
            expect(
              b.navigation.safe(
                b.position.x,
                b.position.y,
                b.position.z,
                b.halfHeight,
              ),
              `${b.definition.id} at ${b.time}`,
            ).toBe(true);
        }
      // Every one found room and moved off its spawn.
      for (const b of animals)
        expect(
          Math.hypot(b.position.x - eye.x, b.position.z - eye.z),
          b.definition.id,
        ).toBeGreaterThan(0.5);
    } finally {
      q.dispose();
    }
  }, 120000);

  it('keeps every saved animal (identities are unchanged; none is dropped for its new size)', () => {
    const data: Record<string, string> = {
        [TANK_KEY]: JSON.stringify({
          version: 3,
          items: [],
          babies: TANK_BABIES.map((b) => b.id),
          fish: {},
        }),
      },
      store: JournalStore = {
        getItem: (k) => data[k] ?? null,
        setItem: (k, v) => {
          data[k] = v;
        },
      },
      seen = TANK_BABIES.map((b) => ({
        id: b.sighting,
        first: new Date(0).toISOString(),
      })),
      q = new Aquarium();
    try {
      const state = loadTankState(store, seen, tankContext(q));
      expect([...state.babies].sort()).toEqual(
        TANK_BABIES.map((b) => b.id).sort(),
      );
    } finally {
      q.dispose();
    }
  });
});
