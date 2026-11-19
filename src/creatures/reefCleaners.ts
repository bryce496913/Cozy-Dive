import type { Vec3 } from '../config/world';
import type { FishPose } from '../environment/outer/PosedFish';
import type { PlayerPresence } from '../fish/FishDiverReaction';
import {
  createSwim,
  Seeded,
  swimTo,
  turnTo,
  type Swim,
} from './reefEncounters';

/**
 * Playtest (outer reef): a cleaning station on a coral head. A little blue cleaner wrasse keeps
 * station over the coral, dancing its bobbing, tail-up dance to advertise. Every so often a
 * parrotfish swims over and hangs head-down, fins spread, mouth open, while the wrasse works its
 * way along its sides and round its head; then the client swims off again. Peaceful: a swimmer who
 * comes close only ends a visit early (the client drifts calmly away). Pure, allocation-free per
 * frame, deterministic for a seed.
 */
export const REEF_CLEANERS = {
  /** The wrasse dances this high over the coral (m), within this radius (m). */
  over: 0.35,
  radius: 0.25,
  /** The client hangs this high over the coral (m), and waits this far off (m). */
  hang: 0.6,
  away: 7,
  /** Seconds between visits, and being cleaned. */
  every: [25, 50] as const,
  stay: [12, 20] as const,
  speed: 0.6,
  /** A swimmer this close (m) ends a visit early. */
  shy: 1.8,
  /** The client's half length (m), for the wrasse's working along it. */
  half: 0.28,
} as const;
export type CleanerMood = 'waiting' | 'coming' | 'cleaning' | 'leaving';

export class ReefCleaningStation {
  readonly wrasse: Swim;
  readonly client: Swim;
  mood: CleanerMood = 'waiting';
  private wait: number;
  private time = 0;
  private readonly home: Vec3;
  private readonly hover: Vec3;
  private readonly rand: Seeded;
  constructor(
    wrasse: FishPose,
    client: FishPose,
    /** The top of the coral head the station is on. */
    private readonly station: Readonly<Vec3>,
    seed = 52031,
  ) {
    this.rand = new Seeded(seed);
    this.wrasse = createSwim(wrasse);
    this.client = createSwim(client);
    wrasse.position.x = station.x;
    wrasse.position.y = station.y + REEF_CLEANERS.over;
    wrasse.position.z = station.z;
    const a = this.rand.between([0, Math.PI * 2]);
    this.home = {
      x: station.x + Math.cos(a) * REEF_CLEANERS.away,
      y: station.y + 1.2,
      z: station.z + Math.sin(a) * REEF_CLEANERS.away,
    };
    this.hover = {
      x: station.x,
      y: station.y + REEF_CLEANERS.hang,
      z: station.z,
    };
    Object.assign(client.position, this.home);
    this.wait = this.rand.between([6, 14]);
  }
  /** Bring the client now (for a harness). */
  call(): void {
    if (this.mood === 'waiting') this.mood = 'coming';
  }
  update(dt: number, player?: PlayerPresence): void {
    if (!(dt > 0)) return;
    dt = Math.min(dt, 0.1);
    this.time += dt;
    const t = this.time,
      c = this.client,
      cp = c.pose,
      h = this.hover,
      eye = player?.active ? player.position : undefined,
      close =
        !!eye &&
        Math.hypot(eye.x - h.x, eye.y - h.y, eye.z - h.z) < REEF_CLEANERS.shy;
    switch (this.mood) {
      case 'waiting':
        swimTo(
          c,
          this.home.x + 1.2 * Math.sin(t * 0.11),
          this.home.y + 0.3 * Math.sin(t * 0.07),
          this.home.z + 1.2 * Math.cos(t * 0.09),
          0.25,
          dt,
        );
        this.wait -= dt;
        if (this.wait <= 0 && !close) this.mood = 'coming';
        break;
      case 'coming':
        if (close) this.mood = 'leaving';
        else if (
          swimTo(c, h.x, h.y, h.z, REEF_CLEANERS.speed, dt, 1.4) < 0.15
        ) {
          this.mood = 'cleaning';
          this.wait = this.rand.between(REEF_CLEANERS.stay);
        }
        break;
      case 'cleaning':
        // Hanging still, head tipped down, fins spread wide: ready to be cleaned.
        c.v.x = c.v.y = c.v.z = 0;
        cp.position.x += (h.x - cp.position.x) * dt;
        cp.position.y += (h.y + 0.04 * Math.sin(t * 0.6) - cp.position.y) * dt;
        cp.position.z += (h.z - cp.position.z) * dt;
        cp.pitch += (-0.45 - cp.pitch) * Math.min(1, dt * 1.5);
        cp.roll += (0.25 - cp.roll) * Math.min(1, dt);
        cp.effort = 0.06 * Math.sin(t * 1.5);
        cp.fins = 1;
        this.wait -= dt;
        if (this.wait <= 0 || close) this.mood = 'leaving';
        break;
      case 'leaving':
        cp.roll *= 1 - Math.min(1, dt);
        if (
          swimTo(
            c,
            this.home.x,
            this.home.y,
            this.home.z,
            REEF_CLEANERS.speed,
            dt,
            1.4,
          ) < 0.6
        ) {
          this.mood = 'waiting';
          this.wait = this.rand.between(REEF_CLEANERS.every);
        }
        break;
    }
    this.cleaner(dt);
  }
  /** The wrasse: dancing over its coral, or working along the client. */
  private cleaner(dt: number): void {
    const w = this.wrasse,
      t = this.time,
      s = this.station;
    if (this.mood === 'cleaning') {
      const cp = this.client.pose,
        fx = Math.cos(cp.yaw),
        fz = -Math.sin(cp.yaw),
        // Along the body from tail to head and back, switching sides as it goes over the top.
        along = REEF_CLEANERS.half * Math.sin(t * 0.35),
        over = Math.sin(t * 0.19),
        side = 0.09 * Math.sign(over || 1),
        // Little darting pecks.
        peck = 0.02 * Math.max(0, Math.sin(t * 7));
      swimTo(
        w,
        cp.position.x + fx * along - fz * (side + peck),
        cp.position.y + 0.05 * (1 - Math.abs(over)) - 0.02,
        cp.position.z + fz * along + fx * (side + peck),
        0.5,
        dt,
        3,
        4,
      );
      // Nose in to the client's side.
      turnTo(w, cp.yaw + (side > 0 ? 1 : -1) * 1.2, dt, 3);
      return;
    }
    // The dance: a slow loop over the coral, bobbing, the tail lifting and dipping.
    swimTo(
      w,
      s.x + REEF_CLEANERS.radius * Math.cos(t * 0.5),
      s.y + REEF_CLEANERS.over + 0.06 * Math.sin(t * 2.2),
      s.z + REEF_CLEANERS.radius * Math.sin(t * 0.5),
      0.2,
      dt,
      3,
      2,
    );
    w.pose.pitch = -0.35 * Math.sin(t * 2.2);
  }
}
