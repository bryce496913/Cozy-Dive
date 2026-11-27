import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import {
  addPose,
  colorRegions,
  fin,
  mirrored,
  profileBody,
} from '../../geometry/lowPoly/geometry';
import { lowPolyMaterial } from '../../rendering/lowPoly/resources';
import { CORE_FISH, type FishDesign } from './designs';
import type { SpeciesId } from '../FishSpecies';

const STATIONS = [-0.35, -0.24, -0.09, 0.08, 0.25, 0.39, 0.5];
// Extra authored cross-sections give the shoulder, cheek, peduncle, and muzzle cleaner facets.
// Width and height still come from each species' seven-station silhouette definition.
const ANATOMY_STATIONS = [-0.3, -0.17, -0.015, 0.17, 0.32, 0.445];
function sample(values: readonly number[], x: number): number {
  for (let i = 1; i < STATIONS.length; i++)
    if (x <= STATIONS[i])
      return THREE.MathUtils.lerp(
        values[i - 1],
        values[i],
        (x - STATIONS[i - 1]) / (STATIONS[i] - STATIONS[i - 1]),
      );
  return values[values.length - 1];
}
function markingStations(pattern: string): readonly number[] {
  switch (pattern) {
    case 'clown':
      return [
        -0.342, -0.33, -0.25, -0.238, -0.062, -0.05, 0.03, 0.042, 0.258, 0.27,
        0.35, 0.362,
      ];
    case 'idol':
    case 'banner':
      return [-0.2, -0.07, 0.2, 0.34];
    case 'cardinal':
      return [-0.04, 0.09];
    case 'saddles':
      return [-0.24, -0.14, -0.01, 0.08, 0.23, 0.3];
    case 'eye-band':
      return [-0.14, 0.3, 0.43];
    case 'gramma':
      return [-0.02];
    case 'fire':
      return [-0.08];
    case 'tang':
      return [-0.31, -0.23, 0.28];
    case 'tailspot':
      return [-0.2];
    case 'sheephead':
      return [-0.24, 0.27];
    case 'beak':
      return [0.43];
    case 'wrasse':
      return [0.28];
    case 'light-organ':
      return [0.27];
    default:
      return [];
  }
}
function faceShape(
  id: SpeciesId,
  pattern: string,
  x: number,
): { width: number; upper: number; lower: number; lift: number } {
  const t = THREE.MathUtils.smoothstep(x, 0.34, 0.5);
  if (pattern === 'beak')
    return { width: 1 + t * 0.18, upper: 1 - t * 0.08, lower: 0.92, lift: 0 };
  if (pattern === 'wrasse' || id === 'california-sheephead')
    return {
      width: 1 + t * 0.12,
      upper: 1 + t * 0.12,
      lower: 1,
      lift: t * 0.012,
    };
  if (id === 'great-barracuda')
    return {
      width: 1 - t * 0.08,
      upper: 0.92,
      lower: 1 + t * 0.22,
      lift: -t * 0.012,
    };
  if (id === 'queensland-grouper' || id === 'giant-sea-bass')
    return {
      width: 1 + t * 0.1,
      upper: 1,
      lower: 1 + t * 0.16,
      lift: -t * 0.008,
    };
  return { width: 1, upper: 1, lower: 1, lift: 0 };
}
function color(d: FishDesign, p: THREE.Vector3): number {
  const x = p.x,
    y = p.y / d.depth;
  if (d.pattern === 'clown') {
    const band = Math.min(...[-0.29, -0.01, 0.31].map((c) => Math.abs(x - c)));
    if (band < 0.04) return 3;
    if (band < 0.052) return 2;
    return y < -0.2 ? 1 : 0;
  }
  if (d.pattern === 'gramma') return x < -0.02 ? 3 : 0;
  if (d.pattern === 'fire') return x < -0.08 ? 3 : y < -0.12 ? 1 : 0;
  if (d.pattern === 'cardinal') {
    if (x > -0.04 && x < 0.09) return 2;

    return x > 0.09 ? 4 : 1;
  }
  if (d.pattern === 'tang') {
    if (x < -0.31) return 3;
    if (y > 0.05 && x < 0.28 && x > -0.23) return 2;
  }
  if (d.pattern === 'idol' || d.pattern === 'banner') {
    if ((x > -0.2 && x < -0.07) || (x > 0.2 && x < 0.34)) return 2;
    if (x < -0.3) return 3;
  }
  if (d.pattern === 'eye-band') {
    if (x > 0.3 && x < 0.43) return 2;
    if (x < -0.14) return 3;
  }
  if (
    d.pattern === 'saddles' &&
    y > -0.18 &&
    ((x > -0.24 && x < -0.14) ||
      (x > -0.01 && x < 0.08) ||
      (x > 0.23 && x < 0.3))
  )
    return 2;
  if (d.pattern === 'horizontal' && Math.abs(y) < 0.07) return 3;
  if (d.pattern === 'cleaner' && Math.abs(y) < 0.16) return 2;
  if (d.pattern === 'tailspot' && x < -0.2 && Math.abs(y) < 0.23) return 3;
  if (d.pattern === 'sheephead') {
    if (x > 0.27 || x < -0.24) return 2;
    return y < -0.3 ? 3 : 0;
  }
  if (d.pattern === 'beak' && x > 0.43) return 3;
  if (d.pattern === 'wrasse' && x > 0.28 && y < 0.1) return 3;
  if (d.pattern === 'light-organ' && x > 0.27 && y < 0 && y > -0.17) return 3;
  return y > 0.25 ? 2 : y < -0.18 ? 1 : 0;
}
function paint(
  raw: THREE.BufferGeometry,
  palette: readonly string[],
  region: (p: THREE.Vector3) => number,
): THREE.BufferGeometry {
  const result = colorRegions(raw, palette, region);
  raw.dispose();
  result.deleteAttribute('uv');
  return result;
}
function outlined(
  points: readonly (readonly [number, number])[],
  t = 0.006,
): THREE.BufferGeometry {
  const g = fin(
    points.map(([x, y]) => [x, -y]),
    points.map((_, i) => (i === 0 ? t : t * 0.4)),
  );
  g.rotateX(Math.PI / 2);
  return g;
}
function join(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const result = mergeGeometries(parts);
  parts.forEach((p) => p.dispose());
  if (!result) throw Error('Fish attributes mismatch');
  result.setAttribute(
    'uv',
    new THREE.BufferAttribute(
      new Float32Array(result.getAttribute('position').count * 2),
      2,
    ),
  );
  return result;
}
/** One continuous body + tail deformation envelope. Construction only; never rebuild per frame. */
export function coreFishGeometry(id: SpeciesId): THREE.BufferGeometry {
  const d: FishDesign = CORE_FISH[id],
    h = d.depth / 2,
    w = d.width / 2;
  // Put rings at every hard longitudinal color boundary so markings follow the body volume.
  const marks = markingStations(d.pattern);
  const xs = [...new Set([...STATIONS, ...ANATOMY_STATIONS, ...marks])].sort(
    (a, b) => a - b,
  );
  const body = profileBody(
    xs.map((x) => {
      const face = faceShape(id, d.pattern, x),
        height = h * sample(d.heights, x);
      return {
        x,
        width: w * sample(d.widths, x) * face.width,
        height: height * face.upper,
        lowerHeight: height * 0.85 * face.lower,
        y: (x > 0.2 ? (d.forehead * (x - 0.2)) / 0.3 : 0) + face.lift,
      };
    }),
    12,
  );
  const parts = [paint(body, d.palette, (p) => color(d, p))];
  const fork =
    d.tail === 'swept'
      ? 0.23
      : d.tail === 'fork'
        ? 0.19
        : d.tail === 'notched'
          ? 0.13
          : 0.12;
  const end =
    d.tail === 'round'
      ? [
          [-0.43, fork * 0.9],
          [-0.475, fork],
          [-0.495, fork * 0.65],
          [-0.5, 0],
          [-0.495, -fork * 0.65],
          [-0.475, -fork],
          [-0.43, -fork * 0.9],
        ]
      : d.tail === 'truncate'
        ? [
            [-0.5, fork],
            [-0.5, -fork],
          ]
        : [
            [-0.5, fork],
            [-0.45, fork * 0.33],
            [-0.42, 0],
            [-0.45, -fork * 0.33],
            [-0.5, -fork],
          ];
  const tailRoot = Math.max(0.025, h * 0.26);
  const tail = outlined(
    [
      [-0.3, tailRoot * 0.72],
      [-0.35, tailRoot],
      ...end.map(([x, y]): [number, number] => [x, (y * d.depth) / 0.4]),
      [-0.35, -tailRoot],
      [-0.3, -tailRoot * 0.72],
    ],
    Math.max(0.004, w * 0.11),
  );
  parts.push(
    paint(tail, d.palette, (p) =>
      d.pattern === 'tang' || d.pattern === 'gramma' || d.pattern === 'banner'
        ? 3
        : d.pattern === 'clown' && p.x < -0.475
          ? 2
          : Math.abs(p.y) > fork * 0.7
            ? 2
            : 0,
    ),
  );
  let dorsal: [number, number][];
  if (d.dorsal === 'pennant')
    dorsal = [
      [-0.27, h * 0.3],
      [-0.22, h * 1.08],
      [0.075, h * 0.82],
      [0.135, h * 3.45],
      [0.16, h * 3.58],
      [0.19, h * 0.62],
    ];
  else if (d.dorsal === 'banner')
    // A narrow swept streamer, not a tall solid crest. Keep the established height envelope.
    dorsal = [
      [-0.28, h * 0.3],
      [-0.24, h * 1.08],
      [-0.36, h * 1.3],
      [-0.3, h * 1.22],
      [0.1, h * 1.5],
      [0.3, h * 0.5],
    ];
  else if (d.dorsal === 'thread')
    dorsal = [
      [-0.28, h * 0.3],
      [-0.26, h * 1.1],
      [-0.36, h * 1.3],
      [-0.3, h * 1.22],
      [-0.12, h * 1.22],
      [0.3, h * 0.5],
    ];
  else if (d.pattern === 'clown')
    dorsal = [
      [-0.28, h * 0.3],
      [-0.26, h * 0.95],
      [-0.17, h * 1.18],
      [-0.04, h * 1.2],
      [0.1, h * 1.15],
      [0.22, h * 0.95],
      [0.29, h * 0.5],
    ];
  else if (d.dorsal === 'split')
    dorsal = [
      [-0.27, h * 0.3],
      [-0.23, h * 1.3],
      [-0.06, h * 1.1],
      [0.02, h * 0.7],
      [0.08, h * 1.6],
      [0.25, h * 0.5],
    ];
  else if (d.dorsal === 'spiny')
    dorsal = [
      [-0.28, h * 0.3],
      [-0.19, h * 1.35],
      [-0.11, h * 1.15],
      [-0.04, h * 1.4],
      [0.02, h * 1.2],
      [0.09, h * 1.45],
      [0.16, h * 1.2],
      [0.27, h * 0.5],
    ];
  else
    dorsal = [
      [-0.28, h * 0.3],
      [-0.2, h * 1.2],
      [0.03, h * (d.dorsal === 'swept' ? 1.5 : 1.2)],
      [0.2, h * 1.1],
      [0.29, h * 0.5],
    ];
  const anal: [number, number][] = [
    [-0.28, -h * 0.2],
    [-0.23, -h * 1.12],
    [-0.08, -h * 1.05],
    [0.16, -h * 0.6],
  ];
  for (const points of [dorsal, anal])
    parts.push(
      paint(outlined(points, Math.max(0.004, w * 0.12)), d.palette, (p) =>
        d.pattern === 'clown' && Math.abs(p.y) > h * 1.05
          ? 2
          : d.pattern === 'gramma' && p.x < -0.02
            ? 3
            : 0,
      ),
    );
  const pectoralRoot = Math.max(0.004, w * 0.11),
    pectoralTip = Math.max(0.0015, w * 0.035);
  const pectoral = fin(
    d.pattern === 'clown' || d.tail === 'round'
      ? [
          [0.18, w * 0.55],
          [0.11, w * 1.65],
          [0.04, w * 2],
          [-0.04, w * 2.1],
          [-0.1, w * 1.7],
          [-0.06, w * 0.65],
        ]
      : [
          [0.18, w * 0.55],
          [0.04, w * 1.9],
          [-0.11, w * 2.1],
          [-0.06, w * 0.65],
        ],
    d.pattern === 'clown' || d.tail === 'round'
      ? [
          pectoralRoot,
          pectoralRoot * 0.7,
          pectoralTip,
          pectoralTip,
          pectoralTip * 1.2,
          pectoralRoot * 0.85,
        ]
      : [pectoralRoot, pectoralTip * 1.4, pectoralTip, pectoralRoot * 0.85],
  );
  pectoral.translate(0, -h * 0.15, 0);
  const opposite = mirrored(pectoral, 'z');
  for (const g of [pectoral, opposite])
    parts.push(paint(g, d.palette, () => 0));
  for (const side of [-1, 1]) {
    const pelvic = outlined(
      [
        [0.1, -h * 0.55],
        [-0.02, -h * 0.94],
        [-0.11, -h * 0.68],
      ],
      Math.max(0.002, w * 0.065),
    );
    pelvic.translate(0, 0, side * w * 0.45);
    parts.push(paint(pelvic, d.palette, () => 1));
  }
  if (d.pattern === 'cardinal')
    for (const x of [-0.26, -0.15])
      for (const row of [-1, 0, 1])
        for (const side of [-1, 1]) {
          const y = row * h * 0.34;
          const spot = outlined(
            Array.from({ length: 6 }, (_, i): [number, number] => [
              x + Math.cos((i * Math.PI) / 3) * 0.018,
              y + Math.sin((i * Math.PI) / 3) * 0.022,
            ]),
            0.001,
          );
          const positions = spot.attributes.position;
          for (let i = 0; i < positions.count; i++) {
            const px = positions.getX(i),
              py = positions.getY(i),
              height = h * sample(d.heights, px) * (py < 0 ? 0.85 : 1),
              width = w * sample(d.widths, px),
              r = Math.abs(py) / height;
            const z =
              width *
              (r <= Math.SQRT1_2
                ? 1 - ((1 - Math.SQRT1_2) * r) / Math.SQRT1_2
                : (1 - r) * 2.4142);
            positions.setZ(i, side * (z + 0.0008) + positions.getZ(i));
          }
          spot.computeVertexNormals();
          parts.push(paint(spot, d.palette, () => 3));
        }
  // Small polygonal eyes seated on the actual eight-sided head surface, not sphere clusters.
  const ex = 0.39,
    ey = h * 0.2 + (d.forehead * 0.19) / 0.3,
    rx =
      d.pattern === 'cardinal' ||
      id === 'bigeye-trevally' ||
      id === 'soldierfish'
        ? 0.035
        : 0.022;
  const hh = h * sample(d.heights, ex),
    ww = w * sample(d.widths, ex),
    ratio = (ey - (d.forehead * 0.19) / 0.3) / hh;
  const ez = ww * (1 - ((1 - Math.SQRT1_2) * ratio) / Math.SQRT1_2) + 0.001;
  for (const side of [-1, 1]) {
    const eye = outlined(
      Array.from({ length: 8 }, (_, i): [number, number] => [
        ex + Math.cos((i * Math.PI) / 4) * rx,
        ey + Math.sin((i * Math.PI) / 4) * rx,
      ]),
      0.002,
    );
    eye.translate(0, 0, side * ez);
    parts.push(paint(eye, ['#172d30'], () => 0));
  }
  const beaked = d.pattern === 'beak',
    heavyMouth =
      d.pattern === 'wrasse' ||
      id === 'california-sheephead' ||
      id === 'queensland-grouper' ||
      id === 'giant-sea-bass',
    mouthDepth = beaked ? h * 0.17 : heavyMouth ? h * 0.12 : h * 0.07,
    mouthReach = beaked ? 0.526 : heavyMouth ? 0.512 : 0.5;
  const mouth = outlined(
    [
      [0.493, -mouthDepth],
      [mouthReach, -mouthDepth * 0.42],
      [mouthReach, mouthDepth * 0.36],
      [0.493, mouthDepth * 0.78],
    ],
    (beaked ? 0.07 : heavyMouth ? 0.045 : 0.025) * d.width,
  );
  parts.push(paint(mouth, [beaked ? d.palette[3] : '#43504b'], () => 0));
  const g = join(parts);
  g.scale(d.length, d.length, d.length);
  for (const sign of [1, -1])
    addPose(g, sign > 0 ? 'Stroke_Left' : 'Stroke_Right', (p, out) => {
      const progress = Math.max(0, (0.23 - p.x / d.length) / 0.73);
      out.z += sign * d.length * 0.11 * progress * progress;
      // The free dorsal streamer trails the torso with a small extra bend; roots stay seated.
      if (d.dorsal === 'banner' || d.dorsal === 'thread')
        out.z += sign * 0.035 * Math.max(0, p.y - h * d.length * 1.05);
    });
  for (const sign of [1, -1])
    addPose(g, sign > 0 ? 'Fin_Left' : 'Fin_Right', (p, out) => {
      // Only the outboard pectoral web moves. Coincident root/body vertices remain identical.
      if (p.x > -0.12 * d.length && p.x < 0.2 * d.length)
        out.y += sign * 0.22 * Math.max(0, Math.abs(p.z) - w * d.length);
    });
  // Fin and tail weights may be active together; enclose their combined axis bounds.
  g.boundingBox!.getBoundingSphere(g.boundingSphere!);
  return g;
}
/** The cache owns the returned resources, exactly as it owns decoded GLBs. Named compatibility
 * pivots are empty: fins are now joined to the same deforming surface, so they cannot tear. */
export function coreFishAsset(
  id: SpeciesId,
  rootName: string,
  requiredNodes: readonly string[],
) {
  const geometry = coreFishGeometry(id),
    material = lowPolyMaterial({ role: 'body', vertexColors: true });
  material.name = 'Crafted_Core_Fish';
  material.userData.coreFish = true;
  const scene = new THREE.Group(),
    root = new THREE.Group();
  root.name = rootName;
  scene.add(root);
  scene.userData.coreFish = id;
  for (const name of ['Body', 'Body_LOD1']) {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = name;
    root.add(mesh);
  }
  for (const name of requiredNodes)
    if (!scene.getObjectByName(name)) {
      const pivot = new THREE.Group();
      pivot.name = name;
      root.add(pivot);
    }
  // AssetLoader/disposeAsset owns these unique resources.
  return { scene, scenes: [scene], animations: [] };
}
