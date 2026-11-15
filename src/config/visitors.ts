import type { BigCreatureId } from './creatures';

/**
 * v0.6 Pass 033: visitors along the outer reef's wall. Big animals of the open blue pass back and
 * forth beyond the lip, one more kind joining them the longer the swimmer stays at the edge. Which
 * comes first changes with every visit to the outer reef. Nothing is counted or scored: they just
 * arrive.
 */
export type WallVisitorId =
  | 'manta-ray'
  | 'whale-shark'
  | 'great-hammerhead'
  | 'scalloped-hammerhead'
  | 'humpback-whale';

/** The visitors' base order. Each visit starts one further along it (see `visitorOrder`). */
export const WALL_VISITOR_IDS: readonly WallVisitorId[] = [
  'manta-ray',
  'whale-shark',
  'scalloped-hammerhead',
  'great-hammerhead',
  'humpback-whale',
] satisfies readonly BigCreatureId[];

export const VISITING = {
  /** Seconds at the edge before the first visitor comes, then between each new kind. */
  first: 8,
  interval: 45,
  /**
   * Where the edge is: within `near` m of the lip (on the reef top, over it or past it), and
   * within the reef's swimmable width. Time there counts only while playing.
   */
  near: 5,
  /**
   * A visitor appears only where it is at least `hidden` m from the eye (lost in the haze: the
   * outer waters' fog leaves about 1% of anything this far away), and it starts `lead` m along
   * its route before the point where it passes closest, so it swims into view soon afterwards.
   */
  hidden: 16,
  lead: 26,
  /** Where each visit's number is kept (a plain counter; storage may be unavailable). */
  storageKey: 'cozy-diver.visits.v1',
} as const;
