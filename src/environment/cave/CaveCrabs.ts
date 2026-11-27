import { benthicGait } from './BenthicGait';
import * as THREE from 'three';
import type { Vec3 } from '../../config/world';
import type { SightCandidate } from '../../discovery/journal';
import { CAVE_SIGHTS } from '../../discovery/sights';
import type { PlayerPresence } from '../../fish/FishDiverReaction';
import type { CaveRock } from './CaveEnvironment';
import { limb, merged, tinted } from './CaveLobsters';
import { caveFloor } from './CaveTerrain';
import { organicTube, toned } from '../shared/organicGeometry';

/**
 * v0.6 Pass 041: small rock crabs picking their way round the feet of the cave's boulders, built
 * in code. Each walks sideways round its rock in short bouts, pausing between them; when the
 * swimmer comes close it scuttles quickly round to the far side of the rock, and stays there
 * until they have gone. One instanced draw for all of them. Pure motion on simulation time,
 * allocation-free per frame. Owns its geometry and material.
 */
export const CRAB = {
  /** How far out from the rock's centre it walks, as a share of the rock's footprint, plus m. */
  reach: 0.55,
  clear: 0.12,
  /** Walking and scuttling speeds round the rock (m/s). */
  walk: 0.09,
  scuttle: 0.75,
  /** Bouts of walking and pauses (s). */
  bout: [1.5, 4] as const,
  pause: [2, 7] as const,
  /** Scuttles off when the swimmer is within `wary` m; calm again beyond `easy` m. */
  wary: 2.4,
  easy: 3.6,
  /** Size multiplier on the authored body (about 0.16 m across the shell). */
  scale: 1.5,
} as const;

const SHELL = [0.62, 0.24, 0.12] as const,
  DARK = [0.35, 0.12, 0.06] as const,
  CLAW = [0.78, 0.36, 0.18] as const,
  TIP = [0.12, 0.08, 0.06] as const,
  PALE = [0.86, 0.66, 0.46] as const,
  EYE = [0.03, 0.03, 0.035] as const;

/**
 * Deliberate broad shell regions and a lighter rim. Facet lighting supplies the small variation;
 * the palette no longer uses procedural noise.
 */
function mottled(
  g: THREE.BufferGeometry,
  amount: number,
  rim = 0,
): THREE.BufferGeometry {
  const p = g.getAttribute('position'),
    c = g.getAttribute('color');
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i),
      y = p.getY(i),
      z = p.getZ(i),
      patch =
        (x > 0.018 && z < -0.008) ||
        (x < -0.032 && z > 0.012) ||
        (y > 0.055 && Math.abs(x) < 0.018)
          ? 1
          : 0,
      edge = rim * Math.min(1, Math.hypot(x / 0.085, z / 0.068) ** 6),
      k = (1 - amount * patch) * (1 + edge);
    c.setXYZ(i, c.getX(i) * k, c.getY(i) * k, c.getZ(i) * k);
  }
  return g;
}

/** A tapered limb segment with a small rounded joint at its start. */
function segment(
  a: THREE.Vector3,
  b: THREE.Vector3,
  r0: number,
  r1: number,
  color: readonly [number, number, number],
  parts: THREE.BufferGeometry[],
): void {
  parts.push(mottled(limb(a, b, r0, r1, color), 0.25));
  const joint = new THREE.SphereGeometry(r0 * 1.15, 6, 4);
  joint.translate(a.x, a.y, a.z);
  parts.push(tinted(joint, DARK));
}

