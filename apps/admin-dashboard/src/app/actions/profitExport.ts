'use server'

import { cookies } from 'next/headers'
import { createSupabaseServerClient } from '@suka/auth'
import type { PeriodFilterValue } from '@/lib/types'
import { isTestOutlet, TEST_OUTLET_ID } from '@/lib/outletFilters'
import { fetchAllPages } from '@/lib/fetchAllPages'

export type OutletBreakdownDetails = {
  outlet_id: string
  omzet_breakdown: { name: string; amount: number }[]
  waste_breakdown: { name: string; amount: number }[]
  opex_breakdown: { name: string; amount: number }[]
}

export async function getProfitExportBreakdown(filter: PeriodFilterValue): Promise<OutletBreakdownDetails[]> {
  const cookieStore = await cookies()
  const supabase = createSupabaseServerClient({
    getAll: () => cookieStore.getAll(),
    setAll: (cookiesToSet) => {
      try {
        cookiesToSet.forEach(({ name, value, options }) => {
          cookieStore.set(name, value, options as any)
        })
      } catch {}
    }
  })

  const opexMap = new Map<string, Map<string, number>>() 
  
  // Rincian ini masuk ke file CSV/PDF yang diarsipkan & dibagikan, jadi angka
  // yang terpotong ikut tersimpan permanen. `petty_cash_expenses` sendiri sudah
  // >1.400 baris per bulan — di atas batas 1.000 PostgREST — sehingga tanpa
  // paginasi ekspor melaporkan biaya yang terlalu kecil.
  const buildExpensesQuery = () => {
    let b = supabase.from('expenses')
      .select('outlet_id, category, amount')
      .neq('outlet_id', TEST_OUTLET_ID)
      // Tabel `expenses` juga memuat baris pemasukan (type='income');
      // tanpa saringan ini pemasukan ikut terhitung sebagai biaya.
      .eq('type', 'expense')
      .gte('expense_date', filter.from)
      .lte('expense_date', filter.to)
      .order('id', { ascending: true })
    if (filter.outletId !== 'all') b = b.eq('outlet_id', filter.outletId)
    return b
  }

  const buildPettyCashQuery = () => {
    let b = supabase.from('petty_cash_expenses')
      .select('outlet_id, category, amount')
      .neq('outlet_id', TEST_OUTLET_ID)
      .in('category', ['bahan_baku', 'pengeluaran_outlet', 'operasional', 'utilitas', 'lainnya', 'bb', 'outlet', 'utilities'])
      .gte('expense_date', filter.from)
      .lte('expense_date', filter.to)
      .order('id', { ascending: true })
    if (filter.outletId !== 'all') b = b.eq('outlet_id', filter.outletId)
    return b
  }

  const [expenseRows, pettyCashRows] = await Promise.all([
    fetchAllPages<any>(buildExpensesQuery),
    fetchAllPages<any>(buildPettyCashQuery),
  ])

  const processExpense = (row: any, mapCat: (c: string) => string) => {
    if (isTestOutlet(row.outlet_id) || !row.outlet_id) return
    const cat = mapCat(row.category)
    if (!opexMap.has(row.outlet_id)) opexMap.set(row.outlet_id, new Map())
    const cur = opexMap.get(row.outlet_id)!.get(cat) || 0
    opexMap.get(row.outlet_id)!.set(cat, cur + Number(row.amount))
  }

  expenseRows.forEach(r => processExpense(r, c => c || 'Lainnya'))
  pettyCashRows.forEach(r => processExpense(r, c => {
    if (c === 'bb') return 'bahan_baku'
    if (c === 'outlet' || c === 'operasional') return 'pengeluaran_outlet'
    if (c === 'utilities') return 'utilitas'
    return c || 'Lainnya'
  }))

  // 30 hari ≈ 31.800 baris di sini (outlet × menu × tanggal) = ~32 halaman.
  // Loop sebelumnya memakai ulang satu builder tanpa `ORDER BY`; tanpa urutan
  // yang stabil, baris bisa terlewat ATAU tercatat dua kali antar-halaman —
  // dan pada 32 halaman itu hampir pasti terjadi. Kesalahan semacam ini lebih
  // sulit terdeteksi daripada sekadar terpotong, karena totalnya bisa naik
  // maupun turun tanpa pola.
  const omzetMap = new Map<string, Map<string, number>>()
  const buildOmzetQuery = () => {
    let b = supabase.from('menu_sales_scoped')
      .select('outlet_id, menu_name, revenue')
      .neq('outlet_id', TEST_OUTLET_ID)
      .gte('sales_date', filter.from)
      .lte('sales_date', filter.to)
      // `sales_source` wajib ikut: tanpa itu masih ada 45 baris kembar dan
      // paginasi bisa menggandakan/melewatkan baris di batas halaman.
      .order('sales_date', { ascending: true })
      .order('outlet_id', { ascending: true })
      .order('menu_name', { ascending: true })
      .order('sales_source', { ascending: true })
    if (filter.outletId !== 'all') b = b.eq('outlet_id', filter.outletId)
    return b
  }

  for (const r of await fetchAllPages<any>(buildOmzetQuery)) {
    if (isTestOutlet(r.outlet_id)) continue
    const cleanName = (r.menu_name || 'Unknown Menu').split('|')[0].trim()
    if (!omzetMap.has(r.outlet_id)) omzetMap.set(r.outlet_id, new Map())
    const cur = omzetMap.get(r.outlet_id)!.get(cleanName) || 0
    omzetMap.get(r.outlet_id)!.set(cleanName, cur + Number(r.revenue))
  }

  const wasteMap = new Map<string, Map<string, number>>()
  let qWaste = supabase.from('stok_waste_reports').select('outlet_id, qty, status, bahan_baku(kategori, harga_beli)').neq('outlet_id', TEST_OUTLET_ID).eq('status', 'approved').gte('tanggal', filter.from).lte('tanggal', filter.to)
  if (filter.outletId !== 'all') qWaste = qWaste.eq('outlet_id', filter.outletId)
  
  const { data: wasteData } = await qWaste
  wasteData?.forEach((w: any) => {
    if (isTestOutlet(w.outlet_id)) return
    const cat = w.bahan_baku?.kategori || 'Uncategorized'
    const val = Number(w.qty) * Number(w.bahan_baku?.harga_beli || 0)
    if (!wasteMap.has(w.outlet_id)) wasteMap.set(w.outlet_id, new Map())
    const cur = wasteMap.get(w.outlet_id)!.get(cat) || 0
    wasteMap.get(w.outlet_id)!.set(cat, cur + val)
  })

  const allOutlets = new Set([...opexMap.keys(), ...omzetMap.keys(), ...wasteMap.keys()])
  const result: OutletBreakdownDetails[] = []
  
  for (const outlet_id of allOutlets) {
    const formatMap = (m?: Map<string, number>) => {
      if (!m) return []
      return Array.from(m.entries())
        .map(([name, amount]) => ({ name, amount }))
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 5) 
    }

    result.push({
      outlet_id,
      omzet_breakdown: formatMap(omzetMap.get(outlet_id)),
      waste_breakdown: formatMap(wasteMap.get(outlet_id)),
      opex_breakdown: formatMap(opexMap.get(outlet_id))
    })
  }

  return result
}
