import type { PlayerPresence } from '../fish/FishDiverReaction';
import * as THREE from 'three';
import { Aquarium } from '../environment/Aquarium';

export class UnderwaterScene {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(64, 1, 0.08, 80);
  readonly renderer: THREE.WebGLRenderer;
  readonly aquarium: Aquarium;
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
      'A tranquil aquarium with sand, rocks and swaying plants',
    );
    host.append(this.renderer.domElement);
    this.scene.background = new THREE.Color(0x18585e);
    this.scene.fog = new THREE.FogExp2(0x18585e, 0.039);
    this.scene.add(new THREE.HemisphereLight(0xc7f2e0, 0x546b56, 2.6));
    const sunlight = new THREE.DirectionalLight(0xfff1cf, 3.2);
    sunlight.position.set(-7, 18, 7);
    this.scene.add(sunlight);
    const fill = new THREE.DirectionalLight(0x75ced0, 0.7);
    fill.position.set(10, 8, -12);
    this.scene.add(fill);
    this.aquarium = new Aquarium();
    this.scene.add(this.aquarium.root);
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
    this.renderer.render(this.scene, this.camera);
  }
  dispose(): void {
    this.abort.abort();
    this.resizeObserver.disconnect();
    this.aquarium.dispose();
    this.scene.clear();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
