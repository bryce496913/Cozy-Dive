import * as THREE from 'three';
import type { CausticSpec } from '../../config/waterProfiles';

/**
 * V0.7 Pass 064: restrained surface caustics on shallow, upward-facing surfaces (sand, reef tops).
 *
 * A bounded addition to an existing material's lighting, not a post-process: the pattern
 * redistributes a little sun-coloured diffuse light (bright ribbons, slightly darker gaps, about the
 * same average), only where the surface faces up, fading with depth below the
 * profile's `fullAbove` (none below `noneBelow`) and with distance from the eye (no far shimmer).
 * The pattern is a three-iteration tileable water-caustic function evaluated in world XZ.
 *
 * Time is one shared uniform. `advanceCaustics` follows simulation time and holds still while
 * reduced motion is on, so the pattern freezes rather than disappears.
 */
const time = { value: 0 };
let frozenAt: number | null = null;

/** Drive every caustic material from simulation time (s). Reduced motion freezes the pattern. */
export function advanceCaustics(seconds: number, reducedMotion: boolean): void {
  if (reducedMotion) {
    frozenAt ??= time.value;
    time.value = frozenAt;
    return;
  }
  frozenAt = null;
  time.value = seconds;
}
export function causticTime(): number {
  return time.value;
}

const VERTEX_PARS = /* glsl */ `
varying vec3 vCausticWorld;
`;
const VERTEX_MAIN = /* glsl */ `
	vec4 causticWorld = vec4( transformed, 1.0 );
	#ifdef USE_INSTANCING
		causticWorld = instanceMatrix * causticWorld;
	#endif
	vCausticWorld = ( modelMatrix * causticWorld ).xyz;
`;
const FRAGMENT_PARS = /* glsl */ `
varying vec3 vCausticWorld;
uniform float causticTime;
uniform float causticStrength;
uniform float causticScale;
uniform float causticSpeed;
uniform float causticFull;
uniform float causticNone;
uniform float causticFade;
uniform vec3 causticColor;
float causticPattern( vec2 uv, float t ) {
	vec2 p = mod( uv * 6.28318, 6.28318 ) - 250.0;
	vec2 i = p;
	float c = 1.0;
	for ( int n = 0; n < 3; n++ ) {
		float tt = t * ( 1.0 - 3.5 / float( n + 1 ) );
		i = p + vec2( cos( tt - i.x ) + sin( tt + i.y ), sin( tt - i.y ) + cos( tt + i.x ) );
		c += 1.0 / length( vec2( p.x / ( sin( i.x + tt ) / 0.005 ), p.y / ( cos( i.y + tt ) / 0.005 ) ) );
	}
	c = 1.17 - pow( c / 3.0, 1.4 );
	return clamp( pow( abs( c ), 4.0 ) * 1.6, 0.0, 1.0 );
}
`;
const FRAGMENT_MAIN = /* glsl */ `
#include <lights_fragment_end>
{
	vec3 causticUp = inverseTransformDirection( normal, viewMatrix );
	float causticFacing = smoothstep( 0.25, 0.85, causticUp.y );
	float causticDepth = clamp( ( vCausticWorld.y - causticNone ) / max( causticFull - causticNone, 1e-3 ), 0.0, 1.0 );
	float causticNear = 1.0 - smoothstep( causticFade * 0.55, causticFade, distance( vCausticWorld, cameraPosition ) );
	float causticAmount = causticFacing * causticDepth * causticNear;
	if ( causticAmount > 0.0 ) {
		float c = causticPattern( vCausticWorld.xz * causticScale, causticTime * causticSpeed );
		// Caustics redistribute light: bright ribbons, slightly darker gaps, about the same average.
		reflectedLight.directDiffuse = max( reflectedLight.directDiffuse + diffuseColor.rgb * causticColor * ( ( c - 0.28 ) * causticStrength * causticAmount ), vec3( 0.0 ) );
	}
}
`;

export interface CausticUniforms {
  causticTime: { value: number };
  causticStrength: { value: number };
  causticScale: { value: number };
  causticSpeed: { value: number };
  causticFull: { value: number };
  causticNone: { value: number };
  causticFade: { value: number };
  causticColor: { value: THREE.Color };
}

export function causticUniforms(spec: CausticSpec): CausticUniforms {
  return {
    causticTime: time,
    causticStrength: { value: spec.strength },
    causticScale: { value: spec.scale },
    causticSpeed: { value: spec.speed },
    causticFull: { value: spec.fullAbove },
    causticNone: { value: spec.noneBelow },
    causticFade: { value: spec.fadeDistance },
    causticColor: { value: new THREE.Color(spec.color) },
  };
}

/**
 * Adds caustics to a standard material (in place), composing with any existing
 * `onBeforeCompile` (triplanar, plant motion). Returns the material's caustic uniforms.
 */
export function addCaustics(
  material: THREE.MeshStandardMaterial,
  spec: CausticSpec,
): CausticUniforms {
  const existing: unknown = material.userData.caustics;
  if (existing) return existing as CausticUniforms;
  const uniforms = causticUniforms(spec);
  material.userData.caustics = uniforms;
  const previous = material.onBeforeCompile.bind(material),
    key = material.customProgramCacheKey.bind(material);
  material.onBeforeCompile = (shader, renderer) => {
    previous(shader, renderer);
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${VERTEX_PARS}`)
      .replace(
        '#include <project_vertex>',
        `#include <project_vertex>\n${VERTEX_MAIN}`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${FRAGMENT_PARS}`)
      .replace('#include <lights_fragment_end>', FRAGMENT_MAIN);
  };
  material.customProgramCacheKey = () => `${key()}|caustics-v1`;
  material.needsUpdate = true;
  return uniforms;
}
