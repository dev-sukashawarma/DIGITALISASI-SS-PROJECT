'use client'

import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase'
import type { PeriodFilterValue } from '@/lib/types'

/**
 * Pendapatan Lain-lain pusat = Σ income_lainnya aktif dalam periode (tanggal WIB, inklusif).
 * Hanya untuk Laba Perusahaan; tidak pernah masuk laba outlet / bagi hasil mitra.
 * RLS: hanya owner/admin/admin_finance/developer yang bisa membaca (selain itu = 0).
 */
export function usePendapatanLain(filter: PeriodFilterValue, enabled: boolean) {
  const supabase = useMemo(() => createClient(), [])
  return useQuery({
    queryKey: ['pendapatan_lain', filter.from, filter.to],
    enabled,
    queryFn: async () => {
      let total = 0
      const PAGE = 1000
      for (let start = 0; ; start += PAGE) {
        const { data, error } = await supabase
          .from('income_lainnya')
          .select('id, amount')
          .eq('status', 'aktif')
          .gte('occurred_at', `${filter.from}T00:00:00+07:00`)
          .lte('occurred_at', `${filter.to}T23:59:59.999+07:00`)
          .order('id')
          .range(start, start + PAGE - 1)
        if (error) throw error
        const rows = data ?? []
        total += rows.reduce((s, r) => s + (Number(r.amount) || 0), 0)
        if (rows.length < PAGE) break
      }
      return total
    },
  })
}
