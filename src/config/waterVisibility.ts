/**
 * V0.8 Pass 089: the open ocean's visibility, shared.
 *
 * The outer reef's dense murk (an approved artistic decision: about 96% haze by 14 m, so the ocean
 * feels vast and continues beyond what the diver can see) is the one visibility standard for the
 * deep, open-water worlds: the outer reef, the shipwreck and the sea cave. Each keeps its own water
 * colour (which, through the shared fog shader's spectral absorption, gives its own tint with
 * distance) and its own light; only this density is shared, so the three cannot drift apart.
 *
 * The aquarium, the kelp forest and the waters under the ice keep their own, clearer water.
 *
 * FogExp2 density, read by the shared water-fog shader (`rendering/deepFog.ts`).
 */
export const DENSE_WATER_FOG = 0.13;
