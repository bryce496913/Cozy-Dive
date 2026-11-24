/* V0.8 Pass 101: the outer reef's four rare miniatures, in the real game (reef only; headless
 * Chromium, SwiftShader; frames are stepped by hand, as in validation/reef-life.mjs).
 *
 *   COZY_URL=http://127.0.0.1:5173 COZY_OUTPUT=/tmp/v08-reef-minis node validation/v08/reef-minis.mjs
 *
 * With an empty journal and tank: swims through the crevice into the outer reef, then for each
 * animal captures a wider view (not yet noticed), moves to its viewing spot, looks at it and
 * checks the journal records it. Captures the mimic octopus's two postures, the reef's draw
 * calls with and without the four, then returns to the aquarium, adds all four from the album's
 * Outer Reef pages and checks the tank save, and reloads to check both are kept.
 * Env: COZY_PLAYWRIGHT. Writes screenshots and report.json.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
const { chromium } = await import(process.env.COZY_PLAYWRIGHT || 'playwright');
const output = process.env.COZY_OUTPUT || '/tmp/v08-reef-minis';
fs.mkdirSync(output, { recursive: true });
const IDS = {
  harlequin: 'species:harlequin-shrimp',
  pipefish: 'species:ornate-ghost-pipefish',
  frogfish: 'species:hairy-frogfish',
  mimic: 'species:mimic-octopus',
};
const browser = await chromium.launch({
  args: [
    '--no-sandbox',
    '--enable-unsafe-swiftshader',
    '--use-angle=swiftshader',
  ],
});
const report = { errors: [] };
try {
  const page = await browser.newPage({
    viewport: { width: 1280, height: 800 },
  });
  page.setDefaultTimeout(300000);
  const shot = (name) =>
    page.screenshot({ path: path.join(output, `${name}.png`) });
  page.on('pageerror', (e) => report.errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') report.errors.push(m.text());
  });
  await page.addInitScript(() => {
    if (localStorage.getItem('reef-minis-seeded')) return;
    localStorage.setItem(
      'cozy-diver.journal.v1',
      JSON.stringify({ version: 1, seen: [] }),
    );
    localStorage.setItem(
      'cozy-diver.tank.v1',
      JSON.stringify({ version: 3, items: [], babies: [], fish: {} }),
    );
    localStorage.setItem('reef-minis-seeded', 'yes');
  });
  let manual = true;
  await page.route('**/src/main.ts*', async (route) => {
    const r = await route.fetch();
    await route.fulfill({
      response: r,
      body:
        (await r.text()) +
        (manual
          ? '\nwindow.__cozy=app;cancelAnimationFrame(app.frame);'
          : '\nwindow.__cozy=app;'),
    });
  });
  await page.goto(process.env.COZY_URL || 'http://127.0.0.1:5173');
  await page.waitForFunction(() => window.__cozy?.office);
  await page.evaluate(() =>
    Promise.all([
      window.__cozy.world.prepared,
      window.__cozy.office.prepared,
      window.__cozy.tankEditor.ready,
    ]),
  );
  await page.evaluate(() => window.__cozy.tickOffice(0));
  await page.getByRole('button', { name: 'Dive In', exact: true }).click();
  await page.waitForFunction(() => !!document.pointerLockElement);
  const step = (count = 1) =>
    page.evaluate(async (count) => {
      const a = window.__cozy;
      cancelAnimationFrame(a.frame);
      for (let i = 0; i < count; i++) {
        await new Promise((r) => requestAnimationFrame(r));
        cancelAnimationFrame(a.frame);
        a.__t = (a.__t ?? performance.now()) + 100;
        a.tick(a.__t);
        cancelAnimationFrame(a.frame);
      }
      return {
        world: a.waterWorld,
        outerReady: !!a.outer?.isReady,
        reefReady: !!a.outer?.isReefReady,
      };
    }, count);
  const place = (p, yaw, pitch = 0) =>
    page.evaluate(
      ([p, yaw, pitch]) => {
        const a = window.__cozy;
        Object.assign(a.state.position, p);
        a.state.velocity.x = a.state.velocity.y = a.state.velocity.z = 0;
        a.state.neutralDepth = p.y;
        a.controls.yaw = a.controls.targetYaw = yaw;
        a.controls.pitch = a.controls.targetPitch = pitch;
        a.controls.clear();
      },
      [p, yaw, pitch],
    );
  // Into the outer reef through the crevice.
  await place({ x: 6.4, y: 1.6, z: -12.1 }, Math.PI / 2);
  let s = await step(1);
  for (let i = 0; i < 600 && !s.outerReady; i++) s = await step(1);
  await page.keyboard.down('w');
  for (let i = 0; i < 400 && s.world !== 'outer'; i++) s = await step(1);
  await page.keyboard.up('w');
  assert.equal(s.world, 'outer');
  for (let i = 0; i < 900 && !s.reefReady; i++) s = await step(2);
  assert(s.reefReady, 'the outer reef is prepared');
  report.homes = await page.evaluate(() => {
    const m = window.__cozy.outer.minis;
    return {
      loaded: m.loaded,
      homes: m.homes,
      sightings: m.sightings.map((x) => x.id),
    };
  });
  assert.equal(report.homes.loaded, true);
  const journal = () =>
    page.evaluate(() =>
      JSON.parse(
        localStorage.getItem('cozy-diver.journal.v1') || '{"seen":[]}',
      ).seen.map((x) => x.id),
    );
  /** Look at `kind` from `t` of the way from it to its viewing spot (further out beyond 1). */
  const lookAt = (kind, t) =>
    page.evaluate(
      ([kind, t]) => {
        const a = window.__cozy,
          m = a.outer.minis,
          c = m.positionOf(kind),
          v = m.homes[kind].view,
          eye = {
            x: c.x + (v.x - c.x) * t,
            y: c.y + (v.y - c.y) * t,
            z: c.z + (v.z - c.z) * t,
          };
        Object.assign(a.state.position, eye);
        a.state.velocity.x = a.state.velocity.y = a.state.velocity.z = 0;
        a.state.neutralDepth = eye.y;
        const dx = c.x - eye.x,
          dy = c.y + 0.02 - eye.y,
          dz = c.z - eye.z,
          d = Math.hypot(dx, dy, dz);
        a.controls.yaw = a.controls.targetYaw = Math.atan2(-dx, -dz);
        a.controls.pitch = a.controls.targetPitch = Math.asin(dy / d);
        a.controls.clear();
        return d;
      },
      [kind, t],
    );
  report.sighted = {};
  for (const [kind, id] of Object.entries(IDS)) {
    if (kind === 'mimic')
      // Out of its burrow (a fixed cycle): wait for it if it happens to be in.
      for (let i = 0; i < 300; i++) {
        const out = await page.evaluate(
          () => window.__cozy.outer.minis.sightOf('mimic').y > -100,
        );
        if (out) break;
        await step(5);
      }
    report.sighted[kind] = { far: await lookAt(kind, 4) };
    await step(3);
    await shot(`01-${kind}-overlooked`);
    report.sighted[kind].before = (await journal()).includes(id);
    report.sighted[kind].near = await lookAt(kind, 0.75);
    let seen = false;
    for (let i = 0; i < 80 && !seen; i++) {
      await lookAt(kind, 0.75);
      await step(1);
      seen = (await journal()).includes(id);
    }
    report.sighted[kind].seen = seen;
    await shot(`02-${kind}-found`);
    await lookAt(kind, 0.3);
    await step(2);
    await shot(`03-${kind}-close`);
    assert(seen, `${kind} was not sighted from its viewing spot`);
    assert.equal(report.sighted[kind].before, false);
  }
  // The mimic octopus's postures.
  for (const [name, time] of [
    ['flatfish', 2.5],
    ['lionfish', 17 + 2.5],
  ]) {
    await page.evaluate((t) => {
      window.__cozy.outer.minis.time = t;
    }, time);
    await lookAt('mimic', 0.45);
    await step(1);
    await shot(`04-mimic-${name}`);
  }
  // Draw calls in the same view, with and without the four.
  report.render = await page.evaluate(() => {
    const o = window.__cozy.outer,
      r = o.renderer,
      sample = () => {
        r.info.autoReset = false;
        r.info.reset();
        r.render(o.scene, o.camera);
        const { calls, triangles } = r.info.render;
        r.info.autoReset = true;
        return { calls, triangles };
      };
    const shown = sample();
    o.minis.root.visible = false;
    const hidden = sample();
    o.minis.root.visible = true;
    return { shown, hidden };
  });
  report.fog = await page.evaluate(() => window.__cozy.outer.fog.density);

  // Back in the aquarium: add the four from the album's Outer Reef pages.
  await page.evaluate(() => window.__cozy.returnToTank());
  await step(5);
  manual = false;
  await page.evaluate(() => {
    const a = window.__cozy;
    a.frame = requestAnimationFrame(a.tick);
  });
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => !document.pointerLockElement);
  await page.getByRole('button', { name: 'For your tank' }).click();
  await page.getByRole('button', { name: 'Open the field album' }).click();
  const album = page.getByRole('dialog', { name: 'Field Album' });
  await album.waitFor();
  await album.locator('.album-tab', { hasText: 'Outer Reef' }).click();
  report.outerTab = await album
    .locator('.album-tab', { hasText: 'Outer Reef' })
    .innerText();
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(9000);
  await shot('05-album-outer-reef');
  for (const name of [
    'Harlequin shrimp',
    'Ornate ghost pipefish',
    'Hairy frogfish',
    'Mimic octopus',
  ]) {
    await album.getByRole('button', { name: new RegExp(`^${name}`) }).click();
    await page.waitForTimeout(4000);
    await shot(`06-card-${name.toLowerCase().replace(/ /g, '-')}`);
    await album.getByRole('button', { name: 'Add to Aquarium' }).click();
    await page.keyboard.press('Escape');
  }
  const tank = () =>
    page.evaluate(() => JSON.parse(localStorage.getItem('cozy-diver.tank.v1')));
  const expected = [
    'hairy-frogfish',
    'harlequin-shrimp',
    'mimic-octopus',
    'ornate-ghost-pipefish',
  ];
  report.tankAfterAdd = await tank();
  assert.deepEqual([...report.tankAfterAdd.babies].sort(), expected);
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: /^Return to the Water$/ }).click();
  await page.waitForFunction(() => !!document.pointerLockElement);
  await page.waitForTimeout(5000);
  report.placed = await page.evaluate(() =>
    (window.__cozy.world.babies?.rigs ?? []).map((r) => {
      const names = [];
      r.art.model.traverse((o) => o.isMesh && names.push(o.name));
      return { id: r.baby.definition.id, meshes: names };
    }),
  );
  for (const p of report.placed)
    assert(
      p.meshes.some((n) =>
        /Harlequin_Shrimp|Ghost_Pipefish|Hairy_Frogfish|Mimic_Octopus/.test(n),
      ),
      JSON.stringify(p),
    );
  await page.evaluate(() => {
    const a = window.__cozy,
      r =
        a.world.babies.rigs.find(
          (x) => x.baby.definition.id === 'mimic-octopus',
        ) ?? a.world.babies.rigs[0],
      t = r.baby.position,
      eye = { x: t.x + 0.8, y: t.y + 0.5, z: t.z + 0.8 };
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
  await page.waitForTimeout(1500);
  await shot('07-placed-in-aquarium');
  // Reload: the discoveries and the placed animals are kept.
  const before = await journal();
  await page.reload();
  await page.waitForFunction(() => window.__cozy?.tankEditor);
  await page.evaluate(() => window.__cozy.tankEditor.ready);
  report.afterReload = { journal: await journal(), tank: await tank() };
  assert.deepEqual(report.afterReload.journal, before);
  for (const id of Object.values(IDS))
    assert(report.afterReload.journal.includes(id));
  assert.deepEqual([...report.afterReload.tank.babies].sort(), expected);
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
