import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import {
  backShell,
  bentTube,
  contouredCushion,
  panelDoor,
  taperedLeg,
  taperedSpoke,
  twinCaster,
} from './OfficeFurniture';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import {
  contactShadowGeometry,
  contactShadowMaterial,
  officeShadowLayout,
} from './ContactShadows';
import { OFFICE, TANK } from '../../config/office';
import {
  ceilingTileTexture,
  clockTexture,
  grassclothTexture,
  plankFloorTexture,
  posterTexture,
  screenTexture,
  streetTexture,
  tileTexture,
  woodTexture,
} from './OfficeTextures';

/**
 * v0.3 Pass 020 / v0.4 Pass 027: the office, generated in code (Pass 027 remodelled it as a glass
 * office, see config/office.ts). Static parts are baked into one merged
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

/** The open-plan posters' centres along the far wall (m). */
const POSTERS = [-2.4, 0, 2.4] as const;
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
    boxUV(g, key === 'wall' ? 1 : 1.4);
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

/** Task chair colours: grey seat, black back, dark metal. One chair for every desk. */
const CHAIR = {
  seat: 0x8f9293,
  back: 0x202225,
  frame: 0x18191b,
  metal: 0x2b2c2e,
};
/**
 * v0.4 Pass 028 playtest: one complete office task chair, used at the private desk and every
 * open-plan desk. Every part touches the next: casters under a five-star base, a gas lift to a
 * plate under the seat, a spine from that plate up into the backrest, and armrests on posts
 * rising from brackets under the seat. Built in chair space (the sitter faces -z, seat centred
 * at the origin on the floor), then turned by `yaw` about y and placed at (`x`, `z`).
 */
function taskChair(b: Batcher, x: number, z: number, yaw: number): void {
  const cos = Math.cos(yaw),
    sin = Math.sin(yaw),
    seat = hex(CHAIR.seat),
    back = hex(CHAIR.back),
    frame = hex(CHAIR.frame),
    metal = hex(CHAIR.metal),
    part = (
      key: Key,
      geometry: THREE.BufferGeometry,
      [lx, y, lz]: readonly [number, number, number],
      color: Color,
      [rx, ry]: readonly [number, number] = [0, 0],
    ) =>
      b.add(
        key,
        geometry,
        [x + lx * cos + lz * sin, y, z - lx * sin + lz * cos],
        color,
        [rx, yaw + ry, 0],
      );
  // V0.7 Pass 079: modelled forms (were boxes, balls and poles). A five-star base of tapered
  // spokes on twin-wheel casters round a hub, a gas lift in a tapered shroud, a dished cushion
  // with a waterfall front, a curved back shell with a lumbar swell on a curved spine, and
  // T-arms with soft pads.
  part('metal', cylinder(0.05, 0.06, 0.07, 20), [0, 0.085, 0], metal);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + Math.PI / 2;
    part('trim', taperedSpoke(0.3, 0.05, 0.035), [0, 0.095, 0], frame, [0, -a]);
    for (const g of twinCaster(0.026))
      part('trim', g, [Math.cos(a) * 0.29, 0, Math.sin(a) * 0.29], frame, [
        0,
        -a,
      ]);
  }
  part('metal', cylinder(0.032, 0.042, 0.16, 16), [0, 0.19, 0], frame);
  part('metal', cylinder(0.019, 0.019, 0.2, 14), [0, 0.35, 0], metal);
  part('trim', rounded(0.2, 0.04, 0.22, 0.012), [0, 0.43, 0], frame);
  part(
    'fabric',
    contouredCushion(0.5, 0.085, 0.48, 0.014, 0.024),
    [0, 0.49, 0],
    seat,
  );
  // The spine: one bent bar from under the seat up into the back shell.
  part(
    'trim',
    bentTube(
      [
        new THREE.Vector3(0, 0.43, 0.08),
        new THREE.Vector3(0, 0.43, 0.22),
        new THREE.Vector3(0, 0.5, 0.29),
        new THREE.Vector3(0, 0.72, 0.31),
      ],
      0.022,
      24,
      10,
    ),
    [0, 0, 0],
    frame,
  );
  part(
    'fabric',
    backShell(0.48, 0.54, 0.055, 0.045, 0.014),
    [0, 0.92, 0.33],
    back,
    [0.1, 0],
  );
  for (const s of [-1, 1]) {
    part(
      'trim',
      bentTube(
        [
          new THREE.Vector3(s * 0.12, 0.44, 0.06),
          new THREE.Vector3(s * 0.26, 0.45, 0.06),
          new THREE.Vector3(s * 0.28, 0.52, 0.06),
          new THREE.Vector3(s * 0.28, 0.66, 0.05),
        ],
        0.016,
        20,
        8,
      ),
      [0, 0, 0],
      frame,
    );
    part(
      'trim',
      contouredCushion(0.075, 0.028, 0.26, 0.004, 0),
      [s * 0.28, 0.69, 0.03],
      frame,
    );
  }
}

/**
 * The Pass 028 task chair, kept for the open-plan desks beyond the glass: seen only at a
 * distance and repeated at every workstation, so it stays light (V0.7 Pass 079).
 */