/** A crab facing +z (walking sideways along x), its underside at y 0. */
export function crabBody(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [],
    v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
  // The carapace: broad and flattened, widest at the front, its edges sharpened into a rim, and
  // its top raised in low regions (a soft cross of grooves between them).
  // Pass 020: purposeful broad facets carry the shell silhouette; the old dense latitude grid
  // cost more triangles than the entire walking-leg outline without adding readable anatomy.
  const shell = new THREE.SphereGeometry(1, 16, 8),
    sp = shell.getAttribute('position');
  for (let i = 0; i < sp.count; i++) {
    const x = sp.getX(i),
      y = sp.getY(i),
      z = sp.getZ(i),
      front = 1 + 0.18 * Math.max(0, z),
      top =
        y > 0
          ? 1 +
            0.25 *
              Math.abs(Math.sin(x * 3.2)) *
              Math.abs(Math.sin(z * 2.6 + 0.4))
          : 0.7,
      rim = 1 - 0.35 * Math.max(0, Math.abs(y) - 0.15);
    sp.setXYZ(
      i,
      x * 0.085 * front,
      y * 0.03 * top * rim,
      z * 0.066 * (1 - 0.08 * Math.max(0, -z)),
    );
  }
  shell.translate(0, 0.045, 0);
  parts.push(mottled(tinted(shell, SHELL), 0.35, 0.25));
  // The pale underside plate.
  const under = new THREE.SphereGeometry(
    1,
    10,
    4,
    0,
    Math.PI * 2,
    Math.PI * 0.55,
    Math.PI * 0.45,
  );
  under.scale(0.075, 0.02, 0.058);
  under.translate(0, 0.042, 0);
  parts.push(tinted(under, PALE));
  // The toothed front-side margins: small spines from beside the eyes back round each side.
  for (const side of [-1, 1])
    for (let t = 0; t < 5; t++) {
      const a = 0.25 + t * 0.26,
        x = side * Math.sin(a) * 0.088,
        z = Math.cos(a) * 0.07,
        spine = new THREE.ConeGeometry(0.008, 0.02, 5);
      spine.rotateX(Math.PI / 2);
      spine.rotateY(side * a);
      spine.translate(x, 0.046, z);
      parts.push(tinted(spine, DARK));
    }
  // Raised bumps on the shell's regions, darker.
  for (let i = 0; i < 9; i++) {
    const bump = new THREE.SphereGeometry(0.008 + 0.004 * (i % 3), 6, 4),
      a = i * 2.4,
      r = 0.02 + 0.012 * (i % 4);
    bump.translate(Math.sin(a) * r * 1.3, 0.071, Math.cos(a) * r);
    parts.push(tinted(bump, DARK));
  }
  // Mouthparts under the front, and two short antennae between the eyes.
  const mouth = new THREE.BoxGeometry(0.03, 0.014, 0.012);
  mouth.translate(0, 0.03, 0.062);
  parts.push(tinted(mouth, PALE));
  for (const side of [-1, 1]) {
    parts.push(
      limb(
        v(side * 0.006, 0.05, 0.066),
        v(side * 0.02, 0.07, 0.1),
        0.0018,
        0.0008,
        DARK,
      ),
    );
    // Eyes on stalks, glossy black.
    parts.push(
      limb(
        v(side * 0.016, 0.052, 0.058),
        v(side * 0.024, 0.074, 0.068),
        0.005,
        0.004,
        SHELL,
      ),
    );
    const eye = new THREE.SphereGeometry(0.0075, 8, 6);
    eye.translate(side * 0.025, 0.078, 0.07);
    parts.push(tinted(eye, EYE));
    // The claw: arm, wrist, a swollen palm and two toothed fingers with dark tips.
    const shoulder = v(side * 0.06, 0.04, 0.045),
      elbow = v(side * 0.1, 0.055, 0.075),
      wrist = v(side * 0.075, 0.048, 0.112);
    segment(shoulder, elbow, 0.011, 0.01, CLAW, parts);
    segment(elbow, wrist, 0.01, 0.009, CLAW, parts);
    // Spines along the arm.
    for (let k = 0; k < 3; k++) {
      const at = shoulder.clone().lerp(elbow, 0.25 + k * 0.25),
        spine = new THREE.ConeGeometry(0.003, 0.009, 4);
      spine.translate(at.x, at.y + 0.011, at.z);
      parts.push(tinted(spine, DARK));
    }
    const palm = new THREE.SphereGeometry(1, 8, 6);
    palm.scale(0.022, 0.018, 0.034);
    palm.translate(wrist.x - side * 0.004, wrist.y + 0.002, wrist.z + 0.028);
    parts.push(mottled(tinted(palm, CLAW), 0.25));
    const base = v(wrist.x - side * 0.006, wrist.y, wrist.z + 0.056);
    // Fixed finger (lower) and the moving finger (upper), each a curved pair of segments.
    for (const [dy, r] of [
      [-0.006, 0.0065],
      [0.007, 0.006],
    ] as const) {
      const mid = v(base.x - side * 0.006, base.y + dy, base.z + 0.022),
        tip = v(base.x - side * 0.016, base.y + dy * 0.4, base.z + 0.04);
      parts.push(limb(v(base.x, base.y + dy, base.z), mid, r, r * 0.75, CLAW));
      parts.push(limb(mid, tip, r * 0.75, 0.0012, TIP));
      // Teeth along the biting edge.
      for (let k = 0; k < 3; k++) {
        const tooth = new THREE.SphereGeometry(0.0022, 4, 3),
          at = v(base.x, base.y + dy, base.z).lerp(mid, 0.3 + k * 0.3);
        tooth.translate(at.x, at.y - Math.sign(dy) * r * 0.8, at.z);
        parts.push(tinted(tooth, PALE));
      }
    }
    // Four walking legs, each in three segments: out and up to a knee, down to an ankle, and a
    // pointed, darker tip on the rock; banded at the joints.
    for (let i = 0; i < 4; i++) {
      const z = 0.03 - i * 0.026,
        hip = v(side * 0.068, 0.038, z),
        knee = v(side * 0.12, 0.082, z - i * 0.008),
        ankle = v(side * 0.165, 0.04, z - 0.006 - i * 0.014),
        foot = v(side * 0.185, 0.0, z - 0.012 - i * 0.02);
      // V0.7 Pass 068: one continuous, tapering leg (no stacked cylinders and joint balls), banded
      // darker at the knee and ankle and dark at the tip.
      const leg = tinted(
        organicTube(
          [hip, knee, ankle, foot],
          (u) =>
            0.0088 * (1 - 0.8 * u ** 1.4) +
            0.0012 * Math.exp(-(((u - 0.38) / 0.05) ** 2)),
          20,
          7,
          0.85,
        ),
        i % 2 ? CLAW : SHELL,
      );
      const near = (
        q: THREE.Vector3,
        x: number,
        y: number,
        z: number,
        r: number,
      ) => Math.hypot(x - q.x, y - q.y, z - q.z) < r;
      parts.push(
        mottled(
          toned(leg, (x, y, z) =>
            near(foot, x, y, z, 0.022)
              ? 0.3
              : near(knee, x, y, z, 0.008) || near(ankle, x, y, z, 0.007)
                ? 0.62
                : 1,
          ),
          0.2,
        ),
      );
    }
  }
  return merged(parts);
}

