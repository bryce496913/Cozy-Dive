/* v0.6 Pass 054: first-visit and returning-visit onboarding, in a real browser.
 *
 *   COZY_URL=http://127.0.0.1:5173 COZY_OUTPUT=/tmp/cozy054 node validation/onboarding.mjs
 *
 * Each scenario runs in its own browser context (its own storage):
 *   first visit, returning visit (reload), storage unavailable, pointer-lock denied, WebGL
 *   unavailable, mute, pause and resume, reload while swimming.
 * Records timings (start screen shown, scene prepared) and writes report.json plus screenshots.
 * Frames are stepped by hand at 1/15 s, so timings of hints are in simulated seconds.
 */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
const { chromium } = await import(process.env.COZY_PLAYWRIGHT || 'playwright');
const url = process.env.COZY_URL || 'http://127.0.0.1:5173';
const output = process.env.COZY_OUTPUT || '/tmp/cozy054';
fs.mkdirSync(output, { recursive: true });
const browser = await chromium.launch({
  args: [
    '--no-sandbox',
    '--disable-dev-shm-usage',
    '--enable-unsafe-swiftshader',
    '--use-angle=swiftshader',
  ],
});
const report = { scenarios: {}, errors: [] };
const log = (...a) =>
  console.log(`[${new Date().toISOString().slice(11, 19)}]`, ...a);

async function open(name, init) {
  const context = await browser.newContext({
    viewport: { width: 800, height: 500 },
    deviceScaleFactor: Number(process.env.COZY_DPR || 0.5),
  });
  const page = await context.newPage();
  page.setDefaultTimeout(300000);
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  if (init) await page.addInitScript(init);
  await page.route('**/src/main.ts*', async (route) => {
    const r = await route.fetch();
    await route.fulfill({
      response: r,
      body: (await r.text()) + '\nwindow.__cozy=app;',
    });
  });
  return { context, page, errors, name };
}
async function load(page) {
  const t0 = Date.now();
  await page.goto(url);
  await page.waitForSelector('#office:not([disabled])', { state: 'visible' });
  const shown = Date.now() - t0;
  await page.waitForFunction(() => window.__cozy);
  const prepared = await page.evaluate(async () => {
    const a = window.__cozy;
    if (!a.world) return null;
    const t = performance.now();
    await Promise.all([a.world.prepared, a.office?.prepared]);
    return performance.now() - t;
  });
  return { shown, preparedAfterShown: prepared, total: Date.now() - t0 };
}
const step = (page, seconds, keys = []) =>
  page.evaluate(
    async ([seconds, keys]) => {
      const a = window.__cozy;
      for (const k of keys) a.controls.keys?.add?.(k);
      const n = Math.round(seconds * 15);
      cancelAnimationFrame(a.frame);
      for (let i = 0; i < n; i++) {
        a.__t = (a.__t ?? performance.now()) + 1000 / 15;
        a.tick(a.__t);
        cancelAnimationFrame(a.frame);
      }
      for (const k of keys) a.controls.keys?.delete?.(k);
      const prompt = document.querySelector('#dive-prompt');
      return { prompt: prompt.hidden ? null : prompt.textContent };
    },
    [seconds, keys],
  );
const text = (page, sel) =>
  page.evaluate((s) => document.querySelector(s)?.textContent ?? null, sel);
const focused = (page) => page.evaluate(() => document.activeElement?.id);
const stored = (page) =>
  page.evaluate(() => {
    try {
      return JSON.parse(localStorage.getItem('cozy-diver.onboarding.v1'));
    } catch {
      return 'unavailable';
    }
  });
const locked = (page) =>
  page.waitForFunction(
    () =>
      !!document.pointerLockElement &&
      document.querySelector('#overlay').hidden,
  );
async function finish(s, result) {
  result.errors = s.errors;
  report.scenarios[s.name] = result;
  report.errors.push(...s.errors.map((e) => `${s.name}: ${e}`));
  log(s.name, JSON.stringify(result));
  await s.context.close();
}

