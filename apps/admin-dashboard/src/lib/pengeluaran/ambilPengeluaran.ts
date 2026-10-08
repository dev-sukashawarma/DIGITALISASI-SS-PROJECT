import type { SupabaseClient } from '@supabase/supabase-js'
import { isTestOutlet, TEST_OUTLET_ID } from '@/lib/outletFilters'

export interface FilterPengeluaran {
  from: string
  to: string
  outletId: string
  source?: string
}

/**
 * Query mentah halaman Pengeluaran (`expenses` + `petty_cash_expenses`),
 * berhalaman sampai habis. Satu sumber untuk getExpensesAction dan Bot CEO.
 * Melempar error bila query gagal. Pemanggil yang memeriksa hak akses.
 */
export async function ambilPengeluaranMentah(
  supabase: SupabaseClient,
  filter: FilterPengeluaran,
): Promise<{ expenses: any[]; pettyCashExpenses: any[] }> {
  const PAGE_SIZE = 1000

  const buildExpensesQuery = () => {
    let q = supabase
      .from('expenses')
      .select('id, outlet_id, category, amount, description, expense_date, period_month, receipt_url, type, outlets(name)')
      .eq('type', 'expense')
      .gte('expense_date', filter.from)
      .lte('expense_date', filter.to)
      .order('expense_date', { ascending: false })
      .order('id', { ascending: false })

    if (filter.outletId && filter.outletId !== 'all') {
      if (filter.outletId === 'PUSAT') {
        q = q.or('outlet_id.is.null,outlet_id.eq.ffffffff-ffff-ffff-ffff-ffffffffffff')
      } else {
        q = q.eq('outlet_id', filter.outletId)
      }
    } else {
      q = q.or(`outlet_id.is.null,outlet_id.neq.${TEST_OUTLET_ID}`)
    }

    return q
  }

  const buildPettyCashQuery = () => {
    let q = supabase
      .from('petty_cash_expenses')
      .select('id, outlet_id, category, amount, description, expense_date, receipt_url, type, outlets(name)')
      .neq('outlet_id', TEST_OUTLET_ID)
      .is('deleted_at', null)
      .in('category', [
        'bahan_baku', 'pengeluaran_outlet', 'operasional', 'utilitas', 'lainnya', 'bb', 'outlet', 'utilities',
        'transport', 'pln', 'pdam', 'internet', 'lembur', 'endorsement'
      ])
      .gte('expense_date', filter.from)
      .lte('expense_date', filter.to)
      .order('expense_date', { ascending: false })
      .order('id', { ascending: false })

    if (filter.outletId && filter.outletId !== 'all') {
      if (filter.outletId === 'PUSAT') {
        q = q.eq('outlet_id', '00000000-0000-0000-0000-000000000000')
      } else {
        q = q.eq('outlet_id', filter.outletId)
      }
    }

    return q
  }

  const fetchExpenses = async () => {
    if (filter.source === 'petty_cash') return []
    const all: any[] = []
    for (let offset = 0; ; offset += PAGE_SIZE) {
      const { data, error } = await buildExpensesQuery().range(offset, offset + PAGE_SIZE - 1)
      if (error) throw error
      const page = data ?? []
      all.push(...page)
      if (page.length < PAGE_SIZE) break
    }
    return all
  }

  const fetchPettyCash = async () => {
    if (filter.source === 'monthly' || filter.outletId === 'PUSAT') return []
    const all: any[] = []
    for (let offset = 0; ; offset += PAGE_SIZE) {
      const { data, error } = await buildPettyCashQuery().range(offset, offset + PAGE_SIZE - 1)
      if (error) throw error
      const page = data ?? []
      all.push(...page)
      if (page.length < PAGE_SIZE) break
    }
    return all
  }

  const [allExpenses, allPettyCash] = await Promise.all([
    fetchExpenses(),
    fetchPettyCash(),
  ])

  return {
    expenses: (allExpenses ?? []).filter((e: any) => !e.outlet_id || (!isTestOutlet(e.outlet_id) && e.outlet_id !== TEST_OUTLET_ID)),
    pettyCashExpenses: (allPettyCash ?? []).filter((p: any) => !p.outlet_id || (!isTestOutlet(p.outlet_id) && p.outlet_id !== TEST_OUTLET_ID)),
  }
}
