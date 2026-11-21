import * as THREE from 'three';

/**
 * V0.7 Pass 078: one shared material for gelatinous animals (comb jellies, jellyfish, salps,
 * sea squirts). Their old materials were a single flat opacity, which reads as tinted plastic:
 * equally dense everywhere, with no sense of a body you look *through*.
 *
 * This keeps the cheap single-pass, sorted-transparent path (no transmission, no extra render
 * target) and adds what makes jelly read as jelly:
 *
 * - **Thickness.** Opacity follows the view angle: nearly clear where you look straight through
 *   the thin body wall (`core`), denser at the grazing silhouette where the line of sight crosses
 *   much more tissue (`rim`).
 * - **Colour response.** The rim takes on a soft glow in the animal's own tint (`rimColor`), as
 *   light scatters inside the mesoglea, instead of a uniform emissive wash.
 * - **Organs.** Dark vertex colours (gut, gonads, mouth) stay opaque inside the clear body
 *   (`organs`), so the internal anatomy shows through.
 * - **Iridescence.** Saturated vertex colours (comb rows) shift hue with the view angle
 *   (`iridescence`), like diffracting cilia; pale tissue is unaffected.
 *
 * Restrained by design: `core` keeps the body visible in murky water, and no value exceeds the
 * lighting it receives.
 */
export interface GelatinousOptions {
  readonly name: string;
  /** Opacity seen face-on, through the thin body wall (0..1). */
  readonly core: number;
  /** Opacity at the grazing silhouette (0..1). */
  readonly rim: number;
  /** Glow colour scattered toward the rim. */
  readonly rimColor: THREE.ColorRepresentation;
  /** Rim glow strength (0 = none). */
  readonly rimGlow: number;
  /** How opaque dark (organ) vertex colours become (0 = like the body, 1 = solid). */
  readonly organs?: number;
  /** View-dependent hue shift on saturated vertex colours (0 = none). */
  readonly iridescence?: number;
  readonly vertexColors?: boolean;
  readonly color?: THREE.ColorRepresentation;
  readonly side?: THREE.Side;
  readonly roughness?: number;
}

/** The uniforms one gelatinous material carries (exposed for tests and tuning). */
export interface GelatinousUniforms {
  readonly gelCore: { value: number };
  readonly gelRim: { value: number };
  readonly gelRimColor: { value: THREE.Color };
  readonly gelRimGlow: { value: number };
  readonly gelOrgans: { value: number };
  readonly gelIridescence: { value: number };
}

/** The fragment code inserted before the final colour is written. */
export const GELATINOUS_GLSL = /* glsl */ `
  float gelFacing = clamp(abs(dot(normalize(normal), normalize(vViewPosition))), 0.0, 1.0);
  float gelEdge = pow(1.0 - gelFacing, 1.6);
  float gelAlpha = mix(gelCore, gelRim, gelEdge);
  #if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA )
    float gelLum = dot(vColor.rgb, vec3(0.3, 0.59, 0.11));
    float gelSat = max(vColor.r, max(vColor.g, vColor.b)) - min(vColor.r, min(vColor.g, vColor.b));
    gelAlpha = max(gelAlpha, clamp(1.0 - gelLum * 1.6, 0.0, 1.0) * gelOrgans);
    vec3 gelRainbow = 0.5 + 0.5 * cos(6.2831853 * (gelEdge * 1.4 + gelFacing * 0.35 + vec3(0.0, 0.33, 0.67)));
    float gelShimmer = smoothstep(0.12, 0.35, gelSat) * gelIridescence;
    outgoingLight = mix(outgoingLight, outgoingLight * 0.55 + gelRainbow * 0.35, gelShimmer);
    gelAlpha = mix(gelAlpha, max(gelAlpha, 0.85), gelShimmer);
  #endif
  diffuseColor.a *= gelAlpha;
  outgoingLight += gelRimColor * gelEdge * gelRimGlow;
`;

/** A clone-safe gelatinous `MeshStandardMaterial` (its `copy` carries the effect and values). */
export class GelatinousMaterial extends THREE.MeshStandardMaterial {
  readonly gel: GelatinousUniforms = {
    gelCore: { value: 0.2 },
    gelRim: { value: 0.75 },
    gelRimColor: { value: new THREE.Color(0xffffff) },
    gelRimGlow: { value: 0 },
    gelOrgans: { value: 0 },
    gelIridescence: { value: 0 },
  };
  constructor(options?: GelatinousOptions) {
    super({
      vertexColors: options?.vertexColors ?? true,
      color: options?.color ?? 0xffffff,
      roughness: options?.roughness ?? 0.12,
      metalness: 0,
      transparent: true,
      depthWrite: false,
      side: options?.side ?? THREE.FrontSide,
    });
    if (options) {
      this.name = options.name;
      this.gel.gelCore.value = options.core;
      this.gel.gelRim.value = options.rim;
      this.gel.gelRimColor.value.set(options.rimColor);
      this.gel.gelRimGlow.value = options.rimGlow;
      this.gel.gelOrgans.value = options.organs ?? 0;
      this.gel.gelIridescence.value = options.iridescence ?? 0;
    }
  }
  override onBeforeCompile(
    shader: THREE.WebGLProgramParametersWithUniforms,
  ): void {
    Object.assign(shader.uniforms, this.gel);
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
uniform float gelCore; uniform float gelRim; uniform vec3 gelRimColor; uniform float gelRimGlow;
uniform float gelOrgans; uniform float gelIridescence;`,
      )
      .replace(
        '#include <opaque_fragment>',
        `${GELATINOUS_GLSL}\n#include <opaque_fragment>`,
      );
  }
  override customProgramCacheKey(): string {
    return 'cozy-gelatinous-v1';
  }
  override copy(source: GelatinousMaterial): this {
    super.copy(source);
    if (source.gel) {
      this.gel.gelCore.value = source.gel.gelCore.value;
      this.gel.gelRim.value = source.gel.gelRim.value;
      this.gel.gelRimColor.value.copy(source.gel.gelRimColor.value);
      this.gel.gelRimGlow.value = source.gel.gelRimGlow.value;
      this.gel.gelOrgans.value = source.gel.gelOrgans.value;
      this.gel.gelIridescence.value = source.gel.gelIridescence.value;
    }
    return this;
  }
}

export function gelatinousMaterial(
  options: GelatinousOptions,
): GelatinousMaterial {
  return new GelatinousMaterial(options);
}

/** V0.7 Pass 078: the tuned settings for each gelatinous animal, shared by every place it is drawn. */
export const GELATINOUS_PRESETS = {
  combJelly: {
    name: 'Comb jellies',
    core: 0.14,
    rim: 0.7,
    rimColor: 0xbfefff,
    rimGlow: 0.3,
    organs: 0.4,
    iridescence: 0.9,
  },
  salp: {
    name: 'Salps',
    core: 0.1,
    rim: 0.62,
    rimColor: 0x9fd6e0,
    rimGlow: 0.28,
    organs: 0.85,
  },
  jellyfish: {
    name: 'Jellyfish',
    core: 0.16,
    rim: 0.72,
    rimColor: 0xffb898,
    rimGlow: 0.3,
    organs: 0.45,
    side: THREE.DoubleSide,
    roughness: 0.2,
  },
  seaSquirt: {
    name: 'Sea squirts',
    core: 0.3,
    rim: 0.85,
    rimColor: 0xd8f0f4,
    rimGlow: 0.18,
    organs: 0.5,
  },
} as const satisfies Record<string, GelatinousOptions>;
