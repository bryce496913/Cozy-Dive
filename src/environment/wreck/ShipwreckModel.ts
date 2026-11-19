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
const STEEL: RGB = [0.33, 0.3, 0.27];
const PAINT: RGB = [0.5, 0.48, 0.43];
const DECK: RGB = [0.34, 0.3, 0.24];
const BOTTOM: RGB = [0.42, 0.16, 0.12];
const DARK: RGB = [0.08, 0.07, 0.06];

function random(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}
/** Non-indexed, positions and normals only, coloured by `colour(position)`. */
function painted(
  g: THREE.BufferGeometry,
  colour: (x: number, y: number, z: number) => RGB,
  smoothNormals = false,
): THREE.BufferGeometry {
  if (smoothNormals) g.computeVertexNormals();
  const out = g.index ? g.toNonIndexed() : g;
  if (out !== g) g.dispose();
  for (const name of Object.keys(out.attributes))
    if (name !== 'position' && name !== 'normal') out.deleteAttribute(name);
  const p = out.getAttribute('position'),
    col = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++)
    col.set(colour(p.getX(i), p.getY(i), p.getZ(i)), i * 3);
  out.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  if (!smoothNormals) out.computeVertexNormals();
  return out;
}
const scale = (c: RGB, k: number): RGB => [c[0] * k, c[1] * k, c[2] * k];
const mix = (a: RGB, b: RGB, t: number): RGB => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
];
/** Weathered steel: mottled, rust bleeding through. */
function weathered(base: RGB) {
  return (x: number, y: number, z: number): RGB => {
    const mottle =
        0.78 +
        0.12 *
          Math.sin(z * 2.3 + Math.sin(y * 0.9) * 2) *
          Math.sin(x * 1.7 + y * 0.6) +
        0.08 * Math.sin(z * 7.1 + x * 5.3 + y * 3.7),
      rust = Math.max(
        0,
        Math.sin(x * 3.1 + z * 1.3) * Math.sin(y * 2.2 - z * 0.7) - 0.3,
      );
    return scale(mix(base, RUST, Math.min(1, rust * 1.6)), mottle);
  };
}
/** The hull's own colouring: faded red bottom, rust streaks running down, plating seams. */
function hullColour(x: number, y: number, z: number): RGB {
  const top = DECK_TOP,
    // Boot-topping: the old red bottom paint below the line, faded and patchy.
    bottom = 1 - Math.min(1, Math.max(0, (y - 2.4) / 0.5)),
    base = mix(STEEL, BOTTOM, bottom * (0.7 + 0.3 * Math.sin(z * 0.9 + y))),
    // Long streaks of rust, running down from the deck edge.
    streak =
      Math.pow(Math.max(0, Math.sin(z * 1.7 + 0.6 * Math.sin(z * 0.3))), 12) *
      Math.min(1, Math.max(0, (y - 1) / (top - 1))),
    // Strakes (horizontal seams) and butts (vertical seams) between the plates.
    seam =
      Math.abs(((y - 0.2) / 1.15) % 1) < 0.05 ||
      Math.abs(((z + 100) / 2.6) % 1) < 0.025
        ? 0.72
        : 1,
    mottle =
      0.82 +
      0.12 * Math.sin(z * 3.3 + y * 2.1) * Math.sin(z * 0.7 - y * 1.9 + x);
  return scale(
    mix(base, RUST, Math.min(1, streak * 0.9 + 0.15)),
    mottle * seam,
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
  const g = new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0);
  g.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
  return painted(g, weathered(c));
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

/** The hull plating, keel to rail, lofted section by section, open where it has rusted through. */
function hullShell(rand: () => number): THREE.BufferGeometry {
  const rows = 30,
    stations = 240,
    b = SHIP.breach,
    open = (z: number, y: number) => {
      const j = (rand() - 0.5) * 0.7;
      return (
        z > b.foreZ + j && z < b.aftZ - j && y > b.low + j && y < b.high - j
      );
    };
  // Each row runs exactly from the stem (raked, so further forward higher up) to the stern
  // (cut back below the counter), with stations closer together towards both ends; so the stem
  // and stern are clean edges, not stepped.
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
      side * Math.max(0, x - (x > 0.3 ? dent(yy, z) : 0)),
      yy,
      z,
    );
  };
  const positions: number[] = [];
  for (const side of [-1, 1])
    for (let i = 0; i < stations; i++)
      for (let j = 0; j < rows; j++) {
        const a = at(i, j, side),
          bb = at(i + 1, j, side),
          c = at(i + 1, j + 1, side),
          d = at(i, j + 1, side);
        // Above the rail (rows run past it, to cover the forecastle): nothing.
        if (a.y === d.y && bb.y === c.y) continue;
        if (side > 0 && open((a.z + bb.z) / 2, (a.y + c.y) / 2)) continue;
        const quad = side > 0 ? [a, bb, c, a, c, d] : [a, c, bb, a, d, c];
        for (const v of quad) positions.push(v.x, v.y, v.z);
      }
  const shell = new THREE.BufferGeometry();
  shell.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(positions, 3),
  );
  // The rail capping the bulwark, all round.
  const parts = [painted(shell, hullColour)];
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
        painted(g, (x, _y, zz) => {
          // Planking worn to the steel beneath, silt and a green-brown film of algae.
          const plank =
              0.85 +
              0.1 * Math.sign(Math.sin(x * 9)) +
              0.06 * Math.sin(zz * 3.1),
            film =
              0.5 +
              0.5 * Math.sin(x * 0.9 + zz * 0.45) * Math.sin(zz * 0.31 - x);
          return scale(
            mix(DECK, [0.3, 0.33, 0.22], film * 0.6),
            plank * (underside ? 0.5 : 1),
          );
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
  const piece = (p0: number, p1: number, ya: number, yb: number) =>
    parts.push(
      along === 'x'
        ? block(p0, ya, fixed0, p1, yb, fixed1, PAINT)
        : block(fixed0, ya, p0, fixed1, yb, p1, PAINT),
    );
  piece(a0, a1, y0, band[0]);
  piece(a0, a1, band[1], y1);
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
    parts.push(
      block(x0, roof, wg.foreZ, x1, roof + 0.12, wg.aftZ, PAINT),
      block(x0, roof + 0.12, wg.foreZ, x1, roof + 1.0, wg.foreZ + 0.08, PAINT),
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

/** Soft growth: a sponge cushion (smooth, lumpy), a branching soft coral, and a sea fan. */
function sponge(): THREE.BufferGeometry {
  const g = new THREE.SphereGeometry(1, 14, 10),
    p = g.getAttribute('position');
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i),
      y = Math.max(-0.1, p.getY(i)),
      z = p.getZ(i),
      k = 1 + 0.2 * Math.sin(x * 4 + z * 3) + 0.1 * Math.sin(x * 9 - z * 7);
    p.setXYZ(i, x * k, y * 0.55 * k, z * k);
  }
  return painted(g, (_x, y) => scale([1, 1, 1], 0.8 + 0.35 * y), true);
}
function softCoral(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 6; i++) {
    const a = i * 2.3,
      tip = new THREE.Vector3(
        Math.cos(a) * 0.35,
        0.7 + 0.25 * Math.sin(i * 1.7),
        Math.sin(a) * 0.35,
      );
    parts.push(rod(new THREE.Vector3(0, 0, 0), tip, 0.09, [1, 1, 1], 6));
    const knob = new THREE.SphereGeometry(0.16, 8, 6);
    knob.translate(tip.x, tip.y, tip.z);
    parts.push(painted(knob, () => [1, 1, 1], true));
  }
  return merge(parts);
}
function seaFan(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  // A flat fan of branching twigs in one plane (x-y).
  const grow = (
    from: THREE.Vector3,
    angle: number,
    length: number,
    depth: number,
  ) => {
    const to = from
      .clone()
      .add(
        new THREE.Vector3(
          Math.sin(angle) * length,
          Math.cos(angle) * length,
          0,
        ),
      );
    parts.push(rod(from, to, 0.025 * (depth + 1), [1, 1, 1], 4));
    if (depth > 0) {
      grow(to, angle - 0.45, length * 0.72, depth - 1);
      grow(to, angle + 0.4, length * 0.7, depth - 1);
    }
  };
  grow(new THREE.Vector3(0, 0, 0), 0, 0.35, 4);
  return merge(parts);
}

