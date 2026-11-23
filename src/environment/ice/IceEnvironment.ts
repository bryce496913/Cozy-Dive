import { HabitatSurface } from '../shared/HabitatSurface';
import * as THREE from 'three';
import {
  type Geology,
  type GeologyPlacement,
  placeGeology,
} from '../shared/Geology';
import { WATER_PROFILES } from '../../config/waterProfiles';
import { beamGeometry, beamMaterial } from '../shared/LightBeam';
import { PassageGlow } from '../shared/PassageGlow';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { ICE, ICE_FRAME } from '../../config/passage';
import type { ConvexCollider } from '../../player/collision';
import { boxCollider } from '../passage/Crevice';
import { rockShape } from '../RockGeometry';
import { rockCollider } from '../rockCollider';
import {
  bushyAlgaGeometry,
  strapAlgaGeometry,
  SwayingAlgae,
  type AlgaPlacement,
} from '../shared/LargeLife';
import { inIceLane } from './IceGarden';
import {
  icicles,
  tunnelThroat,
  mouthCollar,
  rockTubeColliders,
  rockTubeGeometry,
  type Tube,
} from '../shared/RockTube';
import { iceFloor, iceUndersideAt } from './IceTerrain';
import { type IceKind, iceForm } from './IceForms';
import { mouthArch } from '../shared/MouthArch';

/**
 * v0.6 Pass 046: the waters under the ice, built in code. A tunnel through a dark rock wall opens
 * into a tank the size of the kelp forest: icebergs, faceted and blue-white, crowd its sides and
 * far end from the seabed up through the sea ice; the ice above is a lumpy pale sheet hung with
 * smaller chunks, broken by three breathing holes where daylight shows and falls in soft shafts to
 * a seabed of grey gravel and silt. Everything solid has colliders; the soft limits keep the
 * swimmer a little short of it. One draw per material (ice, rock, seabed, light). Owns its GPU
 * resources.
 */
/** V0.8 Pass 093: the geology variants used for the dropstones and the outcrops. */
const DROPSTONE_ROCKS = [
  'KelpRock_1',
  'CaveRock_1',
  'KelpRock_3',
  'CaveRock_0',
];
const OUTCROP_ROCKS = ['KelpRock_0', 'KelpRock_5', 'CaveRock_2', 'KelpRock_2'];

export const ICE_LAYOUT = {
  seed: 46001,
  /** Ice chunks hanging under the sheet, and dropstones on the seabed. */
  hanging: 46,
  stones: 28,
  /** The tunnel's duct (as the cave's). */
  duct: 1.22,
  wall: 0.6,
} as const;

/**
 * The rock wall's face (z) at (x, y): bulging rock, smoothed into a clean round mouth at the
 * tunnel's hole (V0.8 Pass 086: shared with the mouth's arch, which grows out of it).
 */
function iceWallFace(x: number, y: number): number {
  const t = ICE.tunnel,
    r = Math.hypot(x, y - t.y),
    bulge =
      0.6 * Math.sin(x * 0.7 + y * 0.4) * Math.sin(y * 0.9 - x * 0.3) +
      0.25 * Math.sin(x * 2.1 + y * 1.7),
    k = Math.min(1, Math.max(0, (r - t.radius - 0.2) / 1.2));
  return t.wallZ - bulge * k - 0.4 * k;
}
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
      // v0.6 Pass 052 (playtest: "everything needs more detail"): layers of deep blue,
      // compressed ice; dark dirt bands in the basal ice near the seabed; pale vertical melt
      // flutes; and white rime up under the sea ice.
      layer =
        Math.max(0, Math.sin(y * 2.1 + 0.4 * Math.sin(x * 0.35 + z * 0.3))) **
        6,
      flute = Math.max(0, Math.sin(x * 3.1 + z * 2.7)) ** 8,
      dirt =
        Math.max(0, 1 - y / 1.6) * Math.max(0, Math.sin(y * 9 + x * 0.6)) ** 4,
      rime = Math.min(1, Math.max(0, (y - (ICE.ceiling - 1.5)) / 1.5)),
      blue = Math.min(1, deep * (0.35 + 0.65 * n) + 0.45 * layer),
      r = 0.86 - 0.32 * blue + 0.06 * flute - 0.35 * dirt + 0.1 * rime,
      g = 0.93 - 0.18 * blue + 0.04 * flute - 0.38 * dirt + 0.06 * rime,
      b = 0.98 - 0.04 * blue + 0.02 * flute - 0.42 * dirt + 0.02 * rime,
      // V0.7 Pass 081 (Pass 080 P1: the ice shared one pale value range with the seabed): ice
      // deepens in value and turns bluer toward its foot, where less daylight reaches it, so
      // the masses rise dark-to-light out of the pale seabed instead of melting into it.
      lit = 0.68 + 0.32 * Math.min(1, Math.max(0, y / ICE.ceiling));
    c.setXYZ(i, r * lit, g * lit ** 0.8, b * lit ** 0.45);
  }
  c.needsUpdate = true;
}

