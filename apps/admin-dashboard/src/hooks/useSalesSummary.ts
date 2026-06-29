'use client'
import { useMemo } from 'react'
import { useSalesHourlyRaw } from './useSalesHourlyRaw'
import type { SalesSummaryRow, PeriodFilterValue } from '@/lib/types'

// Ringkasan harian per outlet × sumber, diturunkan dari baris per-jam
// (useSalesHourlyRaw). Dengan berbagi sumber raw yang sama, halaman yang juga
// memakai useSalesHourly untuk filter sama tidak menembak DB dua kali.
// Nama outlet di-resolve dari daftar `outlets` yang sudah dimuat caller
// (mis. useOutlets()), menghindari fetch tabel `outlets` berulang.
export function useSalesSummary(filter: PeriodFilterValue, outlets?: { id: string; name: string }[]) {
  const query = useSalesHourlyRaw(filter)

  const rows = useMemo<SalesSummaryRow[]>(() => {
    const acc = new Map<string, SalesSummaryRow>()
    for (const r of query.data ?? []) {
      const key = `${r.outlet_id}|${r.sales_source}|${r.sales_date}`
      const existing = acc.get(key)
      if (existing) {
        existing.omzet += r.omzet
        existing.jumlah_order_completed += r.jumlah_order_completed
        existing.jumlah_order_all += r.jumlah_order_completed
      } else {
        acc.set(key, {
          outlet_id: r.outlet_id,
          outlet_name: '',
          sales_source: r.sales_source,
          sales_date: r.sales_date,
          omzet: r.omzet,
          jumlah_order_completed: r.jumlah_order_completed,
          jumlah_order_all: r.jumlah_order_completed,
        })
      }
    }
    const result = Array.from(acc.values())
    if (!outlets || outlets.length === 0) return result
    const nameById = new Map(outlets.map((o) => [o.id, o.name]))
    return result.map((r) => ({
      ...r,
      outlet_name: nameById.get(r.outlet_id) ?? 'Outlet Tidak Dikenal',
    }))
  }, [query.data, outlets])

  return { rows, loading: query.isLoading, error: query.error ? (query.error as Error).message : null }
}
