/** Reconcile the Pass 015 census with the canonical Pass 017 definitions. No GLBs are deleted.
 * Type-only imports erase completely in these two data modules; no runtime TS loader is needed. */
import fs from 'node:fs';
import ts from 'typescript';
const dataModule = async (file) => {
  const js = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  return import(
    `data:text/javascript;base64,${Buffer.from(js).toString('base64')}`
  );
};
const { CORE_FISH, CORE_FISH_IDS } = await dataModule(
  'src/fish/lowPoly/designs.ts',
);
const { ASSET_REGISTRY } = await dataModule('src/assets/AssetRegistry.ts');
const evidence = JSON.parse(
  fs.readFileSync('docs/low-poly/pass017-evidence/results.json', 'utf8'),
);
const habitat = {
  'blue-green-chromis': ['Aquarium', 'Outer Reef', 'Shipwreck'],
  'pajama-cardinalfish': ['Aquarium', 'Outer Reef'],
  'royal-gramma': ['Aquarium', 'Outer Reef', 'Shipwreck'],
  'yellow-assessor': ['Aquarium', 'Outer Reef'],
  'firefish-goby': ['Aquarium', 'Outer Reef'],
  'ocellaris-clownfish': ['Aquarium', 'Outer Reef'],
  garibaldi: ['Kelp Forest'],
  'kelp-bass': ['Kelp Forest'],
  blacksmith: ['Kelp Forest'],
  senorita: ['Kelp Forest'],
  'glassy-sweeper': ['Sea Cave', 'Shipwreck'],
  soldierfish: ['Sea Cave'],
  'flashlight-fish': ['Sea Cave'],
  'blue-tang': ['Outer Reef'],
  'threadfin-butterflyfish': ['Outer Reef'],
  'moorish-idol': ['Outer Reef', 'Shipwreck'],
  'longfin-bannerfish': ['Outer Reef'],
  parrotfish: ['Outer Reef'],
  'bigeye-trevally': ['Outer Reef'],
  'humphead-wrasse': ['Outer Reef'],
  'great-barracuda': ['Outer Reef', 'Shipwreck'],
  'giant-sea-bass': ['Kelp Forest'],
  'queensland-grouper': ['Shipwreck'],
  'california-sheephead': ['Kelp Forest'],
  'cleaner-wrasse': ['Outer Reef'],
  'antarctic-silverfish': ['Antarctic'],
  'blackfin-icefish': ['Antarctic'],
  'bald-notothen': ['Antarctic'],
  'antarctic-toothfish': ['Antarctic'],
};
const records = CORE_FISH_IDS.map((id) => ({
  id,
  name: id.replaceAll('-', ' '),
  asset: CORE_FISH[id].asset,
  source: 'src/fish/lowPoly/model.ts',
  definition: 'src/fish/lowPoly/designs.ts',
  habitats: habitat[id],
  additionalContext: 'Aquarium placement and album preview',
  bodyStations: {
    height: CORE_FISH[id].heights,
    width: CORE_FISH[id].widths,
    depth: CORE_FISH[id].depth,
    bodyWidth: CORE_FISH[id].width,
    forehead: CORE_FISH[id].forehead,
  },
  tail: CORE_FISH[id].tail,
  dorsal: CORE_FISH[id].dorsal,
  pattern: CORE_FISH[id].pattern,
  triangles: evidence.final.counts.find((row) => row.id === id)?.triangles,
  variants:
    'Near/far/Full/lighter share the same designed geometry; procedural fallback uses the same factory at configured length.',
  status:
    'Implemented; automated geometry/ownership and four-view gallery checked. Actual-device visual acceptance pending.',
}));
for (const [id, parts, behavior] of [
  [
    'seahorse',
    ['HorseBody', 'HorseTail', 'HorseDorsal', 'HorseLeftFin', 'HorseRightFin'],
    'Existing upright hover, tail grip and fin oscillation',
  ],
  [
    'frogfish',
    ['FrogBody', 'FrogFoot', 'FrogJaw', 'FrogLure'],
    'Existing perch walking, jaw respiration/yawn and lure movement',
  ],
])
  records.push({
    id,
    name: id,
    asset: 'anchored',
    source: 'src/fish/lowPoly/anchored.ts',
    habitats: ['Aquarium'],
    additionalContext: 'Existing resident and album preview',
    parts,
    behavior,
    variants:
      'Shared pivot-local parts replace both mixed-library render parts and procedural fallback.',
    status:
      'Implemented; existing controller regression checks and gallery inspection; actual-device acceptance pending.',
  });
fs.writeFileSync(
  'docs/low-poly/core-fish-inventory.json',
  JSON.stringify(
    { pass: '017', identities: 31, swimmingFish: 29, anchoredFish: 2, records },
    null,
    2,
  ) + '\n',
);
const file = 'docs/low-poly/asset-inventory.json',
  inventory = JSON.parse(fs.readFileSync(file, 'utf8'));
const archived = new Set(
  CORE_FISH_IDS.map(
    (id) => 'public/' + ASSET_REGISTRY[CORE_FISH[id].asset].path,
  ).filter((p) => !p.includes('/generated/')),
);
for (const row of inventory.assets) {
  if (archived.has(row.source)) {
    row.pass = '017';
    row.status =
      'Superseded at runtime by canonical Pass 017 generated fish; original GLB retained as historical/source asset.';
    row.replacementSource = 'src/fish/lowPoly/model.ts';
    row.verification =
      'core-fish-low-poly.test.ts; Pass 017 gallery and habitat report';
  }
  if (
    row.source.endsWith('/anchored-life.glb') &&
    /^(Horse|Frog)/.test(row.name)
  ) {
    row.pass = '017';
    row.status =
      'Rebuilt at the mixed-library loading boundary; unrelated library parts retained.';
    row.replacementSource = 'src/fish/lowPoly/anchored.ts';
  }
  if (
    row.source === 'src/fish/FishGeometry.ts' ||
    row.source === 'src/creatures/discoveries/Frogfish.ts'
  ) {
    row.pass = '017';
    row.status = 'Legacy construction replaced by canonical Pass 017 factory.';
    row.replacementSource = row.source.includes('Frogfish')
      ? 'src/fish/lowPoly/anchored.ts'
      : 'src/fish/lowPoly/model.ts';
  }
  if (row.source === 'src/creatures/discoveries/Seahorse.ts') {
    row.pass = '017';
    row.status =
      'Legacy construction replaced by canonical Pass 017 anchored-fish factory.';
    row.replacementSource = 'src/fish/lowPoly/anchored.ts';
  }
}
inventory.migrations = {
  ...inventory.migrations,
  '017': {
    inventory: 'docs/low-poly/core-fish-inventory.json',
    identities: 31,
    scope:
      '29 swimming fish plus original seahorse and frogfish. Rare discoveries, sharks/rays, moray and invertebrates remain with their assigned passes.',
  },
};
fs.writeFileSync(file, JSON.stringify(inventory, null, 2) + '\n');
console.log(
  `Reconciled ${records.length} species; ${archived.size} historical GLB libraries retained.`,
);