interface Crab {
  readonly rock: CaveRock;
  readonly radius: number;
  /** Where round the rock it is (radians: 0 is +z of the rock's centre). */
  angle: number;
  /** Walking direction round the rock (+1 or -1), and how long until it walks or pauses. */
  dir: number;
  walking: boolean;
  left: number;
  wary: boolean;
  readonly phase: number;
  readonly at: Vec3;
}

export class CaveCrabs {
  readonly root = new THREE.Group();
  readonly sightings: SightCandidate[] = [];
  private readonly gait: THREE.InstancedBufferAttribute;
  private readonly mesh: THREE.InstancedMesh;
  private readonly crabs: Crab[] = [];
  private readonly material = new THREE.MeshStandardMaterial({
    name: 'Rock crab',
    vertexColors: true,
    roughness: 0.6,
  });
  private readonly m = new THREE.Matrix4();
  private readonly q = new THREE.Quaternion();
  private readonly e = new THREE.Euler();
  private readonly p = new THREE.Vector3();
  private readonly size = new THREE.Vector3().setScalar(CRAB.scale);
  private time = 0;
  private seed = 41077;
  private disposed = false;

  constructor(rocks: readonly CaveRock[], count: number) {
    this.root.name = 'Rock crabs';
    benthicGait(this.material, 0.08);
    this.gait = new THREE.InstancedBufferAttribute(
      new Float32Array(count * 2),
      2,
    );
    this.mesh = new THREE.InstancedMesh(crabBody(), this.material, count);
    this.mesh.geometry.setAttribute('legGait', this.gait);
    this.mesh.name = 'Rock crab bodies';
    for (let i = 0; i < count && rocks.length; i++) {
      const rock = rocks[(i * 5) % rocks.length],
        crab: Crab = {
          rock,
          radius: rock.size * CRAB.reach + CRAB.clear,
          angle: this.random() * Math.PI * 2,
          dir: this.random() < 0.5 ? 1 : -1,
          walking: false,
          left: this.between(CRAB.pause),
          wary: false,
          phase: this.random() * 6.3,
          at: { x: 0, y: 0, z: 0 },
        };
      this.crabs.push(crab);
      this.sightings.push({
        id: CAVE_SIGHTS.crab.id,
        label: CAVE_SIGHTS.crab.label,
        position: crab.at,
        radius: 0.8,
      });
    }
    this.mesh.count = this.crabs.length;
    this.place();
    this.root.add(this.mesh);
  }
  private random(): number {
    this.seed = (Math.imul(this.seed, 1664525) + 1013904223) >>> 0;
    return this.seed / 4294967296;
  }
  private between(range: readonly [number, number]): number {
    return range[0] + this.random() * (range[1] - range[0]);
  }
  private place(): void {
    this.crabs.forEach((c, i) => {
      const x = c.rock.x + Math.sin(c.angle) * c.radius,
        z = c.rock.z + Math.cos(c.angle) * c.radius,
        moving = c.walking || c.wary,
        bob = moving ? 0.004 * Math.abs(Math.sin(this.time * 14 + c.phase)) : 0;
      c.at.x = x;
      c.at.y = caveFloor(x, z) + bob;
      c.at.z = z;
      // Facing out from the rock, so it walks sideways round it; a slight tilt as it steps.
      this.e.set(
        0,
        c.angle,
        moving ? 0.06 * Math.sin(this.time * 14 + c.phase) : 0,
      );
      this.q.setFromEuler(this.e);
      this.p.set(c.at.x, c.at.y, c.at.z);
      this.m.compose(this.p, this.q, this.size);
      this.gait.setXY(i, this.time * 10 + c.phase, moving ? 1 : 0);
      this.mesh.setMatrixAt(i, this.m);
    });
    this.mesh.instanceMatrix.needsUpdate = true;
    this.gait.needsUpdate = true;
  }
  /** Walk round the rocks, pause, and scuttle round out of sight of a close swimmer. */
  update(
    dt: number,
    active: boolean,
    reducedMotion: boolean,
    player: PlayerPresence,
  ): void {
    if (this.disposed || !active || !(dt > 0)) return;
    const step = Math.min(dt, 0.1),
      e = player.position;
    this.time += reducedMotion ? 0 : step;
    for (const c of this.crabs) {
      const d = Math.hypot(e.x - c.at.x, e.y - c.at.y, e.z - c.at.z);
      if (player.active && d < CRAB.wary) c.wary = true;
      else if (!player.active || d > CRAB.easy) {
        if (c.wary) {
          c.wary = false;
          c.walking = false;
          c.left = this.between(CRAB.pause);
        }
      }
      if (c.wary) {
        // Round to the far side of its rock from the swimmer.
        const hide = Math.atan2(c.rock.x - e.x, c.rock.z - e.z),
          off = Math.atan2(Math.sin(hide - c.angle), Math.cos(hide - c.angle)),
          most = (CRAB.scuttle * (reducedMotion ? 0.5 : 1) * step) / c.radius;
        c.angle += Math.max(-most, Math.min(most, off));
        continue;
      }
      c.left -= step;
      if (c.left <= 0) {
        c.walking = !c.walking;
        c.left = this.between(c.walking ? CRAB.bout : CRAB.pause);
        if (c.walking && this.random() < 0.4) c.dir = -c.dir;
      }
      if (c.walking) c.angle += (c.dir * CRAB.walk * step) / c.radius;
    }
    this.place();
  }
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.root.removeFromParent();
    this.root.clear();
    this.mesh.geometry.dispose();
    this.mesh.dispose();
    this.material.dispose();
    this.sightings.length = 0;
  }
}
