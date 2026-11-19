import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { HOLD_CARGO, SHIP, hullHalfWidth } from './WreckLayout';

/**
 * The shipwreck's meshes, built in code from `SHIP` so they match its collision exactly: a rusted
 * steel hull (open at its starboard breach), the deck with its open cargo hatch, the hold's ribs,
 * bulkheads and spilled cargo, the bridge with its door, windows and wheel, the funnel and the
 * foremast, broken railings, and sponges and soft corals grown over everything. Owns its GPU
 * objects.
 */
type RGB = readonly [number, number, number];
const RUST: RGB = [0.36, 0.2, 0.13];
const STEEL: RGB = [0.3, 0.27, 0.24];
const DECK: RGB = [0.33, 0.29, 0.23];
const GROWTH: readonly RGB[] = [
  [0.85, 0.45, 0.18],
  [0.9, 0.78, 0.3],
  [0.78, 0.74, 0.66],
  [0.6, 0.32, 0.5],
  [0.42, 0.55, 0.4],
];

function random(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}
/** Non-indexed, positions and normals only, coloured by `tone(position)` times `c`. */
function painted(
  g: THREE.BufferGeometry,
  c: RGB,
  tone: (x: number, y: number, z: number) => number = () => 1,
): THREE.BufferGeometry {
  const out = g.index ? g.toNonIndexed() : g;
  if (out !== g) g.dispose();
  for (const name of Object.keys(out.attributes))
    if (name !== 'position' && name !== 'normal') out.deleteAttribute(name);
  const p = out.getAttribute('position'),
    col = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) {
    const k = tone(p.getX(i), p.getY(i), p.getZ(i));
    col[i * 3] = c[0] * k;
    col[i * 3 + 1] = c[1] * k;
    col[i * 3 + 2] = c[2] * k;
  }
  out.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  out.computeVertexNormals();
  return out;
}
/** Rust streaks and mottling on steel, darker low down. */
const weathered = (x: number, y: number, z: number): number =>
  0.7 +
  0.18 *
    Math.sin(z * 2.3 + Math.sin(y * 0.9) * 2) *
    Math.sin(x * 1.7 + y * 0.6) +
  0.12 * Math.sin(z * 7.1 + x * 5.3) +
  0.04 * y;
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
  return painted(g, c, weathered);
}
function merge(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const m = mergeGeometries(parts, false);
  parts.forEach((g) => g.dispose());
  if (!m) throw Error('The shipwreck could not be built');
  return m;
}

/** How full the hull's section is at height `y` (0 at the keel … 1 at the deck), at station z. */
function sectionFactor(z: number, y: number): number {
  const top = SHIP.deck + SHIP.plate,
    v = Math.max(0, Math.min(1, (y - SHIP.keel) / (top - SHIP.keel))),
    // A fine V forward, a boxy, round-bilged section amidships and aft.
    fine = Math.max(
      0,
      Math.min(1, (SHIP.foreZ - z) / (SHIP.foreZ - SHIP.bowZ)),
    ),
    p = 6 - 4.4 * fine;
  return Math.pow(1 - Math.pow(1 - v, p), 1 / p);
}

