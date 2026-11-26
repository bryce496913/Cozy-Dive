import fs from 'node:fs';
import assert from 'node:assert/strict';
const { chromium } = await import(
  process.env.COZY_PLAYWRIGHT ||
    '/tmp/cozy-browser/node_modules/playwright/index.mjs'
);
const output = 'docs/low-poly/pass017-evidence';
fs.mkdirSync(output, { recursive: true });
const browser = await chromium.launch({
  executablePath: '/usr/bin/chromium',
  args: [
    '--no-sandbox',
    '--disable-dev-shm-usage',
    '--enable-unsafe-swiftshader',
    '--use-angle=swiftshader',
  ],
});
const report = {
  renderer:
    'Chromium SwiftShader; localized scenes, not a passage traversal or hardware benchmark',
  errors: [],
  fishDownloads: [],
};
try {
  const page = await browser.newPage({
    viewport: { width: 1280, height: 900 },
  });
  page.setDefaultTimeout(300000);
  page.on('pageerror', (e) => report.errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') {
      report.errors.push(m.text());
      console.error(m.text());
    }
  });
  page.on('request', (r) => {
    if (/\/models\/fish\/.*\.glb|barracuda\.glb/.test(r.url()))
      report.fishDownloads.push(r.url());
  });
  await page.route('**/src/main.ts*', async (route) => {
    const response = await route.fetch();
    let body = await response.text();
    body = body.replace(
      /new Application\(([^;]+)\);/,
      'new Application($1, undefined, {startMode: "aquarium"});',
    );
    await route.fulfill({ response, body: body + '\nwindow.__cozy=app;' });
  });
  const start = Date.now();
  await page.goto('http://localhost:5181');
  await page.waitForFunction(() => window.__cozy?.tankEditor);
  await page.evaluate(async () => {
    await window.__cozy.world.prepared;
    await window.__cozy.tankEditor.ready;
  });
  report.aquariumLoadMs = Date.now() - start;
  console.log('Aquarium ready');
  await page
    .getByRole('button', { name: /^(Dive In|Return to the Water)$/ })
    .click();
  await page.waitForFunction(() => !!document.pointerLockElement);
  await page.keyboard.press('w');
  await page.waitForTimeout(250);
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => !document.pointerLockElement);
  const aquarium = await page.evaluate(() => {
    // The real input/pause checks have completed; avoid rendering the paused
    // aquarium behind the localized kelp warm-up on software GPUs.
    cancelAnimationFrame(window.__cozy.frame);
    const w = window.__cozy.world;
    w.camera.position.set(0, 7, 1.5);
    w.camera.lookAt(0, 7, -3);
    w.render(0, false, 0, false, {
      position: w.camera.position,
      velocity: { x: 0, y: 0, z: 0 },
      active: false,
    });
    return {
      image: w.renderer.domElement.toDataURL(),
      render: { ...w.renderer.info.render },
      fish: w.aquarium.fish.simulation.fish.length,
      state: w.authored.state,
      leases: w.authored.loader.leased,
    };
  });
  fs.writeFileSync(
    `${output}/aquarium.png`,
    Buffer.from(aquarium.image.split(',')[1], 'base64'),
  );
  delete aquarium.image;
  report.aquarium = aquarium;
  assert.equal(aquarium.state, 'ready');
  const kelpStart = Date.now();
  await page.evaluate(async () => {
    const { KelpForestScene } =
      await import('/src/rendering/KelpForestScene.ts');
    const w = window.__cozy.world;
    window.__kelpInspection = await KelpForestScene.build(w.renderer, {
      fish: w.authored.loader,
      soundSpots: 0,
    });
    await window.__kelpInspection.prepared;
  });
  report.kelpLoadMs = Date.now() - kelpStart;
  console.log('Kelp ready');
  report.kelp = await page.evaluate(() => {
    const k = window.__kelpInspection,
      w = window.__cozy.world;
    const target = k.schools.fish.simulation.fish.find(
      (f) => f.species.id === 'blacksmith',
    ).position;
    k.camera.position.set(target.x + 2, target.y + 0.5, target.z + 3);
    k.camera.lookAt(target.x, target.y, target.z);
    const player = {
      position: k.camera.position,
      velocity: { x: 0, y: 0, z: 0 },
      active: true,
    };
    for (let i = 0; i < 8; i++) k.render(i / 30, false, 1 / 30, true, player);
    return {
      image: w.renderer.domElement.toDataURL(),
      render: { ...w.renderer.info.render },
      ready: k.isReady,
      fish: k.schools.fish.simulation.fish.length,
      ids: [
        ...new Set(k.schools.fish.simulation.fish.map((f) => f.species.id)),
      ],
      leases: w.authored.loader.leased,
    };
  });
  fs.writeFileSync(
    `${output}/kelp.png`,
    Buffer.from(report.kelp.image.split(',')[1], 'base64'),
  );
  delete report.kelp.image;
  assert.equal(report.kelp.ready, true);
  report.afterKelpRelease = await page.evaluate(() => {
    window.__kelpInspection.dispose();
    return window.__cozy.world.authored.loader.leased;
  });
  assert.equal(report.afterKelpRelease, report.aquarium.leases);
  report.release = await page.evaluate(() => {
    const a = window.__cozy,
      w = a.world;
    a.dispose();
    return { leases: w.authored.loader.leased, ...w.renderer.info.memory };
  });
  assert.equal(report.release.leases, 0);
  assert.equal(report.release.geometries, 0);
  assert.equal(report.release.textures, 0);
  assert.deepEqual(report.errors, []);
  assert.deepEqual(report.fishDownloads, []);
  fs.writeFileSync(
    `${output}/habitats.json`,
    JSON.stringify(report, null, 2) + '\n',
  );
  console.log(JSON.stringify(report));
} catch (error) {
  report.failure = String(error);
  throw error;
} finally {
  fs.writeFileSync(
    `${output}/habitats.json`,
    JSON.stringify(report, null, 2) + '\n',
  );
  await browser.close();
}
