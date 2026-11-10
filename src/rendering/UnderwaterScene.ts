import { AuthoredAquarium } from '../environment/AuthoredAquarium';
import { AuthoredReef } from '../environment/AuthoredReef';
import { warmUpScene } from './warmUp';
import { findSeahorseGrip } from '../creatures/discoveries/SeahorseGrip';
import { SEAHORSE_SCALE } from '../creatures/discoveries/Seahorse';
import { AssetLoader } from '../assets/AssetLoader';
import type { PlayerPresence } from '../fish/FishDiverReaction';
import * as THREE from 'three';
import { Aquarium } from '../environment/Aquarium';

export interface Presentation {
  update(): void;
  dispose(): void;
}

export class UnderwaterScene {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(64, 1, 0.08, 80);
  readonly renderer: THREE.WebGLRenderer;
  readonly aquarium: Aquarium;
  readonly authored: AuthoredAquarium;
  readonly reef: AuthoredReef;
  /** Resolves once authored libraries settle and their programs are compiled. */
  readonly prepared: Promise<boolean>;
  private readonly assetStatus = document.createElement('p');
  private disposed = false;
  private presentation?: Presentation;
  setPresentation(value: Presentation): void {
    this.presentation?.dispose();
    this.presentation = value;
  }
  private readonly abort = new AbortController();
  private readonly resizeObserver: ResizeObserver;
  constructor(
    private readonly host: HTMLElement,
    onContextLost: () => void,
  ) {
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    this.renderer.setClearColor(0x17555b);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.35;
    this.renderer.domElement.setAttribute(
      'aria-label',
      'A tropical marine aquarium with reef fish, corals, macroalgae and seagrass',
    );
    host.append(this.renderer.domElement);
    this.scene.background = new THREE.Color(0x225d73);
    this.scene.fog = new THREE.FogExp2(0x225d73, 0.026);
    this.scene.add(new THREE.HemisphereLight(0xc7f2e0, 0x546b56, 2.6));
    const sunlight = new THREE.DirectionalLight(0xfff1cf, 3.2);
    sunlight.position.set(-7, 18, 7);
    this.scene.add(sunlight);
    const fill = new THREE.DirectionalLight(0x75ced0, 0.7);
    fill.position.set(10, 8, -12);
    this.scene.add(fill);
    this.aquarium = new Aquarium();
    this.scene.add(this.aquarium.root);
    this.assetStatus.textContent = 'Preparing aquarium details…';
    this.assetStatus.setAttribute('role', 'status');
    this.assetStatus.style.cssText =
      'position:absolute;bottom:1rem;left:1rem;color:white;pointer-events:none;font:14px sans-serif';
    host.append(this.assetStatus);
    // KTX2 textures need the renderer to choose a GPU-compressed transcode target.
    this.authored = new AuthoredAquarium(this.aquarium, this.renderer);
    this.reef = new AuthoredReef(
      this.aquarium,
      new AssetLoader(undefined, undefined, this.renderer),
    );
    // Each library falls back independently; the status stays until both have settled and
    // their shader programs are compiled, so the first swimming frame does not hitch.
    this.prepared = Promise.all([this.authored.ready, this.reef.ready]).then(
      async (ready) => {
        if (this.disposed) return false;
        this.settleFrogfish();
        this.gripSeahorse();
        try {
          // Compile every program (hidden LOD levels too) and upload every texture behind the
          // status, so nothing pops in when first seen while swimming (Pass 019).
          await warmUpScene(this.renderer, this.scene, this.camera);
        } catch (error) {
          console.warn('Cozy Diver: shader warm-up skipped.', error);
        }
        if (this.disposed) return false;
        if (ready.every(Boolean)) this.assetStatus.remove();
        else
          this.assetStatus.textContent =
            'Some aquarium details could not load. You can still explore.';
        return ready.every(Boolean);
      },
    );
    this.camera.rotation.order = 'YXZ';
    this.resizeObserver = new ResizeObserver(this.resize);
    this.resizeObserver.observe(host);
    window.addEventListener('resize', this.resize, {
      signal: this.abort.signal,
    });
    this.renderer.domElement.addEventListener(
      'webglcontextlost',
      (event) => {
        event.preventDefault();
        onContextLost();
      },
      { signal: this.abort.signal },
    );
    this.resize();
  }
  /** Move the seahorse onto a small authored sea-fan branch, facing its discovery view. */
  private gripSeahorse(): void {
    const s = this.aquarium.anchoredLife.hidden.seahorse,
      plant = s.vegetation;
    if (plant.species.id !== 'sea-fan') return;
    const positions = this.reef.plantTemplatePositions(
      'sea-fan',
      plant.template,
    );
    if (!positions) return;
    const up = new THREE.Vector3(0, 1, 0),
      toWorld = new THREE.Matrix4().compose(
        new THREE.Vector3(plant.position.x, plant.position.y, plant.position.z),
        new THREE.Quaternion()
          .setFromUnitVectors(
            up,
            new THREE.Vector3(plant.normal.x, plant.normal.y, plant.normal.z),
          )
          .multiply(new THREE.Quaternion().setFromAxisAngle(up, plant.yaw)),
        new THREE.Vector3().setScalar(plant.height),
      );
    const prefer = new THREE.Vector3(
      s.home.view.x - plant.position.x,
      0,
      s.home.view.z - plant.position.z,
    );
    const found = findSeahorseGrip(positions, toWorld, {
      scale: SEAHORSE_SCALE,
      plantHeight: plant.height,
      prefer,
    });
    if (found) s.rehome(found.grip, found.forward);
  }
  /** Seat the rock-top frogfish on the authored stone surface beneath its hull-top perch. */
  private settleFrogfish(): void {
    const f = this.aquarium.anchoredLife.hidden.frogfish,
      n = f.home.orientation,
      down = new THREE.Vector3(-n.x, -n.y, -n.z),
      origin = new THREE.Vector3(
        f.home.position.x,
        f.home.position.y,
        f.home.position.z,
      ).addScaledVector(down, -0.3);
    const hit = this.reef.rockSurfaceDistance(origin, down, 0.6);
    f.settle(hit === undefined ? 0 : hit - 0.3 - 0.006);
  }
  private resize = (): void => {
    const width = this.host.clientWidth,
      height = this.host.clientHeight;
    this.camera.aspect = width / Math.max(1, height);
    this.camera.updateProjectionMatrix();
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    this.renderer.setSize(width, height);
  };
  render(
    time: number,
    reducedMotion: boolean,
    dt = 0,
    active = false,
    player?: PlayerPresence,
  ): void {
    this.aquarium.update(time, reducedMotion, dt, active, player);
    this.authored.update(this.camera);
    this.presentation?.update();
    this.renderer.render(this.scene, this.camera);
  }
  dispose(): void {
    this.disposed = true;
    this.assetStatus.remove();
    this.presentation?.dispose();
    this.presentation = undefined;
    this.abort.abort();
    this.resizeObserver.disconnect();
    this.reef.dispose();
    this.authored.dispose();
    this.aquarium.dispose();
    this.scene.clear();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
