import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { FishSpecies } from './FishSpecies';

const PROFILE_X = [-0.36, -0.27, -0.15, -0.01, 0.16, 0.32, 0.43, 0.5];
const JOINT = -0.12;
function profile(s: FishSpecies, x: number): number {
  for (let i = 1; i < PROFILE_X.length; i++)
    if (x <= PROFILE_X[i]) {
      const t = (x - PROFILE_X[i - 1]) / (PROFILE_X[i] - PROFILE_X[i - 1]);
      const values = s.profile,
        xs = PROFILE_X;
      const before = Math.max(0, i - 2),
        after = Math.min(xs.length - 1, i + 1);
      const width = xs[i] - xs[i - 1];
      const m0 = ((values[i] - values[before]) / (xs[i] - xs[before])) * width;
      const m1 =
        ((values[after] - values[i - 1]) / (xs[after] - xs[i - 1])) * width;
      return Math.max(
        0.015,
        (2 * t ** 3 - 3 * t ** 2 + 1) * values[i - 1] +
          (t ** 3 - 2 * t ** 2 + t) * m0 +
          (-2 * t ** 3 + 3 * t ** 2) * values[i] +
          (t ** 3 - t ** 2) * m1,
      );
    }
  return s.profile[s.profile.length - 1];
}
/** Lofted elliptical cross-sections, not stretched primitive bodies. */
function body(
  s: FishSpecies,
  start: number,
  end: number,
  pivot: number,
): THREE.BufferGeometry {
  const positions: number[] = [],
    colors: number[] = [],
    indices: number[] = [];
  const rows = s.detail === 'small' ? 10 : s.detail === 'medium' ? 16 : 24,
    columns = s.detail === 'small' ? 10 : s.detail === 'medium' ? 16 : 28;
  const base = new THREE.Color(s.color),
    back = new THREE.Color(s.backColor),
    belly = new THREE.Color(0xd1c5a4),
    color = new THREE.Color();
  for (let i = 0; i <= rows; i++) {
    const x = THREE.MathUtils.lerp(start, end, i / rows),
      r = profile(s, x);
    for (let j = 0; j <= columns; j++) {
      const a = (j / columns) * Math.PI * 2,
        y =
          s.id === 'panda-corydoras' && Math.cos(a) < 0
            ? Math.max(-s.height * 0.28, ((Math.cos(a) * s.height) / 2) * r)
            : ((Math.cos(a) * s.height) / 2) * r,
        z = ((Math.sin(a) * s.width) / 2) * r;
      positions.push((x - pivot) * s.length, y, z);
      color
        .copy(base)
        .lerp(
          y > 0 ? back : belly,
          Math.abs(Math.cos(a)) * (y > 0 ? 0.58 : 0.25),
        );
      colors.push(color.r, color.g, color.b);
    }
  }
  for (let i = 0; i < rows; i++)
    for (let j = 0; j < columns; j++) {
      const a = i * (columns + 1) + j,
        b = a + columns + 1;
      indices.push(a, a + 1, b, a + 1, b + 1, b);
    }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(positions, 3),
  );
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  // Close the narrow end caps; they are hidden at the overlapping articulation joint.
  return geometry;
}
interface Point2 {
  x: number;
  y: number;
}
function surfaceZ(s: FishSpecies, x: number, y: number, side: number): number {
  const r = profile(s, x),
    height = Math.max(0.0001, (s.height * r) / 2);
  return (
    side *
    (((s.width * r) / 2) * Math.sqrt(Math.max(0, 1 - (y / height) ** 2)) +
      0.0015)
  );
}
/** Curved, tessellated skin markings hug both sides instead of floating as flat icons. */
function skinPatch(
  s: FishSpecies,
  polygon: readonly Point2[],
  side: number,
  pivot: number,
  color: number,
): THREE.BufferGeometry {
  const p: number[] = [],
    c: number[] = [],
    tint = new THREE.Color(color);
  const add = (x: number, y: number): void => {
    p.push((x - pivot) * s.length, y, surfaceZ(s, x, y, side));
    c.push(tint.r, tint.g, tint.b);
  };
  const divisions =
    s.detail === 'small'
      ? 3
      : s.marking === 'endler-patches'
        ? 6
        : s.detail === 'medium'
          ? 4
          : 8;
  for (let triangle = 1; triangle < polygon.length - 1; triangle++) {
    const a = polygon[0],
      b = polygon[triangle],
      d = polygon[triangle + 1];
    const vertex = (u: number, v: number): Point2 => ({
      x: a.x + (b.x - a.x) * u + (d.x - a.x) * v,
      y: a.y + (b.y - a.y) * u + (d.y - a.y) * v,
    });
    const tri = (a: Point2, b: Point2, d: Point2): void => {
      add(a.x, a.y);
      if (side > 0) {
        add(d.x, d.y);
        add(b.x, b.y);
      } else {
        add(b.x, b.y);
        add(d.x, d.y);
      }
    };
    for (let i = 0; i < divisions; i++)
      for (let j = 0; j < divisions - i; j++) {
        const a = vertex(i / divisions, j / divisions),
          b = vertex((i + 1) / divisions, j / divisions),
          d = vertex(i / divisions, (j + 1) / divisions);
        tri(a, b, d);
        if (i + j < divisions - 1)
          tri(b, vertex((i + 1) / divisions, (j + 1) / divisions), d);
      }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(c, 3));
  geometry.computeVertexNormals();
  return geometry;
}
function clipAtJoint(polygon: readonly Point2[], front: boolean): Point2[] {
  const result: Point2[] = [];
  for (let i = 0; i < polygon.length; i++) {
    const a = polygon[i],
      b = polygon[(i + 1) % polygon.length];
    const ain = front ? a.x >= JOINT : a.x <= JOINT,
      bin = front ? b.x >= JOINT : b.x <= JOINT;
    if (ain) result.push(a);
    if (ain !== bin) {
      const t = (JOINT - a.x) / (b.x - a.x);
      result.push({ x: JOINT, y: a.y + (b.y - a.y) * t });
    }
  }
  return result;
}
function colored(
  geometry: THREE.BufferGeometry,
  color: number,
): THREE.BufferGeometry {
  const count = geometry.getAttribute('position').count,
    c = new THREE.Color(color),
    colors = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) c.toArray(colors, i * 3);
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return geometry;
}
function mergeOwned(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const converted = parts.map((p) => (p.index ? p.toNonIndexed() : p));
  const result = mergeGeometries(converted, false)!;
  for (const p of parts) p.dispose();
  for (let i = 0; i < converted.length; i++)
    if (converted[i] !== parts[i]) converted[i].dispose();
  return result;
}
function fin(
  s: FishSpecies,
  outline: readonly Point2[],
  pivot = 0,
  z = 0,
): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  shape.moveTo((outline[0].x - pivot) * s.length, outline[0].y);
  if (s.roundedFins) {
    // Rounded fin membranes keep the gourami silhouette distinct from the fork-tailed species.
    for (let i = 1; i < outline.length; i++) {
      const p = outline[i],
        next = outline[(i + 1) % outline.length];
      shape.quadraticCurveTo(
        (p.x - pivot) * s.length,
        p.y,
        ((p.x + next.x) / 2 - pivot) * s.length,
        (p.y + next.y) / 2,
      );
    }
    const first = outline[0];
    shape.lineTo((first.x - pivot) * s.length, first.y);
  } else {
    for (const p of outline.slice(1))
      shape.lineTo((p.x - pivot) * s.length, p.y);
  }
  shape.closePath();
  const geometry = new THREE.ShapeGeometry(shape);
  geometry.translate(0, 0, z);
  return colored(geometry, s.finColor);
}
export interface FishVisual {
  readonly root: THREE.Group;
  readonly rear: THREE.Group;
  readonly tail: THREE.Group;
  readonly leftPectoral: THREE.Mesh;
  readonly rightPectoral: THREE.Mesh;
}
/** Per-species immutable templates; instances only own Object3D transforms. */
export class FishGeometry {
  readonly geometries = new Set<THREE.BufferGeometry>();
  readonly materials = new Set<THREE.Material>();
  private readonly front: THREE.BufferGeometry;
  private readonly rear: THREE.BufferGeometry;
  private readonly stripeFront?: THREE.BufferGeometry;
  private readonly stripeRear?: THREE.BufferGeometry;
  private readonly fins: THREE.BufferGeometry;
  private readonly tail: THREE.BufferGeometry;
  private readonly pectoral: THREE.BufferGeometry;
  private readonly bodyMaterial: THREE.MeshStandardMaterial;
  private readonly finMaterial: THREE.MeshStandardMaterial;
  private readonly stripeMaterial?: THREE.MeshStandardMaterial;
  private disposed = false;
  constructor(
    readonly species: FishSpecies,
    readonly variant = 0,
  ) {
    const s = species;
    this.bodyMaterial = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.65,
      metalness: 0.06,
    });
    this.finMaterial = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.8,
      transparent: true,
      opacity: 0.58,
      side: THREE.DoubleSide,
      depthWrite: false,
      forceSinglePass: true,
    });
    if (s.marking === 'neon-stripes')
      this.stripeMaterial = new THREE.MeshStandardMaterial({
        vertexColors: true,
        emissive: 0x137dc2,
        emissiveIntensity: 0.45,
        roughness: 0.4,
      });
    this.materials.add(this.bodyMaterial);
    this.materials.add(this.finMaterial);
    if (this.stripeMaterial) this.materials.add(this.stripeMaterial);
    const mark = (front: boolean): THREE.BufferGeometry => {
      const start = front ? JOINT - 0.005 : -0.36,
        end = front ? 0.5 : JOINT + 0.005,
        pivot = front ? 0 : JOINT;
      const parts = [body(s, start, end, pivot)];
      let polygon: Point2[] = [];
      let color = 0;
      if (s.marking === 'rear-wedge') {
        polygon = [
          { x: -0.32, y: 0 },
          { x: 0.015, y: s.height * 0.34 },
          { x: 0.015, y: -s.height * 0.34 },
        ];
        color = s.accentColor;
      }
      if (s.marking === 'neon-stripes') {
        polygon = [
          { x: -0.32, y: -s.height * 0.09 },
          { x: 0.035, y: -s.height * 0.09 },
          { x: 0.035, y: -s.height * 0.34 },
          { x: -0.27, y: -s.height * 0.24 },
        ];
        color = s.secondaryAccent ?? s.accentColor;
      }
      const extra: { points: Point2[]; color: number }[] = [];
      if (s.marking === 'panda-mask') {
        extra.push(
          {
            points: [
              { x: 0.27, y: s.height * 0.3 },
              { x: 0.42, y: s.height * 0.28 },
              { x: 0.43, y: -s.height * 0.22 },
              { x: 0.29, y: -s.height * 0.24 },
            ],
            color: s.accentColor,
          },
          {
            points: [
              { x: -0.32, y: s.height * 0.15 },
              { x: -0.22, y: s.height * 0.25 },
              { x: -0.22, y: -s.height * 0.2 },
              { x: -0.32, y: -s.height * 0.13 },
            ],
            color: s.accentColor,
          },
        );
      }
      if (s.marking === 'lateral-stripe')
        extra.push({
          points: [
            { x: -0.32, y: s.height * 0.04 },
            { x: 0.38, y: s.height * 0.1 },
            { x: 0.38, y: -s.height * 0.06 },
            { x: -0.3, y: -s.height * 0.13 },
          ],
          color: s.accentColor,
        });
      if (s.marking === 'endler-patches') {
        const shift = (variant - 1.5) * 0.035;
        extra.push(
          {
            points: [
              { x: -0.13 + shift, y: s.height * 0.18 },
              { x: -0.1 + shift, y: s.height * 0.29 },
              { x: 0.045 + shift, y: s.height * 0.28 },
              { x: 0.105 + shift, y: s.height * 0.1 },
              { x: 0.065 + shift, y: -s.height * 0.13 },
              { x: -0.08 + shift, y: -s.height * 0.15 },
            ],
            color: 0x273b35,
          },
          {
            points: [
              { x: 0.11 + shift, y: s.height * 0.12 },
              { x: 0.16, y: s.height * 0.23 },
              { x: 0.29, y: s.height * 0.15 },
              { x: 0.33, y: -s.height * 0.02 },
              { x: 0.25, y: -s.height * 0.25 },
              { x: 0.12, y: -s.height * 0.23 },
              { x: 0.06 + shift, y: -s.height * 0.08 },
            ],
            color: [0xc68b38, 0xb9703a, 0xd39b49, 0xb8834b][variant % 4],
          },
          {
            points: [
              { x: -0.3, y: s.height * 0.05 },
              { x: -0.12 + shift, y: s.height * 0.24 },
              { x: -0.13 + shift, y: -s.height * 0.16 },
              { x: -0.27, y: -s.height * 0.13 },
            ],
            color: [0x418b79, 0x5b8b99, 0x4c9270, 0x788c4b][variant % 4],
          },
        );
      }
      for (const patch of extra) {
        const clipped = clipAtJoint(patch.points, front);
        if (clipped.length >= 3)
          for (const side of [-1, 1])
            parts.push(skinPatch(s, clipped, side, pivot, patch.color));
      }
      const clipped = clipAtJoint(polygon, front);
      if (clipped.length >= 3)
        for (const side of [-1, 1])
          parts.push(skinPatch(s, clipped, side, pivot, color));
      return mergeOwned(parts);
    };
    const front = mark(true);
    this.rear = mark(false);
    if (s.marking === 'neon-stripes') {
      const stripe = (front: boolean): THREE.BufferGeometry => {
        const polygon = clipAtJoint(
          [
            { x: -0.3, y: s.height * 0.05 },
            { x: 0.39, y: s.height * 0.08 },
            { x: 0.39, y: -s.height * 0.04 },
            { x: -0.3, y: -s.height * 0.07 },
          ],
          front,
        );
        return mergeOwned(
          [-1, 1].map((side) =>
            skinPatch(s, polygon, side, front ? 0 : JOINT, s.accentColor),
          ),
        );
      };
      this.stripeFront = stripe(true);
      this.stripeRear = stripe(false);
    }
    const h = s.height;
    const dorsal: Point2[] = s.roundedFins
      ? [
          { x: -0.29, y: h * 0.18 },
          { x: -0.27, y: h * 0.57 },
          { x: -0.17, y: h * 0.69 },
          { x: 0.02, y: h * 0.72 },
          { x: 0.18, y: h * 0.56 },
          { x: 0.2, y: h * 0.43 },
        ]
      : [
          { x: -0.18, y: h * 0.32 },
          { x: -0.07, y: h * (s.marking === 'neon-stripes' ? 0.95 : 0.92) },
          { x: 0.12, y: h * 0.46 },
        ];
    const anal: Point2[] = s.roundedFins
      ? [
          { x: -0.3, y: -h * 0.22 },
          { x: -0.25, y: -h * 0.63 },
          { x: -0.06, y: -h * 0.69 },
          { x: 0.13, y: -h * 0.61 },
          { x: 0.3, y: -h * 0.32 },
        ]
      : [
          { x: -0.25, y: -h * 0.2 },
          { x: -0.19, y: -h * 0.7 },
          { x: 0.09, y: -h * 0.45 },
        ];
    this.fins = mergeOwned([
      fin(
        s.marking === 'panda-mask' ? { ...s, finColor: 0x303934 } : s,
        dorsal,
      ),
      fin(s, anal),
    ]);
    const tail: Point2[] = s.roundedFins
      ? [
          { x: -0.34, y: 0 },
          { x: -0.44, y: h * 0.3 },
          { x: -0.51, y: h * 0.25 },
          { x: -0.55, y: h * 0.12 },
          { x: -0.55, y: -h * 0.12 },
          { x: -0.51, y: -h * 0.25 },
          { x: -0.44, y: -h * 0.3 },
        ]
      : [
          { x: -0.34, y: 0 },
          { x: -0.53, y: h * 0.62 },
          { x: -0.49, y: h * 0.13 },
          { x: -0.45, y: 0 },
          { x: -0.49, y: -h * 0.13 },
          { x: -0.53, y: -h * 0.62 },
        ];
    this.tail = fin(s, tail, -0.34);
    const pectoral = new THREE.Shape();
    pectoral.moveTo(0, 0);
    pectoral.bezierCurveTo(
      -s.length * 0.06,
      -h * 0.18,
      -s.length * 0.21,
      -h * 0.22,
      -s.length * 0.18,
      -h * 0.03,
    );
    pectoral.quadraticCurveTo(-s.length * 0.05, h * 0.08, 0, 0);
    this.pectoral = colored(new THREE.ShapeGeometry(pectoral, 8), s.finColor);
    const details: THREE.BufferGeometry[] = [];
    const eyeRadius = s.height * (s.roundedFins ? 0.065 : 0.09);
    for (const side of [-1, 1]) {
      const x = 0.37,
        y = h * 0.085,
        z = surfaceZ(s, x, y, side);
      const iris = colored(
        new THREE.SphereGeometry(
          eyeRadius,
          s.detail ? 8 : 12,
          s.detail ? 6 : 8,
        ),
        0xae9a58,
      );
      iris.scale(1, 1, 0.45);
      iris.translate(x * s.length, y, z);
      details.push(iris);
      const pupil = colored(
        new THREE.SphereGeometry(
          eyeRadius * 0.72,
          s.detail ? 8 : 12,
          s.detail ? 6 : 8,
        ),
        0x101b1b,
      );
      pupil.scale(1, 1, 0.35);
      pupil.translate(
        x * s.length + eyeRadius * 0.12,
        y,
        z + side * eyeRadius * 0.32,
      );
      details.push(pupil);
      const glint = colored(
        new THREE.SphereGeometry(eyeRadius * 0.18, 6, 4),
        0xcbd8c7,
      );
      glint.translate(
        x * s.length + eyeRadius * 0.25,
        y + eyeRadius * 0.25,
        z + side * eyeRadius * 0.56,
      );
      details.push(glint);
    }
    const mouth = colored(new THREE.SphereGeometry(h * 0.045, 8, 6), 0x5d5140);
    mouth.scale(0.4, 0.3, 1.4);
    mouth.translate(
      s.length * (s.id === 'panda-corydoras' ? 0.46 : 0.496),
      -h * (s.id === 'panda-corydoras' ? 0.24 : 0.018),
      0,
    );
    details.push(mouth);
    if (s.id === 'panda-corydoras')
      for (const side of [-1, 1])
        for (const spread of [0.5, 1]) {
          const curve = new THREE.CatmullRomCurve3([
            new THREE.Vector3(s.length * 0.44, -h * 0.2, side * s.width * 0.16),
            new THREE.Vector3(
              s.length * 0.53,
              -h * 0.3,
              side * s.width * 0.32 * spread,
            ),
            new THREE.Vector3(
              s.length * 0.58,
              -h * 0.33,
              side * s.width * 0.55 * spread,
            ),
          ]);
          details.push(
            colored(
              new THREE.TubeGeometry(curve, 6, 0.004, 3, false),
              0x797a66,
            ),
          );
        }
    const eyes = mergeOwned(details);
    eyes.deleteAttribute('uv');
    // Static facial detail shares the body's material and draw; only articulated parts stay separate.
    this.front = mergeOwned([front, eyes]);
    for (const g of [
      this.front,
      this.rear,
      this.stripeFront,
      this.stripeRear,
      this.fins,
      this.tail,
      this.pectoral,
    ])
      if (g) this.geometries.add(g);
  }
  create(size: number): FishVisual {
    const mesh = (g: THREE.BufferGeometry, m: THREE.Material): THREE.Mesh =>
      new THREE.Mesh(g, m);
    const root = new THREE.Group(),
      rear = new THREE.Group(),
      tail = new THREE.Group();
    root.scale.setScalar(size);
    root.add(
      mesh(this.front, this.bodyMaterial),
      mesh(this.fins, this.finMaterial),
    );
    if (this.stripeFront && this.stripeMaterial)
      root.add(mesh(this.stripeFront, this.stripeMaterial));
    rear.position.x = JOINT * this.species.length;
    rear.add(mesh(this.rear, this.bodyMaterial));
    if (this.stripeRear && this.stripeMaterial)
      rear.add(mesh(this.stripeRear, this.stripeMaterial));
    tail.position.x = (-0.34 - JOINT) * this.species.length;
    tail.add(mesh(this.tail, this.finMaterial));
    rear.add(tail);
    root.add(rear);
    const leftPectoral = mesh(this.pectoral, this.finMaterial),
      rightPectoral = mesh(this.pectoral, this.finMaterial);
    leftPectoral.position.set(
      this.species.length * 0.22,
      -this.species.height * 0.08,
      this.species.width * 0.41,
    );
    rightPectoral.position.copy(leftPectoral.position);
    rightPectoral.position.z *= -1;
    root.add(leftPectoral, rightPectoral);
    return { root, rear, tail, leftPectoral, rightPectoral };
  }
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    for (const g of this.geometries) g.dispose();
    for (const m of this.materials) m.dispose();
  }
}
