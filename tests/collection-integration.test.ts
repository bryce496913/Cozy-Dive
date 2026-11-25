import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { ASSET_REGISTRY, type AssetId } from '../src/assets/AssetRegistry';
import { TANK_BABIES, BABY_CAP, babyDefinition } from '../src/config/babies';
import {
  COLLECTION,
  ALBUM_SECTIONS,
  collectionEntry,
  isDiscovered,
  sectionProgress,
} from '../src/collection/registry';
import {
  smallAnimalMode,
  isAuthoredSmallAnimal,
} from '../src/creatures/babies/SmallAnimalHabitat';
import { TankBaby } from '../src/creatures/babies/TankBaby';
import { TankBabies } from '../src/environment/TankBabies';
import { buildPreview } from '../src/collection/AlbumPreviews';
import { acquireCollectionArt } from '../src/environment/TankCollectionArt';
import {
  SightingTracker,
  loadJournal,
  saveJournal,
  JOURNAL_KEY,
} from '../src/discovery/journal';
import {
  TankCatalog,
  loadTankState,
  loadTankFish,
  saveTank,
  NO_KEPT,
} from '../src/catalog/catalog';
import { AQUARIUM } from '../src/config/world';
import { ReefAsset } from '../validation/ReefAsset';
const small = TANK_BABIES.filter(isAuthoredSmallAnimal);
const context = { keepOut: [], routes: [], surface: () => 0 };
const eye = { x: 0, y: 4, z: 7 };
function libraries() {
  const models = new Map<AssetId, THREE.Group>(),
    owned: THREE.BufferGeometry[] = [];
  for (const d of small) {
    if (!models.has(d.asset!)) models.set(d.asset!, new THREE.Group());
    const g = models.get(d.asset!)!,
      name = d.nodes![0];
    const source = new ReefAsset(`public/${ASSET_REGISTRY[d.asset!].path}`),
      p = source.primitive(name),
      geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      'position',
      new THREE.BufferAttribute(p.positions, 3),
    );
    geometry.setIndex(new THREE.BufferAttribute(p.indices, 1));
    if (p.colors)
      geometry.setAttribute('color', new THREE.BufferAttribute(p.colors, 3));
    geometry.morphAttributes.position = source
      .morphPositions(name)
      .map((a) => new THREE.BufferAttribute(a, 3));
    geometry.morphTargetsRelative = true;
    const mesh = new THREE.Mesh(
      geometry,
      new THREE.MeshStandardMaterial({ name: name + '_Canonical' }),
    );
    mesh.name = name;
    const bytes = readFileSync(`public/${ASSET_REGISTRY[d.asset!].path}`);
    const doc: { meshes: { extras: { targetNames: string[] } }[] } = JSON.parse(
      bytes.toString('utf8', 20, 20 + bytes.readUInt32LE(12)),
    );
    mesh.morphTargetDictionary = Object.fromEntries(
      doc.meshes[source.node(name).mesh!].extras.targetNames.map((n, i) => [
        n,
        i,
      ]),
    );
    g.add(mesh);
    owned.push(geometry);
  }
  const release = vi.fn(),
    loader = {
      acquire: vi.fn(async (id: AssetId) => ({
        model: models.get(id)!.clone(true),
        animations: [],
        release,
      })),
      evictUnused: vi.fn(),
    };
  return {
    models,
    loader,
    release,
    dispose() {
      owned.forEach((g) => g.dispose());
      models.forEach((m) =>
        m.traverse((o) => {
          if (o instanceof THREE.Mesh) (o.material as THREE.Material).dispose();
        }),
      );
    },
  };
}
describe('Pass 106 complete collection', () => {
  it('has all 22 small discoveries, one primary slot each and accurate habitat totals', () => {
    expect(small).toHaveLength(22);
    expect(new Set(COLLECTION.map((e) => e.id)).size).toBe(COLLECTION.length);
    expect(
      ALBUM_SECTIONS.map((s) => [s, sectionProgress(s, []).total]),
    ).toEqual([
      ['aquarium', 12],
      ['outer-reef', 30],
      ['kelp-forest', 17],
      ['shipwreck', 5],
      ['sea-cave', 18],
      ['antarctic', 33],
    ]);
    for (const d of TANK_BABIES) {
      const e = collectionEntry(d.sighting);
      if (!e) {
        expect(d.sighting).toMatch(/^(plant|coral):/);
        continue;
      }
      expect(e.tank).toEqual({ slot: 'animal', key: d.id });
      expect(e.model).toMatchObject(
        d.asset
          ? { type: 'asset', asset: d.asset }
          : { type: 'procedural', shape: d.shape },
      );
    }
  });
  it('records observed animals independently of capacity and preserves discovery, fish counts across saves', () => {
    const data = new Map<string, string>(),
      store = {
        getItem: (k: string) => data.get(k) ?? null,
        setItem: (k: string, v: string) => {
          data.set(k, v);
        },
      };
    const tracker = new SightingTracker([]),
      seen = [];
    for (const d of small) {
      const c = {
        id: d.sighting,
        label: d.label,
        position: { x: 0, y: 2, z: -1 },
        radius: 0.1,
      };
      let found;
      for (let i = 0; i < 70; i++)
        found =
          tracker.update(
            [c],
            { x: 0, y: 2, z: 0 },
            { x: 0, y: 0, z: -1 },
            1 / 30,
          ) ?? found;
      if (found) seen.push({ id: found.id, first: '2026-11-25T00:00:00.000Z' });
    }
    expect(seen).toHaveLength(22);
    expect(saveJournal(store, seen)).toBe(true);
    const before = data.get(JOURNAL_KEY),
      tank = new TankCatalog([], context);
    for (const d of small) expect(tank.addBaby(d.id, seen)).toBe(true);
    expect(tank.addBaby(small[0].id, seen)).toBe(false);
    expect(tank.addFish('royal-gramma', seen).ok).toBe(true);
    expect(saveTank(store, [], tank.babies, NO_KEPT, tank.fish)).toBe(true);
    expect(loadTankState(store, loadJournal(store), context)).toMatchObject({
      babies: small.map((d) => d.id),
    });
    expect(loadTankFish(store, loadJournal(store))).toEqual({
      'royal-gramma': 1,
    });
    tank.removeBaby(small[0].id);
    expect(saveTank(store, [], tank.babies, NO_KEPT, tank.fish)).toBe(true);
    expect(
      isDiscovered(collectionEntry(small[0].sighting)!, loadJournal(store)),
    ).toBe(true);
    expect(data.get(JOURNAL_KEY)).toBe(before);
    expect(BABY_CAP).toBe(TANK_BABIES.length);
    const blocked = {
      getItem: store.getItem,
      setItem: () => {
        throw Error('blocked');
      },
    };
    expect(saveTank(blocked, [], tank.babies)).toBe(false);
    expect(loadJournal(blocked)).toEqual(seen);
  });
  it('uses every rare canonical geometry/marking buffer in card and placed model without large-animal growth', async () => {
    const l = libraries();
    try {
      for (const d of small) {
        const source = l.models
            .get(d.asset!)!
            .getObjectByName(d.nodes![0]) as THREE.Mesh,
          art = await acquireCollectionArt(d, l.loader),
          card = await buildPreview(collectionEntry(d.sighting)!, {
            creatures: l.loader,
            reef: l.loader,
          });
        const tank = art.model.getObjectByName(source.name) as THREE.Mesh,
          preview = card.object.getObjectByName(source.name) as THREE.Mesh;
        expect(tank.geometry, d.id).toBe(source.geometry);
        expect(preview.geometry, d.id).toBe(source.geometry);
        expect((tank.material as THREE.Material).name).toBe(
          (source.material as THREE.Material).name,
        );
        expect(d.size!, d.id).toBeLessThanOrEqual(0.5);
        art.dispose();
        card.dispose();
      }
    } finally {
      l.dispose();
    }
    expect(l.release).toHaveBeenCalledTimes(44);
  });
  it('seats small bottom animals on the substrate, hovers near vegetation and freezes while paused', () => {
    const habitat = {
      solids: [],
      floor: (x: number, z: number) => 0.002 * x + 0.003 * z,
      interests: [
        {
          kind: 'plant' as const,
          position: { x: -3, y: 1, z: 1 },
          normal: { x: 0, y: 1, z: 0 },
        },
        {
          kind: 'sheltered-crevice' as const,
          position: { x: 3, y: 0, z: 1 },
          normal: { x: 0, y: 1, z: 0 },
        },
      ],
    };
    for (const d of [
      ...small,
      babyDefinition('octopus'),
      babyDefinition('kelp-crab'),
      babyDefinition('antarctic-sea-star'),
    ]) {
      const b = new TankBaby(d, habitat, eye),
        home = { ...b.position };
      for (let i = 0; i < 1200; i++) {
        b.update(1 / 30, true, false);
        expect(
          b.navigation.safe(b.position.x, b.position.y, b.position.z),
          d.id,
        ).toBe(true);
        if (smallAnimalMode(d) === 'bottom')
          expect(
            b.position.y -
              habitat.floor(b.position.x, b.position.z) -
              d.halfHeight,
            d.id,
          ).toBeCloseTo(0.025, 6);
      }
      expect(
        Math.hypot(b.position.x - home.x, b.position.z - home.z),
        d.id,
      ).toBeLessThanOrEqual(1);
      const at = { ...b.position };
      b.update(1, false, false);
      expect(b.position).toEqual(at);
      if (smallAnimalMode(d) === 'hover') expect(b.position.x).toBeLessThan(0);
    }
  });
  it('encloses the visible poses of all 22 placed miniatures without sand penetration', async () => {
    const l = libraries(),
      residents = new TankBabies(
        l.loader,
        { solids: [], floor: () => 0 },
        { bounds: AQUARIUM, rocks: [] },
      ),
      camera = new THREE.PerspectiveCamera();
    residents.set(
      small.map((d) => d.id),
      eye,
    );
    await residents.ready;
    try {
      expect.soft(residents.animals).toHaveLength(22);
      for (const time of [0, 13, 45, 80]) {
        residents.animals.forEach((b) => {
          b.time = time;
        });
        residents.update(0, false, false, undefined, camera);
        residents.root.updateMatrixWorld(true);
        for (let i = 0; i < residents.animals.length; i++) {
          const b = residents.animals[i],
            root = residents.root.children[i],
            box = new THREE.Box3().setFromObject(root, true),
            d = b.definition;
          expect
            .soft(box.min.y, d.id)
            .toBeGreaterThanOrEqual(b.position.y - d.halfHeight - 0.001);
          expect
            .soft(box.max.y, d.id)
            .toBeLessThanOrEqual(b.position.y + d.halfHeight + 0.001);
          expect
            .soft(
              Math.max(
                Math.abs(box.min.x - b.position.x),
                Math.abs(box.max.x - b.position.x),
                Math.abs(box.min.z - b.position.z),
                Math.abs(box.max.z - b.position.z),
              ),
              d.id,
            )
            .toBeLessThanOrEqual(d.radius + 0.001);
          expect.soft(box.min.y, d.id).toBeGreaterThanOrEqual(0.015);
        }
      }
    } finally {
      residents.dispose();
      l.dispose();
    }
  });
  it('keeps failed placement retryable and releases its art without touching the saved discovery', async () => {
    const l = libraries(),
      habitat = { solids: [], floor: () => 100 },
      fish = { bounds: AQUARIUM, rocks: [] },
      b = new TankBabies(l.loader, habitat, fish),
      id = small[0].id;
    b.set([id], eye);
    expect(b.status(id)).toBe('pending');
    await b.ready;
    expect(b.status(id)).toBe('failed');
    expect(b.animals).toHaveLength(0);
    expect(l.release).toHaveBeenCalledTimes(1);
    habitat.floor = () => 0;
    b.set([id], eye);
    await b.ready;
    expect(b.status(id)).toBe('placed');
    expect(b.animals).toHaveLength(1);
    const root = b.root.children[0];
    root.updateMatrixWorld(true);
    const bottom = new THREE.Box3().setFromObject(root, true).min.y;
    expect(bottom).toBeCloseTo(0.031, 4);
    b.dispose();
    l.dispose();
    expect(l.release).toHaveBeenCalledTimes(2);
    expect(babyDefinition(id).id).toBe(id);
  });
});
