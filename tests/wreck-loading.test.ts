import * as THREE from 'three';
import { afterEach, expect, it, vi } from 'vitest';

const controls = vi.hoisted(() => ({
  failed: 'Barracuda 1',
  delayOnly: '',
  gate: undefined as Promise<void> | undefined,
  bodies: [] as { disposed: boolean; root: THREE.Group }[],
}));
vi.mock('../src/environment/outer/OuterSchools', () => ({
  OuterSchools: class {
    root = new THREE.Group();
    ready = Promise.resolve(true);
    fish = { simulation: { fish: [] } };
    dispose() {}
  },
}));
vi.mock('../src/environment/outer/PosedFish', async (original) => ({
  ...(await original<typeof import('../src/environment/outer/PosedFish')>()),
  PosedFish: class {
    root = new THREE.Group();
    dispose() {}
  },
}));
vi.mock('../src/environment/outer/SoloCreature', () => ({
  SoloCreature: class {
    root = new THREE.Group();
    disposed = false;
    ready: Promise<boolean>;
    constructor(
      _loader: unknown,
      _id: unknown,
      _pose: unknown,
      _scale: number,
      name: string,
    ) {
      controls.bodies.push(this);
      this.ready = (
        (!controls.delayOnly || controls.delayOnly === name
          ? controls.gate
          : undefined) ?? Promise.resolve()
      ).then(() => name !== controls.failed);
    }
    dispose() {
      this.disposed = true;
    }
  },
}));
import { WreckLife } from '../src/environment/wreck/WreckLife';
const loader = () =>
  ({
    acquire: vi.fn(async () => ({
      model: new THREE.Group(),
      animations: [],
      release: vi.fn(),
    })),
    evictUnused: vi.fn(),
  }) as unknown as ConstructorParameters<typeof WreckLife>[0];
afterEach(() => {
  controls.bodies.length = 0;
  controls.gate = undefined;
  controls.delayOnly = '';
  controls.failed = 'Barracuda 1';
  vi.restoreAllMocks();
});
it('reports partial wildlife and promptly disposes failed wrappers while retaining healthy animals', async () => {
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  const life = new WreckLife(loader());
  const ready = await life.ready;
  expect(controls.bodies[0].disposed).toBe(true);
  expect(controls.bodies[1].disposed).toBe(false);
  expect(ready).toBe(false);
  expect(life.root.children.length).toBeGreaterThan(0);
  life.dispose();
  expect(controls.bodies.every((body) => body.disposed)).toBe(true);
});

it('does not attach wildlife that finishes after its owner was disposed', async () => {
  let finish!: () => void;
  controls.gate = new Promise<void>((resolve) => {
    finish = resolve;
  });
  const life = new WreckLife(loader());
  life.dispose();
  finish();
  expect(await life.ready).toBe(false);
  expect(life.root.children).toHaveLength(0);
  expect(controls.bodies.every((body) => body.disposed)).toBe(true);
});
it('reports full readiness when every wildlife group loads', async () => {
  controls.failed = '';
  const life = new WreckLife(loader());
  expect(await life.ready).toBe(true);
  life.dispose();
});

it('releases fulfilled leases immediately when another member of the same fish group fails', async () => {
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  const release = vi.fn();
  let bass = 0;
  const source = {
    acquire: async (id: string) => {
      if (id === 'giantSeaBass' && bass++ === 0)
        throw Error('one failed decode');
      return {
        model: new THREE.Group(),
        animations: [],
        release: id === 'giantSeaBass' ? release : vi.fn(),
      };
    },
    evictUnused: vi.fn(),
  } as unknown as ConstructorParameters<typeof WreckLife>[0];
  const life = new WreckLife(source);
  expect(await life.ready).toBe(false);
  expect(release).toHaveBeenCalledTimes(1);
  life.dispose();
  expect(release).toHaveBeenCalledTimes(1);
});

it('waits for healthy members of a partially failed group before settling readiness', async () => {
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  controls.delayOnly = 'Barracuda 2';
  let finish!: () => void;
  controls.gate = new Promise<void>((resolve) => {
    finish = resolve;
  });
  const life = new WreckLife(loader());
  let settled = false;
  const ready = life.ready.then((ok) => {
    settled = true;
    return ok;
  });
  // Drain other groups, all of which resolve without timers or I/O in this fixture.
  for (let i = 0; i < 50; i++) await Promise.resolve();
  const settledBeforeHealthy = settled;
  finish();
  await ready;
  life.dispose();
  expect(settledBeforeHealthy).toBe(false);
});
