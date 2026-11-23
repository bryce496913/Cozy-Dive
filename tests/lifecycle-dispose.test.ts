import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { AssetLoader } from '../src/assets/AssetLoader';
import { CaveVisitors } from '../src/environment/cave/CaveVisitors';
import { caveNooks } from '../src/environment/cave/CaveNooks';
import { RestingSharks } from '../src/environment/cave/RestingSharks';
import { CAVE_LIFE } from '../src/environment/cave/CaveLife';
import { KelpVisitors } from '../src/environment/kelp/KelpVisitors';
import { IceLife } from '../src/environment/ice/IceLife';
import { IceRare } from '../src/environment/ice/IceRare';
import { iceLimits } from '../src/creatures/iceLife';
import { SeaLion } from '../src/environment/kelp/SeaLion';
import { BarracudaSchool } from '../src/environment/outer/BarracudaSchool';
import { ReefLife } from '../src/environment/outer/ReefLife';
import { WorldPreparation } from '../src/rendering/WorldPreparation';
import { noWait, Staging } from '../src/rendering/StagedBuild';
import { creatureFixture } from './fixtures/assetFixture';

/** A loader whose every model arrives only once `open` is called. */
function gated() {
  let open = (): void => undefined;
  const gate = new Promise<void>((resolve) => {
    open = resolve;
  });
  const loader = new AssetLoader(async (url) => {
    await gate;
    return creatureFixture(url);
  });
  return { loader, open };
}
interface Part {
  readonly root: THREE.Group;
  readonly ready: Promise<boolean>;
  dispose(): void;
}
const flat = () => 0;
const parts: [string, (l: AssetLoader) => Part][] = [
  ['outer reef life', (l) => new ReefLife(l, [], () => 0)],
  ['barracuda', (l) => new BarracudaSchool(l)],
  [
    'kelp visitors',
    (l) => new KelpVisitors(l, [], [], [{ x: 0, y: 0.3, z: -30 }], flat),
  ],
  [
    'sea lion',
    (l) =>
      new SeaLion(
        { ground: flat, top: 18, minX: -20, maxX: 20, minZ: -55, maxZ: -12 },
        l,
      ),
  ],
  ['cave visitors', (l) => new CaveVisitors(l, caveNooks(14))],
  ['resting sharks', (l) => new RestingSharks(CAVE_LIFE.resting, l)],
  // v0.6 Pass 047
  [
    'under-ice life',
    (l) => new IceLife(l, () => 0, [{ x: -5, y: 0, z: -30, size: 1 }]),
  ],
  // v0.6 Pass 048
  [
    'under-ice rare encounters',
    (l) =>
      new IceRare(
        l,
        iceLimits(() => 0),
        [],
      ),
  ],
];

describe('v0.6 Pass 046 review: let go while still loading', () => {
  for (const [name, make] of parts)
    it(`${name}: nothing is added, and every model is released, when its models arrive late`, async () => {
      const { loader, open } = gated(),
        part = make(loader);
      part.dispose();
      open();
      expect(await part.ready).toBe(false);
      // Give any stray continuation a chance to run.
      await new Promise((r) => setTimeout(r, 0));
      expect(part.root.children).toHaveLength(0);
      expect(part.root.parent).toBeNull();
      expect(loader.leased).toBe(0);
      loader.dispose();
    });
  for (const [name, make] of parts)
    it(`${name}: loads normally, and releases everything when let go after`, async () => {
      const { loader, open } = gated(),
        part = make(loader);
      open();
      expect(await part.ready).toBe(true);
      expect(loader.leased).toBeGreaterThan(0);
      part.dispose();
      expect(loader.leased).toBe(0);
      loader.dispose();
    });
});

describe('v0.6 Pass 046 review: a world’s preparation state', () => {
  it('is ready when every part loads, partial when some fail', async () => {
    const all = new WorldPreparation();
    await Promise.all([
      all.track('a', Promise.resolve(true)),
      all.track('b', Promise.resolve(true)),
    ]);
    all.settle();
    expect(all.state).toBe('ready');
    const some = new WorldPreparation();
    await Promise.all([
      some.track('a', Promise.resolve(true)),
      some.track('b', Promise.resolve(false)),
      some.track('c', Promise.reject(Error('no'))),
    ]);
    some.settle();
    expect(some.state).toBe('partial');
    expect(some.has('a')).toBe(true);
    expect(some.has('b')).toBe(false);
    expect(some.summary).toEqual({ a: 'ready', b: 'failed', c: 'failed' });
  });
  it('stays disposed: nothing that finishes later changes it', async () => {
    const p = new WorldPreparation();
    let finish: (ok: boolean) => void = () => undefined;
    const late = p.track('late', new Promise<boolean>((r) => (finish = r)));
    p.dispose();
    finish(true);
    expect(await late).toBe(false);
    p.settle();
    p.fail();
    expect(p.state).toBe('disposed');
    expect(p.has('late')).toBe(false);
  });
  it('can fail outright', () => {
    const p = new WorldPreparation();
    p.fail();
    expect(p.state).toBe('failed');
  });
});

