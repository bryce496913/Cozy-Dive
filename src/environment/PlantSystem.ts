import * as THREE from 'three';
import type { ConvexCollider } from '../player/collision';
import {
  insideRock,
  safeFishPosition,
  type HabitatInterest,
} from '../fish/FishHabitat';
import { AQUARIUM } from '../config/world';
import { createPlantGeometry } from './PlantGeometry';
import { generatePlantPlacements, type PlantPlacement } from './HabitatRegions';
import {
  PLANT_SPECIES,
  PLANT_TEMPLATES,
  type PlantSpecies,
} from './PlantSpecies';
import { PlantClock, PLANT_VERTEX_GLSL } from './PlantAnimation';

export interface PlantBatch {
  readonly species: PlantSpecies;
  readonly template: number;
  readonly mesh: THREE.InstancedMesh;
}
/** Environment-owned instanced vegetation. Meshes, geometry and material have exactly one owner. */
export class PlantSystem {
  readonly root = new THREE.Group();
  readonly batches: readonly PlantBatch[];
  readonly placements: readonly PlantPlacement[];
  readonly interests: readonly HabitatInterest[];
  readonly geometries: readonly THREE.BufferGeometry[];
  readonly material: THREE.MeshStandardMaterial;
  readonly clock = new PlantClock();
  readonly timeUniform = { value: 0 };
  private disposed = false;
  constructor(
    rocks: readonly ConvexCollider[],
    density = 1,
    seed = 48193,
    supports: readonly ConvexCollider[] = rocks,
  ) {
    this.root.name = 'Marine seagrass, macroalgae and soft corals';
    this.material = new THREE.MeshStandardMaterial({
      vertexColors: true,
      side: THREE.DoubleSide,
      roughness: 0.88,
      metalness: 0,
    });
    this.material.onBeforeCompile = (shader) => {
      shader.uniforms.plantTime = this.timeUniform;
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\n' + PLANT_VERTEX_GLSL)
        .replace(
          '#include <beginnormal_vertex>',
          '#include <beginnormal_vertex>\nvec2 cozyFlow=plantFlow();\nobjectNormal.y -= dot(objectNormal.xz,cozyFlow*plantMotion.z);\nobjectNormal=normalize(objectNormal);',
        )
        .replace(
          '#include <begin_vertex>',
          '#include <begin_vertex>\ntransformed.xz += cozyFlow*plantMotion.x;',
        );
    };
    this.material.customProgramCacheKey = () => 'cozy-plants-v3';
    const templates = new Map<string, THREE.BufferGeometry>();
    const geometries: THREE.BufferGeometry[] = [],
      matrix = new THREE.Matrix4(),
      rotation = new THREE.Quaternion(),
      axis = new THREE.Vector3(0, 1, 0),
      position = new THREE.Vector3(),
      scale = new THREE.Vector3(),
      color = new THREE.Color();
    for (const species of PLANT_SPECIES)
      for (let template = 0; template < PLANT_TEMPLATES; template++) {
        const geometry = createPlantGeometry(
          species,
          seed + PLANT_SPECIES.indexOf(species) * 193 + template * 41,
        );
        geometries.push(geometry);
        templates.set(`${species.id}/${template}`, geometry);
      }
    const probe = new THREE.Vector3(),
      normal = new THREE.Vector3(),
      yawRotation = new THREE.Quaternion();
    try {
      this.placements = generatePlantPlacements(
        rocks,
        seed,
        density,
        (plant) => {
          const g = templates.get(`${plant.species.id}/${plant.template}`)!;
          rotation
            .setFromUnitVectors(
              axis,
              normal.set(plant.normal.x, plant.normal.y, plant.normal.z),
            )
            .multiply(yawRotation.setFromAxisAngle(axis, plant.yaw));
          matrix.compose(
            position.set(plant.position.x, plant.position.y, plant.position.z),
            rotation,
            scale.setScalar(plant.height),
          );
          const box = g
            .boundingBox!.clone()
            .applyMatrix4(matrix)
            .expandByScalar(plant.height * plant.species.sway * 1.5 + 0.015);
          const nearby = rocks.filter(
            (r) =>
              r.max.x >= box.min.x &&
              r.min.x <= box.max.x &&
              r.max.y >= box.min.y &&
              r.min.y <= box.max.y &&
              r.max.z >= box.min.z &&
              r.min.z <= box.max.z,
          );
          if (!nearby.length) return true;
          const p = g.attributes.position,
            m = g.attributes.plantMotion;
          for (let i = 0; i < p.count; i++) {
            probe.fromBufferAttribute(p, i).applyMatrix4(matrix);
            const margin =
              plant.height * m.getX(i) * 1.5 +
              (plant.species.category === 'coral' ? 0 : 0.015);
            if (nearby.some((r) => insideRock(probe, margin, r))) return false;
          }
          return true;
        },
        supports,
      );
    } catch (error) {
      geometries.forEach((g) => g.dispose());
      this.material.dispose();
      throw error;
    }
    const batches: PlantBatch[] = [];
    this.batches = batches;
    for (const species of PLANT_SPECIES)
      for (let template = 0; template < PLANT_TEMPLATES; template++) {
        const instances = this.placements.filter(
          (p) => p.species === species && p.template === template,
        );
        if (!instances.length) continue;
        const geometry = templates.get(`${species.id}/${template}`)!;
        const mesh = new THREE.InstancedMesh(
          geometry,
          this.material,
          instances.length,
        );
        mesh.name = `${species.name} ${template}`;
        instances.forEach((plant, i) => {
          position.set(plant.position.x, plant.position.y, plant.position.z);
          scale.setScalar(plant.height);
          rotation
            .setFromUnitVectors(
              axis,
              new THREE.Vector3(plant.normal.x, plant.normal.y, plant.normal.z),
            )
            .multiply(new THREE.Quaternion().setFromAxisAngle(axis, plant.yaw));
          matrix.compose(position, rotation, scale);
          mesh.setMatrixAt(i, matrix);
          color.setRGB(plant.tint, plant.tint, plant.tint);
          mesh.setColorAt(i, color);
        });
        mesh.computeBoundingBox();
        mesh.computeBoundingSphere();
        if (mesh.boundingBox) mesh.boundingBox.expandByScalar(0.65);
        if (mesh.boundingSphere) mesh.boundingSphere.radius += 0.65;
        this.root.add(mesh);
        batches.push({ species, template, mesh });
      }
    this.geometries = geometries;
    this.interests = this.placements.map((plant) => {
      // Keep channel-facing upper-leaf inspection regions tied to actual template vertices.
      const vertices = templates.get(`${plant.species.id}/${plant.template}`)!
        .attributes.position;
      const sign = -Math.sign(plant.position.x);
      let x = plant.position.x,
        y = plant.position.y + plant.height * 0.85,
        z = plant.position.z,
        best = -Infinity;
      position.set(plant.position.x, plant.position.y, plant.position.z);
      rotation
        .setFromUnitVectors(
          axis,
          normal.set(plant.normal.x, plant.normal.y, plant.normal.z),
        )
        .multiply(yawRotation.setFromAxisAngle(axis, plant.yaw));
      for (let i = 0; i < vertices.count; i++) {
        const v = probe
          .fromBufferAttribute(vertices, i)
          .applyQuaternion(rotation)
          .multiplyScalar(plant.height)
          .add(position);
        const px = v.x,
          py = v.y,
          pz = v.z;
        const score =
          sign * (px - plant.position.x) -
          0.5 * Math.abs(py - plant.position.y - plant.height * 0.7);
        if (
          score > best &&
          safeFishPosition({ x: px, y: py, z: pz }, 0.1, {
            bounds: AQUARIUM,
            rocks,
          })
        ) {
          best = score;
          x = px;
          y = py;
          z = pz;
        }
      }
      // Tilted coral tips can project beyond the coarse horizontal placement radius.
      // Keep inspection metadata inside its bounded region before validating solid clearance.
      const radial = Math.hypot(x - plant.position.x, z - plant.position.z);
      if (radial > plant.radius * 0.95) {
        const factor = (plant.radius * 0.95) / radial;
        x = plant.position.x + (x - plant.position.x) * factor;
        z = plant.position.z + (z - plant.position.z) * factor;
      }
      y = Math.min(y, plant.position.y + plant.height * 0.98);
      const interest: HabitatInterest = {
        kind:
          plant.species.category === 'coral'
            ? 'coral-edge'
            : plant.species.category === 'seagrass'
              ? 'seagrass-meadow'
              : 'reef-face',
        position: { x, y, z },
        normal: { x: sign * 0.8, y: 0.6, z: 0 },
        vegetation: {
          category: plant.species.category,
          species: plant.species.id,
          region: plant.region,
          height: plant.height,
          broadLeaves: plant.species.broadLeaves,
        },
      };
      if (
        !safeFishPosition(interest.position, 0.1, { bounds: AQUARIUM, rocks })
      )
        throw new Error('Invalid vegetation interest.');
      return interest;
    });
  }
  update(dt: number, active: boolean, reducedMotion: boolean): void {
    if (this.disposed) return;
    this.clock.update(dt, active, reducedMotion);
    this.timeUniform.value = this.clock.time;
  }
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.root.removeFromParent();
    for (const mesh of this.root.children)
      if (mesh instanceof THREE.InstancedMesh) mesh.dispose();
    this.root.clear();
    for (const geometry of this.geometries) geometry.dispose();
    this.material.dispose();
  }
}
