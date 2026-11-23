import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import {
  BOOM,
  DECK_GEAR,
  DECK_TOP,
  GEAR_SIZE,
  HOLD_CARGO,
  SHIP,
  SHIP_POSE,
  deckTopAt,
  hullX,
  railAt,
} from './WreckLayout';
import {
  WRECK_GROWTH,
  type GrowthMode,
  type GrowthSurface,
} from './WreckGrowth';

/**
 * The shipwreck's meshes, built in code from `WreckLayout` so they match its collision: a riveted
 * steel freighter, plating dented and streaked with rust, her red bottom paint faded, sitting in
 * the sand with a list. A raised forecastle with its windlass, chains and anchors; a solid bulwark
 * round the deck; the open hatch and the hold beneath (ribs, beams, bulkheads, spilled cargo); the
 * deckhouse with its door, the wheelhouse above with wrap-round windows and wings, the raked funnel
 * and the boat davits; the foremast with its crosstrees, its derrick fallen across the deck;
 * winches, ventilator cowls and bollards; rudder and propeller under the counter; and sponges,
 * soft corals and sea fans grown over it all. Owns its GPU objects.
 */
type RGB = readonly [number, number, number];
const RUST: RGB = [0.4, 0.22, 0.14];
const STEEL: RGB = [0.37, 0.34, 0.3];
const PAINT: RGB = [0.5, 0.48, 0.43];
const DECK: RGB = [0.37, 0.32, 0.25];
const BOTTOM: RGB = [0.42, 0.16, 0.12];
const DARK: RGB = [0.08, 0.07, 0.06];
const GROWTH_FILM: RGB = [0.3, 0.34, 0.23];
const frac = (v: number) => v - Math.floor(v);

function random(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}
/**
 * Non-indexed, positions and normals only, coloured by `colour(position, up)`, where `up` is
 * the surface normal's vertical component. V0.8 Pass 086: normals come first so the colour can
 * follow the surface's facing: silt settles on what faces up, grime gathers under overhangs.
 */
function painted(
  g: THREE.BufferGeometry,
  colour: (x: number, y: number, z: number, up: number) => RGB,
  smoothNormals = false,
): THREE.BufferGeometry {
  if (smoothNormals) g.computeVertexNormals();
  const out = g.index ? g.toNonIndexed() : g;
  if (out !== g) g.dispose();
  for (const name of Object.keys(out.attributes))
    if (name !== 'position' && name !== 'normal') out.deleteAttribute(name);
  if (!smoothNormals) out.computeVertexNormals();
  const p = out.getAttribute('position'),
    n = out.getAttribute('normal'),
    col = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++)
    col.set(colour(p.getX(i), p.getY(i), p.getZ(i), n.getY(i)), i * 3);
  out.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  return out;
}
/**
 * V0.8 Pass 086: what a surface's facing does to its colour on the seabed: a pale silt over
 * whatever faces up (patchy, thickest on level surfaces), dark grime under whatever faces down.
 */
const SILT: RGB = [0.5, 0.46, 0.36];
function settled(c: RGB, x: number, z: number, up: number): RGB {
  const patchy =
      0.65 + 0.35 * Math.sin(x * 1.7 + z * 0.9) * Math.sin(z * 2.3 - x * 1.3),
    silt = Math.max(0, Math.min(1, (up - 0.55) / 0.4)) * 0.5 * patchy,
    under = up < -0.4 ? 0.62 : 1;
  return scale(mix(c, SILT, silt), under);
}
/**
 * V0.8 Pass 086: where colonies have settled on the wreck, fixed for the whole build (hull paint,
 * decks and the growth all use them), so the colonies stand on the encrusting mats they grew
 * from instead of on bare plate. Each is on a side of the hull (band: 0 low, 1 at the rail) or
 * on the deck (x: -1..1 across it), with its radius (m).
 */
export interface GrowthSite {
  readonly side: -1 | 0 | 1;
  readonly z: number;
  readonly band: number;
  readonly x: number;
  readonly radius: number;
}
/**
 * V0.8 Pass 093: whether (x, z) is open roof on the boat deck (over the deckhouse, clear of the
 * wheelhouse, the funnel and the davits' feet), where growth may settle.
 */
export function onBoatDeck(x: number, z: number): boolean {
  const b = SHIP.bridge,
    wh = SHIP.wheelhouse,
    f = SHIP.funnel;
  return (
    Math.abs(x) < b.half - 0.15 &&
    z > b.foreZ + 0.15 &&
    z < b.aftZ - 0.15 &&
    !(Math.abs(x) < wh.half + 0.3 && z < wh.aftZ + 0.3) &&
    Math.hypot(x / (f.rx + 0.4), (z - f.z) / (f.rz + 0.4)) > 1 &&
    Math.abs(Math.abs(x) - 2.75) > 0.3
  );
}
export const GROWTH_SITES: readonly GrowthSite[] = (() => {
  const rand = random(86200),
    sites: GrowthSite[] = [],
    zFrom = SHIP.bowZ + 1.5,
    zSpan = SHIP.sternZ - SHIP.bowZ - 2.5;
  // Spread along the whole ship (one per stretch, jittered within it), so no end is left bare.
  const count = 30;
  for (let i = 0; i < count; i++) {
    const r = rand(),
      // V0.8 Pass 093: 45% of the sites on the decks (was 30%: the deck read bare beside the
      // crowded rails); the same 30 sites, so growth moves rather than multiplies.
      side: -1 | 0 | 1 = r < 0.45 ? 0 : r < 0.725 ? -1 : 1;
    sites.push({
      side,
      z: zFrom + ((i + 0.15 + rand() * 0.7) / count) * zSpan,
      // Growth crowds toward the rail, where the current runs over the edge.
      band: 0.35 + 0.65 * Math.sqrt(rand()),
      x: rand() * 2 - 1,
      radius: 1.1 + rand() * 1.1,
    });
  }
  return sites;
})();
/** The encrusting mats' cover at a point on a hull side (0..1). */
function hullCrust(x: number, y: number, z: number): number {
  let k = 0;
  for (const s of GROWTH_SITES) {
    if (s.side === 0 || Math.sign(x) !== s.side) continue;
    const sy = 1.2 + s.band * (railAt(s.z) - 1.6),
      d = Math.hypot(z - s.z, (y - sy) * 1.3) / s.radius;
    if (d < 1.6) k += Math.exp(-d * d * 1.4);
  }
  // A ragged edge to each mat, not a soft blob.
  const edge =
    0.75 + 0.45 * Math.sin(z * 5.3 + y * 4.1) * Math.sin(y * 6.7 - z * 2.9);
  return Math.min(1, Math.max(0, k * edge * 1.2 - 0.15));
}
/** The encrusting mats' cover at a point on a deck (0..1). */
function deckCrust(x: number, z: number): number {
  let k = 0;
  for (const s of GROWTH_SITES) {
    if (s.side !== 0) continue;
    const sx = s.x * (hullX(s.z, DECK_TOP) - 0.5),
      d = Math.hypot(x - sx, z - s.z) / s.radius;
    if (d < 1.6) k += Math.exp(-d * d * 1.4);
  }
  const edge =
    0.75 + 0.45 * Math.sin(x * 5.3 + z * 4.1) * Math.sin(z * 6.7 - x * 2.9);
  return Math.min(1, Math.max(0, k * edge * 1.2 - 0.15));
}
/** Encrusting mats: coralline pinks and ochres mottled with green-brown turf. */
const CORALLINE: RGB = [0.56, 0.33, 0.36],
  TURF: RGB = [0.3, 0.34, 0.2],
  OCHRE: RGB = [0.58, 0.44, 0.24];
