import * as THREE from 'three';
import type { LoadedAsset } from '../../src/assets/AssetValidation';
export function assetFixture(): LoadedAsset {
  const scene = new THREE.Group(),
    root = new THREE.Group();
  root.name = 'Chromis_Root';
  scene.add(root);
  const geometry = new THREE.BoxGeometry(0.46, 0.18, 0.08),
    material = new THREE.MeshStandardMaterial();
  const texture = new THREE.DataTexture(new Uint8Array(16), 2, 2);
  material.map = texture;
  material.normalMap = texture;
  material.roughnessMap = texture;
  geometry.morphAttributes.position = [
    geometry.attributes.position.clone(),
    geometry.attributes.position.clone(),
  ];
  for (let i = 0; i < geometry.attributes.position.count; i++) {
    geometry.morphAttributes.position[0].setZ(
      i,
      geometry.attributes.position.getZ(i) + 0.02,
    );
    geometry.morphAttributes.position[1].setZ(
      i,
      geometry.attributes.position.getZ(i) - 0.02,
    );
  }
  for (const name of [
    'Body',
    'Median_Fins',
    'Pectoral_Left',
    'Pectoral_Right',
  ]) {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = name;
    mesh.morphTargetDictionary = { Stroke_Left: 0, Stroke_Right: 1 };
    mesh.morphTargetInfluences = [0, 0];
    root.add(mesh);
  }
  return {
    scene,
    scenes: [scene],
    animations: [new THREE.AnimationClip('SwimPreview', 1, [])],
  };
}
