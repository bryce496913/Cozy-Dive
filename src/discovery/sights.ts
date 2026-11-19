import { CRUISE_SPECIES, type BigCreatureId } from '../config/creatures';
import type { Sighting } from './journal';

/**
 * v0.4 Pass 025: everything the outer waters can show the swimmer, with its stable journal id
 * and how it is named. v0.5's tank catalog unlocks by these ids, so they must never change.
 */
export interface Sight {
  readonly id: string;
  readonly label: string;
}
export const creatureSight = (id: BigCreatureId): string => `species:${id}`;

/** Reef features worth noticing, by the outer reef layout's family names. */
export const REEF_SIGHTS = {
  branching: { id: 'coral:branching', label: 'Branching coral' },
  massive: { id: 'coral:boulder', label: 'Boulder coral' },
  plate: { id: 'coral:plate', label: 'Plate coral' },
  soft: { id: 'coral:soft', label: 'Soft coral' },
  fan: { id: 'coral:sea-fan', label: 'Sea fan' },
  grass: { id: 'plant:seagrass', label: 'Seagrass' },
  blade: { id: 'plant:seagrass', label: 'Seagrass' },
} as const satisfies Record<string, Sight>;

/** v0.6 Pass 032: what the kelp forest shows (its bat rays are listed with the big creatures). */
export const KELP_SIGHTS = {
  kelp: { id: 'plant:giant-kelp', label: 'Giant kelp' },
  garibaldi: { id: 'species:garibaldi', label: 'Garibaldi' },
  /** v0.6 Pass 035. */
  bass: { id: 'species:kelp-bass', label: 'Kelp bass' },
  /** v0.6 Pass 041. */
  blacksmith: { id: 'species:blacksmith', label: 'Blacksmith' },
  senorita: { id: 'species:senorita', label: 'Señorita' },
  // v0.6 Pass 044
  otter: { id: 'species:sea-otter', label: 'Sea otter' },
  seaBass: { id: 'species:giant-sea-bass', label: 'Giant sea bass' },
  sheephead: {
    id: 'species:california-sheephead',
    label: 'California sheephead',
  },
  nudibranch: {
    id: 'species:spanish-shawl',
    label: 'Spanish shawl nudibranch',
  },
  kelpCrab: { id: 'species:kelp-crab', label: 'Kelp crab' },
  seal: { id: 'species:harbour-seal', label: 'Harbour seal' },
  gull: { id: 'species:western-gull', label: 'Western gull' },
  /** v0.6 Pass 039. */
  seaLion: { id: 'species:california-sea-lion', label: 'California sea lion' },
} as const satisfies Record<string, Sight>;

/** v0.6 Pass 034: what the sea cave shows (its whitetips are listed with the big creatures). */
export const CAVE_SIGHTS = {
  cave: { id: 'place:sea-cave', label: 'Sea cave' },
  lobster: { id: 'species:spiny-lobster', label: 'Spiny lobster' },
  sweeper: { id: 'species:glassy-sweeper', label: 'Glassy sweeper' },
  // v0.6 Pass 041
  soldierfish: { id: 'species:soldierfish', label: 'Soldierfish' },
  crab: { id: 'species:rock-crab', label: 'Rock crab' },
  // v0.6 Pass 045
  moray: { id: 'species:moray-eel', label: 'Moray eel' },
  flashlight: { id: 'species:flashlight-fish', label: 'Flashlight fish' },
  nurseShark: { id: 'species:nurse-shark', label: 'Nurse shark' },
  swellShark: { id: 'species:swell-shark', label: 'Swell shark' },
  shrimp: { id: 'species:cleaner-shrimp', label: 'Cleaner shrimp' },
  lionfish: { id: 'species:lionfish', label: 'Lionfish' },
} as const satisfies Record<string, Sight>;

const REEF: Readonly<Record<string, Sight | undefined>> = REEF_SIGHTS;
/** The sight a kind of reef piece shows, if any (by the layout's family name). */
export function reefSight(family: string): Sight | undefined {
  return Object.hasOwn(REEF, family) ? REEF[family] : undefined;
}

