import * as THREE from 'three';
import { WRECK } from '../../config/wreck';
import type { ConvexCollider } from '../../player/collision';
import { boxCollider } from '../passage/Crevice';
import { shaftColliders, shaftLining } from '../shared/Shaft';
import { ShipwreckModel } from './ShipwreckModel';
import { HabitatSurface } from '../shared/HabitatSurface';
import { PassageGlow } from '../shared/PassageGlow';
import { limestoneGeometry } from '../shared/LimestoneGeometry';
import {
  SHIP,
  hullHalfWidth,
  wreckColliders,
  wreckFloor,
  wreckRoof,
} from './WreckLayout';

/**
 * The wreck's cavern: a sandy floor with scattered rock and debris, rumpled rock walls and roof,
 * the shaft rising through the roof to the kelp forest, and the shipwreck itself. Everything solid
 * is in `colliders`. Owns its GPU objects.
 */
const SHAFT_RADIUS = 1.6;
/** The roof's collision lies flat just above its lowest bulge. */
const ROOF_SOLID = WRECK.ceiling - 0.7;

function random(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}
function colourBy(
  g: THREE.BufferGeometry,
  rgb: (x: number, y: number, z: number) => readonly [number, number, number],
): void {
  const p = g.getAttribute('position'),
    c = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++)
    c.set(rgb(p.getX(i), p.getY(i), p.getZ(i)), i * 3);
  g.setAttribute('color', new THREE.Float32BufferAttribute(c, 3));
}

export class WreckEnvironment {
  readonly root = new THREE.Group();
  /**
   * V0.8 Pass 089: faint daylight from the kelp forest far above, seeping down the shaft: the way
   * home stays findable through the shared dense murk, where the dark hole in the roof is lost.
   */
  private readonly homeGlow: PassageGlow;
  readonly colliders: ConvexCollider[];
  readonly ship = new ShipwreckModel();
  private readonly geometries: THREE.BufferGeometry[] = [];
  private readonly materials: THREE.Material[] = [];
  private readonly stone = new HabitatSurface('limestone');
  private readonly sediment = new HabitatSurface('sediment');

