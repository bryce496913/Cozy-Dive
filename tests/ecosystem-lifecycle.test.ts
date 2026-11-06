import * as THREE from 'three';
import { expect, it, vi } from 'vitest';
import { Aquarium } from '../src/environment/Aquarium';

it('releases every shared ecosystem resource once across repeated direct disposal', () => {
  const aquarium = new Aquarium();
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  aquarium.root.traverse((object) => {
    if (
      object instanceof THREE.Mesh ||
      object instanceof THREE.Points ||
      object instanceof THREE.LineSegments
    ) {
      geometries.add(object.geometry);
      for (const material of Array.isArray(object.material)
        ? object.material
        : [object.material])
        materials.add(material);
    }
  });
  for (const template of aquarium.fish.templates) {
    for (const geometry of template.geometries) geometries.add(geometry);
    for (const material of template.materials) materials.add(material);
  }
  const spies = [...geometries, ...materials].map((resource) =>
    vi.spyOn(resource, 'dispose'),
  );
  aquarium.dispose();
  aquarium.dispose();
  aquarium.hardscape.dispose();
  for (const spy of spies) expect(spy).toHaveBeenCalledTimes(1);
  expect(aquarium.root.children).toHaveLength(0);
});
