/* v0.8 Pass 060: public-beta smoke check of a production build, including an update.
 *
 *   npm run build && npx vite preview --port 4173 --strictPort &
 *   COZY_URL=http://127.0.0.1:4173 COZY_PHASE=before COZY_PROFILE=/tmp/cozy060-profile node validation/beta-smoke.mjs
 *   (rebuild with another version, e.g. COZY_VERSION=0.8.0-beta.2 npm run build, restart preview)
 *   COZY_URL=http://127.0.0.1:4173 COZY_PHASE=after  COZY_PROFILE=/tmp/cozy060-profile node validation/beta-smoke.mjs
 *
 * Uses only the public page (no source hooks), in a persistent browser profile so storage and the
 * HTTP cache carry over between the two phases, as they would for a returning player.
 *   - every request stays on the site's own origin (no third-party runtime dependencies);
 *   - model requests carry the build's version;
 *   - Settings shows the version; Beta feedback shows details only when opened;
 *   - before: dive in, change preferences, pause; after: the preferences and the onboarding state
 *     survive the update, and the new version's models are fetched.
 */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
const { chromium } = await import(process.env.COZY_PLAYWRIGHT || 'playwright');
const url = process.env.COZY_URL || 'http://127.0.0.1:4173';
const phase = process.env.COZY_PHASE || 'before';
const profile = process.env.COZY_PROFILE || '/tmp/cozy060-profile';
const output = process.env.COZY_OUTPUT || '/tmp/cozy060';
fs.mkdirSync(output, { recursive: true });
const context = await chromium.launchPersistentContext(profile, {
  viewport: { width: 960, height: 600 },
  deviceScaleFactor: 0.5,
  args: [
    '--no-sandbox',
    '--disable-dev-shm-usage',
    '--enable-unsafe-swiftshader',
    '--use-angle=swiftshader',
  ],
});
const report = { phase, errors: [], requests: { foreign: [], models: [] } };
try {
  const page = context.pages()[0] ?? (await context.newPage());
  page.setDefaultTimeout(300000);
  const origin = new URL(url).origin;
  page.on('pageerror', (e) => report.errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') report.errors.push(m.text());
  });
  page.on('request', (r) => {
    const u = r.url();
    if (u.startsWith('data:') || u.startsWith('blob:')) return;
    if (new URL(u).origin !== origin) report.requests.foreign.push(u);
    if (u.includes('.glb')) report.requests.models.push(u.replace(origin, ''));
  });
  page.on('response', (r) => {
    if (r.url().includes('.glb') && !report.modelCache)
      report.modelCache = {
        status: r.status(),
        fromCache: r.fromServiceWorker() || r.status() === 304,
      };
  });
  const t0 = Date.now();
  await page.goto(url);
  await page.waitForSelector('#office:not([disabled])', { state: 'visible' });
  report.startScreenMs = Date.now() - t0;
  // Settings: the build line, and feedback details only once opened.
  await page.locator('.settings-toggle').click();
  report.build = await page.locator('#build').innerText();
  report.detailsBeforeOpen = await page
    .locator('#feedback-details')
    .inputValue();
  await page.locator('#feedback summary').click();
  // The details box's toggle event is queued, so the text appears a moment after opening.
  await page.waitForFunction(
    () => document.querySelector('#feedback-details').value !== '',
  );
  report.details = await page.locator('#feedback-details').inputValue();
  report.feedbackHref = await page
    .locator('#feedback-link')
    .getAttribute('href');
  await page.locator('#close-settings').click();
  report.eyebrow = (await page.locator('.eyebrow').innerText()).trim();
  if (phase === 'before') {
    // Dive in (real pointer lock), then change preferences while paused.
    await page.getByRole('button', { name: 'Dive In', exact: true }).click();
    await page.waitForFunction(() => !!document.pointerLockElement);
    await page.waitForTimeout(4000);
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => !document.pointerLockElement);
    await page.locator('.settings-toggle').click();
    await page.locator('#sensitivity').fill('1.6');
    await page.locator('#graphics-detail').selectOption('lighter');
    await page.locator('#close-settings').click();
  }
  // Let the tank's models load before reading what was requested.
  await page.waitForTimeout(8000);
  report.storage = await page.evaluate(() => ({
    settings: JSON.parse(
      localStorage.getItem('cozy-diver.settings.v3') ?? 'null',
    ),
    onboarding: JSON.parse(
      localStorage.getItem('cozy-diver.onboarding.v1') ?? 'null',
    ),
  }));
  await page.screenshot({ path: path.join(output, `${phase}.png`) });
  const version = report.build.match(/Cozy Diver (\S+)/)?.[1];
  report.version = version;
  assert.deepEqual(report.requests.foreign, [], 'no third-party requests');
  assert(report.requests.models.length > 0, 'models requested');
  assert(
    report.requests.models.every((m) =>
      m.includes(`?v=${encodeURIComponent(version)}`),
    ),
    'every model request carries the version',
  );
  assert.equal(report.detailsBeforeOpen, '', 'nothing filled until opened');
  assert.match(report.details, /^Cozy Diver /);
  assert.doesNotMatch(
    report.details,
    /cozy-diver\.|tank|journal/i,
    'no saved data in details',
  );
  if (phase === 'after') {
    assert.equal(
      report.storage.settings?.sensitivity,
      1.6,
      'preferences survive the update',
    );
    assert.equal(report.storage.settings?.graphics, 'lighter');
    assert.equal(report.storage.onboarding?.visited, true);
    assert.equal(report.eyebrow, 'WELCOME BACK');
  }
  assert.deepEqual(report.errors, [], 'no page errors');
  report.ok = true;
} catch (e) {
  report.failure = String(e?.message || e).split('\n')[0];
  process.exitCode = 1;
} finally {
  fs.writeFileSync(
    path.join(output, `${phase}.json`),
    JSON.stringify(report, null, 2),
  );
  console.log(
    JSON.stringify({
      phase,
      ok: report.ok ?? false,
      failure: report.failure,
      version: report.version,
      startScreenMs: report.startScreenMs,
      models: report.requests.models.length,
      foreign: report.requests.foreign.length,
      sample: report.requests.models[0],
      storage: report.storage,
    }),
  );
  await context.close();
}
