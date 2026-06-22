import { faceSimilarity, DEFAULT_MATCH_THRESHOLD, type Descriptor } from "./match";

export type Candidate = { id: string; name: string; descriptor: Descriptor };
export type IdentifyResult = { id: string; name: string; similarity: number; bestSimilarity: number };

/** Cari kandidat terbaik (1:N) dengan kemiripan tertinggi. Fallback ke {id:"unknown"} jika tak ada match. */
export function identifyStaff(
  live: Descriptor,
  candidates: Candidate[],
  threshold: number = DEFAULT_MATCH_THRESHOLD,
): IdentifyResult {
  let best: { id: string; name: string; similarity: number } | null = null;
  let maxSimilarity = -1;

  for (const c of candidates) {
    const similarity = faceSimilarity(live, c.descriptor);
    if (similarity > maxSimilarity) {
      maxSimilarity = similarity;
      if (similarity >= threshold) {
        best = { id: c.id, name: c.name, similarity };
      }
    }
  }

  if (!best) return { id: "unknown", name: "Unknown", similarity: 0, bestSimilarity: maxSimilarity };
  return { ...best, bestSimilarity: maxSimilarity };
}
