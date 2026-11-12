import { AuthoredAquarium } from '../environment/AuthoredAquarium';
import { AuthoredReef } from '../environment/AuthoredReef';
import { TankOutlook } from './TankOutlook';
import { warmUpScene } from './warmUp';
import { findSeahorseGrip } from '../creatures/discoveries/SeahorseGrip';
import { SEAHORSE_SCALE } from '../creatures/discoveries/Seahorse';
import { AssetLoader } from '../assets/AssetLoader';
import type { PlayerPresence } from '../fish/FishDiverReaction';
import * as THREE from 'three';
import { Aquarium } from '../environment/Aquarium';
import { AQUARIUM, type Bounds } from '../config/world';
import type { CollisionWorld } from '../player/collision';
import type { SightCandidate } from '../discovery/journal';
import type { WaterWorld } from './WaterWorld';

const OUTSIDE_VERTEX = `void main(){gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`;
const OUTSIDE_FRAGMENT = `
uniform sampler2D map;
uniform vec2 resolution;
void main(){
  vec3 c=texture2D(map,gl_FragCoord.xy/resolution).rgb;
  #ifdef TONE_MAPPING
  c=toneMapping(c);
  #endif
  gl_FragColor=vec4(c,1.);
  #include <colorspace_fragment>
}`;
/** Underwater haze density seen from inside the water. */
export const UNDERWATER_HAZE = 0.026;
export interface Presentation {
  update(): void;
  dispose(): void;
}

