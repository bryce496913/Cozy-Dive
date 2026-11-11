import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import {
  contactShadowGeometry,
  contactShadowMaterial,
  officeShadowLayout,
} from './ContactShadows';
import { OFFICE, TANK } from '../../config/office';
import {
  artTexture,
  clockTexture,
  floorTexture,
  gardenTexture,
  plasterTexture,
  rugTexture,
  woodTexture,
} from './OfficeTextures';

/**
 * v0.3 Pass 020: the cosy home office, generated in code. Static parts are baked into one merged
 * mesh per material (vertex colour carries per-object tint), so the whole room is about fifteen
 * draw calls. The environment owns its scene root, geometries, materials and textures and disposes
 * them once. The tank's glass panels are exposed so the renderer can show the real aquarium
 * through them; the clock and the rain on the window animate in `update`.
 */
type Key =
  | 'wood'
  | 'darkWood'
  | 'wall'
  | 'paint'
  | 'fabric'
  | 'metal'
  | 'ceramic'
  | 'leaf'
  | 'paper'
  | 'glow'
  | 'trim';
type Color = readonly [number, number, number];
const hex = (h: number): Color => {
  const c = new THREE.Color(h);
  return [c.r, c.g, c.b];
};

/** Deterministic pseudo-random sequence. */
function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/** Collects transformed, tinted parts per material and merges them once. */
class Batcher {
  private readonly parts = new Map<Key, THREE.BufferGeometry[]>();
  private readonly m = new THREE.Matrix4();
  private readonly q = new THREE.Quaternion();
  private readonly e = new THREE.Euler();
  add(
    key: Key,
    source: THREE.BufferGeometry,
    at: readonly [number, number, number],
    color: Color,
    rotation: readonly [number, number, number] = [0, 0, 0],
    scale: readonly [number, number, number] = [1, 1, 1],
  ): void {
    this.e.set(rotation[0], rotation[1], rotation[2], 'YXZ');
    this.q.setFromEuler(this.e);
    this.m.compose(
      new THREE.Vector3(...at),
      this.q,
      new THREE.Vector3(...scale),
    );
    this.addMatrix(key, source, this.m, color);
  }
  addMatrix(
    key: Key,
    source: THREE.BufferGeometry,
    matrix: THREE.Matrix4,
    color: Color,
  ): void {
    const g = (
      source.index ? source.toNonIndexed() : source.clone()
    ).applyMatrix4(matrix);
    if (source.index) source.dispose();
    g.deleteAttribute('uv1');
    boxUV(g, key === 'wall' ? 0.6 : 1.4);
    const n = g.attributes.position.count,
      rgb = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) rgb.set(color, i * 3);
    g.setAttribute('color', new THREE.BufferAttribute(rgb, 3));
    const list = this.parts.get(key);
    if (list) list.push(g);
    else this.parts.set(key, [g]);
  }
  build(): Map<Key, THREE.BufferGeometry> {
    const out = new Map<Key, THREE.BufferGeometry>();
    for (const [key, list] of this.parts) {
      const merged = mergeGeometries(list, false);
      if (!merged) throw Error(`Office batch ${key} could not merge`);
      merged.computeBoundingSphere();
      out.set(key, merged);
      list.forEach((g) => g.dispose());
    }
    this.parts.clear();
    return out;
  }
}

/** Box-projected UVs from world position and normal: even texel density on any shape. */
function boxUV(g: THREE.BufferGeometry, scale: number): void {
  const p = g.attributes.position,
    n = g.attributes.normal,
    uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) {
    const ax = Math.abs(n.getX(i)),
      ay = Math.abs(n.getY(i)),
      az = Math.abs(n.getZ(i));
    const [u, v] =
      ax >= ay && ax >= az
        ? [p.getZ(i), p.getY(i)]
        : ay >= az
          ? [p.getX(i), p.getZ(i)]
          : [p.getX(i), p.getY(i)];
    uv[i * 2] = u * scale;
    uv[i * 2 + 1] = v * scale;
  }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
}

const rounded = (w: number, h: number, d: number, r = 0.012) =>
  new RoundedBoxGeometry(w, h, d, 2, Math.min(r, w / 2, h / 2, d / 2));
const cylinder = (rt: number, rb: number, h: number, s = 20) =>
  new THREE.CylinderGeometry(rt, rb, h, s);

/** A leaf blade: a tapered, gently cupped and arched strip (base at origin, tip along +y). */
function leafGeometry(
  length: number,
  width: number,
  arch: number,
  pointed = 0.8,
): THREE.BufferGeometry {
  const p: number[] = [],
    n: number[] = [],
    index: number[] = [],
    rows = 8,
    cols = 4;
  for (let i = 0; i <= rows; i++) {
    const s = i / rows,
      w =
        width * Math.sin(Math.PI * Math.min(1, s * (1 + (1 - pointed)))) ** 0.7,
      y = length * s,
      z = arch * s * s;
    for (let j = 0; j <= cols; j++) {
      const t = j / cols - 0.5,
        x = t * 2 * w;
      p.push(x, y, z - Math.abs(t) * w * 0.35);
      n.push(0, 0, 1);
    }
  }
  for (let i = 0; i < rows; i++)
    for (let j = 0; j < cols; j++) {
      const a = i * (cols + 1) + j,
        b = a + cols + 1;
      index.push(a, b, a + 1, a + 1, b, b + 1);
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(n, 3));
  g.setAttribute(
    'uv',
    new THREE.Float32BufferAttribute(new Float32Array((p.length / 3) * 2), 2),
  );
  g.setIndex(index);
  g.computeVertexNormals();
  return g;
}

