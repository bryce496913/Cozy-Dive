# Creature redesign review — November 27, 2026

This is the implementation checklist for the field-guide review. The supplied screenshots are
visual references for solid, closed, faceted forms; they are not source assets. A checked item
means the model, markings, and existing animation contract have all been addressed in code.

## Fish and hidden animals

- [x] Firefish — narrow the dorsal pennant.
- [x] Seahorse — solid head and body, readable dimensional eyes.
- [x] Frogfish — replace the hollow mouth/body construction.
- [x] Moray eel — rebuild the head, jaw, body transition, and fins.
- [x] Bumphead parrotfish — replace the generic nose with a fused beak and forehead.
- [x] Day octopus — closed mantle, head, and arms.
- [x] Ocean sunfish — closed body with a recognizable clavus and fins.
- [x] Lionfish — remove transparent body treatment while preserving fin animation.

## Sharks, rays, turtle, and whale

- [x] Green sea turtle — shell, solid head, neck, beak, flippers, and tail.
- [x] Blacktip reef shark — shark body plan and black fin tips.
- [x] Whitetip reef shark — shark body plan and white fin tips.
- [x] Leopard shark — slender shark body and readable saddle/spot markings.
- [x] Nurse shark — broad low head, barbels, posterior dorsal fins, and long tail.
- [x] Great hammerhead — tall dorsal, straight hammer, central notch, and shark body.
- [x] Scalloped hammerhead — scalloped hammer distinct from the great hammerhead.
- [x] Whale shark — broad terminal head, keels, spots, and shark tail.
- [x] Spotted eagle ray — spots, projecting head, thick wing mantle, and visible wing stroke.
- [x] Reef manta ray — cephalic lobes, thick mantle, shoulder profile, and visible wing stroke.
- [x] Bat ray — retain its own silhouette and add a visible wing stroke.
- [x] Humpback whale — broad knuckled head, long flippers, peduncle, and flukes.

## Pinnipeds, penguins, and polar visitor

- [x] Harbour seal — compact true-seal body, head, foreflippers, and paired hind flippers.
- [x] California sea lion — neck, external ears, long foreflippers, and hind-flipper silhouette.
- [x] Weddell seal — heavy true-seal body and short rounded head.
- [x] Weddell seal pup — its own juvenile proportions, not a tinted adult substitute.
- [x] Leopard seal — long neck, predatory head, and long body.
- [x] Emperor penguin — closed body, head, beak, belly, flippers, feet, and tail.
- [x] Adelie penguin — shorter species-specific body and head pattern.
- [x] Killer whale — closed cetacean body, saddle patch, eye patches, dorsal, flippers, and flukes.
- [x] Polar bear — recognizable head, neck, torso, limbs, paws, and ears.

## Small benthic and plankton animals

- [x] Spanish shawl nudibranch — opaque body and fewer, stronger cerata.
- [x] Kelp crab — opaque carapace and no decorative ball growths.
- [x] Rock crab — opaque carapace and no decorative ball growths.
- [x] Spiny lobster — opaque segmented body and a visibly dark den entrance.
- [x] Sea butterfly — opaque soft body with readable wing lobes.
- [x] Antarctic krill — opaque segmented body.
- [x] Giant isopod — opaque joined armored body and articulated leg silhouette.

## Progress order

1. Shared shark/ray/whale/turtle body plans and propulsion.
2. Fish and rare-animal closed geometry.
3. Pinnipeds, penguins, killer whale, and polar bear.
4. Small-creature opacity, appendage cleanup, and lobster den.
5. Field-guide model audit and final inventory update.
