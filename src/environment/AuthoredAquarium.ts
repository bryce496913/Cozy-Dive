import * as THREE from 'three';
import { ConvexGeometry } from 'three/addons/geometries/ConvexGeometry.js';
import { AssetLoader, type AssetLease } from '../assets/AssetLoader';
import { assetColliders } from '../assets/AssetCollision';
import { AuthoredSchool } from '../benchmark/AuthoredSchool';
import type { Aquarium } from './Aquarium';
import type { ConvexCollider } from '../player/collision';
/** The procedural moray skin replaces diffuse colour; authored skins carry their own pattern. */
const AUTHORED_COLOUR_OVERRIDE =
  'diffuseColor.rgb=mix(diffuseColor.rgb,skin,vMorayMask);';
/** Presentation resources follow the existing controllers; simulation and home selection stay authoritative. */
export class AuthoredAquarium {
  readonly ready: Promise<boolean>;
  state: 'loading' | 'ready' | 'fallback' = 'loading';
  private readonly loader = new AssetLoader();
  private leases: AssetLease[] = [];
  private readonly attachments: THREE.Object3D[] = [];
  private readonly originals = new Map<THREE.Material, boolean>();
  private readonly ownedMaterials = new Set<THREE.Material>();
  private readonly hulls: {
    original: readonly ConvexCollider[];
    authored: readonly ConvexCollider[];
  }[] = [];
  private lid?: THREE.BufferGeometry;
  private school?: AuthoredSchool;
  private clownBatch?: THREE.Object3D;
  private readonly slugs: {
    mesh: THREE.Mesh;
    animal: { readonly pose: THREE.Object3D };
  }[] = [];
  private disposed = false;
  private enabled = false;
  constructor(private readonly q: Aquarium) {
    this.ready = this.load();
  }
  private hide(root: THREE.Object3D): void {
    root.traverse((o) => {
      if (!(o instanceof THREE.Mesh)) return;
      for (const m of Array.isArray(o.material) ? o.material : [o.material])
        if (!this.originals.has(m)) this.originals.set(m, m.visible);
    });
  }
  private attach(
    lease: AssetLease,
    name: string,
    parent: THREE.Object3D,
  ): THREE.Object3D {
    const part = lease.model.getObjectByName(name);
    if (!part) throw Error(`Missing controller part ${name}`);
    part.removeFromParent();
    part.position.set(0, 0, 0);
    parent.add(part);
    this.attachments.push(part);
    return part;
  }
  private deform(
    root: THREE.Object3D,
    source: THREE.MeshStandardMaterial,
    attribute: string,
    values: (mesh: THREE.Mesh) => number[],
    size: number,
  ): void {
    root.traverse((o) => {
      if (!(o instanceof THREE.Mesh)) return;
      o.geometry.setAttribute(
        attribute,
        new THREE.Float32BufferAttribute(values(o), size),
      );
      o.geometry.boundingSphere = new THREE.Sphere(
        new THREE.Vector3(0, 0, 0.4),
        2.5,
      );
      const materials = (
        Array.isArray(o.material) ? o.material : [o.material]
      ).map((original) => {
        const m = original.clone();
        // Keep the controller's vertex deformation, but let authored vertex colour and maps
        // (Pass 015 skins) replace any procedural colour override in the source shader.
        m.onBeforeCompile = (
          shader: THREE.WebGLProgramParametersWithUniforms,
          renderer: THREE.WebGLRenderer,
        ) => {
          source.onBeforeCompile(shader, renderer);
          shader.fragmentShader = shader.fragmentShader.replace(
            AUTHORED_COLOUR_OVERRIDE,
            '',
          );
        };
        m.customProgramCacheKey = () =>
          `${source.customProgramCacheKey()}-authored-colour`;
        m.side = THREE.DoubleSide;
        this.ownedMaterials.add(m);
        return m;
      });
      o.material = materials.length === 1 ? materials[0] : materials;
    });
  }
  private async load(): Promise<boolean> {
    const results = await Promise.allSettled([
      this.loader.acquire('reefProps'),
      this.loader.acquire('anchored'),
      this.loader.acquire('nudibranchs'),
      this.loader.acquire('clownfish'),
      this.loader.acquire('clownfish'),
    ]);
    this.leases = results.flatMap((r) =>
      r.status === 'fulfilled' ? [r.value] : [],
    );
    if (this.disposed || results.some((r) => r.status === 'rejected')) {
      this.cleanup();
      this.state = 'fallback';
      return false;
    }
    try {
      const [props, animals, slugs, ...clowns] = this.leases;
      const names = {
        log: 'Log',
        shipwreck: 'Shipwreck',
        arch: 'Arch',
        filter: 'Filter',
        chest: 'Chest',
        statue: 'Statue',
      };
      for (const model of this.q.ornaments.models) {
        this.hide(model.root);
        const root = this.attach(props, names[model.kind], model.root);
        if (model.kind === 'chest') {
          const lid = root.getObjectByName('ChestLid')!;
          model.hinge!.add(lid);
          this.attachments.push(lid);
          const proxy = root.getObjectByName('DYNAMIC_ChestLid');
          if (!(proxy instanceof THREE.Mesh))
            throw Error('Missing moving lid proxy');
          proxy.visible = false;
          const p = proxy.geometry.attributes.position;
          this.lid = new ConvexGeometry(
            Array.from({ length: p.count }, (_, i) =>
              new THREE.Vector3().fromBufferAttribute(p, i),
            ),
          );
        }
        const original = this.q.ornaments.surfaceGroups.find(
          (g) => g.id === model.kind,
        )!.colliders;
        this.hulls.push({ original, authored: assetColliders(root) });
      }
      const {
        anemone: a,
        moray: m,
        hidden: { seahorse: s, frogfish: f },
      } = this.q.anchoredLife;
      for (const root of [s.root, f.root, m.root, a.root]) this.hide(root);
      for (const [name, parent] of [
        ['HorseBody', s.root],
        ['HorseTail', s.tail],
        ['HorseDorsal', s.dorsal],
        ['HorseLeftFin', s.leftPectoral],
        ['HorseRightFin', s.rightPectoral],
        ['FrogBody', f.body],
        ['FrogLure', f.lure],
        ['MorayHead', m.head],
        ['MorayJaw', m.jaw],
      ] as const) {
        const part = this.attach(animals, name, parent);
        if (name === 'HorseRightFin') part.scale.x = -1;
      }
      const foot = this.attach(animals, 'FrogFoot', f.leftFoot),
        other = foot.clone();
      f.rightFoot.add(other);
      this.attachments.push(other);
      for (const name of ['MorayBody', 'MorayDorsal']) {
        const part = this.attach(animals, name, m.root);
        this.deform(
          part,
          m.material,
          'morayT',
          (o) =>
            Array.from(o.geometry.attributes.uv.array).filter(
              (_, i) => i % 2 === 1,
            ),
          1,
        );
      }
      const tissue = this.attach(animals, 'AnemoneTissue', a.root);
      this.deform(
        tissue,
        a.material,
        'anemoneMotion',
        (o) => {
          const p = o.geometry.attributes.position,
            uv = o.geometry.attributes.uv,
            values: number[] = [];
          for (let i = 0; i < p.count; i++)
            values.push(
              Math.min(1, Math.max(0, (p.getY(i) - 0.27) / 0.7)) ** 2,
              uv.getX(i) * Math.PI * 2,
            );
          return values;
        },
        2,
      );
      // Pass 015 nudibranchs follow the existing crawl poses; procedural instances are hidden.
      const nudis = this.q.anchoredLife.hidden.nudibranchs;
      this.hide(nudis.root);
      nudis.animals.forEach((animal, i) => {
        const source = slugs.model.getObjectByName(`Nudibranch_${i + 1}`);
        if (!(source instanceof THREE.Mesh))
          throw Error(`Missing nudibranch ${i + 1}`);
        if (!(source.material instanceof THREE.MeshStandardMaterial))
          throw Error('Nudibranch material is not PBR');
        const material = source.material.clone();
        const phase = { value: animal.phase };
        material.onBeforeCompile = (shader) => {
          shader.uniforms.nudiTime = nudis.timeUniform;
          shader.uniforms.nudiPhase = phase;
          shader.vertexShader = shader.vertexShader
            .replace(
              '#include <common>',
              '#include <common>\nuniform float nudiTime;uniform float nudiPhase;',
            )
            .replace(
              '#include <begin_vertex>',
              `#include <begin_vertex>
      float nudiFlex=pow(clamp(position.y/.25,0.,1.),2.);
      transformed.y+=sin(nudiTime*.7+position.z*19.+nudiPhase)*.003*nudiFlex;
      transformed.x+=cos(nudiTime*.55+position.z*11.+nudiPhase)*.002*nudiFlex;`,
            );
        };
        material.customProgramCacheKey = () => 'nudibranch-authored-ripple-v1';
        this.ownedMaterials.add(material);
        const mesh = new THREE.Mesh(source.geometry, material);
        mesh.name = `Authored ${animal.id}`;
        mesh.matrixAutoUpdate = false;
        mesh.matrix.copy(animal.pose.matrix);
        nudis.root.add(mesh);
        this.attachments.push(mesh);
        this.slugs.push({ mesh, animal });
      });
      this.school = new AuthoredSchool(
        this.q.fish,
        clowns,
        'ocellaris-clownfish',
      );
      this.q.root.add(this.school.root);
      this.clownBatch = this.q.fish.batches.find((b) =>
        b.visuals[0].root.name.startsWith('Ocellaris'),
      )?.root;
      this.state = 'ready';
      this.setEnabled(true);
      return true;
    } catch (error) {
      console.error(
        'Cozy Diver: authored aquarium unavailable; keeping original scenery.',
        error,
      );
      this.setEnabled(false);
      this.cleanup();
      this.state = 'fallback';
      return false;
    }
  }
  setEnabled(value: boolean): void {
    if ((value && this.disposed) || value === this.enabled) return;
    this.enabled = value;
    this.originals.forEach(
      (visible, m) => (m.visible = value ? false : visible),
    );
    this.attachments.forEach(
      (o) => (o.visible = value && !o.name.startsWith('DYNAMIC_')),
    );
    if (this.school) this.school.root.visible = value;
    if (this.clownBatch) this.clownBatch.visible = !value;
    for (const h of this.hulls)
      this.q.replacePresentationColliders(
        value ? h.original : h.authored,
        value ? h.authored : h.original,
      );
    this.q.ornaments.setLidCollisionGeometry(value ? this.lid : undefined);
  }
  update(): void {
    if (!this.enabled) return;
    this.school?.update();
    for (const { mesh, animal } of this.slugs) {
      mesh.matrix.copy(animal.pose.matrix);
      mesh.matrixWorldNeedsUpdate = true;
    }
  }
  private cleanup(): void {
    this.attachments.forEach((o) => o.removeFromParent());
    this.attachments.length = 0;
    this.slugs.length = 0;
    this.school?.dispose();
    this.school = undefined;
    this.ownedMaterials.forEach((m) => m.dispose());
    this.ownedMaterials.clear();
    this.lid?.dispose();
    this.lid = undefined;
    this.leases.forEach((l) => l.release());
    this.leases = [];
    this.loader.dispose();
    this.originals.clear();
    this.hulls.length = 0;
    this.clownBatch = undefined;
  }
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.setEnabled(false);
    this.cleanup();
  }
}
