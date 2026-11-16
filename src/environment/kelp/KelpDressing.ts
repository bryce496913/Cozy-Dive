import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { KELP } from '../../config/passage';
import { createRockGeometry } from '../RockGeometry';
import type { Boulder } from './KelpEnvironment';
import { inGrottoClear, kelpFloor, laneWeight } from './KelpTerrain';

/**
 * v0.6 Pass 035: the small life of the kelp forest's rocks and floor, built in code: purple sea
 * urchins tucked in clusters at the boulders' feet, sea stars in orange, red and purple on the
 * rock faces and floor, green and strawberry-pink anemones on the boulders (their tentacles
 * stirring in the swell), and cobbles and shell grit over the seabed. One instanced draw per kind.
 * Owns its GPU resources.
 */
export const DRESSING = {
  seed: 35021,
  urchins: 340,
  stars: 170,
  anemones: 150,
  cobbles: 420,
  /** Anemone tentacles sway this far (radians) at this rate (per second). */
  sway: 0.18,
  swayRate: 0.7,
} as const;

function random(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}
/** Positions, normals and a flat vertex colour only, so parts merge. */
function solid(g: THREE.BufferGeometry, r: number, gr: number, b: number) {
  const out = g.index ? g.toNonIndexed() : g;
  if (out !== g) g.dispose();
  for (const name of Object.keys(out.attributes))
    if (name !== 'position' && name !== 'normal') out.deleteAttribute(name);
  const n = out.getAttribute('position').count,
    c = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    c[i * 3] = r;
    c[i * 3 + 1] = gr;
    c[i * 3 + 2] = b;
  }
  out.setAttribute('color', new THREE.Float32BufferAttribute(c, 3));
  return out;
}
function merge(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const m = mergeGeometries(parts, false);
  parts.forEach((g) => g.dispose());
  if (!m) throw Error('Kelp dressing could not be built');
  m.computeVertexNormals();
  return m;
}

/** A purple urchin: a dark test bristling with long spines (white tips catch the light). */
export function urchinGeometry(): THREE.BufferGeometry {
  const parts = [
      solid(new THREE.IcosahedronGeometry(0.06, 1), 0.2, 0.06, 0.22),
    ],
    dirs = new THREE.IcosahedronGeometry(1, 1).getAttribute('position'),
    up = new THREE.Vector3(0, 1, 0),
    d = new THREE.Vector3(),
    q = new THREE.Quaternion();
  for (let i = 0; i < dirs.count; i += 2) {
    d.set(dirs.getX(i), dirs.getY(i), dirs.getZ(i)).normalize();
    if (d.y < -0.4) continue;
    const spine = new THREE.ConeGeometry(0.008, 0.11, 3);
    spine.translate(0, 0.055 + 0.05, 0);
    q.setFromUnitVectors(up, d);
    spine.applyQuaternion(q);
    parts.push(solid(spine, 0.32, 0.12, 0.38));
  }
  const m = merge(parts);
  m.scale(1, 0.75, 1);
  return m;
}
/** A five-armed sea star lying flat, its arms tapering and slightly raised at the middle. */
export function starGeometry(): THREE.BufferGeometry {
  const shape = new THREE.Shape(),
    arms = 5;
  for (let i = 0; i <= arms * 2; i++) {
    const a = (i / (arms * 2)) * Math.PI * 2,
      r = i % 2 ? 0.035 : 0.11;
    if (i === 0) shape.moveTo(Math.cos(a) * r, Math.sin(a) * r);
    else shape.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  const g = new THREE.ExtrudeGeometry(shape, {
    depth: 0.018,
    bevelEnabled: true,
    bevelThickness: 0.01,
    bevelSize: 0.01,
    bevelSegments: 1,
  });
  g.rotateX(-Math.PI / 2);
  return merge([solid(g, 1, 1, 1)]);
}
/** An anemone: a short column and a crown of tentacles (tentacles are drawn by `anemoneCrown`). */
export function anemoneColumn(): THREE.BufferGeometry {
  const col = new THREE.CylinderGeometry(0.07, 0.09, 0.09, 12, 1, false);
  col.translate(0, 0.045, 0);
  const disc = new THREE.CircleGeometry(0.07, 12);
  disc.rotateX(-Math.PI / 2);
  disc.translate(0, 0.091, 0);
  return merge([solid(col, 0.8, 0.8, 0.8), solid(disc, 1, 1, 1)]);
}
/** The tentacle crown, pivoting at the column's top (origin). */
export function anemoneCrown(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [],
    q = new THREE.Quaternion(),
    up = new THREE.Vector3(0, 1, 0),
    d = new THREE.Vector3();
  for (let ring = 0; ring < 2; ring++)
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2 + ring * 0.2,
        lean = 0.5 + ring * 0.45,
        t = new THREE.ConeGeometry(0.011, 0.09 - ring * 0.02, 4);
      t.translate(0, 0.045, 0);
      d.set(
        Math.cos(a) * Math.sin(lean),
        Math.cos(lean),
        Math.sin(a) * Math.sin(lean),
      );
      q.setFromUnitVectors(up, d);
      t.applyQuaternion(q);
      t.translate(
        Math.cos(a) * (0.05 - ring * 0.02),
        0,
        Math.sin(a) * (0.05 - ring * 0.02),
      );
      parts.push(solid(t, 1, 1, 1));
    }
  return merge(parts);
}

