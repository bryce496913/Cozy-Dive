/* v0.6 Pass 057: a keyboard-only walkthrough, comfort settings and text contrast, in a real browser.
 *
 *   COZY_URL=http://127.0.0.1:5173 COZY_OUTPUT=/tmp/cozy057 node validation/keyboard.mjs
 *
 * Uses only the keyboard for the interface (Tab, Shift+Tab, Enter, Space, arrows, Escape):
 *   1. The start screen: what Tab reaches, in order, and that each focused control shows a visible
 *      focus indicator (an outline or a ring).
 *   2. Settings: opened with Enter; every control reachable; the field of view raised and invert
 *      look turned on with the keyboard; Escape closes, and focus returns to the Settings button.
 *   3. Dive In with Enter; the comfort settings take effect (the camera's field of view, and the
 *      mouse looking the other way); Escape pauses with focus on the way back.
 *   4. For your tank: opened, walked with Tab, closed with Escape.
 *   5. Contrast of the interface's text against its own panel (or, over the live scene, against the
 *      overlay's darkest backdrop; noted as approximate).
 */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
const { chromium } = await import(process.env.COZY_PLAYWRIGHT || 'playwright');
const url = process.env.COZY_URL || 'http://127.0.0.1:5173';
const output = process.env.COZY_OUTPUT || '/tmp/cozy057';
fs.mkdirSync(output, { recursive: true });
const browser = await chromium.launch({
  args: [
    '--no-sandbox',
    '--disable-dev-shm-usage',
    '--enable-unsafe-swiftshader',
    '--use-angle=swiftshader',
  ],
});
const report = { errors: [] };
const log = (m) =>
  console.log(`[${new Date().toISOString().slice(11, 19)}] ${m}`);
