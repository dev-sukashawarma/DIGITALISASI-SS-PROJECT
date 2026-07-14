// apps/admin-dashboard/src/lib/wasteGap.ts
// Bandingkan nilai waste aktual (approved) terhadap "Budget Loss" — alokasi
// Rp yang sudah ditanam di BOM (resep.buffer_amount x qty terjual). Budget=0
// (resep belum diisi Loss, atau tak ada penjualan matching di periode itu)
// membuat gap tak bermakna secara matematis -> gapPct null, UI render "N/A".

export interface WasteGap {
  actual: number
  budget: number
  gapPct: number | null
}

export function computeWasteGap(actual: number, budget: number): WasteGap {
  return {
    actual,
    budget,
    gapPct: budget > 0 ? ((actual - budget) / budget) * 100 : null,
  }
}
