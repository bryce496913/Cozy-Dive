import * as THREE from 'three';
import {
  surfaceHome,
  type SurfaceHome,
  type DiscoverySurfaceGroup,
  type DiscoveryClearance,
} from './DiscoveryHabitat';
import type { FishHabitat } from '../../fish/FishHabitat';
import { ellipsoid, mergeParts, tint, tube } from './DiscoveryGeometry';
export const NUDIBRANCH_VARIANTS = [
  {
    id: 'blue-orange-cerata',
    form: 'cerata',
    base: 0x547d9b,
    accent: 0xd7a06a,
    edge: 0xadc8c6,
  },
  {
    id: 'yellow-purple-dorid',
    form: 'dorid',
    base: 0xc9b76b,
    accent: 0x86759c,
    edge: 0x79658f,
  },
  {
    id: 'pale-edged-dorid',
    form: 'dorid',
    base: 0xc6c6af,
    accent: 0x7e9fa4,
    edge: 0x536f89,
  },
  {
    id: 'orange-white-cerata',
    form: 'cerata',
    base: 0xd2976b,
    accent: 0xdad4bb,
    edge: 0xe0d9c2,
  },
  {
    id: 'violet-dorid',
    form: 'dorid',
    base: 0x8d8da8,
    accent: 0xbcb6c5,
    edge: 0x677e9a,
  },
] as const;
export interface Nudibranch {
  readonly id: string;
  readonly variant: (typeof NUDIBRANCH_VARIANTS)[number];
  readonly home: SurfaceHome;
  readonly pose: THREE.Object3D;
  readonly phase: number;
}
function role(g: THREE.BufferGeometry, value: number): THREE.BufferGeometry {
  const p = g.attributes.position,
    roles = new Float32Array(p.count),
    flex = new Float32Array(p.count);
  for (let i = 0; i < p.count; i++) {
    roles[i] = value === 1 && Math.abs(p.getX(i)) > 0.066 ? 2 : value;
    flex[i] = Math.min(1, Math.max(0, p.getY(i) / 0.25)) ** 2;
  }
  g.setAttribute('nudiRole', new THREE.BufferAttribute(roles, 1));
  g.setAttribute('nudiFlex', new THREE.BufferAttribute(flex, 1));
  return tint(g, 0xffffff);
}
function bodyGeometry(): THREE.BufferGeometry {
  const foot = ellipsoid(0, 0.022, 0, 0.063, 0.034, 0.17, 0xffffff),
    p = foot.attributes.position;
  for (let i = 0; i < p.count; i++) p.setY(i, Math.max(0, p.getY(i)));
  foot.computeVertexNormals();
  return mergeParts([
    role(foot, 0),
    role(ellipsoid(0, 0.061, 0, 0.084, 0.035, 0.18, 0xffffff), 1),
  ]);
}
function appendages(form: 'cerata' | 'dorid'): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  for (const side of [-1, 1]) {
    parts.push(
      role(
        tube(
          [
            new THREE.Vector3(side * 0.029, 0.07, 0.105),
            new THREE.Vector3(side * 0.035, 0.145, 0.118),
            new THREE.Vector3(side * 0.039, 0.17, 0.126),
          ],
          0.008,
          0xffffff,
          6,
        ),
        3,
      ),
    );
    for (let j = 0; j < 4; j++) {
      const ring = new THREE.TorusGeometry(0.01, 0.0025, 4, 7);
      ring.rotateX(Math.PI / 2);
      ring.translate(side * 0.036, 0.139 + j * 0.008, 0.12 + j * 0.002);
      parts.push(role(ring, 3));
    }
  }
  if (form === 'cerata')
    for (let row = 0; row < 5; row++)
      for (const side of [-1, 1]) {
        const z = -0.11 + row * 0.04,
          x = side * 0.035,
          curve = new THREE.CatmullRomCurve3([
            new THREE.Vector3(x, 0.08, z),
            new THREE.Vector3(side * 0.07, 0.15, z - 0.02),
            new THREE.Vector3(side * 0.08, 0.2 + (row % 2) * 0.02, z - 0.035),
          ]),
          g = new THREE.TubeGeometry(curve, 6, 0.012, 5, false),
          p = g.attributes.position;
        for (let i = 0; i <= 6; i++) {
          const c = curve.getPoint(i / 6),
            scale = 1 - (i / 6) * 0.78;
          for (let j = 0; j <= 5; j++) {
            const k = i * 6 + j;
            p.setXYZ(
              k,
              c.x + (p.getX(k) - c.x) * scale,
              c.y + (p.getY(k) - c.y) * scale,
              c.z + (p.getZ(k) - c.z) * scale,
            );
          }
        }
        g.computeVertexNormals();
        parts.push(role(g, 4));
      }
  else
    for (let i = 0; i < 6; i++) {
      const angle = (i * Math.PI) / 3,
        base = new THREE.Vector3(0, 0.084, -0.075),
        tip = new THREE.Vector3(
          Math.cos(angle) * 0.048,
          0.172 + (i % 2) * 0.02,
          -0.075 + Math.sin(angle) * 0.048,
        );
      parts.push(role(tube([base, tip], 0.006, 0xffffff, 4), 4));
      for (let j = 1; j < 4; j++)
        for (const sign of [-1, 1]) {
          const p = base.clone().lerp(tip, j / 4),
            q = p
              .clone()
              .add(
                new THREE.Vector3(
                  Math.cos(angle + sign) * 0.022,
                  0.018,
                  Math.sin(angle + sign) * 0.022,
                ),
              );
          parts.push(role(tube([p, q], 0.0035, 0xffffff, 3), 4));
        }
    }
  return mergeParts(parts);
}
/** Five shared-body instances and two appendage batches: three draws for all five animals. */
export class Nudibranchs {
  readonly root = new THREE.Group();
  readonly animals: readonly Nudibranch[];
  readonly material = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.76,
  });
  readonly geometries: readonly THREE.BufferGeometry[];
  readonly meshes: readonly THREE.InstancedMesh[];
  readonly timeUniform = { value: 0 };
  private readonly matrix = new THREE.Matrix4();
  private readonly point = new THREE.Vector3();
  private disposed = false;
  constructor(
    h: FishHabitat,
    groups: readonly DiscoverySurfaceGroup[],
    occupied: readonly DiscoveryClearance[],
  ) {
    this.root.name = 'Five surface-bound nudibranchs';
    const body = bodyGeometry(),
      cerata = appendages('cerata'),
      dorid = appendages('dorid');
    this.geometries = [body, cerata, dorid];
    this.geometries.forEach((g) => {
      g.boundingSphere!.radius += 0.005;
      g.boundingBox!.expandByScalar(0.005);
    });
    const preference = ['log', 'statue', 'shipwreck', 'coral-plate', 'reef'];
    const used = [...occupied],
      animals: Nudibranch[] = [];
    for (let i = 0; i < 5; i++) {
      const preferred = groups.filter((g) => g.id.startsWith(preference[i])),
        rest = groups.filter((g) => !g.id.startsWith(preference[i]));
      let home: SurfaceHome;
      try {
        home = surfaceHome(
          `nudibranch-${i + 1}`,
          [...preferred, ...rest],
          h,
          0.285,
          0.285,
          0.26,
          used,
        );
      } catch (error) {
        this.geometries.forEach((g) => g.dispose());
        this.material.dispose();
        throw error;
      }
      used.push(
        new THREE.Vector3(home.position.x, home.position.y, home.position.z),
      );
      animals.push({
        id: `nudibranch-${i + 1}`,
        variant: NUDIBRANCH_VARIANTS[i],
        home,
        pose: new THREE.Object3D(),
        phase: i * 1.73,
      });
    }
    this.animals = animals;
    const meshFor = (
      g: THREE.BufferGeometry,
      animals: readonly Nudibranch[],
    ) => {
      const mesh = new THREE.InstancedMesh(g, this.material, animals.length);
      for (const [name, key] of [
        ['nudiBase', 'base'],
        ['nudiAccent', 'accent'],
        ['nudiEdge', 'edge'],
      ] as const) {
        const colors = new Float32Array(animals.length * 3);
        animals.forEach((a, i) =>
          new THREE.Color(a.variant[key]).toArray(colors, i * 3),
        );
        g.setAttribute(name, new THREE.InstancedBufferAttribute(colors, 3));
      }
      g.setAttribute(
        'nudiPhase',
        new THREE.InstancedBufferAttribute(
          new Float32Array(animals.map((a) => a.phase)),
          1,
        ),
      );
      this.root.add(mesh);
      return mesh;
    };
    this.meshes = [
      meshFor(body, animals),
      meshFor(
        cerata,
        animals.filter((a) => a.variant.form === 'cerata'),
      ),
      meshFor(
        dorid,
        animals.filter((a) => a.variant.form === 'dorid'),
      ),
    ];
    this.material.onBeforeCompile = (shader) => {
      shader.uniforms.nudiTime = this.timeUniform;
      shader.vertexShader = shader.vertexShader
        .replace(
          '#include <common>',
          `#include <common>
      uniform float nudiTime;attribute float nudiRole;attribute float nudiFlex;attribute float nudiPhase;
      attribute vec3 nudiBase;attribute vec3 nudiAccent;attribute vec3 nudiEdge;`,
        )
        .replace(
          '#include <color_vertex>',
          `#include <color_vertex>
      vColor.rgb*=nudiRole<.5?nudiBase*.8:nudiRole<1.5?nudiBase:nudiRole<2.5?nudiEdge:nudiAccent;`,
        )
        .replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>
      transformed.y+=sin(nudiTime*.7+position.z*19.+nudiPhase)*.003*nudiFlex;
      transformed.x+=cos(nudiTime*.55+position.z*11.+nudiPhase)*.002*nudiFlex;`,
        );
    };
    this.material.customProgramCacheKey = () => 'nudibranch-palette-ripple-v2';
    this.pose(0);
  }
  pose(time: number): void {
    if (this.disposed) return;
    this.timeUniform.value = time;
    for (const a of this.animals) {
      const t = time * 0.012 + a.phase,
        x = 0.055 * Math.cos(t),
        z = 0.075 * Math.sin(t),
        yaw = Math.atan2(-0.055 * Math.sin(t), 0.075 * Math.cos(t));
      this.point.set(x, 0, z).applyQuaternion(a.home.rotation);
      a.pose.position.set(
        a.home.position.x + this.point.x,
        a.home.position.y + this.point.y,
        a.home.position.z + this.point.z,
      );
      a.pose.quaternion.copy(a.home.rotation);
      a.pose.rotateY(yaw);
      a.pose.updateMatrix();
    }
    for (let i = 0; i < this.meshes.length; i++) {
      const mesh = this.meshes[i];
      let index = 0;
      for (const a of this.animals)
        if (
          i === 0 ||
          (i === 1 && a.variant.form === 'cerata') ||
          (i === 2 && a.variant.form === 'dorid')
        ) {
          this.matrix.copy(a.pose.matrix);
          mesh.setMatrixAt(index++, this.matrix);
        }
      mesh.instanceMatrix.needsUpdate = true;
      mesh.computeBoundingSphere();
    }
  }
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.root.removeFromParent();
    this.root.clear();
    this.meshes?.forEach((m) => m.dispose());
    this.geometries.forEach((g) => g.dispose());
    this.material.dispose();
  }
}