try {
  const page = await browser.newPage({
    viewport: { width: 1100, height: 760 },
    deviceScaleFactor: 0.5,
  });
  page.setDefaultTimeout(300000);
  page.on('pageerror', (e) => report.errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') report.errors.push(m.text());
  });
  await page.route('**/src/main.ts*', async (route) => {
    const r = await route.fetch();
    await route.fulfill({
      response: r,
      body: (await r.text()) + '\nwindow.__cozy=app;',
    });
  });
  await page.goto(url);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForFunction(() => window.__cozy?.tankEditor);
  await page.evaluate(() =>
    Promise.all([
      window.__cozy.world.prepared,
      window.__cozy.office.prepared,
      window.__cozy.tankEditor.ready,
    ]),
  );
  /** The focused element: a readable name, and whether a focus indicator is drawn. */
  const focused = () =>
    page.evaluate(() => {
      const e = document.activeElement;
      if (!e || e === document.body) return null;
      const s = getComputedStyle(e),
        ring =
          (s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) > 0) ||
          (s.boxShadow && s.boxShadow !== 'none');
      const label =
        e.id ||
        e.getAttribute('aria-label') ||
        e.textContent.trim().slice(0, 30) ||
        e.tagName;
      return { label, tag: e.tagName.toLowerCase(), ring: !!ring };
    });
  /** Tab until focus comes back round to the first element reached (compared by identity). */
  const tabThrough = async (max) => {
    const seen = [];
    await page.evaluate(() => (window.__firstTab = null));
    for (let i = 0; i < max; i++) {
      await page.keyboard.press('Tab');
      const again = await page.evaluate(() => {
        const e = document.activeElement;
        if (!window.__firstTab) {
          window.__firstTab = e;
          return false;
        }
        return e === window.__firstTab;
      });
      if (again) break;
      const f = await focused();
      if (f) seen.push(f);
    }
    return seen;
  };

  // 1. The start screen.
  report.initialFocus = await focused();
  report.startTabOrder = await tabThrough(20);
  log(
    `start: ${report.startTabOrder.map((f) => f.label + (f.ring ? '' : ' (NO RING)')).join(' → ')}`,
  );
  assert.equal(
    report.initialFocus?.label,
    'office',
    'Enter the Office focused on load',
  );
  for (const id of ['audio-toggle', 'office', 'enter'])
    assert(
      report.startTabOrder.some((f) => f.label === id),
      `${id} reachable by Tab`,
    );
  assert(
    report.startTabOrder.every((f) => f.ring),
    'every focused control shows a focus indicator',
  );

  // 2. Settings by keyboard.
  await page.focus('.settings-toggle');
  await page.keyboard.press('Enter');
  report.settingsFocus = await focused();
  report.settingsTabOrder = await tabThrough(30);
  report.settingsStaysInside = await page.evaluate(() =>
    document.querySelector('#settings-panel').contains(document.activeElement),
  );
  log(`settings: ${report.settingsTabOrder.map((f) => f.label).join(' → ')}`);
  for (const id of [
    'speed',
    'swimming-feel',
    'field-of-view',
    'invert-look',
    'reduced-motion',
    'audio-enabled',
    'frame-time',
    'master-volume',
    'close-settings',
  ])
    assert(
      report.settingsTabOrder.some((f) => f.label === id),
      `${id} reachable in Settings`,
    );
  await page.focus('#field-of-view');
  for (let i = 0; i < 10; i++) await page.keyboard.press('ArrowRight');
  await page.focus('#invert-look');
  await page.keyboard.press('Space');
  report.fieldOfViewLabel = await page
    .locator('#field-of-view-value')
    .innerText();
  await page.keyboard.press('Escape');
  report.afterSettingsFocus = await focused();
  report.saved = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('cozy-diver.settings.v3')),
  );
  assert.equal(report.settingsFocus?.label, 'sensitivity');
  assert(
    report.settingsStaysInside,
    'Tab stays within the open Settings panel',
  );
  assert(
    !report.settingsTabOrder.some((f) => f.label === 'office'),
    'Tab does not wander behind the Settings panel',
  );
  assert.equal(report.saved.fieldOfView, 10);
  assert.equal(report.saved.invertLook, true);
  assert.equal(report.fieldOfViewLabel, '+10°');
  assert.match(report.afterSettingsFocus?.label ?? '', /Settings/);

  // 3. Dive In with the keyboard; comfort settings in effect.
  await page.focus('#enter');
  await page.keyboard.press('Enter');
  await page.waitForFunction(
    () =>
      !!document.pointerLockElement &&
      document.querySelector('#overlay').hidden,
  );
  await page.waitForTimeout(500);
  report.camera = await page.evaluate(() => window.__cozy.water().camera.fov);
  report.look = await page.evaluate(async () => {
    const c = window.__cozy.controls,
      before = c.pitch;
    document.dispatchEvent(new MouseEvent('mousemove', { movementY: -120 }));
    for (let i = 0; i < 30; i++) c.update(1 / 30);
    return { before, after: c.pitch };
  });
  assert.equal(report.camera, 74, 'field of view 64° + 10°');
  assert(
    report.look.after < report.look.before,
    'mouse up looks down with invert look on',
  );
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => !document.querySelector('#overlay').hidden);
  report.pausedFocus = await focused();
  assert.equal(report.pausedFocus?.label, 'enter');
  await page.screenshot({ path: path.join(output, 'paused.png') });

  // 4. For your tank, by keyboard.
  await page.focus('text=For your tank');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(300);
  report.catalogTabOrder = (await tabThrough(12)).map((f) => f.label);
  log(`catalog: ${report.catalogTabOrder.join(' → ')}`);
  await page.screenshot({ path: path.join(output, 'catalog.png') });
  await page.keyboard.press('Escape');
  report.catalogClosed = await page.evaluate(
    () => document.querySelector('.tank-catalog')?.hidden === true,
  );
  assert(report.catalogTabOrder.length > 3, 'catalog controls reachable');
  assert(
    !report.catalogTabOrder.includes('Cozy Diver home'),
    'Tab stays within the open catalog',
  );
  assert(report.catalogClosed, 'Escape closes the catalog');

  // 5. Contrast of visible interface text.
  report.contrast = await page.evaluate(() => {
    const parse = (c) => {
      const m = c.match(/rgba?\(([^)]+)\)/);
      if (!m) return null;
      const [r, g, b, a = 1] = m[1]
        .split(/[ ,/]+/)
        .filter(Boolean)
        .map(Number);
      return { r, g, b, a };
    };
    const lum = ({ r, g, b }) => {
      const f = (v) => {
        v /= 255;
        return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
      };
      return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
    };
    // Over the live scene, measure against the overlay's dark teal (#0b2e2f, the vignette's tone).
    const SCENE = { r: 11, g: 46, b: 47, a: 1 };
    const backdrop = (e) => {
      let bg = null;
      for (
        let n = e;
        n && n !== document.documentElement;
        n = n.parentElement
      ) {
        const c = parse(getComputedStyle(n).backgroundColor);
        if (c && c.a > 0.85) {
          bg = c;
          break;
        }
      }
      return { bg: bg ?? SCENE, approx: !bg };
    };
    const out = [];
    for (const sel of [
      '.intro',
      '.entry-note',
      '.entry-choice small',
      '.eyebrow',
      '.controls span',
      '.settings-panel label',
      '.settings-panel p',
      '.status',
      '.enter',
      '.enter.secondary',
      '.audio-toggle',
      '.settings-toggle',
      '.edition',
      '.scene-label small',
    ]) {
      const e = [...document.querySelectorAll(sel)].find(
        (x) => x.offsetParent !== null && x.textContent.trim(),
      );
      if (!e) continue;
      const s = getComputedStyle(e),
        fg = parse(s.color),
        { bg, approx } = backdrop(e);
      const L1 = lum(fg),
        L2 = lum(bg),
        ratio = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
      out.push({
        sel,
        size: s.fontSize,
        ratio: +ratio.toFixed(2),
        approx,
      });
    }
    return out;
  });
  for (const c of report.contrast)
    log(
      `contrast ${c.sel} ${c.size}: ${c.ratio}${c.approx ? ' (over the scene, approx.)' : ''}`,
    );
  assert.deepEqual(report.errors, [], 'no page errors');
  report.ok = true;
} catch (e) {
  report.failure = String(e?.stack || e);
  process.exitCode = 1;
} finally {
  fs.writeFileSync(
    path.join(output, 'report.json'),
    JSON.stringify(report, null, 2),
  );
  log(
    report.ok
      ? 'keyboard walkthrough passed'
      : `FAILED: ${report.failure?.split('\n')[0]}`,
  );
  await browser.close();
}
