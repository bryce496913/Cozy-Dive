/**
 * v0.6 Pass 059: the graphics detail preference. Full detail is the default and the accepted look,
 * never lowered automatically. Lighter draws fewer pixels (a lower resolution cap), the main cost
 * on integrated laptop graphics; every model, creature and effect stays the same.
 */
export type GraphicsDetail = 'full' | 'lighter';
export const PIXEL_RATIO_CAP: Readonly<Record<GraphicsDetail, number>> = {
  full: 1.75,
  lighter: 1,
};
/** The renderer's pixel ratio for this display and preference. */
export function pixelRatioFor(
  devicePixelRatio: number,
  detail: GraphicsDetail,
): number {
  const dpr =
    Number.isFinite(devicePixelRatio) && devicePixelRatio > 0
      ? devicePixelRatio
      : 1;
  return Math.min(dpr, PIXEL_RATIO_CAP[detail]);
}