  constructor() {
    this.root.name = 'Wreck cavern';
    // V0.7 Pass 081: the cavern's sand, walls, roof and fallen rock were plain vertex colour, the
    // last unmapped rock and seabed in the game (Pass 080 rule: every rock wears a mapped
    // surface). They now use the shared world-space surfaces, under the same murky tints.
    const rock = this.stone.material({
        name: 'Wreck rock',
        vertexColors: true,
        roughness: 0.9,
      }),
      inside = this.stone.material({
        name: 'Wreck shaft rock',
        vertexColors: true,
        roughness: 0.9,
        side: THREE.BackSide,
      }),
      sand = this.sediment.material({
        name: 'Wreck sand',
        vertexColors: true,
        roughness: 1,
      });
    this.materials.push(rock, inside, sand);
    const add = (g: THREE.BufferGeometry, m: THREE.Material, name: string) => {
      this.geometries.push(g);
      const mesh = new THREE.Mesh(g, m);
      mesh.name = name;
      mesh.matrixAutoUpdate = false;
      this.root.add(mesh);
    };
    const w = WRECK.walls,
      s = WRECK.shaft,
      width = w.x * 2 + 8,
      depth = w.nearZ - w.farZ + 8,
      midZ = (w.nearZ + w.farZ) / 2;

    // The sandy floor, pale where it is open, greyer where the scour runs along the hull.
    const floor = new THREE.PlaneGeometry(width, depth, 120, 140);
    floor.rotateX(-Math.PI / 2);
    floor.translate(0, 0, midZ);
    const fp = floor.getAttribute('position');
    for (let i = 0; i < fp.count; i++)
      fp.setY(i, wreckFloor(fp.getX(i), fp.getZ(i)));
    colourBy(floor, (x, _y, z) => {
      const k =
        0.42 +
        0.06 * Math.sin(x * 2.7 + z * 1.9) * Math.sin(x * 1.3 - z * 2.2) -
        (Math.abs(x) < SHIP.half + 2 && z > SHIP.bowZ - 2 && z < SHIP.sternZ + 2
          ? 0.08
          : 0);
      return [k * 0.95, k * 0.88, k * 0.74];
    });
    floor.computeVertexNormals();
    add(floor, sand, 'Wreck sand');

    // The roof: rumpled rock seen from below, open at the shaft.
    const roof = new THREE.PlaneGeometry(width, depth, 100, 110);
    roof.rotateX(Math.PI / 2);
    roof.translate(0, 0, midZ);
    const rp = roof.getAttribute('position');
    for (let i = 0; i < rp.count; i++)
      rp.setY(i, wreckRoof(rp.getX(i), rp.getZ(i)));
    colourBy(roof, (x, y) => {
      const k = 0.2 + 0.05 * Math.sin(x * 1.7 + y * 3);
      return [k, k * 0.95, k * 0.9];
    });
    const open = roof.toNonIndexed();
    roof.dispose();
    // Drop the triangles over the shaft's mouth.
    const op = open.getAttribute('position'),
      keep: number[] = [],
      oc = open.getAttribute('color'),
      colours: number[] = [];
    for (let t = 0; t < op.count; t += 3) {
      const cx = (op.getX(t) + op.getX(t + 1) + op.getX(t + 2)) / 3,
        cz = (op.getZ(t) + op.getZ(t + 1) + op.getZ(t + 2)) / 3;
      if (Math.hypot(cx - s.x, cz - s.z) < SHAFT_RADIUS + 0.35) continue;
      for (let k = 0; k < 3; k++) {
        keep.push(op.getX(t + k), op.getY(t + k), op.getZ(t + k));
        colours.push(oc.getX(t + k), oc.getY(t + k), oc.getZ(t + k));
      }
    }
    open.dispose();
    const ceiling = new THREE.BufferGeometry();
    ceiling.setAttribute('position', new THREE.Float32BufferAttribute(keep, 3));
    ceiling.setAttribute('color', new THREE.Float32BufferAttribute(colours, 3));
    ceiling.computeVertexNormals();
    add(ceiling, rock, 'Wreck roof');

    // The walls: four lumpy rock faces from below the sand to above the roof.
    const wall = (
      length: number,
      along: 'x' | 'z',
      at: number,
      facing: number,
    ) => {
      const g = new THREE.PlaneGeometry(length, WRECK.ceiling + 6, 70, 20),
        p = g.getAttribute('position');
      for (let i = 0; i < p.count; i++) {
        const u = p.getX(i),
          v = p.getY(i) + (WRECK.ceiling + 6) / 2 - 3,
          // Bulging outwards only, so nothing juts into the swimming space.
          out =
            0.6 +
            0.5 * Math.sin(u * 0.4 + v * 0.3) +
            0.3 * Math.sin(u * 1.3 - v * 0.9);
        p.setXYZ(i, u, v, -out);
      }
      if (along === 'x') {
        g.rotateY(facing > 0 ? 0 : Math.PI);
        g.translate(0, 0, at);
      } else {
        g.rotateY(facing > 0 ? Math.PI / 2 : -Math.PI / 2);
        g.translate(at, 0, midZ);
      }
      colourBy(g, (x, y, z) => {
        const k = 0.24 + 0.05 * Math.sin(x * 0.9 + y * 1.3 + z * 0.7);
        return [k, k * 0.96, k * 0.9];
      });
      g.computeVertexNormals();
      return g;
    };
    add(wall(width, 'x', w.farZ, 1), rock, 'Wreck far wall');
    add(wall(width, 'x', w.nearZ, -1), rock, 'Wreck near wall');
    add(wall(depth, 'z', -w.x, 1), rock, 'Wreck west wall');
    add(wall(depth, 'z', w.x, -1), rock, 'Wreck east wall');

    // The shaft up through the roof: darker and darker towards the threshold, capped above it.
    const shaft = {
      x: s.x,
      z: s.z,
      radius: SHAFT_RADIUS,
      top: s.top,
      // Starting just inside the roof's mouth, which rises into it.
      bottom: wreckRoof(s.x + SHAFT_RADIUS + 0.3, s.z) - 0.1,
    };
    add(
      shaftLining(shaft, (y) =>
        Math.max(0.03, 0.3 * (1 - (y - WRECK.ceiling) / 8)),
      ),
      inside,
      'Wreck shaft',
    );
    const cap = new THREE.CircleGeometry(SHAFT_RADIUS + 0.6, 20);
    cap.rotateX(Math.PI / 2);
    cap.translate(s.x, s.top, s.z);
    colourBy(cap, () => [0.01, 0.01, 0.01]);
    add(cap, rock, 'Wreck shaft top');
    this.homeGlow = new PassageGlow({
      name: 'Wreck shaft glow',
      at: { x: s.x, y: wreckRoof(s.x, s.z) + 2.5, z: s.z },
      facing: { x: 0, y: -1, z: 0 },
      radius: SHAFT_RADIUS * 0.95,
      tint: [0.42, 0.66, 0.56],
      peak: 0.5,
    });
    this.root.add(this.homeGlow.mesh);

    // Rocks fallen from the roof, and debris off the wreck. V0.7 Pass 081: three carved limestone
    // forms (the Pass 079 cave family, fractured and pitted inside their hulls) replace one lumpy
    // twelve-sided lump, which read as low-poly beside the wreck's plated hull. Each is fitted to
    // the old lump's unit size and flattening, so placements and colliders are unchanged.
    const rand = random(7331),
      FORMS = 3,
      forms = Array.from({ length: FORMS }, (_, k) => {
        const g = limestoneGeometry(73310 + k * 17, k, true);
        g.computeBoundingBox();
        const box = g.boundingBox!,
          size = box.getSize(new THREE.Vector3()),
          centre = box.getCenter(new THREE.Vector3());
        g.translate(-centre.x, -centre.y, -centre.z);
        g.scale(2.2 / size.x, (2.2 * 0.7) / size.y, 2.2 / size.z);
        // The cavern's dark rock, from the carving's own light-to-shadow tone.
        const c = g.getAttribute('color');
        for (let i = 0; i < c.count; i++)
          c.setXYZ(i, c.getX(i) * 0.36, c.getY(i) * 0.35, c.getZ(i) * 0.34);
        this.geometries.push(g);
        const mesh = new THREE.InstancedMesh(g, rock, 26);
        mesh.name = `Wreck rocks ${k + 1}`;
        mesh.count = 0;
        return mesh;
      });
    const m = new THREE.Matrix4(),
      q = new THREE.Quaternion(),
      e = new THREE.Euler(),
      sc = new THREE.Vector3(),
      at = new THREE.Vector3(),
      rockColliders: ConvexCollider[] = [];
    for (let i = 0; i < 26; i++) {
      let x = 0,
        z = 0;
      for (let tries = 0; tries < 30; tries++) {
        x = (rand() * 2 - 1) * (w.x - 3);
        z = w.farZ + 3 + rand() * (w.nearZ - w.farZ - 6);
        const clearShip =
          Math.abs(x) > hullHalfWidth(z) + 3 ||
          z < SHIP.bowZ - 3 ||
          z > SHIP.sternZ + 3;
        if (clearShip) break;
      }
      const size = 0.4 + rand() * rand() * 1.8;
      e.set(rand() * 0.4, rand() * Math.PI * 2, rand() * 0.4);
      q.setFromEuler(e);
      at.set(x, wreckFloor(x, z) + size * 0.25, z);
      const form = forms[i % FORMS];
      form.setMatrixAt(
        form.count++,
        m.compose(at, q, sc.set(size, size, size)),
      );
      if (size > 0.8)
        rockColliders.push(
          boxCollider(
            [x - size * 0.7, at.y - size * 0.5, z - size * 0.7],
            [x + size * 0.7, at.y + size * 0.5, z + size * 0.7],
          ),
        );
    }
    for (const form of forms) form.instanceMatrix.needsUpdate = true;
    this.root.add(...forms, this.ship.root);

    // Solid: the ship, the roof (open at the shaft), the shaft's rock, and its cap.
    const R = SHAFT_RADIUS + 0.2,
      x0 = -w.x - 4,
      x1 = w.x + 4,
      z0 = w.farZ - 4,
      z1 = w.nearZ + 4,
      y0 = ROOF_SOLID,
      y1 = WRECK.ceiling + 6;
    this.colliders = [
      ...wreckColliders(),
      ...rockColliders,
      boxCollider([x0, y0, z0], [x1, y1, s.z - R]),
      boxCollider([x0, y0, s.z + R], [x1, y1, z1]),
      boxCollider([x0, y0, s.z - R], [s.x - R, y1, s.z + R]),
      boxCollider([s.x + R, y0, s.z - R], [x1, y1, s.z + R]),
      ...shaftColliders({ ...shaft, bottom: y0, top: s.top + 1 }, 1.2),
      boxCollider([s.x - 3, s.top, s.z - 3], [s.x + 3, s.top + 1, s.z + 3]),
    ];
  }
  /** Fade the shaft's glow with the eye's distance (every frame, any motion setting). */
  updatePassages(eye: THREE.Vector3Like): void {
    this.homeGlow.update(eye);
  }
  dispose(): void {
    this.root.removeFromParent();
    this.homeGlow.dispose();
    this.ship.dispose();
    this.root.traverse((o) => {
      if (o instanceof THREE.InstancedMesh) o.dispose();
    });
    this.root.clear();
    this.geometries.forEach((g) => g.dispose());
    this.materials.forEach((m) => m.dispose());
    this.stone.dispose();
    this.sediment.dispose();
  }
}
