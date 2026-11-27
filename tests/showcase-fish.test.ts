import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { coreFishGeometry } from '../src/fish/lowPoly/model';
import { CORE_FISH, CORE_FISH_IDS } from '../src/fish/lowPoly/designs';
import { fishFinStroke } from '../src/fish/lowPoly/motion';
import { AssetLoader } from '../src/assets/AssetLoader';
import { PosedFish, createPose } from '../src/environment/outer/PosedFish';
import { FishSystem } from '../src/fish/FishSystem';
import { FISH_SPECIES } from '../src/fish/FishSpecies';
import { AQUARIUM } from '../src/config/world';
import { AuthoredSchool } from '../src/benchmark/AuthoredSchool';
import { OUTER_EXTRA_SPECIES } from '../src/environment/outer/OuterExtraSpecies';

describe('Pass 018 showcase anatomy and independent fins', () => {
  it.each(CORE_FISH_IDS)(
    '%s keeps simultaneous tail/fin extremes inside render bounds and markings unchanged',
    (id) => {
      const g = coreFishGeometry(id),
        mesh = new THREE.Mesh(g),
        p = g.attributes.position;
      const colors = Array.from(g.attributes.color.array),
        point = new THREE.Vector3();
      for (const stroke of [-1, 1])
        for (const fin of [-1, 1]) {
          const tail = g.morphAttributes.position![stroke > 0 ? 0 : 1];
          fishFinStroke(mesh, fin * 2);
          const fins = g.morphAttributes.position![fin > 0 ? 2 : 3];
          expect(
            mesh.morphTargetInfluences!.slice(2).reduce((a, b) => a + b, 0),
          ).toBe(1);
          for (let i = 0; i < p.count; i++) {
            point.set(
              p.getX(i) + tail.getX(i) + fins.getX(i),
              p.getY(i) + tail.getY(i) + fins.getY(i),
              p.getZ(i) + tail.getZ(i) + fins.getZ(i),
            );
            expect(
              g.boundingBox!.clone().expandByScalar(1e-6).containsPoint(point),
            ).toBe(true);
            expect(
              point.distanceTo(g.boundingSphere!.center),
            ).toBeLessThanOrEqual(g.boundingSphere!.radius + 1e-6);
          }
        }
      expect(Array.from(g.attributes.color.array)).toEqual(colors);
      g.dispose();
    },
  );
  it('keeps clownfish bands in the torso topology, with narrow dark borders and no separate ring meshes', () => {
    const g = coreFishGeometry('ocellaris-clownfish'),
      p = g.attributes.position,
      c = g.attributes.color;
    const d = CORE_FISH['ocellaris-clownfish'],
      white = new THREE.Color(d.palette[3]),
      dark = new THREE.Color(d.palette[2]);
    for (const center of [-0.29, -0.01, 0.31]) {
      let whites = 0,
        borders = 0;
      for (let i = 0; i < p.count; i += 3) {
        const x = (p.getX(i) + p.getX(i + 1) + p.getX(i + 2)) / (3 * d.length);
        const delta = Math.abs(x - center);
        const actual = new THREE.Color().fromBufferAttribute(c, i);
        if (delta < 0.04) {
          if (
            Math.abs(actual.r - white.r) < 1e-6 &&
            Math.abs(actual.g - white.g) < 1e-6
          )
            whites++;
        }
        if (
          delta > 0.04 &&
          delta < 0.052 &&
          Math.abs(actual.r - dark.r) < 1e-6 &&
          Math.abs(actual.g - dark.g) < 1e-6
        )
          borders++;
      }
      expect(whites).toBeGreaterThan(6);
      expect(borders).toBeGreaterThan(6);
    }
    expect(g.groups).toHaveLength(0);
    g.dispose();
  });
  it.each(OUTER_EXTRA_SPECIES)(
    '$id fits its unchanged navigation clearance even at full stroke and fin extension',
    (species) => {
      const g = coreFishGeometry(species.id),
        p = g.attributes.position;
      const k = species.length / CORE_FISH[species.id].length,
        radius = species.length * (species.radiusFactor ?? 0.56);
      for (const tail of g.morphAttributes.position!.slice(0, 2))
        for (const fins of g.morphAttributes.position!.slice(2))
          for (let i = 0; i < p.count; i++)
            expect(
              Math.hypot(
                p.getX(i) + tail.getX(i) + fins.getX(i),
                p.getY(i) + tail.getY(i) + fins.getY(i),
                p.getZ(i) + tail.getZ(i) + fins.getZ(i),
              ) * k,
            ).toBeLessThan(radius);
      g.dispose();
    },
  );
  it('carries an independent hover fin phase through scripted instancing, without driving the tail', async () => {
    const loader = new AssetLoader(),
      lease = await loader.acquire('clownfish'),
      pose = createPose();
    const body = lease.model.getObjectByName('Body') as THREE.Mesh;
    const fish = new PosedFish([lease], [pose], 'test', 0.34);
    pose.fins = 0.8;
    pose.effort = 0;
    fish.update();
    expect(body.morphTargetInfluences).toEqual([0, 0, 0.8, 0]);
    pose.fins = -0.5;
    fish.update();
    expect(body.morphTargetInfluences).toEqual([0, 0, 0, 0.5]);
    fish.dispose();
    expect(loader.leased).toBe(0);
    loader.dispose();
  });
  it('matches fallback and authored-school fin poses, halves motion on request and preserves a paused pose', async () => {
    const config = { ...FISH_SPECIES[0], count: 1 };
    const system = new FishSystem({ bounds: AQUARIUM, rocks: [] }, [config]);
    const loader = new AssetLoader(),
      lease = await loader.acquire('chromis');
    const school = new AuthoredSchool(system, [lease]);
    system.update(1 / 30, true, false);
    school.update();
    const body = lease.model.getObjectByName('Body') as THREE.Mesh;
    expect(body.morphTargetInfluences![2]).toBeCloseTo(
      system.visuals[0].body.morphTargetInfluences![2],
    );
    const normal = [...system.visuals[0].body.morphTargetInfluences!];
    system.update(0, true, true);
    school.update();
    for (let i = 0; i < 4; i++)
      expect(system.visuals[0].body.morphTargetInfluences![i]).toBeCloseTo(
        normal[i] * 0.5,
      );
    const paused = [...system.visuals[0].body.morphTargetInfluences!];
    system.update(1, false, true);
    expect(system.visuals[0].body.morphTargetInfluences).toEqual(paused);
    school.dispose();
    system.dispose();
    loader.dispose();
  });
});
