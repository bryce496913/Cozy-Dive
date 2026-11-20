import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { leaseKtx2, type Ktx2Lease } from '../../assets/AssetLoader';
import { disposeAsset } from '../../assets/AssetValidation';
import { triplanarMaterial } from '../../rendering/Triplanar';
import { REEF_LAYOUT } from '../../environment/ReefLayout';
import { sandRelief, substrateHeight } from '../../environment/HabitatRegions';
import {
  FOV,
  LAYOUT,
  LIGHTING,
  SUBJECT_NODES,
  VIEWS,
  fitScale,
  strokeAt,
  type FishPlacement,
  type FishSubject,
  type Placement,
  type Selection,
  type Subject,
  type Treatment,
} from './treatments';
import naturalUrl from './assets/style-natural.glb?url';
import craftedUrl from './assets/style-crafted.glb?url';
import naturalChromisUrl from './assets/natural-chromis.glb?url';
import naturalClownUrl from './assets/natural-clownfish.glb?url';
import craftedChromisUrl from './assets/crafted-chromis.glb?url';
import craftedClownUrl from './assets/crafted-clownfish.glb?url';

const BASE = import.meta.env.BASE_URL;
/** Model files per treatment. Baseline reads the shipped game files; A and B are benchmark-only. */
export const MODEL_FILES: Readonly<
  Record<Treatment, Readonly<Record<'reef' | FishSubject, string>>>
> = {
  baseline: {
    reef: `${BASE}assets/models/reef/reef-environment.glb`,
    chromis: `${BASE}assets/models/fish/chromis.glb`,
    clownfish: `${BASE}assets/models/fish/clownfish.glb`,
  },
  natural: {
    reef: naturalUrl,
    chromis: naturalChromisUrl,
    clownfish: naturalClownUrl,
  },
  crafted: {
    reef: craftedUrl,
    chromis: craftedChromisUrl,
    clownfish: craftedClownUrl,
  },
};
/** The shipped tank's per-rock mineral tint (AuthoredReef ROCK_TINTS[0]); candidates author theirs. */
const BASELINE_ROCK_TINT = 0xeee9e2;
const SAND_SIZE = 40;
/** World metres per sand texture repeat, as in the tank (36 m / 26 repeats). */
const SAND_TILE = 36 / REEF_LAYOUT.sandRepeat[0];

export interface SubjectStats {
  triangles: number;
  meshes: number;
  materials: number;
  textures: number;
  /** Largest texture edge in texels. */
  maxTexture: number;
  /** Estimated GPU memory of the subject's textures (bytes, including mips). */
  textureBytes: number;
}
export interface BenchStats {
  calls: number;
  triangles: number;
  geometries: number;
  textures: number;
  programs: number;
  shadows: boolean;
  subjects: Record<Subject | FishSubject, SubjectStats>;
}

function meshesOf(root: THREE.Object3D): THREE.Mesh[] {
  const out: THREE.Mesh[] = [];
  root.traverse((o) => {
    if (o instanceof THREE.Mesh) out.push(o);
  });
  return out;
}

function standard(mesh: THREE.Mesh): THREE.MeshStandardMaterial {
  const m = mesh.material;
  if (!(m instanceof THREE.MeshStandardMaterial))
    throw Error(`${mesh.name}: expected a standard PBR material`);
  return m;
}

function textureBytes(t: THREE.Texture): number {
  const mips: unknown = t.mipmaps;
  if (Array.isArray(mips) && mips.length) {
    let total = 0;
    for (const m of mips as { data?: ArrayBufferView }[])
      total += m.data?.byteLength ?? 0;
    if (total) return total;
  }
  const image = t.image as { width?: number; height?: number } | null;
  const w = image?.width ?? 0,
    h = image?.height ?? 0;
  return Math.round(w * h * 4 * 1.333);
}

function textureEdge(t: THREE.Texture): number {
  const image = t.image as { width?: number; height?: number } | null;
  return Math.max(image?.width ?? 0, image?.height ?? 0);
}

/**
 * The isolated style benchmark scene: the shared sand and water, the selected treatment's models
 * placed by the shared layout, and the selected lighting rig. Owns every GPU object it creates.
 */
