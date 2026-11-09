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
#ifdef USE_MAP
  diffuseColor *= triSample(map, triP, triW);
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
  normal = normalize((viewMatrix * vec4(triWorldNormal, 0.0)).xyz);
#endif
`;

export interface TriplanarOptions {
  /** Texture repeats per world unit. */
  readonly scale: number;
  /** How strongly the ORM red channel darkens diffuse colour. */
  readonly ao?: number;
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
  };
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
  material.customProgramCacheKey = () => 'cozy-triplanar-v1';
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
