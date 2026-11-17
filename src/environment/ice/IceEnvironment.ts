import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { ICE, ICE_FRAME } from '../../config/passage';
import type { ConvexCollider } from '../../player/collision';
import { boxCollider } from '../passage/Crevice';
import { rockShape } from '../RockGeometry';
import {
  rockTubeColliders,
  rockTubeGeometry,
  type Tube,
} from '../shared/RockTube';
import { iceFloor } from './IceTerrain';

/**
 * v0.6 Pass 046: the waters under the ice, built in code. A tunnel through a dark rock wall opens
 * into a tank the size of the kelp forest: icebergs, faceted and blue-white, crowd its sides and
 * far end from the seabed up through the sea ice; the ice above is a lumpy pale sheet hung with
 * smaller chunks, broken by three breathing holes where daylight shows and falls in soft shafts to
 * a seabed of grey gravel and silt. Everything solid has colliders; the soft limits keep the
 * swimmer a little short of it. One draw per material (ice, rock, seabed, light). Owns its GPU
 * resources.
 */
export const ICE_LAYOUT = {
  seed: 46001,
  /** Ice chunks hanging under the sheet, and dropstones on the seabed. */
  hanging: 46,
  stones: 28,
  /** The tunnel's duct (as the cave's). */
  duct: 1.22,
  wall: 0.6,
} as const;

function random(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}
/** A unit-sized lump (1 m box, centred), positions, normals and colours, non-indexed. */
function lump(
  seed: number,
  family: number,
  detail: number,
): THREE.BufferGeometry {
  const g = rockShape(seed, family, detail);
  for (const name of Object.keys(g.attributes))
    if (name !== 'position' && name !== 'normal' && name !== 'color')
      g.deleteAttribute(name);
  g.computeBoundingBox();
  const b = g.boundingBox!,
    size = b.getSize(new THREE.Vector3()),
    c = b.getCenter(new THREE.Vector3());
  g.translate(-c.x, -c.y, -c.z);
  g.scale(1 / size.x, 1 / size.y, 1 / size.z);
  const out = g.index ? g.toNonIndexed() : g;
  if (out !== g) g.dispose();
  if (!out.getAttribute('color'))
    out.setAttribute(
      'color',
      new THREE.Float32BufferAttribute(
        new Float32Array(out.getAttribute('position').count * 3).fill(1),
        3,
      ),
    );
  return out;
}
/** Paint a geometry's vertices ice-blue to white, by height and a little noise. */
function iceColours(g: THREE.BufferGeometry, deep = 0.5): void {
  const p = g.getAttribute('position'),
    c = g.getAttribute('color');
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i),
      y = p.getY(i),
      z = p.getZ(i),
      n = 0.5 + 0.5 * Math.sin(x * 1.3 + y * 0.7) * Math.sin(z * 1.1 - y * 0.5),
      blue = deep * (0.35 + 0.65 * n);
    c.setXYZ(i, 0.86 - 0.32 * blue, 0.93 - 0.18 * blue, 0.98 - 0.04 * blue);
  }
  c.needsUpdate = true;
}

export class IceEnvironment {
  readonly root = new THREE.Group();
  readonly colliders: ConvexCollider[] = [];
  /** Dropstones on the seabed (x, z, size), for the garden to settle round. */
  readonly stones: { x: number; y: number; z: number; size: number }[] = [];
  private readonly geometries: THREE.BufferGeometry[] = [];
  private readonly materials: THREE.Material[] = [];
  private readonly shafts: THREE.MeshBasicMaterial;
  private time = 0;
  private disposed = false;

