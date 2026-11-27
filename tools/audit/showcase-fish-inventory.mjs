/** Current Pass 018 audit over the existing canonical fish; retains the Pass 015 census as history. */
import fs from 'node:fs';
import ts from 'typescript';
const compiled = ts.transpileModule(
  fs.readFileSync('src/fish/lowPoly/designs.ts', 'utf8'),
  {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
  },
).outputText;
const { CORE_FISH, CORE_FISH_IDS } = await import(
  `data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`
);
const previous = JSON.parse(
  fs.readFileSync('docs/low-poly/core-fish-inventory.json', 'utf8'),
);
const evidence = JSON.parse(
  fs.readFileSync('docs/low-poly/pass018-evidence/results.json', 'utf8'),
);
const rows = CORE_FISH_IDS.map((id) => {
  const d = CORE_FISH[id],
    prior = previous.records.find((r) => r.id === id);
  const silhouette =
    id === 'ocellaris-clownfish'
      ? 'Compact forehead/snout, rounded tail/pectorals/dorsal, topology-aligned white bands with dark borders'
      : d.dorsal === 'banner' || d.dorsal === 'thread'
        ? 'Narrow trailing dorsal outline in the existing navigation envelope'
        : d.tail === 'round'
          ? 'Rounded caudal and pectoral outlines on the existing species-authored body'
          : 'Existing species-authored head, peduncle and fin silhouette retained; independent pectoral articulation added';
  return {
    id,
    name: prior.name,
    habitats: prior.habitats,
    asset: d.asset,
    source: 'src/fish/lowPoly/model.ts',
    definition: 'src/fish/lowPoly/designs.ts',
    silhouette,
    bodyStations: {
      height: d.heights,
      width: d.widths,
      depth: d.depth,
      bodyWidth: d.width,
      forehead: d.forehead,
    },
    palette: d.palette,
    pattern: d.pattern,
    tail: d.tail,
    dorsal: d.dorsal,
    triangles: evidence.final.counts.find((r) => r.id === id).triangles,
    motion:
      'Existing habitat/school controller; independent bounded pectoral poses and continuous tail/body stroke; trailing web bend where applicable',
    contexts: ['wild', 'album', 'aquarium', 'fallback', 'near/far'],
    anchors:
      'Existing scales, origins, shelters and collision proxies retained; focused extent and habitat regression tests',
    status:
      'Refined from Pass 017 canonical model; automated checks and four-view inspection; device acceptance pending',
  };
});
fs.writeFileSync(
  'docs/low-poly/showcase-fish-inventory.json',
  JSON.stringify(
    {
      pass: '018',
      base: '72f856d',
      scope:
        '29 existing swimming fish share the refinement; original seahorse/frogfish audited and retained from Pass 017. No new species.',
      retained: previous.records
        .filter((r) => r.id === 'seahorse' || r.id === 'frogfish')
        .map((r) => ({
          id: r.id,
          source: r.source,
          reason:
            'Already distinct pivot-local anatomy; existing low-key fin, grip, jaw and perch controllers remain unchanged',
        })),
      records: rows,
    },
    null,
    2,
  ) + '\n',
);
const file = 'docs/low-poly/asset-inventory.json',
  census = JSON.parse(fs.readFileSync(file, 'utf8'));
census.migrations['018'] = {
  inventory: 'docs/low-poly/showcase-fish-inventory.json',
  identities: 29,
  scope:
    'User-approved special/showcase fish refinement supersedes the provisional small-animal assignment.',
  deferred:
    'Original census records labelled pass 018 are small animals/invertebrates awaiting a separately agreed pass; their historical labels do not claim completion.',
  verification: 'docs/low-poly/PASS_018_VALIDATION.md',
};
fs.writeFileSync(file, JSON.stringify(census, null, 2) + '\n');