/** The hull plating: lofted section by section, open where it has rusted through. */
function hullShell(rand: () => number): THREE.BufferGeometry {
  const top = SHIP.deck + SHIP.plate,
    rows = 16,
    zs: number[] = [];
  for (let z = SHIP.bowZ + 0.05; z < SHIP.sternZ; z += 0.35) zs.push(z);
  zs.push(SHIP.sternZ - 0.02);
  const ys = Array.from(
    { length: rows + 1 },
    (_, j) => SHIP.keel + ((top - SHIP.keel) * j) / rows,
  );
  const point = (z: number, y: number, side: number) =>
    new THREE.Vector3(side * hullHalfWidth(z) * sectionFactor(z, y), y, z);
  const b = SHIP.breach,
    // A ragged edge: each panel near the breach's rim is gone or not by chance.
    open = (z: number, y: number) => {
      const j = (rand() - 0.5) * 0.7;
      return (
        z > b.foreZ + j && z < b.aftZ - j && y > b.low + j && y < b.high - j
      );
    };
  const positions: number[] = [];
  for (const side of [-1, 1])
    for (let i = 0; i + 1 < zs.length; i++)
      for (let j = 0; j < rows; j++) {
        const za = zs[i],
          zb = zs[i + 1],
          ya = ys[j],
          yb = ys[j + 1];
        if (side > 0 && open((za + zb) / 2, (ya + yb) / 2)) continue;
        const a = point(za, ya, side),
          bb = point(zb, ya, side),
          c = point(zb, yb, side),
          d = point(za, yb, side);
        // Facing outwards on both sides.
        const quad = side > 0 ? [a, bb, c, a, c, d] : [a, c, bb, a, d, c];
        for (const v of quad) positions.push(v.x, v.y, v.z);
      }
  // The flat bottom between the sides' keel edges, and the transom across the stern.
  const shell = new THREE.BufferGeometry();
  shell.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(positions, 3),
  );
  const transom = new THREE.Shape();
  const sz = SHIP.sternZ - 0.02;
  transom.moveTo(-hullHalfWidth(sz) * sectionFactor(sz, SHIP.keel), SHIP.keel);
  for (const y of ys)
    transom.lineTo(hullHalfWidth(sz) * sectionFactor(sz, y), y);
  for (const y of [...ys].reverse())
    transom.lineTo(-hullHalfWidth(sz) * sectionFactor(sz, y), y);
  const stern = new THREE.ShapeGeometry(transom);
  stern.translate(0, 0, sz);
  return merge([
    painted(shell, RUST, weathered),
    painted(stern, RUST, weathered),
  ]);
}

