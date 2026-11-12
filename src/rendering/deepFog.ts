import * as THREE from 'three';

/**
 * v0.4 Pass 026 playtest: the deep gets darker. Exponential fog normally fades everything towards
 * one colour. Below `from` (world y, m) this version fades towards an ever darker blue, reaching
 * `darkest` (a fraction of the fog colour) at `to`. It also veils deep surfaces even close by, by
 * up to `veil`, so the wall's foot and the bottom below the edge sink into darkness.
 *
 * It is installed once, before anything compiles: the outer waters share compiled programs with
 * the tank. The tank never goes below y 0, so for it the result is exactly the standard fog.
 */
export const DEEP_FOG = {
  from: -2,
  to: -34,
  darkest: 0.1,
  veil: 0.85,
} as const;

const glsl = (n: number): string => (Number.isInteger(n) ? `${n}.0` : `${n}`);

let installed = false;
export function installDeepFog(): void {
  if (installed) return;
  installed = true;
  const d = DEEP_FOG,
    chunk = THREE.ShaderChunk;
  chunk.fog_pars_vertex = /* glsl */ `
#ifdef USE_FOG
	varying float vFogDepth;
	varying float vFogWorldY;
#endif
`;
  // World height from the view-space position: the camera's height plus the view offset turned
  // back into world axes (the view matrix's rotation is orthonormal, so its transpose inverts it).
  chunk.fog_vertex = /* glsl */ `
#ifdef USE_FOG
	vFogDepth = - mvPosition.z;
	vFogWorldY = cameraPosition.y + ( transpose( mat3( viewMatrix ) ) * mvPosition.xyz ).y;
#endif
`;
  chunk.fog_pars_fragment = /* glsl */ `
#ifdef USE_FOG
	uniform vec3 fogColor;
	varying float vFogDepth;
	varying float vFogWorldY;
	#ifdef FOG_EXP2
		uniform float fogDensity;
	#else
		uniform float fogNear;
		uniform float fogFar;
	#endif
#endif
`;
  chunk.fog_fragment = /* glsl */ `
#ifdef USE_FOG
	#ifdef FOG_EXP2
		float fogFactor = 1.0 - exp( - fogDensity * fogDensity * vFogDepth * vFogDepth );
		float fogDeep = smoothstep( 0.0, 1.0, ( ${glsl(d.from)} - vFogWorldY ) / ${glsl(d.from - d.to)} );
		vec3 fogDeepColor = fogColor * ( 1.0 - ${glsl(1 - d.darkest)} * fogDeep );
		gl_FragColor.rgb = mix( gl_FragColor.rgb, fogDeepColor, max( fogFactor, ${glsl(d.veil)} * fogDeep ) );
	#else
		float fogFactor = smoothstep( fogNear, fogFar, vFogDepth );
		gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactor );
	#endif
#endif
`;
}
