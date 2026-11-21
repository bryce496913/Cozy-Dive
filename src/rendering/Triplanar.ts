import * as THREE from 'three';

/**
 * World-space triplanar sampling for authored reef materials.
 *
 * Reef rocks are reused at non-uniform instance scales; planar UVs would stretch or seam.
 * This keeps the authored map/normal/ORM set, but samples it from world position with a
 * whiteout normal blend. No extra textures or render passes are introduced.
 */
const VERTEX_PARS = `
varying vec3 vTriWorldPosition;
varying vec3 vTriWorldNormal;
`;
const VERTEX_MAIN = `
#ifdef USE_INSTANCING
  mat4 triModel = modelMatrix * instanceMatrix;
#else
  mat4 triModel = modelMatrix;
#endif
vTriWorldPosition = (triModel * vec4(transformed, 1.0)).xyz;
vTriWorldNormal = normalize(inverse(transpose(mat3(triModel))) * objectNormal);
`;
const FRAGMENT_PARS = `
uniform float triplanarScale;
uniform float triplanarAo;
#ifdef TRI_RIDGES
uniform float triRidgeFrequency;
uniform float triRidgeDepth;
/**
 * Brain-coral meanders (0 in a groove … 1 on a ridge) from world position: winding parallel
 * ridges with narrow grooves between, as on Platygyra and the like.
 */
float triRidge(vec3 p) {
  vec3 q = p + 0.6 * vec3(sin(p.y * 1.7 + p.z * 0.9), sin(p.z * 1.5 + p.x * 1.1), sin(p.x * 1.3 + p.y * 1.6));
  float v = sin(q.x + q.y * 0.8) + sin(q.y * 0.9 - q.z * 1.1) + sin(q.z * 1.2 + q.x * 0.7);
  // Soft, rounded ridges and grooves.
  return 0.5 + 0.5 * sin(v * 1.6);
}
#endif
varying vec3 vTriWorldPosition;
varying vec3 vTriWorldNormal;
vec3 triWeights(vec3 n) {
  vec3 w = pow(abs(n), vec3(4.0));
  return w / max(w.x + w.y + w.z, 1e-5);
}
vec4 triSample(sampler2D t, vec3 p, vec3 w) {
  return texture2D(t, p.zy) * w.x + texture2D(t, p.xz) * w.y + texture2D(t, p.xy) * w.z;
}
`;
const MAP = `
vec3 triP = vTriWorldPosition * triplanarScale;
vec3 triN = normalize(vTriWorldNormal);
vec3 triW = triWeights(triN);
#ifdef TRI_RIDGES
  float triH = triRidge(vTriWorldPosition * triRidgeFrequency);
  // The grooves lie in shade.
  diffuseColor.rgb *= mix(0.72, 1.06, triH);
#endif
#ifdef USE_MAP
  #ifdef TRI_BREAKUP
    // V0.7 Pass 079: break up tiling on wide floors at no extra geometry. The top projection is
    // blended with a second, rotated sample at about a third of the scale through a slow,
    // irregular mask, and a broad tonal drift (several metres across) varies the sand's value.
    vec2 triTop = vTriWorldPosition.xz;
    float triMask = 0.5 + 0.5 * sin(triTop.x * 0.37 + sin(triTop.y * 0.29) * 1.7) * sin(triTop.y * 0.31 - sin(triTop.x * 0.23) * 1.9);
    vec2 triRot = mat2(0.799, -0.602, 0.602, 0.799) * triTop * triplanarScale * 0.37 + vec2(0.31, 0.73);
    vec4 triBase = triSample(map, triP, triW);
    vec4 triWide = texture2D(map, triRot);
    diffuseColor *= mix(triBase, mix(triBase, triWide, smoothstep(0.25, 0.75, triMask)), triW.y);
    float triDrift = sin(triTop.x * 0.11 + 1.3) * sin(triTop.y * 0.13 - 0.7) + 0.5 * sin(triTop.x * 0.27 - triTop.y * 0.19);
    diffuseColor.rgb *= 1.0 + 0.07 * triDrift * triW.y;
  #else
    diffuseColor *= triSample(map, triP, triW);
  #endif
#endif
#ifdef USE_ROUGHNESSMAP
  diffuseColor.rgb *= mix(1.0, triSample(roughnessMap, triP, triW).r, triplanarAo);
#endif
`;
const ROUGHNESS = `
float roughnessFactor = roughness;
#ifdef USE_ROUGHNESSMAP
  roughnessFactor *= triSample(roughnessMap, triP, triW).g;
#endif
`;
const NORMAL = `
#ifdef USE_NORMALMAP
  vec3 tnX = texture2D(normalMap, triP.zy).xyz * 2.0 - 1.0;
  vec3 tnY = texture2D(normalMap, triP.xz).xyz * 2.0 - 1.0;
  vec3 tnZ = texture2D(normalMap, triP.xy).xyz * 2.0 - 1.0;
  tnX.xy *= normalScale; tnY.xy *= normalScale; tnZ.xy *= normalScale;
  tnX = vec3(tnX.xy + triN.zy, abs(tnX.z) * abs(triN.x));
  tnY = vec3(tnY.xy + triN.xz, abs(tnY.z) * abs(triN.y));
  tnZ = vec3(tnZ.xy + triN.xy, abs(tnZ.z) * abs(triN.z));
  vec3 triSign = sign(triN);
  tnX.z *= triSign.x; tnY.z *= triSign.y; tnZ.z *= triSign.z;
  vec3 triWorldNormal = normalize(tnX.zyx * triW.x + tnY.xzy * triW.y + tnZ.xyz * triW.z);
  // Match MeshStandardMaterial's sidedness when a surface is viewed from inside a habitat.
  #ifdef FLIP_SIDED
    triWorldNormal = -triWorldNormal;
  #endif
  #ifdef DOUBLE_SIDED
    triWorldNormal *= gl_FrontFacing ? 1.0 : -1.0;
  #endif
  normal = normalize((viewMatrix * vec4(triWorldNormal, 0.0)).xyz);
#endif
#ifdef TRI_RIDGES
  // Bump the ridges into the lighting (screen-space derivatives, as three.js's bump map does), so
  // a light, smooth model reads as finely ridged at every distance.
  {
    vec2 dH = vec2(dFdx(triH), dFdy(triH)) * triRidgeDepth;
    vec3 sigX = dFdx(-vViewPosition), sigY = dFdy(-vViewPosition);
    vec3 r1 = cross(sigY, normal), r2 = cross(normal, sigX);
    float det = dot(sigX, r1);
    normal = normalize(abs(det) * normal - sign(det) * (dH.x * r1 + dH.y * r2));
  }
#endif
`;