function crustColour(c: RGB, k: number, x: number, y: number, z: number): RGB {
  if (k <= 0) return c;
  const a = 0.5 + 0.5 * Math.sin(x * 3.1 + z * 2.3 + y * 1.7),
    b = 0.5 + 0.5 * Math.sin(z * 4.7 - y * 3.3 + x * 2.1),
    tint = mix(mix(CORALLINE, OCHRE, b * 0.6), TURF, a * a * 0.7);
  return mix(c, tint, Math.min(0.85, k));
}
const scale = (c: RGB, k: number): RGB => [c[0] * k, c[1] * k, c[2] * k];
const mix = (a: RGB, b: RGB, t: number): RGB => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
];
/**
 * Weathered steel: mottled, rust bleeding through. V0.7 Pass 076: with welded plate seams on a
 * world-space grid (dark lines, rust bleeding below them) and a patchy growth film, so decks,
 * the hold and the superstructure read as the same plated steel as the hull.
 */
function weathered(base: RGB, box?: THREE.Box3) {
  return (x: number, y: number, z: number, up = 0): RGB => {
    const mottle =
        0.8 +
        0.12 *
          Math.sin(z * 2.3 + Math.sin(y * 0.9) * 2) *
          Math.sin(x * 1.7 + y * 0.6) +
        0.08 * Math.sin(z * 7.1 + x * 5.3 + y * 3.7),
      rust = Math.max(
        0,
        Math.sin(x * 3.1 + z * 1.3) * Math.sin(y * 2.2 - z * 0.7) - 0.3,
      ),
      gx = Math.abs(frac((x + 100) / 1.5) - 0.5) * 1.5,
      gy = frac((y + 100) / 1.15),
      gz = Math.abs(frac((z + 100) / 1.5) - 0.5) * 1.5,
      onSeam = Math.min(0.75 - gx, 0.75 - gz) < 0.04 || gy > 0.95,
      bleed = Math.pow(gy, 6) * Math.max(0, Math.sin(x * 4.3 + z * 3.9)),
      film =
        Math.max(
          0,
          Math.sin(x * 0.9 + z * 0.7) * Math.sin(z * 1.7 - x * 1.1 + y) - 0.2,
        ) * 0.5;
    // V0.8 Pass 086: a box's edges and corners worn through the paint to rust, and rust
    // running down from its top edges in streaks.
    let worn = 0;
    if (box) {
      const ex = Math.min(x - box.min.x, box.max.x - x),
        ey = Math.min(y - box.min.y, box.max.y - y),
        ez = Math.min(z - box.min.z, box.max.z - z),
        sorted = [ex, ey, ez].sort((a, b) => a - b),
        // Near an edge: the second-smallest distance to a face is small.
        edge = Math.max(0, 1 - sorted[1] / 0.09),
        below = box.max.y - y,
        run =
          below < 1.2
            ? Math.max(0, Math.sin(x * 5.1 + z * 4.3)) ** 8 * (1 - below / 1.2)
            : 0;
      worn = Math.min(1, edge * 0.75 + run * 0.6);
    }
    return settled(
      scale(
        mix(
          mix(base, RUST, Math.min(1, rust * 1.6 + bleed * 0.5 + worn)),
          GROWTH_FILM,
          film,
        ),
        mottle * (onSeam ? 0.6 : 1),
      ),
      x,
      z,
      up,
    );
  };
}
/** V0.7 Pass 076: faded topside paint (grey-green) over the old red bottom. */
const TOPSIDE: RGB = [0.44, 0.44, 0.38];
/** Hull plate construction: strakes (horizontal bands) and butts (plate ends), frames inside. */
const STRAKE = 1.15,
  BUTT = 2.6,
  FRAME = 0.7;
const hash = (a: number, b: number) =>
  frac(Math.sin(a * 12.9898 + b * 78.233) * 43758.5453);
/** How open the breach is at (z, y): > 0 inside its ragged, smooth-edged hole. */
export function breachOpen(z: number, y: number): number {
  const b = SHIP.breach,
    cz = (b.foreZ + b.aftZ) / 2,
    cy = (b.low + b.high) / 2,
    // The hole always contains the collision opening (the rectangle), with a ragged margin.
    margin =
      0.2 +
      0.45 *
        (0.5 +
          0.5 * Math.sin(z * 2.3 + y * 1.7) * Math.cos(y * 2.9 - z * 1.1)) +
      // Jagged teeth where the plating tore.
      0.14 *
        Math.abs(Math.sin(z * 9.7 + y * 3.1) * Math.sin(y * 11.3 - z * 2.7)),
    dz = Math.abs(z - cz) - ((b.aftZ - b.foreZ) / 2 + margin),
    dy = Math.abs(y - cy) - ((b.high - b.low) / 2 + margin * 0.8);
  return -Math.max(dz, dy);
}
/**
 * V0.7 Pass 076: how far (m) the plating sits inside the hull's design surface at (y, z): each
 * strake leans in toward its top edge (so every seam is a shadow line under the plate above),
 * shallow grooves at the plate butts, the plating sagging in between the internal frames (the
 * starved-horse look of an old hull), soft dents, and torn plating curling in round the breach.
 * Inward only: the shell stays within the hull's collision.
 */
export function hullInset(y: number, z: number): number {
  const t = frac((y - 0.2) / STRAKE),
    lap = 0.018 * t,
    f = frac((z + 100) / FRAME),
    sag =
      0.022 *
      (0.5 - 0.5 * Math.cos(Math.PI * 2 * f)) *
      (0.55 + 0.45 * Math.sin(z * 0.37 + y * 0.9)),
    bt = frac((z + 100) / BUTT),
    butt = 0.012 * Math.exp(-(((Math.min(bt, 1 - bt) * BUTT) / 0.08) ** 2)),
    open = breachOpen(z, y),
    curl = open < 0 && open > -0.7 ? 0.1 * (1 + open / 0.7) ** 2 : 0;
  return lap + sag + butt + 0.6 * dent(y, z) + curl;
}
/** The hull's colouring: plate by plate, faded paint, seams, rust bleeding down, growth film. */
function hullColour(x: number, y: number, z: number): RGB {
  const sv = (y - 0.2) / STRAKE,
    t = frac(sv),
    bv = (z + 100) / BUTT,
    bt = frac(bv),
    // Each plate weathered a little differently.
    plate = 0.9 + 0.16 * hash(Math.floor(sv), Math.floor(bv)),
    // Boot-topping: the old red bottom below the line, faded and patchy; topsides above.
    bottom = 1 - Math.min(1, Math.max(0, (y - 2.4) / 0.5)),
    base = mix(TOPSIDE, BOTTOM, bottom * (0.7 + 0.3 * Math.sin(z * 0.9 + y))),
    // Rust bleeding down from the seam above each plate, in streaks along the hull.
    streak = Math.pow(
      Math.max(0, Math.sin(z * 3.7 + 2 * Math.sin(z * 0.8))),
      6,
    ),
    bleed = t * t * streak,
    // Broad corroded patches, and heavy rust round the torn breach.
    patch =
      Math.max(
        0,
        Math.sin(z * 0.73 + y * 1.1) * Math.sin(z * 1.9 - y * 0.6) - 0.35,
      ) * 1.6,
    open = breachOpen(z, y),
    torn = open < 0 && open > -1 ? 1 + open : 0,
    rust = Math.min(1, 0.12 + bleed * 0.85 + patch * 0.6 + torn * 0.8),
    // Shadow under each plate's proud lower edge; that edge itself catches the light.
    seam = t > 0.86 ? 0.55 : t < 0.1 ? 1.18 : 1,
    butt = Math.min(bt, 1 - bt) * BUTT < 0.05 ? 0.78 : 1,
    // A patchy film of growth on the plating, thicker low down; a darker sand line at the foot.
    film =
      0.45 *
      Math.max(
        0,
        Math.sin(z * 0.41 + y * 0.7) * Math.sin(z * 1.3 + y * 1.9 + x) + 0.1,
      ) *
      (y > 0.8 ? 1 : 0.4),
    sand = y < 0.9 ? 0.75 + 0.25 * (y / 0.9) : 1,
    mottle =
      0.86 +
      0.1 * Math.sin(z * 3.3 + y * 2.1) * Math.sin(z * 0.7 - y * 1.9 + x);
  return scale(
    crustColour(
      mix(mix(base, RUST, rust), GROWTH_FILM, Math.min(0.55, film)),
      hullCrust(x, y, z),
      x,
      y,
      z,
    ),
    plate * seam * butt * sand * mottle,
  );
}
function block(
  x0: number,
  y0: number,
  z0: number,
  x1: number,
  y1: number,
  z1: number,
  c: RGB = STEEL,
): THREE.BufferGeometry {
  // V0.7 Pass 076: subdivided (about 0.3 m cells) so seams, rust and growth resolve on it.
  const seg = (d: number) =>
    Math.max(1, Math.min(20, Math.round(Math.abs(d) / 0.3)));
  const g = new THREE.BoxGeometry(
    x1 - x0,
    y1 - y0,
    z1 - z0,
    seg(x1 - x0),
    seg(y1 - y0),
    seg(z1 - z0),
  );
  g.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
  const box = new THREE.Box3(
    new THREE.Vector3(Math.min(x0, x1), Math.min(y0, y1), Math.min(z0, z1)),
    new THREE.Vector3(Math.max(x0, x1), Math.max(y0, y1), Math.max(z0, z1)),
  );
  return painted(g, weathered(c, box));
}
/** A tube from a to b. */
function rod(
  a: THREE.Vector3,
  b: THREE.Vector3,
  r: number,
  c: RGB = STEEL,
  sides = 8,
): THREE.BufferGeometry {
  const length = a.distanceTo(b),
    g = new THREE.CylinderGeometry(r, r, length, sides);
  g.translate(0, length / 2, 0);
  g.applyQuaternion(
    new THREE.Quaternion().setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      b.clone().sub(a).normalize(),
    ),
  );
  g.translate(a.x, a.y, a.z);
  return painted(g, weathered(c));
}
function merge(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const m = mergeGeometries(parts, false);
  parts.forEach((g) => g.dispose());
  if (!m) throw Error('The shipwreck could not be built');
  return m;
}
/** A smooth dent field over the plating (m, inwards), so it is never flat. */
const dent = (y: number, z: number): number =>
  0.035 *
  (1 + Math.sin(z * 1.9 + y * 0.8)) *
  (0.5 + 0.5 * Math.sin(z * 0.6 - y * 1.7));

