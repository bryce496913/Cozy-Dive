import * as THREE from 'three';

/**
 * v0.3 Pass 020: deterministic procedural textures for the office, generated in code as
 * DataTextures (no canvas, no files), so the room builds identically in tests and browsers.
 */

/** Hash-based value noise in [0, 1]. */
function hash(x: number, y: number, seed: number): number {
  const v = Math.sin(x * 127.1 + y * 311.7 + seed * 74.7) * 43758.5453;
  return v - Math.floor(v);
}
function noise(x: number, y: number, seed: number): number {
  const ix = Math.floor(x),
    iy = Math.floor(y),
    fx = x - ix,
    fy = y - iy,
    sx = fx * fx * (3 - 2 * fx),
    sy = fy * fy * (3 - 2 * fy);
  const a = hash(ix, iy, seed),
    b = hash(ix + 1, iy, seed),
    c = hash(ix, iy + 1, seed),
    d = hash(ix + 1, iy + 1, seed);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}
/** Fractal noise, periodic over `period` cells so textures tile. */
function fbm(x: number, y: number, seed: number, octaves = 4): number {
  let sum = 0,
    amp = 0.5,
    f = 1;
  for (let o = 0; o < octaves; o++) {
    sum += amp * noise(x * f, y * f, seed + o * 13);
    amp *= 0.5;
    f *= 2;
  }
  return sum / (1 - 0.5 ** octaves);
}
type Shader = (u: number, v: number) => readonly [number, number, number];
function texture(
  size: number,
  shade: Shader,
  options: { repeat?: boolean; srgb?: boolean } = {},
): THREE.DataTexture {
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const [r, g, b] = shade(x / size, y / size),
        i = (y * size + x) * 4;
      data[i] = Math.max(0, Math.min(255, Math.round(r * 255)));
      data[i + 1] = Math.max(0, Math.min(255, Math.round(g * 255)));
      data[i + 2] = Math.max(0, Math.min(255, Math.round(b * 255)));
      data[i + 3] = 255;
    }
  const t = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  if (options.repeat !== false) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace =
    options.srgb === false ? THREE.NoColorSpace : THREE.SRGBColorSpace;
  t.generateMipmaps = true;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.magFilter = THREE.LinearFilter;
  t.anisotropy = 4;
  t.needsUpdate = true;
  return t;
}
const mix = (a: number, b: number, t: number) => a + (b - a) * t;

