export interface SettlementPromoSummary {
  promoMerchant: number
  commission: number
  omzetKotor: number
}

/**
 * Menyelaraskan potongan penjualan (total_deductions) dari input kasir / view `sales_daily_scoped`
 * dengan data rekonsiliasi riil dari `platform_settlements`.
 *
 * Aturan Bisnis:
 * 1. GoFood: kasir sering keliru menginput subsidi voucher Gojek ke diskon resto.
 *    Single source of truth promo resto adalah `promo_merchant` dari laporan GoBiz di `platform_settlements`.
 * 2. ShopeeFood: menggunakan promo_merchant dari settlement untuk menyerap koreksi / penyesuaian akhir bulan.
 * 3. GrabFood: menggunakan promo_merchant jika tersedia di settlement.
 * 4. Gross Revenue (omzet + total_deductions) DIJAGA TETAP KONSISTEN:
 *    Ketika total_deductions diselaraskan, omzet disesuaikan sehingga (omzet + total_deductions)
 *    selalu sama persis dengan Omzet Kotor sebelum rekonsiliasi.
 */
export function reconcileSalesRowsWithSettlements(
  salesRows: any[],
  settlementsMap: Map<string, SettlementPromoSummary> | Record<string, SettlementPromoSummary>
): any[] {
  const getSettlement = (key: string): SettlementPromoSummary | undefined => {
    if (settlementsMap instanceof Map) return settlementsMap.get(key)
    return settlementsMap[key]
  }

  // Clone sales rows agar immutable
  const result = salesRows.map(r => ({ ...r }))

  // Kumpulkan kombinasi unik outlet_id
  const outletIds = new Set<string>()
  result.forEach(r => {
    if (r.outlet_id) outletIds.add(r.outlet_id)
  })

  // Mapping platform settlement ke sales_source di sales_daily_scoped
  const platformsToReconcile: { plat: string; sources: string[] }[] = [
    { plat: 'gofood', sources: ['gofood'] },
    { plat: 'shopeefood', sources: ['shopeefood'] },
    { plat: 'grabfood', sources: ['grabfood'] },
  ]

  for (const oid of outletIds) {
    for (const { plat, sources } of platformsToReconcile) {
      const st = getSettlement(`${oid}|${plat}`)
      if (!st || st.promoMerchant === undefined || st.promoMerchant === null) continue

      // Temukan baris sales_daily untuk outlet & platform ini
      const matchingRows = result.filter(
        r => r.outlet_id === oid && sources.includes((r.sales_source || '').toLowerCase())
      )
      if (matchingRows.length === 0) continue

      const targetPromo = Math.max(0, Number(st.promoMerchant) || 0)
      const currentCashierPromo = matchingRows.reduce((sum, r) => sum + (Number(r.total_deductions) || 0), 0)
      const totalGross = matchingRows.reduce((sum, r) => sum + (Number(r.omzet) || 0) + (Number(r.total_deductions) || 0), 0)

      // Jika sama persis, tidak perlu diubah
      if (currentCashierPromo === targetPromo) continue

      // Alokasikan targetPromo ke baris-baris harian
      let allocatedSoFar = 0
      matchingRows.forEach((r, idx) => {
        const rowGross = (Number(r.omzet) || 0) + (Number(r.total_deductions) || 0)
        let rowDeduction = 0

        if (idx === matchingRows.length - 1) {
          rowDeduction = Math.max(0, targetPromo - allocatedSoFar)
        } else if (currentCashierPromo > 0) {
          rowDeduction = Math.round(targetPromo * ((Number(r.total_deductions) || 0) / currentCashierPromo))
          allocatedSoFar += rowDeduction
        } else if (totalGross > 0) {
          rowDeduction = Math.round(targetPromo * (rowGross / totalGross))
          allocatedSoFar += rowDeduction
        }

        r.total_deductions = rowDeduction
        r.omzet = rowGross - rowDeduction
      })
    }
  }

  return result
}
