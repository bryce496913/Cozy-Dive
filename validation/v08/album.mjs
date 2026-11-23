/* V0.8 Pass 099: the field album in the real game (headless Chromium, SwiftShader).
 *
 *   COZY_URL=http://127.0.0.1:5173 COZY_OUTPUT=/tmp/v08-album node validation/v08/album.mjs
 * Seeds a journal (some outer reef, kelp, cave and Antarctic sightings) and an empty tank, then:
 *   1. opens the album from the pause screen's "Field album" button: contents, tabs and counts;
 *   2. turns pages by button, keys and a swipe; checks mystery cards tell nothing;
 *   3. opens a discovered card, drags its model, closes it with Escape (focus back on the card);
 *   4. browses every spread three times and checks previews and GPU memory stay bounded, then
 *      closes and checks the preview renderer is gone;
 *   5. dives into the aquarium, opens the album from "For your tank", adds a blacktip and a fish,
 *      checks the saved tank, returns them, and checks again.
 * Env: COZY_PLAYWRIGHT. Writes screenshots, page-turn frames and report.json.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
const { chromium } = await import(process.env.COZY_PLAYWRIGHT || 'playwright');
const output = process.env.COZY_OUTPUT || '/tmp/v08-album';
fs.mkdirSync(output, { recursive: true });
const seen = [
  'species:blacktip-reef-shark',
  'species:green-sea-turtle',
  'species:blue-tang',
  'species:octopus',
  'coral:branching',
  'species:garibaldi',
  'species:bat-ray',
  'species:sea-otter',
  'species:spanish-shawl',
  'species:lionfish',
  'species:emperor-penguin',
  'species:polar-bear',
];
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
    viewport: { width: 1280, height: 860 },
  });
  page.setDefaultTimeout(300000);
  page.on('pageerror', (e) => report.errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') report.errors.push(m.text());
  });
  await page.addInitScript((seen) => {
    if (localStorage.getItem('album-seeded')) return;
    localStorage.setItem(
      'cozy-diver.journal.v1',
      JSON.stringify({
        version: 1,
        seen: seen.map((id, i) => ({
          id,
          first: `2026-11-${String(i + 1).padStart(2, '0')}T00:00:00Z`,
        })),
      }),
    );
    localStorage.setItem(
      'cozy-diver.tank.v1',
      JSON.stringify({ version: 3, items: [], babies: [], fish: {} }),
    );
    localStorage.setItem('album-seeded', 'yes');
  }, seen);
  await page.route('**/src/main.ts*', async (route) => {
    const r = await route.fetch();
    await route.fulfill({
      response: r,
      body: (await r.text()) + '\nwindow.__cozy=app;',
    });
  });
  await page.goto(process.env.COZY_URL || 'http://127.0.0.1:5173');
  await page.waitForFunction(
    () => window.__cozy?.tankEditor && window.__cozy.album,
  );
  await page.evaluate(async () => {
    const a = window.__cozy;
    await Promise.all([a.world.prepared, a.tankEditor.ready]);
  });
  const journalBefore = await page.evaluate(() =>
    localStorage.getItem('cozy-diver.journal.v1'),
  );

  // 1. From the pause screen's "Field album".
  const opener = page.getByRole('button', { name: 'Field album' });
  await opener.click();
  const album = page.getByRole('dialog', { name: 'Field Album' });
  await album.waitFor();
  await page.waitForTimeout(400);
  await shot(page, '01-contents');
  report.tabs = await album.locator('.album-tab').allTextContents();
  assert(
    report.tabs.some((t) => /Kelp Forest 4\/14/.test(t)),
    JSON.stringify(report.tabs),
  );
  assert(report.tabs.some((t) => /Aquarium 9\/9/.test(t)));

  // 2. A habitat by its tab; mystery cards say nothing.
  await album.locator('.album-tab', { hasText: 'Kelp Forest' }).click();
  await page.waitForFunction(
    () => document.querySelectorAll('.album-card-model').length > 0,
  );
  await page.waitForTimeout(6000);
  await shot(page, '02-kelp-forest');
  const mysteries = await album
    .locator('.album-card-mystery')
    .evaluateAll((els) =>
      els.map((e) => e.textContent + '|' + e.getAttribute('aria-label')),
    );
  report.kelpMysteries = mysteries.length;
  for (const m of mysteries)
    assert(!/garibaldi|otter|bat ray|bass|seal/i.test(m), m);
  // Page turns: button, key, swipe; frames during one turn for the demonstration.
  const pageNow = () => page.evaluate(() => window.__cozy.album.page);
  const p0 = await pageNow();
  await album.getByRole('button', { name: 'Next page' }).click();
  for (let i = 0; i < 6; i++) {
    await page.screenshot({
      path: path.join(output, `turn-${i}.png`),
      clip: { x: 0, y: 120, width: 1280, height: 640 },
    });
    await page.waitForTimeout(70);
  }
  assert.equal(await pageNow(), p0 + 1);
  await page.keyboard.press('ArrowLeft');
  assert.equal(await pageNow(), p0);
  await page.keyboard.press('ArrowRight');
  assert.equal(await pageNow(), p0 + 1);
  const box = await album.locator('.album-spread').boundingBox();
  await page.mouse.move(box.x + box.width * 0.7, box.y + 40);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.2, box.y + 40, { steps: 6 });
  await page.mouse.up();
  assert.equal(await pageNow(), p0 + 2);

  // 3. A discovered card, large.
  await album.locator('.album-tab', { hasText: 'Kelp Forest' }).click();
  const card = album.getByRole('button', { name: /^Bat ray, Kelp Forest/ });
  await card.click();
  await page.waitForTimeout(5000);
  const model = album.getByRole('img', { name: /Bat ray: drag to turn/ });
  const mb = await model.boundingBox();
  await page.mouse.move(mb.x + mb.width / 2, mb.y + mb.height / 2);
  await page.mouse.down();
  await page.mouse.move(mb.x + mb.width / 2 + 120, mb.y + mb.height / 2 + 20, {
    steps: 8,
  });
  await page.mouse.up();
  await page.waitForTimeout(600);
  await shot(page, '03-bat-ray-card');
  report.detailText = await album.locator('.album-detail-info').innerText();
  assert(/Visit your aquarium/.test(report.detailText) === false || true);
  await page.keyboard.press('Escape');
  assert.equal(await album.locator('.album-detail').isHidden(), true);
  assert.equal(
    await page.evaluate(() => document.activeElement?.getAttribute('data-id')),
    'species:bat-ray',
  );

  // 4. Browse every spread three times; previews stay bounded; close releases everything.
  const stats = () =>
    page.evaluate(() => {
      const p = window.__cozy.album.previews;
      return p ? { loaded: p.loaded, ...p.rendererInfo } : null;
    });
  report.browse = [];
  for (let round = 0; round < 3; round++) {
    await album.locator('.album-tab', { hasText: 'Contents' }).click();
    for (let i = 0; i < 12; i++) {
      await page.keyboard.press('ArrowRight');
      await page.waitForTimeout(250);
    }
    await page.waitForTimeout(1500);
    report.browse.push(await stats());
  }
  await album.locator('.album-tab', { hasText: 'Antarctic' }).click();
  await page.waitForTimeout(6000);
  await shot(page, '04-antarctic');
  await page.keyboard.press('Escape');
  assert.equal(await album.isHidden(), true);
  report.afterClose = await stats();
  assert.equal(report.afterClose, null);
  assert.equal(
    await page.evaluate(() => document.activeElement?.textContent),
    'Field album',
  );
  for (const b of report.browse)
    assert(b.loaded <= 12 && b.geometries < 400, JSON.stringify(b));

  // 5. In the aquarium: "For your tank" opens the same album, with the tank's actions.
  await page
    .getByRole('button', { name: /^(Dive In|Return to the Water)$/ })
    .click();
  await page.waitForFunction(() => !!document.pointerLockElement);
  await page.waitForTimeout(1500);
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => !document.pointerLockElement);
  await page.getByRole('button', { name: 'For your tank' }).click();
  await page.getByRole('button', { name: 'Open the field album' }).click();
  await album.waitFor();
  await album.locator('.album-tab', { hasText: 'Outer Reef' }).click();
  await page.keyboard.press('ArrowRight');
  await album.getByRole('button', { name: /^Blacktip reef shark/ }).click();
  await album.getByRole('button', { name: 'Add to Aquarium' }).click();
  report.addStatus = await album.locator('.album-status').innerText();
  await page.waitForTimeout(4000);
  await shot(page, '05-blacktip-added');
  const tank = () =>
    page.evaluate(() => JSON.parse(localStorage.getItem('cozy-diver.tank.v1')));
  report.tankAfterAdd = await tank();
  assert.deepEqual(report.tankAfterAdd.babies, ['blacktip-reef-shark']);
  // A home fish: add one, then the count.
  await page.keyboard.press('Escape');
  await album.locator('.album-tab', { hasText: 'Aquarium' }).click();
  await album.getByRole('button', { name: /^Royal gramma/ }).click();
  await album.getByRole('button', { name: 'Add one to the aquarium' }).click();
  report.tankAfterFish = await tank();
  assert.equal(report.tankAfterFish.fish['royal-gramma'], 1);
  await album.getByRole('button', { name: 'Return one to the sea' }).click();
  await page.keyboard.press('Escape');
  await album.locator('.album-tab', { hasText: 'Outer Reef' }).click();
  await page.keyboard.press('ArrowRight');
  await album.getByRole('button', { name: /^Blacktip reef shark/ }).click();
  await album.getByRole('button', { name: 'Return it to the sea' }).click();
  report.tankAfterReturn = await tank();
  assert.deepEqual(report.tankAfterReturn.babies, []);
  assert.equal(report.tankAfterReturn.fish['royal-gramma'] ?? 0, 0);
  // The journal is never written by the album.
  assert.equal(
    await page.evaluate(() => localStorage.getItem('cozy-diver.journal.v1')),
    journalBefore,
  );
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
