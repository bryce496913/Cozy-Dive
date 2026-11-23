#!/usr/bin/env bash
# V0.8 Pass 090: the fish anatomy review, from the shipped GLBs through the game's loader.
#
#   gallery/   every fish side by side: side, front, three-quarter, top and mid-stroke (v07/gallery.mjs)
#   studio/    one fish at a time: side, front, three-quarter, top, eye (eye, gill cover, mouth),
#              flank (scales), tail (peduncle and caudal fin) and mid-stroke (v08/creatures.mjs)
#
#   COZY_URL=http://127.0.0.1:5173 COZY_OUTPUT=/tmp/fish bash validation/v08/fish-review.sh
# Env: COZY_PLAYWRIGHT, COZY_URL, COZY_OUTPUT, COZY_FISH (comma list of registry ids).
set -uo pipefail
root="$(cd "$(dirname "$0")/.." && pwd)"
out="${COZY_OUTPUT:-/tmp/v08-fish}"
export COZY_URL="${COZY_URL:-http://127.0.0.1:5173}"
fish="${COZY_FISH:-chromis,clownfish,gramma,assessor,cardinalfish,firefish,butterflyfish,bannerfish,moorishIdol,blueTang,icefish,notothen,toothfish,humpheadWrasse,giantSeaBass,parrotfish,sheephead,trevally}"
mkdir -p "$out/gallery" "$out/studio"
COZY_OUTPUT="$out/gallery" node "$root/v07/gallery.mjs"
COZY_OUTPUT="$out/studio" COZY_ANIMALS="$fish" \
  COZY_VIEWS=side,front,three-quarter,top,eye,flank,tail,stroke \
  node "$root/v08/creatures.mjs"
