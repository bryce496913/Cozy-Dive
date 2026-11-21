import * as THREE from 'three';
import { triplanarMaterial } from '../../rendering/Triplanar';

export type SurfaceKind = 'limestone' | 'sediment' | 'ice';
/** Seamless local PBR relief: pores/strata, current-combed grains, or trapped ice veins.
 * World-space sampling keeps the detail continuous over merged rocks and tunnel mouths.
 */
export class HabitatSurface {
  private readonly maps: THREE.DataTexture[] = [];
  private disposed = false;
  constructor(readonly kind: SurfaceKind) {
    // V0.7 Pass 070: 256 px, so the varied sediment field keeps its grain.
    const n = 256,
      heights = new Float32Array(n * n),
      color = new Uint8Array(n * n * 4),
      normal = new Uint8Array(n * n * 4),
      orm = new Uint8Array(n * n * 4);
    for (let y = 0; y < n; y++)
      for (let x = 0; x < n; x++) {
        const u = (x / n) * Math.PI * 2,
          v = (y / n) * Math.PI * 2;
        const grain =
          Math.sin(u * 23 + Math.sin(v * 7)) *
          Math.cos(v * 29 + Math.sin(u * 5));
        const strata = Math.sin(
          v * 3 + 0.6 * Math.sin(u * 2) + 0.18 * Math.sin(u * 9),
        );
        const vein = Math.exp(
          -Math.abs(Math.sin(u * 2 + v + 0.8 * Math.sin(v * 3))) * 32,
        );
        // A repeatable per-texel hash (tiles exactly: it depends only on the texel).
        const hash =
          (((Math.sin(x * 127.1 + y * 311.7) * 43758.5453) % 1) + 1) % 1;
        // V0.7 Pass 070: natural current ripples instead of 14 identical straight stripes per tile.
        // Integer frequencies keep the tile seamless; within it the ripples wander, fork,
        // vary in height and lean (a steeper lee side), with a faint cross-ripple and grain.
        const phase =
          v * 11 +
          1.3 * Math.sin(u * 2 + 0.7 * Math.sin(v * 3)) +
          0.9 * Math.sin(u * 3 - v * 2) +
          0.6 * Math.sin(u + v * 5);
        const crest =
          0.6 + 0.4 * Math.sin(u * 3 + v * 2 + 1.1 * Math.sin(u * 5));
        const ripple =
          (Math.sin(phase) + 0.32 * Math.sin(2 * phase - 0.8)) * crest;
        const h =
          kind === 'sediment'
            ? 0.16 * ripple +
              0.03 * Math.sin(u * 17 + v * 5) +
              grain * 0.05 +
              (hash - 0.5) * 0.05
            : kind === 'ice'
              ? vein * 0.6 + grain * 0.025
              : strata * 0.15 + grain * 0.14;
        heights[y * n + x] = h;
        // Sediment: shell grit flecks (pale) and dark grains scattered through the sand.
        const fleck =
          kind === 'sediment'
            ? hash > 0.985
              ? 0.12
              : hash < 0.02
                ? -0.1
                : 0
            : 0;
        const k = kind === 'ice' ? 0.94 - vein * 0.18 : 0.87 + h * 0.18 + fleck,
          i = (y * n + x) * 4;
        color[i] = Math.round(k * 255);
        color[i + 1] = Math.round(
          Math.min(1, k + (kind === 'ice' ? 0.025 : 0)) * 255,
        );
        color[i + 2] = Math.round(
          Math.min(1, k + (kind === 'ice' ? 0.05 : 0)) * 255,
        );
        color[i + 3] = 255;
        orm[i] = Math.round((0.92 - Math.max(0, -h) * 0.15) * 255);
        orm[i + 1] = Math.round(
          (kind === 'ice' ? 0.55 + vein * 0.35 : 0.9 + grain * 0.04) * 255,
        );
        orm[i + 2] = 0;
        orm[i + 3] = 255;
      }
    for (let y = 0; y < n; y++)
      for (let x = 0; x < n; x++) {
        const dx =
            (heights[y * n + ((x + 1) % n)] -
              heights[y * n + ((x + n - 1) % n)]) *
            1.4,
          dy =
            (heights[((y + 1) % n) * n + x] -
              heights[((y + n - 1) % n) * n + x]) *
            1.4,
          l = Math.hypot(dx, dy, 1),
          i = (y * n + x) * 4;
        normal[i] = Math.round((0.5 - (dx / l) * 0.5) * 255);
        normal[i + 1] = Math.round((0.5 - (dy / l) * 0.5) * 255);
        normal[i + 2] = Math.round((0.5 + 0.5 / l) * 255);
        normal[i + 3] = 255;
      }
    for (const data of [color, normal, orm]) {
      const t = new THREE.DataTexture(data, n, n);
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.generateMipmaps = true;
      t.minFilter = THREE.LinearMipmapLinearFilter;
      t.magFilter = THREE.LinearFilter;
      // V0.7 Pass 079 (playtest: moire on tunnel rock at grazing angles): anisotropic filtering
      // (three clamps it to what the device supports).
      t.anisotropy = 8;
      t.needsUpdate = true;
      this.maps.push(t);
    }
    this.maps[0].colorSpace = THREE.SRGBColorSpace;
  }
  material(
    options: THREE.MeshStandardMaterialParameters,
    scale = 0.7,
  ): THREE.MeshStandardMaterial {
    const source = new THREE.MeshStandardMaterial({
      ...options,
      map: this.maps[0],
      normalMap: this.maps[1],
      roughnessMap: this.maps[2],
    });
    source.normalScale.setScalar(
      this.kind === 'ice' ? 0.35 : this.kind === 'sediment' ? 0.5 : 0.65,
    );
    const result = triplanarMaterial(source, {
      scale,
      ao: 0.35,
      // V0.7 Pass 079: sediment floors are wide; break up the tile's repetition.
      breakup: this.kind === 'sediment',
    });
    source.dispose();
    return result;
  }
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    for (const map of this.maps) map.dispose();
  }
}
