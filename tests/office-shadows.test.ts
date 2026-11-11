import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { OFFICE, OFFICE_FOOTPRINTS } from '../src/config/office';
import {
  SHADOW,
  contactShadowGeometry,
  officeShadowLayout,
} from '../src/environment/office/ContactShadows';
import { OfficeEnvironment } from '../src/environment/office/OfficeEnvironment';

describe('Pass 022 office contact shadows', () => {
  const layout = officeShadowLayout();
  it('puts a patch under every piece of furniture and a band along every wall', () => {
    for (const box of OFFICE_FOOTPRINTS) {
      const cx = (box.min.x + box.max.x) / 2,
        cz = (box.min.z + box.max.z) / 2;
      expect(
        layout.patches.some(
          (p) =>
            Math.abs(p.center.x - cx) < 1e-9 &&
            Math.abs(p.center.z - cz) < 1e-9,
        ),
      ).toBe(true);
    }
    expect(layout.walls).toHaveLength(4);
  });
  it('is one floor-level geometry whose darkness fades out from each footprint', () => {
    const g = contactShadowGeometry(layout);
    try {
      const pos = g.getAttribute('position'),
        col = g.getAttribute('color');
      expect(col.itemSize).toBe(4);
      const maxStrength = Math.max(
        ...layout.patches.map((p) => p.strength),
        ...layout.walls.map((w) => w.strength),
      );
      const r = OFFICE.room;
      for (let i = 0; i < pos.count; i++) {
        expect(pos.getY(i)).toBeCloseTo(SHADOW.lift, 9);
        expect(col.getW(i)).toBeGreaterThanOrEqual(0);
        expect(col.getW(i)).toBeLessThanOrEqual(maxStrength + 1e-9);
        // Nothing spills through the walls.
        expect(pos.getX(i)).toBeGreaterThanOrEqual(r.min.x - 1e-9);
        expect(pos.getX(i)).toBeLessThanOrEqual(r.max.x + 1e-9);
        expect(pos.getZ(i)).toBeGreaterThanOrEqual(r.min.z - 1e-9);
        expect(pos.getZ(i)).toBeLessThanOrEqual(r.max.z + 1e-9);
      }
      // Darkness falls with distance outside a footprint: sample the tank stand's patch.
      const stand = layout.patches.find(
        (p) => p.center.x === OFFICE.stand.center.x,
      )!;
      const edge = stand.center.x - stand.size.x / 2;
      let inner = 0,
        outer = Infinity;
      for (let i = 0; i < pos.count; i++) {
        // Vertices on the straight part of the stand's room-facing (-x) edge.
        if (
          pos.getX(i) > stand.center.x ||
          Math.abs(pos.getZ(i) - stand.center.z) >
            stand.size.z / 2 - stand.round + 1e-6
        )
          continue;
        const d = edge - pos.getX(i);
        if (Math.abs(d) < 1e-6) inner = Math.max(inner, col.getW(i));
        if (Math.abs(d - stand.spread) < 1e-6)
          outer = Math.min(outer, col.getW(i));
      }
      expect(inner).toBeCloseTo(stand.strength, 6);
      expect(outer).toBe(0);
      // A non-degenerate, indexed mesh.
      expect(g.getIndex()!.count % 3).toBe(0);
      expect(g.getIndex()!.count).toBeGreaterThan(300);
    } finally {
      g.dispose();
    }
  });
  it('is a single mesh in the office, disposed with it', () => {
    const office = new OfficeEnvironment(),
      shadows: THREE.Mesh[] = [];
    office.root.traverse((o) => {
      if (o instanceof THREE.Mesh && o.name === 'Office contact shadows')
        shadows.push(o);
    });
    expect(shadows).toHaveLength(1);
    const material = shadows[0].material as THREE.MeshBasicMaterial;
    expect(material.transparent).toBe(true);
    expect(material.depthWrite).toBe(false);
    let geometryDisposed = 0,
      materialDisposed = 0;
    shadows[0].geometry.addEventListener('dispose', () => geometryDisposed++);
    material.addEventListener('dispose', () => materialDisposed++);
    office.dispose();
    office.dispose();
    expect(geometryDisposed).toBe(1);
    expect(materialDisposed).toBe(1);
  });
});
