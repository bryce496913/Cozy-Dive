import { describe, expect, it, vi } from 'vitest';
import { KTX2Loader } from 'three/addons/loaders/KTX2Loader.js';
import { leaseKtx2, type Ktx2Renderer } from '../src/assets/AssetLoader';

/** Capabilities only: detectSupport reads WebGL extension availability. */
const renderer = (supported: string[]) =>
  ({
    extensions: { has: (name: string) => supported.includes(name) },
  }) as unknown as Ktx2Renderer; // test double: only the extension query is exercised

describe('Pass 018 shared KTX2 loader', () => {
  it('shares one transcoder per renderer and disposes it with the last lease', () => {
    const dispose = vi.spyOn(KTX2Loader.prototype, 'dispose');
    const r = renderer(['EXT_texture_compression_bptc']);
    const a = leaseKtx2(r);
    const b = leaseKtx2(r);
    expect(b.loader).toBe(a.loader);
    a.release();
    a.release(); // idempotent
    expect(dispose).not.toHaveBeenCalled();
    b.release();
    expect(dispose).toHaveBeenCalledTimes(1);
    const c = leaseKtx2(r);
    expect(c.loader).not.toBe(a.loader);
    c.release();
    expect(dispose).toHaveBeenCalledTimes(2);
    dispose.mockRestore();
  });
  it('keeps renderers independent', () => {
    const a = leaseKtx2(renderer([]));
    const b = leaseKtx2(renderer(['WEBGL_compressed_texture_s3tc']));
    expect(a.loader).not.toBe(b.loader);
    a.release();
    b.release();
  });
});
