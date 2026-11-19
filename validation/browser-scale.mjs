/** Keep CSS viewports and behavior checks intact while reducing software rasterization work. */
export function browserScale() {
  return { deviceScaleFactor: process.env.COZY_DPR === '0.5' ? 0.5 : 1 };
}

export async function recordBrowserScale(page) {
  const result = await page.evaluate(() => {
    const canvas = document.querySelector('canvas');
    return {
      dpr: window.devicePixelRatio,
      viewport: [window.innerWidth, window.innerHeight],
      buffer: canvas ? [canvas.width, canvas.height] : null,
    };
  });
  if (result.dpr !== browserScale().deviceScaleFactor)
    throw Error(
      'Browser pixel ratio did not match the requested validation scale',
    );
  console.log('COZY_BROWSER_SCALE', JSON.stringify(result));
}
