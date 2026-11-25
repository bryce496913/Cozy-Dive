import { CREATURE_LOOKS } from './creatureLooks';
import { CRUISE_SPECIES, type BigCreatureId } from './creatures';
import type { AssetId } from '../assets/AssetRegistry';

export type TankCreatureId =
  | BigCreatureId
  | 'great-white-shark'
  | 'ocean-sunfish'
  | 'sea-otter'
  | 'harbour-seal'
  | 'western-gull'
  | 'california-sea-lion'
  | 'nurse-shark'
  | 'emperor-penguin'
  | 'adelie-penguin'
  | 'weddell-seal'
  | 'leopard-seal'
  | 'minke-whale'
  | 'killer-whale'
  | 'polar-bear'
  | 'spanish-shawl'
  | 'kelp-crab'
  | 'spiny-lobster'
  | 'rock-crab'
  | 'moray-eel'
  | 'cleaner-shrimp'
  | 'lionfish'
  | 'octopus'
  | 'glass-sponge'
  | 'antarctic-soft-coral'
  | 'antarctic-anemone'
  | 'antarctic-sea-star'
  | 'feather-star'
  | 'antarctic-krill'
  | 'giant-sea-spider'
  | 'ribbon-worm'
  | 'sea-butterfly'
  | 'comb-jelly'
  | 'colossal-squid'
  | 'antarctic-jellyfish'
  | 'salp'
  | 'antarctic-sea-urchin'
  | 'brittle-star'
  | 'sea-cucumber'
  | 'antarctic-scallop'
  | 'sea-pen'
  | 'giant-isopod'
  | 'swell-shark'
  | 'weddell-seal-pup'
  | 'encrusting-sponge'
  | 'tube-sponge'
  | 'sea-squirt'
  | 'mysid'
  | 'ice-algae'
  | 'sea-angel'
  | 'christmas-tree-worm'
  | 'pikachu-nudibranch'
  | 'leaf-sheep'
  | 'candy-crab'
  | 'harlequin-shrimp'
  | 'ornate-ghost-pipefish'
  | 'hairy-frogfish'
  | 'mimic-octopus'
  | 'weedy-seadragon'
  | 'sarcastic-fringehead'
  | 'east-pacific-red-octopus';