/** Rain running down the window: drifting droplets with short trails, over a faint cool tint. */
const RAIN_VERTEX = `
varying vec2 vUv;
void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}
`;
const RAIN_FRAGMENT = `
uniform float time;
varying vec2 vUv;
float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float drops(vec2 uv,float scale,float speed,float seed){
  vec2 g=uv*vec2(scale,scale*0.6);vec2 id=floor(g);vec2 f=fract(g);
  float r=h(id+seed);
  float y=fract(r*7.13-time*speed*(0.4+r));
  vec2 c=vec2(0.25+0.5*h(id+seed+3.1),y);
  vec2 d=(f-c)*vec2(1.,1.6);
  float drop=smoothstep(0.09,0.03,length(d));
  float trail=smoothstep(0.035,0.0,abs(f.x-c.x))*step(c.y,f.y)*smoothstep(0.55,0.,f.y-c.y)*0.5;
  return max(drop,trail)*step(0.55,r);
}
void main(){
  float d=drops(vUv,9.,0.05,1.)+drops(vUv+0.37,15.,0.08,2.)*0.8+drops(vUv+0.71,24.,0.11,3.)*0.6;
  d=clamp(d,0.,1.);
  gl_FragColor=vec4(mix(vec3(0.78,0.84,0.88),vec3(0.96,0.98,1.),d),0.1+0.32*d);
  #include <colorspace_fragment>
}
`;

export class OfficeEnvironment {
  readonly root = new THREE.Group();
  /** Aquarium-aligned tank frame: aquarium coordinates times TANK_SCALE, on the stand. */
  readonly tankRoot = new THREE.Group();
  /** Glass panels the renderer fills with the live miniature aquarium. */
  readonly tankGlass: THREE.Mesh[] = [];
  /** Where the desk lamp's bulb is (for the lamp light). */
  readonly lampBulb = new THREE.Vector3();
  /** Window opening on the back wall (centre, size), for the daylight. */
  readonly window: { center: THREE.Vector3; width: number; height: number };
  private readonly geometries: THREE.BufferGeometry[] = [];
  private readonly materials: THREE.Material[] = [];
  private readonly textures: THREE.Texture[] = [];
  private readonly hands: {
    hour: THREE.Object3D;
    minute: THREE.Object3D;
    second: THREE.Object3D;
  };
  private readonly rain: THREE.ShaderMaterial;
  private rainTime = 0;
  private disposed = false;

