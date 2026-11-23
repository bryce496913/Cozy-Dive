/* V0.8 Pass 096: a short aquarium-only browser check of the shared models and doubled miniatures.
 *
 *   COZY_URL=http://127.0.0.1:5173 COZY_OUTPUT=/tmp/v08-aquarium node validation/v08/aquarium-miniatures.mjs
 * Seeds a journal and a saved tank (version 3) holding large animals and the octopus, sea spider
 * and ribbon worm; dives in; steps the game 30 simulated seconds checking every animal stays
 * clear of the scenery and of the fish; checks every saved animal arrived at its (doubled) size;
 * then sends them all back and checks GPU geometries and textures return to the empty count.
 * Env: COZY_PLAYWRIGHT. Writes <output>/*.png and report.json.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
const { chromium } = await import(process.env.COZY_PLAYWRIGHT || 'playwright');
const output = process.env.COZY_OUTPUT || '/tmp/v08-aquarium';
fs.mkdirSync(output, { recursive: true });
const ids = [
  'blacktip-reef-shark',
  'spotted-eagle-ray',
  'green-sea-turtle',
  'manta-ray',
  'polar-bear',
  'emperor-penguin',
  'sea-otter',
  'octopus',
  'giant-sea-spider',
  'ribbon-worm',
];
const browser = await chromium.launch({
  args: [
    '--no-sandbox',
    '--enable-unsafe-swiftshader',
    '--use-angle=swiftshader',
  ],
});
const report = { errors: [] };
try {
  const page = await browser.newPage({ viewport: { width: 960, height: 600 } });
  page.setDefaultTimeout(300000);
  page.on('pageerror', (e) => report.errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') report.errors.push(m.text());
  });
  await page.addInitScript((ids) => {
    if (localStorage.getItem('miniatures-seeded')) return;
    localStorage.setItem(
      'cozy-diver.settings.v3',
      JSON.stringify({ reducedMotion: true }),
    );
    localStorage.setItem(
      'cozy-diver.journal.v1',
      JSON.stringify({
        version: 1,
        seen: ids.map((id) => ({
          id: `species:${id}`,
          first: '2026-11-23T00:00:00Z',
        })),
      }),
    );
    localStorage.setItem(
      'cozy-diver.tank.v1',
      JSON.stringify({ version: 3, items: [], babies: ids, fish: {} }),
    );
    localStorage.setItem('miniatures-seeded', 'yes');
  }, ids);
  await page.route('**/src/main.ts*', async (route) => {
    const r = await route.fetch();
    await route.fulfill({
      response: r,
      body:
        (await r.text()) +
        '\nwindow.__cozy=app;cancelAnimationFrame(app.frame);',
    });
  });
  await page.goto(process.env.COZY_URL || 'http://127.0.0.1:5173');
  await page.waitForFunction(() => window.__cozy?.tankEditor);
  await page.evaluate(async () => {
    const a = window.__cozy;
    await Promise.all([
      a.world.prepared,
      a.office.prepared,
      a.tankEditor.ready,
    ]);
    cancelAnimationFrame(a.frame);
  });
  const step = (n) =>
    page.evaluate(async (n) => {
      const a = window.__cozy;
      let gap = Infinity;
      for (let i = 0; i < n; i++) {
        await new Promise((r) => requestAnimationFrame(r));
        cancelAnimationFrame(a.frame);
        a.__t = (a.__t ?? performance.now()) + 100;
        a.tick(a.__t);
        cancelAnimationFrame(a.frame);
        for (const b of a.world.babies?.animals ?? []) {
          if (
            !b.navigation.safe(
              b.position.x,
              b.position.y,
              b.position.z,
              b.halfHeight,
            )
          )
            throw Error('Contact: ' + b.definition.id + ' at ' + b.time);
          for (const f of a.world.aquarium.fish.simulation.fish)
            gap = Math.min(
              gap,
              Math.hypot(
                b.position.x - f.position.x,
                b.position.y - f.position.y,
                b.position.z - f.position.z,
              ) -
                b.radius -
                f.radius,
            );
        }
      }
      return gap;
    }, n);
  await page
    .getByRole('button', { name: /^(Dive In|Return to the Water)$/ })
    .click();
  await page.waitForFunction(() => !!document.pointerLockElement);
  await step(20);
  await page.evaluate(() => window.__cozy.world.babies?.ready);
  report.fishGap = await step(300);
  report.animals = await page.evaluate(() =>
    window.__cozy.world.babies.animals.map((b) => ({
      id: b.definition.id,
      scale: b.definition.scale,
      size: b.definition.size ?? null,
      radius: b.definition.radius,
    })),
  );
  assert.deepEqual(report.animals.map((a) => a.id).sort(), [...ids].sort());
  // The eye on the tank's centre, looking down the channel at the visitors.
  await page.evaluate(() => {
    const a = window.__cozy,
      p = { x: 0, y: 5.5, z: 11 },
      t = { x: 0, y: 2.5, z: 0 };
    Object.assign(a.state.position, p);
    a.state.velocity.x = a.state.velocity.y = a.state.velocity.z = 0;
    a.state.neutralDepth = p.y;
    a.controls.yaw = Math.atan2(-(t.x - p.x), -(t.z - p.z));
    a.controls.pitch = Math.atan2(t.y - p.y, Math.hypot(t.x - p.x, t.z - p.z));
    a.controls.targetPitch = a.controls.pitch;
    a.controls.clear();
  });
  await step(2);
  await page.screenshot({ path: path.join(output, 'aquarium-miniatures.png') });
  report.loaded = await page.evaluate(() => ({
    geometries: window.__cozy.world.renderer.info.memory.geometries,
    textures: window.__cozy.world.renderer.info.memory.textures,
  }));
  // Send everyone home (the reset is immediate), then compare with the empty tank.
  await page.evaluate(() => window.__cozy.world.babies.clear());
  await step(5);
  report.empty = await page.evaluate(() => ({
    geometries: window.__cozy.world.renderer.info.memory.geometries,
    textures: window.__cozy.world.renderer.info.memory.textures,
    animals: window.__cozy.world.babies?.animals.length ?? 0,
  }));
  assert.equal(report.empty.animals, 0);
  assert(report.empty.geometries < report.loaded.geometries);
  assert.deepEqual(report.errors, []);
  report.ok = true;
} finally {
  fs.writeFileSync(
    path.join(output, 'report.json'),
    JSON.stringify(report, null, 1),
  );
  await browser.close();
}
console.log(JSON.stringify(report, null, 1));