export class UnderwaterScene implements WaterWorld {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(64, 1, 0.08, 80);
  /** v0.4 Pass 023: the tank as a swimmable world (nothing in it counts as a new sighting). */
  readonly id = 'aquarium' as const;
  readonly sightings: readonly SightCandidate[] = [];
  get bounds(): Bounds {
    return AQUARIUM;
  }
  get collision(): CollisionWorld {
    return this.aquarium.collision;
  }
  readonly renderer: THREE.WebGLRenderer;
  readonly aquarium: Aquarium;
  readonly authored: AuthoredAquarium;
  readonly reef: AuthoredReef;
  /** v0.4 Pass 024: the reef library's loader (the outer reef leases from the same cache). */
  readonly reefLoader: AssetLoader;
  /** Resolves once authored libraries settle and their programs are compiled. */
  readonly prepared: Promise<boolean>;
  private readonly assetStatus = document.createElement('p');
  private disposed = false;
  private presentation?: Presentation;
  /** v0.3 Pass 021: the office seen through the front glass while surfacing (lazy). */
  private outside?: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>;
  private readonly outsideMaterial = new THREE.ShaderMaterial({
    uniforms: {
      map: { value: null },
      resolution: { value: new THREE.Vector2(1, 1) },
    },
    vertexShader: OUTSIDE_VERTEX,
    fragmentShader: OUTSIDE_FRAGMENT,
    fog: false,
  });
  /** v0.4 Pass 027: the office, blurred, through the glass (once the office has captured it). */
  readonly outlook: TankOutlook;
  /** Reused by `renderView` to restore the clear colour (no per-frame allocation). */
  private readonly clearColor = new THREE.Color();
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
    this.outlook = new TankOutlook(this.scene.background);
    this.scene.fog = new THREE.FogExp2(0x225d73, UNDERWATER_HAZE);
    this.scene.add(new THREE.HemisphereLight(0xc7f2e0, 0x546b56, 2.6));
    const sunlight = new THREE.DirectionalLight(0xfff1cf, 3.2);
    sunlight.position.set(-7, 18, 7);
    this.scene.add(sunlight);
    const fill = new THREE.DirectionalLight(0x75ced0, 0.7);
    fill.position.set(10, 8, -12);
    this.scene.add(fill);
    this.aquarium = new Aquarium();
    this.scene.add(this.aquarium.root);
    this.scene.add(this.outlook.mesh);
    this.assetStatus.textContent = 'Preparing aquarium details…';
    this.assetStatus.setAttribute('role', 'status');
    this.assetStatus.style.cssText =
      'position:absolute;bottom:1rem;left:1rem;color:white;pointer-events:none;font:14px sans-serif';
    host.append(this.assetStatus);
    // KTX2 textures need the renderer to choose a GPU-compressed transcode target.
    this.authored = new AuthoredAquarium(this.aquarium, this.renderer);
    this.reefLoader = new AssetLoader(undefined, undefined, this.renderer);
    this.reef = new AuthoredReef(this.aquarium, this.reefLoader);
    // Each library falls back independently; the status stays until both have settled and
    // their shader programs are compiled, so the first swimming frame does not hitch.
    this.prepared = Promise.all([this.authored.ready, this.reef.ready]).then(
      async (ready) => {
        if (this.disposed) return false;
        this.settleFrogfish();
        this.gripSeahorse();
        // Sand drifted into the authored wreck wears the seabed's own sand (Pass 019).
        this.aquarium.ornaments.models
          .find((m) => m.kind === 'shipwreck')
          ?.root.traverse((o) => {
            if (
              o instanceof THREE.Mesh &&
              /^(Drifted_Sand|Shipwreck_Sand)/.test(o.name)
            )
              this.reef.drapeSand(o);
          });
        // Pass 021: include the surfacing view's shader, so the first surfacing does not hitch.
        const probe = this.outsideMesh();
        this.scene.add(probe);
        try {
          // Compile every program (hidden LOD levels too) and upload every texture behind the
          // status, so nothing pops in when first seen while swimming (Pass 019).
          await warmUpScene(this.renderer, this.scene, this.camera);
        } catch (error) {
          console.warn('Cozy Diver: shader warm-up skipped.', error);
        } finally {
          this.scene.remove(probe);
          probe.geometry.dispose();
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
    this.simulate(time, reducedMotion, dt, active, player, this.camera);
    this.renderer.render(this.scene, this.camera);
  }
  /**
   * v0.3 Pass 021: while surfacing, the front glass shows the office as seen from the swimmer's
   * position (rendered by the office into `view`, in screen space). Null removes it and frees its
   * geometry (the material, which holds no GPU memory of its own, is kept so the shader stays warm).
   */
  setOutsideView(view: THREE.Texture | null, resolution?: THREE.Vector2): void {
    if (!view) {
      if (this.outside) {
        this.scene.remove(this.outside);
        this.outside.geometry.dispose();
        this.outside = undefined;
      }
      this.outsideMaterial.uniforms.map.value = null;
      return;
    }
    if (!this.outside) {
      this.outside = this.outsideMesh();
      this.scene.add(this.outside);
    }
    this.outside.material.uniforms.map.value = view;
    if (resolution)
      this.outside.material.uniforms.resolution.value.copy(resolution);
  }
  /** A plane on the inside of the front wall, facing into the water, for the outside view. */
  private outsideMesh(): THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial> {
    const geometry = new THREE.PlaneGeometry(
      AQUARIUM.max.x - AQUARIUM.min.x,
      AQUARIUM.max.y - AQUARIUM.min.y,
    );
    geometry.rotateY(Math.PI);
    geometry.translate(
      0,
      (AQUARIUM.min.y + AQUARIUM.max.y) / 2,
      AQUARIUM.max.z - 0.005,
    );
    const mesh = new THREE.Mesh(geometry, this.outsideMaterial);
    mesh.name = 'Office through the front glass';
    mesh.frustumCulled = false;
    return mesh;
  }
  /** v0.3 Pass 021: the dive thickens the haze from the outside view to the underwater one. */
  setHaze(density: number): void {
    if (this.scene.fog instanceof THREE.FogExp2)
      this.scene.fog.density = density;
  }
  /**
   * Advance the aquarium (fish, creatures, plants) and choose per-fish distance levels for
   * `camera`. v0.3 Pass 020: the office drives this with its miniature-tank camera.
   */
  simulate(
    time: number,
    reducedMotion: boolean,
    dt: number,
    active: boolean,
    player: PlayerPresence | undefined,
    camera: THREE.Camera,
  ): void {
    this.aquarium.update(time, reducedMotion, dt, active, player);
    this.authored.update(camera);
    this.presentation?.update();
  }
  /**
   * Render the aquarium from `camera` into `target` (v0.3 Pass 020 miniature tank). Seen from
   * outside the glass the eye is far from the water, so the underwater haze is thinned to
   * `fogDensity` for this view only.
   */
  renderView(
    camera: THREE.Camera,
    target: THREE.WebGLRenderTarget,
    fogDensity: number,
  ): void {
    const fog = this.scene.fog,
      density = fog instanceof THREE.FogExp2 ? fog.density : 0,
      previous = this.renderer.getRenderTarget(),
      background = this.scene.background,
      clearColor = this.renderer.getClearColor(this.clearColor),
      clearAlpha = this.renderer.getClearAlpha();
    if (fog instanceof THREE.FogExp2) fog.density = fogDensity;
    // Seen from the room, the tank shows the room itself, not a capture of it (Pass 027).
    const outlook = this.outlook.mesh.visible;
    this.outlook.mesh.visible = false;
    // Rendered directly, the background colour is not tone mapped. Keep it identifiable in the
    // target (alpha 0, background colour) so the glass can treat it the same way (Pass 021).
    if (background instanceof THREE.Color) {
      this.scene.background = null;
      this.renderer.setClearColor(background, 0);
    }
    try {
      this.renderer.setRenderTarget(target);
      this.renderer.clear();
      this.renderer.render(this.scene, camera);
    } finally {
      this.renderer.setRenderTarget(previous);
      this.scene.background = background;
      this.renderer.setClearColor(clearColor, clearAlpha);
      if (fog instanceof THREE.FogExp2) fog.density = density;
      this.outlook.mesh.visible = outlook;
    }
  }
  dispose(): void {
    this.disposed = true;
    this.assetStatus.remove();
    this.presentation?.dispose();
    this.presentation = undefined;
    this.abort.abort();
    this.resizeObserver.disconnect();
    this.outside?.geometry.dispose();
    this.outsideMaterial.dispose();
    this.outlook.dispose();
    this.reef.dispose();
    this.authored.dispose();
    this.aquarium.dispose();
    this.scene.clear();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