  constructor() {
    this.root.name = 'Cosy home office';
    const b = new Batcher(),
      r = OFFICE.room,
      w = OFFICE.window;
    const own = <T extends THREE.Texture>(t: T): T => {
      this.textures.push(t);
      return t;
    };
    const wood = own(woodTexture()),
      plaster = own(plasterTexture());

    // --- Room shell: walls (with the window opening), skirting, ceiling, door.
    const wall = hex(0xf1e4cf),
      paint = hex(0xf6f1e7),
      wallPlane = (
        cx: number,
        cy: number,
        width: number,
        height: number,
        z: number,
        ry: number,
        x = 0,
      ) =>
        b.add(
          'wall',
          new THREE.PlaneGeometry(width, height),
          [x || cx, cy, z],
          wall,
          [0, ry, 0],
        );
    const wx0 = w.centerX - w.width / 2,
      wx1 = w.centerX + w.width / 2;
    // Back wall around the window (z = room.min.z, facing +z).
    wallPlane(
      (r.min.x + wx0) / 2,
      r.max.y / 2,
      wx0 - r.min.x,
      r.max.y,
      r.min.z,
      0,
    );
    wallPlane(
      (wx1 + r.max.x) / 2,
      r.max.y / 2,
      r.max.x - wx1,
      r.max.y,
      r.min.z,
      0,
    );
    wallPlane(w.centerX, w.sill / 2, w.width, w.sill, r.min.z, 0);
    wallPlane(
      w.centerX,
      (w.top + r.max.y) / 2,
      w.width,
      r.max.y - w.top,
      r.min.z,
      0,
    );
    // Front, left and right walls.
    b.add(
      'wall',
      new THREE.PlaneGeometry(r.max.x - r.min.x, r.max.y),
      [0, r.max.y / 2, r.max.z],
      wall,
      [0, Math.PI, 0],
    );
    b.add(
      'wall',
      new THREE.PlaneGeometry(r.max.z - r.min.z, r.max.y),
      [r.min.x, r.max.y / 2, 0],
      wall,
      [0, Math.PI / 2, 0],
    );
    b.add(
      'wall',
      new THREE.PlaneGeometry(r.max.z - r.min.z, r.max.y),
      [r.max.x, r.max.y / 2, 0],
      wall,
      [0, -Math.PI / 2, 0],
    );
    // Ceiling.
    b.add(
      'paint',
      new THREE.PlaneGeometry(r.max.x - r.min.x, r.max.z - r.min.z),
      [0, r.max.y, 0],
      hex(0xfbf8f2),
      [Math.PI / 2, 0, 0],
    );
    // Skirting boards.
    const skirt = hex(0xf3ede2);
    for (const [x, z, len, ry] of [
      [0, r.min.z + 0.01, r.max.x - r.min.x, 0],
      [0, r.max.z - 0.01, r.max.x - r.min.x, 0],
      [r.min.x + 0.01, 0, r.max.z - r.min.z, Math.PI / 2],
      [r.max.x - 0.01, 0, r.max.z - r.min.z, Math.PI / 2],
    ] as const)
      b.add('paint', rounded(len, 0.09, 0.02, 0.005), [x, 0.045, z], skirt, [
        0,
        ry,
        0,
      ]);
    // Window reveal, frame, mullions and sill.
    const depth = 0.18,
      frame = hex(0xf7f4ee),
      wy = (w.sill + w.top) / 2,
      wh = w.top - w.sill;
    b.add(
      'paint',
      new THREE.BoxGeometry(w.width, 0.02, depth),
      [w.centerX, w.top, r.min.z - depth / 2],
      paint,
    );
    b.add(
      'paint',
      new THREE.BoxGeometry(0.02, wh, depth),
      [wx0, wy, r.min.z - depth / 2],
      paint,
    );
    b.add(
      'paint',
      new THREE.BoxGeometry(0.02, wh, depth),
      [wx1, wy, r.min.z - depth / 2],
      paint,
    );
    b.add(
      'paint',
      rounded(w.width + 0.16, 0.035, 0.26, 0.008),
      [w.centerX, w.sill, r.min.z - 0.05],
      frame,
    );
    const glassZ = r.min.z - 0.12;
    for (const [x, y, sw, sh] of [
      [w.centerX, w.top - 0.03, w.width, 0.06],
      [w.centerX, w.sill + 0.04, w.width, 0.06],
      [wx0 + 0.03, wy, 0.06, wh],
      [wx1 - 0.03, wy, 0.06, wh],
      [w.centerX, wy, 0.045, wh],
      [w.centerX, w.sill + wh * 0.62, w.width, 0.045],
    ] as const)
      b.add('paint', rounded(sw, sh, 0.05, 0.006), [x, y, glassZ], frame);
    this.window = {
      center: new THREE.Vector3(w.centerX, wy, r.min.z - 0.02),
      width: w.width,
      height: wh,
    };
    // Door on the front wall.
    const doorX = -1.8,
      doorZ = r.max.z - 0.02;
    b.add(
      'paint',
      rounded(0.96, 2.12, 0.04, 0.01),
      [doorX, 1.06, doorZ],
      frame,
    );
    b.add(
      'wood',
      rounded(0.84, 2.02, 0.04, 0.008),
      [doorX, 1.01, doorZ - 0.02],
      hex(0xe8dcc6),
    );
    for (const y of [0.55, 1.45])
      b.add(
        'wood',
        rounded(0.62, 0.62, 0.012, 0.006),
        [doorX, y, doorZ - 0.045],
        hex(0xefe4cf),
      );
    b.add(
      'metal',
      new THREE.SphereGeometry(0.028, 14, 10),
      [doorX + 0.33, 1.02, doorZ - 0.07],
      hex(0xb59a62),
    );

    // --- Desk under the window, with laptop, mug, notebooks, plant and lamp.
    const d = OFFICE.desk,
      deskWood = hex(0xb98a5c),
      topY = d.size.y;
    b.add(
      'wood',
      rounded(d.size.x, 0.04, d.size.z, 0.01),
      [d.center.x, topY - 0.02, d.center.z],
      deskWood,
    );
    for (const sx of [-1, 1])
      b.add(
        'wood',
        rounded(0.04, topY - 0.04, d.size.z - 0.06, 0.008),
        [
          d.center.x + sx * (d.size.x / 2 - 0.04),
          (topY - 0.04) / 2,
          d.center.z,
        ],
        deskWood,
      );
    b.add(
      'wood',
      rounded(d.size.x - 0.12, 0.32, 0.02, 0.006),
      [d.center.x, topY - 0.2, d.center.z - d.size.z / 2 + 0.04],
      deskWood,
    );
    const pedX = d.center.x + d.size.x / 2 - 0.28;
    b.add(
      'wood',
      rounded(0.4, 0.62, d.size.z - 0.08, 0.008),
      [pedX, 0.33, d.center.z],
      deskWood,
    );
    for (const y of [0.18, 0.46]) {
      b.add(
        'wood',
        rounded(0.37, 0.24, 0.015, 0.005),
        [pedX, y, d.center.z + d.size.z / 2 - 0.03],
        hex(0xc4966a),
      );
      b.add(
        'metal',
        cylinder(0.008, 0.008, 0.12, 10),
        [pedX, y + 0.06, d.center.z + d.size.z / 2 - 0.005],
        hex(0x8f8a80),
        [0, 0, Math.PI / 2],
      );
    }
    // Laptop: base, hinged screen and a soft lit display.
    const lx = d.center.x - 0.12,
      lz = d.center.z + 0.05,
      lyaw = 0.12;
    b.add(
      'metal',
      rounded(0.34, 0.016, 0.24, 0.006),
      [lx, topY + 0.008, lz],
      hex(0xc9c9c6),
      [0, lyaw, 0],
    );
    const screen = new THREE.Matrix4()
      .makeTranslation(lx, topY + 0.016, lz)
      .multiply(new THREE.Matrix4().makeRotationY(lyaw))
      .multiply(new THREE.Matrix4().makeTranslation(0, 0, -0.118))
      .multiply(new THREE.Matrix4().makeRotationX(-0.28))
      .multiply(new THREE.Matrix4().makeTranslation(0, 0.11, 0));
    b.addMatrix(
      'metal',
      rounded(0.34, 0.22, 0.01, 0.005),
      screen,
      hex(0xbdbdba),
    );
    b.addMatrix(
      'glow',
      new THREE.PlaneGeometry(0.31, 0.19),
      screen
        .clone()
        .multiply(new THREE.Matrix4().makeTranslation(0, 0, 0.0055)),
      [0.42, 0.5, 0.58],
    );
    // Mug with a handle.
    const mug = new THREE.LatheGeometry(
      [
        new THREE.Vector2(0, 0),
        new THREE.Vector2(0.038, 0),
        new THREE.Vector2(0.041, 0.095),
        new THREE.Vector2(0.036, 0.095),
        new THREE.Vector2(0.033, 0.01),
        new THREE.Vector2(0, 0.01),
      ],
      24,
    );
    b.add(
      'ceramic',
      mug,
      [d.center.x + 0.34, topY, d.center.z + 0.12],
      hex(0xd58c62),
    );
    b.add(
      'ceramic',
      new THREE.TorusGeometry(0.026, 0.007, 8, 16, Math.PI),
      [d.center.x + 0.38, topY + 0.05, d.center.z + 0.12],
      hex(0xd58c62),
      [0, 0, -Math.PI / 2],
    );
    // Notebooks and a pencil.
    for (const [i, c] of [0x5e7a78, 0xd7c8a7, 0x8a4f3f].entries())
      b.add(
        'paper',
        rounded(0.21, 0.015, 0.28, 0.003),
        [d.center.x - 0.52, topY + 0.0075 + i * 0.016, d.center.z + 0.06],
        hex(c),
        [0, 0.2 - i * 0.12, 0],
      );
    b.add(
      'wood',
      cylinder(0.004, 0.004, 0.17, 6),
      [d.center.x - 0.46, topY + 0.052, d.center.z + 0.1],
      hex(0xd9a441),
      [0, 0.5, Math.PI / 2],
    );
    // Desk lamp: weighted base, two arms and a shade with a warm bulb.
    const lampBase = new THREE.Vector3(
        d.center.x - 0.62,
        topY,
        d.center.z - 0.18,
      ),
      lampDark = hex(0x3f4a48);
    b.add(
      'metal',
      cylinder(0.075, 0.085, 0.022, 24),
      [lampBase.x, topY + 0.011, lampBase.z],
      lampDark,
    );
    const elbow = lampBase.clone().add(new THREE.Vector3(0.03, 0.36, 0.05)),
      head = elbow.clone().add(new THREE.Vector3(0.18, 0.06, 0.16));
    const arm = (from: THREE.Vector3, to: THREE.Vector3) => {
      const mid = from.clone().add(to).multiplyScalar(0.5),
        dir = to.clone().sub(from),
        q = new THREE.Quaternion().setFromUnitVectors(
          new THREE.Vector3(0, 1, 0),
          dir.clone().normalize(),
        );
      b.addMatrix(
        'metal',
        cylinder(0.009, 0.009, dir.length(), 10),
        new THREE.Matrix4().compose(mid, q, new THREE.Vector3(1, 1, 1)),
        lampDark,
      );
    };
    arm(new THREE.Vector3(lampBase.x, topY + 0.02, lampBase.z), elbow);
    arm(elbow, head);
    b.add(
      'metal',
      new THREE.SphereGeometry(0.017, 12, 8),
      [elbow.x, elbow.y, elbow.z],
      lampDark,
    );
    const shade = new THREE.LatheGeometry(
      [
        new THREE.Vector2(0.012, 0.07),
        new THREE.Vector2(0.03, 0.065),
        new THREE.Vector2(0.075, 0.0),
        new THREE.Vector2(0.078, -0.004),
      ],
      24,
    );
    const shadeMatrix = new THREE.Matrix4().compose(
      head,
      new THREE.Quaternion().setFromEuler(new THREE.Euler(0.55, 0.7, 0, 'YXZ')),
      new THREE.Vector3(1, 1, 1),
    );
    b.addMatrix('metal', shade, shadeMatrix, hex(0x5f7a73));
    this.lampBulb.copy(head).add(new THREE.Vector3(0, -0.01, 0));
    b.add(
      'glow',
      new THREE.SphereGeometry(0.022, 12, 8),
      [this.lampBulb.x, this.lampBulb.y, this.lampBulb.z],
      [1, 0.86, 0.62],
    );
    // Small succulent on the desk corner.
    this.potPlant(
      b,
      d.center.x + 0.62,
      topY,
      d.center.z - 0.2,
      0.05,
      0.07,
      hex(0xe9e3d8),
      11,
      'succulent',
    );

    // --- Office chair facing the desk.
    const c = OFFICE.chair,
      fabric = hex(0x5d7471);
    b.add(
      'fabric',
      rounded(0.48, 0.08, 0.46, 0.03),
      [c.center.x, 0.47, c.center.z],
      fabric,
    );
    b.add(
      'fabric',
      rounded(0.46, 0.5, 0.06, 0.03),
      [c.center.x, 0.8, c.center.z + 0.22],
      fabric,
      [-0.12, 0, 0],
    );
    b.add(
      'metal',
      cylinder(0.024, 0.024, 0.3, 12),
      [c.center.x, 0.28, c.center.z],
      hex(0x2f3533),
    );
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      b.add(
        'metal',
        rounded(0.27, 0.025, 0.04, 0.01),
        [
          c.center.x + Math.cos(a) * 0.13,
          0.07,
          c.center.z + Math.sin(a) * 0.13,
        ],
        hex(0x2f3533),
        [0, -a, 0],
      );
      b.add(
        'metal',
        new THREE.SphereGeometry(0.022, 10, 8),
        [
          c.center.x + Math.cos(a) * 0.26,
          0.025,
          c.center.z + Math.sin(a) * 0.26,
        ],
        hex(0x1f2322),
      );
    }

