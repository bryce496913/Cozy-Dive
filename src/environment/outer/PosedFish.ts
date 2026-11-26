import * as THREE from 'three';
import type { AssetLease } from '../../assets/AssetLoader';
import { fishLevel, shareTextures } from '../../benchmark/AuthoredSchool';

/**
 * v0.6 Pass 043: where a scripted fish is and how it is moving. Heading `yaw` about +y (0 faces
 * +x, positive towards -z), `pitch` nose-up, `roll`; `effort` is the tail stroke (-1..1) and
 * `fins` the pectorals' beat (-1..1). Its owner updates poses in place.
 */
export interface FishPose {
  readonly position: { x: number; y: number; z: number };
  yaw: number;
  pitch: number;
  roll: number;
  effort: number;
  fins: number;
}
export const createPose = (): FishPose => ({
  position: { x: 0, y: 0, z: 0 },
  yaw: 0,
  pitch: 0,
  roll: 0,
  effort: 0,
  fins: 0,
});

function isDistanceLevel(object: THREE.Object3D): boolean {
  for (let o: THREE.Object3D | null = object; o; o = o.parent)
    if (o.name.includes('_LOD1')) return true;
  return false;
}

/**
 * Authored reef-fish rigs (the chromis rig's parts: body, fins, eyes, pectorals; with distance
 * parts) drawn instanced for fish whose motion is scripted rather than simulated: one instanced
 * draw per part and level for all of them, each with its own tail stroke and pectoral beat.
 * Distant fish use the distance level. Owns its instancing and material clones; the leases'
 * models stay theirs and are released on dispose.
 */
export class PosedFish {
  readonly root = new THREE.Group();
  private readonly rigs: THREE.Group[];
  private readonly nearParts: THREE.Mesh[][];
  private readonly farParts: THREE.Mesh[][];
  private readonly near: THREE.InstancedMesh[];
  private readonly far: THREE.InstancedMesh[];
  private readonly level: boolean[];
  private readonly pectorals: (readonly [
    THREE.Object3D | undefined,
    THREE.Object3D | undefined,
  ])[];
  private readonly materials = new Set<THREE.Material>();
  private readonly eye = new THREE.Vector3();
  private disposed = false;

  constructor(
    private readonly leases: readonly AssetLease[],
    readonly poses: readonly FishPose[],
    name: string,
    /** Body length (m) the models are drawn at, and the body lengths beyond which to use LOD1. */
    private readonly length: number,
    private readonly detailLengths = 10,
    textures?: Map<string, THREE.Texture>,
    /** v0.6 Pass 045: one solid colour in place of the authored colour map (as AuthoredSchool). */
    recolor?: number,
  ) {
    if (leases.length !== poses.length)
      throw Error('PosedFish needs one lease per pose');
    this.root.name = name;
    this.level = poses.map(() => true);
    this.rigs = leases.map((lease) => {
      const rig = new THREE.Group();
      rig.rotation.order = 'YZX';
      rig.add(lease.model);
      return rig;
    });
    this.pectorals = this.rigs.map(
      (rig) =>
        [
          rig.getObjectByName('Pectoral_Left'),
          rig.getObjectByName('Pectoral_Right'),
        ] as const,
    );
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
    const clones = new Map<THREE.Material, THREE.Material>();
    const instanced = (parts: THREE.Mesh[][]) =>
      (parts[0] ?? []).map((part, j) => {
        if (Array.isArray(part.material))
          throw Error('GLTF primitives must resolve single materials');
        let material = clones.get(part.material);
        if (!material) {
          material = part.material.clone();
          if (material instanceof THREE.MeshStandardMaterial) {
            if (material.name.includes('Fin_')) {
              material.transparent = true;
              material.depthWrite = false;
              material.side = THREE.DoubleSide;
              material.forceSinglePass = true;
            }
            material.metalness = 0;
            material.envMapIntensity = 0.35;
            if (
              !material.userData.coreFish &&
              recolor !== undefined &&
              !/Eye|Gill|Mouth/i.test(material.name)
            ) {
              material.map = null;
              material.color.setHex(recolor);
            }
            if (textures) shareTextures(material, textures);
          }
          clones.set(part.material, material);
          this.materials.add(material);
        }
        part.geometry.computeBoundingSphere();
        const mesh = new THREE.InstancedMesh(
          part.geometry,
          material,
          poses.length,
        );
        mesh.name = `${name} ${part.name}`;
        mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        mesh.frustumCulled = false;
        for (let i = 0; i < poses.length; i++)
          if (part.morphTargetInfluences) mesh.setMorphAt(i, parts[i][j]);
        this.root.add(mesh);
        return mesh;
      });
    this.near = instanced(this.nearParts);
    this.far = instanced(this.farParts);
    this.update();
  }
  /** Draw every fish at its pose (`count` of them, from the first; all by default). */
  update(camera?: THREE.Camera, count = this.poses.length): void {
    if (this.disposed) return;
    if (camera) camera.getWorldPosition(this.eye);
    let n0 = 0,
      n1 = 0;
    const canSwitch = !!camera && this.far.length > 0;
    for (let i = 0; i < count; i++) {
      const p = this.poses[i],
        rig = this.rigs[i];
      rig.position.set(p.position.x, p.position.y, p.position.z);
      rig.rotation.set(p.roll, p.yaw, p.pitch);
      const near = canSwitch
        ? fishLevel(
            rig.position.distanceTo(this.eye),
            this.length,
            this.level[i],
            this.detailLengths,
          )
        : true;
      this.level[i] = near;
      const parts = near ? this.nearParts[i] : this.farParts[i],
        meshes = near ? this.near : this.far,
        slot = near ? n0++ : n1++,
        effort = Math.max(-1, Math.min(1, p.effort));
      for (const part of parts)
        if (part.morphTargetInfluences && part.morphTargetDictionary) {
          const k = part.morphTargetDictionary;
          part.morphTargetInfluences[k.Stroke_Left ?? 0] = Math.max(0, effort);
          part.morphTargetInfluences[k.Stroke_Right ?? 1] = Math.max(
            0,
            -effort,
          );
        }
      if (near) {
        const [left, right] = this.pectorals[i];
        if (left) left.rotation.y = 0.35 * p.fins;
        if (right) right.rotation.y = -0.35 * p.fins;
      }
      rig.updateMatrixWorld(true);
      for (let j = 0; j < meshes.length; j++) {
        meshes[j].setMatrixAt(slot, parts[j].matrixWorld);
        if (parts[j].morphTargetInfluences)
          meshes[j].setMorphAt(slot, parts[j]);
      }
    }
    for (const [list, n] of [
      [this.near, n0],
      [this.far, n1],
    ] as const)
      for (const mesh of list) {
        mesh.count = n;
        mesh.instanceMatrix.needsUpdate = true;
        if (mesh.morphTexture) mesh.morphTexture.needsUpdate = true;
      }
  }
  set visible(v: boolean) {
    this.root.visible = v;
  }
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.root.removeFromParent();
    for (const mesh of [...this.near, ...this.far]) mesh.dispose();
    this.materials.forEach((m) => m.dispose());
    this.leases.forEach((l) => l.release());
    this.root.clear();
  }
}
