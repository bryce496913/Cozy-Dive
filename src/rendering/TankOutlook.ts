import * as THREE from 'three';
import { AQUARIUM } from '../config/world';

/**
 * v0.4 Pass 027: the office seen from inside the tank, through its glass. The office is captured
 * once as a small cube map from the tank's centre, aligned with the aquarium's axes (see
 * `OfficeScene.captureFromTank`). Here a box just outside the glass shows it, sampled from a
 * blurred mip level, tinted towards the water and fogged like everything else in the tank, so the
 * office is soft and watery, and nearer glass shows it more clearly than far glass. Only the
 * swimmer's view shows it: the room's miniature of the tank and the surfacing view hide it.
 */
export const OUTLOOK = {
  /** Mip level sampled (the capture is 128 px per face: level 1.2 is roughly 55 px). */
  blur: 1.2,
  /** How far the view is drawn towards the water colour, and dimmed. */
  tint: 0.28,
  light: 0.9,
  water: 0x2b6f83,
  /** Just outside the glass (aquarium units). */
  margin: 0.04,
} as const;

const VERTEX = /* glsl */ `
#include <fog_pars_vertex>
varying vec3 vDirection;
uniform vec3 centre;
void main() {
  vec4 world = modelMatrix * vec4(position, 1.0);
  vDirection = world.xyz - centre;
  vec4 mvPosition = viewMatrix * world;
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`;
const FRAGMENT = /* glsl */ `
#include <fog_pars_fragment>
uniform samplerCube map;
uniform float blur;
uniform float tint;
uniform float light;
uniform vec3 water;
varying vec3 vDirection;
void main() {
  vec3 office = textureLod(map, normalize(vDirection), blur).rgb;
  gl_FragColor = vec4(mix(office, water, tint) * light, 1.0);
  #include <fog_fragment>
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

export class TankOutlook {
  readonly mesh: THREE.Mesh<THREE.BoxGeometry, THREE.ShaderMaterial>;
  private disposed = false;
  constructor() {
    const b = AQUARIUM,
      m = OUTLOOK.margin,
      geometry = new THREE.BoxGeometry(
        b.max.x - b.min.x + 2 * m,
        b.max.y - b.min.y + 2 * m,
        b.max.z - b.min.z + 2 * m,
      );
    geometry.translate(
      (b.min.x + b.max.x) / 2,
      (b.min.y + b.max.y) / 2,
      (b.min.z + b.max.z) / 2,
    );
    const material = new THREE.ShaderMaterial({
      name: 'Office through the tank glass',
      uniforms: THREE.UniformsUtils.merge([
        THREE.UniformsLib.fog,
        {
          map: { value: null },
          centre: {
            value: new THREE.Vector3(
              (b.min.x + b.max.x) / 2,
              (b.min.y + b.max.y) / 2,
              (b.min.z + b.max.z) / 2,
            ),
          },
          blur: { value: OUTLOOK.blur },
          tint: { value: OUTLOOK.tint },
          light: { value: OUTLOOK.light },
          water: { value: new THREE.Color(OUTLOOK.water) },
        },
      ]),
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
      side: THREE.BackSide,
      fog: true,
    });
    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.name = 'Office through the tank glass';
    this.mesh.frustumCulled = false;
    this.mesh.visible = false;
  }
  /** Show `view` (a cube capture of the office from the tank's centre), or nothing (null). */
  setView(view: THREE.CubeTexture | null): void {
    if (this.disposed) return;
    this.mesh.material.uniforms.map.value = view;
    this.mesh.visible = !!view;
  }
  get showing(): boolean {
    return this.mesh.visible;
  }
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.mesh.removeFromParent();
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
  }
}
