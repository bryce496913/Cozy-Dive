#!/usr/bin/env bash
# V0.8 Pass 087: the standard in-game comparison gallery. Three fixed views per world, from normal
# swimming viewpoints (wide, mid, close), for every environment: the tank (the approved Pass 082
# benchmark), the outer reef, kelp forest, shipwreck, sea cave and under the ice. Same cameras and
# simulation time on every run, so two checkouts can be compared view for view.
#
#   COZY_URL=http://127.0.0.1:5173 COZY_OUTPUT=/tmp/gallery bash validation/v08/standard-gallery.sh
# Env: COZY_PLAYWRIGHT (module path), COZY_URL, COZY_OUTPUT.
set -euo pipefail
here="$(cd "$(dirname "$0")/../v07" && pwd)"
out="${COZY_OUTPUT:-/tmp/v08-gallery}"
mkdir -p "$out"
export COZY_URL="${COZY_URL:-http://127.0.0.1:5173}"
COZY_OUTPUT="$out" COZY_AQUA=1 COZY_OUTER=1 \
  COZY_VIEWS=aqua-overview,aqua-left-bank,aqua-attach-close,outer-reef-wide,outer-reef-top,outer-rock-close \
  node "$here/baseline.mjs"
COZY_OUTPUT="$out" COZY_INVENTORY=0 COZY_WORLDS=kelp,wreck,cave,ice \
  COZY_VIEWS=kelp-forest-wide,kelp-forest,kelp-rocks-close,wreck-overview,wreck-broadside,wreck-hull-close,cave-cavern,cave-sunbeam,cave-wall-close,ice-open-water,ice-seabed-wide,ice-seabed-close \
  node "$here/worlds.mjs"
