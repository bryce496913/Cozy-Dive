import * as THREE from 'three';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { Aquarium } from '../src/environment/Aquarium';
import { AQUARIUM, COLLISION, SPAWN } from '../src/config/world';
import {
  safeFishPosition,
  clearFishRoute,
  insideRock,
} from '../src/fish/FishHabitat';
import { CollisionWorld } from '../src/player/collision';
import { ChestClock } from '../src/environment/ornaments/OrnamentAnimation';
import { OrnamentBubbles } from '../src/environment/ornaments/OrnamentBubbles';
import { OrnamentSystem } from '../src/environment/ornaments/OrnamentSystem';
import {
  modelColliders,
  type OrnamentKind,
} from '../src/environment/ornaments/OrnamentGeometry';
import { rockCollider } from '../src/environment/rockCollider';

describe('home aquarium ornaments', () => {
  let a: Aquarium;
  beforeAll(() => {
    a = new Aquarium();
  });
  afterAll(() => a.dispose());
  it('owns exactly six distinct deterministic decorations with stable scene transforms', () => {
    const o = a.ornaments,
      again = new OrnamentSystem([
        ...a.rockColliders,
        ...a.hardscape.colliders,
      ]);
    try {
      expect(o.models.map((m) => m.kind).sort()).toEqual([
        'arch',
        'chest',
        'filter',
        'log',
        'shipwreck',
        'statue',
      ]);
      expect(again.models.map((m) => m.root.position.toArray())).toEqual(
        o.models.map((m) => m.root.position.toArray()),
      );
      expect(again.anchors).toEqual(o.anchors);
      for (const m of o.models) {
        expect(m.root.parent).toBe(o.root);
        expect(Math.abs(m.root.position.x)).toBeGreaterThan(4);
      }
      const roots = o.models.map((m) => m.root.matrixWorld.clone());
      o.update(0.1, true, false);
      o.models.forEach((m, i) =>
        expect(m.root.matrixWorld.equals(roots[i])).toBe(true),
      );
    } finally {
      again.dispose();
    }
  });
  it('has finite nondegenerate geometry, unit normals and proper floor/corner placement', () => {
    for (const m of a.ornaments.models) {
      const bounds = new THREE.Box3().setFromObject(m.root);
      expect(bounds.min.x).toBeGreaterThan(AQUARIUM.min.x);
      expect(bounds.max.x).toBeLessThan(AQUARIUM.max.x);
      if (m.kind === 'filter') {
        expect(m.root.position.z).toBeLessThan(-11);
        expect(m.root.position.x).toBeGreaterThan(15);
      } else expect(bounds.min.y).toBeLessThan(0.15);
      for (const g of m.geometries) {
        const p = g.attributes.position,
          n = g.attributes.normal;
        expect(p.count).toBeGreaterThan(8);
        for (let i = 0; i < p.count; i++) {
          expect(Number.isFinite(p.getX(i) + p.getY(i) + p.getZ(i))).toBe(true);
          expect(Math.hypot(n.getX(i), n.getY(i), n.getZ(i))).toBeCloseTo(1, 4);
        }
      }
    }
  });
  it('attaches living corals to real reef surfaces, never clearance volumes or moving equipment', () => {
    const supports = [...a.rockColliders, ...a.hardscape.colliders];
    for (const p of a.plants.placements.filter(
      (p) => p.species.category === 'coral',
    )) {
      const point = {
        x: p.position.x - p.normal.x * 0.02,
        y: p.position.y - p.normal.y * 0.02,
        z: p.position.z - p.normal.z * 0.02,
      };
      expect(
        supports.some(
          (r) =>
            r.planes.every(
              (v) =>
                v.x * point.x + v.y * point.y + v.z * point.z <=
                v.offset + 1e-5,
            ) &&
            r.planes.some(
              (v) =>
                Math.abs(
                  v.x * point.x + v.y * point.y + v.z * point.z - v.offset,
                ) < 1e-5,
            ),
        ),
      ).toBe(true);
    }
  });
  it('validates six named oriented creature anchors and retains a clear center and player spawn', () => {
    expect(a.ornaments.anchors.map((v) => v.anchorId).sort()).toEqual([
      'arch-shadow',
      'chest-nearby',
      'filter-corner',
      'log-interior',
      'shipwreck-crevice',
      'statue-rear',
    ]);
    for (const anchor of a.ornaments.anchors) {
      expect(
        safeFishPosition(anchor.position, 0.65, a.fish.simulation.habitat),
      ).toBe(true);
      expect(
        Math.hypot(anchor.normal.x, anchor.normal.y, anchor.normal.z),
      ).toBeCloseTo(1);
    }
    expect(safeFishPosition(SPAWN, 1, a.fish.simulation.habitat)).toBe(true);
    expect(
      clearFishRoute(
        { x: 0, y: 1, z: -12 },
        { x: 0, y: 1, z: 12 },
        0.65,
        a.fish.simulation.habitat,
      ),
    ).toBe(true);
  });
  it.each(['arch', 'log', 'shipwreck'] as const)(
    'keeps the %s opening physically passable, including swept player collision',
    (kind) => {
      const m = a.ornaments.models.find((m) => m.kind === kind)!;
      const local =
        kind === 'log'
          ? [1.28, -2.15, 2.15]
          : kind === 'arch'
            ? [1.35, -1.2, 1.2]
            : [1.02, 1.08, 1.08];
      const from = new THREE.Vector3(
        0,
        kind === 'shipwreck' ? 3 : local[0],
        local[1],
      ).applyMatrix4(m.root.matrixWorld);
      const to = new THREE.Vector3(0, local[0], local[2]).applyMatrix4(
        m.root.matrixWorld,
      );
      const hulls = modelColliders(m),
        h = { bounds: AQUARIUM, rocks: hulls };
      expect(clearFishRoute(from, to, COLLISION.playerRadius, h)).toBe(true);
      const state = {
        position: { x: to.x, y: to.y, z: to.z },
        velocity: { x: 0, y: -1, z: 1 },
      };
      new CollisionWorld(hulls, AQUARIUM).move(state, from.x, from.y, from.z);
      expect(
        new THREE.Vector3(
          state.position.x,
          state.position.y,
          state.position.z,
        ).distanceTo(to),
      ).toBeLessThan(1e-5);
      if (kind !== 'shipwreck')
        expect(
          clearFishRoute(
            from,
            to,
            COLLISION.playerRadius,
            a.fish.simulation.habitat,
          ),
        ).toBe(true);
    },
  );
  it.each(['filter', 'statue'] as OrnamentKind[])(
    'derives %s solid colliders from the visible structural surfaces',
    (kind) => {
      const m = a.ornaments.models.find((m) => m.kind === kind)!;
      for (const hull of modelColliders(m)) {
        const p = {
          x: (hull.min.x + hull.max.x) / 2,
          y: (hull.min.y + hull.max.y) / 2,
          z: (hull.min.z + hull.max.z) / 2,
        };
        expect(insideRock(p, 0.01, hull)).toBe(true);
        expect(safeFishPosition(p, 0.15, a.fish.simulation.habitat)).toBe(
          false,
        );
      }
    },
  );
  it('uses the real rear hinge and a matching thin collider; holds before sweeping an occupant', () => {
    const o = a.ornaments,
      m = o.models.find((m) => m.kind === 'chest')!,
      hinge = m.hinge!;
    const initial = hinge.getWorldPosition(new THREE.Vector3());
    for (let i = 0; i < 110; i++) o.update(0.1, true, false);
    expect(o.chest.angle).toBeGreaterThan(0.7);
    expect(
      hinge.getWorldPosition(new THREE.Vector3()).distanceTo(initial),
    ).toBeLessThan(1e-9);
    const expected = rockCollider(m.lid!.geometry, m.lid!.matrixWorld);
    expect(o.lidCollider.planes).toEqual(expected.planes);
    expect(o.lidCollider.min).toEqual(expected.min);
    const before = o.chest.time,
      angle = hinge.rotation.x;
    for (let i = 0; i < 40; i++)
      o.update(0.1, true, false, {
        position: { x: initial.x, y: initial.y, z: initial.z },
        velocity: { x: 0, y: 0, z: 0 },
        active: true,
      });
    expect(o.chest.time).toBe(before);
    expect(hinge.rotation.x).toBe(angle);
    o.update(0.1, true, false);
    expect(o.chest.time).toBeGreaterThan(before);
    const fish = a.fish.simulation.fish[0],
      previous = { ...fish.position },
      fishTime = o.chest.time;
    Object.assign(fish.position, initial);
    o.update(0.1, true, false, undefined, [fish]);
    expect(o.chest.time).toBe(fishTime);
    Object.assign(fish.position, previous);
    const time = o.chest.time;
    o.update(30, false, false);
    o.update(0.1, true, true);
    expect(o.chest.time).toBe(time);
  });
  it('keeps all 40 fish safe around the new obstacles during sustained activity', () => {
    const q = new Aquarium();
    try {
      for (let i = 0; i < 1800; i++)
        q.update(i / 30, false, 1 / 30, true, {
          position: SPAWN,
          velocity: { x: 0, y: 0, z: 0 },
          active: true,
        });
      expect(q.fish.simulation.fish).toHaveLength(41);
      for (const f of q.fish.simulation.fish) {
        expect(
          safeFishPosition(f.position, f.radius, q.fish.simulation.habitat),
        ).toBe(true);
        expect(
          f.corrections,
          `fish ${f.id} at ${JSON.stringify(f.position)}`,
        ).toBe(0);
      }
    } finally {
      q.dispose();
    }
  });
  it('disposes every owned resource once and detaches the subsystem', () => {
    const o = new OrnamentSystem([
      ...a.rockColliders,
      ...a.hardscape.colliders,
    ]);
    a.root.add(o.root);
    const resources = [
      ...o.models.flatMap((m) => m.geometries),
      ...o.geometry.materials,
      o.bubbles.geometry,
      o.bubbles.material,
      o.outflowGeometry,
      o.outflowMaterial,
    ];
    const spies = resources.map((r) => vi.spyOn(r, 'dispose'));
    o.dispose();
    o.dispose();
    spies.forEach((s) => expect(s).toHaveBeenCalledTimes(1));
    expect(o.root.parent).toBeNull();
    expect(o.root.children).toHaveLength(0);
  });
});
it('varies seeded chest cycles within 25–45 seconds with smooth rest/open/hold/close phases', () => {
  const c = new ChestClock(),
    durations = new Set<number>();
  let last = 0,
    maxJump = 0;
  for (let i = 0; i < 6000; i++) {
    c.update(0.05, true, false);
    maxJump = Math.max(maxJump, Math.abs(c.angle - last));
    last = c.angle;
    expect(c.duration).toBeGreaterThanOrEqual(25);
    expect(c.duration).toBeLessThanOrEqual(45);
    durations.add(c.duration);
  }
  expect(durations.size).toBeGreaterThan(5);
  expect(c.openings).toBe(c.cycle + (c.time >= 10 ? 1 : 0));
  expect(maxJump).toBeLessThan(0.022);
  expect(c.angleAt(5)).toBe(0);
  expect(c.angleAt(14)).toBe(1.12);
  expect(c.angleAt(24)).toBe(0);
  const before = c.time;
  for (const dt of [NaN, Infinity, -1]) c.update(dt, true, false);
  expect(c.time).toBe(before);
});
it('pools occasional varied rising bubbles, freezes during pause, clears for reduced motion and disposes', () => {
  const b = new OrnamentBubbles();
  try {
    b.emit(new THREE.Vector3(0, 1, 0));
    expect(b.bursts).toBe(1);
    for (let i = 0; i < 20; i++) b.update(0.05, true, false);
    expect(b.mesh.count).toBe(18);
    const start = b.mesh.instanceMatrix.array.slice();
    b.update(60, false, false);
    expect(b.mesh.instanceMatrix.array).toEqual(start);
    b.update(0.1, true, false);
    const matrix = new THREE.Matrix4();
    b.mesh.getMatrixAt(0, matrix);
    expect(matrix.elements[13]).toBeGreaterThan(1.8);
    expect(b.mesh.instanceMatrix.array).not.toEqual(start);
    expect(b.mesh.count).toBeLessThanOrEqual(b.capacity);
    for (let i = 0; i < 300; i++) b.update(0.1, true, false);
    expect(b.mesh.count).toBe(0);
    expect(b.activeCount).toBe(0);
    b.emit(new THREE.Vector3(0, 1, 0));
    b.update(0.1, true, true);
    expect(b.mesh.count).toBe(0);
    b.emit(new THREE.Vector3(0, 0.9, 0));
    for (let i = 0; i < 140; i++) b.update(0.1, true, false);
    expect(b.mesh.count).toBeGreaterThan(0); // Slow bubbles must reach the surface, not expire midwater.
    for (let i = 0; i < 60; i++) b.update(0.1, true, false);
    expect(b.mesh.count).toBe(0);
  } finally {
    b.dispose();
    b.dispose();
  }
});
it('keeps ornament audio inside the existing sparse single-voice event budget', async () => {
  const { AudioEvents } = await import('../src/audio/AudioEvents');
  const events = new AudioEvents(11);
  let count = 0,
    last = -Infinity;
  for (let i = 0; i < 3000; i++) {
    const event = events.advance(0.1, true, true);
    if (event) {
      count++;
      expect(i * 0.1 - last).toBeGreaterThan(10);
      last = i * 0.1;
      expect(event.location).toBeLessThan(11);
    }
  }
  expect(count).toBeGreaterThan(0);
  expect(count).toBeLessThan(20);
  expect(events.advance(3600, false)).toBeUndefined();
  expect(events.advance(3600, true, false)).toBeUndefined();
});

it('keeps chest scheduling equivalent across 30/60/120 FPS without a wall clock', () => {
  const clocks = [30, 60, 120].map((fps) => {
    const c = new ChestClock();
    for (let i = 0; i < fps * 180; i++) c.update(1 / fps, true, false);
    return c;
  });
  for (const c of clocks.slice(1)) {
    expect(c.time).toBeCloseTo(clocks[0].time, 8);
    expect(c.angle).toBeCloseTo(clocks[0].angle, 8);
    expect(c.openings).toBe(clocks[0].openings);
    expect(c.cycle).toBe(clocks[0].cycle);
  }
});
