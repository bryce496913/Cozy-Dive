/* V0.7 Pass 073: fixed office viewpoints from the real game (before diving), on a fixed clock.
 * Poses the walker and the look directly, ticks a few frames, and captures each view, plus a
 * short office-to-tank approach (walking toward the glass) to check the transition reads.
 *
 *   COZY_URL=http://127.0.0.1:5173 COZY_OUTPUT=/tmp/v07-office node validation/v07/office.mjs
 * Env: COZY_PLAYWRIGHT, COZY_SIZE (default 1280x800).
 */
import fs from 'node:fs';
import path from 'node:path';
const { chromium } = await import(process.env.COZY_PLAYWRIGHT || 'playwright');
const url = process.env.COZY_URL || 'http://127.0.0.1:5173';
const output = process.env.COZY_OUTPUT || '/tmp/v07-office';
const [width, height] = (process.env.COZY_SIZE || '1280x800')
  .split('x')
  .map(Number);
fs.mkdirSync(output, { recursive: true });
/** [name, eye position, yaw, pitch]: camera forward is -z; positive yaw looks left. */
const VIEWS = [
  ['office-spawn', [0.25, 1.6, 1.6], -0.72, -0.12],
  ['office-overview', [-1.1, 1.75, 1.8], 0.2, -0.22],
  ['office-desk', [-0.3, 1.45, 0.65], 0.32, -0.5],
  ['office-tank', [0.15, 1.3, 0.6], -Math.PI / 2, -0.18],
  ['office-chairs', [0.1, 1.35, 1.3], 0.72, -0.38],
  ['office-tank-approach', [0.6, 1.25, 0.6], -Math.PI / 2, -0.15],
];
const browser = await chromium.launch({
  args: [
    '--no-sandbox',
    '--enable-unsafe-swiftshader',
    '--use-angle=swiftshader',
  ],
});
const errors = [],
  report = [];
try {
  const page = await browser.newPage({ viewport: { width, height } });
  page.setDefaultTimeout(600000);
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  await page.addInitScript(() => localStorage.clear());
  await page.route('**/src/main.ts*', async (route) => {
    const r = await route.fetch();
    await route.fulfill({
      response: r,
      body:
        (await r.text()) +
        '\nwindow.__cozy=app;cancelAnimationFrame(app.frame);',
    });
  });
  await page.goto(url);
  await page.waitForFunction(() => window.__cozy?.tankEditor);
  await page.evaluate(() =>
    Promise.all([window.__cozy.world.prepared, window.__cozy.office.prepared]),
  );
  await page.addStyleTag({
    content:
      'body * { visibility: hidden !important; } canvas { visibility: visible !important; }',
  });
  for (const [name, [x, y, z], yaw, pitch] of VIEWS) {
    const stats = await page.evaluate(
      async ([x, y, z, yaw, pitch]) => {
        const a = window.__cozy;
        for (let i = 0; i < 12; i++) {
          a.walk.position.x = x;
          a.walk.position.y = y;
          a.walk.position.z = z;
          a.controls.yaw = yaw;
          a.controls.pitch = pitch;
          await new Promise((r) => requestAnimationFrame(r));
          cancelAnimationFrame(a.frame);
          a.__t = (a.__t ?? 1000) + 1000 / 15;
          a.tick(a.__t);
          cancelAnimationFrame(a.frame);
        }
        const info = a.world.renderer.info.render;
        return { calls: info.calls, triangles: info.triangles };
      },
      [x, y, z, yaw, pitch],
    );
    await page.screenshot({ path: path.join(output, `${name}.png`) });
    report.push({ name, ...stats });
    console.log(name, JSON.stringify(stats));
  }
} finally {
  await browser.close();
  console.log(JSON.stringify({ ok: errors.length === 0, errors }));
}