export interface BabyDefinition {
  readonly id: TankCreatureId;
  readonly sighting: string;
  readonly label: string;
  readonly asset?: AssetId;
  readonly shape?: TankCreatureId;
  readonly size?: number;
  readonly nodes?: readonly string[];
  readonly tint?: number;
  readonly motion?: 'swim' | 'crawl' | 'still' | 'drift';
  readonly scale: number;
  /** Yaw-independent enclosure of both detail levels and every stroke. */
  readonly radius: number;
  readonly halfHeight: number;
  readonly speed: number;
  readonly strokeHz: number;
}
const littleAsset = (
  id: TankCreatureId,
  label: string,
  asset: AssetId,
  tint?: number,
): BabyDefinition => ({
  id,
  sighting: `species:${id}`,
  label,
  asset,
  tint,
  scale: 1,
  size: 0.55,
  radius: 0.5,
  halfHeight: 0.3,
  speed: 0.2,
  strokeHz: 0.3,
});
const littleShape = (
  id: TankCreatureId,
  label: string,
  motion: NonNullable<BabyDefinition['motion']>,
): BabyDefinition => ({
  id,
  sighting: `species:${id}`,
  label,
  shape: id,
  motion,
  scale: 1,
  size: 0.4,
  radius: 0.38,
  halfHeight: 0.24,
  speed: motion === 'crawl' || motion === 'still' ? 0.025 : 0.12,
  strokeHz: 0.25,
});
/** V0.8 Pass 100: a rare miniature from the shared `rareMinis` library (a crawler). */
function rareMini(
  id: TankCreatureId,
  label: string,
  node: string,
  size: number,
  asset: 'rareMinis' | 'reefMinis' | 'kelpMinis' = 'rareMinis',
): BabyDefinition {
  return {
    id,
    sighting: `species:${id}`,
    label,
    asset,
    nodes: [node],
    motion: 'crawl',
    scale: 1,
    size,
    radius: size * 0.75,
    halfHeight: size * 0.4,
    speed: 0.02,
    strokeHz: 0.3,
  };
}
/** The aquarium miniatures as they were before V0.8 Pass 096 (kept for comparison and tests). */
export const MINIATURES_BEFORE_096: readonly BabyDefinition[] = [
  {
    id: 'blacktip-reef-shark',
    sighting: 'species:blacktip-reef-shark',
    label: 'Blacktip pup',
    asset: 'reefShark',
    scale: 0.55 / 3,
    radius: 0.32,
    halfHeight: 0.16,
    speed: 0.3,
    strokeHz: 0.45,
  },
  // The tail extends much further than the 0.5 m disc. Its full sweep is protected too.
  {
    id: 'spotted-eagle-ray',
    sighting: 'species:spotted-eagle-ray',
    label: 'Baby eagle ray',
    asset: 'eagleRay',
    scale: 0.5 / 3,
    radius: 0.64,
    halfHeight: 0.14,
    speed: 0.22,
    strokeHz: 0.28,
  },
  {
    id: 'green-sea-turtle',
    sighting: 'species:green-sea-turtle',
    label: 'Turtle hatchling',
    asset: 'seaTurtle',
    scale: 0.25,
    radius: 0.25,
    halfHeight: 0.16,
    speed: 0.16,
    strokeHz: 0.32,
  },
  ...Object.values(CRUISE_SPECIES)
    .filter(
      (s) =>
        ![
          'blacktip-reef-shark',
          'spotted-eagle-ray',
          'green-sea-turtle',
        ].includes(s.id),
    )
    .map((s) =>
      littleAsset(
        s.id,
        `Little ${s.name.toLowerCase()}`,
        s.asset,
        s.id === 'bat-ray' ? CREATURE_LOOKS.batRayTint : undefined,
      ),
    ),
  littleAsset('great-white-shark', 'Great white pup', 'greatWhite'),
  littleAsset('ocean-sunfish', 'Little ocean sunfish', 'sunfish'),
  littleAsset('sea-otter', 'Sea otter pup', 'seaOtter'),
  littleAsset('harbour-seal', 'Harbour seal pup', 'harbourSeal'),
  littleAsset('western-gull', 'Little western gull', 'westernGull'),
  littleAsset('california-sea-lion', 'Sea lion pup', 'seaLion'),
  littleAsset('nurse-shark', 'Nurse shark pup', 'nurseShark'),
  littleAsset(
    'swell-shark',
    'Little swell shark',
    'nurseShark',
    CREATURE_LOOKS.swellSharkTint,
  ),
  littleAsset('emperor-penguin', 'Little emperor penguin', 'emperorPenguin'),
  littleAsset('adelie-penguin', 'Little Adélie penguin', 'adeliePenguin'),
  littleAsset('weddell-seal', 'Little Weddell seal', 'weddellSeal'),
  {
    ...littleAsset(
      'weddell-seal-pup',
      'Weddell seal pup',
      'harbourSeal',
      CREATURE_LOOKS.weddellPup.tint,
    ),
    size: 0.35,
  },
  littleAsset('leopard-seal', 'Leopard seal pup', 'leopardSeal'),
  littleAsset('minke-whale', 'Minke whale calf', 'minkeWhale'),
  littleAsset('killer-whale', 'Orca calf', 'killerWhale'),
  littleAsset('polar-bear', 'Polar bear cub', 'polarBear'),
  rareMini(
    'spanish-shawl',
    'Spanish shawl nudibranch',
    'Spanish_Shawl',
    0.18,
    'kelpMinis',
  ),
  littleShape('kelp-crab', 'Kelp crab', 'crawl'),
  littleShape('spiny-lobster', 'Spiny lobster', 'crawl'),
  littleShape('rock-crab', 'Rock crab', 'crawl'),
  {
    ...littleAsset('moray-eel', 'Little moray eel', 'anchored'),
    size: 0.4,
    motion: 'swim',
    nodes: ['MorayBody', 'MorayDorsal', 'MorayHead', 'MorayJaw'],
  },
  littleShape('cleaner-shrimp', 'Cleaner shrimp', 'crawl'),
  littleShape('lionfish', 'Little lionfish', 'swim'),
  littleShape('octopus', 'Little day octopus', 'crawl'),
  littleShape('glass-sponge', 'Glass sponge', 'still'),
  littleShape('antarctic-soft-coral', 'Antarctic soft coral', 'still'),
  littleShape('antarctic-anemone', 'Antarctic anemone', 'still'),
  littleShape('antarctic-sea-star', 'Antarctic sea star', 'crawl'),
  littleShape('feather-star', 'Feather star', 'still'),
  littleShape('antarctic-krill', 'Antarctic krill', 'swim'),
  littleShape('giant-sea-spider', 'Little sea spider', 'crawl'),
  littleShape('ribbon-worm', 'Ribbon worm', 'crawl'),
  littleShape('sea-butterfly', 'Sea butterfly', 'drift'),
  littleShape('comb-jelly', 'Comb jelly', 'drift'),
  littleShape('colossal-squid', 'Little colossal squid', 'swim'),
  littleShape('antarctic-jellyfish', 'Antarctic jellyfish', 'drift'),
  littleShape('salp', 'Salp chain', 'drift'),
  littleShape('antarctic-sea-urchin', 'Antarctic sea urchin', 'crawl'),
  littleShape('brittle-star', 'Brittle star', 'crawl'),
  littleShape('sea-cucumber', 'Sea cucumber', 'crawl'),
  littleShape('antarctic-scallop', 'Antarctic scallop', 'still'),
  littleShape('sea-pen', 'Sea pen', 'still'),
  littleShape('giant-isopod', 'Little giant isopod', 'crawl'),
  littleShape('encrusting-sponge', 'Encrusting sponge', 'still'),
  littleShape('tube-sponge', 'Tube sponges', 'still'),
  littleShape('sea-squirt', 'Sea squirts', 'still'),
  littleShape('mysid', 'Mysids', 'drift'),
  {
    ...littleShape('ice-algae', 'Ice algae', 'still'),
    sighting: 'plant:ice-algae',
    halfHeight: 0.005,
  },
  littleShape('sea-angel', 'Sea angel', 'drift'),
  littleShape('christmas-tree-worm', 'Christmas tree worm', 'still'),
  // V0.8 Pass 100: the tank's rare miniatures, placed as the same models found in the reef.
  rareMini(
    'pikachu-nudibranch',
    'Pikachu nudibranch',
    'Pikachu_Nudibranch',
    0.22,
  ),
  rareMini('leaf-sheep', 'Leaf sheep', 'Leaf_Sheep', 0.16),
  rareMini('candy-crab', 'Candy crab', 'Candy_Crab', 0.16),
  // Pass 102: reuse Spanish shawl's existing id above; three additional kelp identities.
  {
    ...rareMini(
      'weedy-seadragon',
      'Weedy seadragon',
      'Weedy_Seadragon',
      0.36,
      'kelpMinis',
    ),
    motion: 'swim',
    speed: 0.025,
  },
  {
    ...rareMini(
      'sarcastic-fringehead',
      'Sarcastic fringehead',
      'Sarcastic_Fringehead',
      0.3,
      'kelpMinis',
    ),
    motion: 'still',
    speed: 0,
  },
  rareMini(
    'east-pacific-red-octopus',
    'East Pacific red octopus',
    'Red_Octopus',
    0.32,
    'kelpMinis',
  ),
  // V0.8 Pass 101: the outer reef's rare miniatures (the same models as on the reef).
  rareMini(
    'harlequin-shrimp',
    'Harlequin shrimp',
    'Harlequin_Shrimp',
    0.18,
    'reefMinis',
  ),
  {
    ...rareMini(
      'ornate-ghost-pipefish',
      'Ornate ghost pipefish',
      'Ghost_Pipefish',
      0.24,
      'reefMinis',
    ),
    // It hovers: a slow swimmer that keeps near its spot.
    motion: 'swim',
    speed: 0.035,
  },
  rareMini(
    'hairy-frogfish',
    'Hairy frogfish',
    'Hairy_Frogfish',
    0.24,
    'reefMinis',
  ),
  rareMini(
    'mimic-octopus',
    'Mimic octopus',
    'Mimic_Octopus',
    0.42,
    'reefMinis',
  ),
];
/**
 * V0.8 Pass 096: the large animals' aquarium miniatures are twice the size they were displayed at
 * (their own previous visible size, not the wild animal's): the whales, sharks, rays, turtle,
 * seals, sea lion, penguins, gull, polar bear, otter, sunfish and colossal squid. Ordinary fish
 * (the fish catalog) and the small invertebrates are unchanged. Every size-dependent value grows
 * with them: the collision radius and half-height (which enclose both detail levels and every
 * stroke), and through them the turning and wall clearance, the floor and resting height, and the
 * avoidance of the swimmer, fish and each other.
 */
