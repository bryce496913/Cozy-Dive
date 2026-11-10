import { AQUARIUM, SPAWN } from '../config/world';
import { TANK, TANK_SCALE, OFFICE } from '../config/office';

/**
 * v0.3 Pass 021: the dive from the office into the tank, and back.
 *
 * The office tank's glass already shows exactly what the aquarium camera sees from the office
 * camera's mapped pose (Pass 020). So the dive glides the office camera up to the front glass and,
 * a few centimetres before touching it, continues in the full-scale aquarium from the identical
 * mapped pose. Nothing in the image changes at the switch; you simply keep moving into the water.
 * Pure: plans eased segments and samples them; the application renders the space it reports.
 */
export type Space = 'office' | 'aquarium';
export interface Pose {
  x: number;
  y: number;
  z: number;
  /** Camera yaw (positive looks left) and pitch (positive looks up), radians. */
  yaw: number;
  pitch: number;
}
export interface DiveFrame extends Pose {
  space: Space;
  /** Water-entry wash over the view, 0..1. */
  veil: number;
  /** Underwater haze density for the aquarium view. */
  fog: number;
  /** Bubble burst strength, 0..1 (the entry splash). */
  bubbles: number;
}
export const DIVE = {
  /** Office: stand off, then lean into the glass (s). */
  approach: 1.8,
  lean: 0.55,
  /** Aquarium: drift from the glass to the swim start (s). */
  settle: 1.9,
  /** Surfacing: rise to the glass, pass out, stand up (s). */
  rise: 1.7,
  out: 0.5,
  standUp: 1.4,
  /** Reduced motion: fade out, cut, fade in (s each). */
  fade: 0.45,
  /** Distance in front of the glass for the approach pose (m). */
  standOff: 0.45,
  /** Switch spaces this close to the glass: the view is then entirely glass (m). */
  switchGap: 0.1,
  /** Surfacing switches this far inside the front glass (m). */
  exitInset: 0.03,
  /** Peak of the water-contact wash, reached exactly at the crossing. */
  contactVeil: 0.32,
  /** Haze seen from the room (Pass 020 miniature) and from inside the water. */
  outsideFog: 0.009,
  insideFog: 0.026,
  /** Prompts: how near and how directly the player must face the tank / surface. */
  promptDistance: 1.6,
  promptFacing: 0.75,
  surfaceBand: 1.3,
} as const;

/** Tank frame: aquarium coordinates -> office (rotate by TANK.yaw, scale, translate). */
export function aquariumToOffice(p: Pose): Pose {
  const c = Math.cos(TANK.yaw),
    s = Math.sin(TANK.yaw),
    x = p.x * TANK_SCALE,
    z = p.z * TANK_SCALE;
  return {
    x: TANK.position.x + c * x + s * z,
    y: TANK.position.y + p.y * TANK_SCALE,
    z: TANK.position.z - s * x + c * z,
    yaw: p.yaw + TANK.yaw,
    pitch: p.pitch,
  };
}
export function officeToAquarium(p: Pose): Pose {
  const c = Math.cos(TANK.yaw),
    s = Math.sin(TANK.yaw),
    dx = p.x - TANK.position.x,
    dz = p.z - TANK.position.z;
  return {
    x: (c * dx - s * dz) / TANK_SCALE,
    y: (p.y - TANK.position.y) / TANK_SCALE,
    z: (s * dx + c * dz) / TANK_SCALE,
    yaw: p.yaw - TANK.yaw,
    pitch: p.pitch,
  };
}

/** Front glass centre and the direction out of the tank, in the office. */
export function tankFront(): {
  x: number;
  y: number;
  z: number;
  out: { x: number; z: number };
} {
  const centre = aquariumToOffice({
    x: 0,
    y: (AQUARIUM.min.y + AQUARIUM.max.y) / 2,
    z: AQUARIUM.max.z,
    yaw: 0,
    pitch: 0,
  });
  return {
    x: centre.x,
    y: centre.y,
    z: centre.z,
    // Aquarium +z (out through the front glass) rotated into the office.
    out: { x: Math.sin(TANK.yaw), z: Math.cos(TANK.yaw) },
  };
}