/** Fine straight-grained wood (tinted per object by vertex colour). */
export function woodTexture(seed = 3): THREE.DataTexture {
  return texture(256, (u, v) => {
    const warp = fbm(u * 3, v * 24, seed) * 2.2,
      grain = 0.5 + 0.5 * Math.sin((u * 18 + warp) * Math.PI * 2),
      fine = fbm(u * 64, v * 6, seed + 5),
      k = 0.82 + 0.12 * grain + 0.08 * (fine - 0.5);
    return [k, k * 0.97, k * 0.93];
  });
}
/** Warm oak floorboards: staggered planks with seams, per-board tone and grain. */
export function floorTexture(): THREE.DataTexture {
  return texture(512, (u, v) => {
    const rows = 6,
      row = Math.floor(v * rows),
      offset = hash(row, 0, 41) * 0.7,
      along = (u + offset) % 1,
      board = Math.floor(along * 2),
      id = row * 7 + board,
      tone = 0.86 + 0.14 * hash(id, 3, 17),
      across = (v * rows) % 1,
      seamV = Math.min(across, 1 - across),
      seamU = Math.min((along * 2) % 1, 1 - ((along * 2) % 1)),
      seam = Math.min(1, Math.min(seamV * 60, seamU * 140)),
      warp = fbm(along * 2 + id, across * 3, 7) * 1.5,
      grain = 0.5 + 0.5 * Math.sin((across * 9 + warp + id) * Math.PI * 2),
      k = tone * (0.9 + 0.1 * grain) * (0.55 + 0.45 * seam);
    return [0.78 * k, 0.56 * k, 0.36 * k];
  });
}
/** Soft warm plaster with faint trowel variation. */
export function plasterTexture(): THREE.DataTexture {
  return texture(256, (u, v) => {
    const n = fbm(u * 8, v * 8, 23) * 0.06 + fbm(u * 40, v * 40, 29) * 0.03;
    const k = 0.93 + n;
    return [0.96 * k, 0.9 * k, 0.8 * k];
  });
}
/** A woven wool rug: muted border bands around a soft field. */
export function rugTexture(): THREE.DataTexture {
  return texture(
    256,
    (u, v) => {
      const edge = Math.min(u, v, 1 - u, 1 - v),
        band =
          edge < 0.06
            ? 0
            : edge < 0.1
              ? 1
              : edge < 0.13
                ? 2
                : edge < 0.16
                  ? 1
                  : 3,
        weave =
          0.92 +
          0.08 *
            (0.5 + 0.5 * Math.sin(u * 400) * Math.sin(v * 400)) *
            fbm(u * 30, v * 30, 31),
        diamond =
          band === 3
            ? 0.5 + 0.5 * Math.cos((Math.abs(u - 0.5) + Math.abs(v - 0.5)) * 40)
            : 0;
      const base: [number, number, number] =
        band === 0
          ? [0.45, 0.33, 0.27]
          : band === 1
            ? [0.82, 0.74, 0.6]
            : band === 2
              ? [0.36, 0.47, 0.46]
              : [
                  mix(0.62, 0.55, diamond),
                  mix(0.43, 0.48, diamond),
                  mix(0.35, 0.44, diamond),
                ];
      return [base[0] * weave, base[1] * weave, base[2] * weave];
    },
    { repeat: false },
  );
}
/** Clock face: cream dial, twelve hour bars and fine minute ticks. */
export function clockTexture(): THREE.DataTexture {
  return texture(
    256,
    (u, v) => {
      const x = u - 0.5,
        y = v - 0.5,
        r = Math.hypot(x, y),
        a = Math.atan2(y, x),
        hour = Math.abs((((a / (Math.PI * 2)) * 12 + 12) % 1) - 0.5) > 0.47,
        minute = Math.abs((((a / (Math.PI * 2)) * 60 + 60) % 1) - 0.5) > 0.44;
      let k = 0.94 - 0.05 * r;
      if (r > 0.36 && r < 0.43 && hour) k = 0.18;
      else if (r > 0.4 && r < 0.43 && minute) k = 0.35;
      if (r > 0.47) k = 0.25;
      return [k, k * 0.97, k * 0.9];
    },
    { repeat: false },
  );
}
/** A calm framed print: layered sea and sky in soft blues and sand. */
export function artTexture(): THREE.DataTexture {
  return texture(
    256,
    (u, v) => {
      const wave = 0.5 + 0.06 * Math.sin(u * 9 + fbm(u * 3, v, 51) * 3),
        sea = v < wave,
        depth = sea ? v / wave : (v - wave) / (1 - wave),
        sun = Math.exp(-((u - 0.68) ** 2 + (v - 0.74) ** 2) * 140),
        paper = 0.97 + 0.03 * fbm(u * 50, v * 50, 53);
      const c: [number, number, number] = sea
        ? [
            mix(0.16, 0.38, depth),
            mix(0.36, 0.6, depth),
            mix(0.44, 0.66, depth),
          ]
        : [
            mix(0.86, 0.72, depth),
            mix(0.8, 0.82, depth),
            mix(0.7, 0.86, depth),
          ];
      return [
        (c[0] + sun * 0.3) * paper,
        (c[1] + sun * 0.25) * paper,
        (c[2] + sun * 0.12) * paper,
      ];
    },
    { repeat: false },
  );
}
/** The rainy garden beyond the window: overcast sky over soft layered trees and a hedge. */
export function gardenTexture(): THREE.DataTexture {
  return texture(
    256,
    (u, v) => {
      const sky: [number, number, number] = [
          mix(0.64, 0.78, v),
          mix(0.7, 0.83, v),
          mix(0.74, 0.86, v),
        ],
        far = 0.42 + 0.1 * fbm(u * 4, 0, 61),
        near = 0.3 + 0.16 * fbm(u * 7, 0, 67),
        hedge = 0.14 + 0.03 * Math.sin(u * 40);
      let c = sky;
      if (v < far) {
        const t = 0.6 + 0.2 * fbm(u * 20, v * 20, 71);
        c = [0.42 * t, 0.52 * t, 0.46 * t];
      }
      if (v < near) {
        const t = 0.6 + 0.25 * fbm(u * 26, v * 26, 73);
        c = [0.28 * t, 0.4 * t, 0.3 * t];
      }
      if (v < hedge) {
        const t = 0.7 + 0.2 * fbm(u * 50, v * 50, 79);
        c = [0.2 * t, 0.3 * t, 0.2 * t];
      }
      // Rain haze lifts everything towards the sky colour.
      return [
        mix(c[0], 0.7, 0.35),
        mix(c[1], 0.76, 0.35),
        mix(c[2], 0.8, 0.35),
      ];
    },
    { repeat: false },
  );
}
