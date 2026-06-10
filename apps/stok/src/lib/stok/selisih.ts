export function computeSelisih(qtyFisik: number | null, qtySystem: number): number {
  return (qtyFisik ?? 0) - qtySystem
}

const FLAG_THRESHOLD = 0.15
export function isSelisihFlagged(selisih: number, qtySystem: number): boolean {
  if (qtySystem <= 0) return false
  return Math.abs(selisih) > FLAG_THRESHOLD * qtySystem
}
