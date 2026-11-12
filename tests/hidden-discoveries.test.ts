import * as THREE from 'three';
import { beforeAll, afterAll, describe, it, expect, vi } from 'vitest';
import { Aquarium } from '../src/environment/Aquarium';
import { safeFishPosition, clearFishRoute } from '../src/fish/FishHabitat';
import { spawnFish } from '../src/fish/FishSpawner';
import { DiscoveryClock } from '../src/creatures/discoveries/DiscoveryClock';
import {
  FROGFISH_GULP,
  FROGFISH_JAW_HINGE,
  FROGFISH_YAWN,
  frogfishGape,
  frogfishStep,
} from '../src/creatures/discoveries/Frogfish';
import { NUDIBRANCH_VARIANTS } from '../src/creatures/discoveries/Nudibranchs';

describe('quiet hidden discoveries', () => {
  let a: Aquarium;
  beforeAll(() => {
    a = new Aquarium();
  });
  afterAll(() => a.dispose());
  it('adds exactly seven stable unique identities outside the fish registry', () => {
    const d = a.anchoredLife.hidden;
    expect(d.homes).toHaveLength(7);
    expect(new Set(d.homes.map((h) => h.id)).size).toBe(7);
    expect(d.nudibranchs.animals).toHaveLength(5);
    expect(d.nudibranchs.animals.map((n) => n.variant)).toEqual(
      NUDIBRANCH_VARIANTS,
    );
    expect(a.fish.simulation.fish).toHaveLength(41);
    expect(a.fish.simulation.fish).toEqual(
      spawnFish(a.fish.simulation.habitat),
    );
    // 139 until Pass 023: the hidden crevice adds 7 rock hulls and 5 channel seals; the Pass 026
    // playtest adds 6 more rocks around its mouth.
    expect(a.collision.colliders).toHaveLength(157);
    const b = new Aquarium();
    try {
      expect(
        b.anchoredLife.hidden.homes.map((h) => ({
          id: h.id,
          position: h.position,
          source: h.sourceId,
          view: h.view,
        })),
      ).toEqual(
        d.homes.map((h) => ({
          id: h.id,
          position: h.position,
          source: h.sourceId,
          view: h.view,
        })),
      );
    } finally {
      b.dispose();
    }
  });
  it('gives every creature a safe focus, viewing volume and explicit reachable approach route', () => {
    const h = a.fish.simulation.habitat;
    for (const home of a.anchoredLife.hidden.homes) {
      expect(safeFishPosition(home.view, 0.65, h)).toBe(true);
      expect(clearFishRoute(home.view, home.focus, 0.015, h)).toBe(true);
      expect(home.approach).toHaveLength(4);
      for (let i = 1; i < home.approach.length; i++)
        expect(
          clearFishRoute(home.approach[i - 1], home.approach[i], 0.65, h),
        ).toBe(true);
      expect(
        Math.hypot(home.orientation.x, home.orientation.y, home.orientation.z),
      ).toBeCloseTo(1, 8);
      expect(Math.abs(home.position.x)).toBeGreaterThan(4);
    }
  });
  it('keeps the upright horse beside real vegetation with stable head, coiled tail and small independent fins', () => {
    const s = a.anchoredLife.hidden.seahorse;
    expect(['sea-fan', 'red-macroalgae', 'turtle-grass']).toContain(
      s.vegetation.species.id,
    );
    expect(
      Math.hypot(
        s.gripPoint.x - s.vegetation.position.x,
        s.gripPoint.y - s.vegetation.position.y,
        s.gripPoint.z - s.vegetation.position.z,
      ),
    ).toBeLessThan(s.vegetation.height * 0.3);
    expect(s.tail.children).toHaveLength(1);
    expect(s.leftPectoral.geometry).toBe(s.rightPectoral.geometry);
    expect(s.dorsal.geometry).not.toBe(s.leftPectoral.geometry);
    let gripping = 0,
      floating = 0;
    for (let i = 0; i < 1800; i++) {
      s.pose(i / 30);
      const p = s.root.position;
      expect(
        Math.hypot(
          p.x - s.home.position.x,
          p.y - s.home.position.y,
          p.z - s.home.position.z,
        ),
      ).toBeLessThan(s.home.homeRadius);
      if (s.gripping) gripping++;
      else floating++;
      expect(
        Number.isFinite(
          s.dorsal.rotation.y +
            s.leftPectoral.rotation.y +
            s.rightPectoral.rotation.y,
        ),
      ).toBe(true);
    }
    expect(gripping).toBeGreaterThan(300);
    expect(floating).toBeGreaterThan(100);
    const geometry = s.geometries[0];
    geometry.computeBoundingBox();
    expect(
      geometry.boundingBox!.max.y - geometry.boundingBox!.min.y,
    ).toBeGreaterThan(0.75);
    expect(geometry.boundingBox!.max.z).toBeGreaterThan(0.3);
  });
  it('keeps frogfish mostly still with rare, tiny, continuous limb-led repositioning', () => {
    const out = { x: 0, z: 0, walking: false, stride: 0 };
    let walking = 0,
      lastX = 0,
      lastZ = 0,
      moving = 0;
    for (let i = 0; i < 36000; i++) {
      frogfishStep(i / 30, out);
      if (out.walking) walking++;
      if (i) {
        const distance = Math.hypot(out.x - lastX, out.z - lastZ);
        expect(distance).toBeLessThan(0.001);
        if (distance > 1e-8) moving++;
      }
      expect(Math.hypot(out.x, out.z)).toBeLessThan(0.1);
      lastX = out.x;
      lastZ = out.z;
    }
    expect(walking / 36000).toBeLessThan(0.08);
    expect(moving).toBeGreaterThan(100);
    const f = a.anchoredLife.hidden.frogfish;
    expect(f.leftFoot.geometry).toBe(f.rightFoot.geometry);
    // Pass 019: perched on a level reef-rock top, at half its former size.
    expect(f.home.sourceId).toMatch(/^reef\//);
    expect(f.home.orientation.y).toBeGreaterThan(0.85);
    expect(f.root.scale.x).toBe(0.5);
  });
  it('opens and closes the frogfish mouth with rhythmic gulps and an occasional yawn', () => {
    const { period, gape: gulp } = FROGFISH_GULP;
    let last = frogfishGape(0),
      open = 0,
      closed = 0,
      wide = 0;
    // Ten minutes at 30 Hz: continuous, bounded, and genuinely opening and closing.
    for (let i = 1; i < 18000; i++) {
      const g = frogfishGape(i / 30);
      expect(Number.isFinite(g)).toBe(true);
      expect(g).toBeGreaterThanOrEqual(0);
      expect(g).toBeLessThanOrEqual(FROGFISH_YAWN.gape + 1e-9);
      expect(Math.abs(g - last)).toBeLessThan(0.03);
      if (g > gulp * 0.8) open++;
      if (g < 0.005) closed++;
      if (g > FROGFISH_YAWN.gape * 0.95) wide++;
      last = g;
    }
    expect(open).toBeGreaterThan(3000);
    expect(closed).toBeGreaterThan(1000);
    // A held yawn once per cycle: rare, but every cycle.
    expect(wide / 18000).toBeGreaterThan(0.02);
    expect(wide / 18000).toBeLessThan(0.1);
    expect(frogfishGape(0)).toBeCloseTo(0, 6);
    expect(frogfishGape(period / 2)).toBeCloseTo(gulp, 6);
    expect(frogfishGape(FROGFISH_YAWN.start + FROGFISH_YAWN.open)).toBeCloseTo(
      FROGFISH_YAWN.gape,
      6,
    );
    // The pose drives the jaw pivot at the shared hinge, under the breathing body.
    const f = a.anchoredLife.hidden.frogfish;
    expect(f.jaw.parent).toBe(f.body);
    expect(f.jaw.position.toArray()).toEqual([
      FROGFISH_JAW_HINGE.x,
      FROGFISH_JAW_HINGE.y,
      FROGFISH_JAW_HINGE.z,
    ]);
    for (const t of [0, 1.6, 11.8, 41]) {
      f.pose(t);
      expect(f.jaw.rotation.x).toBe(frogfishGape(t));
      expect(f.jaw.rotation.y).toBe(0);
      expect(f.jaw.rotation.z).toBe(0);
    }
    f.pose(0);
  });
  it('makes only bounded gentle personal-space responses and ignores distant activity', () => {
    const s = a.anchoredLife.hidden.seahorse,
      f = a.anchoredLife.hidden.frogfish,
      zero = { x: 0, y: 0, z: 0 };
    for (let i = 0; i < 90; i++) {
      s.respond(1 / 30, {
        position: s.home.position,
        velocity: zero,
        active: true,
      });
      f.respond(1 / 30, {
        position: f.home.position,
        velocity: zero,
        active: true,
      });
    }
    expect(s.awareness).toBeGreaterThan(0.8);
    expect(f.awareness).toBeGreaterThan(0.8);
    s.pose(10);
    f.pose(10);
    expect(
      s.root.position.distanceTo(
        new THREE.Vector3(
          s.home.position.x,
          s.home.position.y,
          s.home.position.z,
        ),
      ),
    ).toBeLessThan(0.12);
    for (let i = 0; i < 900; i++) {
      s.respond(1 / 30, {
        position: { x: 0, y: 10, z: 0 },
        velocity: zero,
        active: true,
      });
      f.respond(1 / 30, {
        position: { x: 0, y: 10, z: 0 },
        velocity: zero,
        active: true,
      });
    }
    expect(s.awareness).toBeLessThan(1e-6);
    expect(f.awareness).toBeLessThan(1e-6);
  });
  it('keeps crawlers on actual convex surfaces with stable normals for every heading', () => {
    const n = a.anchoredLife.hidden.nudibranchs;
    expect(n.meshes).toHaveLength(3);
    expect(n.geometries).toHaveLength(3);
    for (const time of [0, 60, 170, 320, 525, 900]) {
      n.pose(time);
      for (const animal of n.animals) {
        const home = animal.home,
          p = animal.pose.position,
          plane = home.support.planes[home.planeIndex];
        expect(
          plane.x * p.x + plane.y * p.y + plane.z * p.z - plane.offset,
        ).toBeCloseTo(0.006, 7);
        const up = new THREE.Vector3(0, 1, 0).applyQuaternion(
          animal.pose.quaternion,
        );
        expect(
          up.dot(
            new THREE.Vector3(
              home.orientation.x,
              home.orientation.y,
              home.orientation.z,
            ),
          ),
        ).toBeCloseTo(1, 9);
        expect(
          p.distanceTo(
            new THREE.Vector3(
              home.position.x,
              home.position.y,
              home.position.z,
            ),
          ),
        ).toBeLessThan(0.08);
        expect(a.collision.colliders).toContain(home.support);
      }
    }
  });
  it('crawls slowly without resetting its pose or rebuilding shared geometry', () => {
    const n = a.anchoredLife.hidden.nudibranchs,
      geometries = [...n.geometries];
    n.pose(0);
    const before = n.animals.map((a) => a.pose.position.clone());
    n.pose(60);
    n.animals.forEach((a, i) =>
      expect(a.pose.position.distanceTo(before[i])).toBeGreaterThan(0.02),
    );
    const near = n.animals.map((a) => a.pose.position.clone());
    n.pose(60 + 1 / 30);
    n.animals.forEach((a, i) =>
      expect(a.pose.position.distanceTo(near[i])).toBeLessThan(0.001),
    );
    expect(n.geometries).toEqual(geometries);
  });
  it('keeps every deformed crawler vertex outside solids and inside aquarium bounds', () => {
    const n = a.anchoredLife.hidden.nudibranchs,
      h = a.fish.simulation.habitat,
      v = new THREE.Vector3(),
      matrix = new THREE.Matrix4();
    n.root.updateMatrixWorld(true);
    for (const time of [0, 80, 260, 500]) {
      n.pose(time);
      for (const mesh of n.meshes)
        for (let instance = 0; instance < mesh.count; instance++) {
          mesh.getMatrixAt(instance, matrix);
          const p = mesh.geometry.attributes.position,
            flex = mesh.geometry.attributes.nudiFlex,
            phase = mesh.geometry.attributes.nudiPhase.getX(instance);
          const center = new THREE.Vector3().setFromMatrixPosition(matrix),
            nearby = h.rocks.filter(
              (r) =>
                r.max.x > center.x - 0.5 &&
                r.min.x < center.x + 0.5 &&
                r.max.y > center.y - 0.5 &&
                r.min.y < center.y + 0.5 &&
                r.max.z > center.z - 0.5 &&
                r.min.z < center.z + 0.5,
            );
          for (let i = 0; i < p.count; i += 2) {
            v.fromBufferAttribute(p, i);
            v.x +=
              Math.cos(time * 0.55 + p.getZ(i) * 11 + phase) *
              0.002 *
              flex.getX(i);
            v.y +=
              Math.sin(time * 0.7 + p.getZ(i) * 19 + phase) *
              0.003 *
              flex.getX(i);
            v.applyMatrix4(matrix);
            expect(
              safeFishPosition(v, 0.001, { bounds: h.bounds, rocks: nearby }),
            ).toBe(true);
          }
        }
    }
  });
  it('keeps seahorse and frogfish anatomy outside structural solids through their bounded poses', () => {
    const d = a.anchoredLife.hidden,
      h = a.fish.simulation.habitat,
      v = new THREE.Vector3();
    for (const { time, awareness } of [0, 1].flatMap((awareness) =>
      [0, 27, 41, 105, 108, 111, 220, 335].map((time) => ({ time, awareness })),
    )) {
      d.seahorse.awareness = awareness;
      d.frogfish.awareness = awareness;
      d.seahorse.pose(time);
      d.frogfish.pose(time);
      for (const root of [d.seahorse.root, d.frogfish.root]) {
        root.updateMatrixWorld(true);
        const near = h.rocks.filter(
          (r) =>
            r.max.x > root.position.x - 1.5 &&
            r.min.x < root.position.x + 1.5 &&
            r.max.y > root.position.y - 1.5 &&
            r.min.y < root.position.y + 1.5 &&
            r.max.z > root.position.z - 1.5 &&
            r.min.z < root.position.z + 1.5,
        );
        root.traverse((o) => {
          if (o instanceof THREE.Mesh) {
            const p = o.geometry.attributes.position;
            for (let i = 0; i < p.count; i += 2) {
              v.fromBufferAttribute(p, i).applyMatrix4(o.matrixWorld);
              expect(
                safeFishPosition(v, 0.001, { bounds: h.bounds, rocks: near }),
                `${root.name} time=${time} vertex=${i} localY=${p.getY(i)} at ${v.toArray()}`,
              ).toBe(true);
            }
          }
        });
      }
    }
    d.seahorse.awareness = 0;
    d.frogfish.awareness = 0;
  });
  it('keeps anatomy and normals finite without marker or emissive materials', () => {
    const d = a.anchoredLife.hidden,
      geometries = [
        ...d.seahorse.geometries,
        ...d.frogfish.geometries,
        ...d.nudibranchs.geometries,
      ];
    for (const g of geometries) {
      const p = g.attributes.position,
        n = g.attributes.normal;
      expect(p.count).toBeGreaterThanOrEqual(3);
      for (let i = 0; i < p.count; i++)
        expect(
          Number.isFinite(
            p.getX(i) +
              p.getY(i) +
              p.getZ(i) +
              n.getX(i) +
              n.getY(i) +
              n.getZ(i),
          ),
        ).toBe(true);
    }
    for (const m of [
      d.seahorse.material,
      d.seahorse.finMaterial,
      d.frogfish.material,
      d.nudibranchs.material,
    ])
      expect(m.emissive.getHex()).toBe(0);
  });
  it('freezes every pose on pause and settles reduced motion without resetting geometry', () => {
    const d = a.anchoredLife.hidden;
    for (let i = 0; i < 180; i++) d.update(1 / 30, true, false);
    const snapshot = () => ({
      time: d.clock.time,
      motion: d.clock.sample,
      seahorse: d.seahorse.root.position.toArray(),
      frog: d.frogfish.root.position.toArray(),
      instances: d.nudibranchs.meshes.map((m) =>
        Array.from(m.instanceMatrix.array),
      ),
    });
    const before = snapshot();
    d.update(600, false, false);
    for (const dt of [NaN, Infinity, -1, 0]) d.update(dt, true, false);
    expect(snapshot()).toEqual(before);
    for (let i = 0; i < 900; i++) d.update(1 / 30, true, true);
    const reduced = snapshot();
    for (let i = 0; i < 60; i++) d.update(1 / 30, true, true);
    expect(d.clock.sample - reduced.motion).toBeLessThan(1e-6);
    expect(
      d.seahorse.root.position.distanceTo(
        new THREE.Vector3(...reduced.seahorse),
      ),
    ).toBeLessThan(1e-6);
    const motion = d.clock.sample;
    for (let i = 0; i < 30; i++) d.update(1 / 30, true, false);
    expect(d.clock.sample).toBeGreaterThan(motion);
  });
  it('uses equivalent interpolated clocks and poses across 30/60/120 FPS', () => {
    const d = a.anchoredLife.hidden,
      results = [30, 60, 120].map((fps) => {
        const c = new DiscoveryClock();
        for (let i = 0; i < fps * 180; i++)
          c.advance(1 / fps, true, i / fps >= 100 && i / fps < 120);
        d.seahorse.pose(c.sample);
        d.frogfish.pose(c.sample);
        d.nudibranchs.pose(c.sample);
        return {
          time: c.time,
          motion: c.sample,
          seahorse: d.seahorse.root.position.toArray(),
          frog: d.frogfish.root.position.toArray(),
          nudis: d.nudibranchs.animals.map((n) => n.pose.position.toArray()),
        };
      });
    expect(results[1]).toEqual(results[0]);
    expect(results[2]).toEqual(results[0]);
  });
  it('owns and releases all shared geometry/material/instance resources exactly once', () => {
    const d = a.anchoredLife.hidden,
      resources = [
        ...d.seahorse.geometries,
        ...d.frogfish.geometries,
        ...d.nudibranchs.geometries,
        d.seahorse.material,
        d.seahorse.finMaterial,
        d.frogfish.material,
        d.nudibranchs.material,
      ],
      spies = resources.map((r) => vi.spyOn(r, 'dispose')),
      buffers = d.nudibranchs.meshes.map((m) => vi.spyOn(m, 'dispose'));
    d.dispose();
    d.dispose();
    spies.forEach((s) => expect(s).toHaveBeenCalledTimes(1));
    buffers.forEach((s) => expect(s).toHaveBeenCalledTimes(1));
    expect(d.root.parent).toBeNull();
    expect(d.root.children).toHaveLength(0);
  });
});