/**
 * The old shell drew one random number per starboard quad below the rail (30 rows, 240
 * stations) for its breach edge. Later steps (growth placement) continue the same sequence, so
 * draw exactly as many to keep everything downstream where it was.
 */
function skipLegacyHullDraws(rand: () => number): void {
  const rows = 30,
    stations = 240;
  const yAt = (i: number, j: number) => {
    const y = SHIP.keel + ((DECK_TOP + 3.5 - SHIP.keel) * j) / rows,
      v = Math.max(0, Math.min(1, (y - SHIP.keel) / (DECK_TOP - SHIP.keel))),
      start = SHIP.bowZ - SHIP.rake * (y - SHIP.keel),
      end = SHIP.sternZ - SHIP.undercut * (1 - v) * (1 - v),
      u = 0.5 - 0.5 * Math.cos((Math.PI * i) / stations),
      z = start + (end - start) * u;
    return Math.min(y, railAt(z));
  };
  for (let i = 0; i < stations; i++)
    for (let j = 0; j < rows; j++) {
      if (yAt(i, j) === yAt(i, j + 1) && yAt(i + 1, j) === yAt(i + 1, j + 1))
        continue;
      rand();
    }
}
/** The hull plating, keel to rail, lofted section by section, open where it has rusted through. */
function hullShell(rand: () => number): THREE.BufferGeometry {
  skipLegacyHullDraws(rand);
  // V0.7 Pass 076: finer (60 rows, 360 stations) so plate laps, butts and frame sag resolve; one
  // indexed grid per side with smooth normals; the breach a smooth ragged hole round the
  // collision opening (it was cut quad by quad at random, so its edge was stair-stepped).
  const rows = 60,
    stations = 360;
  const at = (i: number, j: number, side: number) => {
    const y = SHIP.keel + ((DECK_TOP + 3.5 - SHIP.keel) * j) / rows,
      v = Math.max(0, Math.min(1, (y - SHIP.keel) / (DECK_TOP - SHIP.keel))),
      start = SHIP.bowZ - SHIP.rake * (y - SHIP.keel),
      end = SHIP.sternZ - SHIP.undercut * (1 - v) * (1 - v),
      u = 0.5 - 0.5 * Math.cos((Math.PI * i) / stations),
      z = start + (end - start) * u,
      top = railAt(z),
      yy = Math.min(y, top),
      x = hullX(z, yy);
    return new THREE.Vector3(
      side * Math.max(0, x - (x > 0.3 ? hullInset(yy, z) : 0)),
      yy,
      z,
    );
  };
  const parts: THREE.BufferGeometry[] = [];
  for (const side of [-1, 1]) {
    const pos: number[] = [],
      grid: THREE.Vector3[] = [],
      idx: number[] = [],
      w = rows + 1;
    for (let i = 0; i <= stations; i++)
      for (let j = 0; j <= rows; j++) {
        const p = at(i, j, side);
        grid.push(p);
        pos.push(p.x, p.y, p.z);
      }
    for (let i = 0; i < stations; i++)
      for (let j = 0; j < rows; j++) {
        const a = i * w + j,
          bb = (i + 1) * w + j,
          c = (i + 1) * w + j + 1,
          d = i * w + j + 1;
        // Above the rail (rows run past it, to cover the forecastle): nothing.
        if (grid[a].y === grid[d].y && grid[bb].y === grid[c].y) continue;
        if (
          side > 0 &&
          breachOpen(
            (grid[a].z + grid[bb].z) / 2,
            (grid[a].y + grid[c].y) / 2,
          ) > 0
        )
          continue;
        if (side > 0) idx.push(a, bb, c, a, c, d);
        else idx.push(a, c, bb, a, d, c);
      }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    parts.push(painted(g, hullColour, true));
  }
  // The rail capping the bulwark, all round.
  for (const side of [-1, 1])
    for (let za = SHIP.bowZ - 3; za < SHIP.sternZ; za += 0.6) {
      const zb = za + 0.6;
      const xa = hullX(za, railAt(za)),
        xb = hullX(zb, railAt(zb));
      if (xa < 0.1 || xb < 0.1) continue;
      parts.push(
        rod(
          new THREE.Vector3(side * xa, railAt(za), za),
          new THREE.Vector3(side * xb, railAt(zb), zb),
          0.07,
          RUST,
          6,
        ),
      );
    }
  return merge(parts);
}

