import * as THREE from 'three';
import type { AssetLease, AssetLoader } from '../assets/AssetLoader';
import { babyDefinition } from '../config/babies';
import { acquireCollectionArt } from '../environment/TankCollectionArt';
import { creatureStroke } from '../environment/creatureStroke';
import type { CollectionEntry } from './registry';

/**
 * V0.8 Pass 099: the album's 3D card previews.
 *
 * - **One model per animal:** every preview is built from the entry's canonical model source,
 *   through the same loaders, leases and collection art as the aquarium (`acquireCollectionArt`
 *   for the animals, the fish rig for fish, the reef library node for corals).
 * - **One WebGL context** for the whole album: an offscreen renderer draws each visible card in
 *   turn and copies it into that card's small 2D canvas. Opening the album never starts dozens of
 *   contexts.
 * - **Only what is shown:** previews exist for the cards on the open spread (and the detail view)
 *   only. Turning the page releases the rest; closing the album disposes everything, the
 *   renderer and its context included.
 * - **No animal AI:** a slow turn and the animal's own stroke, nothing more.
 */
export interface PreviewLoaders {
  readonly creatures: Pick<AssetLoader, 'acquire' | 'evictUnused'>;
  readonly reef: Pick<AssetLoader, 'acquire' | 'evictUnused'>;
}
interface Preview {
  /** The model, centred and scaled to fit a unit box. */
  readonly object: THREE.Object3D;
  /** Pose it at time `t` (s) with this much stroke (-1..1). */
  update(t: number, stroke: number): void;
  dispose(): void;
}

/** Centre `model` and scale it to fit a unit box; returns the holder. */
function fitted(model: THREE.Object3D): THREE.Group {
  model.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(model),
    size = box.getSize(new THREE.Vector3()),
    holder = new THREE.Group(),
    inner = new THREE.Group();
  inner.add(model);
  model.position.sub(box.getCenter(new THREE.Vector3()));
  inner.scale.setScalar(1 / Math.max(1e-6, size.x, size.y, size.z));
  holder.add(inner);
  return holder;
}

/** Build one entry's preview from its canonical model source. */
export async function buildPreview(
  entry: CollectionEntry,
  loaders: PreviewLoaders,
): Promise<Preview> {
  const m = entry.model;
  // Animals placed in the tank, and the aquarium's residents built from the same anchored-life
  // library: the tank's own collection art (its models, tints, nodes and procedural shapes).
  if (entry.tank?.slot === 'animal' || (m.type === 'asset' && m.nodes)) {
    const base =
        entry.tank?.slot === 'animal'
          ? babyDefinition(entry.tank.key)
          : // The seahorse and frogfish live only in the tank: their parts of the same
            // anchored-life library the moray (a tank animal) is drawn from.
            {
              ...babyDefinition('moray-eel'),
              nodes: m.type === 'asset' ? m.nodes : undefined,
            },
      art = await acquireCollectionArt(
        { ...base, scale: 1 },
        loaders.creatures,
      );
    art.far.visible = false;
    const object = fitted(art.model);
    return {
      object,
      update: (t, stroke) => art.update(1, stroke, t),
      dispose: () => art.dispose(),
    };
  }
  if (m.type === 'fish') {
    const lease = await loaders.creatures.acquire(m.asset),
      materials: THREE.Material[] = [],
      strokes: { mesh: THREE.Mesh; left: number; right: number }[] = [];
    lease.model.traverse((o) => {
      if (/_LOD\d/.test(o.name)) o.visible = false;
      if (!(o instanceof THREE.Mesh)) return;
      const own = (x: THREE.Material) => {
        const c = x.clone();
        if (m.tint !== undefined && c instanceof THREE.MeshStandardMaterial)
          c.color.multiply(new THREE.Color(m.tint));
        materials.push(c);
        return c;
      };
      o.material = Array.isArray(o.material)
        ? o.material.map(own)
        : own(o.material);
      const keys = o.morphTargetDictionary;
      if (keys?.Stroke_Left !== undefined && keys.Stroke_Right !== undefined)
        strokes.push({
          mesh: o,
          left: keys.Stroke_Left,
          right: keys.Stroke_Right,
        });
    });
    const object = fitted(lease.model);
    return {
      object,
      update: (time, stroke) => {
        for (const s of strokes)
          creatureStroke(s.mesh, s, stroke, Math.sin(time * 4));
      },
      dispose: () => {
        materials.forEach((x) => x.dispose());
        release(lease, loaders.creatures, m.asset);
      },
    };
  }
  if (m.type === 'reef') {
    const lease = await loaders.reef.acquire('reef'),
      node = lease.model.getObjectByName(m.node);
    if (!node) {
      release(lease, loaders.reef, 'reef');
      throw Error(`Reef library has no ${m.node}`);
    }
    node.updateMatrixWorld(true);
    const copy = node.clone(true);
    copy.position.set(0, 0, 0);
    copy.rotation.set(0, 0, 0);
    copy.traverse((o) => {
      if (/_LOD\d/.test(o.name)) o.visible = false;
    });
    const object = fitted(copy);
    return {
      object,
      update: () => undefined,
      dispose: () => release(lease, loaders.reef, 'reef'),
    };
  }
  throw Error(`No preview for ${entry.id}`);
}
function release(
  lease: AssetLease,
  loader: Pick<AssetLoader, 'evictUnused'>,
  id: Parameters<AssetLoader['evictUnused']>[0],
): void {
  lease.release();
  loader.evictUnused(id);
}