interface Seat {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  /** Surface normal there (unit). */
  readonly nx: number;
  readonly ny: number;
  readonly nz: number;
}
/** A point on a boulder's upper surface (its rounded box, sunk a fifth into the sand). */
function onBoulder(b: Boulder, a: number, e: number): Seat {
  const rx = b.size * 0.46,
    ry = b.height * 0.5,
    cy = b.y + b.height * 0.2,
    ce = Math.cos(e),
    se = Math.sin(e),
    nx = (ce * Math.cos(a)) / rx,
    ny = se / ry,
    nz = (ce * Math.sin(a)) / rx,
    l = Math.hypot(nx, ny, nz);
  return {
    x: b.x + rx * ce * Math.cos(a),
    y: cy + ry * se,
    z: b.z + rx * ce * Math.sin(a),
    nx: nx / l,
    ny: ny / l,
    nz: nz / l,
  };
}

export class KelpDressing {
  readonly root = new THREE.Group();
  private readonly geometries: THREE.BufferGeometry[] = [];
  private readonly materials: THREE.Material[] = [];
  private readonly crowns: THREE.InstancedMesh;
  private readonly crownBase: THREE.Matrix4[] = [];
  private readonly sway = new THREE.Matrix4();
  private readonly scratch = new THREE.Matrix4();
  private time = 0;
  private disposed = false;

