'use server'

import { headers } from 'next/headers'
import { parseStaffHeader, STAFF_HEADER } from '@suka/auth'
import { getServiceSupabase } from '@/lib/supabase-service'
import { isTestOutlet, TEST_OUTLET_ID } from '@/lib/outletFilters'
import { SENSITIVE_SALARY_CATEGORIES } from '@/lib/expenseCategories'

export interface FilterPengeluaran {
  from: string
  to: string
  outletId: string
  source?: string
}

const KANTOR_PUSAT_UUID = 'ffffffff-ffff-ffff-ffff-ffffffffffff'

export async function getExpensesAction(filter: FilterPengeluaran) {
  try {
    const headersList = await headers()
    const staff = parseStaffHeader(headersList.get(STAFF_HEADER))
    const supabase = getServiceSupabase()

    // 1. Tentukan outlet yang diizinkan untuk staff saat ini
    let accessibleOutletIds: string[] | null = null

    if (staff?.role === 'area_manager') {
      const { data: so } = await supabase
        .from('staff_outlets')
        .select('outlet_id')
        .eq('staff_id', staff.id)

      const assigned = [
        ...((so || []).map((s: any) => s.outlet_id)),
        ...(staff.outlet_id ? [staff.outlet_id] : [])
      ].filter((id) => id && id !== TEST_OUTLET_ID)

      accessibleOutletIds = Array.from(new Set(assigned))
      if (accessibleOutletIds.length === 0) {
        accessibleOutletIds = ['00000000-0000-0000-0000-000000000000']
      }
    }

    // 2. Filter target outlet berdasarkan parameter & wewenang
    // Penting: Kantor Pusat (outlet_id IS NULL atau PUSAT) TIDAK DIIZINKAN untuk Manager
    let targetOutletFilter: { mode: 'single' | 'in'; ids: string[] }

    if (filter.outletId && filter.outletId !== 'all' && filter.outletId !== 'ALL_OUTLETS') {
      if (filter.outletId === 'PUSAT' || filter.outletId === KANTOR_PUSAT_UUID) {
        return { success: true, expenses: [], pettyCashExpenses: [] }
      }

      if (accessibleOutletIds && !accessibleOutletIds.includes(filter.outletId)) {
        return { success: true, expenses: [], pettyCashExpenses: [] }
      }

      targetOutletFilter = { mode: 'single', ids: [filter.outletId] }
    } else {
      if (accessibleOutletIds) {
        targetOutletFilter = { mode: 'in', ids: accessibleOutletIds }
      } else {
        // RM / Admin / Owner melihat semua outlet fisik cabang (non-test, non-pusat)
        targetOutletFilter = { mode: 'in', ids: [] }
      }
    }

    const PAGE_SIZE = 1000
    const sensitiveCategoriesStr = `(${SENSITIVE_SALARY_CATEGORIES.join(',')})`

    // 3. Query Expenses (Khusus beban operasional cabang, Tanpa Gaji/Payroll & Tanpa Pusat)
    const buildExpensesQuery = () => {
      let q = supabase
        .from('expenses')
        .select('id, outlet_id, category, amount, description, expense_date, period_month, receipt_url, type, outlets(name), created_by, outlet_staff:created_by(name)')
        .eq('type', 'expense')
        .gte('expense_date', filter.from)
        .lte('expense_date', filter.to)
        .not('outlet_id', 'is', null)
        .neq('outlet_id', KANTOR_PUSAT_UUID)
        .neq('outlet_id', TEST_OUTLET_ID)
        .not('category', 'in', sensitiveCategoriesStr) // Proteksi: Gaji/Payroll tidak dikembalikan
        .order('expense_date', { ascending: false })
        .order('id', { ascending: false })

      if (targetOutletFilter.mode === 'single') {
        q = q.eq('outlet_id', targetOutletFilter.ids[0])
      } else if (targetOutletFilter.ids.length > 0) {
        q = q.in('outlet_id', targetOutletFilter.ids)
      }

      return q
    }

    // 4. Query Petty Cash Expenses
    const buildPettyCashQuery = () => {
      let q = supabase
        .from('petty_cash_expenses')
        .select('id, outlet_id, category, amount, description, expense_date, receipt_url, type, outlets(name), created_by, outlet_staff:created_by(name)')
        .not('outlet_id', 'is', null)
        .neq('outlet_id', KANTOR_PUSAT_UUID)
        .neq('outlet_id', '00000000-0000-0000-0000-000000000000')
        .neq('outlet_id', TEST_OUTLET_ID)
        .is('deleted_at', null)
        .not('category', 'in', sensitiveCategoriesStr)
        .in('category', [
          'bahan_baku', 'pengeluaran_outlet', 'operasional', 'utilitas', 'lainnya', 'bb', 'outlet', 'utilities',
          'transport', 'pln', 'pdam', 'internet', 'lembur', 'endorsement'
        ])
        .gte('expense_date', filter.from)
        .lte('expense_date', filter.to)
        .order('expense_date', { ascending: false })
        .order('id', { ascending: false })

      if (targetOutletFilter.mode === 'single') {
        q = q.eq('outlet_id', targetOutletFilter.ids[0])
      } else if (targetOutletFilter.ids.length > 0) {
        q = q.in('outlet_id', targetOutletFilter.ids)
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
      if (filter.source === 'monthly') return []
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

    const [expenses, pettyCashExpenses] = await Promise.all([
      fetchExpenses(),
      fetchPettyCash(),
    ])

    return {
      success: true,
      expenses,
      pettyCashExpenses,
    }
  } catch (err: any) {
    console.error('Error in getExpensesAction (manager):', err)
    return {
      success: false,
      error: err?.message || 'Gagal memuat data pengeluaran',
      expenses: [],
      pettyCashExpenses: [],
    }
  }
}