/** A deck surface over a span of z, following the hull's line, open at the hatch. */
function deckSurface(
  z0: number,
  z1: number,
  y: number,
  underside: boolean,
): THREE.BufferGeometry[] {
  const parts: THREE.BufferGeometry[] = [],
    h = SHIP.hatch,
    step = 0.5;
  for (let z = z0; z < z1 - 0.01; z += step) {
    const zb = Math.min(z + step, z1),
      hw = Math.min(hullX(z, y), hullX(zb, y)) - 0.05;
    if (hw <= 0.05) continue;
    const spans: [number, number][] =
      y < DECK_TOP + 0.1 && zb > h.foreZ && z < h.aftZ
        ? [
            [-hw, -h.half],
            [h.half, hw],
          ]
        : [[-hw, hw]];
    for (const [x0, x1] of spans) {
      const g = new THREE.PlaneGeometry(x1 - x0, zb - z, 2, 1);
      g.rotateX(underside ? Math.PI / 2 : -Math.PI / 2);
      g.translate((x0 + x1) / 2, underside ? y - SHIP.plate : y, (z + zb) / 2);
      parts.push(
        painted(g, (x, y, zz) => {
          // Planking worn to the steel beneath, silt and a green-brown film of algae.
          const plank =
              0.85 +
              0.1 * Math.sign(Math.sin(x * 9)) +
              0.06 * Math.sin(zz * 3.1),
            film =
              0.5 +
              0.5 * Math.sin(x * 0.9 + zz * 0.45) * Math.sin(zz * 0.31 - x);
          const worn = scale(
            mix(DECK, [0.3, 0.33, 0.22], film * 0.6),
            plank * (underside ? 0.5 : 1),
          );
          // V0.8 Pass 086: silt drifted over the planking, and the mats colonies grew from.
          return underside
            ? worn
            : crustColour(settled(worn, x, zz, 1), deckCrust(x, zz), x, y, zz);
        }),
      );
    }
  }
  return parts;
}

/** The decks: the main deck with its hatch and coaming, the forecastle deck and its break. */
function decks(): THREE.BufferGeometry {
  const fc = SHIP.forecastle,
    h = SHIP.hatch,
    top = DECK_TOP,
    parts: THREE.BufferGeometry[] = [
      ...deckSurface(fc.aftZ, SHIP.sternZ, top, false),
      ...deckSurface(fc.aftZ, SHIP.sternZ, top, true),
      ...deckSurface(SHIP.bowZ - 1, fc.aftZ, top + fc.rise, false),
    ];
  // The forecastle's break: a bulkhead across the deck, with a dark doorway and portholes.
  const hw = hullX(fc.aftZ, top + fc.rise) - 0.05;
  parts.push(
    block(-hw, top, fc.aftZ - 0.18, hw, top + fc.rise, fc.aftZ, PAINT),
  );
  const doorway = new THREE.PlaneGeometry(0.9, 1.8);
  doorway.translate(0, top + 0.9, fc.aftZ + 0.02);
  parts.push(painted(doorway, () => DARK));
  for (const x of [-2.2, 2.2]) {
    const port = new THREE.CircleGeometry(0.17, 12);
    port.translate(x, top + 1.3, fc.aftZ + 0.02);
    parts.push(painted(port, () => DARK));
  }
  // The hatch's coaming, and one hatch cover fallen in across the hold's floor.
  const c = h.coaming;
  parts.push(
    block(-h.half - 0.15, top, h.foreZ - 0.15, h.half + 0.15, top + c, h.foreZ),
    block(-h.half - 0.15, top, h.aftZ, h.half + 0.15, top + c, h.aftZ + 0.15),
    block(-h.half - 0.15, top, h.foreZ, -h.half, top + c, h.aftZ),
    block(h.half, top, h.foreZ, h.half + 0.15, top + c, h.aftZ),
  );
  const cover = new THREE.BoxGeometry(1.5, 0.1, 2.2);
  cover.rotateZ(0.5);
  cover.translate(1.9, 1.75, -31.5);
  parts.push(painted(cover, weathered(STEEL)));
  return merge(parts);
}

/** The hold: its floor, the bulkheads, the frames along the sides and the beams under the deck. */
function hold(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [],
    s = SHIP,
    o = s.hold,
    inner = s.half - s.shell;
  const floor = new THREE.PlaneGeometry(inner * 2, o.foreZ - o.aftZ);
  floor.rotateX(-Math.PI / 2);
  floor.translate(0, o.floor, (o.foreZ + o.aftZ) / 2);
  parts.push(
    painted(floor, (x, _y, z) =>
      scale(STEEL, 0.55 + 0.15 * Math.sin(x * 2 + z * 1.3)),
    ),
  );
  for (const [z, face] of [
    [o.foreZ, 1],
    [o.aftZ, -1],
  ] as const) {
    const g = new THREE.PlaneGeometry(inner * 2, s.deck - o.floor);
    if (face < 0) g.rotateY(Math.PI);
    g.translate(0, (s.deck + o.floor) / 2, z);
    parts.push(painted(g, weathered(STEEL)));
    for (let x = -inner + 0.8; x < inner; x += 1.1)
      parts.push(
        block(
          x - 0.05,
          o.floor,
          z + face * 0.02,
          x + 0.05,
          s.deck,
          z + face * 0.14,
        ),
      );
  }
  // Frames (ribs) up each side, set in so they stay inside the plating where it curves in.
  for (let z = o.foreZ + 0.6; z < o.aftZ; z += 0.9)
    for (const side of [-1, 1])
      parts.push(
        block(
          side > 0 ? inner - 0.32 : -inner + 0.2,
          o.floor,
          z - 0.04,
          side > 0 ? inner - 0.2 : -inner + 0.32,
          s.deck,
          z + 0.04,
          RUST,
        ),
      );
  for (let z = o.foreZ + 1.1; z < o.aftZ; z += 1.8)
    if (z < s.hatch.foreZ - 0.2 || z > s.hatch.aftZ + 0.2)
      parts.push(
        block(-inner, s.deck - 0.28, z - 0.07, inner, s.deck, z + 0.07, RUST),
      );
  for (const k of HOLD_CARGO) {
    if (k.drum) {
      const g = new THREE.CylinderGeometry(
        k.half.x,
        k.half.x,
        k.half.y * 2,
        16,
      );
      g.translate(k.at.x, k.at.y, k.at.z);
      parts.push(
        painted(g, (_x, y) =>
          scale([0.3, 0.36, 0.3], 0.75 + 0.25 * Math.max(0, Math.sin(y * 16))),
        ),
      );
    } else {
      const g = new THREE.BoxGeometry(k.half.x * 2, k.half.y * 2, k.half.z * 2);
      g.translate(k.at.x, k.at.y, k.at.z);
      parts.push(
        painted(g, (x, y, z) =>
          scale(
            [0.4, 0.3, 0.18],
            0.7 + 0.18 * Math.sign(Math.sin((x + z) * 11 + y * 7)),
          ),
        ),
      );
    }
  }
  return merge(parts);
}

/** A wall of the superstructure with a band of windows (dark openings between piers). */
/**
 * V0.8 Pass 093: an old ship's plating dished between its frames ("hungry horse"): each panel
 * between stiffeners (`FRAME` apart) and seams (`STRAKE` apart) sagged inward a few centimetres,
 * a little unevenly, so walls read as plated steel rather than flat boxes. `normal` is the wall's
 * thin axis; `inward` the direction toward the structure's inside along it.
 */
