import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { OUTER, ICE } from '../src/config/passage';
import { iceLimits } from '../src/creatures/iceLife';
import { ICE_WHALE, RareDirector } from '../src/creatures/iceRare';
import { iceFloor } from '../src/environment/ice/IceTerrain';
import { squidGeometry } from '../src/environment/ice/SquidGeometry';
import { creatureClearance } from '../src/environment/outer/CreatureClearance';
import { OuterEnvironment } from '../src/environment/outer/OuterEnvironment';
import { createPose } from '../src/environment/outer/PosedFish';
import type { PlayerPresence } from '../src/fish/FishDiverReaction';

const player: PlayerPresence = {
  position: { x: 0, y: 6, z: -14 },
  velocity: { x: 0, y: 0, z: 0 },
  active: true,
};

describe('reef, cave and ice polish', () => {
  for (const id of ['minke-whale', 'killer-whales'] as const)
    for (const dt of [1 / 30, 1 / 60])
      it(`${id} clears the whole body through the large hole at ${Math.round(1 / dt)} Hz`, () => {
        const d = new RareDirector(createPose, iceLimits(iceFloor), 7);
        expect(d.bring(id, player.position)).toBe(true);
        const encounter = d.encounters[id];
        expect(encounter.poses).toHaveLength(1);
        let crossedDown = false,
          crossedUp = false,
          submerged = false;
        for (let step = 0; step < 600 / dt && encounter.active; step++) {
          const p = encounter.poses[0];
          d.update(dt, player, false);
          if (!encounter.active) break;
          if (p.position.y < ICE.ceiling - ICE_WHALE.halfLength)
            submerged = true;
          else {
            // Any portion in the ceiling must stay in the vertical shaft, including the tail.
            const h = ICE.holes.find((h) => h.r >= ICE_WHALE.minHoleRadius)!;
            expect(
              Math.hypot(p.position.x - h.x, p.position.z - h.z),
            ).toBeLessThan(0.1);
            expect(Math.abs(p.pitch)).toBeCloseTo(Math.PI / 2, 2);
            if (submerged) crossedUp = true;
            else crossedDown = true;
          }
        }
        expect({ crossedDown, submerged, crossedUp }).toEqual({
          crossedDown: true,
          submerged: true,
          crossedUp: true,
        });
        expect(encounter.active).toBe(false);
        expect(
          encounter.poses[0].position.y - ICE_WHALE.halfLength,
        ).toBeGreaterThan(ICE.ceiling);
      });

  it('leaves through the opening even if a swimmer camps beneath its exit', () => {
    const director = new RareDirector(createPose, iceLimits(iceFloor), 7);
    director.bring('killer-whales', player.position);
    const animal = director.encounters['killer-whales'];
    const h = ICE.holes[0];
    const camper: PlayerPresence = {
      ...player,
      position: { x: h.x, y: 10, z: h.z },
    };
    for (let i = 0; i < 6000 && animal.active; i++)
      director.update(0.1, camper, false);
    expect(animal.active).toBe(false);
  });

  it('measures swept clearance including child transforms and morph endpoints', () => {
    const g = new THREE.BoxGeometry(4, 1, 2);
    const delta = new Float32Array(g.getAttribute('position').count * 3);
    for (let i = 0; i < delta.length; i += 3) delta[i + 1] = 3;
    g.morphTargetsRelative = true;
    g.morphAttributes.position = [new THREE.BufferAttribute(delta, 3)];
    const mesh = new THREE.Mesh(g);
    mesh.position.set(2, 0, 0);
    const model = new THREE.Group();
    model.add(mesh);
    const clearance = creatureClearance(model, 2);
    const root = new THREE.Group();
    root.scale.setScalar(2);
    root.add(model);
    mesh.morphTargetInfluences![0] = 1;
    for (let i = 0; i < 20; i++) {
      root.rotation.set(i * 0.71, i * 0.43, i * 0.37);
      root.position.y = OUTER.glass.bottom + clearance;
      root.updateMatrixWorld(true);
      const vertex = new THREE.Vector3();
      for (let j = 0; j < g.getAttribute('position').count; j++) {
        mesh.getVertexPosition(j, vertex).applyMatrix4(mesh.matrixWorld);
        expect(vertex.y).toBeGreaterThan(OUTER.glass.bottom);
      }
    }
    g.dispose();
    (mesh.material as THREE.Material).dispose();
  });

  it('leaves the blue beyond the glass bottomless (no floor out there)', () => {
    const env = new OuterEnvironment();
    env.root.updateMatrixWorld(true);
    env.root.traverse((o) => {
      if (!(o instanceof THREE.Mesh) || o === env.sand) return;
      const box = new THREE.Box3().setFromObject(o);
      // Nothing flat and wide lying out past the glass, low down.
      const flatFloor =
        box.min.z < OUTER.glass.z - 5 &&
        box.max.y - box.min.y < 1 &&
        box.max.x - box.min.x > 20 &&
        box.max.y < 0;
      expect(flatFloor, o.name).toBe(false);
    });
    env.dispose();
  });

  it('gives the squid animated arms with finite geometry', () => {
    const geometry = squidGeometry();
    expect(geometry.morphAttributes.position).toHaveLength(2);
    expect(geometry.boundingSphere!.radius).toBeGreaterThan(3);
    for (const attr of [
      geometry.getAttribute('position'),
      ...(geometry.morphAttributes.position ?? []),
    ])
      expect(Array.from(attr.array).every(Number.isFinite)).toBe(true);
    geometry.dispose();
  });
});