    // --- Bookshelf on the left wall, books and keepsakes.
    const s = OFFICE.shelf,
      shelfWood = hex(0xa47750),
      sx0 = s.center.x - s.size.x / 2,
      sz0 = s.center.z - s.size.z / 2,
      sz1 = s.center.z + s.size.z / 2;
    for (const z of [sz0 + 0.015, sz1 - 0.015])
      b.add(
        'wood',
        rounded(s.size.x, s.size.y, 0.03, 0.006),
        [s.center.x, s.size.y / 2, z],
        shelfWood,
      );
    b.add(
      'wood',
      new THREE.BoxGeometry(0.012, s.size.y, s.size.z - 0.04),
      [sx0 + 0.006, s.size.y / 2, s.center.z],
      hex(0x8d6644),
    );
    const shelfLevels = [0.06, 0.48, 0.9, 1.32, 1.74, s.size.y - 0.015];
    for (const y of shelfLevels)
      b.add(
        'wood',
        rounded(s.size.x - 0.01, 0.03, s.size.z - 0.05, 0.006),
        [s.center.x, y, s.center.z],
        shelfWood,
      );
    const books = [
      0x7d3b34, 0x2f4a5f, 0xc49a47, 0x6f8a6c, 0xe5dcc5, 0x5a4033, 0x8a6a8f,
      0x3e6b6b, 0xb5643e, 0xd9cfb3,
    ];
    const random = rng(2020);
    shelfLevels.slice(0, 4).forEach((y, level) => {
      let z = sz0 + 0.06;
      const stop = sz1 - 0.06;
      while (z < stop - 0.05) {
        if (random() < 0.08 && z < stop - 0.3) {
          z += 0.22 + random() * 0.1; // a gap for a keepsake
          continue;
        }
        const t = 0.022 + random() * 0.03,
          h = 0.24 + random() * 0.13,
          dep = 0.2 + random() * 0.07,
          lean = random() < 0.1 ? 0.18 : 0;
        b.add(
          'paper',
          rounded(dep, h, t, 0.003),
          [sx0 + 0.04 + dep / 2, y + 0.015 + h / 2, z + t / 2],
          hex(books[Math.floor(random() * books.length)]),
          [lean, 0, 0],
        );
        z += t + 0.003 + (lean ? 0.04 : 0);
      }
      // Keepsakes: a vase, a small framed photo, a plant.
      if (level === 1) {
        const vase = new THREE.LatheGeometry(
          [
            new THREE.Vector2(0, 0),
            new THREE.Vector2(0.05, 0),
            new THREE.Vector2(0.065, 0.08),
            new THREE.Vector2(0.035, 0.17),
            new THREE.Vector2(0.04, 0.2),
            new THREE.Vector2(0, 0.2),
          ],
          20,
        );
        b.add(
          'ceramic',
          vase,
          [s.center.x + 0.02, y + 0.015, sz1 - 0.2],
          hex(0x9db8b0),
        );
      }
      if (level === 2)
        b.add(
          'wood',
          rounded(0.02, 0.16, 0.12, 0.004),
          [sx0 + 0.08, y + 0.095, sz0 + 0.2],
          hex(0x3b3530),
          [0, 0, -0.12],
        );
    });
    this.potPlant(
      b,
      s.center.x + 0.02,
      shelfLevels[4] + 0.015,
      s.center.z + 0.3,
      0.07,
      0.09,
      hex(0xc96f4a),
      7,
      'trailing',
    );

