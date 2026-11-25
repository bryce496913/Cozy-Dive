/** Preserve Pass 053's established Spanish-shawl anatomy as the Blender library's source mesh. */
import { createServer } from 'vite';
import fs from 'node:fs';
const server = await createServer({ server: { middlewareMode: true } });
try {
  const { spanishShawlGeometry } = await server.ssrLoadModule(
    '/src/environment/kelp/SpanishShawl.ts',
  );
  const g = spanishShawlGeometry();
  fs.writeFileSync(
    'tools/art/pass102/spanish-source.json',
    JSON.stringify({
      position: Array.from(g.getAttribute('position').array),
      color: Array.from(g.getAttribute('color').array),
      index: g.index ? Array.from(g.index.array) : null,
    }),
  );
  g.dispose();
} finally {
  await server.close();
}
