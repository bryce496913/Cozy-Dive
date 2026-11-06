import * as THREE from 'three';
import { expect, it } from 'vitest';
import { FishSystem } from '../src/fish/FishSystem';
import { AQUARIUM } from '../src/config/world';

it('refreshes conservative batch bounds around every articulated vertex as fish turn and move', () => {
  const system = new FishSystem({ bounds: AQUARIUM, rocks: [] });
  const matrix = new THREE.Matrix4(),
    point = new THREE.Vector3();
  try {
    for (let frame = 0; frame < 8; frame++) {
      system.update(0.1, true, frame % 2 === 0);
      for (const batch of system.batches)
        for (const mesh of batch.meshes) {
          expect(mesh.frustumCulled).toBe(true);
          expect(mesh.boundingSphere).not.toBeNull();
          const sphere = mesh.boundingSphere!;
          expect(Number.isFinite(sphere.radius)).toBe(true);
          let excess = -Infinity;
          for (let instance = 0; instance < mesh.count; instance++) {
            mesh.getMatrixAt(instance, matrix);
            const vertices = mesh.geometry.attributes.position;
            for (let i = 0; i < vertices.count; i++) {
              point.fromBufferAttribute(vertices, i).applyMatrix4(matrix);
              excess = Math.max(
                excess,
                point.distanceTo(sphere.center) - sphere.radius,
              );
            }
          }
          expect(excess).toBeLessThan(1e-5);
        }
    }
    system.root.updateMatrixWorld(true);
    const camera = new THREE.PerspectiveCamera(64, 1.5, 0.08, 80);
    camera.position.set(0, 4.6, 9);
    camera.lookAt(0, 4.6, 14);
    camera.updateMatrixWorld(true);
    const frustum = new THREE.Frustum().setFromProjectionMatrix(
      new THREE.Matrix4().multiplyMatrices(
        camera.projectionMatrix,
        camera.matrixWorldInverse,
      ),
    );
    const meshes = system.batches.flatMap((b) => [...b.meshes]);
    expect(
      meshes.filter((m) => frustum.intersectsObject(m)).length,
    ).toBeLessThan(meshes.length);
  } finally {
    system.dispose();
  }
});
