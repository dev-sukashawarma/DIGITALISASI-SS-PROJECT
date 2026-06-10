import type { ResepItem } from '@/types/stok'

/**
 * Expected raw-material usage = porsiSold * qty_per_porsi per bahan.
 * Built for M2; wired to POS sales in M4 to drive auto-deduction + precise
 * selisih anomaly detection. Not invoked by M2 UI yet.
 */
export function expectedUsage(
  porsiSold: number,
  recipe: ResepItem[]
): Record<string, number> {
  const out: Record<string, number> = {}
  if (porsiSold <= 0) return out
  for (const item of recipe) {
    out[item.bahan_baku_id] = (out[item.bahan_baku_id] ?? 0) + porsiSold * item.qty_per_porsi
  }
  return out
}