/** V0.8 Pass 093: a breathing hole's edge radius at heading `a`: irregular, worn, not a circle. */
export function holeEdge(
  h: { x: number; z: number; r: number },
  a: number,
): number {
  return (
    h.r *
    (1 +
      0.09 * Math.sin(a * 3 + h.x * 0.7) +
      0.05 * Math.sin(a * 5 - h.z * 0.4) +
      0.025 * Math.sin(a * 11 + h.x))
  );
}
/**
 * V0.8 Pass 093: a breathing hole's shaft through the sea ice, facing inward: from a rounded lip
 * curling out under the sheet, up its melt-scalloped wall (wider at the bottom, where the water
 * melts it) to the daylight. Non-indexed, positions, normals and ice colours.
 */
function holeShaft(h: {
  x: number;
  z: number;
  r: number;
}): THREE.BufferGeometry {
  const sides = 56,
    rows: [number, number][] = [
      // (radius offset, height above the sheet), from the lip under the sheet upward.
      [0.5, -0.32],
      [0.22, -0.3],
      [0.06, -0.18],
      [0.02, 0.05],
      [0.0, 0.5],
      [-0.03, 1.1],
      [-0.06, 1.7],
      [-0.08, 2.4],
    ],
    pos: number[] = [],
    idx: number[] = [];
  for (const [dr, dy] of rows)
    for (let j = 0; j < sides; j++) {
      const a = (j / sides) * Math.PI * 2,
        scallop =
          0.05 * Math.sin(a * 13 + dy * 4) * Math.min(1, Math.max(0, dy)),
        r = holeEdge(h, a) + dr + scallop,
        x = h.x + Math.cos(a) * r,
        z = h.z + Math.sin(a) * r;
      pos.push(x, iceUndersideAt(x, z) - 0.22 + dy, z);
    }
  // Wound so the faces look inward (into the hole) and down under the lip.
  for (let i = 0; i + 1 < rows.length; i++)
    for (let j = 0; j < sides; j++) {
      const a = i * sides + j,
        b = i * sides + ((j + 1) % sides),
        c = a + sides,
        d = b + sides;
      idx.push(a, b, c, b, d, c);
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  const flat = g.toNonIndexed();
  g.dispose();
  flat.setAttribute(
    'color',
    new THREE.Float32BufferAttribute(
      new Float32Array(flat.getAttribute('position').count * 3),
      3,
    ),
  );
  iceColours(flat, 0.6);
  return flat;
}

/** The underside of the sea ice: a lumpy sheet, its breathing holes open (pure; non-indexed). */
export function seaIceSheet(top: number): THREE.BufferGeometry {
  const sheet = new THREE.PlaneGeometry(60, 76, 120, 152);
  sheet.rotateX(Math.PI / 2);
  sheet.translate(0, top, -34);
  const sp = sheet.getAttribute('position');
  sheet.setAttribute(
    'color',
    new THREE.Float32BufferAttribute(new Float32Array(sp.count * 3), 3),
  );
  for (let i = 0; i < sp.count; i++) {
    // V0.8 Pass 093: the vertices nearest each hole's edge are drawn onto it, so the hole is cut
    // along a smooth, irregular line (whole grid triangles were dropped, leaving a sawtooth
    // crown), and the sheet thickens and curls up into the hole's worn lip.
    let x = sp.getX(i),
      z = sp.getZ(i),
      lip = 0;
    for (const h of ICE.holes) {
      const a = Math.atan2(z - h.z, x - h.x),
        d = Math.hypot(x - h.x, z - h.z),
        r = holeEdge(h, a);
      if (Math.abs(d - r) < 0.5) {
        x = h.x + Math.cos(a) * r;
        z = h.z + Math.sin(a) * r;
        lip = Math.max(lip, 1);
      } else if (d > r && d < r + 1.2) lip = Math.max(lip, 1 - (d - r) / 1.2);
    }
    sp.setX(i, x);
    sp.setZ(i, z);
    sp.setY(i, iceUndersideAt(x, z) - 0.22 * lip * lip);
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
    if (
      !ICE.holes.some(
        (h) =>
          Math.hypot(cx - h.x, cz - h.z) <
          holeEdge(h, Math.atan2(cz - h.z, cx - h.x)) - 0.02,
      )
    )
      open.push(si.getX(f), si.getX(f + 1), si.getX(f + 2));
  }
  sheet.setIndex(open);
  sheet.computeVertexNormals();
  const flatSheet = sheet.toNonIndexed();
  sheet.dispose();
  flatSheet.deleteAttribute('uv');
  return flatSheet;
}

export class IceEnvironment {
  private readonly iceSurface = new HabitatSurface('ice');
  private readonly rockSurface = new HabitatSurface('limestone');
  private readonly sandSurface = new HabitatSurface('sediment');
  readonly root = new THREE.Group();
  readonly colliders: ConvexCollider[] = [];
  /** Dropstones on the seabed (x, z, size), for the garden to settle round. */
  readonly stones: { x: number; y: number; z: number; size: number }[] = [];
  private readonly geometries: THREE.BufferGeometry[] = [];
  private readonly materials: THREE.Material[] = [];
  private readonly shafts: THREE.MeshBasicMaterial;
  private time = 0;
  private disposed = false;
  /**
   * V0.8 Pass 091: dim cave light seeping out of the tunnel home, so it stays findable from across
   * the ice field through the shared dense murk.
   */
  private readonly homeGlow: PassageGlow;
  /** V0.7 Pass 079: the giant strap algae and bushy algae, swaying. */
  private readonly algae: SwayingAlgae[] = [];

  /**
   * @param geology V0.8 Pass 093: the authored rock (the Pass 091 coastal and limestone variants,
   *   darkened); without it the dropstones and outcrops are the code-built lumps.
   */
  constructor(private geology?: Geology) {
    this.root.name = 'Under the ice';
    const rand = random(ICE_LAYOUT.seed),
      w = ICE.walls,
      t = ICE.tunnel,
      top = ICE.ceiling;
    const ice = this.own(
      this.iceSurface.material({
        name: 'Ice',
        vertexColors: true,
        // V0.7 Pass 080: the icebergs and sea ice read as glowing blue plastic: a near-glassy
        // 0.22 roughness put a hard sheen on every face, and a strong blue self-glow lifted the
        // shadowed sides to the lit ones, so the masses had no light and shade and the far walls
        // matched the near ones in value. Worn, wet ice (0.38, the new ice template) with half
        // the glow keeps its cold translucence but lets the key light model the forms.
        // V0.8 Pass 087 (consistency audit: the ice was the last glossy, plastic-blue surface
        // beside the benchmark's matte, relieved materials): weathered, frosted ice scatters
        // more (0.5), with a fainter blue self-glow, so the key light and the surface relief
        // carry its form instead of the sheen.
        roughness: 0.5,
        metalness: 0,
        // V0.7 Pass 074: shaded from each lump's own creased normals (crisp at fractures, smooth
        // over worn faces) rather than forced flat: the big icebergs read low-poly when faceted.
        emissive: 0x0f3550,
        emissiveIntensity: 0.18,
      }),
    );
    // The ice relief (melt dimples and veins, see `HabitatSurface`) at a readable strength.
    ice.normalScale.setScalar(0.6);
    const rock = this.own(
      this.rockSurface.material({
        name: 'Ice rock',
        vertexColors: true,
        roughness: 0.9,
      }),
    );
    const seabed = this.own(
      this.sandSurface.material({
        name: 'Ice seabed',
        vertexColors: true,
        // V0.8 Pass 087: the seabed shared the ice's near-white value range, so the bergs had
        // nothing to stand out against; a cool grey-blue silt a step darker separates them.
        color: 0xc6ced6,
        roughness: 0.95,
      }),
    );
    // V0.7 Pass 064: soft layered beams (vertex-coloured, additive, fading with depth) replace
    // the hard-edged uniform cones, whose base read as a disc on the seabed.
    this.shafts = this.own(beamMaterial('Ice light'));
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
        k = Math.min(
          1,
          Math.max(0, (Math.hypot(x, y - t.y) - t.radius - 0.2) / 1.2),
        );
      wp.setZ(i, iceWallFace(x, y));
      const tone =
          0.2 +
          0.06 * Math.sin(x * 1.3 + y * 2.1) +
          0.08 * Math.max(0, Math.sin(y * 0.5 + x * 0.2)),
        // v0.6 Pass 052: frosted higher up and on the bulges, rimed white under the sea ice.
        frost =
          Math.min(1, Math.max(0, (y - t.y) / (top - t.y))) * 0.7 +
          0.3 * Math.max(0, Math.sin(x * 0.9 + y * 0.7)) * k;
      wc.push(
        tone * (1 - 0.1 * frost) + 0.3 * frost,
        tone + 0.38 * frost,
        tone * 1.02 + 0.5 * frost,
      );
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
      // v0.6 Pass 052 (playtest: "the entrance into the ice area needs to be fixed"): wound to face
      // into the waters under the ice (it faced the other way, so from inside it was not drawn and
      // the tunnel's outside showed through).
      if (Math.hypot(cx, cy - t.y) > t.radius + 0.1)
        kept.push(wi.getX(f), wi.getX(f + 2), wi.getX(f + 1));
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
      // v0.6 Pass 052: frost on the rock thickening towards the ice.
      frost: { from: ICE_FRAME.origin.z - 1, to: t.wallZ },
    };
    this.add(rockTubeGeometry(tube), rock, 'Ice tunnel');
    // v0.6 Pass 052: the mouth into the waters under the ice: frosted boulders heaped round it,
    // icicles hanging over it and in the tunnel's last stretch.
    this.add(
      mouthCollar(tube, t.wallZ - 0.3, -1, 1.4, 0.24),
      rock,
      'Ice tunnel collar',
    );
    // V0.8 Pass 086: one sculpted arch of frosted basalt growing out of the wall round the mouth
    // (Pass 052's heaped boulders read as an assembled ring).
    this.add(
      mouthArch(tube, t.wallZ, -1, {
        face: iceWallFace,
        stone: [0.22, 0.22, 0.2244],
        frost: 0.5,
        reach: 2.5,
        proud: 0.8,
        seed: 86030,
      }),
      rock,
      'Ice tunnel arch',
    );
    this.add(
      icicles(tube, ICE_FRAME.origin.z - 2, t.wallZ - 0.1, 34, 52140),
      ice,
      'Ice tunnel icicles',
    );
    this.add(
      icicles(
        { x: 0, y: t.y, radius: t.radius + 0.75 },
        t.wallZ - 0.6,
        t.wallZ - 0.3,
        22,
        52150,
      ),
      ice,
      'Ice mouth icicles',
    );
    // V0.7 Pass 079: the tunnel's start (behind the swap) recedes into darkness, not a flat disc.
    this.add(tunnelThroat(tube, t.startZ + 0.25, 1), rock, 'Ice tunnel cap');
    this.homeGlow = new PassageGlow({
      name: 'Ice tunnel glow',
      at: { x: 0, y: t.y, z: t.wallZ + 2.5 },
      facing: { x: 0, y: 0, z: -1 },
      radius: t.radius * 0.95,
      tint: [0.45, 0.72, 0.68],
      peak: 0.35,
    });
    this.root.add(this.homeGlow.mesh);
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
      // V0.8 Pass 086: each wall sculpted at its own size (calving faces, scallops, beds and
      // flutes), not one carved lump stretched to fit.
      const h = top + 6 + rand() * 4;
      blocks.push(
        iceForm({
          kind: 'wall',
          size: [sx, h, sz],
          at: [x, -3, z],
          yaw: (rand() - 0.5) * 0.5,
          seed: 46100 + k * 17,
          deep: 0.4 + rand() * 0.4,
          ground: iceFloor(x, z),
        }),
      );
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
    blocks.push(seaIceSheet(top));
    // Chunks hanging under the ice, and short chimneys up each hole.
    for (let i = 0; i < ICE_LAYOUT.hanging; i++) {
      const x = (rand() * 2 - 1) * (w.x - 2),
        z = t.wallZ - 3 + rand() * (w.farZ - t.wallZ + 4);
      if (ICE.holes.some((h) => Math.hypot(x - h.x, z - h.z) < h.r + 1.5))
        continue;
      const s = 0.6 + rand() * rand() * 2.6,
        sy = s * 0.7;
      // Set well up into the sheet (which dips by up to 0.6 m), so none seems to float.
      blocks.push(
        iceForm({
          kind: 'chunk',
          size: [s * (1 + rand()), sy, s * (1 + rand())],
          at: [x, top - s * 0.12 + 0.3 - sy / 2, z],
          yaw: rand() * Math.PI,
          seed: 46300 + i * 7,
          deep: 0.35,
        }),
      );
    }
    for (const h of ICE.holes) {
      // V0.8 Pass 093: the hole's shaft up through the ice: its own irregular outline, melt-
      // scalloped, a rounded lip turning out under the sheet (was a plain 24-sided cylinder).
      blocks.push(holeShaft(h));
      // Daylight in the hole, and a soft shaft of light falling from it.
      const day = new THREE.CircleGeometry(h.r + 0.6, 24);
      day.rotateX(Math.PI / 2);
      day.translate(h.x, top + 2.3, h.z);
      this.add(day, sky, 'Breathing hole daylight');
      const floor = iceFloor(h.x, h.z),
        height = top - floor;
      const spec = WATER_PROFILES.ice.shafts;
      if (spec) {
        const shaft = beamGeometry({
          length: height + 0.6,
          topRadius: h.r * 0.95,
          bottomRadius: h.r * 2.3,
          intensity: spec.intensity,
          tint: spec.tint,
          topFade: 0.08,
        });
        // A slight lean along the light, as before (bottom 0.6 m west, 0.4 m south).
        shaft.rotateX(Math.atan2(-0.4, height));
        shaft.rotateZ(Math.atan2(-0.6, height));
        shaft.translate(h.x, top + 0.3, h.z);
        this.add(shaft, this.shafts, 'Breathing hole light').renderOrder = 2;
      }
    }
    blocks.push(...this.iceFormations());
    const merged = mergeGeometries(blocks, false);
    blocks.forEach((g) => g.dispose());
    if (merged) {
      // Each part keeps its own normals (recomputing after the merge shaded every facet flat).
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
        yaw = rand() * Math.PI,
        // V0.8 Pass 093: glacial erratics, rounded and subangular (the Pass 091 worn, split,
        // dome and block variants), in the same box; they carry their own collision.
        authored = this.authoredRock(
          DROPSTONE_ROCKS[i % DROPSTONE_ROCKS.length],
          { x, y: y + s * 0.25, z, w: s * 1.2, h: s * 0.8, d: s, yaw },
          i,
        );
      this.stones.push({ x, y, z, size: s });
      if (authored) {
        stones.push(authored);
        continue;
      }
      const g = lump(46500 + (i % 8) * 11, i % 4, 2);
      g.scale(s * 1.2, s * 0.8, s);
      g.rotateY(yaw);
      g.translate(x, y + s * 0.25, z);
      const c = g.getAttribute('color');
      for (let v = 0; v < c.count; v++) c.setXYZ(v, 0.24, 0.23, 0.23);
      stones.push(g);
      if (s > 1)
        this.colliders.push(
          boxCollider(
            [x - s * 0.5, y - 1, z - s * 0.45],
            [x + s * 0.5, y + s * 0.6, z + s * 0.45],
          ),
        );
    }
    stones.push(...this.outcrops());
    const rocks = mergeGeometries(stones, false);
    stones.forEach((g) => g.dispose());
    if (rocks) {
      this.add(rocks, rock, 'Dropstones');
    }
    this.plantAlgae();
    // The geology is only needed while building (pieces are copied out).
    this.geology = undefined;
  }
  /**
   * V0.7 Pass 079 (playtest: "feels like a large empty room"): grounded iceberg fragments along
   * the sides and the far end, and two great ice columns joining seabed to sea ice near the side
   * walls, so the open water has structure at every height. All stand clear of the breathing
   * holes' light, the tunnel's approach, the sand lanes and the penguins' loop (round x 2, z -38),
   * and each is solid (convex colliders from its own surface).
   */
  private iceFormations(): THREE.BufferGeometry[] {
    const rand = random(79300),
      out: THREE.BufferGeometry[] = [],
      top = ICE.ceiling;
    const piece = (
      x: number,
      y0: number,
      z: number,
      sx: number,
      h: number,
      sz: number,
      k: number,
      deep: number,
      kind: IceKind = 'berg',
    ) => {
      // V0.8 Pass 086: sculpted at its own size (was one carved lump stretched to fit).
      const g = iceForm({
        kind,
        size: [sx, h, sz],
        at: [x, y0, z],
        yaw: rand() * Math.PI,
        seed: 79310 + k * 13,
        deep,
        ground: kind === 'column' ? undefined : iceFloor(x, z),
        solid: true,
      });
      this.colliders.push(rockCollider(g, new THREE.Matrix4()));
      out.push(g);
    };
    // Grounded fragments: broad, low-ish blocks sunk into the seabed.
    const grounded: [number, number, number, number, number][] = [
      [-18, -19, 4.5, 5.5, 4],
      [18.5, -23, 5, 4.5, 4.5],
      [-19, -40, 4, 6.5, 5],
      [18, -50, 5.5, 5, 4],
      [-5, -55.5, 6, 4.5, 3.5],
      [12, -56, 4.5, 6, 3.5],
    ];
    grounded.forEach(([x, z, sx, h, sz], i) => {
      piece(
        x,
        iceFloor(x, z) - 1.2,
        z,
        sx,
        h + 1.2,
        sz,
        i,
        0.45 + rand() * 0.25,
      );
      // A smaller shard leaning against each.
      const a = rand() * Math.PI * 2;
      piece(
        x + Math.cos(a) * sx * 0.55,
        iceFloor(x, z) - 0.6,
        z + Math.sin(a) * sz * 0.55,
        sx * 0.45,
        h * 0.5,
        sz * 0.4,
        i + 20,
        0.5,
        'shard',
      );
    });
    // Columns: wide feet, a narrower waist, and a broad head merging into the sea ice.
    for (const [x, z] of [
      [-19.5, -31],
      [19.5, -37],
    ] as const) {
      const floor = iceFloor(x, z);
      piece(x, floor - 1, z, 5, 5.5, 4.5, 40, 0.5);
      piece(x, floor + 3.5, z, 2.8, top - floor - 6, 2.6, 41, 0.6, 'column');
      piece(x, top - 4.5, z, 5.5, 5.5, 5, 42, 0.4);
    }
    return out;
  }
  /**
   * V0.7 Pass 079: rock outcrops (clusters of carved boulders, 1.5-3 m), dark like the dropstones,
   * set clear of the sand lanes and the holes. They join the stones, so the garden's anemones and
   * feather stars settle on them too.
   */
  /**
   * V0.8 Pass 093: an authored rock variant placed in a box, its collision pushed, painted as the
   * dark basalt and granite carried out by the ice (its own light-and-shade kept). Undefined
   * without the geology (the code-built lump is used instead).
   */
  private authoredRock(
    name: string,
    at: GeologyPlacement,
    seed: number,
  ): THREE.BufferGeometry | undefined {
    const piece = this.geology?.piece(name);
    if (!piece) return undefined;
    const g = placeGeology(piece, at, this.colliders),
      c = g.getAttribute('color'),
      tint = 0.33 + 0.04 * Math.sin(seed * 1.7);
    for (let v = 0; v < c.count; v++) {
      const k = (c.getX(v) + c.getY(v) + c.getZ(v)) / 3;
      c.setXYZ(v, k * tint, k * tint * 0.98, k * tint * 0.99);
    }
    return g;
  }
  private outcrops(): THREE.BufferGeometry[] {
    const rand = random(79400),
      out: THREE.BufferGeometry[] = [];
    for (const [cx, cz] of [
      [-6.5, -17],
      [6.5, -32],
      [-17.5, -46],
      [17.5, -31],
    ] as const) {
      for (let k = 0; k < 4; k++) {
        const a = rand() * Math.PI * 2,
          d = k === 0 ? 0 : 1.1 + rand() * 0.9,
          x = cx + Math.cos(a) * d,
          z = cz + Math.sin(a) * d,
          s = k === 0 ? 2.4 + rand() * 0.8 : 1.1 + rand() * 0.9,
          y = iceFloor(x, z),
          yaw = rand() * Math.PI,
          h = s * (k === 0 ? 1.1 : 0.75);
        this.stones.push({ x, y, z, size: s });
        // V0.8 Pass 093: bedrock, layered and jointed (the Pass 091 slab, tor, ledge and tilted
        // bed variants), in the same box, with its own collision.
        const authored = this.authoredRock(
          OUTCROP_ROCKS[(k + Math.round(cx)) % OUTCROP_ROCKS.length],
          { x, y: y + s * 0.3, z, w: s * 1.2, h, d: s, yaw },
          k + 40,
        );
        if (authored) {
          out.push(authored);
          continue;
        }
        const g = lump(79410 + k * 7 + Math.round(cx), k % 3, 2);
        g.scale(s * 1.2, h, s);
        g.rotateY(yaw);
        g.translate(x, y + s * 0.3, z);
        const c = g.getAttribute('color');
        for (let v = 0; v < c.count; v++) {
          const t = 0.22 + 0.05 * Math.sin(v * 0.37);
          c.setXYZ(v, t, t * 0.97, t * 0.97);
        }
        this.colliders.push(rockCollider(g, new THREE.Matrix4()));
        out.push(g);
      }
    }
    return out;
  }
  /**
   * V0.7 Pass 079: giant strap algae ringing the breathing holes (in their light) and bushy algae
   * round the outcrops and along the side walls: tall, swaying vertical structure (two draws).
   */
  private plantAlgae(): void {
    const rand = random(79500),
      straps: AlgaPlacement[] = [],
      bushes: AlgaPlacement[] = [];
    const ok = (x: number, z: number) =>
      !inIceLane(x, z, 0.4) &&
      Math.abs(x) < ICE.walls.x - 3 &&
      z < ICE.tunnel.wallZ - 3 &&
      z > ICE.walls.farZ + 3;
    for (const h of ICE.holes)
      for (let i = 0; i < 16; i++) {
        const a = rand() * Math.PI * 2,
          d = h.r * (1.1 + rand() * 1.4),
          x = h.x + Math.cos(a) * d,
          z = h.z + Math.sin(a) * d;
        if (ok(x, z))
          straps.push({
            x,
            y: iceFloor(x, z) - 0.05,
            z,
            scale: 0.7 + rand() * 0.7,
            yaw: rand() * Math.PI * 2,
          });
      }
    for (const st of this.stones.slice(-16)) {
      for (let i = 0; i < 2; i++) {
        const a = rand() * Math.PI * 2,
          x = st.x + Math.cos(a) * (st.size * 0.7 + 0.4),
          z = st.z + Math.sin(a) * (st.size * 0.7 + 0.4);
        if (ok(x, z))
          bushes.push({
            x,
            y: iceFloor(x, z) - 0.03,
            z,
            scale: 0.8 + rand() * 0.7,
            yaw: rand() * Math.PI * 2,
          });
      }
    }
    for (let i = 0; i < 40; i++) {
      const side = i % 2 ? 1 : -1,
        x = side * (ICE.walls.x - 4 - rand() * 3),
        z =
          ICE.tunnel.wallZ -
          5 +
          rand() * (ICE.walls.farZ - ICE.tunnel.wallZ + 8);
      if (!ok(x, z)) continue;
      (i % 3 ? bushes : straps).push({
        x,
        y: iceFloor(x, z) - 0.05,
        z,
        scale: 0.7 + rand() * 0.8,
        yaw: rand() * Math.PI * 2,
      });
    }
    const strap = new SwayingAlgae(
      'Giant strap algae',
      strapAlgaGeometry(3.2, 79510, [0.3, 0.2, 0.09], [0.56, 0.42, 0.17]),
      straps,
      0.35,
    );
    const bush = new SwayingAlgae(
      'Bushy brown algae',
      bushyAlgaGeometry(1.1, 79520, [0.36, 0.17, 0.08], [0.72, 0.38, 0.2]),
      bushes,
      0.12,
    );
    for (const a of [strap, bush]) {
      this.algae.push(a);
      this.root.add(a.mesh);
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
  /** Fade the tunnel's glow with the eye's distance (every frame, any motion setting). */
  updatePassages(eye: THREE.Vector3Like): void {
    this.homeGlow.update(eye);
  }
  update(dt: number, active: boolean, reducedMotion: boolean): void {
    if (this.disposed || !active || reducedMotion || !(dt > 0)) return;
    this.time += Math.min(dt, 0.1);
    this.shafts.opacity = 0.88 + 0.12 * Math.sin(this.time * 0.5);
    for (const a of this.algae) a.update(dt, active, reducedMotion);
  }
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.root.removeFromParent();
    this.algae.forEach((a) => a.dispose());
    this.homeGlow.dispose();
    this.root.clear();
    this.geometries.forEach((g) => g.dispose());
    this.materials.forEach((m) => m.dispose());
    this.iceSurface.dispose();
    this.rockSurface.dispose();
    this.sandSurface.dispose();
  }
}
