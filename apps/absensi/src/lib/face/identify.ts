import { faceSimilarity, DEFAULT_MATCH_THRESHOLD, type Descriptor } from "./match";

export type Candidate = { id: string; name: string; descriptor: Descriptor };
export type IdentifyResult = { id: string; name: string; similarity: number };

/** Cari kandidat terbaik (1:N) dengan kemiripan tertinggi. Null bila tak ada / semua di bawah threshold. */
export function identifyStaff(
  live: Descriptor,
  candidates: Candidate[],
  threshold: number = DEFAULT_MATCH_THRESHOLD,
): IdentifyResult | null {
  let best: IdentifyResult | null = null;
  let maxSimilarity = -1;

  for (const c of candidates) {
    const similarity = faceSimilarity(live, c.descriptor);
    if (similarity >= threshold && similarity > maxSimilarity) {
      maxSimilarity = similarity;
      best = { id: c.id, name: c.name, similarity };
    }
  }
  return best;
}