    // --- Plants: a tall leafy plant by the window and a snake plant by the door.
    const [tall, snake] = OFFICE.plants;
    this.potPlant(
      b,
      tall.x,
      0,
      tall.z,
      tall.radius,
      0.36,
      hex(0xe7ddd0),
      3,
      'fiddle',
      tall.height,
    );
    this.potPlant(
      b,
      snake.x,
      0,
      snake.z,
      snake.radius,
      0.3,
      hex(0x6c7f7c),
      5,
      'snake',
      snake.height,
    );

    // --- Aquarium stand and tank.
    const st = OFFICE.stand,
      cabinet = hex(0x5b4636);
    b.add(
      'darkWood',
      rounded(st.size.x, st.size.y - 0.04, st.size.z, 0.012),
      [st.center.x, (st.size.y - 0.04) / 2 + 0.04, st.center.z],
      cabinet,
    );
    b.add(
      'darkWood',
      rounded(st.size.x - 0.04, 0.05, st.size.z - 0.04, 0.008),
      [st.center.x, 0.025, st.center.z],
      hex(0x3f3128),
    );
    const front = st.center.x - st.size.x / 2 - 0.004;
    for (const z of [-0.27, 0.27]) {
      b.add(
        'darkWood',
        rounded(0.012, st.size.y - 0.14, st.size.z / 2 - 0.05, 0.004),
        [front, st.size.y / 2 + 0.02, st.center.z + z],
        hex(0x6a5342),
      );
      b.add(
        'metal',
        cylinder(0.007, 0.007, 0.1, 10),
        [
          front - 0.014,
          st.size.y / 2 + 0.05,
          st.center.z + (z < 0 ? 0.04 : -0.04),
        ],
        hex(0xa89064),
      );
    }
    this.buildTank(b);