/** The deck: plating strip by strip inside the hull's line, open at the hatch; its underside too. */
function deck(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [],
    top = SHIP.deck + SHIP.plate,
    h = SHIP.hatch,
    step = 0.5;
  for (let z = SHIP.bowZ + 0.3; z < SHIP.sternZ - 0.05; z += step) {
    const z1 = Math.min(z + step, SHIP.sternZ - 0.05),
      hw = Math.min(hullHalfWidth(z), hullHalfWidth(z1)) - 0.02;
    if (hw <= 0.05) continue;
    const spans: [number, number][] =
      z1 > h.foreZ && z < h.aftZ
        ? [
            [-hw, -h.half],
            [h.half, hw],
          ]
        : [[-hw, hw]];
    for (const [x0, x1] of spans) {
      for (const [y, flip] of [
        [top, false],
        [SHIP.deck, true],
      ] as const) {
        const g = new THREE.PlaneGeometry(x1 - x0, z1 - z, 1, 1);
        g.rotateX(flip ? Math.PI / 2 : -Math.PI / 2);
        g.translate((x0 + x1) / 2, y, (z + z1) / 2);
        // Planking: alternate strakes a shade apart, worn paler down the middle.
        parts.push(
          painted(
            g,
            DECK,
            (x, _y, zz) =>
              (flip ? 0.55 : 1) *
              (0.8 +
                0.1 * Math.sign(Math.sin(x * 9)) +
                0.08 * Math.sin(zz * 3.1)),
          ),
        );
      }
    }
  }
  // The hatch's coaming.
  const c = h.coaming;
  parts.push(
    block(-h.half - 0.15, top, h.foreZ - 0.15, h.half + 0.15, top + c, h.foreZ),
    block(-h.half - 0.15, top, h.aftZ, h.half + 0.15, top + c, h.aftZ + 0.15),
    block(-h.half - 0.15, top, h.foreZ, -h.half, top + c, h.aftZ),
    block(h.half, top, h.foreZ, h.half + 0.15, top + c, h.aftZ),
  );
  // One hatch cover, fallen in across the hold's floor at a slant.
  const cover = new THREE.BoxGeometry(1.5, 0.1, 2.2);
  cover.rotateZ(0.5);
  cover.translate(1.9, 1.75, -31.5);
  parts.push(painted(cover, STEEL, weathered));
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
    painted(
      floor,
      STEEL,
      (x, _y, z) => 0.55 + 0.15 * Math.sin(x * 2 + z * 1.3),
    ),
  );
  for (const [z, face] of [
    [o.foreZ, 1],
    [o.aftZ, -1],
  ] as const) {
    const g = new THREE.PlaneGeometry(inner * 2, s.deck - o.floor);
    if (face < 0) g.rotateY(Math.PI);
    g.translate(0, (s.deck + o.floor) / 2, z);
    parts.push(painted(g, STEEL, weathered));
    // Stiffeners on the bulkhead.
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
  for (let z = o.foreZ + 0.6; z < o.aftZ; z += 0.9) {
    // Frames (ribs) up each side.
    for (const side of [-1, 1])
      parts.push(
        // Set in a little, so they stay inside the plating where it curves in at the bilge.
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
  }
  // Deck beams overhead (none across the open hatch).
  for (let z = o.foreZ + 1.1; z < o.aftZ; z += 1.8)
    if (z < s.hatch.foreZ - 0.2 || z > s.hatch.aftZ + 0.2)
      parts.push(
        block(-inner, s.deck - 0.28, z - 0.07, inner, s.deck, z + 0.07, RUST),
      );
  // The cargo: crates (planked) and drums.
  for (const k of HOLD_CARGO) {
    if (k.drum) {
      const g = new THREE.CylinderGeometry(
        k.half.x,
        k.half.x,
        k.half.y * 2,
        14,
      );
      g.translate(k.at.x, k.at.y, k.at.z);
      parts.push(
        painted(g, [0.32, 0.36, 0.3], (_x, y) => 0.8 + 0.2 * Math.sin(y * 18)),
      );
    } else {
      const g = new THREE.BoxGeometry(k.half.x * 2, k.half.y * 2, k.half.z * 2);
      g.translate(k.at.x, k.at.y, k.at.z);
      parts.push(
        painted(
          g,
          [0.4, 0.3, 0.18],
          (x, y, z) => 0.7 + 0.18 * Math.sign(Math.sin((x + z) * 11 + y * 7)),
        ),
      );
    }
  }
  return merge(parts);
}

/** The bridge deckhouse: walls with a door and windows, the roof, wheel and chart table. */
function bridge(): THREE.BufferGeometry {
  const b = SHIP.bridge,
    top = SHIP.deck + SHIP.plate,
    w = b.wall,
    win = { low: 8.3, high: 9.15 },
    parts: THREE.BufferGeometry[] = [];
  /** A wall from x0 to x1 (or z0 to z1), with window openings every `pitch` m. */
  const wall = (
    along: 'x' | 'z',
    a0: number,
    a1: number,
    fixed0: number,
    fixed1: number,
    gaps: readonly [number, number][],
  ) => {
    const piece = (p0: number, p1: number, y0: number, y1: number) =>
      parts.push(
        along === 'x'
          ? block(p0, y0, fixed0, p1, y1, fixed1, [0.42, 0.4, 0.36])
          : block(fixed0, y0, p0, fixed1, y1, p1, [0.42, 0.4, 0.36]),
      );
    // Below and above the windows, solid; between, piers between the openings.
    piece(a0, a1, top, win.low);
    piece(a0, a1, win.high, b.top);
    let at = a0;
    for (const [g0, g1] of gaps) {
      if (g0 > at) piece(at, g0, win.low, win.high);
      at = g1;
    }
    if (at < a1) piece(at, a1, win.low, win.high);
  };
  const windows = (a0: number, a1: number, n: number): [number, number][] => {
    const out: [number, number][] = [],
      span = (a1 - a0) / n;
    for (let i = 0; i < n; i++)
      out.push([a0 + span * (i + 0.2), a0 + span * (i + 0.8)]);
    return out;
  };
  const d = b.door;
  // Front: either side of the door, and over it.
  wall(
    'x',
    -b.half,
    -d.half,
    b.foreZ,
    b.foreZ + w,
    windows(-b.half, -d.half, 2),
  );
  wall('x', d.half, b.half, b.foreZ, b.foreZ + w, windows(d.half, b.half, 2));
  parts.push(
    block(
      -d.half,
      d.top,
      b.foreZ,
      d.half,
      win.low,
      b.foreZ + w,
      [0.42, 0.4, 0.36],
    ),
  );
  parts.push(
    block(
      -d.half,
      win.low,
      b.foreZ,
      d.half,
      b.top,
      b.foreZ + w,
      [0.42, 0.4, 0.36],
    ),
  );
  wall('x', -b.half, b.half, b.aftZ - w, b.aftZ, windows(-b.half, b.half, 4));
  for (const side of [-1, 1])
    wall(
      'z',
      b.foreZ,
      b.aftZ,
      side > 0 ? b.half - w : -b.half,
      side > 0 ? b.half : -b.half + w,
      windows(b.foreZ, b.aftZ, 3),
    );
  // The door itself, hanging open on one hinge.
  const door = new THREE.BoxGeometry(1.4, d.top - top - 0.1, 0.06);
  door.translate(0.7, 0, 0);
  door.rotateY(-1.9);
  door.translate(-d.half, (d.top + top) / 2, b.foreZ - 0.05);
  parts.push(painted(door, [0.42, 0.4, 0.36], weathered));
  // Roof, with a lip.
  parts.push(
    block(
      -b.half - 0.1,
      b.top,
      b.foreZ - 0.1,
      b.half + 0.1,
      b.top + 0.22,
      b.aftZ + 0.1,
    ),
  );
  // Inside: the binnacle and wheel, and a chart table.
  parts.push(block(-0.3, top, -20.6, 0.3, top + 1.05, -20.2, [0.3, 0.26, 0.2]));
  const rim = new THREE.TorusGeometry(0.42, 0.035, 6, 20);
  rim.translate(0, top + 1.35, -20.68);
  parts.push(painted(rim, [0.38, 0.27, 0.16]));
  for (let i = 0; i < 8; i++) {
    const spoke = new THREE.CylinderGeometry(0.02, 0.02, 1.0, 5);
    spoke.rotateZ((i / 8) * Math.PI);
    spoke.translate(0, top + 1.35, -20.68);
    parts.push(painted(spoke, [0.38, 0.27, 0.16]));
  }
  parts.push(
    block(1.6, top, -18.6, 2.75, top + 0.9, -17.25, [0.34, 0.26, 0.18]),
  );
  return merge(parts);
}

/** The funnel and the foremast with its yard, and broken railings along the deck's edges. */
function topsides(rand: () => number): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [],
    top = SHIP.deck + SHIP.plate,
    f = SHIP.funnel,
    b = SHIP.bridge;
  const funnel = new THREE.CylinderGeometry(
    f.radius * 0.95,
    f.radius,
    f.top - b.top,
    18,
    1,
    true,
  );
  funnel.translate(0, (f.top + b.top) / 2, f.z);
  parts.push(
    painted(funnel, [0.3, 0.12, 0.08], (_x, y) =>
      y > f.top - 0.9 ? 0.35 : 0.8 + 0.15 * Math.sin(y * 4),
    ),
  );
  const m = SHIP.mast,
    mast = new THREE.CylinderGeometry(
      m.radius * 0.7,
      m.radius,
      m.top - top,
      10,
    );
  mast.translate(0, (m.top + top) / 2, m.z);
  parts.push(painted(mast, STEEL, weathered));
  const yard = new THREE.CylinderGeometry(0.07, 0.07, 4.4, 6);
  yard.rotateZ(Math.PI / 2 - 0.12);
  yard.translate(0, m.top - 2.2, m.z);
  parts.push(painted(yard, STEEL, weathered));
  // Railings: posts and a top rail, with gaps where they have rusted away.
  for (const side of [-1, 1]) {
    let last: THREE.Vector3 | undefined;
    for (let z = SHIP.bowZ + 1.2; z < SHIP.sternZ - 0.3; z += 1.3) {
      if (z > b.foreZ - 0.5 && z < b.aftZ + 0.3) {
        last = undefined;
        continue;
      }
      const x = side * (hullHalfWidth(z) - 0.08);
      if (rand() < 0.18) {
        last = undefined;
        continue;
      }
      const post = new THREE.CylinderGeometry(0.03, 0.03, 1, 5);
      post.translate(x, top + 0.5, z);
      parts.push(painted(post, STEEL, weathered));
      const at = new THREE.Vector3(x, top + 1, z);
      if (last && rand() > 0.15) {
        const rail = new THREE.CylinderGeometry(
          0.025,
          0.025,
          at.distanceTo(last),
          5,
        );
        rail.rotateX(Math.PI / 2);
        rail.lookAt(at.clone().sub(last));
        rail.translate((at.x + last.x) / 2, top + 1, (at.z + last.z) / 2);
        parts.push(painted(rail, STEEL, weathered));
      }
      last = at;
    }
  }
  return merge(parts);
}