/** v0.6 Pass 046: what the waters under the ice show. */
export const ICE_SIGHTS = {
  place: { id: 'place:under-ice', label: 'Under the ice' },
  sponge: { id: 'species:glass-sponge', label: 'Glass sponge' },
  coral: { id: 'species:antarctic-soft-coral', label: 'Antarctic soft coral' },
  anemone: { id: 'species:antarctic-anemone', label: 'Antarctic anemone' },
  star: { id: 'species:antarctic-sea-star', label: 'Antarctic sea star' },
  feather: { id: 'species:feather-star', label: 'Feather star' },
  // v0.6 Pass 047
  emperor: { id: 'species:emperor-penguin', label: 'Emperor penguin' },
  adelie: { id: 'species:adelie-penguin', label: 'Adélie penguin' },
  weddell: { id: 'species:weddell-seal', label: 'Weddell seal' },
  weddellPup: { id: 'species:weddell-seal-pup', label: 'Weddell seal pup' },
  krill: { id: 'species:antarctic-krill', label: 'Antarctic krill' },
  icefish: { id: 'species:blackfin-icefish', label: 'Icefish' },
  notothen: { id: 'species:bald-notothen', label: 'Bald notothen' },
  seaSpider: { id: 'species:giant-sea-spider', label: 'Giant sea spider' },
  ribbonWorm: { id: 'species:ribbon-worm', label: 'Ribbon worm' },
  seaButterfly: { id: 'species:sea-butterfly', label: 'Sea butterfly' },
  combJelly: { id: 'species:comb-jelly', label: 'Comb jelly' },
  // v0.6 Pass 048: the rare ones
  leopardSeal: { id: 'species:leopard-seal', label: 'Leopard seal' },
  minke: { id: 'species:minke-whale', label: 'Minke whale' },
  orca: { id: 'species:killer-whale', label: 'Killer whale' },
  toothfish: {
    id: 'species:antarctic-toothfish',
    label: 'Antarctic toothfish',
  },
  squid: { id: 'species:colossal-squid', label: 'Colossal squid' },
  polarBear: { id: 'species:polar-bear', label: 'Polar bear' },
  // v0.6 Pass 052: more life under the ice
  jellyfish: {
    id: 'species:antarctic-jellyfish',
    label: 'Antarctic jellyfish',
  },
  salp: { id: 'species:salp', label: 'Salp chain' },
  urchin: { id: 'species:antarctic-sea-urchin', label: 'Antarctic sea urchin' },
  brittleStar: { id: 'species:brittle-star', label: 'Brittle star' },
  cucumber: { id: 'species:sea-cucumber', label: 'Sea cucumber' },
  scallop: { id: 'species:antarctic-scallop', label: 'Antarctic scallop' },
  seaPen: { id: 'species:sea-pen', label: 'Sea pen' },
  isopod: { id: 'species:giant-isopod', label: 'Giant isopod' },
  silverfish: {
    id: 'species:antarctic-silverfish',
    label: 'Antarctic silverfish',
  },
} as const satisfies Record<string, Sight>;

/** v0.6 Pass 042: what else the outer reef shows, now and then, out in the blue. */
export const OUTER_SIGHTS = {
  barracuda: { id: 'species:great-barracuda', label: 'Great barracuda' },
  // v0.6 Pass 043
  tang: { id: 'species:blue-tang', label: 'Blue tang' },
  butterflyfish: {
    id: 'species:threadfin-butterflyfish',
    label: 'Threadfin butterflyfish',
  },
  idol: { id: 'species:moorish-idol', label: 'Moorish idol' },
  parrotfish: { id: 'species:parrotfish', label: 'Bumphead parrotfish' },
  octopus: { id: 'species:octopus', label: 'Day octopus' },
  wrasse: { id: 'species:humphead-wrasse', label: 'Humphead wrasse' },
  trevally: { id: 'species:bigeye-trevally', label: 'Bigeye trevally' },
  bannerfish: { id: 'species:longfin-bannerfish', label: 'Longfin bannerfish' },
  sunfish: { id: 'species:ocean-sunfish', label: 'Ocean sunfish' },
  greatWhite: { id: 'species:great-white-shark', label: 'Great white shark' },
  cleanerWrasse: { id: 'species:cleaner-wrasse', label: 'Cleaner wrasse' },
} as const satisfies Record<string, Sight>;

/** What the shipwreck shows: the place, and its two spaces inside. */
export const WRECK_SIGHTS = {
  place: { id: 'place:shipwreck', label: 'Shipwreck' },
  hold: { id: 'place:shipwreck-hold', label: "The wreck's cargo hold" },
  bridge: { id: 'place:shipwreck-bridge', label: "The wreck's bridge" },
} as const satisfies Record<string, Sight>;

/** Every sight, in the order the "Seen" page lists them when first seen together. */
export const SIGHTS: readonly Sight[] = [
  ...Object.values(CRUISE_SPECIES).map((s) => ({
    id: creatureSight(s.id),
    label: s.name,
  })),
  ...Object.values(REEF_SIGHTS).filter(
    (s, i, all) => all.findIndex((o) => o.id === s.id) === i,
  ),
  ...Object.values(KELP_SIGHTS),
  ...Object.values(CAVE_SIGHTS),
  ...Object.values(OUTER_SIGHTS),
  ...Object.values(ICE_SIGHTS),
  ...Object.values(WRECK_SIGHTS),
];
/** A sight's name, or null for an id this version does not know (kept, but not listed). */
export function sightLabel(id: string): string | null {
  return SIGHTS.find((s) => s.id === id)?.label ?? null;
}
/**
 * The pause screen's "Seen" list: names and first dates, in the order first seen. Ids this
 * version does not know (from a newer version, say) stay in the journal but are not listed.
 */
export function seenList(
  seen: readonly Sighting[],
): { label: string; first: string }[] {
  return seen
    .map((s, order) => ({ s, order, label: sightLabel(s.id) }))
    .filter((e): e is typeof e & { label: string } => e.label !== null)
    .sort(
      (a, b) =>
        Date.parse(a.s.first) - Date.parse(b.s.first) || a.order - b.order,
    )
    .map((e) => ({ label: e.label, first: e.s.first }));
}