    // --- Rug, wall clock and a framed print.
    const built = b.build();
    const material = (key: Key): THREE.Material => {
      const vertexColors = true;
      const m =
        key === 'glow'
          ? new THREE.MeshBasicMaterial({ vertexColors })
          : new THREE.MeshStandardMaterial({
              vertexColors,
              map:
                key === 'wood' || key === 'darkWood'
                  ? wood
                  : key === 'wall'
                    ? plaster
                    : null,
              roughness:
                key === 'metal'
                  ? 0.38
                  : key === 'ceramic'
                    ? 0.32
                    : key === 'fabric'
                      ? 0.95
                      : key === 'leaf'
                        ? 0.62
                        : key === 'trim'
                          ? 0.4
                          : 0.72,
              metalness: key === 'metal' ? 0.45 : 0,
              side:
                key === 'leaf' || key === 'wall'
                  ? THREE.DoubleSide
                  : THREE.FrontSide,
            });
      m.name = `Office ${key}`;
      this.materials.push(m);
      return m;
    };
    for (const [key, geometry] of built) {
      this.geometries.push(geometry);
      const mesh = new THREE.Mesh(geometry, material(key));
      mesh.name = `Office ${key}`;
      this.root.add(mesh);
    }
    const floorGeometry = new THREE.PlaneGeometry(
      r.max.x - r.min.x,
      r.max.z - r.min.z,
    );
    floorGeometry.rotateX(-Math.PI / 2);
    const floorMap = own(floorTexture());
    floorMap.repeat.set(2.2, 2.2);
    this.plane(
      floorGeometry,
      new THREE.MeshStandardMaterial({ map: floorMap, roughness: 0.55 }),
      'Office floor',
    );
    const rug = new THREE.PlaneGeometry(2.3, 1.6);
    rug.rotateX(-Math.PI / 2);
    rug.translate(0.15, 0.004, 0.25);
    this.plane(
      rug,
      new THREE.MeshStandardMaterial({ map: own(rugTexture()), roughness: 1 }),
      'Office rug',
    );
    // Pass 022: soft baked contact shadows under the furniture and along the walls (one draw).
    this.plane(
      contactShadowGeometry(officeShadowLayout()),
      contactShadowMaterial(),
      'Office contact shadows',
    );
    // Garden beyond the window, lit by daylight rather than the room.
    const garden = new THREE.PlaneGeometry(7, 4.4);
    garden.translate(w.centerX, 1.9, r.min.z - 2.6);
    this.plane(
      garden,
      new THREE.MeshBasicMaterial({ map: own(gardenTexture()) }),
      'Garden view',
    );
    this.rain = new THREE.ShaderMaterial({
      uniforms: { time: { value: 0 } },
      vertexShader: RAIN_VERTEX,
      fragmentShader: RAIN_FRAGMENT,
      transparent: true,
      depthWrite: false,
    });
    const pane = new THREE.PlaneGeometry(w.width - 0.06, wh - 0.06);
    pane.translate(w.centerX, wy, glassZ - 0.006);
    this.plane(pane, this.rain, 'Rainy window');
    // Clock above the desk, right of the window.
    const clock = new THREE.Group();
    clock.position.set(1.15, 2.02, r.min.z + 0.03);
    clock.name = 'Wall clock';
    const rim = new THREE.TorusGeometry(0.17, 0.017, 10, 40);
    this.geometries.push(rim);
    const rimMaterial = new THREE.MeshStandardMaterial({
      color: 0x4a3b31,
      roughness: 0.5,
    });
    this.materials.push(rimMaterial);
    clock.add(new THREE.Mesh(rim, rimMaterial));
    const face = new THREE.CircleGeometry(0.168, 40);
    this.geometries.push(face);
    const faceMaterial = new THREE.MeshStandardMaterial({
      map: own(clockTexture()),
      roughness: 0.6,
    });
    this.materials.push(faceMaterial);
    clock.add(new THREE.Mesh(face, faceMaterial));
    const handMaterial = new THREE.MeshStandardMaterial({
      color: 0x24211f,
      roughness: 0.5,
    });
    this.materials.push(handMaterial);
    const hand = (length: number, width: number, z: number, color?: number) => {
      const g = new THREE.BoxGeometry(width, length, 0.004);
      g.translate(0, length / 2 - 0.02, 0);
      this.geometries.push(g);
      let m: THREE.Material = handMaterial;
      if (color !== undefined) {
        m = new THREE.MeshStandardMaterial({ color, roughness: 0.5 });
        this.materials.push(m);
      }
      const pivot = new THREE.Group();
      pivot.position.z = z;
      pivot.add(new THREE.Mesh(g, m));
      clock.add(pivot);
      return pivot;
    };
    this.hands = {
      hour: hand(0.09, 0.012, 0.006),
      minute: hand(0.135, 0.008, 0.01),
      second: hand(0.145, 0.003, 0.014, 0xa8442f),
    };
    this.root.add(clock);
    // Framed ocean print above the aquarium.
    const print = new THREE.PlaneGeometry(0.62, 0.42);
    print.rotateY(-Math.PI / 2);
    print.translate(r.max.x - 0.036, 1.78, 0); // just proud of its frame
    this.plane(
      print,
      new THREE.MeshStandardMaterial({
        map: own(artTexture()),
        roughness: 0.8,
      }),
      'Ocean print',
    );
    const frameG = new THREE.BoxGeometry(0.03, 0.5, 0.7);
    frameG.translate(r.max.x - 0.016, 1.78, 0);
    this.plane(
      frameG,
      new THREE.MeshStandardMaterial({ color: 0xede6da, roughness: 0.6 }),
      'Print frame',
    );
    this.update(0, false);
  }

  /** A potted plant of a given character, baked into the batch. */
  private potPlant(
    b: Batcher,
    x: number,
    y: number,
    z: number,
    radius: number,
    height: number,
    potColor: Color,
    seed: number,
    kind: 'fiddle' | 'snake' | 'succulent' | 'trailing',
    plantHeight = 0.3,
  ): void {
    const pot = new THREE.LatheGeometry(
      [
        new THREE.Vector2(0, 0),
        new THREE.Vector2(radius * 0.72, 0),
        new THREE.Vector2(radius, height * 0.92),
        new THREE.Vector2(radius * 1.06, height),
        new THREE.Vector2(radius * 0.94, height),
        new THREE.Vector2(radius * 0.88, height * 0.86),
        new THREE.Vector2(0, height * 0.86),
      ],
      24,
    );
    b.add('ceramic', pot, [x, y, z], potColor);
    b.add(
      'fabric',
      cylinder(radius * 0.88, radius * 0.88, 0.01, 20),
      [x, y + height * 0.87, z],
      hex(0x3b2c22),
    );
    const random = rng(seed),
      leafDark = hex(0x2f5a36),
      leafMid = hex(0x47784a),
      base = y + height * 0.87;
    const tint = (): Color => {
      const t = random();
      return [
        leafDark[0] + (leafMid[0] - leafDark[0]) * t,
        leafDark[1] + (leafMid[1] - leafDark[1]) * t,
        leafDark[2] + (leafMid[2] - leafDark[2]) * t,
      ];
    };
    if (kind === 'fiddle') {
      // Two woody stems carrying broad leaves that spiral up and out.
      for (const off of [-0.03, 0.04])
        b.add(
          'wood',
          cylinder(0.012, 0.016, plantHeight - height, 8),
          [x + off, base + (plantHeight - height) / 2, z + off * 0.5],
          hex(0x6b5340),
        );
      const count = 26;
      for (let i = 0; i < count; i++) {
        const t = i / count,
          a = i * 2.4,
          ly = base + 0.12 + t * (plantHeight - height - 0.1),
          reach = 0.05 + 0.07 * Math.sin(t * Math.PI);
        b.add(
          'leaf',
          leafGeometry(0.2 + random() * 0.07, 0.07 + random() * 0.02, 0.05),
          [x + Math.cos(a) * reach, ly, z + Math.sin(a) * reach],
          tint(),
          [0.9 - t * 0.5 + random() * 0.3, -a + Math.PI / 2, 0],
        );
      }
    } else if (kind === 'snake') {
      for (let i = 0; i < 11; i++) {
        const a = i * 2.2 + random(),
          h = (plantHeight - height) * (0.65 + random() * 0.4);
        const c = tint();
        b.add(
          'leaf',
          leafGeometry(h, 0.032 + random() * 0.012, 0.03, 0.95),
          [x + Math.cos(a) * 0.05, base, z + Math.sin(a) * 0.05],
          [c[0] * 0.9, c[1] * 1.05, c[2] * 0.8],
          [0.08 + random() * 0.12, -a, 0],
        );
      }
    } else if (kind === 'succulent') {
      for (let i = 0; i < 12; i++) {
        const a = i * 2.4,
          ring = i / 12;
        b.add(
          'leaf',
          leafGeometry(0.045 - ring * 0.015, 0.016, 0.006),
          [x, base + 0.004, z],
          hex(0x7fa58a),
          [1.25 - ring * 0.9, -a, 0],
        );
      }
    } else {
      for (let i = 0; i < 9; i++) {
        const a = i * 0.8,
          length = 0.12 + random() * 0.16;
        for (let k = 0; k < 5; k++)
          b.add(
            'leaf',
            leafGeometry(0.035, 0.022, 0.006),
            [
              x + Math.cos(a) * (radius + k * length * 0.12),
              base - k * length * 0.18,
              z + Math.sin(a) * (radius + k * length * 0.12),
            ],
            tint(),
            [2 + random(), -a, 0],
          );
      }
    }
  }

  /** Tank: frame trim, hood and four glass panels sized to the aquarium volume. */
  private buildTank(b: Batcher): void {
    const t = TANK,
      sx = t.size.x,
      sy = t.size.y,
      sz = t.size.z;
    this.tankRoot.name = 'Office aquarium';
    this.tankRoot.position.set(t.position.x, t.position.y, t.position.z);
    this.tankRoot.rotation.y = t.yaw;
    this.tankRoot.updateMatrix();
    const local = (
      geometry: THREE.BufferGeometry,
      x: number,
      y: number,
      z: number,
      key: Key,
      color: Color,
    ) =>
      b.addMatrix(
        key,
        geometry,
        this.tankRoot.matrix
          .clone()
          .multiply(new THREE.Matrix4().makeTranslation(x, y, z)),
        color,
      );
    const trim = hex(0x1d2221),
      e = 0.012;
    // Vertical corner posts and top/bottom rails.
    for (const x of [-sx / 2, sx / 2])
      for (const z of [-sz / 2, sz / 2])
        local(new THREE.BoxGeometry(e, sy, e), x, sy / 2, z, 'trim', trim);
    for (const y of [e / 2, sy - e / 2]) {
      for (const z of [-sz / 2, sz / 2])
        local(new THREE.BoxGeometry(sx, e, e), 0, y, z, 'trim', trim);
      for (const x of [-sx / 2, sx / 2])
        local(new THREE.BoxGeometry(e, e, sz), x, y, 0, 'trim', trim);
    }
    // Hood with a slim light bar.
    local(
      rounded(sx + 0.02, 0.05, sz + 0.02, 0.008),
      0,
      sy + 0.025,
      0,
      'trim',
      hex(0x2a302f),
    );
    local(
      new THREE.BoxGeometry(sx * 0.9, 0.004, 0.04),
      0,
      sy + 0.052,
      sz * 0.15,
      'glow',
      [0.9, 0.95, 0.92],
    );
    // Glass panels (outward facing), filled by the renderer with the live miniature aquarium.
    const glass = new THREE.MeshBasicMaterial({
      color: 0x2c6a72,
      transparent: true,
      opacity: 0.6,
    });
    glass.name = 'Tank glass (fallback)';
    this.materials.push(glass);
    for (const [w, h, x, z, ry] of [
      [sx, sy, 0, sz / 2, 0],
      [sx, sy, 0, -sz / 2, Math.PI],
      [sz, sy, sx / 2, 0, Math.PI / 2],
      [sz, sy, -sx / 2, 0, -Math.PI / 2],
    ] as const) {
      const g = new THREE.PlaneGeometry(w, h);
      g.rotateY(ry);
      g.translate(x, sy / 2, z);
      this.geometries.push(g);
      const mesh = new THREE.Mesh(g, glass);
      mesh.name = 'Tank glass';
      this.tankRoot.add(mesh);
      this.tankGlass.push(mesh);
    }
    this.root.add(this.tankRoot);
  }

  private plane(
    geometry: THREE.BufferGeometry,
    material: THREE.Material,
    name: string,
  ): THREE.Mesh {
    this.geometries.push(geometry);
    if (!this.materials.includes(material)) this.materials.push(material);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = name;
    this.root.add(mesh);
    return mesh;
  }

  /** `time` in seconds: the clock shows it as time of day; rain drifts unless motion is reduced. */
  update(time: number, reducedMotion: boolean, dt = 0): void {
    if (this.disposed) return;
    const seconds = Math.floor(time) % 60,
      minutes = (time / 60) % 60,
      hours = (time / 3600 + 10.25) % 12;
    this.hands.second.rotation.z = -(seconds / 60) * Math.PI * 2;
    this.hands.minute.rotation.z = -((minutes + 15) / 60) * Math.PI * 2;
    this.hands.hour.rotation.z = -(hours / 12) * Math.PI * 2;
    if (!reducedMotion) this.rainTime += Math.min(dt, 0.1);
    this.rain.uniforms.time.value = this.rainTime;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.root.removeFromParent();
    this.root.clear();
    this.geometries.forEach((g) => g.dispose());
    this.materials.forEach((m) => m.dispose());
    this.textures.forEach((t) => t.dispose());
    this.geometries.length = 0;
    this.materials.length = 0;
    this.textures.length = 0;
  }
}
