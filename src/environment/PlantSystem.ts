import * as THREE from 'three';
import type { ConvexCollider } from '../player/collision';
import { safeFishPosition, type HabitatInterest } from '../fish/FishHabitat';
import { AQUARIUM } from '../config/world';
import { createPlantGeometry } from './PlantGeometry';
import { generatePlantPlacements, type PlantPlacement } from './HabitatRegions';
import { PLANT_SPECIES, PLANT_TEMPLATES } from './PlantSpecies';
import { PlantClock, PLANT_VERTEX_GLSL } from './PlantAnimation';

/** Environment-owned instanced vegetation. Meshes, geometry and material have exactly one owner. */
export class PlantSystem {
  readonly root = new THREE.Group();
  readonly placements: readonly PlantPlacement[];
  readonly interests: readonly HabitatInterest[];
  readonly geometries: readonly THREE.BufferGeometry[];
  readonly material: THREE.MeshStandardMaterial;
  readonly clock = new PlantClock();
  readonly timeUniform = { value: 0 };
  private disposed = false;
  constructor(rocks: readonly ConvexCollider[], density = 1, seed = 48193) {
    this.root.name = 'Living vegetation';
    this.placements = generatePlantPlacements(rocks, seed, density);
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
    this.material.customProgramCacheKey = () => 'cozy-plants-v2';
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
        const instances = this.placements.filter(
          (p) => p.species === species && p.template === template,
        );
        if (!instances.length) continue;
        const geometry = createPlantGeometry(
          species,
          seed + PLANT_SPECIES.indexOf(species) * 193 + template * 41,
        );
        geometries.push(geometry);
        templates.set(`${species.id}/${template}`, geometry);
        const mesh = new THREE.InstancedMesh(
          geometry,
          this.material,
          instances.length,
        );
        mesh.name = `${species.name} ${template}`;
        instances.forEach((plant, i) => {
          position.set(plant.position.x, plant.position.y, plant.position.z);
          scale.setScalar(plant.height);
          rotation.setFromAxisAngle(axis, plant.yaw);
          matrix.compose(position, rotation, scale);
          mesh.setMatrixAt(i, matrix);
          color.setRGB(plant.tint, plant.tint, plant.tint);
          mesh.setColorAt(i, color);
        });
        mesh.computeBoundingBox();
        mesh.computeBoundingSphere();
        if (mesh.boundingBox) mesh.boundingBox.expandByScalar(0.4);
        if (mesh.boundingSphere) mesh.boundingSphere.radius += 0.4;
        this.root.add(mesh);
      }
    this.geometries = geometries;
    this.interests = this.placements.map((plant) => {
      // Keep channel-facing upper-leaf inspection regions tied to actual template vertices.
      const vertices = templates.get(`${plant.species.id}/${plant.template}`)!
        .attributes.position;
      const sign = -Math.sign(plant.position.x),
        cos = Math.cos(plant.yaw),
        sin = Math.sin(plant.yaw);
      let x = plant.position.x,
        y = plant.position.y + plant.height * 0.85,
        z = plant.position.z,
        best = -Infinity;
      for (let i = 0; i < vertices.count; i++) {
        const px =
            plant.position.x +
            plant.height * (vertices.getX(i) * cos - vertices.getZ(i) * sin),
          py = plant.position.y + plant.height * vertices.getY(i),
          pz =
            plant.position.z +
            plant.height * (vertices.getX(i) * sin + vertices.getZ(i) * cos);
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
      const interest: HabitatInterest = {
        kind: 'plant',
        position: { x, y, z },
        normal: { x: sign * 0.8, y: 0.6, z: 0 },
        vegetation: {
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
