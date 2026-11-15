import type { AssetId } from '../assets/AssetRegistry';

/**
 * v0.4 Pass 025: the outer reef's big creatures. They cruise calm, unhurried loops and give the
 * swimmer room: within `comfort` of the swimmer they ease off their route (by up to `giveWay`),
 * never towards them, and drift back once the swimmer has gone.
 */
export type BigCreatureId =
  | 'blacktip-reef-shark'
  | 'spotted-eagle-ray'
  | 'green-sea-turtle'
  /** v0.6 Pass 032: the kelp forest's rays (the eagle ray's model, tinted dark). */
  | 'bat-ray'
  /** v0.6 Pass 033: visitors passing along the outer reef's wall (see `WALL_VISITORS`). */
  | 'manta-ray'
  | 'whale-shark'
  | 'humpback-whale'
  | 'great-hammerhead'
  | 'scalloped-hammerhead'
  /** v0.6 Pass 034: the sea cave's sharks, resting on its sand or circling slowly. */
  | 'whitetip-reef-shark';

export interface CruiseSpecies {
  readonly id: BigCreatureId;
  /** Shown when first seen. */
  readonly name: string;
  readonly asset: AssetId;
  /** Uniform model scale; clearance and personal space follow this size. */
  readonly scale: number;
  /** Rough radius of its body (m): sighting size and the route's clearance sideways. */
  readonly radius: number;
  /** Cruising speed (m/s). */
  readonly speed: number;
  /** Swimming strokes per second, and how far each stroke goes (0–1 of the authored stroke). */
  readonly strokeHz: number;
  readonly stroke: number;
  /** Optional rests between strokes: every `period` s it glides for `share` of the time. */
  readonly glide?: { readonly period: number; readonly share: number };
  /** Distance from the swimmer (m) at which it starts to give way, and how far it moves aside. */
  readonly comfort: number;
  readonly giveWay: number;
  /** Height kept above the reef and seabed beneath its route (m). */
  readonly clearance: number;
  /** Beyond this distance (m) it is drawn with its light distance level. */
  readonly detailDistance: number;
  /** How much it banks into turns. */
  readonly bank: number;
}