export interface TriplanarOptions {
  /** Texture repeats per world unit. */
  readonly scale: number;
  /** How strongly the ORM red channel darkens diffuse colour. */
  readonly ao?: number;
  /**
   * Playtest (no detail popping): brain-coral ridges drawn in the shading, at this many cycles
   * per metre and this relief (m), so the light model carries the full model's look everywhere.
   */
  readonly ridges?: { readonly frequency: number; readonly depth: number };
  /** V0.7 Pass 079: large-scale variation on upward faces, to hide a floor texture's tiling. */
  readonly breakup?: boolean;
}

/** Returns a material clone whose authored maps are sampled triplanarly in world space. */
export function triplanarMaterial(
  source: THREE.MeshStandardMaterial,
  options: TriplanarOptions,
): THREE.MeshStandardMaterial {
  const material = source.clone();
  const uniforms = {
    triplanarScale: { value: options.scale },
    triplanarAo: { value: options.ao ?? 0.6 },
    triRidgeFrequency: { value: options.ridges?.frequency ?? 0 },
    triRidgeDepth: { value: options.ridges?.depth ?? 0 },
  };
  if (options.ridges)
    material.defines = { ...material.defines, TRI_RIDGES: '' };
  if (options.breakup)
    material.defines = { ...material.defines, TRI_BREAKUP: '' };
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${VERTEX_PARS}`)
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>\n${VERTEX_MAIN}`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${FRAGMENT_PARS}`)
      .replace('#include <map_fragment>', MAP)
      .replace('#include <roughnessmap_fragment>', ROUGHNESS)
      .replace('#include <normal_fragment_maps>', NORMAL);
  };
  // Scale and occlusion are uniforms: every triplanar material shares one compiled program.
  material.customProgramCacheKey = () =>
    options.ridges
      ? 'cozy-triplanar-ridged-v1'
      : options.breakup
        ? 'cozy-triplanar-breakup-v1'
        : 'cozy-triplanar-v2';
  return material;
}

/** CPU mirror of the GLSL blend weights, used by tests and tooling. */
export function triplanarWeights(
  n: Readonly<{ x: number; y: number; z: number }>,
): [number, number, number] {
  const x = Math.abs(n.x) ** 4,
    y = Math.abs(n.y) ** 4,
    z = Math.abs(n.z) ** 4,
    sum = Math.max(x + y + z, 1e-5);
  return [x / sum, y / sum, z / sum];
}