try {
  // 1 & 2. First visit, then the same visitor returning.
  {
    const s = await open('first-and-returning');
    const r = {};
    r.firstLoad = await load(s.page);
    r.firstEyebrow = await text(s.page, '.eyebrow');
    r.firstButtons = await s.page.evaluate(() =>
      [...document.querySelectorAll('.entry-actions button:not([hidden])')].map(
        (b) => b.textContent.trim(),
      ),
    );
    r.firstFocus = await focused(s.page);
    await s.page.screenshot({ path: path.join(output, 'first-visit.png') });
    assert.match(r.firstEyebrow, /FIRST DIVE/);
    assert.ok(r.firstButtons.some((b) => /Dive In/.test(b)));
    assert.ok(r.firstButtons.some((b) => /Enter the Office/.test(b)));
    // Dive straight in.
    await s.page.getByRole('button', { name: /Dive In/ }).click();
    await locked(s.page);
    r.modeAfterDive = await s.page.evaluate(() => window.__cozy.mode);
    r.beforeHint = (await step(s.page, 1)).prompt;
    r.hint = (await step(s.page, 1)).prompt;
    await s.page.screenshot({ path: path.join(output, 'swim-hint.png') });
    // Swimming dismisses it early.
    r.afterSwimming = (await step(s.page, 3, ['KeyW'])).prompt;
    r.storedAfterHint = await stored(s.page);
    assert.equal(r.modeAfterDive, 'aquarium');
    assert.equal(r.beforeHint, null);
    assert.match(r.hint ?? '', /depth/);
    assert.equal(r.afterSwimming, null);
    assert.deepEqual(r.storedAfterHint, {
      visited: true,
      last: 'aquarium',
      swimHint: true,
    });
    // Returning: welcomed back, the water offered first, no hint again.
    r.returnLoad = await load(s.page);
    r.returnEyebrow = await text(s.page, '.eyebrow');
    r.returnFocus = await focused(s.page);
    await s.page.screenshot({ path: path.join(output, 'returning.png') });
    assert.match(r.returnEyebrow, /WELCOME BACK/);
    assert.equal(r.returnFocus, 'enter');
    await s.page.keyboard.press('Enter');
    await locked(s.page);
    r.returnHint = (await step(s.page, 4)).prompt;
    assert.equal(r.returnHint, null);
    await finish(s, r);
  }
  // 3. Storage unavailable: everything still works; treated as a first visit.
  {
    const s = await open('storage-unavailable', () => {
      Object.defineProperty(window, 'localStorage', {
        get() {
          throw new DOMException('denied', 'SecurityError');
        },
      });
    });
    const r = { load: await load(s.page) };
    r.eyebrow = await text(s.page, '.eyebrow');
    await s.page.getByRole('button', { name: /Dive In/ }).click();
    await locked(s.page);
    r.hint = (await step(s.page, 2)).prompt;
    r.saveStatus = await text(s.page, '#save-status');
    assert.match(r.eyebrow, /FIRST DIVE/);
    assert.match(r.hint ?? '', /depth/);
    await finish(s, r);
  }
  // 4. Pointer lock denied: a calm message, the start screen stays and can be retried.
  {
    const s = await open('pointer-lock-denied', () => {
      HTMLCanvasElement.prototype.requestPointerLock = function () {
        setTimeout(() => document.dispatchEvent(new Event('pointerlockerror')));
        return Promise.reject(new DOMException('denied', 'NotAllowedError'));
      };
    });
    const r = { load: await load(s.page) };
    await s.page.getByRole('button', { name: /Dive In/ }).click();
    await s.page.waitForFunction(
      () => document.querySelector('#status').textContent,
    );
    r.status = await text(s.page, '#status');
    r.overlayHidden = await s.page.evaluate(
      () => document.querySelector('#overlay').hidden,
    );
    r.buttonsEnabled = await s.page.evaluate(
      () =>
        !document.querySelector('#enter').disabled &&
        !document.querySelector('#office').disabled,
    );
    await s.page.screenshot({ path: path.join(output, 'lock-denied.png') });
    assert.equal(r.overlayHidden, false);
    assert.ok(r.buttonsEnabled);
    assert.match(r.status, /mouse/i);
    // Expected noise from the denial itself is not an error of the app.
    s.errors = s.errors.filter((e) => !/denied/.test(e));
    await finish(s, r);
  }
  // 5. WebGL unavailable: a clear message, no entry buttons offered.
  {
    const s = await open('webgl-unavailable', () => {
      const original = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (kind, ...rest) {
        return /webgl/.test(kind) ? null : original.call(this, kind, ...rest);
      };
    });
    await s.page.goto(url);
    await s.page.waitForFunction(
      () => document.querySelector('#status')?.textContent,
    );
    const r = {
      status: await text(s.page, '#status'),
      disabled: await s.page.evaluate(
        () =>
          document.querySelector('#enter').disabled &&
          document.querySelector('#office').disabled,
      ),
    };
    await s.page.screenshot({ path: path.join(output, 'webgl-failed.png') });
    assert.match(r.status, /WebGL/);
    assert.ok(r.disabled);
    // three.js logs the failed context itself; that is the scenario, not a fault.
    s.errors = s.errors.filter((e) => !/WebGL|context/i.test(e));
    await finish(s, r);
  }
  // 6–8. Mute, pause and resume, reload while swimming.
  {
    const s = await open('mute-pause-reload');
    const r = { load: await load(s.page) };
    await s.page.getByRole('button', { name: /Dive In/ }).click();
    await locked(s.page);
    await step(s.page, 0.5);
    await s.page.keyboard.press('KeyM');
    r.muted = await s.page.evaluate(
      () =>
        document.querySelector('#audio-toggle').getAttribute('aria-pressed') ===
        'true',
    );
    await s.page.evaluate(() => document.exitPointerLock());
    await s.page.waitForFunction(
      () => !document.querySelector('#overlay').hidden,
    );
    r.pausedTitle = await text(s.page, 'h1');
    r.pausedFocus = await focused(s.page);
    await s.page.screenshot({ path: path.join(output, 'paused.png') });
    await s.page.keyboard.press('Enter');
    await locked(s.page);
    r.resumedMode = await s.page.evaluate(() => window.__cozy.mode);
    r.reload = await load(s.page);
    r.mutedAfterReload = await s.page.evaluate(
      () =>
        document.querySelector('#audio-toggle').getAttribute('aria-pressed') ===
        'true',
    );
    r.reloadEyebrow = await text(s.page, '.eyebrow');
    assert.ok(r.muted);
    assert.match(r.pausedTitle, /longer/);
    assert.equal(r.pausedFocus, 'enter');
    assert.equal(r.resumedMode, 'aquarium');
    assert.ok(r.mutedAfterReload);
    assert.match(r.reloadEyebrow, /WELCOME BACK/);
    await finish(s, r);
  }
  assert.deepEqual(report.errors, []);
  log('all onboarding scenarios passed');
} finally {
  fs.writeFileSync(
    path.join(output, 'report.json'),
    JSON.stringify(report, null, 2),
  );
  await browser.close();
}