interface Slot {
  readonly canvas: HTMLCanvasElement;
  readonly entry: CollectionEntry;
  preview?: Preview;
  failed?: boolean;
  loading?: boolean;
  visible: boolean;
  /** Extra turn (radians) and tilt set by dragging (the detail view). */
  yaw: number;
  pitch: number;
  /** Whether it turns on its own. */
  readonly spin: boolean;
}

/** The album's previews: one shared renderer, drawing the visible cards into their canvases. */
export class AlbumPreviews {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(30, 4 / 3, 0.05, 20);
  private readonly stage = new THREE.Group();
  private slots: Slot[] = [];
  private queue: Slot[] = [];
  private loading = 0;
  private next = 0;
  private disposed = false;
  private readonly observer?: IntersectionObserver;
  /** Cards drawn per frame (the detail view is drawn every frame). */
  static readonly PER_FRAME = 4;
  /** Models that may load at once. */
  static readonly CONCURRENT = 2;

  constructor(
    private readonly loaders: PreviewLoaders,
    canvas: HTMLCanvasElement = document.createElement('canvas'),
  ) {
    if (typeof IntersectionObserver !== 'undefined')
      this.observer = new IntersectionObserver((entries) => {
        for (const entry of entries) {
          const slot = this.slots.find((s) => s.canvas === entry.target);
          if (slot) slot.visible = entry.isIntersecting;
        }
      });
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
      preserveDrawingBuffer: true,
    });
    this.renderer.setPixelRatio(1);
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    // A soft studio light: sky above, sand below, a key from the front left.
    const key = new THREE.DirectionalLight(0xffffff, 2.2);
    key.position.set(-2, 3, 4);
    this.scene.add(
      new THREE.HemisphereLight(0xdff3ff, 0x6b5a42, 1.6),
      key,
      this.stage,
    );
  }
  /** The cards now visible (and whether each turns by itself); everything else is released. */
  show(
    cards: readonly {
      canvas: HTMLCanvasElement;
      entry: CollectionEntry;
      spin?: boolean;
    }[],
  ): void {
    if (this.disposed) return;
    const keep: Slot[] = [];
    for (const c of cards) {
      const old = this.slots.find(
        (s) => s.canvas === c.canvas && s.entry.id === c.entry.id,
      );
      keep.push(
        old ?? {
          canvas: c.canvas,
          entry: c.entry,
          visible: !this.observer,
          yaw: 0,
          pitch: 0,
          spin: c.spin ?? true,
        },
      );
    }
    for (const s of this.slots)
      if (!keep.includes(s)) {
        this.observer?.unobserve(s.canvas);
        s.preview?.dispose();
      }
    for (const s of keep)
      if (!this.slots.includes(s)) this.observer?.observe(s.canvas);
    this.slots = keep;
    this.queue = this.queue.filter((s) => keep.includes(s));
    for (const s of keep)
      if (!s.preview && !s.failed && !s.loading && !this.queue.includes(s))
        this.queue.push(s);
    this.pump();
  }
  /** Turn a card's model (the detail view's drag). */
  drag(canvas: HTMLCanvasElement, dx: number, dy: number): void {
    const s = this.slots.find((x) => x.canvas === canvas);
    if (!s) return;
    s.yaw += dx * 0.01;
    s.pitch = Math.max(-0.9, Math.min(0.9, s.pitch + dy * 0.01));
  }
  /** How many models are loaded (for tests and the performance report). */
  get loaded(): number {
    return this.slots.filter((s) => s.preview).length;
  }
  get rendererInfo() {
    return this.renderer.info.memory;
  }
  private pump(): void {
    while (this.loading < AlbumPreviews.CONCURRENT && this.queue.length) {
      const s = this.queue.shift()!;
      this.loading++;
      s.loading = true;
      buildPreview(s.entry, this.loaders)
        .then((p) => {
          if (this.disposed || !this.slots.includes(s)) p.dispose();
          else s.preview = p;
        })
        .catch((error: unknown) => {
          // The card keeps its name and story; only its model is missing.
          s.failed = true;
          console.warn(
            `Cozy Diver: no album preview for ${s.entry.id}.`,
            error,
          );
        })
        .finally(() => {
          s.loading = false;
          this.loading--;
          if (!this.disposed) this.pump();
        });
    }
  }
  /**
   * Draw the next few visible cards (and every non-spinning one, the detail view) at time `t`.
   * With `still`, nothing turns or strokes (reduced motion).
   */
  frame(t: number, still: boolean): void {
    if (this.disposed || !this.slots.length) return;
    const ready = this.slots.filter((s) => s.preview && s.visible);
    if (!ready.length) return;
    const draw = ready.filter((s) => !s.spin),
      spinning = ready.filter((s) => s.spin);
    for (let k = 0; k < Math.min(AlbumPreviews.PER_FRAME, spinning.length); k++)
      draw.push(spinning[(this.next + k) % spinning.length]);
    this.next =
      (this.next + AlbumPreviews.PER_FRAME) % Math.max(1, spinning.length);
    for (const s of draw) this.draw(s, t, still);
  }
  private draw(s: Slot, t: number, still: boolean): void {
    const p = s.preview!,
      w = s.canvas.width,
      h = s.canvas.height;
    if (!w || !h) return;
    const size = this.renderer.getSize(new THREE.Vector2());
    if (size.x !== w || size.y !== h) this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.position.set(0, 0.45, 2.3);
    this.camera.lookAt(0, 0, 0);
    this.camera.updateProjectionMatrix();
    const phase = s.entry.order * 0.9;
    p.object.rotation.set(
      s.pitch,
      -0.6 + s.yaw + (still || !s.spin ? 0 : 0.35 * Math.sin(t * 0.4 + phase)),
      0,
    );
    p.update(still ? 0 : t, still ? 0 : 0.6 * Math.sin(t * 2.2 + phase));
    this.stage.add(p.object);
    this.renderer.render(this.scene, this.camera);
    this.stage.remove(p.object);
    const ctx = s.canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, w, h);
    ctx.drawImage(this.renderer.domElement, 0, 0, w, h);
  }
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    for (const s of this.slots) s.preview?.dispose();
    this.slots = [];
    this.queue = [];
    this.observer?.disconnect();
    this.scene.traverse((o) => {
      if (o instanceof THREE.Light) o.dispose();
    });
    this.scene.clear();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
  }
}
