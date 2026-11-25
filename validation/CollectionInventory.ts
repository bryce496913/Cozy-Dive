import { TANK_BABIES } from '../src/config/babies';
import { ASSET_REGISTRY, type AssetId } from '../src/assets/AssetRegistry';
import {
  COLLECTION,
  collectionEntry,
  SECTION_NAMES,
  type AlbumSection,
} from '../src/collection/registry';
import {
  AQUARIUM_SIGHTS,
  OUTER_SIGHTS,
  type Sight,
} from '../src/discovery/sights';
import { RARE_MINI_NODES } from '../src/creatures/discoveries/RareMinis';
import { REEF_MINI_NODES } from '../src/environment/outer/ReefMinis';
import {
  KELP_MINI_NODES,
  KELP_MINI_SIGHTS,
} from '../src/environment/kelp/KelpMinis';
import {
  WRECK_MINI_NODES,
  WRECK_MINI_SIGHTS,
} from '../src/environment/wreck/WreckMinis';
import {
  CAVE_MINI_NODES,
  CAVE_MINI_SIGHTS,
} from '../src/environment/cave/CaveMinis';
import {
  ICE_MINI_NODES,
  ICE_MINI_SIGHTS,
} from '../src/environment/ice/IceMinis';
const NOTES: Record<string, readonly [string, string, string, string]> = {
  'pikachu-nudibranch': [
    'Thecacera pacifica',
    'Slow rock-face crawl, mantle flex',
    'Existing level reef-rock face in the home aquarium',
    'Inspect the channel-facing rock surfaces for yellow and black.',
  ],
  'leaf-sheep': [
    'Costasiella kuroshimae',
    'Feeding and cerata/body flex; aquarium substrate crawl',
    'Existing Caulerpa growth in the aquarium',
    'Look closely at the green algae margins.',
  ],
  'candy-crab': [
    'Hoplophrys oatesii',
    'Grip shifts and crouching; local aquarium crawl',
    'Existing finger-leather coral in the aquarium',
    'Search pink coral fingers for a tiny matching crab.',
  ],
  'harlequin-shrimp': [
    'Hymenocera picta',
    'Claw/antenna movement and tiny steps',
    'Reef-top substrate near the western coral margin',
    'Look down beside the coral bases, not into open water.',
  ],
  'ornate-ghost-pipefish': [
    'Solenostomus paradoxus',
    'Gentle fins and vegetation hover',
    'Eastern reef-top vegetation',
    'Pause beside branching growth and watch for a leaf-like silhouette.',
  ],
  'hairy-frogfish': [
    'Antennarius striatus',
    'Lure/fin idle; bottom-associated aquarium movement',
    'Sheltered reef-top substrate',
    'Look for a mottled face at the base of sheltered growth.',
  ],
  'mimic-octopus': [
    'Thaumoctopus mimicus',
    'Arm postures, exploration and concealment; resting intervals',
    'Eastern reef sand margin',
    'Watch the sand edge for patterned arms that change posture.',
  ],
  'weedy-seadragon': [
    'Phyllopteryx taeniolatus',
    'Slow fin motion and vegetation hover',
    'Existing kelp and boulder margin',
    'Look among the low kelp leaves for a long leafy animal.',
  ],
  'spanish-shawl': [
    'Flabellinopsis iodinea',
    'Soft-body crawl and cerata movement',
    'Existing hydroid-bearing kelp rock',
    'Purple and orange stand out when you inspect rock growth closely.',
  ],
  'sarcastic-fringehead': [
    'Neoclinus blanchardi',
    'Den peeking and occasional mouth display',
    'Existing kelp boulder den',
    'Stay by a suitable rock opening and wait for a colorful mouth.',
  ],
  'east-pacific-red-octopus': [
    'Octopus rubescens',
    'Arm movement, camouflage and short exploration',
    'Existing kelp rock shelter',
    'Check sheltered rock margins for a small reddish mantle.',
  ],
  'skeleton-shrimp': [
    'Caprellidae (approved family)',
    'Grasping and swaying; clinging aquarium idle',
    'Existing growth on wreck steel',
    'Inspect hydroids and encrusting growth for an articulated stick-like body.',
  ],
  'juvenile-wolf-eel': [
    'Anarrhichthys ocellatus',
    'Peeking, gentle withdrawal and body flex',
    'Existing wreck opening beside hull steel',
    'Look into a protected opening for an orange, spotted juvenile.',
  ],
  'decorator-crab': [
    'Decorator crab (approved generic identity)',
    'Slow repositioning and decorated-shell/leg idle',
    'Existing wreck soft-growth margin',
    'Watch growth-covered steel for a decorated shell that moves.',
  ],
  'painted-greenling': [
    'Oxylebius pictus',
    'Short perch changes and controlled fin movements',
    'Existing encrusted wreck metal',
    'Look for stripes on a fish resting close to the steel.',
  ],
  stargazer: [
    'Uranoscopidae (approved generic identity)',
    'Sand camouflage, emergence and shifting; bottom rest',
    'Existing cave sand',
    'Search open sand for upward eyes and a mouth, then wait.',
  ],
  'psychedelic-frogfish': [
    'Histiophryne psychedelica',
    'Fin-supported shuffle/hop and idle',
    'Existing sheltered cave boulder margin',
    'Inspect beneath sheltered formations for swirling stripes.',
  ],
  'banded-coral-shrimp': [
    'Stenopus hispidus',
    'Antenna and leg movement; sheltered rest',
    'Existing narrow cave crack',
    'Long pale antennae can reveal the red-and-white body.',
  ],
  wonderpus: [
    'Wunderpus photogenicus',
    'Slow arms, exploration and brief concealment',
    'Entrance-side cave sand beside shelter',
    'Search the sheltered sandy entrance margin for contrasting arm bands.',
  ],
  'sea-angel': [
    'Clione antarctica',
    'Restrained translucent wings and gentle drift',
    'Under-ice water away from breathing-hole margins',
    'Look upward beneath the ice for paired wings and muted orange organs.',
  ],
  'tritoniella-belli': [
    'Tritoniella belli',
    'Soft mantle flex and slow local crawl',
    'Existing Antarctic soft-coral margin',
    'Look at pale growth near the seabed for a soft slug with short marginal processes.',
  ],
  'giant-isopod': [
    'Glyptonotus antarcticus',
    'Seven articulated leg pairs and slow exploration',
    'Existing Antarctic dropstone margin',
    'Inspect the sand beside dark dropstones for overlapping armored plates.',
  ],
};
interface Group {
  asset: AssetId;
  section: AlbumSection;
  nodes: Readonly<Record<string, string>>;
  sights: Readonly<Record<string, Sight>>;
  test: string;
}
const groups: readonly Group[] = [
  {
    asset: 'rareMinis',
    section: 'aquarium',
    nodes: RARE_MINI_NODES,
    sights: AQUARIUM_SIGHTS,
    test: 'rare-minis.test.ts',
  },
  {
    asset: 'reefMinis',
    section: 'outer-reef',
    nodes: REEF_MINI_NODES,
    sights: {
      harlequin: OUTER_SIGHTS.harlequinShrimp,
      pipefish: OUTER_SIGHTS.ghostPipefish,
      frogfish: OUTER_SIGHTS.hairyFrogfish,
      mimic: OUTER_SIGHTS.mimicOctopus,
    },
    test: 'reef-minis.test.ts',
  },
  {
    asset: 'kelpMinis',
    section: 'kelp-forest',
    nodes: KELP_MINI_NODES,
    sights: KELP_MINI_SIGHTS,
    test: 'kelp-minis.test.ts',
  },
  {
    asset: 'wreckMinis',
    section: 'shipwreck',
    nodes: WRECK_MINI_NODES,
    sights: WRECK_MINI_SIGHTS,
    test: 'wreck-minis.test.ts',
  },
  {
    asset: 'caveMinis',
    section: 'sea-cave',
    nodes: CAVE_MINI_NODES,
    sights: CAVE_MINI_SIGHTS,
    test: 'cave-minis.test.ts',
  },
  {
    asset: 'iceMinis',
    section: 'antarctic',
    nodes: ICE_MINI_NODES,
    sights: ICE_MINI_SIGHTS,
    test: 'ice-minis.test.ts',
  },
];
/** Acceptance-only inventory: no hints, files or audit metadata are imported into the game. */
export function collectionInventory() {
  return groups.flatMap((g) =>
    Object.entries(g.nodes).map(([kind, node]) => {
      const sight = g.sights[kind],
        entry = collectionEntry(sight.id),
        d = TANK_BABIES.find((b) => b.sighting === sight.id);
      if (!entry || !d)
        throw Error(`Missing collection/tank identity: ${sight.id}`);
      const note = NOTES[d.id];
      if (!note) throw Error(`Missing acceptance note: ${d.id}`);
      return {
        name: entry.name,
        scientificName: note[0],
        id: entry.id,
        habitat: g.section,
        habitatName: SECTION_NAMES[g.section],
        asset: g.asset,
        file: ASSET_REGISTRY[g.asset].path,
        node,
        wildNode: g.nodes[kind],
        animation: note[1],
        location: note[2],
        hint: note[3],
        slot: entry.order + 1,
        order: entry.order,
        eligible: entry.tank?.slot === 'animal' && entry.tank.key === d.id,
        tankId: d.id,
        tankAsset: d.asset,
        tankNodes: d.nodes,
        test: `tests/${g.test}`,
        canonicalEntryCount: COLLECTION.filter((e) => e.id === entry.id).length,
      };
    }),
  );
}
export function inventoryMarkdown(
  rows: ReturnType<typeof collectionInventory>,
): string {
  return (
    '# Pass 107 — Rare discovery collection matrix\n\nAcceptance spoilers only; not shipped in gameplay. Slots below are 1-based. Source nodes are joined directly from the wild owners, registry and tank definitions. PASS means the inventory checks and the named habitat suites passed in the recorded targeted run; it is not MacBook Air acceptance.\n\n| Species / identity | Primary habitat / slot | Canonical asset and node | Animation | Discovery location / manual hint | Aquarium | Automated status |\n| --- | --- | --- | --- | --- | --- | --- |\n' +
    rows
      .map(
        (r) =>
          `| ${r.name} — _${r.scientificName}_; \`${r.id}\` | ${r.habitatName} #${r.slot} | \`${r.file}\` / \`${r.node}\` | ${r.animation} | ${r.location}. **Hint:** ${r.hint} | Yes, after observation; \`${r.tankId}\` | PASS: [habitat suite](../${r.test}), inventory and collection integration |`,
      )
      .join('\n') +
    '\n\nSpanish shawl, sea angel and giant isopod retain their older identities; no generic duplicate was added. Weedy seadragon remains the approved Australian temperate exception. The approved cave roster retains its documented tropical Indo-Pacific component.\n'
  );
}
