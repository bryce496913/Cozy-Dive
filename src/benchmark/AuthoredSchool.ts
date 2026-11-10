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
/** Pass 017 distance level: switch at this many body lengths, with hysteresis against flicker. */
export const FISH_LOD = { bodyLengths: 14, hysteresis: 0.1 } as const;
/** Pure level choice, shared by the runtime and tests. */
export function fishLevel(
  distance: number,
  length: number,
  wasNear: boolean,
): boolean {
  const limit = FISH_LOD.bodyLengths * length;
  return wasNear
    ? distance < limit * (1 + FISH_LOD.hysteresis)
    : distance < limit;
}
function isDistanceLevel(object: THREE.Object3D): boolean {
  for (let o: THREE.Object3D | null = object; o; o = o.parent)
    if (o.name.includes('_LOD1')) return true;
  return false;
}
/**
 * Authored morph geometry + articulated pectorals driven by the unchanged simulation.
 *
 * Pass 017: rigs that carry `*_LOD1` parts get a second instanced set. Each frame every fish is
 * written into either the full set or the distance set (compacted, with matching tints and
 * morph weights), so far fish cost ~1.8k instead of ~12.7k triangles.
 */
export class AuthoredSchool {
  readonly root = new THREE.Group();
  /** Full-detail instanced parts followed by distance-level parts. */
  readonly meshes: readonly THREE.InstancedMesh[];
  readonly rigs: readonly THREE.Group[];
  /** Fish currently drawn at full detail (after the latest update). */
  nearCount = 0;
  private readonly near: THREE.InstancedMesh[];
  private readonly far: THREE.InstancedMesh[];
  private readonly nearParts: readonly (readonly THREE.Mesh[])[];
  private readonly farParts: readonly (readonly THREE.Mesh[])[];
  private readonly materials = new Set<THREE.Material>();
  private readonly indices: readonly number[];
  private readonly tints: readonly THREE.Color[];
  private readonly level: boolean[];
  private readonly scratch = new THREE.Vector3();
  private readonly eye = new THREE.Vector3();
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
    this.level = this.indices.map(() => true);
    this.tints = this.indices.map((index) => {
      const id = fish.simulation.fish[index].id;
      return new THREE.Color().setRGB(
        0.94 + (id % 5) * 0.014,
        0.97 + (id % 3) * 0.012,
        0.96 + (id % 4) * 0.013,
      );
    });
    this.rigs = leases.map((lease) => {
      const wrapper = new THREE.Group();
      wrapper.add(lease.model);
      return wrapper;
    });
    const split = (far: boolean) =>
      this.rigs.map((rig) => {
        const parts: THREE.Mesh[] = [];
        rig.traverse((o) => {
          if (o instanceof THREE.Mesh && isDistanceLevel(o) === far)
            parts.push(o);
        });
        return parts;
      });
    this.nearParts = split(false);
    this.farParts = split(true);
    const materials = new Map<THREE.Material, THREE.Material>();
    const instanced = (parts: readonly (readonly THREE.Mesh[])[]) =>
      (parts[0] ?? []).map((part, j) => {
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
          mesh.setColorAt(i, this.tints[i]);
          if (part.morphTargetInfluences) mesh.setMorphAt(i, parts[i][j]);
        }
        mesh.castShadow = !material.transparent;
        this.root.add(mesh);
        return mesh;
      });
    this.near = instanced(this.nearParts);
    this.far = instanced(this.farParts);
    this.meshes = [...this.near, ...this.far];
    this.update();
  }
  /** Fish beyond the distance threshold of `camera` use the distance level when one exists. */
  update(camera?: THREE.Camera): void {
    if (this.disposed) return;
    let n0 = 0,
      n1 = 0;
    const canSwitch = !!camera && this.far.length > 0;
    if (camera) camera.getWorldPosition(this.eye);
    for (let i = 0; i < this.indices.length; i++) {
      const source = this.fish.visuals[this.indices[i]],
        sim = this.fish.simulation.fish[this.indices[i]],
        rig = this.rigs[i];
      rig.position.copy(source.root.position);
      rig.quaternion.copy(source.root.quaternion);
      // Authored rigs are modelled at `authoredLength`; scale them to the species' body length.
      rig.scale
        .copy(source.root.scale)
        .multiplyScalar(
          sim.species.length /
            (sim.species.authoredLength ?? sim.species.length),
        );
      const effort = Math.max(
        -1,
        Math.min(1, source.tail.rotation.y / sim.species.tailAngle),
      );
      const near = canSwitch
        ? fishLevel(
            source.root.getWorldPosition(this.scratch).distanceTo(this.eye),
            sim.species.length * sim.size,
            this.level[i],
          )
        : true;
      this.level[i] = near;
      const parts = near ? this.nearParts[i] : this.farParts[i],
        meshes = near ? this.near : this.far,
        slot = near ? n0++ : n1++;
      for (const part of parts)
        if (part.morphTargetInfluences && part.morphTargetDictionary) {
          part.morphTargetInfluences[part.morphTargetDictionary.Stroke_Left] =
            Math.max(0, effort);
          part.morphTargetInfluences[part.morphTargetDictionary.Stroke_Right] =
            Math.max(0, -effort);
        }
      if (near) {
        const left = rig.getObjectByName('Pectoral_Left'),
          right = rig.getObjectByName('Pectoral_Right');
        if (left) left.rotation.y = source.leftPectoral.rotation.y * 0.65;
        if (right) right.rotation.y = source.rightPectoral.rotation.y * 0.65;
      }
      rig.updateMatrixWorld(true);
      for (let j = 0; j < meshes.length; j++) {
        meshes[j].setMatrixAt(slot, parts[j].matrixWorld);
        meshes[j].setColorAt(slot, this.tints[i]);
        if (parts[j].morphTargetInfluences)
          meshes[j].setMorphAt(slot, parts[j]);
      }
    }
    this.nearCount = n0;
    for (const [list, count] of [
      [this.near, n0],
      [this.far, n1],
    ] as const)
      for (const mesh of list) {
        mesh.count = count;
        mesh.instanceMatrix.needsUpdate = true;
        if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
        if (mesh.morphTexture) mesh.morphTexture.needsUpdate = true;
        // Morph envelope is included in the source geometry sphere before instance aggregation.
        mesh.computeBoundingSphere();
      }
  }
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.root.removeFromParent();
    for (const mesh of this.meshes) mesh.dispose();
    this.materials.forEach((m) => m.dispose());
    this.leases.forEach((l) => l.release());
    this.root.clear();
  }
}
