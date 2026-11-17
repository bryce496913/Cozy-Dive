import * as THREE from 'three';
import { ASSET_REGISTRY } from '../../src/assets/AssetRegistry';
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
  // Pass 017: libraries carry a morphing distance level beside the full rig.
  for (const name of [
    'Body',
    'Median_Fins',
    'Pectoral_Left',
    'Pectoral_Right',
    'Body_LOD1',
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

/**
 * v0.6 Pass 046 review: a stand-in for any registered creature or fish model, by its URL: the fixture's
 * rig renamed to the asset's root and scaled to the middle of its allowed size.
 */
export function creatureFixture(url: string): LoadedAsset {
  const asset = assetFixture(),
    spec = Object.values(ASSET_REGISTRY).find((s) => url.endsWith(s.path)),
    root = asset.scene.getObjectByName('Chromis_Root'),
    body = asset.scene.getObjectByName('Body');
  if (!spec || !root || !(body instanceof THREE.Mesh)) throw Error(url);
  root.name = spec.requiredNodes[0];
  const k = (spec.minDimension + spec.maxDimension) / 2 / 0.46;
  body.geometry.scale(k, k, k);
  return asset;
}