describe('v0.6 Pass 046 review: scenes let go while their life is still loading', () => {
  /**
   * A renderer that is never drawn with: these scenes only touch the renderer once their life has
   * loaded (to compile it) or when rendered, and here they are let go before either. The double
   * cast is that stand-in's only purpose.
   */
  const renderer = {} as unknown as THREE.WebGLRenderer;
  const built = <T>(scene: T | undefined): T => {
    if (!scene) throw Error('not built');
    return scene;
  };
  const scenes: [
    string,
    (l: AssetLoader) => Promise<{
      dispose(): void;
      prepared: Promise<boolean>;
      scene: THREE.Scene;
      preparation: WorldPreparation;
    }>,
  ][] = [
    [
      'kelp forest',
      async (l) =>
        built(
          await (
            await import('../src/rendering/KelpForestScene')
          ).KelpForestScene.build(
            renderer,
            // The geology too is still loading: the forest builds with code rock, and the late
            // geology lease is released.
            { fish: l, soundSpots: 2, geologyWaitMs: 0 },
            noWait,
          ),
        ),
    ],
    [
      'sea cave',
      async (l) =>
        built(
          await (
            await import('../src/rendering/SeaCaveScene')
          ).SeaCaveScene.build(
            renderer,
            { fish: l, soundSpots: 2, geologyWaitMs: 0 },
            noWait,
          ),
        ),
    ],
    [
      'under the ice',
      async (l) =>
        built(
          await (
            await import('../src/rendering/UnderIceScene')
          ).UnderIceScene.build(renderer, { fish: l, soundSpots: 2 }, noWait),
        ),
    ],
  ];
  for (const [name, make] of scenes)
    it(`${name}: is emptied and stays disposed; late models change nothing and are released`, async () => {
      const { loader, open } = gated(),
        world = await make(loader);
      world.dispose();
      open();
      // (A world with nothing to load may already have finished preparing; either way it is gone.)
      await world.prepared;
      await new Promise((r) => setTimeout(r, 0));
      expect(world.scene.children).toHaveLength(0);
      expect(world.preparation.state).toBe('disposed');
      expect(loader.leased).toBe(0);
      loader.dispose();
    });
});

describe('v0.6 Pass 046 review: building a world a piece per frame', () => {
  const renderer = {} as unknown as THREE.WebGLRenderer;
  it('builds each piece in its own frame, timing each, and stops (disposing what it built) if let go', async () => {
    const loader = new AssetLoader(() => new Promise(() => undefined));
    let frames = 0;
    const counted = () => {
      frames++;
      return Promise.resolve();
    };
    const { UnderIceScene } = await import('../src/rendering/UnderIceScene');
    const scene = await UnderIceScene.build(
      renderer,
      { fish: loader, soundSpots: 2 },
      counted,
    );
    expect(scene).toBeDefined();
    expect(frames).toBeGreaterThanOrEqual(3);
    expect(Object.keys(scene!.buildStats!.pieces)).toEqual([
      'ice and rock',
      'garden',
      // v0.6 Pass 052: the extra detail and drifting life.
      'detail',
      'scene',
    ]);
    expect(scene!.buildStats!.longest).toBeLessThanOrEqual(
      scene!.buildStats!.total,
    );
    scene!.dispose();
    // Let go after its first piece: nothing is handed over.
    let pieces = 0;
    const stop = await UnderIceScene.build(
      renderer,
      { fish: loader, soundSpots: 2 },
      noWait,
      () => pieces++ < 1,
    );
    expect(stop).toBeUndefined();
    loader.dispose();
  });
  it('a staging that is let go disposes what it has built', async () => {
    let disposed = 0,
      wanted = true;
    const stage = new Staging(noWait, () => wanted);
    await stage.step('a', () => ({ dispose: () => disposed++ }));
    wanted = false;
    await expect(
      stage.step('b', () => ({ dispose: () => disposed++ })),
    ).rejects.toBe(Staging.cancelled);
    expect(disposed).toBe(1);
  });
});