export const MINIATURE_GROWTH = 2;
export function isLargeMiniature(d: BabyDefinition): boolean {
  return (
    (!!d.asset &&
      d.id !== 'moray-eel' &&
      d.asset !== 'rareMinis' &&
      d.asset !== 'reefMinis' &&
      d.asset !== 'kelpMinis') ||
    d.id === 'colossal-squid'
  );
}
function grown(d: BabyDefinition): BabyDefinition {
  if (!isLargeMiniature(d)) return d;
  const g = MINIATURE_GROWTH;
  return {
    ...d,
    // Size-normalised animals grow by their target length; the rest by their scale.
    ...(d.size !== undefined ? { size: d.size * g } : { scale: d.scale * g }),
    radius: d.radius * g,
    halfHeight: d.halfHeight * g,
  };
}
export const TANK_BABIES: readonly BabyDefinition[] =
  MINIATURES_BEFORE_096.map(grown);
/** Displayed length scale of a miniature relative to before Pass 096 (2 for the large animals). */
export function miniatureGrowth(id: TankCreatureId): number {
  const d = TANK_BABIES.find((b) => b.id === id);
  return d && isLargeMiniature(d) ? MINIATURE_GROWTH : 1;
}
/**
 * How many animals a tank holds: one of each (61, + V0.8 Pass 100's three rare tank miniatures,
 * + Pass 101's four from the outer reef, + Pass 102's three new kelp species).
 */
export const BABY_CAP = TANK_BABIES.length;
export const babyDefinition = (id: TankCreatureId): BabyDefinition =>
  TANK_BABIES.find((b) => b.id === id)!;
