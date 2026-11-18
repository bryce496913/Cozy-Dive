import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { applyFieldOfView } from '../src/rendering/fieldOfView';

describe('field of view preference (Pass 057)', () => {
  it('adds to each camera’s own designed field of view', () => {
    const office = new THREE.PerspectiveCamera(66),
      water = new THREE.PerspectiveCamera(64);
    applyFieldOfView(office, 8);
    applyFieldOfView(water, 8);
    expect(office.fov).toBe(74);
    expect(water.fov).toBe(72);
  });
  it('does not accumulate when applied every frame, and returns to the design at 0', () => {
    const c = new THREE.PerspectiveCamera(64);
    for (let i = 0; i < 100; i++) applyFieldOfView(c, 6);
    expect(c.fov).toBe(70);
    applyFieldOfView(c, 0);
    expect(c.fov).toBe(64);
  });
  it('only rebuilds the projection when the value changes', () => {
    const c = new THREE.PerspectiveCamera(64);
    applyFieldOfView(c, 4);
    const before = c.projectionMatrix.clone();
    let rebuilt = 0;
    const update = c.updateProjectionMatrix.bind(c);
    c.updateProjectionMatrix = () => {
      rebuilt++;
      update();
    };
    for (let i = 0; i < 10; i++) applyFieldOfView(c, 4);
    expect(rebuilt).toBe(0);
    expect(c.projectionMatrix.equals(before)).toBe(true);
  });
});