export const CRUISE_SPECIES: Readonly<Record<BigCreatureId, CruiseSpecies>> = {
  'blacktip-reef-shark': {
    id: 'blacktip-reef-shark',
    name: 'Blacktip reef shark',
    asset: 'reefShark',
    scale: 1,
    radius: 1.5,
    speed: 1.1,
    strokeHz: 0.55,
    stroke: 0.8,
    comfort: 7,
    giveWay: 5.5,
    clearance: 2.4,
    detailDistance: 34,
    bank: 0.6,
  },
  'spotted-eagle-ray': {
    id: 'spotted-eagle-ray',
    name: 'Spotted eagle ray',
    asset: 'eagleRay',
    scale: 1,
    radius: 1.5,
    speed: 0.8,
    strokeHz: 0.32,
    stroke: 0.9,
    glide: { period: 11, share: 0.45 },
    comfort: 4.5,
    giveWay: 3.5,
    clearance: 1.3,
    detailDistance: 30,
    bank: 1.1,
  },
  'bat-ray': {
    id: 'bat-ray',
    name: 'Bat ray',
    asset: 'eagleRay',
    scale: 0.9,
    radius: 1.35,
    speed: 0.55,
    strokeHz: 0.28,
    stroke: 0.85,
    glide: { period: 9, share: 0.5 },
    comfort: 4.5,
    giveWay: 3,
    clearance: 1.1,
    detailDistance: 22,
    bank: 0.9,
  },
  'green-sea-turtle': {
    id: 'green-sea-turtle',
    name: 'Green sea turtle',
    asset: 'seaTurtle',
    scale: 1,
    radius: 0.7,
    speed: 0.45,
    strokeHz: 0.26,
    stroke: 0.9,
    glide: { period: 8, share: 0.4 },
    comfort: 3,
    giveWay: 2.5,
    clearance: 1.0,
    detailDistance: 20,
    bank: 0.5,
  },
  /*
   * v0.6 Pass 033: the wall's visitors. Their models are authored about 3 m long (the manta 4.4 m
   * across), so `scale` here is their size: a 4.4 m manta, an 8 m whale shark, a 12.5 m humpback,
   * a 4.5 m great hammerhead and 2.7 m scalloped hammerheads. They pass in the blue past the lip,
   * where the swimmer cannot follow, so they rarely need to give way.
   */
  'manta-ray': {
    id: 'manta-ray',
    name: 'Reef manta ray',
    asset: 'mantaRay',
    scale: 1,
    radius: 2.2,
    speed: 0.9,
    strokeHz: 0.2,
    stroke: 0.85,
    glide: { period: 12, share: 0.45 },
    comfort: 6,
    giveWay: 4,
    clearance: 2,
    detailDistance: 18,
    bank: 1.0,
  },
  'whale-shark': {
    id: 'whale-shark',
    name: 'Whale shark',
    asset: 'whaleShark',
    scale: 2.7,
    radius: 3.4,
    speed: 0.95,
    strokeHz: 0.17,
    stroke: 0.8,
    comfort: 9,
    giveWay: 5.5,
    clearance: 3,
    detailDistance: 20,
    bank: 0.25,
  },
  'humpback-whale': {
    id: 'humpback-whale',
    name: 'Humpback whale',
    asset: 'humpbackWhale',
    scale: 4.2,
    radius: 5,
    speed: 1.4,
    strokeHz: 0.11,
    stroke: 0.85,
    glide: { period: 16, share: 0.35 },
    comfort: 12,
    giveWay: 7.5,
    clearance: 4,
    detailDistance: 22,
    bank: 0.2,
  },
  'great-hammerhead': {
    id: 'great-hammerhead',
    name: 'Great hammerhead',
    asset: 'hammerhead',
    scale: 1.5,
    radius: 2.2,
    speed: 1.1,
    strokeHz: 0.45,
    stroke: 0.8,
    comfort: 6,
    giveWay: 3.5,
    clearance: 2.5,
    detailDistance: 18,
    bank: 0.6,
  },
  'scalloped-hammerhead': {
    id: 'scalloped-hammerhead',
    name: 'Scalloped hammerhead',
    asset: 'hammerhead',
    scale: 0.9,
    radius: 1.3,
    speed: 0.95,
    strokeHz: 0.55,
    stroke: 0.8,
    comfort: 5,
    giveWay: 3,
    clearance: 2,
    detailDistance: 14,
    bank: 0.6,
  },
  'whitetip-reef-shark': {
    id: 'whitetip-reef-shark',
    name: 'Whitetip reef shark',
    asset: 'whitetipShark',
    scale: 0.55,
    radius: 0.9,
    speed: 0.45,
    strokeHz: 0.4,
    stroke: 0.75,
    comfort: 4,
    giveWay: 2.5,
    clearance: 1.2,
    detailDistance: 14,
    bank: 0.5,
  },
};

/** Larger adults keep proportionate reef clearance and give the swimmer more room. */
export function cruiseSize(
  species: CruiseSpecies,
  scale: number,
): CruiseSpecies {
  if (!Number.isFinite(scale) || scale < 0.5 || scale > 1.5)
    throw Error('Cruising creature scale must be between 0.5 and 1.5');
  return {
    ...species,
    scale,
    radius: (species.radius * scale) / species.scale,
    clearance: (species.clearance * scale) / species.scale,
    comfort: (species.comfort * scale) / species.scale,
    giveWay: (species.giveWay * scale) / species.scale,
  };
}

/** Shared cruising tuning (s⁻¹ rates of the gentle smoothing filters). */
export const CRUISING = {
  /** Spacing of route samples (m). */
  step: 0.5,
  /** Half-width of the window smoothing a route's heights (m). */
  liftWindow: 6,
  /** How quickly a creature moves aside or back. */
  giveWayResponse: 1.1,
  /** It also keeps clear of the swimmer where its route will be this many seconds ahead. */
  lookAhead: 2.5,
  /** How quickly heading and pitch follow its path, and bank follows its turning. */
  turnResponse: 2.2,
  bankResponse: 1.5,
  maxBank: 0.45,
  maxPitch: 0.5,
  /** Stroke amplitude with reduced motion preferred. */
  reducedStroke: 0.6,
  /** Pass 026: big animals count as seen this much further away (m), across the clear blue. */
  sightReach: 3,
  /** Distance-level hysteresis (fraction of the switch distance). */
  hysteresis: 0.1,
} as const;
