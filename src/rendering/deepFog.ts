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

/**
 * V0.7 Pass 064: water as a substance, not tinted air.
 *
 * - `nearHaze`: a linear extinction term alongside the exponential-squared one, so even near forms
 *   sit slightly in the water and foreground, midground and distance separate gradually.
 * - `absorption`: spectral absorption derived from the fog (water) colour. Each channel's
 *   extinction grows by up to this fraction the less of it the water colour holds, so reds fade
 *   first with distance and blue-greens last, as in real water. No new uniform: any world's water
 *   colour is its absorption spectrum.
 *
 * The exponential-squared density is rescaled by `visibilityScale` so the distance at which a
 * surface is half veiled is unchanged for every world (the outer reef's visibility was tuned by
 * request). Solving (c x)^2 + h (c x) = ln 2 at the old half distance x = sqrt(ln 2) gives c.
 */
export const WATER_FOG = {
  nearHaze: 0.3,
  absorption: 0.6,
} as const;
export const visibilityScale = (nearHaze: number): number => {
  const half = Math.sqrt(Math.LN2),
    x = (-nearHaze + Math.sqrt(nearHaze * nearHaze + 4 * Math.LN2)) / 2;
  return x / half;
};

/** CPU mirror of the fog shader's per-channel veil (0 clear .. 1 fully water), for tests/tools. */
export function waterVeil(
  distance: number,
  density: number,
  water: readonly [number, number, number],
): [number, number, number] {
  const k = visibilityScale(WATER_FOG.nearHaze),
    d = density * k * distance,
    optical = d * d + WATER_FOG.nearHaze * d,
    top = Math.max(water[0], water[1], water[2], 1e-3);
  return water.map(
    (c) => 1 - Math.exp(-optical * (1 + WATER_FOG.absorption * (1 - c / top))),
  ) as [number, number, number];
}

const glsl = (n: number): string => (Number.isInteger(n) ? `${n}.0` : `${n}`);

let installed = false;
export function installDeepFog(): void {
  if (installed) return;
  installed = true;
  const d = DEEP_FOG,
    w = WATER_FOG,
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
		float fogD = fogDensity * ${glsl(Number(visibilityScale(w.nearHaze).toFixed(6)))} * vFogDepth;
		float fogOptical = fogD * fogD + ${glsl(w.nearHaze)} * fogD;
		vec3 fogAbsorb = 1.0 + ${glsl(w.absorption)} * ( 1.0 - fogColor / max( max( fogColor.r, fogColor.g ), max( fogColor.b, 0.001 ) ) );
		vec3 fogVeil = 1.0 - exp( - fogOptical * fogAbsorb );
		float fogFactor = dot( fogVeil, vec3( 0.3333 ) );
		float fogDeep = smoothstep( 0.0, 1.0, ( ${glsl(d.from)} - vFogWorldY ) / ${glsl(d.from - d.to)} );
		vec3 fogDeepColor = fogColor * ( 1.0 - ${glsl(1 - d.darkest)} * fogDeep );
		gl_FragColor.rgb = mix( gl_FragColor.rgb, fogDeepColor, max( fogVeil, vec3( ${glsl(d.veil)} * fogDeep ) ) );
	#else
		float fogFactor = smoothstep( fogNear, fogFar, vFogDepth );
		gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactor );
	#endif
#endif
`;
}
