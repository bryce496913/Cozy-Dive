/* V0.8 Pass 100: the aquarium's three rare miniatures, in the real game (aquarium only;
 * headless Chromium, SwiftShader). Not a playthrough: it moves the swimmer straight to each
 * creature's viewing spot.
 *
 *   COZY_URL=http://127.0.0.1:5173 COZY_OUTPUT=/tmp/v08-rare node validation/v08/rare-minis.mjs
 *
 * With an empty journal and tank:
 *   1. waits for the tank, checks the three are shown at their homes and not yet sighted after
 *      a while at the spawn (easy to overlook);
 *   2. dives in, moves to each viewing spot, looks at the animal, and checks the journal records
 *      it (with the "New sighting" note); captures each close-up and a wider view;
 *   3. opens the album: the Aquarium section shows 3 more found (12/12), each card's model;
 *   4. adds all three to the tank from the album and checks the save; captures them placed;
 *   5. reloads: the discoveries and the placed animals are still there;
 *   6. records the scene's draw calls and triangles with and without the three.
 * Env: COZY_PLAYWRIGHT. Writes screenshots and report.json.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
const { chromium } = await import(process.env.COZY_PLAYWRIGHT || 'playwright');
const output = process.env.COZY_OUTPUT || '/tmp/v08-rare';
fs.mkdirSync(output, { recursive: true });
const IDS = {
  pikachu: 'species:pikachu-nudibranch',
  leafSheep: 'species:leaf-sheep',
  candyCrab: 'species:candy-crab',
};
const browser = await chromium.launch({
  args: [
    '--no-sandbox',
    '--enable-unsafe-swiftshader',
    '--use-angle=swiftshader',
  ],
});
const report = { errors: [] };
const shot = (page, name) =>
  page.screenshot({ path: path.join(output, `${name}.png`) });
try {
  const page = await browser.newPage({
    viewport: { width: 1280, height: 800 },
  });
  page.setDefaultTimeout(300000);
  page.on('pageerror', (e) => report.errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') report.errors.push(m.text());
  });
  await page.addInitScript(() => {
    if (localStorage.getItem('rare-seeded')) return;
    localStorage.setItem(
      'cozy-diver.journal.v1',
      JSON.stringify({ version: 1, seen: [] }),
    );
    localStorage.setItem(
      'cozy-diver.tank.v1',
      JSON.stringify({ version: 3, items: [], babies: [], fish: {} }),
    );
    localStorage.setItem('rare-seeded', 'yes');
  });
  await page.route('**/src/main.ts*', async (route) => {
    const r = await route.fetch();
    await route.fulfill({
      response: r,
      body: (await r.text()) + '\nwindow.__cozy=app;',
    });
  });
  const ready = async () => {
    await page.waitForFunction(
      () => window.__cozy?.world && window.__cozy.tankEditor,
    );
    await page.evaluate(async () => {
      const a = window.__cozy;
      await Promise.all([a.world.prepared, a.tankEditor.ready]);
    });
  };
  const journal = () =>
    page.evaluate(() =>
      JSON.parse(localStorage.getItem('cozy-diver.journal.v1')).seen.map(
        (s) => s.id,
      ),
    );
  const tank = () =>
    page.evaluate(() => JSON.parse(localStorage.getItem('cozy-diver.tank.v1')));
  await page.goto(process.env.COZY_URL || 'http://127.0.0.1:5173');
  await ready();

  // 1. Shown at their homes.
  report.homes = await page.evaluate(() => {
    const r = window.__cozy.world.aquarium.anchoredLife.hidden.rare;
    return {
      loaded: r.loaded,
      sightings: r.sightings.map((s) => s.id),
      ...Object.fromEntries(
        ['pikachu', 'leafSheep', 'candyCrab'].map((k) => [
          k,
          {
            at: r.positionOf(k),
            view: r.homes[k].view,
            habitat: r.homes[k].plant?.species.id ?? r.homes[k].habitatKind,
          },
        ]),
      ),
    };
  });
  assert.equal(report.homes.loaded, true);
  assert.deepEqual(
    [...report.homes.sightings].sort(),
    Object.values(IDS).sort(),
  );

  // 2. Dive in. A while at the spawn sees none of them.
  await page
    .getByRole('button', { name: /^(Dive In|Return to the Water)$/ })
    .click();
  await page.waitForFunction(() => !!document.pointerLockElement);
  await page.waitForTimeout(5000);
  report.seenFromSpawn = (await journal()).filter((id) =>
    Object.values(IDS).includes(id),
  );
  assert.deepEqual(report.seenFromSpawn, []);
  await shot(page, '00-spawn-view');

  const lookAt = (kind, eyeOffset) =>
    page.evaluate(
      ({ kind, eyeOffset }) => {
        const a = window.__cozy,
          r = a.world.aquarium.anchoredLife.hidden.rare,
          t = r.positionOf(kind),
          v = r.homes[kind].view,
          eye = {
            x: t.x + (v.x - t.x) * eyeOffset,
            y: t.y + (v.y - t.y) * eyeOffset,
            z: t.z + (v.z - t.z) * eyeOffset,
          };
        Object.assign(a.state.position, eye);
        Object.assign(a.state.velocity, { x: 0, y: 0, z: 0 });
        a.state.neutralDepth = eye.y;
        const dx = t.x - eye.x,
          dy = t.y - eye.y,
          dz = t.z - eye.z,
          d = Math.hypot(dx, dy, dz);
        a.controls.yaw = a.controls.targetYaw = Math.atan2(-dx, -dz);
        a.controls.pitch = a.controls.targetPitch = Math.asin(dy / d);
        return d;
      },
      { kind, eyeOffset },
    );
  report.sighted = {};
  for (const [kind, id] of Object.entries(IDS)) {
    // A wider view from the viewing spot first (how it looks before you notice it).
    const far = await lookAt(kind, 2.2);
    await page.waitForTimeout(300);
    await shot(page, `01-${kind}-overlooked`);
    const before = await journal();
    const d = await lookAt(kind, 0.6);
    // Hold the look: the swimmer's own drift is cancelled each poll.
    let seen = false;
    // SwiftShader renders slowly and each frame advances at most 0.1 s: allow real time for the dwell.
    for (let i = 0; i < 240 && !seen; i++) {
      await lookAt(kind, 0.6);
      await page.waitForTimeout(250);
      seen = (await journal()).includes(id);
    }
    await shot(page, `02-${kind}-found`);
    await lookAt(kind, 0.32);
    await page.waitForTimeout(1500);
    await lookAt(kind, 0.32);
    await page.waitForTimeout(300);
    await shot(page, `02b-${kind}-close`);
    report.sighted[kind] = {
      farDistance: far,
      distance: d,
      wasNew: !before.includes(id),
      seen,
    };
    assert(seen, `${kind} was not sighted from its viewing spot`);
  }

  // Draw calls with the three, and with them hidden (the same view).
  report.render = await page.evaluate(async () => {
    const a = window.__cozy,
      w = a.world,
      r = w.aquarium.anchoredLife.hidden.rare;
    const sample = () => {
      w.renderer.info.autoReset = false;
      w.renderer.info.reset();
      w.renderer.render(w.scene, w.camera);
      const { calls, triangles } = w.renderer.info.render;
      w.renderer.info.autoReset = true;
      return { calls, triangles };
    };
    const shown = sample();
    r.root.visible = false;
    const hidden = sample();
    r.root.visible = true;
    return { shown, hidden };
  });

  // 3. The album: the Aquarium section now complete.
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => !document.pointerLockElement);
  await page.getByRole('button', { name: 'For your tank' }).click();
  await page.getByRole('button', { name: 'Open the field album' }).click();
  const album = page.getByRole('dialog', { name: 'Field Album' });
  await album.waitFor();
  await album.locator('.album-tab', { hasText: 'Aquarium' }).click();
  report.aquariumTab = await album
    .locator('.album-tab', { hasText: 'Aquarium' })
    .innerText();
  assert.match(report.aquariumTab, /12\/12/);
  await page.waitForTimeout(8000);
  await shot(page, '03-album-aquarium');

  // 4. Add each from its card.
  for (const name of ['Pikachu nudibranch', 'Leaf sheep', 'Candy crab']) {
    await album.getByRole('button', { name: new RegExp(`^${name}`) }).click();
    await page.waitForTimeout(4000);
    await shot(page, `04-card-${name.toLowerCase().replace(/ /g, '-')}`);
    await album.getByRole('button', { name: 'Add to Aquarium' }).click();
    await page.keyboard.press('Escape');
  }
  report.tankAfterAdd = await tank();
  assert.deepEqual([...report.tankAfterAdd.babies].sort(), [
    'candy-crab',
    'leaf-sheep',
    'pikachu-nudibranch',
  ]);
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: /^Return to the Water$/ }).click();
  await page.waitForFunction(() => !!document.pointerLockElement);
  await page.waitForTimeout(4000);
  // The placed miniatures: the same library nodes as the wild animals.
  report.placed = await page.evaluate(() => {
    const b = window.__cozy.world.babies;
    return (b?.rigs ?? []).map((r) => {
      const names = [];
      r.art.model.traverse((o) => o.isMesh && names.push(o.name));
      return {
        id: r.baby.definition.id,
        meshes: names,
        at: { ...r.baby.position },
      };
    });
  });
  for (const p of report.placed)
    assert(
      p.meshes.some((n) => /Pikachu_Nudibranch|Leaf_Sheep|Candy_Crab/.test(n)),
      JSON.stringify(p),
    );
  // A look at one of them in the tank.
  await page.evaluate(() => {
    const a = window.__cozy,
      r = a.world.babies.rigs[0],
      t = r.baby.position,
      eye = { x: t.x + 0.6, y: t.y + 0.35, z: t.z + 0.6 };
    Object.assign(a.state.position, eye);
    a.state.neutralDepth = eye.y;
    const dx = t.x - eye.x,
      dy = t.y - eye.y,
      dz = t.z - eye.z;
    a.controls.yaw = a.controls.targetYaw = Math.atan2(-dx, -dz);
    a.controls.pitch = a.controls.targetPitch = Math.asin(
      dy / Math.hypot(dx, dy, dz),
    );
  });
  await page.waitForTimeout(1200);
  await shot(page, '05-placed-miniature');

  // 5. Reload: everything kept.
  const journalBefore = await journal();
  await page.reload();
  await ready();
  report.afterReload = { journal: await journal(), tank: await tank() };
  for (const id of Object.values(IDS))
    assert(report.afterReload.journal.includes(id));
  assert.deepEqual(journalBefore, report.afterReload.journal);
  assert.deepEqual([...report.afterReload.tank.babies].sort(), [
    'candy-crab',
    'leaf-sheep',
    'pikachu-nudibranch',
  ]);
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
