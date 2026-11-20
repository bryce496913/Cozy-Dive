import * as THREE from 'three';
import type { WaterProfile } from '../../config/waterProfiles';

export interface LightRig {
  readonly sky: THREE.HemisphereLight;
  readonly sun: THREE.DirectionalLight;
  readonly fill: THREE.DirectionalLight;
  /** sky, sun, fill: the order every world's dimming code expects. */
  readonly lights: readonly [
    THREE.HemisphereLight,
    THREE.DirectionalLight,
    THREE.DirectionalLight,
  ];
}

/**
 * V0.7 Pass 064: a world's light rig from its water profile. Every world uses the same kinds and
 * number of lights, so shader programs stay shared between worlds. The caller adds the lights to
 * its scene (and owns them with it).
 */
export function createLightRig(profile: WaterProfile): LightRig {
  const h = profile.hemisphere;
  const sky = new THREE.HemisphereLight(h.sky, h.ground, h.intensity),
    sun = new THREE.DirectionalLight(profile.sun.color, profile.sun.intensity),
    fill = new THREE.DirectionalLight(
      profile.fill.color,
      profile.fill.intensity,
    );
  sky.name = `${profile.label} sky light`;
  sun.name = `${profile.label} sun`;
  fill.name = `${profile.label} fill`;
  sun.position.set(...profile.sun.position);
  fill.position.set(...profile.fill.position);
  return { sky, sun, fill, lights: [sky, sun, fill] };
}
