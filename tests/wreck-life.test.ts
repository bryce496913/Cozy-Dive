import { describe, expect, it, vi } from 'vitest';
import {
  WreckLife,
  HoldPatrol,
  WRECK_LIFE,
  wreckHabitat,
  wreckSpecies,
} from '../src/environment/wreck/WreckLife';
import * as THREE from 'three';
import {
  toShip,
  wreckFloor,
  wreckShade,
} from '../src/environment/wreck/WreckLayout';
import { spawnFish } from '../src/fish/FishSpawner';
import { insideRock } from '../src/fish/FishHabitat';

describe('life on the wreck', () => {
  it('the giant sea bass patrols the dark hold, end to end, turning at each end', () => {
    const bass = new HoldPatrol(),
      local = { x: 0, y: 0, z: 0 };
    let fore = 0,
      aft = -100;
    const yaws = new Set<number>();
    for (let i = 0; i < 30 * WRECK_LIFE.bass.lap; i++) {
      bass.update(1 / 30, false);
      const p = bass.pose.position;
      // Always well inside the hold, where it is dark.
      expect(wreckShade(p)).toBe(1);
      toShip(p, local);
      fore = Math.min(fore, local.z);
      aft = Math.max(aft, local.z);
      yaws.add(Math.round(bass.pose.yaw));
    }
    expect(fore).toBeLessThan(WRECK_LIFE.bass.foreZ + 0.3);
    expect(aft).toBeGreaterThan(WRECK_LIFE.bass.aftZ - 0.3);
    // It faces both ways in a lap.
    expect(yaws.has(2)).toBe(true);
    expect(yaws.has(-2)).toBe(true);
  });
  it('the schools start in open water, clear of the ship', () => {
    const habitat = wreckHabitat(),
      fish = spawnFish(habitat, wreckSpecies(), 24024);
    expect(fish.length).toBeGreaterThan(60);
    for (const f of fish)
      for (const rock of habitat.rocks)
        expect(insideRock(f.position, 0.05, rock)).toBe(false);
  });
  it('the cruisers and the open-water schools keep clear of the ship and the sand', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const loader = {
      acquire: () => Promise.reject(Error('no assets in tests')),
      evictUnused: () => undefined,
    } as unknown as ConstructorParameters<typeof WreckLife>[0];
    const life = new WreckLife(loader),
      rocks = wreckHabitat().rocks,
      clear = (p: { x: number; y: number; z: number }, r: number) => {
        for (const rock of rocks) expect(insideRock(p, r, rock)).toBe(false);
        expect(p.y).toBeGreaterThan(wreckFloor(p.x, p.z) + 0.4);
      };
    const player = {
      active: false,
      position: { x: 0, y: 0, z: 0 },
      velocity: { x: 0, y: 0, z: 0 },
    };
    const camera = new THREE.PerspectiveCamera();
    for (let i = 0; i < 30 * 60; i++) {
      life.update(1 / 30, true, false, player, camera);
      if (i % 15) continue;
      for (const loop of [
        life.wrasse,
        life.shark,
        life.turtle,
        ...life.rays,
        life.manta,
        ...life.blacktips,
      ])
        clear(loop.pose.position, 0.6);
      for (const p of [...life.trevally, ...life.barracuda])
        clear(p.position, 0.3);
    }
    clear(life.sternGrouper.position, 0.5);
    for (const g of life.hullGroupers) clear(g.position, 0.5);
    life.dispose();
  }, 30000);
});
