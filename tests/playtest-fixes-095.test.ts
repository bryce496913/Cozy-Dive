import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { KELP } from '../src/config/passage';
import {
  KelpEnvironment,
  KELP_WALL_FACE,
} from '../src/environment/kelp/KelpEnvironment';
import {
  LION_RAYS,
  lionBody,
  lionProfile,
  lionRayPose,
} from '../src/environment/cave/CaveVisitors';
import {
  RUDDER,
  SCREW,
  ShipwreckModel,
  sternRun,
} from '../src/environment/wreck/ShipwreckModel';
import { SHIP } from '../src/environment/wreck/WreckLayout';
import { WreckLife } from '../src/environment/wreck/WreckLife';
import { ReefAsset } from '../validation/ReefAsset';

/** V0.8 Pass 095: fixes from the MacBook playthrough. */

const mesh = (root: THREE.Object3D, name: string) => {
  let found: THREE.Mesh | undefined;
  root.traverse((o) => {
    if (o instanceof THREE.Mesh && o.name === name) found = o;
  });
  if (!found) throw Error(`no ${name}`);
  return found;
};

describe('V0.8 Pass 095 kelp forest north wall', () => {
  it('faces the forest with stacked rock, open only round the tunnel, the cut on its circle', () => {
    const kelp = new KelpEnvironment(),
      walls = mesh(kelp.root, 'Kelp tank walls').geometry,
      p = walls.getAttribute('position'),
      n = walls.getAttribute('normal'),
      t = KELP.tunnel;
    let face = 0,
      inward = 0,
      rim = 0,
      worst = 0;
    for (let i = 0; i < p.count; i++) {
      // The north face: on the wall's line (give or take its bulge), across the forest's width.
      if (Math.abs(p.getZ(i) - t.wallZ) > 1.6 || Math.abs(p.getX(i)) > 20)
        continue;
      face++;
      if (n.getZ(i) < 0) inward++;
      const d = Math.hypot(p.getX(i), p.getY(i) - t.y),
        open = t.radius + 0.35;
      // Nothing inside the opening; its edge vertices exactly on the circle.
      if (d < open + 1e-4) {
        rim++;
        worst = Math.max(worst, open - d);
      }
    }
    expect(face).toBeGreaterThan(500);
    // It was a ring facing away from the forest, culled from inside it (open water).
    expect(inward / face).toBeGreaterThan(0.85);
    // The mouth's edge lies on its circle (whole grid cells left a sawtooth crown).
    expect(rim).toBeGreaterThan(12);
    expect(worst).toBeLessThan(1e-3);
    // The plain ring behind it now faces the forest too.
    const ring = mesh(kelp.root, 'Kelp wall').geometry,
      rn = ring.getAttribute('normal');
    let toward = 0;
    for (let i = 0; i < rn.count; i++) if (rn.getZ(i) < 0) toward++;
    expect(toward / rn.count).toBeGreaterThan(0.9);
    kelp.dispose();
  });

  it('stops the swimmer just inside the north wall, like the others, with the tunnel still open', () => {
    const kelp = new KelpEnvironment(),
      t = KELP.tunnel,
      inside = (x: number, y: number, z: number) =>
        kelp.colliders.some(
          (c) =>
            x >= c.min.x &&
            x <= c.max.x &&
            y >= c.min.y &&
            y <= c.max.y &&
            z >= c.min.z &&
            z <= c.max.z,
        );
    expect(inside(6, 5, t.wallZ - KELP_WALL_FACE + 0.1)).toBe(true);
    expect(inside(0, t.y, t.wallZ - KELP_WALL_FACE + 0.1)).toBe(false);
    kelp.dispose();
  });
});

describe('V0.8 Pass 095 shipwreck stern', () => {
  it('runs every undercut plating row fine into the sternpost (no hole between the sides)', () => {
    expect(sternRun(SHIP.sternZ - 2.5, SHIP.sternZ - 2.5)).toBe(0);
    expect(sternRun(SHIP.sternZ - 5, SHIP.sternZ - 2.5)).toBe(1);
    // Rows at the counter, which already close, are untouched.
    expect(sternRun(SHIP.sternZ, SHIP.sternZ)).toBe(1);
  });

  it('keeps the rudder clear of the screw, and hangs it from a stock', () => {
    const blades = SCREW.z + 0.16,
      leading = RUDDER.z - RUDDER.chord / 2;
    expect(leading - blades).toBeGreaterThan(0.2);
    expect(RUDDER.stockTop).toBeGreaterThan(5);
    const model = new ShipwreckModel();
    model.dispose();
  });

  it('hangs the stern grouper beside the rudder, not inside it', () => {
    const loader = {
        acquire: () => Promise.reject(Error('no assets in tests')),
        evictUnused: () => undefined,
      } as unknown as ConstructorParameters<typeof WreckLife>[0],
      life = new WreckLife(loader),
      g = life.sternGrouper.position;
    // The grouper is about a metre long: half of it either side of its centre.
    const clear =
      Math.abs(g.x) - 0.5 > 0.1 ||
      g.z + 0.5 < RUDDER.z - RUDDER.chord / 2 ||
      g.z - 0.5 > RUDDER.z + RUDDER.chord / 2;
    expect(clear).toBe(true);
    life.dispose();
  });
});

describe('V0.8 Pass 095 lionfish', () => {
  it('has a deep, compressed body with a slim tail stalk', () => {
    const [top, belly, half] = lionProfile(0.02),
      [ptop, pbelly] = lionProfile(-0.15);
    expect(top - belly).toBeGreaterThan(half * 4);
    expect(ptop - pbelly).toBeLessThan((top - belly) * 0.4);
    const g = lionBody();
    expect(g.getAttribute('position').count).toBeGreaterThan(10000);
    g.dispose();
  });

  it('splays its dorsal spines to either side and fans each pectoral ray its own way', () => {
    const m = new THREE.Matrix4(),
      dir = new THREE.Vector3(),
      tips: THREE.Vector3[] = [];
    for (let r = 0; r < LION_RAYS; r++) {
      lionRayPose(r, 1, m);
      tips.push(dir.set(0, 1, 0).transformDirection(m).clone());
    }
    const dorsal = tips.slice(0, 13);
    // Head-on, the crest reads as a crest: spines lean both ways.
    expect(dorsal.some((d) => d.x > 0.05)).toBe(true);
    expect(dorsal.some((d) => d.x < -0.05)).toBe(true);
    // Alarmed, the spines stand up.
    expect(dorsal[2].y).toBeGreaterThan(0.8);
    // Each fan spreads over a wide arc (it was the same rotation for every ray, a plank).
    for (const fan of [tips.slice(13, 21), tips.slice(21, 29)]) {
      expect(fan[0].angleTo(fan[fan.length - 1])).toBeGreaterThan(1.5);
      expect(Math.sign(fan[0].x)).toBe(Math.sign(fan[7].x));
    }
    // Calm, the spines lie back and the fans close toward the flanks.
    lionRayPose(2, 0, m);
    expect(dir.set(0, 1, 0).transformDirection(m).z).toBeLessThan(-0.5);
  });
});

describe('V0.8 Pass 095 leopard shark', () => {
  it('is rebuilt to the Pass 092 standard (it was still the Pass 078 build)', () => {
    const a = new ReefAsset('public/assets/models/creatures/leopard-shark.glb'),
      root = a.doc.nodes.find((n) => n.name.endsWith('_Root'));
    expect((root?.extras as { standards_pass?: string }).standards_pass).toBe(
      '092',
    );
  });
});
