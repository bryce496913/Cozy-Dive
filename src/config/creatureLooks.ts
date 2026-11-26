import type { SpeciesId } from '../fish/FishSpecies';

/**
 * V0.8 Pass 096: one source for how an animal looks, shared by its wild appearance and its
 * aquarium and collection presentation. The tank had its own copies of these colours,
 * and several had drifted from the wild animal's (the bat ray, Weddell seal pup, flashlight fish,
 * Antarctic silverfish and cleaner wrasse). Values are the wild animal's.
 */

/** Fish drawn on another species' rig, in a colour of their own. */
export const FISH_RECOLOR: Readonly<Partial<Record<SpeciesId, number>>> = {
  garibaldi: 0xff6a12,
  'glassy-sweeper': 0xc98a4e,
  'kelp-bass': 0x7a6a45,
  blacksmith: 0x3f4d5e,
  senorita: 0xe0b23a,
  soldierfish: 0xc23a22,
  'flashlight-fish': 0x1d2126,
  // v0.6 Pass 052: bright silver-blue.
  'antarctic-silverfish': 0xc3d3dc,
  // The bluestreak cleaner wrasse: the firefish's slender body, in its electric blue.
  'cleaner-wrasse': 0x2f74e0,
};

/** Large animals drawn on another species' model, tinted (see the collection audit). */
export const CREATURE_LOOKS = {
  /** The kelp forest's bat rays: the eagle ray's model, dark. */
  batRayTint: 0x5b5a54,
  /** The cave's swell shark: the nurse shark's model, small and sandy brown. */
  swellSharkTint: 0xb08a5c,
  /** The Weddell seal pup: grey, at this share of the harbour seal's model size. */
  weddellPup: { scale: 0.78, tint: 0x9aa2ac },
} as const;
