import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/**
 * v0.6 Pass 035: a soft beam of sunlight through water: nested open cones (seen through, the
 * layers add up most at the beam's middle, so its edges are soft), bright at the top and fading
 * to nothing below. For an additive, vertex-coloured, fog-free material. The beam hangs from its
 * top centre at the origin, pointing down -y (place and tilt its mesh to suit).
 */
export interface BeamShape {
  readonly length: number;
  readonly topRadius: number;
  readonly bottomRadius: number;
  /** Brightness of each layer at the top. */
  readonly intensity: number;
  /** Colour of the light (multiplied by the intensity). */
  readonly tint: readonly [number, number, number];
  /** Fraction of the length over which it fades in below the top (0 = none). */
  readonly topFade?: number;
  readonly layers?: readonly number[];
}

export function beamGeometry(b: BeamShape): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  for (const scale of b.layers ?? [0.5, 0.75, 1]) {
    const g = new THREE.CylinderGeometry(
      b.topRadius * scale,
      b.bottomRadius * scale,
      b.length,
      32,
      10,
      true,
    );
    g.deleteAttribute('uv');
    g.translate(0, -b.length / 2, 0);
    const pos = g.getAttribute('position'),
      colors: number[] = [];
    for (let i = 0; i < pos.count; i++) {
      // t: 1 at the top, 0 at the bottom.
      const t = 1 + pos.getY(i) / b.length,
        fadeIn = b.topFade
          ? Math.min(1, (1 - t) / Math.max(1e-3, b.topFade))
          : 1,
        k =
          b.intensity *
          t *
          t *
          (3 - 2 * t) *
          fadeIn *
          fadeIn *
          (0.75 + 0.25 * Math.sin(i * 1.7 + scale * 5));
      colors.push(k * b.tint[0], k * b.tint[1], k * b.tint[2]);
    }
    g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    parts.push(g);
  }
  const merged = mergeGeometries(parts, false)!;
  parts.forEach((g) => g.dispose());
  return merged;
}

/**
 * The material all beams use: additive vertex colour, unaffected by fog, not writing depth.
 *
 * V0.7 Pass 064: colour is added but destination alpha is left untouched. Standard additive
 * blending also adds alpha, which marks the beam as solid in views rendered into a transparent
 * target (the office's miniature tank keys its background on alpha).
 */
export function beamMaterial(name: string): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({
    name,
    vertexColors: true,
    transparent: true,
    blending: THREE.CustomBlending,
    blendEquation: THREE.AddEquation,
    blendSrc: THREE.SrcAlphaFactor,
    blendDst: THREE.OneFactor,
    blendSrcAlpha: THREE.ZeroFactor,
    blendDstAlpha: THREE.OneFactor,
    depthWrite: false,
    side: THREE.DoubleSide,
    fog: false,
  });
}
