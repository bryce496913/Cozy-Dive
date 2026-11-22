/* V0.8 Pass 086: render the environment form studio (validation/v08/forms.html): for each sculpted
 * source (tunnel-mouth arch, ice kinds), front, three-quarter, side and close views, one PNG each.
 *
 *   COZY_URL=http://127.0.0.1:5173 COZY_OUTPUT=/tmp/v08-forms node validation/v08/forms.mjs
 * Env: COZY_PLAYWRIGHT, COZY_FORMS (comma list; default every form).
 */
import fs from 'node:fs';
import path from 'node:path';
const { chromium } = await import(process.env.COZY_PLAYWRIGHT || 'playwright');
const url = process.env.COZY_URL || 'http://127.0.0.1:5173';
const output = process.env.COZY_OUTPUT || '/tmp/v08-forms';
const FORMS = (
  process.env.COZY_FORMS || 'arch-cave,arch-ice,wall,berg,column,shard,chunk'
).split(',');
const VIEWS = ['front', 'three-quarter', 'side', 'close'];
fs.mkdirSync(output, { recursive: true });
const browser = await chromium.launch({
  args: ['--no-sandbox', '--enable-unsafe-swiftshader', '--use-angle=swiftshader'],
});
const errors = [],
  report = {};
try {
  for (const form of FORMS) {
    const page = await browser.newPage({ viewport: { width: 800, height: 520 } });
    page.on('pageerror', (e) => errors.push(`${form}: ${e.message}`));
    page.setDefaultTimeout(300000);
    await page.goto(`${url}/validation/v08/forms.html?form=${form}`);
    await page.waitForFunction(() => window.ready);
    for (const view of VIEWS) {
      report[`${form}-${view}`] = await page.evaluate((v) => window.shot(v), view);
      await page.screenshot({ path: path.join(output, `${form}-${view}.png`) });
    }
    console.log(form, JSON.stringify(report[`${form}-front`]));
    await page.close();
  }
} finally {
  await browser.close();
  fs.writeFileSync(path.join(output, 'forms.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ ok: errors.length === 0, errors }));
}
