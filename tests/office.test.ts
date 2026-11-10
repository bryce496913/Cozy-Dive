import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { AQUARIUM } from '../src/config/world';
import { OFFICE, TANK, TANK_SCALE } from '../src/config/office';
import { OfficeEnvironment } from '../src/environment/office/OfficeEnvironment';
import { miniatureView } from '../src/rendering/OfficeScene';
import {
  OFFICE_AUDIO,
  bubbleGain,
  clockTicks,
} from '../src/audio/OfficeAmbience';

describe('Pass 020 office environment', () => {
  it('builds the room in a handful of draw calls, inside the walls, and exposes the tank', () => {
    const office = new OfficeEnvironment();
    try {
      office.root.updateMatrixWorld(true);
      const meshes: THREE.Mesh[] = [];
      office.root.traverse((o) => {
        if (o instanceof THREE.Mesh) meshes.push(o);
      });
      expect(meshes.length).toBeLessThanOrEqual(26);
      const room = new THREE.Box3(
        new THREE.Vector3(
          OFFICE.room.min.x,
          OFFICE.room.min.y,
          OFFICE.room.min.z,
        ),
        new THREE.Vector3(
          OFFICE.room.max.x,
          OFFICE.room.max.y,
          OFFICE.room.max.z,
        ),
      ).expandByScalar(0.001);
      for (const m of meshes) {
        // The window recess, its glass and the garden lie beyond the back wall by design.
        if (/Garden|Rainy window/.test(m.name)) continue;
        const box = new THREE.Box3().setFromObject(m);
        if (m.name === 'Office paint')
          box.min.z = Math.max(box.min.z, OFFICE.room.min.z);
        expect(room.containsBox(box), m.name).toBe(true);
      }
      // Four glass panels enclose exactly the scaled aquarium volume on the stand.
      expect(office.tankGlass).toHaveLength(4);
      const glass = new THREE.Box3();
      for (const g of office.tankGlass) glass.expandByObject(g);
      const corners = [
        new THREE.Vector3(AQUARIUM.min.x, AQUARIUM.min.y, AQUARIUM.min.z),
        new THREE.Vector3(AQUARIUM.max.x, AQUARIUM.max.y, AQUARIUM.max.z),
      ].map((c) =>
        c.multiplyScalar(TANK_SCALE).applyMatrix4(office.tankRoot.matrixWorld),
      );
      const mapped = new THREE.Box3().setFromPoints(corners);
      expect(glass.min.distanceTo(mapped.min)).toBeLessThan(1e-6);
      expect(glass.max.distanceTo(mapped.max)).toBeLessThan(1e-6);
      expect(mapped.min.y).toBeCloseTo(OFFICE.stand.size.y, 9);
      // The aquarium's front (+z) faces into the room (-x).
      const front = new THREE.Vector3(0, 0, 1).applyQuaternion(
        office.tankRoot.quaternion,
      );
      expect(front.x).toBeCloseTo(-1, 9);
      expect(office.lampBulb.y).toBeGreaterThan(OFFICE.desk.size.y);
    } finally {
      office.dispose();
    }
  });
  it('animates the clock as time of day and freezes the rain with reduced motion', () => {
    const office = new OfficeEnvironment();
    try {
      const hands: THREE.Object3D[] = [];
      office.root.getObjectByName('Wall clock')!.traverse((o) => {
        if (o.type === 'Group' && o.name === '') hands.push(o);
      });
      office.update(15 * 3600 + 30 * 60 + 15, false, 1 / 60);
      const second = hands[2].rotation.z;
      expect(second).toBeCloseTo(-(15 / 60) * Math.PI * 2, 9);
      office.update(15 * 3600 + 30 * 60 + 15.5, false, 1 / 60);
      expect(hands[2].rotation.z).toBe(second); // the second hand steps once a second
      const rain = office.root.getObjectByName('Rainy window') as THREE.Mesh,
        uniforms = (rain.material as THREE.ShaderMaterial).uniforms;
      const before = uniforms.time.value as number;
      office.update(100, true, 1 / 60);
      expect(uniforms.time.value).toBe(before);
      office.update(100, false, 1 / 60);
      expect(uniforms.time.value).toBeGreaterThan(before);
    } finally {
      office.dispose();
    }
  });
  it('disposes every geometry, material and texture once', () => {
    const office = new OfficeEnvironment(),
      disposed = new Set<object>(),
      owned = new Set<object>();
    office.root.traverse((o) => {
      if (!(o instanceof THREE.Mesh)) return;
      owned.add(o.geometry);
      const m = o.material as THREE.Material;
      owned.add(m);
    });
    const spy = (proto: { dispose(): void }) =>
      vi.spyOn(proto, 'dispose').mockImplementation(function (this: object) {
        expect(disposed.has(this)).toBe(false);
        disposed.add(this);
      });
    const spies = [
      spy(THREE.BufferGeometry.prototype),
      spy(THREE.Material.prototype),
      spy(THREE.Texture.prototype),
    ];
    try {
      office.dispose();
      office.dispose();
      for (const o of owned) expect(disposed.has(o)).toBe(true);
      expect([...disposed].some((d) => d instanceof THREE.Texture)).toBe(true);
      expect(office.root.children).toHaveLength(0);
    } finally {
      spies.forEach((s) => s.mockRestore());
    }
  });
});

