/**
 * V0.8 Pass 089: the open ocean's visibility, shared.
 *
 * The outer reef's dense murk (an approved artistic decision: about 96% haze by 14 m, so the ocean
 * feels vast and continues beyond what the diver can see) is the one visibility standard for the
 * deep, open-water worlds: the outer reef, the shipwreck, the sea cave (Pass 089) and the waters
 * under the ice (Pass 091). Each keeps its own water colour (which, through the shared fog shader's
 * spectral absorption, gives its own tint with distance) and its own light; only this density is
 * shared, so the four cannot drift apart.
 *
 * The aquarium and the kelp forest keep their own, clearer water.
 *
 * FogExp2 density, read by the shared water-fog shader (`rendering/deepFog.ts`).
 */
export const DENSE_WATER_FOG = 0.13;
