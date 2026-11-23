import * as THREE from 'three';
import {
  GELATINOUS_PRESETS,
  gelatinousMaterial,
  type GelatinousOptions,
} from '../rendering/Gelatinous';
import type { AssetLoader, AssetLease } from '../assets/AssetLoader';
import type { BabyDefinition } from '../config/babies';
import { creatureStroke } from './creatureStroke';
import { collectionShape } from './TankCollectionShapes';
import { RIBBON_WORM_COLOUR } from './ice/IceCritters';

/** V0.7 Pass 078: collection animals drawn with the shared gelatinous material. */
const GELATINOUS_COLLECTION: Partial<Record<string, GelatinousOptions>> = {
  'comb-jelly': GELATINOUS_PRESETS.combJelly,
  'antarctic-jellyfish': GELATINOUS_PRESETS.jellyfish,
  salp: GELATINOUS_PRESETS.salp,
  'sea-squirt': GELATINOUS_PRESETS.seaSquirt,
};

export interface CollectionArt {
  readonly model: THREE.Object3D;
  readonly near: THREE.Object3D;
  readonly far: THREE.Object3D;
  update(opacity: number, effort: number, time: number): void;
  dispose(): void;
}
/** Asset leases and locally generated art share the same ownership, scale and animation contract. */
export async function acquireCollectionArt(
  d: BabyDefinition,
  loader: Pick<AssetLoader, 'acquire' | 'evictUnused'>,
): Promise<CollectionArt> {
  let lease: AssetLease | undefined;
  const geometry: THREE.BufferGeometry[] = [];
  const sourceMaterials: THREE.Material[] = [];
  const materials: THREE.Material[] = [];
  const alpha: number[] = [];
  let disposed = false;
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    materials.forEach((m) => m.dispose());
    geometry.forEach((g) => g.dispose());
    sourceMaterials.forEach((m) => m.dispose());
    lease?.release();
    if (d.asset) loader.evictUnused(d.asset);
  };
  try {
    let model: THREE.Object3D;
    if (d.asset) {
      lease = await loader.acquire(d.asset);
      model = lease.model;
      if (d.nodes) {
        model.updateMatrixWorld(true);
        const selected = d.nodes.map((name) => {
          const node = model.getObjectByName(name);
          if (!node) throw Error(`Missing collection part ${name}`);
          return node;
        });
        const near = new THREE.Group();
        near.name = 'Body';
        for (const node of selected) {
          let parent = node.parent,
            nested = false;
          while (parent) {
            if (selected.includes(parent)) {
              nested = true;
              break;
            }
            parent = parent.parent;
          }
          if (nested) continue;
          const matrix = node.matrixWorld.clone();
          node.removeFromParent();
          matrix.decompose(node.position, node.quaternion, node.scale);
          // The library stores the head at its rig pivot; seat it at the extended body's end.
          if (node.name === 'MorayHead' || node.name === 'MorayJaw')
            node.position.z += 1.6;
          if (
            node instanceof THREE.Mesh &&
            ['MorayBody', 'MorayDorsal'].includes(node.name)
          ) {
            const own = node.geometry.clone(),
              p = own.getAttribute('position');
            for (let i = 0; i < p.count; i++) {
              const z = p.getZ(i);
              p.setXYZ(
                i,
                p.getX(i) + 0.08 * Math.sin(z * Math.PI * 2),
                p.getY(i),
                z * 1.6,
              );
            }
            own.computeVertexNormals();
            own.computeBoundingBox();
            own.computeBoundingSphere();
            geometry.push(own);
            node.geometry = own;
          }
          near.add(node);
        }
        near.rotation.y = Math.PI / 2;
        const far = near.clone(true);
        far.name = 'Body_LOD1';
        model = new THREE.Group();
        model.add(near, far);
      }
    } else {
      const shape = collectionShape(d.id);
      geometry.push(shape);
      if (d.motion === 'swim' || d.motion === 'crawl')
        shape.rotateY(Math.PI / 2);
      const colors: Partial<Record<BabyDefinition['id'], number>> = {
        'encrusting-sponge': 0xef8c35,
        'tube-sponge': 0xdca84d,
        'sea-squirt': 0xcbdce1,
        mysid: 0xf3efe6,
        'ice-algae': 0x746038,
        'christmas-tree-worm': 0x5299dd,
        'kelp-crab': 0x879d4c,
        octopus: 0xb87954,
        // V0.8 Pass 096: the wild worm's own colour (its geometry carries none).
        'ribbon-worm': RIBBON_WORM_COLOUR,
        'colossal-squid': 0x924d43,
        'glass-sponge': 0xe2d9bd,
        'antarctic-soft-coral': 0xdfa7b5,
        'antarctic-anemone': 0xe8b9aa,
      };
      // V0.7 Pass 078: the gelatinous animals keep their clear, rim-dense jelly here too.
      const jelly = GELATINOUS_COLLECTION[d.id];
      const material = jelly
        ? gelatinousMaterial({
            ...jelly,
            name: d.id,
            vertexColors: shape.hasAttribute('color'),
            color: colors[d.id] ?? 0xffffff,
            side: THREE.DoubleSide,
          })
        : new THREE.MeshStandardMaterial({
            vertexColors: shape.hasAttribute('color'),
            color: colors[d.id] ?? 0xffffff,
            roughness: 0.6,
            opacity:
              d.id === 'sea-squirt'
                ? 0.72
                : d.id === 'sea-angel'
                  ? 0.8
                  : d.id === 'ice-algae'
                    ? 0.6
                    : 1,
            side: THREE.DoubleSide,
          });
      sourceMaterials.push(material);
      const near = new THREE.Mesh(shape, material);
      near.name = 'Body';
      const far = near.clone();
      far.name = 'Body_LOD1';
      model = new THREE.Group();
      model.add(near, far);
    }
    const near = model.getObjectByName('Body'),
      far = model.getObjectByName('Body_LOD1');
    if (!near || !far) throw Error('Collection body levels missing');
    const strokes: { mesh: THREE.Mesh; left: number; right: number }[] = [];
    model.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        const keys = o.morphTargetDictionary;
        if (keys?.Stroke_Left !== undefined && keys.Stroke_Right !== undefined)
          strokes.push({
            mesh: o,
            left: keys.Stroke_Left,
            right: keys.Stroke_Right,
          });
      }
    });
    model.traverse((o) => {
      if (!(o instanceof THREE.Mesh)) return;
      const clone = (m: THREE.Material) => {
        const own = m.clone();
        own.transparent = true;
        own.depthWrite = false;
        own.opacity = 0;
        if (d.tint !== undefined && own instanceof THREE.MeshStandardMaterial)
          own.color.multiply(new THREE.Color(d.tint));
        materials.push(own);
        alpha.push(m.opacity);
        return own;
      };
      o.material = Array.isArray(o.material)
        ? o.material.map(clone)
        : clone(o.material);
    });
    if (d.size) {
      model.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(model),
        size = box.getSize(new THREE.Vector3()),
        centre = box.getCenter(new THREE.Vector3());
      const normalized = new THREE.Group();
      normalized.add(model);
      model.position.sub(centre);
      normalized.scale.setScalar(d.size / Math.max(size.x, size.y, size.z));
      model = normalized;
    }
    const levels = [near, far];
    const jaw = model.getObjectByName('MorayJaw'),
      jawRest = jaw?.rotation.x ?? 0;
    return {
      model,
      near,
      far,
      dispose,
      update(opacity, effort, time) {
        for (let i = 0; i < materials.length; i++)
          materials[i].opacity = opacity * alpha[i];
        if (jaw) jaw.rotation.x = jawRest + 0.08 * (1 + Math.sin(time * 1.2));
        for (const s of strokes)
          if (s.left !== undefined && s.right !== undefined)
            creatureStroke(s.mesh, s, effort);
        if (d.shape) {
          const pulse =
            d.motion === 'drift' ? 1 + 0.035 * Math.sin(time * 1.3) : 1;
          near.scale.set(1, pulse, 1);
          far.scale.copy(near.scale);
          for (const mesh of levels)
            if (
              mesh instanceof THREE.Mesh &&
              mesh.morphTargetInfluences?.length
            ) {
              mesh.morphTargetInfluences[0] = Math.max(0, -effort);
              mesh.morphTargetInfluences[1] = Math.max(0, effort);
            }
        }
      },
    };
  } catch (error) {
    dispose();
    throw error;
  }
}