/** Small lumpy growths (sponges, soft corals), set over the deck and the hull's sides. */
function growthGeometry(): THREE.BufferGeometry {
  const g = new THREE.IcosahedronGeometry(1, 1),
    p = g.getAttribute('position');
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i),
      y = Math.max(0, p.getY(i)),
      z = p.getZ(i),
      k = 1 + 0.25 * Math.sin(x * 5 + z * 4);
    p.setXYZ(i, x * k, y * 0.6 * k, z * k);
  }
  return painted(g, [1, 1, 1], (_x, y) => 0.75 + 0.4 * y);
}

export class ShipwreckModel {
  readonly root = new THREE.Group();
  private readonly geometries: THREE.BufferGeometry[] = [];
  private readonly materials: THREE.Material[] = [];

  constructor(seed = 5101) {
    this.root.name = 'Shipwreck';
    const rand = random(seed),
      shell = new THREE.MeshStandardMaterial({
        vertexColors: true,
        roughness: 0.9,
        metalness: 0.2,
        side: THREE.DoubleSide,
      }),
      steel = new THREE.MeshStandardMaterial({
        vertexColors: true,
        roughness: 0.88,
        metalness: 0.15,
      }),
      soft = new THREE.MeshStandardMaterial({
        vertexColors: true,
        roughness: 0.95,
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
    add(deck(), shell, 'Wreck deck');
    add(hold(), steel, 'Wreck hold');
    add(bridge(), steel, 'Wreck bridge');
    add(topsides(rand), steel, 'Wreck funnel, mast and railings');

    // Growth over the deck (not in the hatch or the bridge's doorway) and down the hull's sides.
    const growth = growthGeometry();
    this.geometries.push(growth);
    const count = 260,
      mesh = new THREE.InstancedMesh(growth, soft, count),
      m = new THREE.Matrix4(),
      q = new THREE.Quaternion(),
      s = new THREE.Vector3(),
      at = new THREE.Vector3(),
      n = new THREE.Vector3(),
      up = new THREE.Vector3(0, 1, 0),
      colour = new THREE.Color(),
      top = SHIP.deck + SHIP.plate;
    mesh.name = 'Wreck growth';
    for (let i = 0; i < count; i++) {
      const z = SHIP.bowZ + 1 + rand() * (SHIP.sternZ - SHIP.bowZ - 1.5),
        hw = hullHalfWidth(z);
      if (i % 2 === 0) {
        // On deck.
        const x = (rand() * 2 - 1) * (hw - 0.3),
          inHatch =
            Math.abs(x) < SHIP.hatch.half + 0.4 &&
            z > SHIP.hatch.foreZ - 0.4 &&
            z < SHIP.hatch.aftZ + 0.4,
          inBridge =
            Math.abs(x) < SHIP.bridge.half + 0.3 &&
            z > SHIP.bridge.foreZ - 1.6 &&
            z < SHIP.bridge.aftZ + 0.3;
        if (inHatch || inBridge) {
          i--;
          continue;
        }
        at.set(x, top, z);
        n.copy(up);
      } else {
        // On a side: facing out, more of it higher up where the light falls.
        const side = rand() < 0.5 ? -1 : 1,
          y = SHIP.keel + 1 + Math.sqrt(rand()) * (top - SHIP.keel - 1.2),
          f = sectionFactor(z, y);
        if (
          side > 0 &&
          z > SHIP.breach.foreZ - 0.5 &&
          z < SHIP.breach.aftZ + 0.5 &&
          y > SHIP.breach.low - 0.5 &&
          y < SHIP.breach.high + 0.5
        ) {
          i--;
          continue;
        }
        at.set(side * hw * f, y, z);
        n.set(side, 0, 0);
      }
      q.setFromUnitVectors(up, n);
      const size = 0.08 + rand() * rand() * 0.3;
      s.set(size * (0.8 + rand() * 0.6), size, size * (0.8 + rand() * 0.6));
      mesh.setMatrixAt(i, m.compose(at, q, s));
      const [r, g, bl] = GROWTH[Math.floor(rand() * GROWTH.length)];
      mesh.setColorAt(i, colour.setRGB(r, g, bl));
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    this.root.add(mesh);
    this.root.updateMatrixWorld(true);
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