const GROWTH: readonly RGB[] = [
  [0.9, 0.5, 0.2],
  [0.92, 0.8, 0.35],
  [0.82, 0.78, 0.7],
  [0.66, 0.36, 0.56],
  [0.45, 0.58, 0.42],
  [0.85, 0.3, 0.25],
];

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
        metalness: 0.2,
        side: THREE.DoubleSide,
      }),
      steel = new THREE.MeshStandardMaterial({
        vertexColors: true,
        roughness: 0.86,
        metalness: 0.18,
      }),
      soft = new THREE.MeshStandardMaterial({
        vertexColors: true,
        roughness: 0.95,
        side: THREE.DoubleSide,
      });
    this.materials.push(shell, steel, soft);
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
    this.growth(rand, soft);
    this.root.updateMatrixWorld(true);
  }
  /** Sponges and soft corals over the decks and the upper hull, sea fans on the sides. */
  private growth(rand: () => number, material: THREE.Material): void {
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
      geometry: THREE.BufferGeometry,
      count: number,
      name: string,
      onDeck: number,
      size: () => number,
      fan = false,
    ) => {
      this.geometries.push(geometry);
      const mesh = new THREE.InstancedMesh(geometry, material, count);
      mesh.name = name;
      let placed = 0;
      for (let tries = 0; placed < count && tries < count * 20; tries++) {
        const z = SHIP.bowZ + 1.5 + rand() * (SHIP.sternZ - SHIP.bowZ - 2.5);
        if (rand() < onDeck) {
          const y = deckTopAt(z),
            x = (rand() * 2 - 1) * (hullX(z, y) - 0.5);
          if (
            !clearOfOpenings(x, y, z) ||
            Math.abs(z - SHIP.forecastle.aftZ) < 0.6
          )
            continue;
          at.set(x, y, z);
          n.copy(up);
        } else {
          const side = rand() < 0.5 ? -1 : 1,
            y = 1.2 + Math.sqrt(rand()) * (railAt(z) - 1.6),
            x = side * hullX(z, y);
          if (Math.abs(x) < 0.5 || !clearOfOpenings(x, y, z)) continue;
          at.set(x, y, z);
          // Leaning out and up from the plating (fans stand up into the current).
          n.set(side, fan ? 1.6 : 0.15, 0).normalize();
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
        const [r, g, bl] = GROWTH[Math.floor(rand() * GROWTH.length)];
        mesh.setColorAt(placed, colour.setRGB(r, g, bl));
        placed++;
      }
      mesh.count = placed;
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      this.root.add(mesh);
    };
    scatter(
      sponge(),
      150,
      'Wreck sponges',
      0.55,
      () => 0.07 + rand() * rand() * 0.28,
    );
    scatter(
      softCoral(),
      70,
      'Wreck soft corals',
      0.6,
      () => 0.25 + rand() * 0.35,
    );
    scatter(
      seaFan(),
      40,
      'Wreck sea fans',
      0.15,
      () => 0.8 + rand() * 0.9,
      true,
    );
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
