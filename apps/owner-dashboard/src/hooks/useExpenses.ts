'use client'

import { useEffect, useState } from 'react'
import { createSupabaseBrowserClient } from '@suka/auth'
import type { PeriodFilterValue } from '@/lib/types'
import { fetchAllRows } from '@/lib/fetchAllRows'

export interface ExpenseRow {
  id: string
  outlet_id: string
  outlet_name: string
  category: 'bahan_baku' | 'gaji' | 'operasional' | 'sewa' | 'utilitas' | 'lainnya'
  amount: number
  description: string
  expense_date: string
}

export function useExpenses(filter: PeriodFilterValue) {
  const supabase = createSupabaseBrowserClient()
  const [rows, setRows] = useState<ExpenseRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    setLoading(true)
    setError(null)

    // Dipaginasi dengan urutan unik (tanggal + id): dulu query polos terpotong
    // diam-diam di 1.000 baris sehingga total biaya/laba bersih bisa salah.
    const build = () => {
      let q = supabase
        .from('expenses')
        .select('id, outlet_id, category, amount, description, expense_date, outlets(name)')
        .gte('expense_date', filter.from)
        .lte('expense_date', filter.to)

      if (filter.outletId !== 'all') {
        q = q.eq('outlet_id', filter.outletId)
      }

      // Terbaru dulu (daftar transaksi di halaman Pengeluaran tampil sesuai
      // urutan ini; dulu urutannya acak karena query tanpa ORDER BY).
      return q
        .order('expense_date', { ascending: false })
        .order('id', { ascending: false })
    }

    fetchAllRows<any>(build).then(({ data, error }) => {
      if (!active) return
      if (error) {
        setError(error)
      } else {
        const mapped = data.map((row: any) => ({
          id: row.id,
          outlet_id: row.outlet_id,
          outlet_name: row.outlets?.name ?? 'Outlet Tidak Dikenal',
          category: row.category,
          amount: Number(row.amount),
          description: row.description,
          expense_date: row.expense_date,
        })) as ExpenseRow[]
        setRows(mapped)
      }
      setLoading(false)
    })

    return () => {
      active = false
    }
  }, [supabase, filter.from, filter.to, filter.outletId])

  return { rows, loading, error }
}