function dished(
  g: THREE.BufferGeometry,
  normal: 'x' | 'z',
  inward: number,
  depth = 0.035,
): THREE.BufferGeometry {
  const p = g.getAttribute('position');
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i),
      y = p.getY(i),
      z = p.getZ(i),
      h = normal === 'x' ? z : x,
      u = frac((h + 100) / FRAME),
      v = frac((y + 100) / STRAKE),
      k =
        depth *
        Math.sin(Math.PI * u) *
        Math.sin(Math.PI * v) *
        (0.6 +
          0.4 * hash(Math.floor((h + 100) / FRAME), Math.floor(y / STRAKE)));
    if (normal === 'x') p.setX(i, x + inward * k);
    else p.setZ(i, z + inward * k);
  }
  g.computeVertexNormals();
  return g;
}
function windowedWall(
  along: 'x' | 'z',
  a0: number,
  a1: number,
  fixed0: number,
  fixed1: number,
  y0: number,
  y1: number,
  band: readonly [number, number],
  panes: number,
  parts: THREE.BufferGeometry[],
): void {
  // V0.8 Pass 093: the plating dished between frames (toward the house's middle, x 0 or z of
  // the bridge's middle), and a sill under and a drip rail over the window band.
  const normal = along === 'x' ? 'z' : 'x',
    mid = (fixed0 + fixed1) / 2,
    centre = normal === 'z' ? (SHIP.bridge.foreZ + SHIP.bridge.aftZ) / 2 : 0,
    inward = Math.sign(centre - mid) || 1,
    out = -inward,
    face = out > 0 ? Math.max(fixed0, fixed1) : Math.min(fixed0, fixed1);
  const piece = (p0: number, p1: number, ya: number, yb: number) =>
    parts.push(
      dished(
        along === 'x'
          ? block(p0, ya, fixed0, p1, yb, fixed1, PAINT)
          : block(fixed0, ya, p0, fixed1, yb, p1, PAINT),
        normal,
        inward,
      ),
    );
  piece(a0, a1, y0, band[0]);
  piece(a0, a1, band[1], y1);
  for (const [ya, yb, reach] of [
    [band[0] - 0.05, band[0], 0.07],
    [band[1], band[1] + 0.04, 0.09],
  ] as const) {
    const f0 = face,
      f1 = face + out * reach;
    parts.push(
      along === 'x'
        ? block(a0, ya, Math.min(f0, f1), a1, yb, Math.max(f0, f1), PAINT)
        : block(Math.min(f0, f1), ya, a0, Math.max(f0, f1), yb, a1, PAINT),
    );
  }
  const span = (a1 - a0) / panes;
  for (let i = 0; i <= panes; i++) {
    const c = a0 + span * i,
      p0 = Math.max(a0, c - span * 0.12),
      p1 = Math.min(a1, c + span * 0.12);
    if (p1 > p0) piece(p0, p1, band[0], band[1]);
  }
}

