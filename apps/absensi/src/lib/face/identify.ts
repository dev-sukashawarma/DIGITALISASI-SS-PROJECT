import { euclideanDistance, DEFAULT_MATCH_THRESHOLD, type Descriptor } from "./match";

export type Candidate = { id: string; name: string; descriptor: Descriptor };
export type IdentifyResult = { id: string; name: string; distance: number };

/** Cari kandidat terdekat (1:N). Null bila tak ada / semua di atas threshold. */
export function identifyStaff(
  live: Descriptor,
  candidates: Candidate[],
  threshold: number = DEFAULT_MATCH_THRESHOLD,
): IdentifyResult | null {
  let best: IdentifyResult | null = null;
  for (const c of candidates) {
    const distance = euclideanDistance(live, c.descriptor);
    if (distance <= threshold && (best === null || distance < best.distance)) {
      best = { id: c.id, name: c.name, distance };
    }
  }
  return best;
}
