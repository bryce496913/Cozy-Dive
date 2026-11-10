import * as THREE from 'three';
import { OFFICE, TANK_SCALE } from '../config/office';
import { glassClarity } from '../player/dive';
import { OfficeEnvironment } from '../environment/office/OfficeEnvironment';
import type { PlayerPresence } from '../fish/FishDiverReaction';
import type { UnderwaterScene } from './UnderwaterScene';
import { warmUpScene } from './warmUp';

/**
 * v0.3 Pass 020: renders the cosy office around the real aquarium.
 *
 * The aquarium keeps simulating at full scale in its own scene. Each frame its camera is the office
 * camera mapped into aquarium space (divided by TANK_SCALE), which sees exactly what a one-metre
 * miniature would. That view is rendered at reduced resolution into a texture and shown on the
 * tank's glass panels in screen space, so office furniture in front of the tank still occludes
 * it. Because the mapped camera sits tens of aquarium units away, fish, corals and rocks all use
 * their distance levels, keeping the miniature cheap.
 */
const PORTAL_VERTEX = `
varying vec3 vNormalW;
varying vec3 vViewW;
void main(){
  vec4 world=modelMatrix*vec4(position,1.);
  vNormalW=normalize(mat3(modelMatrix)*normal);
  vViewW=cameraPosition-world.xyz;
  gl_Position=projectionMatrix*viewMatrix*world;
}`;
const PORTAL_FRAGMENT = `
uniform sampler2D map;
uniform vec2 resolution;
uniform float clarity;
uniform vec3 background;
varying vec3 vNormalW;
varying vec3 vViewW;
void main(){
  vec4 s=texture2D(map,gl_FragCoord.xy/resolution);
  // The target holds what was drawn, premultiplied, over a cleared (alpha 0) background. As in a
  // direct render, drawn colour is tone mapped and the background colour is not.
  // Un-premultiply so translucent layers (glass walls, surface) blend after tone mapping, as on
  // screen: tone-map the drawn colour, then lay it over the background by its coverage.
  vec3 c=s.a>0.0001?s.rgb/s.a:vec3(0.);
  #ifdef TONE_MAPPING
  c=toneMapping(c);
  #endif
  c=c*s.a+(1.-s.a)*background;
  // Glass: a faint cool tint and a soft reflection towards grazing angles.
  float fresnel=pow(1.-clamp(abs(dot(normalize(vViewW),normalize(vNormalW))),0.,1.),4.);
  // Pressed up to the glass (the dive) it no longer reads as glass: tint and sheen fade out.
  c=mix(mix(c*vec3(0.94,0.98,0.98),vec3(0.86,0.9,0.9),0.06+0.3*fresnel),c,clarity);
  gl_FragColor=vec4(c,1.);
  #include <colorspace_fragment>
}`;
/** Miniature render resolution relative to the screen. */
export const MINIATURE_RESOLUTION = 0.6;
/** Underwater haze for the outside view (the indoor view uses 0.026). */
export const MINIATURE_FOG = 0.009;

/**
 * Office camera pose -> aquarium-space camera pose. The tank frame maps aquarium coordinates to
 * the office as `tank * scale(TANK_SCALE)`, so the eye divides by the scale after undoing the tank
 * transform and turns by the inverse tank rotation. Perspective is scale-free, so this camera sees
 * exactly the miniature. Pure (no allocation); `inverseTank` is the tank frame's inverse.
 */
export function miniatureView(
  position: THREE.Vector3,
  quaternion: THREE.Quaternion,
  inverseTank: THREE.Matrix4,
  tankRotation: THREE.Quaternion,
  outPosition: THREE.Vector3,
  outQuaternion: THREE.Quaternion,
): void {
  outPosition
    .copy(position)
    .applyMatrix4(inverseTank)
    .multiplyScalar(1 / TANK_SCALE);
  outQuaternion.copy(tankRotation).invert().multiply(quaternion);
}

