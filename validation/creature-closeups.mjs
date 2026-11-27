/* v0.6 Pass 053: consistent close-ups of the creatures built in code, for the visual audit.
 *
 *   COZY_URL=http://127.0.0.1:5173 COZY_OUTPUT=/tmp/cozy053-closeups node validation/creature-closeups.mjs
 *
 * Loads each geometry builder through the dev server and renders it alone, framed to its bounds,
 * from three angles (side, three-quarter front, above) under one neutral underwater light rig, so
 * before/after comparisons are like for like. Writes one PNG per creature (the three views side by
 * side) and report.json (triangle counts, sizes).
 */
import fs from 'node:fs';
import path from 'node:path';
const { chromium } = await import(process.env.COZY_PLAYWRIGHT || 'playwright');
const output = process.env.COZY_OUTPUT || '/tmp/cozy053-closeups';
fs.mkdirSync(output, { recursive: true });
/** [name, module, export]; exports that are missing in this revision are skipped. */
const SUBJECTS = [
  ['spiny-lobster', '/src/environment/cave/CaveLobsters.ts', 'lobsterBody'],
  [
    'spiny-lobster-new',
    '/src/environment/cave/SpinyLobster.ts',
    'spinyLobsterBody',
  ],
  ['rock-crab', '/src/environment/cave/CaveCrabs.ts', 'crabBody'],
  [
    'spanish-shawl',
    '/src/environment/kelp/KelpCritters.ts',
    'nudibranchGeometry',
  ],
  [
    'spanish-shawl-new',
    '/src/environment/kelp/SpanishShawl.ts',
    'spanishShawlGeometry',
  ],
  ['krill', '/src/environment/ice/IceCritters.ts', 'krillGeometry'],
  ['sea-butterfly', '/src/environment/ice/IceCritters.ts', 'butterflyGeometry'],
  ['comb-jelly', '/src/environment/ice/IceCritters.ts', 'jellyGeometry'],
  ['krill-new', '/src/environment/ice/IceCritterShapes.ts', 'krillShape'],
  [
    'sea-butterfly-new',
    '/src/environment/ice/IceCritterShapes.ts',
    'seaButterflyShape',
  ],
  [
    'comb-jelly-new',
    '/src/environment/ice/IceCritterShapes.ts',
    'combJellyShape',
  ],
  ['kelp-urchin-new', '/src/environment/kelp/KelpShapes.ts', 'urchinShape'],
  ['kelp-star-new', '/src/environment/kelp/KelpShapes.ts', 'seaStarShape'],
  ['kelp-urchin', '/src/environment/kelp/KelpDressing.ts', 'urchinGeometry'],
  ['kelp-star', '/src/environment/kelp/KelpDressing.ts', 'starGeometry'],
  ['glass-sponge', '/src/environment/ice/IceGarden.ts', 'spongeGeometry'],
  ['ice-soft-coral', '/src/environment/ice/IceGarden.ts', 'softCoralGeometry'],
];
const browser = await chromium.launch({
  executablePath: process.env.COZY_CHROMIUM,
  args: [
    '--no-sandbox',
    '--disable-dev-shm-usage',
    '--enable-unsafe-swiftshader',
    '--use-angle=swiftshader',
  ],
});
const report = { errors: [], subjects: [] };
try {
  const page = await browser.newPage({ viewport: { width: 900, height: 300 } });
  page.on('pageerror', (e) => report.errors.push(e.message));
  await page
    .goto((process.env.COZY_URL || 'http://127.0.0.1:5173') + '/benchmark.html')
    .catch(() => undefined);
  await page.setContent(
    '<html><body style="margin:0;background:#173b46"><canvas id="c" width="900" height="300"></canvas></body></html>',
  );
  const base = process.env.COZY_URL || 'http://127.0.0.1:5173';
  for (const [name, mod, fn] of SUBJECTS) {
    const result = await page.evaluate(
      async ([base, mod, fn]) => {
        const THREE = await import(
          base + '/node_modules/.vite/deps/three.js'
        ).catch(() => import(base + '/@id/three'));
        let m;
        try {
          m = await import(base + mod);
        } catch {
          return { skipped: 'module missing' };
        }
        if (typeof m[fn] !== 'function') return { skipped: 'export missing' };
        const geometry = m[fn]();
        geometry.computeBoundingBox();
        const box = geometry.boundingBox,
          size = box.getSize(new THREE.Vector3()),
          centre = box.getCenter(new THREE.Vector3()),
          radius = size.length() / 2;
        const canvas = document.getElementById('c'),
          renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
        renderer.setSize(900, 300, false);
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.2;
        renderer.setScissorTest(true);
        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0x173b46);
        scene.add(new THREE.HemisphereLight(0xc7f2e0, 0x546b56, 2.2));
        const sun = new THREE.DirectionalLight(0xfff1cf, 2.6);
        sun.position.set(1, 3, 2);
        scene.add(sun);
        const material = new THREE.MeshStandardMaterial({
          vertexColors: !!geometry.getAttribute('color'),
          roughness: 0.55,
          color: 0xffffff,
          side: THREE.DoubleSide,
        });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.copy(centre).multiplyScalar(-1);
        scene.add(mesh);
        const camera = new THREE.PerspectiveCamera(
          35,
          1,
          radius / 100,
          radius * 100,
        );
        const views = [
          [1, 0.15, 0],
          [0.7, 0.45, 0.8],
          [0.05, 1, 0.25],
        ];
        views.forEach((d, i) => {
          const dir = new THREE.Vector3(...d).normalize();
          camera.position.copy(dir).multiplyScalar(radius * 3.2);
          camera.lookAt(0, 0, 0);
          renderer.setViewport(i * 300, 0, 300, 300);
          renderer.setScissor(i * 300, 0, 300, 300);
          renderer.render(scene, camera);
        });
        const triangles =
          (geometry.index
            ? geometry.index.count
            : geometry.getAttribute('position').count) / 3;
        geometry.dispose();
        material.dispose();
        renderer.dispose();
        return { triangles, size: size.toArray().map((n) => +n.toFixed(3)) };
      },
      [base, mod, fn],
    );
    if (!result.skipped)
      await page.screenshot({
        path: path.join(output, `${name}.png`),
        clip: { x: 0, y: 0, width: 900, height: 300 },
        timeout: 180000,
      });
    report.subjects.push({ name, ...result });
    console.log(name, JSON.stringify(result));
  }
} finally {
  fs.writeFileSync(
    path.join(output, 'report.json'),
    JSON.stringify(report, null, 2),
  );
  await browser.close();
}
