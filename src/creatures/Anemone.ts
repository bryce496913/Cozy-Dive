import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { PlantClock } from '../environment/PlantAnimation';
import { reefSurfaceHeight } from '../environment/MarineHabitat';
import {
  insideRock,
  safeFishPosition,
  clearFishRoute,
  type FishHabitat,
} from '../fish/FishHabitat';
import type { ConvexCollider } from '../player/collision';
import type { PlantPlacement } from '../environment/HabitatRegions';
import type { CreatureAnchor } from './CreatureAnchor';
import type { Vec3 } from '../config/world';

export const ANEMONE = {
  tentacles: 72,
  envelopeRadius: 0.95,
  envelopeHeight: 1.04,
  maxBend: 0.14,
  homeRadius: 3,
};
/** One merged static mesh; neighboring tentacles bend on the GPU, never via a traversal loop. */
export class Anemone {
  readonly root = new THREE.Group();
  readonly geometry: THREE.BufferGeometry;
  readonly material: THREE.MeshStandardMaterial;
  readonly mesh: THREE.Mesh;
  readonly clock = new PlantClock();
  readonly timeUniform = { value: 0 };
  readonly host: CreatureAnchor;
  readonly escapeDirections: readonly Readonly<Vec3>[];
  readonly openWater: Readonly<Vec3>;
  readonly attachmentNormal: Readonly<Vec3>;
  private disposed = false;
  constructor(
    h: FishHabitat,
    supports: readonly ConvexCollider[],
    plants: readonly PlantPlacement[],
  ) {
    this.root.name = 'Living host sea anemone';
    const parts: THREE.BufferGeometry[] = [];
    const add = (
      g: THREE.BufferGeometry,
      flexible = false,
      phase = 0,
    ): void => {
      const p = g.attributes.position,
        colors = new Float32Array(p.count * 3),
        motion = new Float32Array(p.count * 2),
        c = new THREE.Color();
      for (let i = 0; i < p.count; i++) {
        const tip = Math.max(0, Math.min(1, (p.getY(i) - 0.27) / 0.7));
        c.setRGB(0.63 + tip * 0.17, 0.43 + tip * 0.2, 0.39 + tip * 0.17);
        c.toArray(colors, i * 3);
        motion[i * 2] = flexible ? tip * tip : 0;
        motion[i * 2 + 1] = phase;
      }
      g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
      g.setAttribute('anemoneMotion', new THREE.BufferAttribute(motion, 2));
      g.deleteAttribute('uv');
      parts.push(g.index ? g.toNonIndexed() : g);
      if (g.index) g.dispose();
    };
    const foot = new THREE.SphereGeometry(0.29, 20, 10);
    foot.scale(1, 0.45, 1);
    foot.translate(0, 0.1305, 0);
    add(foot);
    const crown = new THREE.SphereGeometry(0.54, 24, 10);
    crown.scale(1, 0.16, 1);
    crown.translate(0, 0.26, 0);
    add(crown);
    for (let i = 0; i < ANEMONE.tentacles; i++) {
      const a = i * 2.3999632297,
        r = 0.12 + 0.43 * Math.sqrt((i + 0.5) / ANEMONE.tentacles),
        length = 0.42 + (i % 7) * 0.047;
      const points = [0, 0.33, 0.66, 1].map(
        (t) =>
          new THREE.Vector3(
            Math.cos(a) * (r + 0.16 * Math.sin((t * Math.PI) / 2)),
            0.27 + length * t,
            Math.sin(a) * (r + 0.16 * Math.sin((t * Math.PI) / 2)),
          ),
      );
      const curve = new THREE.CatmullRomCurve3(points),
        g = new THREE.TubeGeometry(curve, 9, 0.023 + (i % 3) * 0.003, 6, false);
      add(g, true, a + i * 0.17);
      const tip = new THREE.SphereGeometry(0.027 + (i % 3) * 0.003, 6, 5);
      tip.translate(points[3].x, points[3].y, points[3].z);
      add(tip, true, a + i * 0.17);
    }
    this.geometry = mergeGeometries(parts)!;
    parts.forEach((g) => g.dispose());
    this.geometry.computeBoundingBox();
    this.geometry.boundingBox!.expandByScalar(ANEMONE.maxBend);
    this.geometry.computeBoundingSphere();
    this.geometry.boundingSphere!.radius += ANEMONE.maxBend;
    this.material = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.7,
    });
    this.material.onBeforeCompile = (shader) => {
      shader.uniforms.anemoneTime = this.timeUniform;
      shader.vertexShader = shader.vertexShader
        .replace(
          '#include <common>',
          '#include <common>\nuniform float anemoneTime;\nattribute vec2 anemoneMotion;',
        )
        .replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>
        transformed.x+=sin(anemoneTime*.62+anemoneMotion.y+position.y*2.)*.11*anemoneMotion.x;
        transformed.z+=cos(anemoneTime*.51+anemoneMotion.y*1.13)*.08*anemoneMotion.x;`,
        );
    };
    this.material.customProgramCacheKey = () => 'anemone-current-v1';
    this.mesh = new THREE.Mesh(this.geometry, this.material);
    this.root.add(this.mesh);
    const probe = new THREE.Vector3(),
      rotation = new THREE.Quaternion(),
      matrix = new THREE.Matrix4(),
      normal = new THREE.Vector3();
    const candidates = supports
      .map((rock) => ({
        rock,
        x: (rock.min.x + rock.max.x) / 2,
        z: (rock.min.z + rock.max.z) / 2,
      }))
      .sort(
        (a, b) =>
          (a.x + 7) ** 2 + (a.z - 3) ** 2 - ((b.x + 7) ** 2 + (b.z - 3) ** 2),
      );
    let placed = false;
    for (const c of candidates) {
      const top = reefSurfaceHeight(c.rock, c.x, c.z);
      if (top === undefined || Math.abs(c.x) > 14 || top < 0.7 || top > 6)
        continue;
      const face = c.rock.planes.find(
        (p) =>
          p.y > 0.7 &&
          Math.abs(p.x * c.x + p.y * top + p.z * c.z - p.offset) < 1e-5,
      );
      if (!face) continue;
      normal.set(face.x, face.y, face.z);
      rotation.setFromUnitVectors(new THREE.Vector3(0, 1, 0), normal);
      const position = new THREE.Vector3(c.x, top, c.z).addScaledVector(
        normal,
        0.018,
      );
      if (
        plants.some(
          (p) =>
            Math.hypot(
              p.position.x - position.x,
              p.position.y + p.height * 0.4 - position.y - 0.5,
              p.position.z - position.z,
            ) <
            p.radius + 0.85,
        )
      )
        continue;
      matrix.compose(position, rotation, new THREE.Vector3(1, 1, 1));
      let safe = true;
      const v = this.geometry.attributes.position,
        m = this.geometry.attributes.anemoneMotion;
      for (let i = 0; i < v.count && safe; i++) {
        probe.fromBufferAttribute(v, i).applyMatrix4(matrix);
        if (
          h.rocks.some((rock) =>
            insideRock(probe, m.getX(i) * ANEMONE.maxBend + 0.006, rock),
          )
        )
          safe = false;
      }
      if (!safe) continue;
      const center = position.clone().addScaledVector(normal, 1.18);
      if (!safeFishPosition(center, 0.65, h)) continue;
      const offsets = [
        [-0.75, 0.15, 0],
        [0.75, 0.15, 0],
        [0, 0.3, 0.75],
        [0, 0.3, -0.75],
      ];
      if (
        !offsets.every(([x, y, z]) =>
          clearFishRoute(
            center,
            { x: center.x + x, y: center.y + y, z: center.z + z },
            0.5,
            h,
          ),
        )
      )
        continue;
      this.root.position.copy(position);
      this.root.quaternion.copy(rotation);
      placed = true;
      break;
    }
    if (!placed) {
      this.dispose();
      throw new Error('No safe real reef surface for host anemone.');
    }
    this.root.updateMatrixWorld(true);
    const center = new THREE.Vector3(0, 1.18, 0).applyMatrix4(
      this.root.matrixWorld,
    );
    this.attachmentNormal = { x: normal.x, y: normal.y, z: normal.z };
    this.host = {
      id: 'anemone-host',
      position: { x: center.x, y: center.y, z: center.z },
      orientation: { x: normal.x, y: normal.y, z: normal.z },
      homeRadius: ANEMONE.homeRadius,
      habitatKind: 'coral-edge',
    };
    this.openWater = { x: center.x, y: center.y + 0.5, z: center.z };
    this.escapeDirections = [
      { x: 0, y: 1, z: 0 },
      { x: 1, y: 0.2, z: 0 },
      { x: -1, y: 0.2, z: 0 },
      { x: 0, y: 0.2, z: 1 },
      { x: 0, y: 0.2, z: -1 },
    ]
      .filter((d) =>
        clearFishRoute(
          center,
          { x: center.x + d.x, y: center.y + d.y, z: center.z + d.z },
          0.5,
          h,
        ),
      )
      .map((d) => {
        const l = Math.hypot(d.x, d.y, d.z);
        return { x: d.x / l, y: d.y / l, z: d.z / l };
      });
  }
  update(dt: number, active: boolean, reduced: boolean): void {
    if (this.disposed) return;
    this.clock.update(dt, active, reduced);
    this.timeUniform.value = this.clock.time;
  }
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.root.removeFromParent();
    this.root.clear();
    this.geometry?.dispose();
    this.material?.dispose();
  }
}
