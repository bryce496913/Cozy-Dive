import * as THREE from 'three';
import type { AssetLease } from '../assets/AssetLoader';
import type { FishSystem } from '../fish/FishSystem';
const TEXTURE_SLOTS = [
  'map',
  'normalMap',
  'roughnessMap',
  'metalnessMap',
  'aoMap',
  'alphaMap',
] as const;
/**
 * Species libraries derived from one rig embed identical maps under the same image name. Point
 * every clone at the first decoded copy so each map uploads once; the asset cache still owns and
 * disposes its own (never-uploaded) duplicates.
 */
export function shareTextures(
  material: THREE.MeshStandardMaterial,
  pool: Map<string, THREE.Texture>,
): void {
  for (const slot of TEXTURE_SLOTS) {
    const texture = material[slot];
    if (!texture?.name) continue;
    const shared = pool.get(texture.name);
    if (shared) material[slot] = shared;
    else pool.set(texture.name, texture);
  }
}
/** Authored morph geometry + articulated pectorals, shared across the unchanged 20-fish simulation. */
export class AuthoredSchool {
  readonly root = new THREE.Group();
  readonly meshes: readonly THREE.InstancedMesh[];
  readonly rigs: readonly THREE.Group[];
  private readonly parts: readonly (readonly THREE.Mesh[])[];
  private readonly materials = new Set<THREE.Material>();
  private readonly indices: readonly number[];
  private disposed = false;
  constructor(
    private readonly fish: FishSystem,
    private readonly leases: readonly AssetLease[],
    speciesId = 'blue-green-chromis',
    /** Optional cross-species texture pool keyed by authored image name (identical maps upload once). */
    sharedTextures?: Map<string, THREE.Texture>,
  ) {
    this.root.name = `Authored ${speciesId} school`;
    this.indices = fish.simulation.fish.flatMap((f, i) =>
      f.species.id === speciesId ? [i] : [],
    );
    if (this.indices.length !== leases.length)
      throw Error(`Authored school must preserve ${speciesId} count`);
    this.rigs = leases.map((lease) => {
      const wrapper = new THREE.Group();
      wrapper.add(lease.model);
      return wrapper;
    });
    this.parts = this.rigs.map((rig) => {
      const parts: THREE.Mesh[] = [];
      rig.traverse((o) => {
        if (o instanceof THREE.Mesh) parts.push(o);
      });
      return parts;
    });
    const materials = new Map<THREE.Material, THREE.Material>();
    this.meshes = this.parts[0].map((part, j) => {
      if (Array.isArray(part.material))
        throw Error('GLTF primitives must resolve single materials');
      let material = materials.get(part.material);
      if (!material) {
        material = part.material.clone();
        if (material instanceof THREE.MeshStandardMaterial) {
          if (material.name.includes('Fin_')) {
            material.transparent = true;
            material.depthWrite = false;
            material.side = THREE.DoubleSide;
            material.forceSinglePass = true;
          }
          // Biological sheen is restrained; glTF maps retain local scale/roughness detail.
          material.metalness = 0;
          material.envMapIntensity = 0.35;
          if (sharedTextures) shareTextures(material, sharedTextures);
        }
        materials.set(part.material, material);
        this.materials.add(material);
      }
      part.geometry.computeBoundingSphere();
      const mesh = new THREE.InstancedMesh(
        part.geometry,
        material,
        leases.length,
      );
      mesh.name = `Authored ${part.name}`;
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      for (let i = 0; i < leases.length; i++) {
        const id = fish.simulation.fish[this.indices[i]].id;
        mesh.setColorAt(
          i,
          new THREE.Color().setRGB(
            0.94 + (id % 5) * 0.014,
            0.97 + (id % 3) * 0.012,
            0.96 + (id % 4) * 0.013,
          ),
        );
        if (part.morphTargetInfluences) mesh.setMorphAt(i, this.parts[i][j]);
      }
      mesh.castShadow = !material.transparent;
      this.root.add(mesh);
      return mesh;
    });
    this.update();
  }
  update(): void {
    if (this.disposed) return;
    for (let i = 0; i < this.indices.length; i++) {
      const source = this.fish.visuals[this.indices[i]],
        rig = this.rigs[i];
      rig.position.copy(source.root.position);
      rig.quaternion.copy(source.root.quaternion);
      rig.scale.copy(source.root.scale);
      const effort = Math.max(
        -1,
        Math.min(
          1,
          source.tail.rotation.y /
            this.fish.simulation.fish[this.indices[i]].species.tailAngle,
        ),
      );
      for (const part of this.parts[i]) {
        if (part.morphTargetInfluences && part.morphTargetDictionary) {
          part.morphTargetInfluences[part.morphTargetDictionary.Stroke_Left] =
            Math.max(0, effort);
          part.morphTargetInfluences[part.morphTargetDictionary.Stroke_Right] =
            Math.max(0, -effort);
        }
      }
      const left = rig.getObjectByName('Pectoral_Left'),
        right = rig.getObjectByName('Pectoral_Right');
      if (left) left.rotation.y = source.leftPectoral.rotation.y * 0.65;
      if (right) right.rotation.y = source.rightPectoral.rotation.y * 0.65;
      rig.updateMatrixWorld(true);
      for (let j = 0; j < this.meshes.length; j++) {
        this.meshes[j].setMatrixAt(i, this.parts[i][j].matrixWorld);
        if (this.parts[i][j].morphTargetInfluences)
          this.meshes[j].setMorphAt(i, this.parts[i][j]);
      }
    }
    for (const mesh of this.meshes) {
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.morphTexture) mesh.morphTexture.needsUpdate = true;
      // Morph envelope is included in the source geometry sphere before instance aggregation.
      mesh.computeBoundingSphere();
    }
  }
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.root.removeFromParent();
    for (const mesh of this.meshes) {
      mesh.dispose();
    }
    this.materials.forEach((m) => m.dispose());
    this.leases.forEach((l) => l.release());
    this.root.clear();
  }
}
