import type { SightCandidate } from '../../discovery/journal';
import { reefSight } from '../../discovery/sights';
import type { ReefPlacement } from './OuterReefLayout';

/** Most candidates kept per kind of reef feature (spread through the layout). */
export const REEF_SIGHT_SAMPLES = 24;

/**
 * v0.4 Pass 025: the outer reef's own sights (each kind of coral, sea fans, seagrass), as
 * candidates at a spread of the layout's pieces. Seeing any one piece of a kind counts.
 */
export function reefSightings(
  placements: readonly ReefPlacement[],
  samples = REEF_SIGHT_SAMPLES,
): SightCandidate[] {
  const byKind = new Map<string, { label: string; pieces: ReefPlacement[] }>();
  for (const p of placements) {
    const sight = reefSight(p.family);
    if (!sight) continue;
    let kind = byKind.get(sight.id);
    if (!kind)
      byKind.set(sight.id, (kind = { label: sight.label, pieces: [] }));
    kind.pieces.push(p);
  }
  const out: SightCandidate[] = [];
  for (const [id, { label, pieces }] of byKind) {
    const stride = Math.max(1, Math.ceil(pieces.length / samples));
    for (let i = 0; i < pieces.length; i += stride) {
      const p = pieces[i];
      out.push({
        id,
        label,
        position: p.position,
        radius: 0.8 * Math.max(p.scale.x, p.scale.y, p.scale.z),
      });
    }
  }
  return out;
}
