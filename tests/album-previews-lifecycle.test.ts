import * as THREE from 'three';
import { afterEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({
  acquire: vi.fn(),
  rendererDispose: vi.fn(),
  contextLoss: vi.fn(),
}));
vi.mock('../src/environment/TankCollectionArt', () => ({
  acquireCollectionArt: mocks.acquire,
}));
vi.mock('three', async (original) => {
  const actual = await original<typeof import('three')>();
  return {
    ...actual,
    WebGLRenderer: class {
      info = { memory: { geometries: 0, textures: 0 } };
      domElement = {};
      setPixelRatio() {}
      setClearColor() {}
      setSize() {}
      getSize(v: THREE.Vector2) {
        return v.set(200, 140);
      }
      render() {}
      dispose = mocks.rendererDispose;
      forceContextLoss = mocks.contextLoss;
    },
  };
});
import { AlbumPreviews } from '../src/collection/AlbumPreviews';
import { collectionEntry } from '../src/collection/registry';
const entry = collectionEntry('species:sea-angel')!;
const canvas = () =>
  ({
    width: 200,
    height: 140,
    getContext: () => ({ clearRect() {}, drawImage() {} }),
  }) as unknown as HTMLCanvasElement;
const loader = { acquire: vi.fn(), evictUnused: vi.fn() };
function art() {
  const model = new THREE.Group(),
    near = new THREE.Group(),
    far = new THREE.Group();
  model.add(near, far);
  return { model, near, far, dispose: vi.fn(), update: vi.fn() };
}
const flush = () => new Promise<void>((r) => setTimeout(r, 0));
afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});
describe('album preview lifecycle', () => {
  it('never duplicates an in-flight slot, releases stale/late loads and bounds concurrency', async () => {
    const pending: ((value: ReturnType<typeof art>) => void)[] = [];
    mocks.acquire.mockImplementation(() => new Promise((r) => pending.push(r)));
    const previews = new AlbumPreviews(
      { creatures: loader, reef: loader },
      canvas(),
    );
    const cards = [
      { canvas: canvas(), entry },
      { canvas: canvas(), entry },
    ];
    previews.show(cards);
    previews.show(cards);
    previews.show(cards);
    expect(mocks.acquire).toHaveBeenCalledTimes(2);
    const first = art(),
      second = art();
    pending[0](first);
    pending[1](second);
    await flush();
    expect(previews.loaded).toBe(2);
    previews.show([{ canvas: canvas(), entry }]);
    expect(first.dispose).toHaveBeenCalledOnce();
    expect(second.dispose).toHaveBeenCalledOnce();
    const late = art();
    previews.dispose();
    previews.dispose();
    pending[2](late);
    await flush();
    expect(late.dispose).toHaveBeenCalledOnce();
    expect(previews.loaded).toBe(0);
    expect(mocks.rendererDispose).toHaveBeenCalledOnce();
    expect(mocks.contextLoss).toHaveBeenCalledOnce();
  });
  it('animates only intersecting card canvases, and releases the observer', async () => {
    let notify!: (
      entries: { target: HTMLCanvasElement; isIntersecting: boolean }[],
    ) => void;
    const disconnect = vi.fn();
    vi.stubGlobal(
      'IntersectionObserver',
      class {
        constructor(cb: typeof notify) {
          notify = cb;
        }
        observe() {}
        unobserve() {}
        disconnect = disconnect;
      },
    );
    const a = art();
    mocks.acquire.mockResolvedValue(a);
    const c = canvas(),
      previews = new AlbumPreviews(
        { creatures: loader, reef: loader },
        canvas(),
      );
    previews.show([{ canvas: c, entry }]);
    await flush();
    previews.frame(1, false);
    expect(a.update).not.toHaveBeenCalled();
    notify([{ target: c, isIntersecting: true }]);
    previews.frame(2, false);
    expect(a.update).toHaveBeenCalledOnce();
    notify([{ target: c, isIntersecting: false }]);
    previews.frame(3, false);
    expect(a.update).toHaveBeenCalledOnce();
    previews.dispose();
    expect(disconnect).toHaveBeenCalledOnce();
  });
});