export class OfficeScene {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(66, 1, 0.05, 30);
  readonly office = new OfficeEnvironment();
  /** The aquarium-space camera that sees the miniature. */
  readonly miniatureCamera = new THREE.PerspectiveCamera(
    66,
    1,
    0.05 / TANK_SCALE,
    260,
  );
  readonly prepared: Promise<void>;
  private readonly target: THREE.WebGLRenderTarget;
  private readonly portal: THREE.ShaderMaterial;
  private readonly lights: THREE.Light[] = [];
  private readonly size = new THREE.Vector2();
  private readonly inverseTank = new THREE.Matrix4();
  private readonly tankRotation = new THREE.Quaternion();
  private readonly inactive: PlayerPresence = {
    position: { x: 0, y: 7, z: 40 },
    velocity: { x: 0, y: 0, z: 0 },
    active: false,
  };
  /** v0.3 Pass 021: the office seen from inside the tank (surfacing), rendered on demand. */
  private outsideTarget?: THREE.WebGLRenderTarget;
  private readonly outsideCamera = new THREE.PerspectiveCamera(
    64,
    1,
    0.005,
    30,
  );
  private disposed = false;

  constructor(private readonly world: UnderwaterScene) {
    this.scene.name = 'Office';
    this.scene.background = new THREE.Color(0x3a332d);
    this.scene.add(this.office.root);
    // Soft rainy daylight through the window, a warm desk lamp, and a gentle room fill.
    const sky = new THREE.HemisphereLight(0xf4efe6, 0x6e5a48, 1.15);
    // A wide, fully soft spot from just outside the window stands in for an area light (whose
    // lookup tables would add ~280 kB to the bundle).
    const daylight = new THREE.SpotLight(0xe2eaf0, 9, 9, 1.1, 1, 1.2);
    daylight.position.set(
      this.office.window.center.x,
      this.office.window.center.y + 0.3,
      this.office.window.center.z - 0.6,
    );
    daylight.target.position.set(this.office.window.center.x + 0.4, 0.4, 1.2);
    this.scene.add(daylight.target);
    const bounce = new THREE.DirectionalLight(0xdfe7ee, 0.55);
    bounce.position.set(-0.6, 2.4, -4);
    const lamp = new THREE.PointLight(0xffc68a, 2.2, 3.2, 1.6);
    lamp.position.copy(this.office.lampBulb);
    const tankLight = new THREE.PointLight(0xbfe8e8, 0.35, 1.6, 2);
    tankLight.position.set(
      OFFICE.stand.center.x - 0.6,
      1.25,
      OFFICE.stand.center.z,
    );
    this.lights.push(sky, daylight, bounce, lamp, tankLight);
    this.scene.add(...this.lights);

    this.target = new THREE.WebGLRenderTarget(1, 1, {
      type: THREE.HalfFloatType,
      samples: 4,
    });
    this.portal = new THREE.ShaderMaterial({
      uniforms: {
        map: { value: this.target.texture },
        resolution: { value: new THREE.Vector2(1, 1) },
        clarity: { value: 0 },
        background: { value: new THREE.Color() },
      },
      vertexShader: PORTAL_VERTEX,
      fragmentShader: PORTAL_FRAGMENT,
    });
    this.portal.name = 'Miniature aquarium glass';
    for (const glass of this.office.tankGlass) glass.material = this.portal;
    if (world.scene.background instanceof THREE.Color)
      this.portal.uniforms.background.value.copy(world.scene.background);
    this.office.root.updateMatrixWorld(true);
    this.office.tankRoot.matrixWorld.decompose(
      new THREE.Vector3(),
      this.tankRotation,
      new THREE.Vector3(),
    );
    this.inverseTank.copy(this.office.tankRoot.matrixWorld).invert();
    this.camera.position.set(OFFICE.spawn.x, OFFICE.spawn.y, OFFICE.spawn.z);
    this.camera.rotation.set(-0.12, OFFICE.spawnYaw, 0, 'YXZ');
    this.prepared = warmUpScene(world.renderer, this.scene, this.camera);
  }