  constructor(boulders: readonly Boulder[]) {
    this.root.name = 'Kelp forest small life';
    const rand = random(DRESSING.seed),
      f = KELP.forest,
      m = new THREE.Matrix4(),
      q = new THREE.Quaternion(),
      up = new THREE.Vector3(0, 1, 0),
      n = new THREE.Vector3(),
      spin = new THREE.Quaternion(),
      s = new THREE.Vector3(),
      c = new THREE.Color(),
      material = this.own(
        new THREE.MeshStandardMaterial({
          name: 'Kelp small life',
          vertexColors: true,
          roughness: 0.75,
        }),
      );
    const place = (
      mesh: THREE.InstancedMesh,
      i: number,
      seat: Seat,
      size: number,
      sink = 0,
    ) => {
      n.set(seat.nx, seat.ny, seat.nz);
      q.setFromUnitVectors(up, n);
      spin.setFromAxisAngle(up, rand() * Math.PI * 2);
      q.multiply(spin);
      s.setScalar(size);
      m.compose(
        new THREE.Vector3(
          seat.x - seat.nx * sink,
          seat.y - seat.ny * sink,
          seat.z - seat.nz * sink,
        ),
        q,
        s,
      );
      mesh.setMatrixAt(i, m);
    };
    const floorSeat = (x: number, z: number): Seat => {
      const h = kelpFloor(x, z),
        dx = kelpFloor(x + 0.3, z) - h,
        dz = kelpFloor(x, z + 0.3) - h,
        l = Math.hypot(dx, 0.3, dz);
      return { x, y: h, z, nx: -dx / l, ny: 0.3 / l, nz: -dz / l };
    };
    const open = (x: number, z: number) =>
      Math.abs(x) < f.halfWidth &&
      z < f.maxZ &&
      z > f.minZ &&
      !inGrottoClear(x, z, 0.5) &&
      !(Math.abs(x) < 4 && z > KELP.tunnel.wallZ - 4);

    // Urchins: clusters at boulder feet, a few scattered on the open rock.
    const urchins = this.instanced(
      urchinGeometry(),
      material,
      DRESSING.urchins,
      'Sea urchins',
    );
    for (let i = 0; i < DRESSING.urchins; i++) {
      const b = boulders[Math.floor(rand() * boulders.length)],
        a = rand() * Math.PI * 2,
        r = b.size * (0.5 + rand() * 0.25),
        x = b.x + Math.cos(a) * r,
        z = b.z + Math.sin(a) * r,
        seat =
          rand() < 0.75 && open(x, z)
            ? floorSeat(x, z)
            : onBoulder(b, a, 0.05 + rand() * 0.4);
      place(urchins, i, seat, 1.1 + rand() * 0.8, 0.02);
      urchins.setColorAt(
        i,
        c.setRGB(0.85 + rand() * 0.3, 0.8 + rand() * 0.3, 0.85 + rand() * 0.3),
      );
    }
    // Sea stars: on boulder faces and the floor, in their bright colours.
    const palette = [
      [0.95, 0.45, 0.12],
      [0.85, 0.18, 0.12],
      [0.55, 0.22, 0.5],
      [0.95, 0.65, 0.2],
    ];
    const stars = this.instanced(
      starGeometry(),
      material,
      DRESSING.stars,
      'Sea stars',
    );
    for (let i = 0; i < DRESSING.stars; i++) {
      const b = boulders[Math.floor(rand() * boulders.length)],
        a = rand() * Math.PI * 2;
      let seat: Seat = onBoulder(b, a, 0.15 + rand() * 1.1);
      if (rand() < 0.35) {
        const x = b.x + Math.cos(a) * b.size * 0.8,
          z = b.z + Math.sin(a) * b.size * 0.8;
        if (open(x, z) && laneWeight(x, z) < 0.5) seat = floorSeat(x, z);
      }
      place(stars, i, seat, 1.3 + rand() * 0.9, 0.005);
      const p = palette[Math.floor(rand() * palette.length)];
      stars.setColorAt(i, c.setRGB(p[0], p[1], p[2]));
    }
    // Anemones: on the boulders' upper faces; green or strawberry pink.
    const columns = this.instanced(
      anemoneColumn(),
      material,
      DRESSING.anemones,
      'Anemone columns',
    );
    this.crowns = this.instanced(
      anemoneCrown(),
      material,
      DRESSING.anemones,
      'Anemone tentacles',
    );
    for (let i = 0; i < DRESSING.anemones; i++) {
      const b = boulders[Math.floor(rand() * boulders.length)],
        seat = onBoulder(b, rand() * Math.PI * 2, 0.5 + rand() * 0.9),
        size = 0.8 + rand() * 0.9;
      place(columns, i, seat, size, 0.01);
      columns.getMatrixAt(i, m);
      // The crown sits on the column's top and sways about it.
      const top = m
        .clone()
        .multiply(new THREE.Matrix4().makeTranslation(0, 0.09, 0));
      this.crownBase.push(top);
      this.crowns.setMatrixAt(i, top);
      const pink = rand() < 0.45;
      columns.setColorAt(
        i,
        pink ? c.setRGB(0.75, 0.3, 0.35) : c.setRGB(0.35, 0.5, 0.3),
      );
      this.crowns.setColorAt(
        i,
        pink ? c.setRGB(0.95, 0.45, 0.55) : c.setRGB(0.5, 0.8, 0.45),
      );
    }
    // Cobbles and shell grit over the floor, off the sandy lane's middle.
    const rock = createRockGeometry(35031, 1, 1);
    for (const name of Object.keys(rock.attributes))
      if (name !== 'position' && name !== 'normal' && name !== 'color')
        rock.deleteAttribute(name);
    rock.computeBoundingBox();
    const box = rock.boundingBox!,
      size = box.getSize(new THREE.Vector3());
    rock.translate(0, -box.min.y, 0);
    rock.scale(1 / size.x, 1 / size.y, 1 / size.z);
    const cobbles = this.instanced(
      rock,
      this.own(
        new THREE.MeshStandardMaterial({
          name: 'Kelp cobbles',
          color: 0x8a7a6c,
          vertexColors: true,
          roughness: 0.95,
        }),
      ),
      DRESSING.cobbles,
      'Cobbles',
    );
    let placed = 0;
    for (
      let tries = 0;
      placed < DRESSING.cobbles && tries < DRESSING.cobbles * 4;
      tries++
    ) {
      const x = -f.halfWidth + rand() * f.halfWidth * 2,
        z = f.minZ + rand() * (f.maxZ - f.minZ);
      if (!open(x, z) || laneWeight(x, z) > 0.6) continue;
      const w = 0.1 + rand() * 0.25;
      e.set(rand() * 0.4, rand() * Math.PI * 2, rand() * 0.4);
      q.setFromEuler(e);
      m.compose(
        new THREE.Vector3(x, kelpFloor(x, z) - w * 0.25, z),
        q,
        s.set(w, w * (0.4 + rand() * 0.3), w * (0.7 + rand() * 0.4)),
      );
      cobbles.setMatrixAt(placed++, m);
    }
    cobbles.count = placed;
    for (const mesh of [urchins, stars, columns, this.crowns]) {
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }
  }
  private own<T extends THREE.Material>(m: T): T {
    this.materials.push(m);
    return m;
  }
  private instanced(
    geometry: THREE.BufferGeometry,
    material: THREE.Material,
    count: number,
    name: string,
  ): THREE.InstancedMesh {
    this.geometries.push(geometry);
    const mesh = new THREE.InstancedMesh(geometry, material, count);
    mesh.name = name;
    this.root.add(mesh);
    return mesh;
  }
  /** Anemone tentacles stir in the swell, on simulation time only. */
  update(dt: number, active: boolean, reducedMotion: boolean): void {
    if (this.disposed || !active || reducedMotion || !(dt > 0)) return;
    this.time += Math.min(dt, 0.1);
    for (let i = 0; i < this.crownBase.length; i++) {
      const t = this.time * DRESSING.swayRate + i * 1.3;
      this.sway.makeRotationFromEuler(
        euler.set(
          DRESSING.sway * Math.sin(t),
          0,
          DRESSING.sway * Math.cos(t * 0.8),
        ),
      );
      this.scratch.multiplyMatrices(this.crownBase[i], this.sway);
      this.crowns.setMatrixAt(i, this.scratch);
    }
    this.crowns.instanceMatrix.needsUpdate = true;
  }
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.root.removeFromParent();
    for (const child of this.root.children)
      if (child instanceof THREE.InstancedMesh) child.dispose();
    this.root.clear();
    this.geometries.forEach((g) => g.dispose());
    this.materials.forEach((m) => m.dispose());
  }
}
const euler = new THREE.Euler();
const e = new THREE.Euler();