  constructor() {
    this.root.name = 'Under the ice';
    const rand = random(ICE_LAYOUT.seed),
      w = ICE.walls,
      t = ICE.tunnel,
      top = ICE.ceiling;
    const ice = this.own(
      new THREE.MeshStandardMaterial({
        name: 'Ice',
        vertexColors: true,
        roughness: 0.22,
        metalness: 0.02,
        flatShading: true,
        emissive: 0x0f3550,
        emissiveIntensity: 0.55,
      }),
    );
    const rock = this.own(
      new THREE.MeshStandardMaterial({
        name: 'Ice rock',
        vertexColors: true,
        roughness: 0.9,
      }),
    );
    const seabed = this.own(
      new THREE.MeshStandardMaterial({
        name: 'Ice seabed',
        vertexColors: true,
        roughness: 0.95,
      }),
    );
    this.shafts = this.own(
      new THREE.MeshBasicMaterial({
        name: 'Ice light',
        color: 0xd6efff,
        transparent: true,
        opacity: 0.11,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
      }),
    );
    const sky = this.own(
      new THREE.MeshBasicMaterial({
        name: 'Ice daylight',
        color: 0xeaf7ff,
        fog: false,
      }),
    );

    // The seabed.
    const bed = new THREE.PlaneGeometry(60, 74, 150, 180);
    bed.rotateX(-Math.PI / 2);
    bed.translate(0, 0, -33);
    const bp = bed.getAttribute('position'),
      bc: number[] = [];
    for (let i = 0; i < bp.count; i++) {
      const x = bp.getX(i),
        z = bp.getZ(i);
      bp.setY(i, iceFloor(x, z));
      const silt =
          0.5 +
          0.5 * Math.sin(x * 0.4 + Math.sin(z * 0.3) * 2) * Math.sin(z * 0.35),
        speck =
          0.06 * Math.sin(x * 7.1 + z * 3.3) * Math.sin(x * 2.3 - z * 5.9),
        k = 0.4 + 0.12 * silt + speck,
        lit = ICE.holes.reduce(
          (m, h) =>
            Math.max(
              m,
              1 - Math.min(1, Math.hypot(x - h.x, z - h.z) / (h.r * 3)),
            ),
          0,
        );
      bc.push(
        k * (0.92 + 0.15 * lit),
        k * (0.93 + 0.15 * lit),
        k * (0.95 + 0.2 * lit),
      );
    }
    bed.setAttribute('color', new THREE.Float32BufferAttribute(bc, 3));
    bed.computeVertexNormals();
    this.add(bed, seabed, 'Ice seabed');

    // The rock wall at the near end, with the tunnel's hole through it.
    const wall = new THREE.PlaneGeometry(60, top + 6, 120, 44);
    wall.translate(0, (top + 6) / 2 - 2, t.wallZ);
    const wp = wall.getAttribute('position'),
      wc: number[] = [];
    for (let i = 0; i < wp.count; i++) {
      const x = wp.getX(i),
        y = wp.getY(i),
        r = Math.hypot(x, y - t.y),
        // Bulging rock, smoothed into a clean round mouth at the hole.
        bulge =
          0.6 * Math.sin(x * 0.7 + y * 0.4) * Math.sin(y * 0.9 - x * 0.3) +
          0.25 * Math.sin(x * 2.1 + y * 1.7),
        k = Math.min(1, Math.max(0, (r - t.radius - 0.2) / 1.2));
      wp.setZ(i, t.wallZ - bulge * k - 0.4 * k);
      const tone =
        0.2 +
        0.06 * Math.sin(x * 1.3 + y * 2.1) +
        0.08 * Math.max(0, Math.sin(y * 0.5 + x * 0.2));
      wc.push(tone, tone * 0.98, tone * 1.02);
    }
    wall.setAttribute('color', new THREE.Float32BufferAttribute(wc, 3));
    const wi = wall.getIndex()!,
      kept: number[] = [];
    for (let f = 0; f < wi.count; f += 3) {
      let cx = 0,
        cy = 0;
      for (let k = 0; k < 3; k++) {
        cx += wp.getX(wi.getX(f + k)) / 3;
        cy += wp.getY(wi.getX(f + k)) / 3;
      }
      if (Math.hypot(cx, cy - t.y) > t.radius + 0.1)
        kept.push(wi.getX(f), wi.getX(f + 1), wi.getX(f + 2));
    }
    wall.setIndex(kept);
    wall.computeVertexNormals();
    this.add(wall, rock, 'Ice rock wall');

    // The tunnel, from its capped start to the wall.
    const tube: Tube = {
      x: 0,
      y: t.y,
      radius: t.radius,
      from: t.startZ + 0.2,
      to: t.wallZ - 0.3,
      dark: ICE_FRAME.origin.z,
    };
    this.add(rockTubeGeometry(tube), rock, 'Ice tunnel');
    const cap = new THREE.CircleGeometry(t.radius + 0.3, 24);
    cap.translate(0, t.y, t.startZ + 0.2);
    cap.setAttribute(
      'color',
      new THREE.Float32BufferAttribute(
        new Float32Array(cap.getAttribute('position').count * 3).fill(0.04),
        3,
      ),
    );
    this.add(cap, rock, 'Ice tunnel cap');
    const d = ICE_LAYOUT.duct;
    this.colliders.push(
      ...rockTubeColliders(tube, d, ICE_LAYOUT.wall),
      boxCollider(
        [-d - 1, t.y - d - 1, t.startZ + 0.2],
        [d + 1, t.y + d + 1, t.startZ + 1.2],
      ),
      // The rock wall round the tunnel's mouth.
      boxCollider([-40, -5, t.wallZ - 0.2], [-d, top + 6, t.wallZ + 3]),
      boxCollider([d, -5, t.wallZ - 0.2], [40, top + 6, t.wallZ + 3]),
      boxCollider([-d, t.y + d, t.wallZ - 0.2], [d, top + 6, t.wallZ + 3]),
      boxCollider([-d, -5, t.wallZ - 0.2], [d, t.y - d, t.wallZ + 3]),
      // The icebergs, the far end and the sea ice.
      boxCollider([w.x, -5, -80], [w.x + 12, top + 8, t.wallZ]),
      boxCollider([-w.x - 12, -5, -80], [-w.x, top + 8, t.wallZ]),
      boxCollider([-40, -5, w.farZ - 12], [40, top + 8, w.farZ]),
      boxCollider([-40, top, -80], [40, top + 8, t.wallZ]),
    );

    // The icebergs: great faceted blocks along the sides and the far end, rooted below the seabed
    // and rising up through the sea ice.
    const blocks: THREE.BufferGeometry[] = [];
    const block = (x: number, z: number, sx: number, sz: number, k: number) => {
      const g = lump(46100 + (k % 12) * 17, k % 4, 1),
        h = top + 6 + rand() * 4;
      g.scale(sx, h, sz);
      g.rotateY((rand() - 0.5) * 0.5);
      g.translate(x, h / 2 - 3, z);
      iceColours(g, 0.4 + rand() * 0.4);
      blocks.push(g);
    };
    // Each block's inner face lies on or beyond the wall's line (they are rotated a little, so a
    // margin), so none juts into the tank.
    let k = 0;
    for (let z = t.wallZ - 2; z > w.farZ - 2; z -= 5 + rand() * 3)
      for (const side of [-1, 1]) {
        const sx = 7 + rand() * 4;
        block(side * (w.x + sx * 0.55 + rand()), z, sx, 7 + rand() * 4, k++);
      }
    for (let x = -w.x - 4; x < w.x + 5; x += 5 + rand() * 3) {
      const sz = 7 + rand() * 4;
      block(x, w.farZ - sz * 0.55 - rand(), 7 + rand() * 4, sz, k++);
    }
    // The underside of the sea ice: a lumpy sheet, its breathing holes open.
    const sheet = new THREE.PlaneGeometry(60, 76, 120, 152);
    sheet.rotateX(Math.PI / 2);
    sheet.translate(0, top, -34);
    const sp = sheet.getAttribute('position');
    sheet.setAttribute(
      'color',
      new THREE.Float32BufferAttribute(new Float32Array(sp.count * 3), 3),
    );
    for (let i = 0; i < sp.count; i++) {
      const x = sp.getX(i),
        z = sp.getZ(i),
        rumple =
          0.35 * Math.abs(Math.sin(x * 0.45 + z * 0.2)) +
          0.25 * Math.sin(x * 1.3) * Math.sin(z * 1.1);
      // The ice thins (rises) towards each hole's rim.
      const rim = ICE.holes.reduce(
        (m, h) =>
          Math.max(
            m,
            1 - Math.min(1, (Math.hypot(x - h.x, z - h.z) - h.r) / 2.5),
          ),
        0,
      );
      sp.setY(i, top - rumple + 0.5 * rim);
    }
    iceColours(sheet, 0.25);
    const si = sheet.getIndex()!,
      open: number[] = [];
    for (let f = 0; f < si.count; f += 3) {
      let cx = 0,
        cz = 0;
      for (let q = 0; q < 3; q++) {
        cx += sp.getX(si.getX(f + q)) / 3;
        cz += sp.getZ(si.getX(f + q)) / 3;
      }
      if (!ICE.holes.some((h) => Math.hypot(cx - h.x, cz - h.z) < h.r))
        open.push(si.getX(f), si.getX(f + 1), si.getX(f + 2));
    }
    sheet.setIndex(open);
    const flatSheet = sheet.toNonIndexed();
    sheet.dispose();
    flatSheet.deleteAttribute('uv');
    blocks.push(flatSheet);
    // Chunks hanging under the ice, and short chimneys up each hole.
    for (let i = 0; i < ICE_LAYOUT.hanging; i++) {
      const x = (rand() * 2 - 1) * (w.x - 2),
        z = t.wallZ - 3 + rand() * (w.farZ - t.wallZ + 4);
      if (ICE.holes.some((h) => Math.hypot(x - h.x, z - h.z) < h.r + 1.5))
        continue;
      const s = 0.6 + rand() * rand() * 2.6,
        g = lump(46300 + (i % 8) * 7, i % 4, 1);
      g.scale(s * (1 + rand()), s * 0.7, s * (1 + rand()));
      g.rotateY(rand() * Math.PI);
      // Set well up into the sheet (which dips by up to 0.6 m), so none seems to float.
      g.translate(x, top - s * 0.12 + 0.3, z);
      iceColours(g, 0.35);
      blocks.push(g);
    }
    for (const h of ICE.holes) {
      const chimney = new THREE.CylinderGeometry(
        h.r + 0.1,
        h.r + 0.4,
        2.6,
        24,
        3,
        true,
      );
      chimney.translate(h.x, top + 1.1, h.z);
      const flat = chimney.toNonIndexed();
      chimney.dispose();
      flat.deleteAttribute('uv');
      flat.setAttribute(
        'color',
        new THREE.Float32BufferAttribute(
          new Float32Array(flat.getAttribute('position').count * 3),
          3,
        ),
      );
      iceColours(flat, 0.6);
      // Faces inwards: flip the winding.
      const pa = flat.getAttribute('position');
      for (let v = 0; v < pa.count; v += 3) {
        const x1 = pa.getX(v + 1),
          y1 = pa.getY(v + 1),
          z1 = pa.getZ(v + 1);
        pa.setXYZ(v + 1, pa.getX(v + 2), pa.getY(v + 2), pa.getZ(v + 2));
        pa.setXYZ(v + 2, x1, y1, z1);
      }
      blocks.push(flat);
      // Daylight in the hole, and a soft shaft of light falling from it.
      const day = new THREE.CircleGeometry(h.r + 0.6, 24);
      day.rotateX(Math.PI / 2);
      day.translate(h.x, top + 2.3, h.z);
      this.add(day, sky, 'Breathing hole daylight');
      const floor = iceFloor(h.x, h.z),
        height = top - floor;
      const shaft = new THREE.CylinderGeometry(
        h.r * 0.95,
        h.r * 2.3,
        height,
        24,
        1,
        true,
      );
      shaft.translate(h.x - 0.6, floor + height / 2, h.z + 0.4);
      this.add(shaft, this.shafts, 'Breathing hole light');
    }
    const merged = mergeGeometries(blocks, false);
    blocks.forEach((g) => g.dispose());
    if (merged) {
      merged.computeVertexNormals();
      this.add(merged, ice, 'Icebergs and sea ice');
    }
    // Dropstones: dark boulders carried out by the ice and dropped on the seabed.
    const stones: THREE.BufferGeometry[] = [];
    for (let i = 0; i < ICE_LAYOUT.stones; i++) {
      const x = (rand() * 2 - 1) * (w.x - 4),
        z = t.wallZ - 4 + rand() * (w.farZ - t.wallZ + 6);
      if (Math.abs(x) < 4 && z > t.wallZ - 7) continue;
      const s = 0.5 + rand() * rand() * 2.2,
        y = iceFloor(x, z),
        g = lump(46500 + (i % 8) * 11, i % 4, 2);
      g.scale(s * 1.2, s * 0.8, s);
      g.rotateY(rand() * Math.PI);
      g.translate(x, y + s * 0.25, z);
      const c = g.getAttribute('color');
      for (let v = 0; v < c.count; v++) c.setXYZ(v, 0.24, 0.23, 0.23);
      stones.push(g);
      this.stones.push({ x, y, z, size: s });
      if (s > 1)
        this.colliders.push(
          boxCollider(
            [x - s * 0.5, y - 1, z - s * 0.45],
            [x + s * 0.5, y + s * 0.6, z + s * 0.45],
          ),
        );
    }
    const rocks = mergeGeometries(stones, false);
    stones.forEach((g) => g.dispose());
    if (rocks) {
      rocks.computeVertexNormals();
      this.add(rocks, rock, 'Dropstones');
    }
  }
  private own<T extends THREE.Material>(m: T): T {
    this.materials.push(m);
    return m;
  }
  private add(
    g: THREE.BufferGeometry,
    m: THREE.Material,
    name: string,
  ): THREE.Mesh {
    this.geometries.push(g);
    const mesh = new THREE.Mesh(g, m);
    mesh.name = name;
    this.root.add(mesh);
    return mesh;
  }
  /** The light shafts shimmer slowly, on simulation time only. */
  update(dt: number, active: boolean, reducedMotion: boolean): void {
    if (this.disposed || !active || reducedMotion || !(dt > 0)) return;
    this.time += Math.min(dt, 0.1);
    this.shafts.opacity = 0.1 + 0.025 * Math.sin(this.time * 0.5);
  }
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.root.removeFromParent();
    this.root.clear();
    this.geometries.forEach((g) => g.dispose());
    this.materials.forEach((m) => m.dispose());
  }
}