  /** Map the office camera into aquarium space (exact miniature view). */
  private syncMiniature(): void {
    const c = this.camera,
      m = this.miniatureCamera;
    c.updateMatrixWorld();
    miniatureView(
      c.position,
      c.quaternion,
      this.inverseTank,
      this.tankRotation,
      m.position,
      m.quaternion,
    );
    if (m.fov !== c.fov || m.aspect !== c.aspect) {
      m.fov = c.fov;
      m.aspect = c.aspect;
      m.updateProjectionMatrix();
    }
    m.updateMatrixWorld();
  }

  private fit(): void {
    const renderer = this.world.renderer;
    renderer.getDrawingBufferSize(this.size);
    const aspect = this.size.x / Math.max(1, this.size.y);
    if (Math.abs(this.camera.aspect - aspect) > 1e-6) {
      this.camera.aspect = aspect;
      this.camera.updateProjectionMatrix();
    }
    const w = Math.max(1, Math.round(this.size.x * MINIATURE_RESOLUTION)),
      h = Math.max(1, Math.round(this.size.y * MINIATURE_RESOLUTION));
    if (this.target.width !== w || this.target.height !== h)
      this.target.setSize(w, h);
    this.portal.uniforms.resolution.value.copy(this.size);
  }

  /**
   * v0.3 Pass 021: render the office as seen from `aquariumCamera`'s pose mapped into the office
   * (inside the tank, looking out), for the aquarium's front glass while surfacing.
   */
  renderOutside(aquariumCamera: THREE.PerspectiveCamera): THREE.Texture {
    this.fit();
    const target = (this.outsideTarget ??= new THREE.WebGLRenderTarget(1, 1, {
        type: THREE.HalfFloatType,
        samples: 4,
      })),
      c = this.outsideCamera;
    if (
      target.width !== this.target.width ||
      target.height !== this.target.height
    )
      target.setSize(this.target.width, this.target.height);
    aquariumCamera.updateMatrixWorld();
    c.position
      .copy(aquariumCamera.position)
      .multiplyScalar(TANK_SCALE)
      .applyMatrix4(this.office.tankRoot.matrixWorld);
    c.quaternion.copy(this.tankRotation).multiply(aquariumCamera.quaternion);
    if (c.fov !== aquariumCamera.fov || c.aspect !== aquariumCamera.aspect) {
      c.fov = aquariumCamera.fov;
      c.aspect = aquariumCamera.aspect;
      c.updateProjectionMatrix();
    }
    c.updateMatrixWorld();
    const renderer = this.world.renderer,
      previous = renderer.getRenderTarget();
    try {
      renderer.setRenderTarget(target);
      renderer.clear();
      renderer.render(this.scene, c);
    } finally {
      renderer.setRenderTarget(previous);
    }
    return target.texture;
  }
  /** Free the outside view's render target once surfacing is over. */
  releaseOutside(): void {
    this.outsideTarget?.dispose();
    this.outsideTarget = undefined;
  }
  /** Screen size the outside view is sampled at. */
  get resolution(): THREE.Vector2 {
    return this.size;
  }
  /**
   * Advance the office (its clock and rain on `time`) and the aquarium inside the tank (on
   * `aquariumTime`, the same clock it runs on when swimming, so nothing jumps at the dive), then
   * draw both.
   */
  render(
    time: number,
    aquariumTime: number,
    reducedMotion: boolean,
    dt: number,
  ): void {
    if (this.disposed) return;
    this.fit();
    this.office.update(time, reducedMotion, dt);
    this.syncMiniature();
    // v0.3 Pass 021: the glass clears as the dive presses up to it.
    this.portal.uniforms.clarity.value = glassClarity(this.camera.position);
    // Fish keep schooling in the miniature; there is no diver inside the tank.
    this.world.simulate(
      aquariumTime,
      reducedMotion,
      dt,
      true,
      this.inactive,
      this.miniatureCamera,
    );
    this.world.renderView(this.miniatureCamera, this.target, MINIATURE_FOG);
    this.world.renderer.render(this.scene, this.camera);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.office.dispose();
    this.lights.forEach((l) => l.dispose());
    this.portal.dispose();
    this.target.dispose();
    this.outsideTarget?.dispose();
    this.scene.clear();
  }
}
