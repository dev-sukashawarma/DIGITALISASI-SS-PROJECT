'use server'

import { cookies } from 'next/headers'
import { createSupabaseServerClient } from '@suka/auth'
import type { PeriodFilterValue } from '@/lib/types'
import { isTestOutlet, TEST_OUTLET_ID } from '@/lib/outletFilters'

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
  
  let q1 = supabase.from('expenses').select('outlet_id, category, amount').neq('outlet_id', TEST_OUTLET_ID).gte('expense_date', filter.from).lte('expense_date', filter.to)
  let q2 = supabase.from('petty_cash_expenses').select('outlet_id, category, amount').neq('outlet_id', TEST_OUTLET_ID).in('category', ['bahan_baku', 'pengeluaran_outlet', 'operasional', 'utilitas', 'lainnya', 'bb', 'outlet', 'utilities']).gte('expense_date', filter.from).lte('expense_date', filter.to)

  if (filter.outletId !== 'all') {
    q1 = q1.eq('outlet_id', filter.outletId)
    q2 = q2.eq('outlet_id', filter.outletId)
  }

  const [resExp, resPc] = await Promise.all([q1, q2])

  const processExpense = (row: any, mapCat: (c: string) => string) => {
    if (isTestOutlet(row.outlet_id) || !row.outlet_id) return
    const cat = mapCat(row.category)
    if (!opexMap.has(row.outlet_id)) opexMap.set(row.outlet_id, new Map())
    const cur = opexMap.get(row.outlet_id)!.get(cat) || 0
    opexMap.get(row.outlet_id)!.set(cat, cur + Number(row.amount))
  }

  resExp.data?.forEach(r => processExpense(r, c => c || 'Lainnya'))
  resPc.data?.forEach(r => processExpense(r, c => {
    if (c === 'bb') return 'bahan_baku'
    if (c === 'outlet' || c === 'operasional') return 'pengeluaran_outlet'
    if (c === 'utilities') return 'utilitas'
    return c || 'Lainnya'
  }))

  const omzetMap = new Map<string, Map<string, number>>() 
  let qOmzet = supabase.from('menu_sales_scoped').select('outlet_id, menu_name, revenue').neq('outlet_id', TEST_OUTLET_ID).gte('sales_date', filter.from).lte('sales_date', filter.to)
  if (filter.outletId !== 'all') qOmzet = qOmzet.eq('outlet_id', filter.outletId)
  
  let offset = 0
  const PAGE_SIZE = 1000
  while (true) {
    const { data: page } = await qOmzet.range(offset, offset + PAGE_SIZE - 1)
    if (!page || page.length === 0) break
    for (const r of page) {
      if (isTestOutlet(r.outlet_id)) continue
      const cleanName = (r.menu_name || 'Unknown Menu').split('|')[0].trim()
      if (!omzetMap.has(r.outlet_id)) omzetMap.set(r.outlet_id, new Map())
      const cur = omzetMap.get(r.outlet_id)!.get(cleanName) || 0
      omzetMap.get(r.outlet_id)!.set(cleanName, cur + Number(r.revenue))
    }
    if (page.length < PAGE_SIZE) break
    offset += PAGE_SIZE
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
