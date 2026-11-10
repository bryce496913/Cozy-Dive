import * as THREE from 'three';
import { beforeAll, afterAll, describe, expect, it, vi } from 'vitest';
import { Aquarium } from '../src/environment/Aquarium';
import { ANEMONE } from '../src/creatures/Anemone';
import {
  MorayBehavior,
  morayCenter,
  type MorayState,
} from '../src/creatures/MorayBehavior';
import { Moray } from '../src/creatures/Moray';
import { homeDistance } from '../src/creatures/CreatureAnchor';
import { spawnFish } from '../src/fish/FishSpawner';
import { FISH_SPECIES, fishPopulation } from '../src/fish/FishSpecies';
import { FishSimulation } from '../src/fish/FishMovement';
import {
  safeFishPosition,
  insideRock,
  clearFishRoute,
} from '../src/fish/FishHabitat';
import { SPAWN } from '../src/config/world';

describe('anchored marine inhabitants', () => {
  let a: Aquarium;
  beforeAll(() => {
    a = new Aquarium();
  });
  afterAll(() => a.dispose());
  const zero = { x: 0, y: 0, z: 0 };
  it('preserves the original 38 IDs and spawns a host-associated pair plus a juvenile, separate from the moray', () => {
    const h = a.fish.simulation.habitat,
      fish = spawnFish(h),
      before = spawnFish(h, FISH_SPECIES.slice(0, 5));
    expect(fish).toHaveLength(41);
    expect(fish.slice(0, 38)).toEqual(before);
    const family = fish.filter((f) => f.species.id === 'ocellaris-clownfish');
    expect(family.map((f) => f.id)).toEqual([38, 39, 40]);
    const pair = family.slice(0, 2),
      juvenile = family[2];
    for (const f of family) {
      expect(f.host).toBe(a.anchoredLife.anemone.host);
      expect(homeDistance(f.position, f.host!)).toBeLessThan(
        f.host!.homeRadius - f.radius,
      );
    }
    for (const f of pair)
      expect(f.hostMate).toBe(pair.find((other) => other !== f)!.position);
    // Pass 019: the juvenile shelters with the pair at a fifth of their body length.
    expect(juvenile.hostMate).toBe(pair[0].position);
    expect(pair[0].size).not.toBe(pair[1].size);
    expect(Math.max(...pair.map((f) => f.size))).toBeLessThanOrEqual(1.1);
    expect(juvenile.size).toBeGreaterThanOrEqual(0.9 * 0.2);
    expect(juvenile.size).toBeLessThanOrEqual(1.1 * 0.2);
    expect(fishPopulation('dense').reduce((n, s) => n + s.count, 0)).toBe(61);
    expect(a.anchoredLife.moray.anchor.sourceId).toBe('log-interior');
    expect(() => spawnFish({ ...h, creatureAnchors: [] })).toThrow(
      /host anchor/,
    );
  });
  it('attaches the anemone to an actual reef plane with safe tentacle and escape envelopes', () => {
    const n = a.anchoredLife.anemone,
      p = n.root.position,
      normal = n.attachmentNormal;
    expect(
      a.rockColliders.some((r) =>
        r.planes.some(
          (f) =>
            Math.abs(
              f.x * (p.x - normal.x * 0.018) +
                f.y * (p.y - normal.y * 0.018) +
                f.z * (p.z - normal.z * 0.018) -
                f.offset,
            ) < 1e-5,
        ),
      ),
    ).toBe(true);
    expect(n.escapeDirections.length).toBeGreaterThanOrEqual(2);
    expect(safeFishPosition(n.openWater, 0.5, a.fish.simulation.habitat)).toBe(
      true,
    );
    const vertex = new THREE.Vector3(),
      motion = n.geometry.attributes.anemoneMotion,
      positions = n.geometry.attributes.position;
    let fixed = 0,
      tips = 0;
    for (let i = 0; i < positions.count; i++) {
      if (motion.getX(i) === 0) fixed++;
      if (motion.getX(i) > 0.5) tips++;
      if (i % 5) continue;
      for (const time of [0, 4, 13]) {
        vertex.fromBufferAttribute(positions, i);
        vertex.x +=
          Math.sin(time * 0.62 + motion.getY(i) + vertex.y * 2) *
          0.11 *
          motion.getX(i);
        vertex.z +=
          Math.cos(time * 0.51 + motion.getY(i) * 1.13) * 0.08 * motion.getX(i);
        expect(Math.hypot(vertex.x, vertex.z)).toBeLessThan(
          ANEMONE.envelopeRadius,
        );
        expect(vertex.y).toBeLessThan(ANEMONE.envelopeHeight);
        vertex.applyMatrix4(n.root.matrixWorld);
        expect(
          a.collision.colliders.some((r) => insideRock(vertex, 0.002, r)),
        ).toBe(false);
      }
    }
    expect(fixed).toBeGreaterThan(100);
    expect(tips).toBeGreaterThan(1000);
    expect(
      new Set(
        Array.from({ length: motion.count }, (_, i) =>
          motion.getY(i).toFixed(2),
        ),
      ).size,
    ).toBeGreaterThan(60);
    for (const d of n.escapeDirections)
      expect(
        clearFishRoute(
          n.host.position,
          {
            x: n.host.position.x + d.x,
            y: n.host.position.y + d.y,
            z: n.host.position.z + d.z,
          },
          0.5,
          a.fish.simulation.habitat,
        ),
      ).toBe(true);
  });
  it('keeps the pair local, separated and active through ordinary excursions and quiet returns', () => {
    const h = a.fish.simulation.habitat,
      sim = new FishSimulation(spawnFish(h), h);
    const pair = sim.fish.filter((f) => f.host),
      initial = pair.map((f) => ({ ...f.position }));
    let minGap = Infinity,
      maxRadius = 0,
      minRadius = Infinity;
    for (let i = 0; i < 5400; i++) {
      sim.advance(1 / 30, true);
      const d = Math.hypot(
        pair[0].position.x - pair[1].position.x,
        pair[0].position.y - pair[1].position.y,
        pair[0].position.z - pair[1].position.z,
      );
      minGap = Math.min(minGap, d);
      for (const f of pair) {
        const radius = homeDistance(f.position, f.host!);
        maxRadius = Math.max(maxRadius, radius);
        minRadius = Math.min(minRadius, radius);
        expect(radius + f.radius).toBeLessThanOrEqual(
          f.host!.homeRadius + 1e-6,
        );
        expect(safeFishPosition(f.position, f.radius, h)).toBe(true);
      }
    }
    expect(minGap).toBeGreaterThan(0.75);
    expect(maxRadius - minRadius).toBeGreaterThan(0.5);
    pair.forEach((f, i) => {
      expect(
        Math.hypot(f.position.x - initial[i].x, f.position.z - initial[i].z),
      ).toBeGreaterThan(0.1);
      expect(f.corrections).toBe(0);
    });
  });
  it('retreats locally from a diver and naturally returns without pursuit or teleportation', () => {
    const h = a.fish.simulation.habitat,
      sim = new FishSimulation(spawnFish(h), h),
      pair = sim.fish.filter((f) => f.host),
      home = pair[0].host!;
    let peak = 0;
    for (let i = 0; i < 600; i++) {
      const old = pair.map((f) => ({ ...f.position }));
      sim.advance(1 / 30, true, {
        position: home.position,
        velocity: zero,
        active: true,
      });
      pair.forEach((f, k) => {
        peak = Math.max(peak, f.reaction.scatter);
        expect(
          Math.hypot(
            f.position.x - old[k].x,
            f.position.y - old[k].y,
            f.position.z - old[k].z,
          ),
        ).toBeLessThan(0.04);
        expect(homeDistance(f.position, home) + f.radius).toBeLessThanOrEqual(
          home.homeRadius + 1e-6,
        );
      });
    }
    expect(peak).toBeGreaterThan(0.1);
    for (let i = 0; i < 2400; i++)
      sim.advance(1 / 30, true, {
        position: SPAWN,
        velocity: zero,
        active: true,
      });
    for (const f of pair) {
      expect(f.reaction.scatter).toBeLessThan(0.01);
      expect(homeDistance(f.position, home)).toBeLessThan(2.3);
      expect(f.corrections).toBe(0);
    }
  });
  it('holds outside excursions smoothly and returns a displaced pair member without a teleport', () => {
    const h = a.fish.simulation.habitat,
      fish = spawnFish(h),
      f = fish.find((f) => f.host)!,
      home = f.host!;
    const offset = {
      x: home.position.x + 2.3,
      y: home.position.y,
      z: home.position.z,
    };
    expect(safeFishPosition(offset, f.radius, h)).toBe(true);
    Object.assign(f.position, offset);
    Object.assign(f.previousPosition, offset);
    f.yaw = 0;
    f.pitch = 0;
    f.speed = 0.6;
    const sim = new FishSimulation(fish, h);
    let max = 0;
    for (let i = 0; i < 900; i++) {
      sim.advance(1 / 30, true);
      max = Math.max(max, homeDistance(f.position, home));
    }
    expect(max + f.radius).toBeLessThanOrEqual(home.homeRadius + 0.001);
    expect(homeDistance(f.position, home)).toBeLessThan(2);
  });
  it('renders three white/dark bordered bands on a broad rounded clownfish body with articulated fins', () => {
    const f = a.fish.simulation.fish.find((f) => f.host)!,
      template = a.fish.templates.find(
        (t) => t.species.id === 'ocellaris-clownfish',
      )!;
    const columns = new Set<number>();
    let white = 0,
      dark = 0;
    for (const g of [...template.geometries].slice(0, 2)) {
      const p = g.attributes.position,
        c = g.attributes.color;
      for (let i = 0; i < p.count; i++) {
        if (c.getX(i) > 0.7 && c.getY(i) > 0.7 && c.getZ(i) > 0.6) {
          white++;
          columns.add(
            Math.round(
              (p.getX(i) / f.species.length +
                (g === [...template.geometries][1] ? -0.12 : 0)) *
                10,
            ),
          );
        }
        if (c.getX(i) < 0.06 && c.getY(i) < 0.06 && c.getZ(i) < 0.06) dark++;
      }
    }
    expect(white).toBeGreaterThan(100);
    expect(dark).toBeGreaterThan(100);
    expect(columns.size).toBeGreaterThanOrEqual(3);
    expect(f.species.profile).not.toEqual(FISH_SPECIES[0].profile);
    expect(f.species.roundedFins).toBe(true);
  });
  it('validates every sampled moray body and head pose against the real hollow log and whole scene', () => {
    const m = a.anchoredLife.moray,
      g = m.geometry,
      p = g.attributes.position,
      t = g.attributes.morayT;
    const center = new THREE.Vector3(),
      before = new THREE.Vector3(),
      after = new THREE.Vector3(),
      side = new THREE.Vector3(),
      up = new THREE.Vector3(),
      tangent = new THREE.Vector3(),
      v = new THREE.Vector3();
    for (const extension of [0, 0.6, 0.8, 1])
      for (const phase of [0, 3, 7])
        for (let i = 0; i < p.count; i += 3) {
          const u = t.getX(i);
          morayCenter(u, extension, phase, center);
          morayCenter(Math.max(0, u - 0.002), extension, phase, before);
          morayCenter(Math.min(1, u + 0.002), extension, phase, after);
          tangent.subVectors(after, before).normalize();
          side.crossVectors(new THREE.Vector3(0, 1, 0), tangent).normalize();
          up.crossVectors(tangent, side).normalize();
          v.copy(center)
            .addScaledVector(side, p.getX(i))
            .addScaledVector(up, p.getY(i));
          expect(g.boundingBox!.containsPoint(v)).toBe(true);
          v.applyMatrix4(m.root.matrixWorld);
          expect(safeFishPosition(v, 0.003, a.fish.simulation.habitat)).toBe(
            true,
          );
        }
    expect(m.headGeometry.attributes.position.count).toBeGreaterThan(500);
    const colors = m.geometry.attributes.color;
    expect(
      new Set(
        Array.from({ length: colors.count }, (_, i) =>
          colors.getX(i).toFixed(2),
        ),
      ).size,
    ).toBeGreaterThanOrEqual(3);
  });
  it('keeps moray surface winding consistent with its outward lighting normals', () => {
    const g = a.anchoredLife.moray.geometry,
      p = g.attributes.position,
      n = g.attributes.normal;
    const x = new THREE.Vector3(),
      y = new THREE.Vector3(),
      z = new THREE.Vector3(),
      normal = new THREE.Vector3();
    for (let i = 0; i < p.count; i += 3) {
      x.fromBufferAttribute(p, i);
      y.fromBufferAttribute(p, i + 1).sub(x);
      z.fromBufferAttribute(p, i + 2).sub(x);
      normal.fromBufferAttribute(n, i);
      y.cross(z);
      if (y.lengthSq() > 1e-14)
        expect(y.normalize().dot(normal)).toBeGreaterThan(0);
    }
  });
  it('cycles through calm hidden, peek, rest, emergence and retreat states, mostly concealed or stationary', () => {
    const c = new MorayBehavior(),
      seen = new Set<MorayState>();
    let quiet = 0,
      peak = 0,
      last = 0;
    for (let i = 0; i < 12000; i++) {
      c.update(1 / 30, true, false);
      seen.add(c.state);
      if (c.state === 'hidden' || c.state === 'resting') quiet++;
      expect(Math.abs(c.extension - last)).toBeLessThan(0.04);
      last = c.extension;
      peak = Math.max(peak, c.extension);
    }
    expect([...seen].sort()).toEqual([
      'emerging',
      'hidden',
      'peeking',
      'resting',
      'retreating',
    ]);
    expect(quiet / 12000).toBeGreaterThan(0.6);
    expect(peak).toBeGreaterThan(0.96);
  });
  it('retreats in response to contact/proximity instead of blocking the entire log with an invisible collider', () => {
    const m = a.anchoredLife.moray;
    for (let i = 0; i < 1500; i++) m.update(1 / 30, true, false);
    const before = m.behavior.extension;
    for (let i = 0; i < 300; i++)
      m.update(1 / 30, true, false, {
        position: m.anchor.position,
        velocity: zero,
        active: true,
      });
    expect(before).toBeGreaterThan(0.5);
    expect(m.behavior.extension).toBeLessThan(0.02);
    expect(['hidden', 'retreating']).toContain(m.behavior.state);
    expect(m.behavior.retreats).toBeGreaterThan(0);
    expect(a.collision.colliders).toHaveLength(139);
  });
  it('freezes all anchored poses on pause and settles optional motion with reduced motion', () => {
    const l = a.anchoredLife;
    for (let i = 0; i < 120; i++) l.update(1 / 30, true, false);
    const before = {
      anemone: l.anemone.clock.time,
      eel: l.moray.clock.time,
      behavior: { ...l.moray.behavior },
      head: l.moray.head.position.clone(),
      jaw: l.moray.jaw.rotation.x,
    };
    l.update(3600, false, false);
    expect(l.anemone.clock.time).toBe(before.anemone);
    expect(l.moray.clock.time).toBe(before.eel);
    expect({ ...l.moray.behavior }).toEqual(before.behavior);
    expect(l.moray.head.position).toEqual(before.head);
    for (let i = 0; i < 900; i++) l.update(1 / 30, true, true);
    const aTime = l.anemone.clock.time,
      eTime = l.moray.clock.time;
    for (let i = 0; i < 60; i++) l.update(1 / 30, true, true);
    expect(l.anemone.clock.time - aTime).toBeLessThan(1e-6);
    expect(l.moray.clock.time - eTime).toBeLessThan(1e-6);
    l.update(1 / 30, true, false);
    expect(l.anemone.clock.time).toBeGreaterThan(aTime);
    expect(l.moray.clock.time).toBeGreaterThan(eTime);
  });
  it('keeps anchored behavior and normal fish deterministic across render schedules', () => {
    const h = a.fish.simulation.habitat;
    const results = [30, 60, 120].map((fps) => {
      const s = new FishSimulation(spawnFish(h), h);
      for (let i = 0; i < fps * 10; i++) s.advance(1 / fps, true);
      return s.fish;
    });
    expect(results[1]).toEqual(results[0]);
    expect(results[2]).toEqual(results[0]);
    const run = () => {
      const c = new MorayBehavior();
      for (let i = 0; i < 9000; i++) c.update(1 / 30, true, false);
      return c;
    };
    expect(run()).toEqual(run());
  });
  it('keeps the actual moray controller and rig equivalent across render frame rates', () => {
    const results = [30, 60, 120].map((fps) => {
      const m = new Moray(a.fish.simulation.habitat, a.ornaments.anchors);
      try {
        for (let i = 0; i < fps * 60; i++) m.update(1 / fps, true, false);
        return {
          behavior: { ...m.behavior },
          phase: m.clock.time,
          position: m.head.position.toArray(),
          jaw: m.jaw.rotation.x,
        };
      } finally {
        m.dispose();
      }
    });
    expect(results[1]).toEqual(results[0]);
    expect(results[2]).toEqual(results[0]);
  });
  it('disposes anchored resources once and detaches their roots', () => {
    const l = a.anchoredLife,
      resources = [
        l.anemone.geometry,
        l.anemone.material,
        l.moray.geometry,
        l.moray.headGeometry,
        l.moray.jawGeometry,
        l.moray.material,
        l.moray.headMaterial,
      ],
      spies = resources.map((r) => vi.spyOn(r, 'dispose'));
    l.dispose();
    l.dispose();
    spies.forEach((s) => expect(s).toHaveBeenCalledTimes(1));
    expect(l.root.parent).toBeNull();
    expect(l.root.children).toHaveLength(0);
  });
});
