import * as THREE from 'three';

/** Per-animal leg gait in the existing instanced draw; shells and planted feet stay quiet.
 * Phase and strength are supplied by the animal's behaviour, so resting animals do not skate.
 */
export function benthicGait(
  material: THREE.MeshStandardMaterial,
  width: number,
): void {
  material.onBeforeCompile = (shader) => {
    shader.vertexShader =
      `attribute vec2 legGait;\n${shader.vertexShader}`.replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
      float legWeight = smoothstep(${width.toFixed(3)}, ${(width * 1.8).toFixed(3)}, abs(position.x))
        * (1.0 - smoothstep(0.08, 0.13, position.y));
      float legPhase = legGait.x + position.z * 110.0 + sign(position.x) * 1.5708;
      transformed.y += max(0.0, sin(legPhase)) * 0.018 * legWeight * legGait.y;
      transformed.z += cos(legPhase) * 0.012 * legWeight * legGait.y;`,
      );
  };
  material.customProgramCacheKey = () => `benthic-gait-${width}`;
}
