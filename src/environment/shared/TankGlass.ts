import * as THREE from 'three';

/**
 * v0.6 Pass 036: the glass walls of a display tank, as in a public aquarium: faint blue-green panes
 * with soft diagonal reflections and a sheen towards their edges, dark frame posts between panes,
 * and dark frame bars along their top, bottom and at chosen heights. Seen from inside it says
 * "this is a tank, and out there is the next one". Owns its GPU resources.
 */
export interface GlassPane {
  /** Centre of the pane (m). */
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly width: number;
  readonly height: number;
  /** Rotation about y (0: the pane faces ±z; π/2: it faces ±x). */
  readonly yaw: number;
  /** Heights (world y, m) of horizontal frame bars across the pane, besides its top and bottom. */
  readonly bars?: readonly number[];
}

export const GLASS = {
  tint: [0.78, 0.95, 0.93] as const,
  /** The glass's opacity in its middle, the extra sheen at its edges, and its reflections. */
  opacity: 0.08,
  sheen: 0.12,
  reflection: 0.06,
  /** A frame post between panes every this many metres, its width, and the bars' height. */
  postEvery: 8,
  post: 0.28,
  bar: 0.4,
} as const;

/**
 * v0.6 Pass 052B (open-ocean freedom): how visible a frameless pane is at `distance` m from it:
 * fully near it (where it explains why the swimmer stops), fading to a faint trace from a few
 * metres off, so from the reef the blue reads as open water.
 */
export function glassFade(distance: number): number {
  const t = Math.min(1, Math.max(0, (distance - 1) / 7));
  return 0.08 + 0.92 * (1 - t * t * (3 - 2 * t));
}
export interface GlassOptions {
  /** Posts and bars (a display tank's frame). Default true. */
  readonly frame?: boolean;
  /** Fade with distance from the eye (see `glassFade`; call `update`). Default false. */
  readonly fade?: boolean;
}

export class TankGlass {
  readonly root = new THREE.Group();
  private readonly geometries: THREE.BufferGeometry[] = [];
  private readonly materials: THREE.Material[] = [];
  private readonly glassMaterial: THREE.MeshBasicMaterial;
  private readonly panes: readonly GlassPane[];
  private readonly fades: boolean;
  private disposed = false;

  constructor(
    panes: readonly GlassPane[],
    name = 'Tank glass',
    options: GlassOptions = {},
  ) {
    this.root.name = name;
    this.panes = panes;
    this.fades = options.fade ?? false;
    const framed = options.frame ?? true;
    const glass = this.own(
        new THREE.MeshBasicMaterial({
          name: `${name} panes`,
          // Colour and opacity both come from the vertices (RGBA).
          vertexColors: true,
          transparent: true,
          side: THREE.DoubleSide,
          depthWrite: false,
        }),
      ),
      frame = this.own(
        new THREE.MeshStandardMaterial({
          name: `${name} frame`,
          color: 0x1d2629,
          roughness: 0.45,
          metalness: 0.35,
        }),
      );
    this.glassMaterial = glass;
    for (const p of panes) {
      const holder = new THREE.Group();
      holder.position.set(p.x, p.y, p.z);
      holder.rotation.y = p.yaw;
      this.root.add(holder);
      const g = new THREE.PlaneGeometry(
          p.width,
          p.height,
          Math.ceil(p.width / 1.5),
          Math.ceil(p.height / 1.5),
        ),
        pos = g.getAttribute('position'),
        rgba: number[] = [];
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i),
          y = pos.getY(i),
          // Sheen at the edges of each pane between posts.
          posts = Math.max(1, Math.round(p.width / GLASS.postEvery)),
          cell = p.width / posts,
          u =
            Math.abs(((((x + p.width / 2) % cell) + cell) % cell) - cell / 2) /
            (cell / 2),
          v = Math.abs(y) / (p.height / 2),
          edge = Math.max(u, v) ** 5,
          // Broad diagonal reflections, as light catches the glass.
          band = Math.max(0, Math.sin((x * 0.6 + y) * 0.22 + 1.3)) ** 6,
          a = GLASS.opacity + GLASS.sheen * edge + GLASS.reflection * band;
        rgba.push(GLASS.tint[0], GLASS.tint[1], GLASS.tint[2], a);
      }
      g.setAttribute('color', new THREE.Float32BufferAttribute(rgba, 4));
      this.geometries.push(g);
      const pane = new THREE.Mesh(g, glass);
      pane.name = `${name} pane`;
      pane.renderOrder = 3;
      holder.add(pane);
      if (!framed) continue;
      // Frame posts between panes, and at each end.
      const posts = Math.max(1, Math.round(p.width / GLASS.postEvery));
      for (let k = 0; k <= posts; k++) {
        const pg = new THREE.BoxGeometry(GLASS.post, p.height, GLASS.post);
        pg.translate(-p.width / 2 + (p.width * k) / posts, 0, 0);
        this.add(holder, pg, frame, `${name} post`);
      }
      // Frame bars: top, bottom, and any across the pane.
      for (const y of [
        -p.height / 2,
        p.height / 2,
        ...(p.bars ?? []).map((b) => b - p.y),
      ]) {
        const bg = new THREE.BoxGeometry(
          p.width + GLASS.post,
          GLASS.bar,
          GLASS.post * 1.4,
        );
        bg.translate(0, y, 0);
        this.add(holder, bg, frame, `${name} bar`);
      }
    }
  }
  /** Fade the panes by the eye's distance from the nearest one (if fading). Allocation-free. */
  update(eye: Readonly<THREE.Vector3>): void {
    if (this.disposed || !this.fades) return;
    let near = Infinity;
    for (const p of this.panes) {
      // Distance from the pane's plane (its normal is +z turned by its yaw).
      const nx = Math.sin(p.yaw),
        nz = Math.cos(p.yaw);
      near = Math.min(near, Math.abs((eye.x - p.x) * nx + (eye.z - p.z) * nz));
    }
    this.glassMaterial.opacity = glassFade(near);
  }
  private add(
    holder: THREE.Group,
    geometry: THREE.BufferGeometry,
    material: THREE.Material,
    name: string,
  ): void {
    this.geometries.push(geometry);
    const m = new THREE.Mesh(geometry, material);
    m.name = name;
    holder.add(m);
  }
  private own<T extends THREE.Material>(m: T): T {
    this.materials.push(m);
    return m;
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