const ease = (t: number) => t * t * (3 - 2 * t);
const easeIn = (t: number) => t * t;
const easeOut = (t: number) => 1 - (1 - t) * (1 - t);
const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
interface Segment {
  space: Space;
  from: Pose;
  to: Pose;
  duration: number;
  curve: (t: number) => number;
  fog: readonly [number, number];
  /** Optional veil/bubble envelope over the segment. */
  splash?: boolean;
  /** The water-contact wash rising into (or falling out of) the crossing. */
  contact?: 'rise' | 'fall';
  fade?: 'out' | 'in';
}

/** A planned dive or surfacing; sample it with elapsed seconds. */
export class DivePath {
  readonly kind: 'dive' | 'surface';
  readonly duration: number;
  /** Where the player ends: the space, and the pose to hand to walking/swimming. */
  readonly end: { space: Space; pose: Pose };
  private readonly segments: Segment[];
  constructor(kind: 'dive' | 'surface', from: Pose, reducedMotion: boolean) {
    this.kind = kind;
    const front = tankFront(),
      // Camera forward is (-sin yaw, -cos yaw): looking into the tank means forward = -out.
      facing = Math.atan2(front.out.x, front.out.z),
      outward = wrap(facing + Math.PI),
      at = (gap: number, yaw: number, y = front.y): Pose => ({
        x: front.x + front.out.x * gap,
        y,
        z: front.z + front.out.z * gap,
        yaw,
        pitch: 0,
      });
    const swimStart: Pose = { ...SPAWN, yaw: 0, pitch: -0.06 },
      // Standing a step back from the tank, facing back into the room.
      standing: Pose = { ...at(1.05, outward, OFFICE.eyeHeight), pitch: -0.08 };
    const s: Segment[] = [];
    if (kind === 'dive') {
      const near = at(DIVE.standOff, facing),
        touch = at(DIVE.switchGap, facing);
      if (reducedMotion) {
        s.push(
          {
            space: 'office',
            from,
            to: from,
            duration: DIVE.fade,
            curve: ease,
            fog: [DIVE.outsideFog, DIVE.outsideFog],
            fade: 'out',
          },
          {
            space: 'aquarium',
            from: swimStart,
            to: swimStart,
            duration: DIVE.fade,
            curve: ease,
            fog: [DIVE.insideFog, DIVE.insideFog],
            fade: 'in',
          },
        );
      } else {
        s.push(
          {
            space: 'office',
            from,
            to: near,
            duration: DIVE.approach,
            curve: ease,
            fog: [DIVE.outsideFog, DIVE.outsideFog],
          },
          {
            space: 'office',
            from: near,
            to: touch,
            duration: DIVE.lean,
            curve: easeIn,
            fog: [DIVE.outsideFog, DIVE.outsideFog],
            contact: 'rise',
          },
          {
            space: 'aquarium',
            from: officeToAquarium(touch),
            to: swimStart,
            duration: DIVE.settle,
            curve: easeOut,
            fog: [DIVE.outsideFog, DIVE.insideFog],
            splash: true,
            contact: 'fall',
          },
        );
      }
      this.end = { space: 'aquarium', pose: swimStart };
    } else {
      const exitInside: Pose = {
          x: 0,
          y: AQUARIUM.max.y - AQUARIUM.clearance - 1.6,
          z: AQUARIUM.max.z - 1.2,
          yaw: wrap(Math.PI), // facing out through the front glass (+z)
          pitch: 0,
        },
        // Just outside the glass, in the office, at the mapped exit height.
        // Switch back to the office just inside the glass: from there the office render (which the
        // aquarium shows on its front wall while surfacing) is the same view, and the office camera
        // then passes out through the glass, whose panels face outward.
        exitOffice = aquariumToOffice({
          ...exitInside,
          z: AQUARIUM.max.z - DIVE.exitInset / TANK_SCALE,
        }),
        out = at(DIVE.standOff, outward, exitOffice.y);
      if (reducedMotion) {
        s.push(
          {
            space: 'aquarium',
            from,
            to: from,
            duration: DIVE.fade,
            curve: ease,
            fog: [DIVE.insideFog, DIVE.insideFog],
            fade: 'out',
          },
          {
            space: 'office',
            from: standing,
            to: standing,
            duration: DIVE.fade,
            curve: ease,
            fog: [DIVE.outsideFog, DIVE.outsideFog],
            fade: 'in',
          },
        );
      } else {
        const glass = officeToAquarium(exitOffice);
        s.push(
          {
            space: 'aquarium',
            from,
            to: exitInside,
            duration: DIVE.rise,
            curve: ease,
            fog: [DIVE.insideFog, DIVE.outsideFog],
          },
          {
            space: 'aquarium',
            from: exitInside,
            to: glass,
            duration: DIVE.out * 0.6,
            curve: easeIn,
            fog: [DIVE.outsideFog, DIVE.outsideFog],
            splash: true,
            contact: 'rise',
          },
          {
            space: 'office',
            from: exitOffice,
            to: out,
            duration: DIVE.out * 0.4 + 0.2,
            curve: easeOut,
            fog: [DIVE.outsideFog, DIVE.outsideFog],
            contact: 'fall',
          },
          {
            space: 'office',
            from: out,
            to: standing,
            duration: DIVE.standUp,
            curve: ease,
            fog: [DIVE.outsideFog, DIVE.outsideFog],
          },
        );
      }
      this.end = { space: 'office', pose: standing };
    }
    this.segments = s;
    this.duration = s.reduce((sum, seg) => sum + seg.duration, 0);
  }
  /** The frame at `elapsed` seconds (clamped to the path). */
  sample(elapsed: number, out: DiveFrame): DiveFrame {
    let t = Math.max(0, Math.min(elapsed, this.duration));
    let seg = this.segments[this.segments.length - 1],
      local = 1;
    for (const candidate of this.segments) {
      if (t <= candidate.duration) {
        seg = candidate;
        local = candidate.duration > 0 ? t / candidate.duration : 1;
        break;
      }
      t -= candidate.duration;
    }
    const k = seg.curve(local),
      a = seg.from,
      b = seg.to;
    out.space = seg.space;
    out.x = a.x + (b.x - a.x) * k;
    out.y = a.y + (b.y - a.y) * k;
    out.z = a.z + (b.z - a.z) * k;
    out.yaw = a.yaw + wrap(b.yaw - a.yaw) * k;
    out.pitch = a.pitch + (b.pitch - a.pitch) * k;
    out.fog = seg.fog[0] + (seg.fog[1] - seg.fog[0]) * ease(local);
    out.veil =
      seg.fade === 'out'
        ? ease(local)
        : seg.fade === 'in'
          ? 1 - ease(local)
          : seg.contact === 'rise'
            ? DIVE.contactVeil * ease(Math.max(0, (local - 0.45) / 0.55))
            : seg.contact === 'fall'
              ? DIVE.contactVeil * (1 - ease(Math.min(1, local / 0.4)))
              : 0;
    out.bubbles = seg.splash ? Math.max(0, 1 - local * 1.6) : 0;
    return out;
  }
}

/** Whether to offer the dive: close to the tank front and looking at it. */
export function canDive(p: Pose): boolean {
  const f = tankFront(),
    dx = f.x - p.x,
    dz = f.z - p.z,
    d = Math.hypot(dx, dz);
  if (d > DIVE.promptDistance || d < 1e-6) return false;
  const lookX = -Math.sin(p.yaw) * Math.cos(p.pitch),
    lookZ = -Math.cos(p.yaw) * Math.cos(p.pitch);
  return (lookX * dx + lookZ * dz) / d >= DIVE.promptFacing;
}
/** Whether to offer surfacing: near the water's surface. */
export function canSurface(y: number): boolean {
  return y >= AQUARIUM.max.y - AQUARIUM.clearance - DIVE.surfaceBand;
}