/** The deckhouse (door, windows, inside), the wheelhouse above with its wings, the funnel, davits. */
function superstructure(): THREE.BufferGeometry {
  const b = SHIP.bridge,
    top = DECK_TOP,
    w = b.wall,
    d = b.door,
    band: readonly [number, number] = [8.3, 9.15],
    side4: readonly [number, number] = [8.4, 8.95],
    parts: THREE.BufferGeometry[] = [];
  // The deckhouse: its front either side of the door, back and sides; chamfered front corners.
  windowedWall(
    'x',
    -b.half + 0.45,
    -d.half,
    b.foreZ,
    b.foreZ + w,
    top,
    b.top,
    band,
    2,
    parts,
  );
  windowedWall(
    'x',
    d.half,
    b.half - 0.45,
    b.foreZ,
    b.foreZ + w,
    top,
    b.top,
    band,
    2,
    parts,
  );
  parts.push(block(-d.half, d.top, b.foreZ, d.half, b.top, b.foreZ + w, PAINT));
  windowedWall(
    'x',
    -b.half,
    b.half,
    b.aftZ - w,
    b.aftZ,
    top,
    b.top,
    side4,
    5,
    parts,
  );
  for (const side of [-1, 1]) {
    windowedWall(
      'z',
      b.foreZ + 0.45,
      b.aftZ,
      side > 0 ? b.half - w : -b.half,
      side > 0 ? b.half : -b.half + w,
      top,
      b.top,
      side4,
      4,
      parts,
    );
    // The chamfer: a wall set at 45° across the corner.
    const corner = new THREE.BoxGeometry(0.64, b.top - top, w);
    corner.rotateY(side * (Math.PI / 4));
    corner.translate(side * (b.half - 0.23), (b.top + top) / 2, b.foreZ + 0.23);
    parts.push(painted(corner, weathered(PAINT)));
  }
  // The door, hanging open on one hinge.
  const door = new THREE.BoxGeometry(1.4, d.top - top - 0.1, 0.06);
  door.translate(0.7, 0, 0);
  door.rotateY(-1.9);
  door.translate(-d.half, (d.top + top) / 2, b.foreZ - 0.05);
  parts.push(painted(door, weathered(PAINT)));
  // Its roof (the boat deck), with a lip.
  const roof = b.top + 0.22;
  parts.push(
    block(
      -b.half - 0.15,
      b.top,
      b.foreZ - 0.15,
      b.half + 0.15,
      roof,
      b.aftZ + 0.15,
    ),
  );
  // Inside: the binnacle and wheel, the chart table, a fallen locker.
  parts.push(block(-0.3, top, -20.6, 0.3, top + 1.05, -20.2, [0.3, 0.26, 0.2]));
  const rim = new THREE.TorusGeometry(0.42, 0.035, 6, 20);
  rim.translate(0, top + 1.35, -20.68);
  parts.push(painted(rim, () => [0.38, 0.27, 0.16]));
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    parts.push(
      rod(
        new THREE.Vector3(0, top + 1.35, -20.68),
        new THREE.Vector3(
          Math.cos(a) * 0.52,
          top + 1.35 + Math.sin(a) * 0.52,
          -20.68,
        ),
        0.018,
        [0.38, 0.27, 0.16],
        5,
      ),
    );
  }
  parts.push(
    block(1.6, top, -18.6, 2.75, top + 0.9, -17.25, [0.34, 0.26, 0.18]),
  );
  const locker = new THREE.BoxGeometry(0.6, 1.6, 0.45);
  locker.rotateZ(1.35);
  locker.translate(-2.1, top + 0.3, -18.2);
  parts.push(painted(locker, weathered([0.3, 0.33, 0.3])));

  // The wheelhouse: a rounded front (seven facets), wrap-round windows, a visor, its wings.
  const wh = SHIP.wheelhouse,
    hb: readonly [number, number] = [roof + 0.95, wh.top - 0.35],
    facets = 7,
    bulge = 0.55;
  for (let i = 0; i < facets; i++) {
    const a0 = -Math.PI / 2 + (Math.PI * i) / facets,
      a1 = -Math.PI / 2 + (Math.PI * (i + 1)) / facets,
      p0 = new THREE.Vector3(
        Math.sin(a0) * wh.half,
        0,
        wh.foreZ + bulge - Math.cos(a0) * bulge,
      ),
      p1 = new THREE.Vector3(
        Math.sin(a1) * wh.half,
        0,
        wh.foreZ + bulge - Math.cos(a1) * bulge,
      ),
      len = p0.distanceTo(p1),
      yaw = Math.atan2(-(p1.z - p0.z), p1.x - p0.x),
      mid = p0.clone().add(p1).multiplyScalar(0.5);
    for (const [ya, yb, glass] of [
      [roof, hb[0], false],
      [hb[0], hb[1], true],
      [hb[1], wh.top, false],
    ] as const) {
      const g = new THREE.BoxGeometry(len + 0.02, yb - ya, 0.16);
      g.rotateY(yaw);
      g.translate(mid.x, (ya + yb) / 2, mid.z);
      parts.push(painted(g, glass ? () => DARK : weathered(PAINT)));
    }
    parts.push(
      rod(
        new THREE.Vector3(p0.x, hb[0], p0.z),
        new THREE.Vector3(p0.x, hb[1], p0.z),
        0.04,
        PAINT,
        5,
      ),
    );
  }
  for (const side of [-1, 1])
    windowedWall(
      'z',
      wh.foreZ + bulge,
      wh.aftZ,
      side > 0 ? wh.half - 0.16 : -wh.half,
      side > 0 ? wh.half : -wh.half + 0.16,
      roof,
      wh.top,
      hb,
      2,
      parts,
    );
  parts.push(
    block(-wh.half, roof, wh.aftZ - 0.16, wh.half, wh.top, wh.aftZ, PAINT),
  );
  const visor = new THREE.BoxGeometry(
    wh.half * 2 + 0.5,
    0.14,
    wh.aftZ - wh.foreZ + 0.6,
  );
  visor.translate(0, wh.top + 0.08, (wh.foreZ + wh.aftZ) / 2 - 0.2);
  parts.push(painted(visor, weathered(PAINT)));
  // The wings: platforms out to either side with a breastwork and a rail.
  const wg = SHIP.wings;
  for (const side of [-1, 1]) {
    const x0 = Math.min(side * wh.half, side * wg.half),
      x1 = Math.max(side * wh.half, side * wg.half),
      end = side * wg.half;
    // V0.8 Pass 093: the breastwork's plating dished between frames, a rounded capping rail
    // along its top, and knee braces under the platform out to its end.
    parts.push(
      block(x0, roof, wg.foreZ, x1, roof + 0.12, wg.aftZ, PAINT),
      dished(
        block(
          x0,
          roof + 0.12,
          wg.foreZ,
          x1,
          roof + 1.0,
          wg.foreZ + 0.08,
          PAINT,
        ),
        'z',
        1,
        0.025,
      ),
      rod(
        new THREE.Vector3(x0, roof + 1.02, wg.foreZ + 0.04),
        new THREE.Vector3(x1, roof + 1.02, wg.foreZ + 0.04),
        0.045,
        PAINT,
        8,
      ),
      ...[wg.foreZ + 0.15, wg.aftZ - 0.15].map((bz) =>
        rod(
          new THREE.Vector3(side * (b.half + 0.05), roof - 1.1, bz),
          new THREE.Vector3(side * (wg.half - 0.25), roof - 0.02, bz),
          0.05,
          STEEL,
          6,
        ),
      ),
      rod(
        new THREE.Vector3(end, roof + 0.12, wg.foreZ),
        new THREE.Vector3(end, roof + 1.0, wg.foreZ),
        0.035,
      ),
      rod(
        new THREE.Vector3(end, roof + 1.0, wg.foreZ),
        new THREE.Vector3(end, roof + 1.0, wg.aftZ),
        0.03,
      ),
      rod(
        new THREE.Vector3(end, roof + 0.12, wg.aftZ),
        new THREE.Vector3(end, roof + 1.0, wg.aftZ),
        0.035,
      ),
    );
  }
  // The funnel: oval, raked aft, a band and a black top.
  const f = SHIP.funnel,
    height = f.top - roof,
    funnel = new THREE.CylinderGeometry(1, 1, height, 24, 6, true);
  funnel.scale(f.rx, 1, f.rz);
  const fp = funnel.getAttribute('position');
  for (let i = 0; i < fp.count; i++) {
    const y = fp.getY(i) + height / 2;
    fp.setZ(i, fp.getZ(i) + Math.tan(f.rake) * y);
    fp.setY(i, y + roof);
  }
  funnel.translate(0, 0, f.z);
  parts.push(
    painted(funnel, (x, y, z) => {
      const k = (y - roof) / height;
      if (k > 0.86) return DARK;
      if (k > 0.62 && k < 0.74) return [0.55, 0.5, 0.36];
      return weathered([0.36, 0.17, 0.11])(x, y, z);
    }),
  );
  const lip = new THREE.TorusGeometry(1, 0.05, 5, 24);
  lip.rotateX(Math.PI / 2);
  lip.scale(f.rx, 1, f.rz);
  lip.translate(0, f.top, f.z + Math.tan(f.rake) * height);
  parts.push(painted(lip, () => DARK));
  // Boat davits on the boat deck: empty, their boats long gone.
  for (const side of [-1, 1])
    for (const z of [-19.6, -17.6]) {
      const foot = new THREE.Vector3(side * 2.75, roof, z),
        knee = new THREE.Vector3(side * 2.9, roof + 1.6, z),
        tip = new THREE.Vector3(side * 3.6, roof + 2.0, z);
      parts.push(rod(foot, knee, 0.07), rod(knee, tip, 0.06));
    }
  // V0.8 Pass 093: the boat deck's guard rail (stanchions, a top and a middle rail) round its sides
  // and after edge, clear of the funnel and the wheelhouse: rusted, a few bays fallen or bent.
  const rail = 0.95,
    roofEdge = b.half + 0.08,
    railRand = random(9301),
    runs: [THREE.Vector3, THREE.Vector3][] = [
      [
        new THREE.Vector3(-roofEdge, roof, wh.aftZ + 0.3),
        new THREE.Vector3(-roofEdge, roof, b.aftZ + 0.08),
      ],
      [
        new THREE.Vector3(roofEdge, roof, wh.aftZ + 0.3),
        new THREE.Vector3(roofEdge, roof, b.aftZ + 0.08),
      ],
      [
        new THREE.Vector3(-roofEdge, roof, b.aftZ + 0.08),
        new THREE.Vector3(-f.rx - 0.6, roof, b.aftZ + 0.08),
      ],
      [
        new THREE.Vector3(f.rx + 0.6, roof, b.aftZ + 0.08),
        new THREE.Vector3(roofEdge, roof, b.aftZ + 0.08),
      ],
    ];
  for (const [from, to] of runs) {
    const bays = Math.max(1, Math.round(from.distanceTo(to) / 1.1));
    let previous: THREE.Vector3 | undefined;
    for (let i = 0; i <= bays; i++) {
      const foot = from.clone().lerp(to, i / bays),
        lean = railRand() < 0.2 ? (railRand() - 0.5) * 0.5 : 0,
        head = foot
          .clone()
          .add(
            new THREE.Vector3(lean * Math.sign(foot.x || 1), rail, lean * 0.4),
          );
      parts.push(rod(foot, head, 0.028, STEEL, 6));
      const fallen = railRand() < 0.22;
      if (previous && !fallen) {
        // A rail may hang slack from one end where its other has rusted through.
        const sag = railRand() < 0.2 ? 0.45 : 0;
        parts.push(
          rod(previous, head.clone().setY(head.y - sag), 0.022, STEEL, 6),
          rod(
            previous.clone().setY(previous.y - rail * 0.5),
            head.clone().setY(head.y - rail * 0.5 - sag * 0.6),
            0.018,
            STEEL,
            6,
          ),
        );
      }
      previous = head;
    }
  }
  // A ladder up the deckhouse's after wall to the boat deck.
  const lx = 1.9,
    lz = b.aftZ + 0.12;
  for (const sx of [-0.22, 0.22])
    parts.push(
      rod(
        new THREE.Vector3(lx + sx, top, lz),
        new THREE.Vector3(lx + sx, roof + 0.9, lz),
        0.025,
        STEEL,
        6,
      ),
    );
  for (let y = top + 0.3; y < roof; y += 0.3)
    parts.push(
      rod(
        new THREE.Vector3(lx - 0.22, y, lz + 0.02),
        new THREE.Vector3(lx + 0.22, y, lz + 0.02),
        0.016,
        STEEL,
        5,
      ),
    );
  return merge(parts);
}

