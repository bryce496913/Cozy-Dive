import fs from 'node:fs';
import path from 'node:path';
const walk = (dir) =>
  fs
    .readdirSync(dir, { withFileTypes: true })
    .flatMap((e) =>
      e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)],
    );
const sources = walk('src')
  .filter((p) => p.endsWith('.ts'))
  .map((file) => ({ file, text: fs.readFileSync(file, 'utf8') }));
const habitats = [
  'Aquarium',
  'Outer Reef / open-water visitor corridor',
  'Kelp Forest',
  'Shipwreck',
  'Sea Cave',
  'Antarctic under-ice',
  'Office / aquarium exterior',
];
function assignment(name) {
  if (/office|desk|chair|monitor|laptop|cabinet|lamp/i.test(name)) return '025';
  if (/wreck|ornament|chest|statue|filter|prop/i.test(name)) return '024';
  if (
    /rock|terrain|geology|sand|iceberg|backdrop|glass|wall|floor|ceiling|passage|shaft/i.test(
      name,
    )
  )
    return '023';
  if (/kelp|grass|plant|algae|caulerpa/i.test(name)) return '022';
  if (/coral|anemone|sponge|reefhabitat|reefbenchmark/i.test(name))
    return '021';
  if (
    /mini|nudibranch|fringehead|wonderpus|stargazer|greenling|seadragon/i.test(
      name,
    )
  )
    return '020';
  if (
    /shark|whale|ray|seal|lion|penguin|bear|turtle|otter|gull|sunfish|squid/i.test(
      name,
    )
  )
    return '019';
  if (
    /fish|chromis|tang|wrasse|gramma|goby|cardinal|assessor|bass|toothfish|anchored/i.test(
      name,
    )
  )
    return '017';
  return '018';
}
const rows = [];
for (const file of walk('public/assets').filter((f) => f.endsWith('.glb'))) {
  const b = fs.readFileSync(file),
    j = JSON.parse(b.subarray(20, 20 + b.readUInt32LE(12)).toString());
  for (const [i, n] of (j.nodes ?? []).entries())
    if (n.mesh !== undefined) {
      const mesh = j.meshes[n.mesh];
      rows.push({
        id: `${file}#${i}`,
        name: n.name ?? `mesh-${n.mesh}`,
        source: file,
        geometry:
          'Authored GLB mesh; inspect source topology before replacement',
        materials: mesh.primitives.map(
          (p) => j.materials?.[p.material]?.name ?? 'unnamed/default',
        ),
        triangles: mesh.primitives.reduce(
          (v, p) =>
            v +
            (j.accessors[p.indices ?? p.attributes.POSITION]?.count ?? 0) / 3,
          0,
        ),
        animation: mesh.primitives.some((p) => p.targets?.length)
          ? 'Morph targets: preserve anatomical propulsion / idle channels'
          : 'Check rig and owning controller; static or skeletal',
        dependencies:
          'Registry requiredNodes, wild owner, card/tank source selection; preserve IDs and node contracts',
        collision: /COLLIDER|COLLISION/i.test(n.name ?? '')
          ? 'Structural collision helper; preserve until replacement validation'
          : 'Check owning scene collision and observation anchors',
        environments:
          'Resolve through sourceReferences and registry; shared library may span habitats',
        sourceReferences: sources
          .filter(
            (s) =>
              s.text.includes(n.name ?? '__none__') ||
              s.text.includes(file.replace('public/', '')),
          )
          .map((s) => s.file),
        pass: assignment(file + ' ' + n.name),
        status: 'pending',
        integration: '026',
        animationCompletion: '027',
        verification: '028',
      });
    }
}
for (const { file, text } of sources) {
  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i++)
    if (
      /new\s+(?:THREE\.)?(?:\w*Geometry|Mesh|InstancedMesh|Points|LineSegments|Sprite)\s*\(/.test(
        lines[i],
      )
    ) {
      rows.push({
        id: `${file}:${i + 1}`,
        name: lines[i].trim(),
        source: file,
        line: i + 1,
        geometry:
          'Direct geometry/render-object construction; may be shared helper or non-visible collision utility',
        materials:
          'Owning source material/shader; inspect local and imported factories',
        animation:
          'Owning update/controller; preserve pause and reduced motion',
        dependencies:
          'Trace callers before modifying shared factory; preserve sighting/save identity',
        collision: 'Inspect collider/interaction consumers in owning source',
        environments: habitats.filter((h, k) =>
          k === 0
            ? !/\/(outer|kelp|wreck|cave|ice|office)\//.test(file)
            : file.includes(
                '/' +
                  ['', 'outer', 'kelp', 'wreck', 'cave', 'ice', 'office'][k] +
                  '/',
              ),
        ),
        pass: assignment(file),
        status: 'pending-source-review',
        integration: '026',
        animationCompletion: '027',
        verification: '028',
      });
    }
}
fs.writeFileSync(
  'docs/low-poly/asset-inventory.json',
  JSON.stringify(
    {
      base: 'e460f29',
      scope:
        'Mesh-node and direct-construction census, not a certified semantic asset inventory. Source sites can be shared or non-visible; indirect factories and runtime instances require review.',
      habitats,
      assets: rows,
    },
    null,
    2,
  ) + '\n',
);
console.log(
  JSON.stringify({
    rows: rows.length,
    glbMeshes: rows.filter((r) => r.source.endsWith('.glb')).length,
    sourceSites: rows.filter((r) => r.line).length,
  }),
);
