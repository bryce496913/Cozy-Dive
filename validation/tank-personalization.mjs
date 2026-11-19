/* v0.6 Pass 051: a short browser walkthrough of tank personalization.
 * Real catalog buttons: add schooling and individual fish, see them swim on their rigs, undo,
 * reload (they come back), and look at the tank from the office. Screenshots and render counts.
 * Run against a dev server: COZY_URL=http://127.0.0.1:5173 node validation/tank-personalization.mjs
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
const { chromium } = await import(process.env.COZY_PLAYWRIGHT || 'playwright');
const output = process.env.COZY_OUTPUT || '/tmp/cozy051-personalization';
fs.mkdirSync(output, { recursive: true });
const browser = await chromium.launch({
  args: [
    '--no-sandbox',
    '--disable-dev-shm-usage',
    '--enable-unsafe-swiftshader',
    '--use-angle=swiftshader',
  ],
});
const report = { errors: [], views: [] };
try {
  const page = await browser.newPage({
    viewport: { width: 960, height: 600 },
    deviceScaleFactor: Number(process.env.COZY_DPR || 1),
  });
  page.setDefaultTimeout(240000);
  page.on('pageerror', (e) => report.errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') report.errors.push(m.text());
  });
  await page.addInitScript(() => {
    localStorage.setItem(
      'cozy-diver.settings.v3',
      JSON.stringify({ reducedMotion: true }),
    );
    if (!localStorage.getItem('personalization-seeded')) {
      localStorage.setItem(
        'cozy-diver.journal.v1',
        JSON.stringify({
          version: 1,
          seen: [
            'coral:boulder',
            'species:blue-tang',
            'species:parrotfish',
            'species:garibaldi',
          ].map((id) => ({
            id,
            first: '2026-11-18T00:00:00Z',
          })),
        }),
      );
      // A version 2 save from before this pass: it must migrate, keeping its coral.
      localStorage.setItem(
        'cozy-diver.tank.v1',
        JSON.stringify({ version: 2, items: [], babies: [] }),
      );
      localStorage.setItem('personalization-seeded', 'yes');
    }
  });
  await page.route('**/src/main.ts*', async (route) => {
    const r = await route.fetch();
    await route.fulfill({
      response: r,
      body:
        (await r.text()) +
        '\nwindow.__cozy=app;cancelAnimationFrame(app.frame);',
    });
  });
  const ready = async () => {
    await page.waitForFunction(() => window.__cozy?.tankEditor);
    await page.evaluate(() =>
      Promise.all([
        window.__cozy.world.prepared,
        window.__cozy.office.prepared,
        window.__cozy.tankEditor.ready,
      ]),
    );
  };
  const step = (n = 1) =>
    page.evaluate(async (n) => {
      const a = window.__cozy;
      for (let i = 0; i < n; i++) {
        await new Promise((r) => requestAnimationFrame(r));
        cancelAnimationFrame(a.frame);
        a.__t = (a.__t ?? performance.now()) + 100;
        a.tick(a.__t);
        cancelAnimationFrame(a.frame);
      }
    }, n);
  const shot = async (name) => {
    await page.screenshot({ path: path.join(output, name + '.png') });
    report.views.push(
      await page.evaluate(
        (name) => ({
          name,
          calls: window.__cozy.world.renderer.info.render.calls,
          triangles: window.__cozy.world.renderer.info.render.triangles,
        }),
        name,
      ),
    );
  };
  const enter = async () => {
    await page
      .getByRole('button', { name: /^(Dive In|Return to the Water)$/ })
      .click();
    await page.waitForFunction(() => !!document.pointerLockElement);
    await step();
  };
  const pause = async () => {
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => !document.pointerLockElement);
    await step();
  };
  const look = async () => {
    // Toward the open water where the chromis school hangs.
    for (let i = 0; i < 6; i++) {
      await page.evaluate(() => {
        const a = window.__cozy;
        Object.assign(a.state.position, { x: 0, y: 6.5, z: 9 });
        a.state.neutralDepth = 6.5;
        a.controls.yaw = 0;
        a.controls.pitch = 0.05;
        a.controls.clear();
      });
      await step();
    }
  };
  const fishState = () =>
    page.evaluate(() => ({
      model: { ...window.__cozy.tankEditor.model.fish },
      bodies: window.__cozy.world.tankFish?.bodies.length ?? 0,
      underTank:
        window.__cozy.world.tankFish?.root.parent ===
        window.__cozy.world.aquarium.root,
      saved: JSON.parse(localStorage.getItem('cozy-diver.tank.v1')),
    }));

  await page.goto(process.env.COZY_URL || 'http://127.0.0.1:5173');
  await ready();
  await enter();
  await look();
  await shot('1-tank-before');
  await pause();
  await page
    .getByRole('button', { name: 'For your tank', exact: true })
    .click();
  await shot('2-catalog');
  const groups = await page.locator('.tank-catalog-group h3').allTextContents();
  report.groups = groups;
  for (const g of [
    'Schooling fish',
    'Aquarium fish',
    'Plants and corals',
    'Rocks and decorations',
  ])
    assert(groups.includes(g), `missing group ${g}: ${groups}`);
  // Playtest: the parrotfish and garibaldi (seen) can now be added, at tank size.
  for (const species of ['parrotfish', 'garibaldi'])
    assert(
      (await page.locator(`[data-key="fish-add-${species}"]`).count()) === 1,
      `${species} can be added`,
    );
  const add = (species) =>
    page.locator(`[data-key="fish-add-${species}"]`).click();
  for (let i = 0; i < 6; i++) await add('blue-green-chromis');
  await add('royal-gramma');
  await add('blue-tang');
  await add('blue-tang');
  // Focus stays on the button just used, so repeated adds work from the keyboard.
  report.focusKept = await page.evaluate(
    () => document.activeElement?.dataset.key,
  );
  await page.locator('[data-key="undo"]').click();
  let s = await fishState();
  assert.deepEqual(s.model, {
    'blue-green-chromis': 6,
    'royal-gramma': 1,
    'blue-tang': 1,
  });
  assert.equal(s.bodies, 8);
  assert(
    s.underTank,
    'added fish live in the aquarium scene (and so in the office miniature)',
  );
  assert.equal(s.saved.version, 3);
  assert.deepEqual(s.saved.fish, s.model);
  await page.evaluate(() => window.__cozy.world.tankFish.ready);
  await shot('3-catalog-with-fish');
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  await enter();
  await look();
  await step(40);
  await shot('4-tank-with-fish');
  report.rigs = await page.evaluate(() =>
    window.__cozy.world.tankFish.root.children.map((c) => c.name),
  );

  // Reload: the fish come back.
  await page.reload();
  await ready();
  s = await fishState();
  assert.deepEqual(s.model, {
    'blue-green-chromis': 6,
    'royal-gramma': 1,
    'blue-tang': 1,
  });
  assert.equal(s.bodies, 8);
  await page.evaluate(() => window.__cozy.world.tankFish.ready);
  await enter();
  await look();
  await step(20);
  await shot('5-after-reload');

  // The office: the miniature renders the aquarium scene, added fish included.
  await pause();
  await page.getByRole('button', { name: /Enter the Office/ }).click();
  await step(40);
  await shot('6-office');
  report.officeMode = await page.evaluate(() => window.__cozy.mode);
  assert.deepEqual(report.errors, []);
  report.ok = true;
} finally {
  fs.writeFileSync(
    path.join(output, 'report.json'),
    JSON.stringify(report, null, 2),
  );
  console.log(JSON.stringify(report, null, 2));
  await browser.close();
}