/** The forecastle's windlass, chains and anchors; the mast, its derrick; deck gear; rudder, screw. */
function fittings(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [],
    top = DECK_TOP,
    fcTop = top + SHIP.forecastle.rise,
    up = new THREE.Vector3(0, 1, 0);
  for (const g of DECK_GEAR) {
    const size = GEAR_SIZE[g.kind],
      q = new THREE.Quaternion().setFromAxisAngle(up, g.yaw),
      local: THREE.BufferGeometry[] = [];
    if (g.kind === 'winch' || g.kind === 'windlass') {
      local.push(
        block(-size.x, 0, -size.z * 0.6, size.x, size.h * 0.35, size.z * 0.6),
      );
      const drum = new THREE.CylinderGeometry(
        size.h * 0.32,
        size.h * 0.32,
        size.x * 1.6,
        14,
      );
      drum.rotateZ(Math.PI / 2);
      drum.translate(0, size.h * 0.6, 0);
      local.push(painted(drum, weathered(RUST)));
      for (const sx of [-1, 1])
        local.push(
          block(
            Math.min(sx * size.x * 0.95, sx * size.x * 0.75),
            0,
            -size.z * 0.5,
            Math.max(sx * size.x * 0.95, sx * size.x * 0.75),
            size.h,
            size.z * 0.5,
          ),
        );
    } else if (g.kind === 'vent') {
      // A ventilator cowl: a pipe turning over into a bell mouth.
      const pipe = new THREE.CylinderGeometry(0.2, 0.22, size.h - 0.45, 12);
      pipe.translate(0, (size.h - 0.45) / 2, 0);
      local.push(painted(pipe, weathered(PAINT)));
      const bend = new THREE.TorusGeometry(0.28, 0.2, 8, 12, Math.PI / 2);
      bend.rotateY(Math.PI / 2);
      bend.translate(0, size.h - 0.45, 0.28);
      local.push(painted(bend, weathered(PAINT)));
      const bell = new THREE.CylinderGeometry(0.38, 0.22, 0.3, 14, 1, true);
      bell.rotateX(Math.PI / 2);
      bell.translate(0, size.h - 0.17, 0.43);
      local.push(
        painted(bell, (x, y, z) =>
          z > 0.5 ? DARK : weathered(PAINT)(x, y, z),
        ),
      );
    } else {
      // A pair of bollards on a plate.
      local.push(block(-size.x, 0, -size.z, size.x, 0.06, size.z));
      for (const sz of [-1, 1]) {
        const post = new THREE.CylinderGeometry(0.14, 0.15, size.h, 12);
        post.translate(0, size.h / 2, sz * size.z * 0.55);
        local.push(painted(post, weathered(STEEL)));
      }
    }
    for (const p of local) {
      p.applyQuaternion(q);
      p.translate(g.at.x, g.at.y, g.at.z);
      parts.push(p);
    }
  }
  // Anchor chains from the windlass forward to the hawse pipes, and the anchors stowed below.
  const bowAt = -47.4;
  for (const side of [-1, 1]) {
    const from = new THREE.Vector3(side * 0.6, fcTop + 0.5, -46.2),
      to = new THREE.Vector3(
        side * (hullX(bowAt, fcTop) - 0.25),
        fcTop + 0.02,
        bowAt,
      ),
      n = 14;
    for (let i = 0; i < n; i++) {
      const link = new THREE.TorusGeometry(0.09, 0.03, 5, 8),
        t = (i + 0.5) / n,
        p = from.clone().lerp(to, t);
      if (i % 2) link.rotateY(Math.PI / 2);
      p.y -= 0.12 * Math.sin(t * Math.PI);
      link.lookAt(to.clone().sub(from));
      link.translate(p.x, p.y, p.z);
      parts.push(painted(link, weathered(RUST)));
    }
    const z = bowAt + 0.3,
      x = side * (hullX(z, fcTop - 1.2) + 0.12);
    parts.push(
      rod(
        new THREE.Vector3(x, fcTop - 0.6, z),
        new THREE.Vector3(x, fcTop - 2.3, z),
        0.08,
        DARK,
      ),
    );
    for (const fz of [-1, 1])
      parts.push(
        rod(
          new THREE.Vector3(x, fcTop - 2.3, z),
          new THREE.Vector3(x, fcTop - 1.8, z + fz * 0.55),
          0.09,
          DARK,
        ),
      );
  }
  // The foremast: tapered, with crosstrees and a crow's nest; its topmast broken and hanging.
  const m = SHIP.mast,
    trees = m.top - 2.4,
    mast = new THREE.CylinderGeometry(
      m.radius * 0.65,
      m.radius,
      m.top - top,
      12,
    );
  mast.translate(0, (m.top + top) / 2, m.z);
  parts.push(painted(mast, weathered(PAINT)));
  parts.push(
    rod(
      new THREE.Vector3(-1.6, trees, m.z),
      new THREE.Vector3(1.6, trees, m.z),
      0.07,
    ),
  );
  const nest = new THREE.CylinderGeometry(0.55, 0.5, 0.7, 14, 1, true);
  nest.translate(0, trees + 0.5, m.z);
  parts.push(painted(nest, weathered(PAINT)));
  parts.push(
    rod(
      new THREE.Vector3(0, m.top, m.z),
      new THREE.Vector3(0.9, m.top - 1.8, m.z + 0.5),
      0.06,
    ),
  );
  // Rigging: stays from the crosstrees to the bulwarks, some parted and hanging slack.
  for (const [x, z, parted] of [
    [-3.4, -41, false],
    [3.4, -41, true],
    [-2.6, -45, false],
    [2.9, -38.5, true],
  ] as const) {
    const from = new THREE.Vector3(x > 0 ? 1.5 : -1.5, trees, m.z),
      end = new THREE.Vector3(x, railAt(z), z),
      to = parted
        ? from
            .clone()
            .lerp(end, 0.55)
            .setY(trees - 3.5)
        : end;
    parts.push(rod(from, to, 0.025, DARK, 4));
  }
  // The derrick, broken from the mast's foot and lying across the deck to the hatch.
  parts.push(
    rod(
      new THREE.Vector3(BOOM.from.x, BOOM.from.y, BOOM.from.z),
      new THREE.Vector3(BOOM.to.x, BOOM.to.y, BOOM.to.z),
      BOOM.radius,
      RUST,
      10,
    ),
  );
  // Rudder and propeller under the counter.
  // In the aperture under the counter: the screw just aft of the hull's lower end, then the rudder.
  const post = SHIP.sternZ - 1.6;
  const rudder = new THREE.BoxGeometry(0.16, 3.2, 1.5);
  rudder.translate(0, 2.0, post + 1.05);
  parts.push(painted(rudder, weathered(BOTTOM)));
  const hub = new THREE.CylinderGeometry(0.3, 0.38, 0.6, 14);
  hub.rotateX(Math.PI / 2);
  hub.translate(0, 1.7, post + 0.25);
  parts.push(painted(hub, () => [0.4, 0.33, 0.2]));
  for (let i = 0; i < 4; i++) {
    const blade = new THREE.SphereGeometry(1, 10, 6);
    blade.scale(0.3, 0.85, 0.06);
    blade.translate(0, 0.85, 0);
    blade.rotateY(0.45);
    blade.rotateZ((i / 4) * Math.PI * 2 + 0.3);
    blade.translate(0, 1.7, post + 0.25);
    parts.push(painted(blade, () => [0.42, 0.34, 0.2]));
  }
  return merge(parts);
}

export class ShipwreckModel {
  readonly root = new THREE.Group();
  private readonly geometries: THREE.BufferGeometry[] = [];
  private readonly materials: THREE.Material[] = [];

