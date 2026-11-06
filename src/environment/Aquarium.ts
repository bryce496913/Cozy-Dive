import { substrateHeight } from './HabitatRegions';
import { PlantSystem } from './PlantSystem';
import type { HabitatInterest } from '../fish/FishHabitat';
import type { PlayerPresence } from '../fish/FishDiverReaction';
import * as THREE from 'three';
import { AQUARIUM } from '../config/world';
import { CollisionWorld, type ConvexCollider } from '../player/collision';
import { rockCollider } from './rockCollider';
import { createRockTemplates } from './RockGeometry';
import { FishSystem } from '../fish/FishSystem';

// Seeded scenery stays reproducible; no asset downloads or runtime randomness.
function randomSource(seed: number): () => number {
  return () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}
export class Aquarium {
  readonly root = new THREE.Group();
  readonly collision: CollisionWorld;
  readonly fish: FishSystem;
  readonly plants: PlantSystem;
  private readonly motes: THREE.Points;
  private readonly beams: THREE.Group;
  constructor() {
    const rand = randomSource(1729);
    const colliders: ConvexCollider[] = [];
    const interests: HabitatInterest[] = [];
    const sandGeometry = new THREE.PlaneGeometry(36, 28, 90, 70);
    sandGeometry.rotateX(-Math.PI / 2);
    const positions = sandGeometry.attributes.position;
    const colors = new Float32Array(positions.count * 3);
    const color = new THREE.Color();
    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i),
        z = positions.getZ(i);
      positions.setY(i, substrateHeight(x, z));
      color.setHSL(
        0.12,
        0.26,
        0.57 + 0.035 * Math.sin(x * 2.6 + z * 0.65) + rand() * 0.04,
      );
      color.toArray(colors, i * 3);
    }
    sandGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    sandGeometry.computeVertexNormals();
    const sand = new THREE.Mesh(
      sandGeometry,
      new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 }),
    );
    this.root.add(sand);

    const rockTemplates = createRockTemplates();
    let rockIndex = 0,
      pebbleIndex = 0;
    const rockMaterials = [0x71827b, 0x858575, 0x929083, 0x62777a].map(
      (c) =>
        new THREE.MeshStandardMaterial({
          color: c,
          roughness: 0.96,
          vertexColors: true,
          metalness: 0,
        }),
    );
    const rock = (x: number, z: number, size: number, solid = true): void => {
      const geometry = solid
        ? rockTemplates.major[rockIndex++ % rockTemplates.major.length]
        : rockTemplates.pebbles[pebbleIndex++ % rockTemplates.pebbles.length];
      const mesh = new THREE.Mesh(
        geometry,
        rockMaterials[Math.floor(rand() * rockMaterials.length)],
      );
      mesh.name = `Rock ${solid ? rockIndex : 34 + pebbleIndex}`;
      const height = size * (0.7 + rand() * 0.4);
      mesh.scale.set(size, height, size * (0.65 + rand() * 0.5));
      mesh.position.set(x, height * 0.61, z);
      mesh.rotation.set(rand() * 0.3, rand() * 6, rand() * 0.25);
      if (solid) {
        mesh.updateMatrix();
        colliders.push(rockCollider(geometry, mesh.matrix));
      }
      this.root.add(mesh);
    };
    // The central sand channel is open, with planted rocky banks on either side.
    for (let i = 0; i < 34; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      rock(side * (5.5 + rand() * 10), -11 + rand() * 19, 0.6 + rand() * 2.0);
    }
    for (let i = 0; i < 55; i++)
      rock(-17 + rand() * 34, -13 + rand() * 26, 0.08 + rand() * 0.24, false);
    this.collision = new CollisionWorld(colliders, AQUARIUM);

    this.plants = new PlantSystem(colliders);
    interests.push(...this.plants.interests);
    this.root.add(this.plants.root);
    // Keep the pre-vegetation-pass scenery RNG stream for existing suspended particles.
    // Each of the former 65 plants consumed 3 placement + 5 * 3 leaf samples.
    for (let i = 0; i < 65 * 18; i++) rand();

    // Glass perimeter: translucent panels and restrained structural seams.
    const glass = new THREE.MeshBasicMaterial({
      color: 0x6dccc2,
      transparent: true,
      opacity: 0.045,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    for (const x of [-18, 18]) {
      const panel = new THREE.Mesh(new THREE.PlaneGeometry(28, 14), glass);
      panel.rotation.y = Math.PI / 2;
      panel.position.set(x, 7, 0);
      this.root.add(panel);
    }
    for (const z of [-14, 14]) {
      const panel = new THREE.Mesh(new THREE.PlaneGeometry(36, 14), glass);
      panel.position.set(0, 7, z);
      this.root.add(panel);
    }
    const box = new THREE.BoxGeometry(36, 14, 28);
    const edges = new THREE.LineSegments(
      new THREE.EdgesGeometry(box),
      new THREE.LineBasicMaterial({
        color: 0x93c3b7,
        transparent: true,
        opacity: 0.3,
      }),
    );
    box.dispose();
    edges.position.y = 7;
    this.root.add(edges);
    const surface = new THREE.Mesh(
      new THREE.PlaneGeometry(36, 28, 1, 1),
      new THREE.MeshBasicMaterial({
        color: 0x96d5c2,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.15,
      }),
    );
    surface.rotation.x = Math.PI / 2;
    surface.position.y = AQUARIUM.max.y;
    this.root.add(surface);

    const dust = new Float32Array(210 * 3);
    for (let i = 0; i < 210; i++) {
      dust[i * 3] = -18 + rand() * 36;
      dust[i * 3 + 1] = rand() * 14;
      dust[i * 3 + 2] = -14 + rand() * 28;
    }
    const particles = new THREE.BufferGeometry();
    particles.setAttribute('position', new THREE.BufferAttribute(dust, 3));
    this.motes = new THREE.Points(
      particles,
      new THREE.PointsMaterial({
        color: 0xc2e9d6,
        size: 0.035,
        transparent: true,
        opacity: 0.32,
        depthWrite: false,
      }),
    );
    this.root.add(this.motes);
    this.beams = new THREE.Group();
    const beamMaterial = new THREE.MeshBasicMaterial({
      color: 0xc7efce,
      transparent: true,
      opacity: 0.025,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
    });
    for (let i = 0; i < 7; i++) {
      const beam = new THREE.Mesh(
        new THREE.CylinderGeometry(0.18, 1.4, 15, 12, 1, true),
        beamMaterial,
      );
      beam.position.set(-12 + i * 4, 7, -6 + (i % 3) * 3);
      beam.rotation.z = -0.23;
      this.beams.add(beam);
    }
    this.root.add(this.beams);
    for (const rock of colliders) {
      const x = (rock.min.x + rock.max.x) / 2,
        y = (rock.min.y + rock.max.y) / 2,
        z = (rock.min.z + rock.max.z) / 2;
      interests.push(
        {
          kind: 'rock-edge',
          position: { x: rock.min.x, y, z },
          normal: { x: -1, y: 0, z: 0 },
        },
        {
          kind: 'rock-edge',
          position: { x: rock.max.x, y, z },
          normal: { x: 1, y: 0, z: 0 },
        },
        {
          kind: 'rock-edge',
          position: { x, y: rock.max.y, z },
          normal: { x: 0, y: 1, z: 0 },
        },
      );
    }
    for (const z of [-8, -4, 0, 4, 8])
      interests.push({
        kind: 'open-water',
        position: { x: 0, y: 5, z },
        normal: { x: 0, y: 0, z: 0 },
      });
    this.fish = new FishSystem({
      bounds: AQUARIUM,
      rocks: colliders,
      interests,
    });
    this.root.add(this.fish.root);
  }
  update(
    time: number,
    reducedMotion: boolean,
    dt = 0,
    active = false,
    player?: PlayerPresence,
  ): void {
    this.fish.update(dt, active, reducedMotion, player);
    this.plants.update(dt, active, reducedMotion);
    this.motes.position.y = reducedMotion ? 0 : Math.sin(time * 0.15) * 0.18;
    this.beams.rotation.y = reducedMotion ? 0 : Math.sin(time * 0.12) * 0.015;
  }
  dispose(): void {
    this.fish.dispose();
    this.plants.dispose();
    const geometries = new Set<THREE.BufferGeometry>();
    const materials = new Set<THREE.Material>();
    this.root.traverse((object) => {
      if (
        object instanceof THREE.Mesh ||
        object instanceof THREE.Points ||
        object instanceof THREE.LineSegments
      ) {
        geometries.add(object.geometry);
        if (Array.isArray(object.material))
          object.material.forEach((m) => materials.add(m));
        else materials.add(object.material);
      }
    });
    geometries.forEach((g) => g.dispose());
    materials.forEach((m) => m.dispose());
    this.root.clear();
  }
}