export class StyleBench {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(FOV, 1, 0.05, 80);
  private readonly owned: { dispose(): void }[] = [];
  private readonly assets: GLTF[] = [];
  private readonly ktx2: Ktx2Lease;
  private readonly draco = new DRACOLoader();
  private readonly fish: { mesh: THREE.Mesh; phase: number }[] = [];
  private readonly subjects = new Map<
    Subject | FishSubject,
    THREE.Object3D[]
  >();
  private readonly sun: THREE.DirectionalLight;
  private disposed = false;

  private constructor(
    host: HTMLElement,
    readonly selection: Selection,
  ) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.domElement.setAttribute(
      'aria-label',
      'Style benchmark: a reef rock, brain and staghorn corals, seagrass, chromis and a clownfish on sand',
    );
    host.append(this.renderer.domElement);
    this.ktx2 = leaseKtx2(this.renderer);
    this.draco.setDecoderPath(`${BASE}assets/draco/`).setWorkerLimit(2);
    const light = LIGHTING[selection.lighting];
    this.renderer.toneMappingExposure = light.exposure;
    this.renderer.shadowMap.enabled = light.shadows;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.scene.background = new THREE.Color(light.background);
    this.scene.fog = new THREE.FogExp2(light.background, light.fogDensity);
    this.scene.add(
      new THREE.HemisphereLight(
        light.hemisphere.sky,
        light.hemisphere.ground,
        light.hemisphere.intensity,
      ),
    );
    this.sun = new THREE.DirectionalLight(light.sun.color, light.sun.intensity);
    this.sun.position.set(...light.sun.position);
    if (light.shadows) {
      this.sun.castShadow = true;
      this.sun.shadow.mapSize.set(2048, 2048);
      const c = this.sun.shadow.camera;
      c.left = c.bottom = -5;
      c.right = c.top = 5;
      c.near = 1;
      c.far = 40;
      this.sun.shadow.bias = -0.0004;
      this.sun.shadow.normalBias = 0.02;
      this.sun.shadow.radius = 3;
    }
    this.scene.add(this.sun);
    const fill = new THREE.DirectionalLight(
      light.fill.color,
      light.fill.intensity,
    );
    fill.position.set(...light.fill.position);
    this.scene.add(fill);
    this.setView(selection.view);
  }

  static async create(
    host: HTMLElement,
    selection: Selection,
  ): Promise<StyleBench> {
    const bench = new StyleBench(host, selection);
    try {
      await bench.populate();
    } catch (error) {
      bench.dispose();
      throw error;
    }
    return bench;
  }

  private load(url: string): Promise<GLTF> {
    const loader = new GLTFLoader()
      .setDRACOLoader(this.draco)
      .setKTX2Loader(this.ktx2.loader);
    return loader.loadAsync(url).then((gltf) => {
      this.assets.push(gltf);
      return gltf;
    });
  }

  private async populate(): Promise<void> {
    const t = this.selection.assets,
      files = MODEL_FILES[t];
    const [sandSource, reef, chromis, clownfish] = await Promise.all([
      t === 'baseline'
        ? Promise.resolve(null)
        : this.load(MODEL_FILES.baseline.reef),
      this.load(files.reef),
      this.load(files.chromis),
      this.load(files.clownfish),
    ]);
    if (this.disposed) return;
    this.buildSand(sandSource ?? reef);
    const node = (name: string): THREE.Mesh => {
      const o = reef.scene.getObjectByName(name);
      if (!(o instanceof THREE.Mesh)) throw Error(`Missing model node ${name}`);
      return o;
    };
    const nodes = SUBJECT_NODES[t];
    // Rock and brain coral wear the game's world-space triplanar material, as in the tank.
    const rockMaterial = this.own(
      triplanarMaterial(standard(node(nodes.rock[0])), {
        scale: REEF_LAYOUT.rockTexelScale,
        ao: 0.55,
      }),
    );
    rockMaterial.vertexColors = true;
    rockMaterial.color.setHex(t === 'baseline' ? BASELINE_ROCK_TINT : 0xffffff);
    const brainMaterial = this.own(
      triplanarMaterial(standard(node(nodes.brain[0])), {
        scale: REEF_LAYOUT.coralTexelScale,
        ao: 0.5,
      }),
    );
    brainMaterial.vertexColors = true;
    const place = (
      subject: Subject,
      names: readonly string[],
      p: Placement,
      material?: THREE.Material,
    ) => {
      const group = new THREE.Group();
      const box = new THREE.Box3();
      for (const name of names) {
        const source = node(name);
        source.geometry.computeBoundingBox();
        box.union(source.geometry.boundingBox!);
        const mesh = new THREE.Mesh(
          source.geometry,
          material ?? source.material,
        );
        mesh.name = name;
        group.add(mesh);
      }
      const size = box.getSize(new THREE.Vector3());
      const s = fitScale(Math.max(size.x, size.y, size.z), p.size);
      group.scale.setScalar(s);
      group.rotation.y = p.yaw;
      group.position.set(p.position[0], -box.min.y * s - p.sink, p.position[2]);
      group.name = `${subject} (${t})`;
      this.scene.add(group);
      const list = this.subjects.get(subject) ?? [];
      list.push(group);
      this.subjects.set(subject, list);
    };
    place('rock', nodes.rock, LAYOUT.rock, rockMaterial);
    place('brain', nodes.brain, LAYOUT.brain, brainMaterial);
    place('branching', nodes.branching, LAYOUT.branching);
    for (const clump of LAYOUT.seagrass) {
      const name = nodes.seagrass[clump.template ?? 0];
      place('seagrass', [name], clump, this.grassMaterial(node(name), t));
    }
    this.placeFish('chromis', chromis, LAYOUT.chromis);
    this.placeFish('clownfish', clownfish, LAYOUT.clownfish);
    const shadows = LIGHTING[this.selection.lighting].shadows;
    for (const list of this.subjects.values())
      for (const root of list)
        root.traverse((o) => {
          if (o instanceof THREE.Mesh) {
            o.castShadow = shadows;
            o.receiveShadow = shadows;
          }
        });
    await this.renderer.compileAsync(this.scene, this.camera);
  }

  /** Baseline grass uses the tank's authored-plant material values; candidates their own. */
  private grassMaterial(
    source: THREE.Mesh,
    t: Treatment,
  ): THREE.Material | undefined {
    if (t !== 'baseline') return undefined;
    const cache = this.subjects.get('seagrass')?.[0];
    const existing = cache ? meshesOf(cache)[0]?.material : undefined;
    if (existing instanceof THREE.Material) return existing;
    const m = this.own(standard(source).clone());
    m.normalScale.set(0.6, 0.6);
    m.roughness = 0.9;
    m.side = THREE.DoubleSide;
    return m;
  }

  private placeFish(
    subject: FishSubject,
    gltf: GLTF,
    placements: readonly FishPlacement[],
  ): void {
    const template = gltf.scene.children.find((o) => o.name.endsWith('_Root'));
    if (!template) throw Error(`${subject}: missing rig root`);
    const list: THREE.Object3D[] = [];
    for (const p of placements) {
      const fish = template.clone(true);
      fish.traverse((o) => {
        if (o.name.endsWith('_LOD1')) o.visible = false;
        if (o instanceof THREE.Mesh && o.morphTargetDictionary)
          this.fish.push({ mesh: o, phase: p.phase });
      });
      fish.position.set(...p.position);
      fish.rotation.set(0, p.yaw, 0);
      fish.scale.setScalar(p.scale);
      this.scene.add(fish);
      list.push(fish);
    }
    this.subjects.set(subject, list);
  }

  private buildSand(reef: GLTF): void {
    const carrier = reef.scene.getObjectByName('Sand_Material');
    if (!(carrier instanceof THREE.Mesh)) throw Error('Missing sand material');
    const m = this.own(standard(carrier).clone());
    const repeat = SAND_SIZE / SAND_TILE;
    for (const key of ['map', 'normalMap', 'roughnessMap'] as const) {
      const source = m[key];
      if (!source) throw Error('Sand material lost a PBR map');
      const t = this.own(source.clone());
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.repeat.set(repeat, repeat);
      t.needsUpdate = true;
      m[key] = t;
    }
    m.normalScale.set(0.9, 0.9);
    m.vertexColors = true;
    m.roughness = 1;
    const g = this.own(new THREE.PlaneGeometry(SAND_SIZE, SAND_SIZE, 240, 240));
    g.rotateX(-Math.PI / 2);
    const p = g.attributes.position,
      colors = new Float32Array(p.count * 3),
      color = new THREE.Color();
    let seed = 271828;
    const grain = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 2 ** 32;
    };
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i),
        z = p.getZ(i),
        relief = sandRelief(x, z);
      p.setY(i, substrateHeight(x, z) * 0.5 + relief - 0.03);
      const crest = relief / 0.03;
      // The tank's sand colouring (Aquarium.detailSand), without structure contact.
      color.setHSL(
        0.105 + (grain() - 0.5) * 0.012,
        0.2,
        0.6 + 0.04 * Math.min(1, crest) + (grain() - 0.5) * 0.03,
      );
      color.toArray(colors, i * 3);
    }
    g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    g.computeVertexNormals();
    const sand = new THREE.Mesh(g, m);
    sand.name = 'Sand';
    sand.receiveShadow = LIGHTING[this.selection.lighting].shadows;
    this.scene.add(sand);
  }

  private own<T extends { dispose(): void }>(value: T): T {
    this.owned.push(value);
    return value;
  }

  setView(id: Selection['view']): void {
    const view = VIEWS.find((v) => v.id === id) ?? VIEWS[0];
    this.camera.position.set(...view.eye);
    this.camera.lookAt(...view.target);
  }

  resize(width: number, height: number): void {
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / Math.max(1, height);
    this.camera.updateProjectionMatrix();
  }

  /** Renders the scene at simulation time `t` (seconds); the result depends only on `t`. */
  render(t: number): void {
    if (this.disposed) return;
    for (const f of this.fish) {
      const dict = f.mesh.morphTargetDictionary,
        influences = f.mesh.morphTargetInfluences;
      if (!dict || !influences) continue;
      const s = strokeAt(t, f.phase),
        left = dict.Stroke_Left,
        right = dict.Stroke_Right;
      if (left !== undefined) influences[left] = Math.max(0, s);
      if (right !== undefined) influences[right] = Math.max(0, -s);
    }
    this.renderer.render(this.scene, this.camera);
  }

  stats(): BenchStats {
    const info = this.renderer.info;
    const subjects = {} as Record<Subject | FishSubject, SubjectStats>;
    for (const [subject, roots] of this.subjects) {
      const materials = new Set<THREE.Material>(),
        textures = new Set<THREE.Texture>();
      let triangles = 0,
        meshes = 0;
      for (const root of roots)
        root.traverse((o) => {
          if (!(o instanceof THREE.Mesh) || !o.visible) return;
          meshes++;
          const g = o.geometry;
          triangles +=
            (g.index ? g.index.count : g.attributes.position.count) / 3;
          for (const m of Array.isArray(o.material)
            ? o.material
            : [o.material]) {
            materials.add(m);
            for (const v of Object.values(m))
              if (v instanceof THREE.Texture) textures.add(v);
          }
        });
      let bytes = 0,
        edge = 0;
      for (const t of textures) {
        bytes += textureBytes(t);
        edge = Math.max(edge, textureEdge(t));
      }
      subjects[subject] = {
        triangles,
        meshes,
        materials: materials.size,
        textures: textures.size,
        maxTexture: edge,
        textureBytes: bytes,
      };
    }
    return {
      calls: info.render.calls,
      triangles: info.render.triangles,
      geometries: info.memory.geometries,
      textures: info.memory.textures,
      programs: info.programs?.length ?? 0,
      shadows: this.renderer.shadowMap.enabled,
      subjects,
    };
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    for (const gltf of this.assets) disposeAsset(gltf);
    for (const o of this.owned) o.dispose();
    this.sun.shadow.map?.dispose();
    this.draco.dispose();
    this.ktx2.release();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
