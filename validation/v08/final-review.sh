#!/usr/bin/env bash
# V0.8 Pass 088: the Crafted Stylized Realism final review captures, from the current build.
#
#   scenes/      the Pass 061 baseline views (same names, cameras and simulation clock), every world
#   fish/        the fish roster studio (v07/gallery.mjs)
#   creatures/   sharks, rays, turtle, marine mammals (v08/creatures.mjs: side, 3/4, head, top, stroke)
#   coral/ plants/ ornaments/ small/   the close-up studios (v07/small.mjs sets)
#
#   COZY_URL=http://127.0.0.1:5173 COZY_OUTPUT=/tmp/final bash validation/v08/final-review.sh
# Env: COZY_PLAYWRIGHT, COZY_URL, COZY_OUTPUT, COZY_PARTS (default: all of the above).
set -uo pipefail
root="$(cd "$(dirname "$0")/.." && pwd)"
out="${COZY_OUTPUT:-/tmp/v08-final}"
parts="${COZY_PARTS:-scenes fish creatures coral plants ornaments small}"
export COZY_URL="${COZY_URL:-http://127.0.0.1:5173}"
for part in $parts; do
  mkdir -p "$out/$part"
  case "$part" in
    scenes)
      COZY_OUTPUT="$out/scenes" COZY_OUTER=1 \
        COZY_VIEWS=tank-section-swim,tank-section-medium,tank-massive-coral-close,tank-branching-coral-close,tank-seagrass-close,tank-arch-moray-close,tank-chromis-school,outer-reef-top,outer-coral-close,outer-wall-lip \
        node "$root/v07/baseline.mjs"
      COZY_OUTPUT="$out/scenes" COZY_INVENTORY=0 COZY_WORLDS=kelp,wreck,cave,ice \
        COZY_VIEWS=kelp-canopy,kelp-forest,kelp-rocks-close,wreck-deck,wreck-hull-close,wreck-overview,cave-cavern,cave-sunbeam,cave-wall-close,ice-open-water,ice-seabed-close,ice-underside \
        node "$root/v07/worlds.mjs"
      ;;
    fish) COZY_OUTPUT="$out/fish" node "$root/v07/gallery.mjs" ;;
    creatures)
      COZY_OUTPUT="$out/creatures" \
        COZY_ANIMALS=hammerhead,greatWhite,reefShark,whaleShark,eagleRay,mantaRay,seaTurtle,harbourSeal,seaLion,polarBear,humpbackWhale,minkeWhale,seaOtter \
        node "$root/v08/creatures.mjs"
      ;;
    small) COZY_OUTPUT="$out/small" node "$root/v07/small.mjs" ;;
    *) COZY_OUTPUT="$out/$part" COZY_SET="$part" node "$root/v07/small.mjs" ;;
  esac
done