function distantTaskChair(b: Batcher, x: number, z: number, yaw: number): void {
  const cos = Math.cos(yaw),
    sin = Math.sin(yaw),
    seat = hex(CHAIR.seat),
    back = hex(CHAIR.back),
    frame = hex(CHAIR.frame),
    metal = hex(CHAIR.metal),
    part = (
      key: Key,
      geometry: THREE.BufferGeometry,
      [lx, y, lz]: readonly [number, number, number],
      color: Color,
      [rx, ry]: readonly [number, number] = [0, 0],
    ) =>
      b.add(
        key,
        geometry,
        [x + lx * cos + lz * sin, y, z - lx * sin + lz * cos],
        color,
        [rx, yaw + ry, 0],
      );
  // Five-star base on casters, with a hub.
  part('metal', cylinder(0.045, 0.05, 0.06, 16), [0, 0.075, 0], metal);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + Math.PI / 2;
    part(
      'trim',
      new THREE.BoxGeometry(0.29, 0.03, 0.045),
      [Math.cos(a) * 0.15, 0.07, Math.sin(a) * 0.15],
      frame,
      [0, -a],
    );
    part(
      'trim',
      new THREE.SphereGeometry(0.03, 8, 5),
      [Math.cos(a) * 0.29, 0.03, Math.sin(a) * 0.29],
      frame,
    );
  }
  // Gas lift and the mechanism plate under the seat.
  part('metal', cylinder(0.024, 0.024, 0.34, 12), [0, 0.27, 0], metal);
  part('trim', new THREE.BoxGeometry(0.2, 0.04, 0.22), [0, 0.43, 0], frame);
  // Seat.
  part('fabric', rounded(0.5, 0.08, 0.48, 0.03), [0, 0.48, 0], seat);
  // Spine: from the plate back under the seat, then up into the backrest.
  part('trim', new THREE.BoxGeometry(0.07, 0.03, 0.27), [0, 0.43, 0.15], frame);
  part(
    'trim',
    new THREE.BoxGeometry(0.07, 0.36, 0.03),
    [0, 0.6, 0.28],
    frame,
    [0.1, 0],
  );
  // Backrest, leaning back a little.
  part(
    'fabric',
    rounded(0.48, 0.52, 0.05, 0.03),
    [0, 0.9, 0.31],
    back,
    [0.1, 0],
  );
  // Armrests: a bracket under each side of the seat, a post, and the pad on top.
  for (const s of [-1, 1]) {
    part(
      'trim',
      new THREE.BoxGeometry(0.1, 0.03, 0.06),
      [s * 0.24, 0.44, 0.06],
      frame,
    );
    part(
      'trim',
      new THREE.BoxGeometry(0.035, 0.26, 0.05),
      [s * 0.28, 0.56, 0.06],
      frame,
    );
    part('trim', rounded(0.06, 0.03, 0.26, 0.01), [s * 0.28, 0.7, 0.03], frame);
  }
}

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
  /** Pass 027: the main ceiling light panel's centre (it was the desk lamp's bulb). */
  readonly lampBulb = new THREE.Vector3();
  /** V0.7 Pass 073: the desk lamp's bulb (a warm local light). */
  readonly deskLamp = new THREE.Vector3();
  /** Pass 027: the second ceiling panel, nearer the glass. */
  readonly panel = new THREE.Vector3();
  /** Window opening on the back wall (centre, size), for the daylight. */
  readonly window: { center: THREE.Vector3; width: number; height: number };
  /** Pass 027: the open-plan office beyond the glass (seen, never entered). */
  readonly openPlan = new THREE.Group();
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
    this.root.name = 'Glass office';
    this.openPlan.name = 'Open-plan office';
    const b = new Batcher(),
      r = OFFICE.room,
      w = OFFICE.window,
      d = OFFICE.door,
      H = r.max.y;
    const own = <T extends THREE.Texture>(t: T): T => {
      this.textures.push(t);
      return t;
    };
    const wood = own(woodTexture()),
      grasscloth = own(grassclothTexture());
    // V0.7 Pass 073: a warm palette (cream paint, warm charcoal trim, walnut, brushed steel),
    // so the room feels lived-in and belongs with the underwater worlds.
    const white = hex(0xefe6d6),
      black = hex(0x2a2420),
      darkWood = hex(0x6a4a33),
      chrome = hex(0xbdb7ae);

    // --- Room shell: grasscloth side walls, a white back wall around the window, black skirting.
    b.add(
      'wall',
      new THREE.PlaneGeometry(r.max.z - r.min.z, H),
      [r.min.x, H / 2, 0],
      [1, 1, 1],
      [0, Math.PI / 2, 0],
    );
    b.add(
      'wall',
      new THREE.PlaneGeometry(r.max.z - r.min.z, H),
      [r.max.x, H / 2, 0],
      [1, 1, 1],
      [0, -Math.PI / 2, 0],
    );
    const wx0 = w.centerX - w.width / 2,
      wx1 = w.centerX + w.width / 2,
      back = (cx: number, cy: number, width: number, height: number) =>
        b.add(
          'paint',
          new THREE.PlaneGeometry(width, height),
          [cx, cy, r.min.z],
          white,
        );
    back((r.min.x + wx0) / 2, H / 2, wx0 - r.min.x, H);
    back((wx1 + r.max.x) / 2, H / 2, r.max.x - wx1, H);
    back(w.centerX, w.sill / 2, w.width, w.sill);
    back(w.centerX, (w.top + H) / 2, w.width, H - w.top);
    for (const [x, z, len, ry] of [
      [0, r.min.z + 0.008, r.max.x - r.min.x, 0],
      [r.min.x + 0.008, 0, r.max.z - r.min.z, Math.PI / 2],
      [r.max.x - 0.008, 0, r.max.z - r.min.z, Math.PI / 2],
    ] as const)
      b.add('trim', rounded(len, 0.1, 0.015, 0.004), [x, 0.05, z], black, [
        0,
        ry,
        0,
      ]);

    // --- The glass front: black frame, a fixed panel with two mullions, and the closed door.
    const zf = r.max.z,
      f = OFFICE.frame,
      post = (x: number, y0: number, y1: number, depth = 0.07) =>
        b.add(
          'trim',
          new THREE.BoxGeometry(f, y1 - y0, depth),
          [x, (y0 + y1) / 2, zf],
          black,
        );
    const rail = (
      x0: number,
      x1: number,
      y: number,
      h: number = f,
      depth = 0.07,
    ) =>
      b.add(
        'trim',
        new THREE.BoxGeometry(x1 - x0, h, depth),
        [(x0 + x1) / 2, y, zf],
        black,
      );
    post(r.min.x + f / 2, 0, H);
    post(d.from, 0, H);
    post(d.to, 0, H);
    post(r.max.x - f / 2, 0, H);
    rail(r.min.x, r.max.x, H - f / 2);
    rail(r.min.x, d.from, 0.03, 0.06);
    rail(d.to, r.max.x, 0.03, 0.06);
    rail(r.min.x, d.from, 0.8, 0.035, 0.045);
    rail(r.min.x, d.from, 1.95, 0.035, 0.045);
    rail(d.from, d.to, d.height + f / 2);
    // The door leaf: its own slim frame, a lock body and lever on the inside.
    const leaf = 0.045,
      inner = zf - 0.03;
    for (const x of [d.from + f / 2 + leaf / 2, d.to - f / 2 - leaf / 2])
      b.add(
        'trim',
        new THREE.BoxGeometry(leaf, d.height - 0.02, 0.045),
        [x, (d.height - 0.02) / 2, inner],
        black,
      );
    for (const y of [0.05, d.height - 0.04])
      b.add(
        'trim',
        new THREE.BoxGeometry(d.to - d.from - f, leaf, 0.045),
        [(d.from + d.to) / 2, y, inner],
        black,
      );
    const handleX = d.from + 0.13;
    b.add(
      'trim',
      rounded(0.045, 0.24, 0.035, 0.006),
      [handleX, 1.02, inner - 0.04],
      black,
    );
    b.add(
      'trim',
      rounded(0.14, 0.022, 0.022, 0.006),
      [handleX + 0.06, 0.98, inner - 0.07],
      black,
    );
    // Glass in every opening of the front (one transparent draw).
    const glassPane = (
      x0: number,
      x1: number,
      y0: number,
      y1: number,
      z: number = zf,
    ) => {
      const g = new THREE.PlaneGeometry(x1 - x0, y1 - y0);
      g.translate((x0 + x1) / 2, (y0 + y1) / 2, z);
      return g;
    };
    const fronts = [
      glassPane(r.min.x + f, d.from - f / 2, 0.06, H - f),
      glassPane(d.to + f / 2, r.max.x - f, 0.06, H - f),
      glassPane(d.from + f / 2, d.to - f / 2, d.height + f, H - f),
      glassPane(
        d.from + f / 2 + leaf,
        d.to - f / 2 - leaf,
        0.07,
        d.height - 0.06,
        inner,
      ),
    ];

    // --- The back window: black frame, frosted below, clear above, the street beyond.
    const wy = (w.sill + w.top) / 2,
      wh = w.top - w.sill,
      wz = r.min.z - 0.05;
    for (const [x, y, sw, sh] of [
      [w.centerX, w.top - 0.025, w.width, 0.05],
      [w.centerX, w.sill + 0.025, w.width, 0.05],
      [wx0 + 0.025, wy, 0.05, wh],
      [wx1 - 0.025, wy, 0.05, wh],
      [w.centerX, w.frost, w.width, 0.04],
    ] as const)
      b.add('trim', new THREE.BoxGeometry(sw, sh, 0.06), [x, y, wz], black);
    for (const [x, sw] of [
      [wx0 - 0.03, 0.06],
      [wx1 + 0.03, 0.06],
    ] as const)
      b.add(
        'paint',
        new THREE.BoxGeometry(sw, wh, 0.1),
        [x, wy, r.min.z - 0.05],
        white,
      );
    b.add(
      'paint',
      rounded(w.width + 0.08, 0.03, 0.14, 0.006),
      [w.centerX, w.sill, r.min.z - 0.02],
      white,
    );
    this.window = {
      center: new THREE.Vector3(w.centerX, wy, r.min.z - 0.02),
      width: w.width,
      height: wh,
    };

    // --- Ceiling: two LED panels, an air-conditioning cassette, a small camera dome.
    this.lampBulb.set(-0.6, H - 0.12, -0.7);
    this.panel.set(0.6, H - 0.12, 1.05);
    for (const p of [this.lampBulb, this.panel])
      b.add(
        'glow',
        new THREE.BoxGeometry(0.6, 0.012, 1.2),
        [p.x, H - 0.006, p.z],
        [1, 1, 1],
      );
    b.add(
      'paint',
      new THREE.BoxGeometry(0.62, 0.035, 0.62),
      [0.75, H - 0.017, -0.75],
      white,
    );
    b.add(
      'trim',
      new THREE.BoxGeometry(0.42, 0.004, 0.42),
      [0.75, H - 0.036, -0.75],
      hex(0x9a9d9f),
    );
    b.add(
      'paint',
      new THREE.SphereGeometry(0.05, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2),
      [1.55, H - 0.0, -1.95],
      white,
      [Math.PI, 0, 0],
    );
    b.add(
      'trim',
      new THREE.SphereGeometry(0.03, 12, 8),
      [1.55, H - 0.03, -1.95],
      black,
    );
    // Light switch by the door and a thermostat on the left wall.
    b.add(
      'paint',
      rounded(0.012, 0.12, 0.08, 0.003),
      [r.max.x - 0.006, 1.15, 1.75],
      white,
    );
    b.add(
      'paint',
      rounded(0.012, 0.1, 0.07, 0.003),
      [r.min.x + 0.006, 1.4, 0.95],
      white,
    );

    // --- The L-desk. V0.7 Pass 079: walnut tops with eased edges over a slim apron, tapered
    // legs under the return, and a three-drawer pedestal carrying the main top's right end (was
    // thin slabs on black square tubes); the pale modesty panel stays.
    const top = OFFICE.desk.size.y,
      dk = OFFICE.desk,
      ret = OFFICE.deskReturn;
    b.add(
      'darkWood',
      rounded(dk.size.x, 0.036, dk.size.z, 0.012),
      [dk.center.x, top - 0.018, dk.center.z],
      darkWood,
    );
    b.add(
      'darkWood',
      rounded(ret.size.x, 0.036, ret.size.z, 0.012),
      [ret.center.x, top - 0.018, ret.center.z],
      darkWood,
    );
    const dx1 = dk.center.x + dk.size.x / 2 - 0.04,
      dz1 = dk.center.z + dk.size.z / 2 - 0.05;
    // Aprons under the tops' long edges.
    b.add(
      'darkWood',
      rounded(dk.size.x - 0.5, 0.07, 0.02, 0.006),
      [dk.center.x - 0.2, top - 0.07, dz1 + 0.03],
      darkWood,
    );
    b.add(
      'darkWood',
      rounded(0.02, 0.07, ret.size.z - 0.1, 0.006),
      [ret.center.x - ret.size.x / 2 + 0.04, top - 0.07, ret.center.z],
      darkWood,
    );
    const rx = ret.center.x,
      rz0 = ret.center.z - ret.size.z / 2 + 0.05;
    for (const lx of [rx - ret.size.x / 2 + 0.05, rx + ret.size.x / 2 - 0.05])
      b.add(
        'darkWood',
        taperedLeg(top - 0.036, 0.05, 0.034),
        [lx, 0, rz0],
        darkWood,
      );
    // The pedestal: a walnut case with three drawers facing the chair, bar pulls and a toe kick.
    const px = dx1 - 0.17,
      pw = 0.38,
      pd = dk.size.z - 0.08,
      ph = top - 0.036;
    b.add(
      'darkWood',
      rounded(pw, ph - 0.05, pd, 0.008),
      [px, 0.05 + (ph - 0.05) / 2, dk.center.z],
      darkWood,
    );
    b.add(
      'trim',
      new THREE.BoxGeometry(pw - 0.04, 0.05, pd - 0.04),
      [px, 0.025, dk.center.z],
      black,
    );
    const drawerFace = dk.center.z - pd / 2 - 0.008,
      drawerWood = hex(0x6b4a33);
    [0.2, 0.2, 0.26].reduce((y0, dh) => {
      b.add(
        'darkWood',
        rounded(pw - 0.03, dh - 0.012, 0.018, 0.005),
        [px, y0 + dh / 2, drawerFace],
        drawerWood,
      );
      b.add(
        'metal',
        rounded(0.13, 0.012, 0.014, 0.005),
        [px, y0 + dh - 0.045, drawerFace - 0.016],
        chrome,
      );
      for (const s of [-1, 1])
        b.add(
          'metal',
          cylinder(0.005, 0.005, 0.012, 8),
          [px + s * 0.055, y0 + dh - 0.045, drawerFace - 0.01],
          chrome,
          [Math.PI / 2, 0, 0],
        );
      return y0 + dh;
    }, 0.06);
    b.add(
      'paint',
      new THREE.BoxGeometry(dk.size.x - 0.6, 0.42, 0.016),
      [dk.center.x - 0.21, top - 0.28, dz1 + 0.02],
      hex(0xd8cdb8),
    );
    // Two monitors on arms, facing the desk chair (their screens glow softly; generic).
    const screens: THREE.BufferGeometry[] = [];
    for (const mx of [dk.center.x - 0.33, dk.center.x + 0.3]) {
      const mz = dk.center.z + 0.18;
      // V0.7 Pass 079: a slim bezel with a tapered housing behind it, on a curved neck and an
      // oval foot (was a slab on a pole and a plate).
      b.add(
        'trim',
        rounded(0.56, 0.34, 0.012, 0.005),
        [mx, top + 0.33, mz],
        black,
      );
      b.add(
        'trim',
        rounded(0.36, 0.22, 0.03, 0.012),
        [mx, top + 0.32, mz + 0.018],
        black,
      );
      b.add(
        'metal',
        bentTube(
          [
            new THREE.Vector3(mx, top + 0.01, mz + 0.07),
            new THREE.Vector3(mx, top + 0.12, mz + 0.075),
            new THREE.Vector3(mx, top + 0.24, mz + 0.05),
            new THREE.Vector3(mx, top + 0.3, mz + 0.032),
          ],
          0.013,
          20,
          10,
        ),
        [0, 0, 0],
        chrome,
      );
      b.add(
        'metal',
        cylinder(0.08, 0.085, 0.012, 24),
        [mx, top + 0.006, mz + 0.06],
        chrome,
        [0, 0, 0],
        [1, 1, 0.7],
      );
      const s = new THREE.PlaneGeometry(0.53, 0.31);
      s.rotateY(Math.PI);
      s.translate(mx, top + 0.33, mz - 0.0135);
      screens.push(s);
    }
    // Keyboard, mouse on a plain mat, papers, an open notebook, sticky notes and a succulent.
    b.add(
      'trim',
      rounded(0.44, 0.018, 0.13, 0.005),
      [dk.center.x, top + 0.009, dk.center.z - 0.12],
      hex(0x232427),
    );
    b.add(
      'fabric',
      rounded(0.26, 0.004, 0.22, 0.004),
      [dk.center.x + 0.36, top + 0.002, dk.center.z - 0.13],
      hex(0x34465e),
    );
    b.add(
      'trim',
      new THREE.SphereGeometry(0.03, 14, 10),
      [dk.center.x + 0.36, top + 0.012, dk.center.z - 0.13],
      black,
      [0, 0, 0],
      [1, 0.5, 1.4],
    );
    const paper = hex(0xf3f1ea);
    for (const [px, pz, ry] of [
      [dk.center.x - 0.6, dk.center.z - 0.05, 0.12],
      [dk.center.x - 0.55, dk.center.z - 0.02, -0.08],
    ] as const)
      b.add(
        'paper',
        new THREE.BoxGeometry(0.21, 0.002, 0.297),
        [px, top + 0.002, pz],
        paper,
        [0, ry, 0],
      );
    b.add(
      'paper',
      new THREE.BoxGeometry(0.3, 0.012, 0.21),
      [dk.center.x - 0.22, top + 0.006, dk.center.z + 0.02],
      hex(0xebe3cf),
      [0, -0.2, 0],
    );
    for (const [nx, nz, c] of [
      [dk.center.x - 0.64, dk.center.z + 0.06, 0xf6c84c],
      [dk.center.x + 0.62, dk.center.z + 0.2, 0xf7a3b5],
      [dk.center.x + 0.68, dk.center.z + 0.12, 0xa8d8ea],
      [dk.center.x - 0.2, dk.center.z + 0.25, 0xf6e27a],
    ] as const)
      b.add(
        'paper',
        new THREE.BoxGeometry(0.075, 0.004, 0.075),
        [nx, top + 0.006, nz],
        hex(c),
      );
    this.potPlant(
      b,
      dk.center.x + 0.05,
      top,
      dk.center.z + 0.25,
      0.04,
      0.06,
      hex(0xe9e7e2),
      31,
      'succulent',
    );
    b.add(
      'ceramic',
      cylinder(0.025, 0.025, 0.08, 14),
      [dk.center.x + 0.14, top + 0.04, dk.center.z + 0.27],
      hex(0xd8e2e0),
    );

    // --- The desk chair, facing the desk (+z).
    taskChair(b, OFFICE.chair.center.x, OFFICE.chair.center.z, Math.PI);
    // --- Guest chairs facing the desk. V0.7 Pass 079: a sled-base chair: each side one bent
    // chrome tube (floor runner, front leg, seat rail, back upright) with an armrest loop, a cross
    // brace, a dished rust cushion and a curved cream back shell (were a slab on four poles).
    for (const c of OFFICE.guestChairs) {
      const v = (x: number, y: number, z: number) =>
        new THREE.Vector3(c.x + x, y, c.z + z);
      for (const sx of [-0.21, 0.21]) {
        b.add(
          'metal',
          bentTube(
            [
              v(sx, 0.016, 0.19),
              v(sx, 0.016, -0.12),
              v(sx, 0.036, -0.2),
              v(sx, 0.2, -0.205),
              v(sx, 0.41, -0.19),
              v(sx, 0.42, 0.12),
              v(sx, 0.52, 0.21),
              v(sx, 0.9, 0.25),
            ],
            0.011,
            64,
            10,
          ),
          [0, 0, 0],
          chrome,
        );
        b.add(
          'metal',
          bentTube(
            [
              v(sx, 0.42, -0.12),
              v(sx * 1.05, 0.6, -0.1),
              v(sx * 1.08, 0.64, 0.05),
              v(sx, 0.66, 0.2),
            ],
            0.009,
            28,
            8,
          ),
          [0, 0, 0],
          chrome,
        );
        b.add(
          'trim',
          contouredCushion(0.05, 0.022, 0.2, 0.003, 0),
          [c.x + sx * 1.08, 0.66, c.z + 0.05],
          black,
        );
      }
      b.add(
        'metal',
        bentTube(
          [v(-0.21, 0.41, 0.05), v(0, 0.4, 0.05), v(0.21, 0.41, 0.05)],
          0.008,
          12,
          8,
        ),
        [0, 0, 0],
        chrome,
      );
      b.add(
        'fabric',
        contouredCushion(0.46, 0.07, 0.44, 0.012, 0.02),
        [c.x, 0.46, c.z],
        hex(0x9a5236),
      );
      b.add(
        'paint',
        backShell(0.44, 0.3, 0.035, 0.03, 0.008),
        [c.x, 0.8, c.z + 0.23],
        hex(0xd9ccb4),
        [0.12, 0, 0],
      );
    }
    // V0.7 Pass 073: lived-in touches. A wool rug under the guest chairs (its top below the baked
    // contact shadows), a desk lamp with a warm glowing shade, a stack of books, and a floor plant
    // in the front corner (in OFFICE.plants, so walking collides with it).
    b.add(
      'fabric',
      rounded(1.6, 0.005, 1.3, 0.004),
      [-0.95, 0.0025, 0.02],
      hex(0x7a5a46),
    );
    b.add(
      'fabric',
      rounded(1.42, 0.006, 1.12, 0.004),
      [-0.95, 0.003, 0.02],
      hex(0xbfa985),
    );
    b.add(
      'fabric',
      rounded(1.24, 0.007, 0.94, 0.004),
      [-0.95, 0.0035, 0.02],
      hex(0x8f6d55),
    );
    {
      const dk = OFFICE.desk,
        top = dk.size.y,
        lx = dk.center.x - 0.62,
        lz = dk.center.z - 0.2;
      b.add(
        'metal',
        cylinder(0.075, 0.085, 0.022, 24),
        [lx, top + 0.011, lz],
        hex(0x3a3330),
      );
      b.add(
        'metal',
        cylinder(0.009, 0.009, 0.36, 10),
        [lx, top + 0.2, lz],
        hex(0x3a3330),
        [0, 0, 0.18],
      );
      b.add(
        'metal',
        cylinder(0.008, 0.008, 0.26, 10),
        [lx + 0.07, top + 0.42, lz],
        hex(0x3a3330),
        [0, 0, -0.95],
      );
      b.add(
        'paint',
        cylinder(0.05, 0.095, 0.11, 24),
        [lx + 0.18, top + 0.43, lz],
        hex(0xc9b48a),
        [0, 0, -0.35],
      );
      b.add(
        'glow',
        cylinder(0.045, 0.045, 0.004, 20),
        [lx + 0.2, top + 0.375, lz],
        hex(0xffd59a),
        [0, 0, -0.35],
      );
      this.deskLamp.set(lx + 0.2, top + 0.33, lz);
      // A short stack of books by the lamp.
      for (const [i, c] of [
        hex(0x5b6b4a),
        hex(0x8a4b32),
        hex(0xd8c9a4),
      ].entries())
        b.add(
          'paper',
          rounded(0.24, 0.035, 0.17, 0.006),
          [lx + 0.02, top + 0.0175 + i * 0.036, lz + 0.22],
          c,
          [0, 0.12 * i - 0.1, 0],
        );
    }
    for (const p of OFFICE.plants)
      this.potPlant(
        b,
        p.x,
        0,
        p.z,
        p.radius,
        0.38,
        hex(0xb5694a),
        31,
        'fiddle',
        p.height,
      );
    // --- Boxes in the back-right corner.
    const bx = OFFICE.boxes;
    // V0.7 Pass 079: real cardboard boxes: softened edges, a tape strip over the seam, and the top
    // box's flaps folded half open.
    b.add(
      'paper',
      rounded(0.48, 0.32, 0.4, 0.008),
      [bx.center.x, 0.16, bx.center.z],
      hex(0xa8865c),
    );
    b.add(
      'paper',
      new THREE.BoxGeometry(0.06, 0.004, 0.402),
      [bx.center.x, 0.321, bx.center.z],
      hex(0xc9b48a),
    );
    b.add(
      'paper',
      new THREE.BoxGeometry(0.06, 0.12, 0.004),
      [bx.center.x, 0.26, bx.center.z - 0.201],
      hex(0xc9b48a),
    );
    b.add(
      'paper',
      rounded(0.4, 0.24, 0.34, 0.006),
      [bx.center.x - 0.02, 0.44, bx.center.z + 0.01],
      hex(0xb39268),
      [0, 0.12, 0],
    );
    // The front flap stands half open toward the room; the back one lies folded on the top.
    b.add(
      'paper',
      new THREE.BoxGeometry(0.4, 0.004, 0.17),
      [bx.center.x - 0.02, 0.6, bx.center.z + 0.25],
      hex(0xb8986c),
      [0.7, 0.12, 0],
    );
    b.add(
      'paper',
      new THREE.BoxGeometry(0.4, 0.004, 0.17),
      [bx.center.x - 0.02, 0.565, bx.center.z - 0.07],
      hex(0xb8986c),
      [0, 0.12, 0],
    );

    // --- Aquarium cabinet (V0.7 Pass 073: dark walnut, so it sits in the warm room) and the tank.
    // V0.7 Pass 079: a proper cabinet (was a box with a line and two handles): a walnut carcass
    // under an overhanging top, a recessed toe kick, and two frame-and-panel doors with bar pulls.
    const st = OFFICE.stand,
      walnut = hex(0x4a3426),
      doorWood = hex(0x553b2a);
    b.add(
      'darkWood',
      rounded(st.size.x - 0.03, st.size.y - 0.12, st.size.z - 0.03, 0.008),
      [st.center.x + 0.015, 0.08 + (st.size.y - 0.12) / 2, st.center.z],
      walnut,
    );
    b.add(
      'darkWood',
      rounded(st.size.x, 0.04, st.size.z, 0.01),
      [st.center.x, st.size.y - 0.02, st.center.z],
      walnut,
    );
    b.add(
      'trim',
      new THREE.BoxGeometry(st.size.x - 0.08, 0.08, st.size.z - 0.08),
      [st.center.x + 0.02, 0.04, st.center.z],
      black,
    );
    const face = st.center.x - st.size.x / 2 + 0.015,
      doorH = st.size.y - 0.17,
      doorW = (st.size.z - 0.05) / 2;
    for (const s of [-1, 1]) {
      const dz = st.center.z + s * (doorW / 2 + 0.006),
        dy = 0.09 + doorH / 2,
        door = panelDoor(doorW, doorH);
      for (const g of door.frame)
        b.add('darkWood', g, [face, dy, dz], doorWood);
      b.add('darkWood', door.panel, [face, dy, dz], walnut);
      b.add(
        'metal',
        rounded(0.012, 0.16, 0.012, 0.005),
        [face - 0.034, dy + 0.06, dz - s * (doorW / 2 - 0.05)],
        chrome,
      );
      for (const k of [-1, 1])
        b.add(
          'metal',
          cylinder(0.005, 0.005, 0.016, 8),
          [face - 0.024, dy + 0.06 + k * 0.065, dz - s * (doorW / 2 - 0.05)],
          chrome,
          [0, 0, Math.PI / 2],
        );
    }
    this.buildTank(b);

    // --- Clock on the back wall, left of the window.
    const built = b.build();
    for (const [key, geometry] of built) {
      this.geometries.push(geometry);
      const mesh = new THREE.Mesh(
        geometry,
        this.batchMaterial(key, wood, grasscloth),
      );
      mesh.name = `Office ${key}`;
      this.root.add(mesh);
    }
    const tiles = own(plankFloorTexture());
    tiles.repeat.set((r.max.x - r.min.x) / 1.2, (r.max.z - r.min.z) / 1.2);
    const floorGeometry = new THREE.PlaneGeometry(
      r.max.x - r.min.x,
      r.max.z - r.min.z,
    );
    floorGeometry.rotateX(-Math.PI / 2);
    this.plane(
      floorGeometry,
      new THREE.MeshStandardMaterial({ map: tiles, roughness: 0.62 }),
      'Office floor',
    );
    const ceilingMap = own(ceilingTileTexture());
    ceilingMap.repeat.set((r.max.x - r.min.x) / 0.6, (r.max.z - r.min.z) / 0.6);
    const ceiling = new THREE.PlaneGeometry(
      r.max.x - r.min.x,
      r.max.z - r.min.z,
    );
    ceiling.rotateX(Math.PI / 2);
    ceiling.translate(0, H, 0);
    this.plane(
      ceiling,
      new THREE.MeshStandardMaterial({ map: ceilingMap, roughness: 0.95 }),
      'Office ceiling',
    );
    // Pass 022: soft baked contact shadows under the furniture and along the walls (one draw).
    this.plane(
      contactShadowGeometry(officeShadowLayout()),
      contactShadowMaterial(),
      'Office contact shadows',
    );
    const screenGeometry = mergeGeometries(screens, false);
    screens.forEach((g) => g.dispose());
    if (!screenGeometry) throw Error('Office screens could not merge');
    this.plane(
      screenGeometry,
      new THREE.MeshBasicMaterial({ map: own(screenTexture()) }),
      'Monitor screens',
    );
    const glassGeometry = mergeGeometries(fronts, false);
    fronts.forEach((g) => g.dispose());
    if (!glassGeometry) throw Error('Office glass could not merge');
    const glass = new THREE.MeshStandardMaterial({
      color: 0xdfece9,
      roughness: 0.06,
      metalness: 0,
      transparent: true,
      opacity: 0.12,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    glass.name = 'Office glass';
    this.plane(glassGeometry, glass, 'Office glass front').renderOrder = 2;
    // The street beyond the window, then frosted film below and rain on the clear pane above.
    const street = new THREE.PlaneGeometry(6, 4);
    street.translate(w.centerX, 1.6, r.min.z - 2.5);
    this.plane(
      street,
      new THREE.MeshBasicMaterial({ map: own(streetTexture()) }),
      'Street view',
    );
    const frosted = new THREE.PlaneGeometry(
      w.width - 0.06,
      w.frost - w.sill - 0.06,
    );
    frosted.translate(w.centerX, (w.sill + w.frost) / 2, wz - 0.01);
    this.plane(
      frosted,
      new THREE.MeshStandardMaterial({
        color: 0xe8eeef,
        roughness: 0.9,
        transparent: true,
        opacity: 0.9,
      }),
      'Frosted window',
    );
    this.rain = new THREE.ShaderMaterial({
      uniforms: { time: { value: 0 } },
      vertexShader: RAIN_VERTEX,
      fragmentShader: RAIN_FRAGMENT,
      transparent: true,
      depthWrite: false,
    });
    const pane = new THREE.PlaneGeometry(
      w.width - 0.06,
      w.top - w.frost - 0.06,
    );
    pane.translate(w.centerX, (w.frost + w.top) / 2, wz - 0.01);
    this.plane(pane, this.rain, 'Rainy window');
    const clock = new THREE.Group();
    clock.position.set(-0.7, 2.05, r.min.z + 0.03);
    clock.name = 'Wall clock';
    const rim = new THREE.TorusGeometry(0.15, 0.014, 10, 40);
    this.geometries.push(rim);
    const rimMaterial = new THREE.MeshStandardMaterial({
      color: 0x1c1d1f,
      roughness: 0.45,
    });
    this.materials.push(rimMaterial);
    clock.add(new THREE.Mesh(rim, rimMaterial));
    const faceGeometry = new THREE.CircleGeometry(0.148, 40);
    this.geometries.push(faceGeometry);
    const faceMaterial = new THREE.MeshStandardMaterial({
      map: own(clockTexture()),
      roughness: 0.6,
    });
    this.materials.push(faceMaterial);
    clock.add(new THREE.Mesh(faceGeometry, faceMaterial));
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
      hour: hand(0.08, 0.011, 0.006),
      minute: hand(0.12, 0.007, 0.01),
      second: hand(0.13, 0.003, 0.014, 0xa8442f),
    };
    this.root.add(clock);
    this.buildOpenPlan(wood);
    this.root.add(this.openPlan);
    this.update(0, false);
  }

  /** One material per batch key (vertex colour carries each part's tint). */
  private batchMaterial(
    key: Key,
    wood: THREE.Texture,
    grasscloth: THREE.Texture,
  ): THREE.Material {
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
                  ? grasscloth
                  : null,
            roughness:
              key === 'metal'
                ? 0.3
                : key === 'ceramic'
                  ? 0.32
                  : key === 'fabric'
                    ? 0.95
                    : key === 'leaf'
                      ? 0.62
                      : key === 'trim'
                        ? 0.45
                        : key === 'darkWood'
                          ? 0.55
                          : 0.8,
            metalness: key === 'metal' ? 0.6 : 0,
            side:
              key === 'leaf' || key === 'wall' || key === 'paint'
                ? THREE.DoubleSide
                : THREE.FrontSide,
          });
    m.name = `Office ${key}`;
    this.materials.push(m);
    return m;
  }

  /**
   * Pass 027: the open-plan office seen through the glass. White walls, the same tiles and ceiling,
   * rows of workstations with monitors and black task chairs, three framed posters (generic art,
   * no text) on the far wall. Never entered, so it is simple, and built as its own few draws.
   */
  private buildOpenPlan(wood: THREE.Texture): void {
    const b = new Batcher(),
      p = OFFICE.openPlan,
      H = p.height,
      white = hex(0xf1f1ee),
      black = hex(0x1b1c1e),
      desk = hex(0xf2f2f0),
      grey = hex(0x8d9194);
    const width = p.max.x - p.min.x,
      depth = p.max.z - p.min.z,
      cx = (p.min.x + p.max.x) / 2,
      cz = (p.min.z + p.max.z) / 2;
    // Walls: far wall, both sides, and the fronts of the neighbouring rooms beside ours.
    b.add(
      'paint',
      new THREE.PlaneGeometry(width, H),
      [cx, H / 2, p.max.z],
      white,
      [0, Math.PI, 0],
    );
    b.add(
      'paint',
      new THREE.PlaneGeometry(depth, H),
      [p.min.x, H / 2, cz],
      white,
      [0, Math.PI / 2, 0],
    );
    b.add(
      'paint',
      new THREE.PlaneGeometry(depth, H),
      [p.max.x, H / 2, cz],
      white,
      [0, -Math.PI / 2, 0],
    );
    const room = OFFICE.room;
    b.add(
      'paint',
      new THREE.PlaneGeometry(room.min.x - p.min.x, H),
      [(p.min.x + room.min.x) / 2, H / 2, p.min.z],
      hex(0xc9c6c0),
    );
    b.add(
      'paint',
      new THREE.PlaneGeometry(p.max.x - room.max.x, H),
      [(p.max.x + room.max.x) / 2, H / 2, p.min.z],
      hex(0xc9c6c0),
    );
    b.add(
      'paint',
      new THREE.PlaneGeometry(room.max.x - room.min.x, H - room.max.y),
      [0, (H + room.max.y) / 2, p.min.z],
      white,
    );
    // Ceiling light panels in rows.
    for (const x of [-3.6, -1.2, 1.2, 3.6])
      for (const z of [4.2, 7.6])
        b.add(
          'glow',
          new THREE.BoxGeometry(0.6, 0.01, 1.2),
          [x, H - 0.005, z],
          [1, 1, 1],
        );
    // Workstations: facing pairs of white desks, each with its monitors along the shared
    // partition and a task chair on the open side. `toward` is +1 when the partition is at +z.
    // (Pass 028 playtest: the chairs had been placed through the partition, inside the opposite
    // desk, with the monitors at the open edge.)
    const workstation = (x: number, z: number, toward: number) => {
      b.add('paint', rounded(1.4, 0.03, 0.7, 0.004), [x, 0.74, z], desk);
      for (const sx of [-0.66, 0.66])
        b.add(
          'metal',
          new THREE.BoxGeometry(0.04, 0.72, 0.6),
          [x + sx, 0.36, z],
          grey,
        );
      for (const mx of [-0.3, 0.3]) {
        b.add(
          'trim',
          rounded(0.5, 0.3, 0.025, 0.005),
          [x + mx, 1.08, z + toward * 0.2],
          black,
        );
        b.add(
          'metal',
          cylinder(0.012, 0.012, 0.2, 8),
          [x + mx, 0.86, z + toward * 0.22],
          grey,
        );
        b.add(
          'metal',
          new THREE.BoxGeometry(0.18, 0.012, 0.12),
          [x + mx, 0.761, z + toward * 0.22],
          grey,
        );
      }
      // The sitter faces the desk: -z at yaw 0, +z at yaw pi.
      distantTaskChair(b, x, z - toward * 0.62, toward > 0 ? Math.PI : 0);
    };
    for (const z of [4.4, 7.8])
      for (const x of [-3.2, -1.7, 1.7, 3.2]) {
        workstation(x, z - 0.36, 1);
        workstation(x, z + 0.36, -1);
        b.add(
          'paint',
          new THREE.BoxGeometry(1.4, 0.32, 0.03),
          [x, 0.92, z],
          hex(0xe4e8e8),
        );
      }
    // A coat over one chair, binders and a cabinet by the left wall, a plant.
    b.add(
      'fabric',
      rounded(0.44, 0.5, 0.1, 0.04),
      // Over the backrest of the chair at (-1.7, 4.04 - 0.62), which faces +z.
      [-1.7, 0.86, 4.04 - 0.62 - 0.34],
      hex(0x23252a),
      [-0.1, 0, 0],
    );
    b.add(
      'trim',
      rounded(0.5, 0.7, 1.2, 0.01),
      [p.min.x + 0.3, 0.35, 5.2],
      hex(0x2a2b2d),
    );
    for (let i = 0; i < 8; i++)
      b.add(
        'paper',
        new THREE.BoxGeometry(0.05, 0.3, 0.24),
        [p.min.x + 0.3, 0.86, 4.8 + i * 0.07],
        hex(
          [
            0x3d6fb6, 0xd8d8d8, 0xb94a5a, 0x4a9a6a, 0xe0c25a, 0x7a6ab0,
            0xd8d8d8, 0x3d6fb6,
          ][i],
        ),
      );
    this.potPlant(b, 5.8, 0, 9.5, 0.2, 0.4, hex(0xe6e3dc), 17, 'snake', 1.2);
    // Black frames for the three posters on the far wall.
    for (const x of POSTERS)
      b.add(
        'trim',
        new THREE.BoxGeometry(0.8, 1.06, 0.03),
        [x, 1.7, p.max.z - 0.02],
        hex(0x18191b),
      );
    for (const [key, geometry] of b.build()) {
      this.geometries.push(geometry);
      const mesh = new THREE.Mesh(
        geometry,
        this.batchMaterial(key, wood, wood),
      );
      mesh.name = `Open-plan ${key}`;
      this.openPlan.add(mesh);
    }
    // Floor and ceiling, as in the private office.
    const tiles = this.ownTexture(tileTexture());
    tiles.repeat.set(width / 0.6, depth / 1.2);
    const floor = new THREE.PlaneGeometry(width, depth);
    floor.rotateX(-Math.PI / 2);
    floor.translate(cx, 0, cz);
    this.openPlanPart(
      floor,
      new THREE.MeshStandardMaterial({ map: tiles, roughness: 0.35 }),
      'Open-plan floor',
    );
    const ceilingMap = this.ownTexture(ceilingTileTexture());
    ceilingMap.repeat.set(width / 0.6, depth / 0.6);
    const ceiling = new THREE.PlaneGeometry(width, depth);
    ceiling.rotateX(Math.PI / 2);
    ceiling.translate(cx, H, cz);
    this.openPlanPart(
      ceiling,
      new THREE.MeshStandardMaterial({ map: ceilingMap, roughness: 0.95 }),
      'Open-plan ceiling',
    );
    // The posters' art: one mesh over one texture, each plane taking its third of it.
    const art = POSTERS.map((x, i) => {
      const plane = new THREE.PlaneGeometry(0.72, 0.98),
        uv = plane.getAttribute('uv');
      for (let v = 0; v < uv.count; v++) uv.setX(v, (i + uv.getX(v)) / 3);
      plane.rotateY(Math.PI);
      plane.translate(x, 1.7, p.max.z - 0.036);
      return plane;
    });
    const posters = mergeGeometries(art, false);
    art.forEach((g) => g.dispose());
    this.openPlanPart(
      posters,
      new THREE.MeshStandardMaterial({
        map: this.ownTexture(posterTexture()),
        roughness: 0.7,
      }),
      'Open-plan posters',
    );
  }
  private ownTexture<T extends THREE.Texture>(t: T): T {
    this.textures.push(t);
    return t;
  }
  private openPlanPart(
    geometry: THREE.BufferGeometry,
    material: THREE.Material,
    name: string,
  ): THREE.Mesh {
    this.geometries.push(geometry);
    if (!this.materials.includes(material)) this.materials.push(material);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = name;
    this.openPlan.add(mesh);
    return mesh;
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
