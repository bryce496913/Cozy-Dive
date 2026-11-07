import * as THREE from 'three';
import { plantFootprintClear, substrateHeight } from './HabitatRegions';
import { insideRock, type HabitatInterest } from '../fish/FishHabitat';
import type { ConvexCollider } from '../player/collision';
import { createPlantGeometry } from './PlantGeometry';
import { MEADOW_GRASS } from './PlantSpecies';
export interface GrassPatch {
  readonly x: number;
  readonly z: number;
  readonly radius: number;
  readonly blades: number;
}
/** Irregular density-gradient tropical seagrass beds with shared single-blade templates. */
export class MeadowSystem {
  readonly root = new THREE.Group();
  readonly patches: readonly GrassPatch[];
  readonly geometries: readonly THREE.BufferGeometry[];
  readonly interests: readonly HabitatInterest[];
  private disposed = false;
  constructor(
    solids: readonly ConvexCollider[],
    material: THREE.Material,
    seed = 92047,
  ) {
    this.root.name = 'Tropical seagrass meadows';
    let state = seed >>> 0;
    const random = (): number => {
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
      return state / 4294967296;
    };
    const patches: GrassPatch[] = [],
      data: {
        x: number;
        y: number;
        z: number;
        height: number;
        yaw: number;
        template: number;
      }[] = [],
      interests: HabitatInterest[] = [];
    for (let i = 0; i < 8; i++) {
      let x = 0,
        z = 0,
        placed = false;
      const radius = 1.1 + random() * 0.5;
      for (let attempt = 0; attempt < 800; attempt++) {
        x = (i % 2 ? -1 : 1) * (4.5 + random() * 11.6);
        z = -11.5 + random() * 24;
        if (
          !plantFootprintClear(x, z, radius + 0.15) ||
          solids.some((s) => insideRock({ x, y: 0.45, z }, radius + 0.2, s)) ||
          patches.some(
            (p) => Math.hypot(p.x - x, p.z - z) < p.radius + radius + 0.5,
          )
        )
          continue;
        placed = true;
        break;
      }
      if (!placed) throw new Error('No safe grass meadow placement.');
      const blades = 120 + Math.floor(random() * 61);
      patches.push({ x, z, radius, blades });
      for (let blade = 0; blade < blades; blade++) {
        const angle = random() * Math.PI * 2,
          r =
            radius *
            Math.sqrt(random()) *
            (0.75 + 0.25 * Math.sin(angle * 3 + i)),
          px = x + Math.cos(angle) * r,
          pz = z + Math.sin(angle) * r * 0.7;
        const edge = 1 - r / radius,
          height =
            (0.2 + random() * 0.55) *
            (0.65 + 0.35 * edge) *
            (random() < 0.08 ? 1.9 : 1);
        data.push({
          x: px,
          y: substrateHeight(px, pz) - 0.012,
          z: pz,
          height,
          yaw: random() * Math.PI * 2,
          template: Math.floor(random() * 3),
        });
      }
      const sign = -Math.sign(x);
      interests.push({
        kind: 'seagrass-meadow',
        position: {
          x: x + sign * radius * 0.7,
          y: substrateHeight(x, z) + 0.2,
          z,
        },
        normal: { x: sign * 0.8, y: 0.6, z: 0 },
        vegetation: {
          species: 'turtle-grass-meadow',
          region: 'substrate-edge',
          height: 0.6,
          broadLeaves: false,
        },
      });
    }
    const geometries: THREE.BufferGeometry[] = [],
      matrix = new THREE.Matrix4(),
      rotation = new THREE.Quaternion(),
      axis = new THREE.Vector3(0, 1, 0),
      scale = new THREE.Vector3(),
      position = new THREE.Vector3(),
      color = new THREE.Color();
    for (let template = 0; template < 3; template++) {
      const g = createPlantGeometry(
        { ...MEADOW_GRASS, width: template === 2 ? 0.045 : 0.022 },
        seed + template * 193,
      );
      geometries.push(g);
      const entries = data.filter((d) => d.template === template),
        mesh = new THREE.InstancedMesh(g, material, entries.length);
      mesh.name = `Grass meadow blades ${template}`;
      entries.forEach((d, i) => {
        position.set(d.x, d.y, d.z);
        scale.setScalar(d.height);
        rotation.setFromAxisAngle(axis, d.yaw);
        matrix.compose(position, rotation, scale);
        mesh.setMatrixAt(i, matrix);
        const tint = 0.85 + random() * 0.25;
        color.setRGB(tint, tint, 0.96 * tint);
        mesh.setColorAt(i, color);
      });
      mesh.computeBoundingBox();
      mesh.computeBoundingSphere();
      if (mesh.boundingSphere) mesh.boundingSphere.radius += 0.3;
      this.root.add(mesh);
    }
    this.patches = patches;
    this.geometries = geometries;
    this.interests = interests;
  }
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.root.removeFromParent();
    for (const m of this.root.children)
      if (m instanceof THREE.InstancedMesh) m.dispose();
    this.root.clear();
    this.geometries.forEach((g) => g.dispose());
  }
}
