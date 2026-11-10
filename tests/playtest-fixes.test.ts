import * as THREE from 'three';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AQUARIUM } from '../src/config/world';
import {
  MORAY_DEN,
  MorayBehavior,
  morayCenter,
} from '../src/creatures/MorayBehavior';
import { hullDepth } from '../src/creatures/MorayDen';
import { SEAHORSE_SCALE } from '../src/creatures/discoveries/Seahorse';
import { Aquarium } from '../src/environment/Aquarium';
import { FILTER_MOUNT_Y } from '../src/environment/ornaments/OrnamentPlacement';
import { FISH_SPECIES } from '../src/fish/FishSpecies';
import { revealLodLevels, sceneTextures } from '../src/rendering/warmUp';

describe('Pass 019 playtest fixes', () => {
  let a: Aquarium;
  beforeAll(() => {
    a = new Aquarium();
  });
  afterAll(() => a.dispose());

  it('shrinks the seahorse to 20% of its former size while it still grips its plant', () => {
    const s = a.anchoredLife.hidden.seahorse;
    expect(SEAHORSE_SCALE).toBe(0.2);
    s.pose(0);
    s.root.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(s.root);
    // The modelled horse is ~1.1 units tall; it now stands about 0.2 m tall.
    expect(box.max.y - box.min.y).toBeGreaterThan(0.15);
    expect(box.max.y - box.min.y).toBeLessThan(0.3);
    expect(s.root.position.distanceTo(s.gripPoint)).toBeLessThan(0.1);
  });

  it('halves the clownfish pair and adds a juvenile at 10% of the former size', () => {
    const clown = FISH_SPECIES.find((s) => s.id === 'ocellaris-clownfish')!;
    expect(clown.length).toBeCloseTo(0.68 * 0.5, 10);
    // The authored rig was modelled at the former length and is scaled to the new one.
    expect(clown.authoredLength).toBeCloseTo(0.68, 10);
    const family = a.fish.simulation.fish.filter((f) => f.species === clown);
    expect(family).toHaveLength(3);
    const lengths = family.map((f) => f.species.length * f.size);
    for (const l of lengths.slice(0, 2)) {
      expect(l).toBeGreaterThan(0.34 * 0.9 - 1e-9);
      expect(l).toBeLessThan(0.34 * 1.1 + 1e-9);
    }
    expect(lengths[2]).toBeGreaterThan(0.068 * 0.9 - 1e-9);
    expect(lengths[2]).toBeLessThan(0.068 * 1.1 + 1e-9);
    for (const f of family) expect(f.host).toBe(a.anchoredLife.anemone.host);
  });

  it('hangs the filter in the top back corner with its body under the waterline', () => {
    const filter = a.ornaments.models.find((m) => m.kind === 'filter')!;
    filter.root.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(filter.root);
    expect(filter.root.position.y).toBe(FILTER_MOUNT_Y);
    expect(filter.root.position.x).toBeGreaterThan(15);
    expect(filter.root.position.z).toBeLessThan(-11);
    // Return pipe rises out over the rim; the filter body itself is submerged near the top.
    expect(box.max.y).toBeGreaterThan(AQUARIUM.max.y);
    expect(filter.root.position.y + 1.31).toBeLessThan(AQUARIUM.max.y);
    expect(box.min.y).toBeGreaterThan(AQUARIUM.max.y - 3);
    expect(box.max.z).toBeLessThan(AQUARIUM.max.z);
    expect(box.min.z).toBeGreaterThan(AQUARIUM.min.z);
  });

  it('lives in a hole in a large reef rock: head out when resting, pulled in when retreating', () => {
    const m = a.anchoredLife.moray,
      d = m.den,
      head = new THREE.Vector3();
    // A large rock, a side-facing horizontal hole well above the sand.
    expect(d.support.max.y - d.support.min.y).toBeGreaterThan(1.6);
    expect(Math.abs(d.axis.y)).toBe(0);
    expect(d.axis.length()).toBeCloseTo(1, 9);
    expect(
      d.mouth.y -
        (a.fish.simulation.habitat.substrateHeight?.(d.mouth.x, d.mouth.z) ??
          0),
    ).toBeGreaterThan(0.7);
    expect(m.root.position.distanceTo(d.mouth)).toBeLessThan(1e-9);
    // Resting: the head is out of the hole; retreated: back inside it.
    morayCenter(1, 1, 0, head);
    expect(head.z).toBeCloseTo(MORAY_DEN.headOut, 9);
    morayCenter(1, 0, 0, head);
    expect(head.z).toBeLessThan(-0.3);
    // The tail end of the body stays deep inside the rock in every pose.
    for (const extension of [0, 1]) {
      morayCenter(0, extension, 0, head);
      head.applyMatrix4(m.root.matrixWorld);
      expect(hullDepth(d.support, head)).toBeGreaterThan(0.3);
    }
    // The diver's approach pulls it in.
    const b = new MorayBehavior();
    b.state = 'resting';
    b.extension = 1;
    for (let i = 0; i < 90; i++) b.update(1 / 30, true, true);
    expect(b.extension).toBeLessThan(0.1);
  });

  it('collects every material texture and reveals every LOD level for warm-up', () => {
    const root = new THREE.Group(),
      map = new THREE.Texture(),
      normal = new THREE.Texture(),
      uniform = new THREE.Texture();
    const hidden = new THREE.Mesh(
      new THREE.BoxGeometry(),
      new THREE.MeshStandardMaterial({ map, normalMap: normal }),
    );
    hidden.visible = false;
    const shader = new THREE.Mesh(
      new THREE.BoxGeometry(),
      new THREE.ShaderMaterial({ uniforms: { tex: { value: uniform } } }),
    );
    const lod = new THREE.LOD(),
      near = new THREE.Group(),
      far = new THREE.Group();
    lod.addLevel(near, 0);
    lod.addLevel(far, 10);
    far.visible = false;
    root.add(hidden, shader, lod);
    expect(sceneTextures(root)).toEqual(new Set([map, normal, uniform]));
    const restore = revealLodLevels(root);
    expect(far.visible).toBe(true);
    expect(near.visible).toBe(true);
    restore();
    expect(far.visible).toBe(false);
    expect(near.visible).toBe(true);
  });
});
