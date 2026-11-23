import * as THREE from 'three';
import { ASSET_REGISTRY } from '../src/assets/AssetRegistry';
import { Geology } from '../src/environment/shared/Geology';
import { ReefAsset } from './ReefAsset';

/**
 * V0.8 Pass 091: `geology.glb` as a three.js object graph, decoded on the CPU (no WebGL, no
 * GLTFLoader), so tests build the kelp forest and sea cave with the same authored rock and colliders
 * the game uses. Exported nodes carry no transforms, so names and meshes are all that is needed.
 */
export function geologyAsset(): ReefAsset {
  return new ReefAsset(`public/${ASSET_REGISTRY.geology.path}`);
}

export function geologyModel(asset: ReefAsset = geologyAsset()): THREE.Group {
  const root = new THREE.Group();
  root.name = 'Geology_Root';
  for (const node of asset.doc.nodes) {
    if (!node.name.endsWith('_Root') || node.name === 'Geology_Root') continue;
    const group = new THREE.Group();
    group.name = node.name;
    for (const child of asset.children(node.name)) {
      const p = asset.primitive(child.name),
        g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(p.positions, 3));
      g.setIndex(new THREE.BufferAttribute(p.indices, 1));
      const mesh = new THREE.Mesh(g);
      mesh.name = child.name;
      group.add(mesh);
    }
    root.add(group);
  }
  return root;
}

/** A `Geology` over the decoded asset (one decode, shared by every test in a file). */
let shared: Geology | undefined;
export function testGeology(): Geology {
  shared ??= new Geology(geologyModel());
  return shared;
}