describe('Pass 020 miniature aquarium view', () => {
  it('sees exactly what a one-metre tank in the office would', () => {
    const office = new OfficeEnvironment();
    try {
      office.root.updateMatrixWorld(true);
      const tank = office.tankRoot.matrixWorld,
        inverse = tank.clone().invert(),
        rotation = new THREE.Quaternion();
      tank.decompose(new THREE.Vector3(), rotation, new THREE.Vector3());
      const eye = new THREE.PerspectiveCamera(66, 16 / 10, 0.05, 30),
        mini = new THREE.PerspectiveCamera(66, 16 / 10, 0.05 / TANK_SCALE, 260);
      eye.position.set(1.2, 1.5, 0.4);
      eye.lookAt(TANK.position.x, TANK.position.y + 0.2, TANK.position.z);
      eye.updateMatrixWorld();
      miniatureView(
        eye.position,
        eye.quaternion,
        inverse,
        rotation,
        mini.position,
        mini.quaternion,
      );
      mini.updateMatrixWorld();
      // Any aquarium point projects to the same screen position in both views.
      for (const p of [
        [0, 2, 0],
        [-15, 1, 12],
        [14, 12, -10],
        [3, 7, 9],
      ] as const) {
        const aquarium = new THREE.Vector3(...p),
          inOffice = aquarium
            .clone()
            .multiplyScalar(TANK_SCALE)
            .applyMatrix4(tank),
          a = aquarium.clone().project(mini),
          b = inOffice.project(eye);
        expect(a.x).toBeCloseTo(b.x, 6);
        expect(a.y).toBeCloseTo(b.y, 6);
      }
      // From the room the eye is tens of aquarium units away, so distance levels engage.
      expect(mini.position.length()).toBeGreaterThan(30);
    } finally {
      office.dispose();
    }
  });
});

describe('Pass 020 office ambience', () => {
  it('ticks the clock once a second, alternating tick and tock', () => {
    const ticks = clockTicks(10.2, 13.05);
    expect(ticks.map((t) => t.time)).toEqual([11, 12, 13]);
    expect(ticks.map((t) => t.tock)).toEqual([true, false, true]);
    expect(clockTicks(13.05, 13.2)).toEqual([]);
  });
  it('lets the tank bubbling rise as you approach and stay faint across the room', () => {
    expect(bubbleGain(0.3)).toBe(OFFICE_AUDIO.bubbleLevel);
    expect(bubbleGain(1.5)).toBeLessThan(bubbleGain(1));
    expect(bubbleGain(5)).toBeLessThan(OFFICE_AUDIO.bubbleLevel * 0.1);
    for (let d = 0; d < 8; d += 0.25) expect(bubbleGain(d)).toBeGreaterThan(0);
  });
});