  constructor(seed = 5101) {
    this.root.name = 'Shipwreck';
    this.root.matrixAutoUpdate = false;
    this.root.matrix.copy(SHIP_POSE);
    const rand = random(seed),
      shell = new THREE.MeshStandardMaterial({
        vertexColors: true,
        roughness: 0.9,
        // V0.7 Pass 076: corroded, growth-covered steel behaves as a dielectric; metalness with no
        // environment map only darkened it into a slab.
        metalness: 0.05,
        side: THREE.DoubleSide,
      }),
      steel = new THREE.MeshStandardMaterial({
        vertexColors: true,
        roughness: 0.86,
        metalness: 0.06,
      }),
      // V0.8 Pass 087 (consistency audit: the colonies' reef-bright instance colours read as
      // stickers in the wreck's murk): a grey-green veil of silt over every colony, so they keep
      // their hue but sit in the same light and value range as the steel they grow on.
      // V0.8 Pass 092: one material per kind of surface (they were one), under the same veil.
      growth = (roughness: number) =>
        new THREE.MeshStandardMaterial({
          vertexColors: true,
          color: 0xa9b5a8,
          roughness,
          side: THREE.DoubleSide,
        }),
      surfaces: Record<GrowthSurface, THREE.MeshStandardMaterial> = {
        // Velvety sponge: the roughest.
        sponge: growth(0.98),
        // Living tissue keeps a soft sheen.
        tissue: growth(0.72),
        // Coralline crust: dead matte.
        crust: growth(1),
      };
    this.materials.push(shell, steel, ...Object.values(surfaces));
    const add = (g: THREE.BufferGeometry, m: THREE.Material, name: string) => {
      this.geometries.push(g);
      const mesh = new THREE.Mesh(g, m);
      mesh.name = name;
      mesh.matrixAutoUpdate = false;
      this.root.add(mesh);
    };
    add(hullShell(rand), shell, 'Wreck hull');
    add(decks(), shell, 'Wreck decks');
    add(hold(), steel, 'Wreck hold');
    add(superstructure(), steel, 'Wreck superstructure');
    add(fittings(), steel, 'Wreck fittings');
    this.growth(rand, surfaces);
    this.root.updateMatrixWorld(true);
  }
  /** Sponges and soft corals over the decks and the upper hull, sea fans on the sides. */
  private growth(
    rand: () => number,
    surfaces: Record<GrowthSurface, THREE.Material>,
  ): void {
    const m = new THREE.Matrix4(),
      q = new THREE.Quaternion(),
      turn = new THREE.Quaternion(),
      s = new THREE.Vector3(),
      at = new THREE.Vector3(),
      n = new THREE.Vector3(),
      up = new THREE.Vector3(0, 1, 0),
      colour = new THREE.Color();
    const clearOfOpenings = (x: number, y: number, z: number) => {
      const h = SHIP.hatch,
        b = SHIP.bridge,
        br = SHIP.breach;
      return !(
        (Math.abs(x) < h.half + 0.5 && z > h.foreZ - 0.5 && z < h.aftZ + 0.5) ||
        (Math.abs(x) < b.half + 0.5 && z > b.foreZ - 1.8 && z < b.aftZ + 0.4) ||
        (x > 0 &&
          z > br.foreZ - 0.6 &&
          z < br.aftZ + 0.6 &&
          y > br.low - 0.6 &&
          y < br.high + 0.6) ||
        DECK_GEAR.some((g) => Math.hypot(g.at.x - x, g.at.z - z) < 1.1)
      );
    };
    const scatter = (
      material: THREE.Material,
      geometry: THREE.BufferGeometry,
      count: number,
      name: string,
      onDeck: number,
      size: () => number,
      palette: readonly RGB[],
      mode: GrowthMode,
    ) => {
      const fan = mode === 'fan',
        shelf = mode === 'shelf';
      this.geometries.push(geometry);
      const mesh = new THREE.InstancedMesh(geometry, material, count);
      mesh.name = name;
      // V0.7 Pass 080: colonies, not confetti. Each kind was scattered uniformly over the whole
      // ship, which read as an even sprinkle of stickers in bands along the flanks. Now each kind
      // settles in a few patches (its larvae settle near their own kind), with extra growth
      // along the rail edges where the current runs, and bare plate showing between patches.
      const zFrom = SHIP.bowZ + 1.5,
        zSpan = SHIP.sternZ - SHIP.bowZ - 2.5,
        gauss = () => rand() + rand() + rand() - 1.5,
        // V0.8 Pass 086: every kind settles round the shared sites (on the mats painted
        // there), each on its own share of them, so colonies of different kinds mix in the
        // same patches, as on a real wreck, instead of each kind scattering on its own.
        crust = mode === 'crust',
        mine = GROWTH_SITES.filter(() => crust || rand() < 0.6),
        patches = (mine.length >= 3 ? mine : GROWTH_SITES).map((p) => ({
          side: p.side === 0 ? (rand() < 0.5 ? -1 : 1) : p.side,
          z: p.z,
          y: p.band,
          x: p.x,
          spread: p.radius * (crust ? 0.75 : 1),
          deck: p.side === 0,
        }));
      let placed = 0;
      for (let tries = 0; placed < count && tries < count * 20; tries++) {
        const patch = patches[Math.floor(rand() * patches.length)],
          loose = rand() < (crust ? 0.04 : 0.2),
          z = loose
            ? zFrom + rand() * zSpan
            : Math.min(
                zFrom + zSpan,
                Math.max(zFrom, patch.z + gauss() * patch.spread * 1.3),
              );
        if (loose ? rand() < onDeck : patch.deck) {
          let y = deckTopAt(z);
          const x =
            (loose
              ? rand() * 2 - 1
              : Math.max(-1, Math.min(1, patch.x + gauss() * 0.5))) *
            (hullX(z, y) - 0.5);
          // V0.8 Pass 093: what settles on the deckhouse grows on its roof, the boat deck
          // (clear of the wheelhouse, the funnel and the davits), instead of being dropped.
          if (onBoatDeck(x, z)) y = SHIP.bridge.top + 0.22;
          else if (
            !clearOfOpenings(x, y, z) ||
            Math.abs(z - SHIP.forecastle.aftZ) < 0.6
          )
            continue;
          at.set(x, y, z);
          n.copy(up);
        } else {
          // A patch's own side and height band; a share hugs the rail edge, where the current
          // runs and growth crowds thickest on a wreck.
          const side = loose ? (rand() < 0.5 ? -1 : 1) : patch.side,
            edge = rand() < 0.3,
            band = edge
              ? 0.88 + 0.12 * rand()
              : loose
                ? Math.sqrt(rand())
                : Math.max(
                    0,
                    Math.min(1, patch.y + (gauss() * patch.spread) / 3.2),
                  ),
            y = 1.2 + band * (railAt(z) - 1.6),
            // V0.7 Pass 076: set into the plating (it sits inside the design surface by its inset).
            x = side * (hullX(z, y) - hullInset(y, z) - 0.01);
          if (Math.abs(x) < 0.5 || !clearOfOpenings(x, y, z)) continue;
          at.set(x, y, z);
          // Leaning out and up from the plating (fans stand up into the current); plates stand
          // out from it as shelves, near level, their foot against the plating.
          // Mats lie flush on the plate.
          n.set(
            side,
            fan ? 1.6 : shelf ? 4 : crust ? 0.02 : 0.15,
            0,
          ).normalize();
        }
        q.setFromUnitVectors(up, n);
        // Fans stand across the current (along the hull); others turn any way.
        q.multiply(
          turn.setFromAxisAngle(
            up,
            fan ? Math.PI / 2 + (rand() - 0.5) * 0.5 : rand() * Math.PI * 2,
          ),
        );
        const k = size();
        s.set(k * (0.8 + rand() * 0.5), k, k * (0.8 + rand() * 0.5));
        mesh.setMatrixAt(placed, m.compose(at, q, s));
        const [r, g, bl] = palette[Math.floor(rand() * palette.length)];
        mesh.setColorAt(placed, colour.setRGB(r, g, bl));
        placed++;
      }
      mesh.count = placed;
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      this.root.add(mesh);
    };
    // As on the Yongala: hardly a bare plate left (see `WRECK_GROWTH`).
    for (const kind of WRECK_GROWTH) {
      const [lo, hi] = kind.size;
      scatter(
        surfaces[kind.surface],
        kind.build(),
        kind.count,
        kind.name,
        kind.onDeck,
        () => lo + (hi - lo) * rand() * (0.4 + 0.6 * rand()),
        kind.palette,
        kind.mode,
      );
    }
  }
  dispose(): void {
    this.root.removeFromParent();
    this.root.traverse((o) => {
      if (o instanceof THREE.InstancedMesh) o.dispose();
    });
    this.root.clear();
    this.geometries.forEach((g) => g.dispose());
    this.materials.forEach((m) => m.dispose());
  }
}
