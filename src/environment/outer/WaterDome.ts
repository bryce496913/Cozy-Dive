import * as THREE from 'three';

/**
 * v0.4 Pass 026: the blue. Open water fades with distance, and darker with depth: lighter towards
 * the surface far above, deep blue at the horizon, near-black below. A large dome around the eye
 * paints that gradient behind everything, and the scene's fog fades distant things towards the
 * dome's horizon colour, so reef, wall and creatures sink seamlessly into the same blue. Both
 * darken as the swimmer goes deeper. One draw, one small shader; owns and disposes its resources.
 */
export const WATER_LIGHT = {
  /** Horizon (and fog) colour at the reef top, and at the bottom of the reach down the wall. */
  shallow: 0x174f69,
  deep: 0x082337,
  /** Depths (m) over which the horizon darkens from shallow to deep. */
  from: 4,
  to: -14,
  /** Towards the surface, and straight down. */
  surface: 0x5aa9c2,
  abyss: 0x01070d,
  /** At the deepest, light is this much dimmer and fog this much denser (fractions). */
  dimming: 0.45,
  thickening: 0.6,
  /** The blue's brightness while the reef beyond the tunnel is still loading. */
  unlit: 0.12,
  /** Dome radius (inside the camera's far plane). */
  radius: 140,
} as const;

const smooth = (t: number): number => {
  const c = Math.max(0, Math.min(1, t));
  return c * c * (3 - 2 * c);
};
/** How deep the eye is, 0 at the reef top to 1 at the bottom of the reach down the wall. */
export function depthShade(y: number): number {
  return smooth((WATER_LIGHT.from - y) / (WATER_LIGHT.from - WATER_LIGHT.to));
}
/** The horizon colour at height `y` (pure; written into `out`). */
export function horizonColour(y: number, out: THREE.Color): THREE.Color {
  const t = depthShade(y);
  return out
    .setHex(WATER_LIGHT.shallow)
    .lerp(new THREE.Color(WATER_LIGHT.deep), t);
}

const VERTEX = /* glsl */ `
varying vec3 vDirection;
void main() {
  vDirection = normalize(position);
  vec4 world = modelMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * viewMatrix * world;
  gl_Position.z = gl_Position.w; // on the far plane
}`;
const FRAGMENT = /* glsl */ `
uniform vec3 horizon;
uniform vec3 surface;
uniform vec3 abyss;
varying vec3 vDirection;
void main() {
  float y = normalize(vDirection).y;
  vec3 up = mix(horizon, surface, pow(smoothstep(0.0, 1.0, y), 1.6));
  vec3 down = mix(horizon, abyss, smoothstep(0.3, 0.95, -y));
  gl_FragColor = vec4(y >= 0.0 ? up : down, 1.0);
  #include <colorspace_fragment>
}`;

export class WaterDome {
  readonly mesh: THREE.Mesh;
  /** The current horizon colour; the scene's fog and background follow it. */
  readonly horizon = new THREE.Color(WATER_LIGHT.shallow);
  /** How deep the eye is (see `depthShade`); light dims and fog thickens with it. */
  shade = 0;
  private readonly deepColour = new THREE.Color(WATER_LIGHT.deep);
  private readonly surface = new THREE.Color(WATER_LIGHT.surface);
  private readonly material: THREE.ShaderMaterial;
  private disposed = false;
  constructor() {
    this.material = new THREE.ShaderMaterial({
      name: 'Outer water dome',
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
      uniforms: {
        horizon: { value: this.horizon },
        surface: { value: this.surface },
        abyss: { value: new THREE.Color(WATER_LIGHT.abyss) },
      },
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
    });
    this.mesh = new THREE.Mesh(
      new THREE.SphereGeometry(WATER_LIGHT.radius, 32, 16),
      this.material,
    );
    this.mesh.name = 'Outer water dome';
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = -1;
  }
  /**
   * Centre the dome on the eye and set the horizon for its depth. `light` (0..1) scales the whole
   * blue: Pass 026 keeps it nearly dark beyond the tunnel until the reef is ready.
   */
  update(eye: THREE.Vector3, light = 1): void {
    if (this.disposed) return;
    this.mesh.position.copy(eye);
    this.shade = depthShade(eye.y);
    this.horizon.setHex(WATER_LIGHT.shallow).lerp(this.deepColour, this.shade);
    const k = WATER_LIGHT.unlit + (1 - WATER_LIGHT.unlit) * light;
    this.horizon.multiplyScalar(k);
    this.surface.setHex(WATER_LIGHT.surface).multiplyScalar(k);
  }
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.mesh.removeFromParent();
    this.mesh.geometry.dispose();
    this.material.dispose();
  }
}
