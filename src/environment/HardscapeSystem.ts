import { reefSurfaceHeight } from './MarineHabitat';
import * as THREE from 'three';
import { ConvexGeometry } from 'three/addons/geometries/ConvexGeometry.js';
import {
  mergeGeometries,
  mergeVertices,
} from 'three/addons/utils/BufferGeometryUtils.js';
import { rockCollider } from './rockCollider';
import { createRockGeometry } from './RockGeometry';
import { plantFootprintClear, substrateHeight } from './HabitatRegions';
import { insideRock, type HabitatInterest } from '../fish/FishHabitat';
import type { ConvexCollider } from '../player/collision';
/** Smooth a true convex surface; rendering and plane extraction keep exactly the same hull. */
function softHull(points: THREE.Vector3[]): THREE.BufferGeometry {
  const hull = new ConvexGeometry(points);
  hull.deleteAttribute('normal');
  const welded = mergeVertices(hull, 1e-6);
  hull.dispose();
  welded.computeVertexNormals();
  return welded;
}
export type HardscapeKind = 'branching' | 'rounded' | 'plate';
export interface HardscapeFormation {
  readonly kind: HardscapeKind;
  readonly role: 'stony-coral' | 'ornament';
  readonly position: THREE.Vector3;
  readonly colliders: readonly ConvexCollider[];
  readonly mesh: THREE.Mesh;
}
/** Attached stony reef colonies and separate aquarium ornaments, with exact structural convex surfaces. */
export class HardscapeSystem {
  readonly root = new THREE.Group();
  readonly formations: readonly HardscapeFormation[];
  readonly colliders: readonly ConvexCollider[];
  readonly interests: readonly HabitatInterest[];
  readonly geometries: readonly THREE.BufferGeometry[];
  readonly materials: readonly THREE.MeshStandardMaterial[];
  private disposed = false;
  private readonly tissueGeometry = new THREE.SphereGeometry(0.022, 6, 4);
  private readonly tissueMaterial = new THREE.MeshStandardMaterial({
    color: 0xd3b3ac,
    roughness: 0.88,
  });
  private readonly tissueMeshes: THREE.InstancedMesh[] = [];
  constructor(rocks: readonly ConvexCollider[], seed = 83471) {
    this.root.name = 'Reef corals and aquarium ornaments';
    let state = seed >>> 0;
    const random = (): number => {
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
      return state / 4294967296;
    };
    const formations: HardscapeFormation[] = [],
      all: ConvexCollider[] = [],
      geometries: THREE.BufferGeometry[] = [],
      interests: HabitatInterest[] = [];
    this.materials = [0xb58b7e, 0x9685a0, 0x9c9e8c]
      .map(
        (color) =>
          new THREE.MeshStandardMaterial({
            color,
            vertexColors: true,
            roughness: 0.95,
            metalness: 0,
          }),
      )
      .concat(this.tissueMaterial);
    for (const kind of ['branching', 'rounded', 'plate'] as const)
      for (let variant = 0; variant < 3; variant++) {
        const radius = kind === 'branching' ? 0.95 : 1.05;
        let x = 0,
          z = 0,
          placed = false,
          surface = 0;
        const living = variant < 2 && rocks.length > 0;
        for (let attempt = 0; attempt < 800; attempt++) {
          x = (random() < 0.5 ? -1 : 1) * (5 + random() * 10);
          z = -10 + random() * 20;
          if (living) {
            const support = rocks[Math.floor(random() * rocks.length)];
            x = (support.min.x + support.max.x) / 2;
            z = (support.min.z + support.max.z) / 2;
            const top = reefSurfaceHeight(support, x, z);
            if (
              top === undefined ||
              support.max.x - support.min.x < 1 ||
              support.max.z - support.min.z < 0.8
            )
              continue;
            surface = top;
          } else surface = substrateHeight(x, z);
          if (!plantFootprintClear(x, z, radius + 0.4)) continue;
          if (
            !living &&
            rocks.some((r) => insideRock({ x, y: 0.7, z }, radius + 0.45, r))
          )
            continue;
          if (
            formations.some(
              (f) =>
                Math.hypot(x - f.position.x, z - f.position.z) < 2 * radius + 1,
            )
          )
            continue;
          placed = true;
          break;
        }
        if (!placed) throw new Error('No safe ornamental hardscape placement.');
        const origin = new THREE.Vector3(x, surface - 0.025, z),
          parts: THREE.BufferGeometry[] = [],
          solids: ConvexCollider[] = [];
        const add = (
          g: THREE.BufferGeometry,
          position: THREE.Vector3,
          scale: THREE.Vector3,
          quaternion = new THREE.Quaternion(),
        ): void => {
          const matrix = new THREE.Matrix4().compose(
            position.clone().add(origin),
            quaternion,
            scale,
          );
          solids.push(rockCollider(g, matrix));
          g.applyMatrix4(
            new THREE.Matrix4().compose(position, quaternion, scale),
          );
          const colors = new Float32Array(g.attributes.position.count * 3),
            p = g.attributes.position;
          for (let i = 0; i < p.count; i++) {
            const light =
              0.85 +
              0.08 * Math.sin(p.getX(i) * 18 + p.getY(i) * 12) +
              0.06 * Math.cos(p.getZ(i) * 17) +
              (kind === 'plate'
                ? 0.035 * Math.sin(Math.hypot(p.getX(i), p.getZ(i)) * 65)
                : 0);
            colors.set([light, light * 0.98, light * 0.96], i * 3);
          }
          g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
          g.deleteAttribute('uv');
          parts.push(g.index ? g.toNonIndexed() : g);
          if (g.index) g.dispose();
        };
        if (kind === 'branching') {
          const segments = [
            [
              [0, 0, 0],
              [0.04, 1.25, 0],
            ],
            [
              [0, 0.45, 0],
              [-0.58, 1.3, 0.14],
            ],
            [
              [0.02, 0.7, 0],
              [0.58, 1.65, -0.15],
            ],
            [
              [-0.3, 0.95, 0.08],
              [-0.42, 1.75, 0.25],
            ],
            [
              [0.35, 1.25, -0.1],
              [0.65, 1.5, 0.3],
            ],
          ];
          for (const [a, b] of segments) {
            const start = new THREE.Vector3(...a),
              end = new THREE.Vector3(...b);
            end.x += (random() - 0.5) * 0.15;
            const control = start
              .clone()
              .lerp(end, 0.5)
              .add(
                new THREE.Vector3(
                  Math.sin(a[1] * 8 + variant) * 0.11,
                  0.03,
                  Math.cos(b[1] * 5 + variant) * 0.08,
                ),
              );
            const curve = new THREE.QuadraticBezierCurve3(start, control, end),
              points: THREE.Vector3[] = [];
            for (const t of [0, 0.33, 0.67, 1]) {
              const center = curve.getPoint(t),
                radius = 0.09 * (1 - t) + 0.045 * t,
                sphere = new THREE.IcosahedronGeometry(radius, 1),
                vertices = sphere.attributes.position;
              for (let i = 0; i < vertices.count; i++)
                points.push(
                  new THREE.Vector3(
                    vertices.getX(i),
                    vertices.getY(i),
                    vertices.getZ(i),
                  ).add(center),
                );
              sphere.dispose();
            }
            add(
              softHull(points),
              new THREE.Vector3(),
              new THREE.Vector3(1, 1, 1),
            );
          }
        } else if (kind === 'rounded') {
          for (let i = 0; i < 4; i++) {
            const angle = i * 2.4 + variant;
            add(
              createRockGeometry(seed + variant * 41 + i * 193, 0, 2),
              new THREE.Vector3(
                Math.cos(angle) * 0.35,
                0.35 + (i % 2) * 0.3,
                Math.sin(angle) * 0.35,
              ),
              new THREE.Vector3(
                0.4 + random() * 0.16,
                0.4 + random() * 0.24,
                0.42 + random() * 0.12,
              ),
            );
          }
        } else {
          add(
            new THREE.CylinderGeometry(0.1, 0.16, living ? 1.8 : 1, 9),
            new THREE.Vector3(0, living ? 0.85 : 0.45, 0),
            new THREE.Vector3(1, 1, 1),
          );
          for (let layer = 0; layer < 3; layer++) {
            const points: THREE.Vector3[] = [];
            for (let i = 0; i < 20; i++) {
              const angle = (i / 20) * Math.PI * 2,
                r = (0.84 - layer * 0.13) * (0.92 + random() * 0.13);
              for (const sign of [-1, 1])
                points.push(
                  new THREE.Vector3(
                    Math.cos(angle) * r,
                    sign * 0.055 + Math.sin(angle * 3 + variant) * 0.025,
                    Math.sin(angle) * r,
                  ),
                );
            }
            for (let i = 0; i < 20; i++) {
              const angle = (i / 20) * Math.PI * 2,
                r = (0.84 - layer * 0.13) * 0.5;
              points.push(
                new THREE.Vector3(
                  Math.cos(angle) * r,
                  0.12 + Math.sin(angle * 3 + variant) * 0.008,
                  Math.sin(angle) * r,
                ),
              );
            }
            points.push(new THREE.Vector3(0, 0.145, 0));
            add(
              softHull(points),
              new THREE.Vector3(
                Math.sin(layer * 2) * 0.15,
                (living ? 1.2 : 0.3) + layer * 0.3,
                0,
              ),
              new THREE.Vector3(1, 1, 1),
            );
          }
        }
        const geometry = mergeGeometries(parts, false)!;
        parts.forEach((g) => g.dispose());
        geometry.computeBoundingSphere();
        geometries.push(geometry);
        const mesh = new THREE.Mesh(geometry, this.materials[variant]);
        mesh.position.copy(origin);
        mesh.name = `${kind} ${living ? 'living stony coral' : 'aquarium ornament'} ${variant}`;
        if (living) {
          const p = geometry.attributes.position,
            n = geometry.attributes.normal,
            points: number[] = [];
          for (
            let index = 0;
            index < p.count;
            index += Math.max(3, Math.floor(p.count / 150))
          ) {
            if (n.getY(index) > 0.2 && p.getY(index) > 0.2) points.push(index);
            if (points.length === 48) break;
          }
          const polyps = new THREE.InstancedMesh(
              this.tissueGeometry,
              this.tissueMaterial,
              points.length,
            ),
            matrix = new THREE.Matrix4(),
            q = new THREE.Quaternion();
          points.forEach((index, i) => {
            const normal = new THREE.Vector3(
              n.getX(index),
              n.getY(index),
              n.getZ(index),
            ).normalize();
            q.setFromUnitVectors(new THREE.Vector3(0, 1, 0), normal);
            matrix.compose(
              new THREE.Vector3(
                p.getX(index),
                p.getY(index),
                p.getZ(index),
              ).addScaledVector(normal, 0.012),
              q,
              new THREE.Vector3(1, 0.4, 1),
            );
            polyps.setMatrixAt(i, matrix);
          });
          polyps.name = 'Living coral corallites (soft tissue)';
          polyps.computeBoundingSphere();
          mesh.add(polyps);
          this.tissueMeshes.push(polyps);
        }
        this.root.add(mesh);
        all.push(...solids);
        formations.push({
          kind,
          role: living ? 'stony-coral' : 'ornament',
          position: origin,
          colliders: solids,
          mesh,
        });
        const sign = -Math.sign(x);
        interests.push({
          kind: living ? 'coral-edge' : 'hardscape-edge',
          position: { x: x + sign * (radius + 0.1), y: origin.y + 0.7, z },
          normal: { x: sign, y: 0, z: 0 },
        });
      }
    this.formations = formations;
    this.colliders = all;
    this.geometries = [...geometries, this.tissueGeometry];
    this.interests = interests;
  }
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.root.removeFromParent();
    this.root.clear();
    this.tissueMeshes.forEach((m) => m.dispose());
    this.geometries.forEach((g) => g.dispose());
    this.materials.forEach((m) => m.dispose());
  }
}
