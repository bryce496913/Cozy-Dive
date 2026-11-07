import * as THREE from 'three';
import { ConvexGeometry } from 'three/addons/geometries/ConvexGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { rockCollider } from '../rockCollider';
import type { ConvexCollider } from '../../player/collision';
export type OrnamentKind =
  'chest' | 'filter' | 'arch' | 'shipwreck' | 'log' | 'statue';
export interface OrnamentModel {
  kind: OrnamentKind;
  root: THREE.Group;
  solids: THREE.Mesh[];
  geometries: THREE.BufferGeometry[];
  hinge?: THREE.Group;
  lid?: THREE.Mesh;
}
/** Convex structural pieces supply both visible surfaces and exact collision planes. Details merge per material. */
export class OrnamentGeometry {
  readonly materials = [
    0x665044, 0xaaa18a, 0x8e8159, 0x343e3f, 0x586d4c, 0x343529,
  ].map((color) => new THREE.MeshStandardMaterial({ color, roughness: 0.93 }));
  create(kind: OrnamentKind): OrnamentModel {
    const root = new THREE.Group(),
      solids: THREE.Mesh[] = [],
      geometries: THREE.BufferGeometry[] = [];
    root.name = `Aquarium ornament: ${kind}`;
    const details: THREE.BufferGeometry[][] = this.materials.map(() => []);
    const piece = (
      g: THREE.BufferGeometry,
      color: number,
      x: number,
      y: number,
      z: number,
      rx = 0,
      ry = 0,
      rz = 0,
      solid = true,
    ): THREE.Mesh => {
      const mesh = new THREE.Mesh(g, this.materials[color]);
      mesh.position.set(x, y, z);
      mesh.rotation.set(rx, ry, rz);
      mesh.updateMatrix();
      if (solid) {
        root.add(mesh);
        solids.push(mesh);
        geometries.push(g);
      } else {
        g.applyMatrix4(mesh.matrix);
        details[color].push(g);
      }
      return mesh;
    };
    const box = (
      w: number,
      h: number,
      d: number,
      c: number,
      x: number,
      y: number,
      z: number,
      rx = 0,
      ry = 0,
      rz = 0,
      solid = true,
    ): THREE.Mesh =>
      piece(new THREE.BoxGeometry(w, h, d), c, x, y, z, rx, ry, rz, solid);
    let hinge: THREE.Group | undefined, lid: THREE.Mesh | undefined;
    if (kind === 'chest') {
      box(1.7, 0.16, 1.16, 0, 0, 0.1, 0);
      box(1.7, 0.65, 0.13, 0, 0, 0.46, -0.52);
      box(1.7, 0.65, 0.13, 0, 0, 0.46, 0.52);
      for (const x of [-0.79, 0.79]) box(0.13, 0.65, 1, 0, x, 0.46, 0);
      for (const x of [-0.57, 0.57]) {
        box(0.1, 0.68, 1.2, 2, x, 0.45, 0, 0, 0, 0, false);
      }
      box(0.22, 0.25, 0.1, 2, 0, 0.61, 0.64, 0, 0, 0, false);
      for (let x = -0.7; x < 0.8; x += 0.28)
        box(0.012, 0.52, 0.015, 5, x, 0.45, 0.593, 0, 0, 0, false);
      hinge = new THREE.Group();
      hinge.position.set(0, 0.82, -0.58);
      root.add(hinge);
      lid = new THREE.Mesh(
        new THREE.BoxGeometry(1.76, 0.13, 1.18),
        this.materials[0],
      );
      lid.position.set(0, 0.065, 0.59);
      hinge.add(lid);
      geometries.push(lid.geometry);
      for (const x of [-0.57, 0.57]) {
        const trim = new THREE.Mesh(
          new THREE.BoxGeometry(0.1, 0.145, 1.18),
          this.materials[2],
        );
        trim.position.set(x, 0.065, 0.59);
        hinge.add(trim);
        geometries.push(trim.geometry);
      }
    } else if (kind === 'filter') {
      box(0.85, 2.4, 0.7, 3, 0, 0, 0);
      box(1, 0.22, 0.85, 3, 0, 1.2, 0);
      for (let i = 0; i < 9; i++)
        box(0.66, 0.065, 0.03, 5, 0, -0.95 + i * 0.18, 0.365, 0, 0, 0, false);
      piece(
        new THREE.CylinderGeometry(0.13, 0.13, 0.7, 10),
        3,
        0,
        0.85,
        0.66,
        Math.PI / 2,
      );
      piece(
        new THREE.CylinderGeometry(0.09, 0.09, 1.2, 10),
        3,
        -0.3,
        1.65,
        -0.22,
      );
      for (const y of [-0.7, 0.7]) box(0.25, 0.25, 0.17, 3, 0, y, -0.5);
      for (const y of [-0.7, 0.7])
        piece(
          new THREE.CylinderGeometry(0.15, 0.15, 0.13, 10),
          3,
          0,
          y,
          -0.43,
          Math.PI / 2,
        );
    } else if (kind === 'arch') {
      // Open bottom half and broad center: never a hull across the passage.
      const count = 9,
        inner = 1.65,
        outer = 2.18;
      for (let i = 0; i < count; i++) {
        const a = (i * Math.PI) / count,
          b = ((i + 1) * Math.PI) / count;
        const pts: THREE.Vector3[] = [];
        for (const z of [-0.55, 0.55])
          for (const r of [inner, outer])
            for (const t of [a, b])
              pts.push(
                new THREE.Vector3(
                  Math.cos(t) * (r + 0.055 * Math.sin(3 * t + 0.4)),
                  1.05 + Math.sin(t) * (r + 0.055 * Math.sin(3 * t + 0.4)),
                  z + 0.025 * Math.sin(t * 4),
                ),
              );
        piece(new ConvexGeometry(pts), 1, 0, 0, 0);
      }
      box(0.55, 1.25, 1.14, 1, -1.93, 0.56, 0);
      box(0.55, 1.3, 1.13, 1, 1.93, 0.59, 0);
      for (let i = 0; i < 11; i++)
        box(
          0.018,
          0.13,
          0.025,
          5,
          Math.cos(i * 0.8) * 2.07,
          1.05 + Math.abs(Math.sin(i * 0.8)) * 2.02,
          0.568,
          0,
          0,
          i * 0.4,
          false,
        );
    } else if (kind === 'shipwreck') {
      // Open wreck hull: keel, separate sloping planks, ribs and broken cabin walls.
      box(1.75, 0.16, 3.75, 0, 0, 0.15, 0);
      for (const x of [-1, 1]) {
        for (let j = 0; j < 3; j++)
          box(
            0.15,
            0.22,
            3.6 - j * 0.08,
            0,
            x * (0.86 + j * 0.11),
            0.36 + j * 0.24,
            0,
            0,
            0,
            -x * 0.16,
          );
        for (const z of [-1.35, -0.35, 0.65, 1.45])
          box(0.18, 0.95, 0.14, 0, x * 1.06, 0.55, z, 0, 0, -x * 0.16);
      }
      for (const z of [-1.87, 1.87]) box(1.82, 0.62, 0.14, 0, 0, 0.4, z);
      box(0.18, 0.9, 1.15, 0, -0.68, 1.23, -0.88);
      box(0.18, 0.62, 1.15, 0, 0.68, 1.09, -0.88);
      box(1.5, 0.13, 1.22, 0, 0, 1.72, -0.88, 0, 0, 0.1);
      piece(
        new THREE.CylinderGeometry(0.055, 0.075, 2.4, 8),
        0,
        0.25,
        1.38,
        0.35,
        0,
        0,
        0.22,
      );
      box(1.3, 0.08, 0.09, 0, 0.0, 2.08, 0.35, 0, 0, 0.22);
      for (let i = 0; i < 5; i++)
        box(0.1, 0.035, 0.2, 4, -1.17, 0.77, -1.2 + i * 0.55, 0, 0, 0.2, false);
    } else if (kind === 'log') {
      // Twelve convex annular sectors preserve a genuine two-ended bore.
      const count = 12,
        inner = 1.02;
      for (let i = 0; i < count; i++) {
        const a = (i * 2 * Math.PI) / count,
          b = ((i + 1) * 2 * Math.PI) / count,
          pts: THREE.Vector3[] = [];
        for (const z of [-1.6, 0, 1.6])
          for (const r of [inner, 1.27 + (i % 3) * 0.035])
            for (const t of [a, b])
              pts.push(
                new THREE.Vector3(
                  Math.cos(t) * (r + 0.035 * Math.sin(3 * t + z)) +
                    z * z * 0.055,
                  1.28 +
                    Math.sin(t) * (r + 0.035 * Math.sin(3 * t + z)) +
                    0.04 * Math.sin(z * 1.5),
                  z + (z === 0 ? 0 : 0.13 * Math.sin(3 * t + 0.6)),
                ),
              );
        piece(new ConvexGeometry(pts), 0, 0, 0, 0);
        const t = (a + b) / 2;
        const grain = new THREE.CatmullRomCurve3(
          [-1.4, -0.7, 0, 0.7, 1.4].map(
            (z) =>
              new THREE.Vector3(
                Math.cos(t) * 1.31 + z * z * 0.055,
                1.28 + Math.sin(t) * 1.31 + 0.04 * Math.sin(z * 1.5),
                z,
              ),
          ),
        );
        piece(
          new THREE.TubeGeometry(grain, 6, 0.018, 4, false),
          5,
          0,
          0,
          0,
          0,
          0,
          0,
          false,
        );
      }
      piece(
        new THREE.CylinderGeometry(0.12, 0.22, 0.9, 8),
        0,
        1.33,
        1.65,
        -0.4,
        0,
        0,
        -1.05,
      );
      for (const z of [-0.8, 0.2, 0.8])
        box(0.18, 0.04, 0.2, 4, 0.2, 2.57, z, 0, 0, 0.1, false);
    } else {
      box(1.52, 0.25, 1.32, 1, 0, 0.14, 0);
      piece(new THREE.CylinderGeometry(0.72, 0.8, 2.7, 7), 1, 0, 1.6, 0);
      box(1.44, 0.48, 0.9, 1, 0, 3.02, 0.05, 0, 0, 0.025);
      box(1.34, 0.23, 0.4, 1, 0, 2.59, 0.49, 0, 0, -0.045);
      box(0.3, 0.88, 0.47, 1, 0.04, 2.05, 0.63, 0.06, 0, 0);
      box(0.72, 0.14, 0.19, 1, 0.02, 1.39, 0.73, 0, 0, -0.03);
      for (const x of [-0.4, 0.4])
        box(0.23, 0.075, 0.025, 5, x, 2.4, 0.75, 0, 0, 0, false);
      box(0.5, 0.04, 0.025, 5, 0, 1.52, 0.76, 0, 0, -0.03, false);
      for (const [x, y] of [
        [-0.62, 0.5],
        [0.68, 1],
        [0.3, 3.27],
      ])
        piece(
          new THREE.SphereGeometry(0.12, 7, 5),
          4,
          x,
          y,
          0.12,
          0,
          0,
          0,
          false,
        );
    }
    details.forEach((gs, c) => {
      if (!gs.length) return;
      const g = mergeGeometries(gs);
      gs.forEach((v) => v.dispose());
      if (g) {
        root.add(new THREE.Mesh(g, this.materials[c]));
        geometries.push(g);
      }
    });
    return { kind, root, solids, geometries, hinge, lid };
  }
}
export function modelColliders(model: OrnamentModel): ConvexCollider[] {
  model.root.updateMatrixWorld(true);
  return model.solids.map((mesh) =>
    rockCollider(mesh.geometry, mesh.matrixWorld),
  );
}
