export interface WasteGap {
  actual: number
  budget: number
  gapPct: number | null
}

/** Bandingkan nilai waste aktual terhadap "Budget Loss" (resep.buffer_amount x qty terjual). Budget=0 -> gapPct null (N/A), bukan 0%/infinity. */
export function computeWasteGap(actual: number, budget: number): WasteGap {
  return {
    actual,
    budget,
    gapPct: budget > 0 ? ((actual - budget) / budget) * 100 : null,
  }
}
