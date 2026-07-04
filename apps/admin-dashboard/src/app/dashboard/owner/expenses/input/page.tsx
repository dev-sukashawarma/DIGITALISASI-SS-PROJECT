'use client'

import { useMemo, useState, useEffect } from 'react'
import { useOutlets } from '@/hooks/useOutlets'
import { useExpenses } from '@/hooks/useExpenses'
import { useUpsertExpenses } from '@/hooks/useUpsertExpenses'
import { useRole } from '@/components/layout/RoleContext'
import { OUTLET_CATEGORIES, PUSAT_CATEGORIES, CATEGORY_META, type ExpenseCategory } from '@/lib/expenseCategories'
import type { PeriodFilterValue } from '@/lib/types'
import { rupiah } from '@/lib/format'
import { Select } from '@/components/ui/Select'
import { AlertCircle, CheckCircle2 } from 'lucide-react'

function firstOfMonth(ym: string) { return `${ym}-01` }          // ym = 'YYYY-MM'
function lastOfMonth(ym: string) {
  const [y, m] = ym.split('-').map(Number)
  return new Date(y, m, 0).toISOString().slice(0, 10)             // last calendar day
}

export default function ExpenseInputPage() {
  const { data: outlets = [] } = useOutlets()
  const { role } = useRole()
  const isOwner = role === 'OWNER'

  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7)) // YYYY-MM
  const [target, setTarget] = useState<string>('')       // outletId | 'PUSAT'
  const isPusat = target === 'PUSAT'
  const periodMonth = firstOfMonth(month)

  // Muat nilai existing untuk bulan+target (pre-fill upsert).
  const filter = useMemo<PeriodFilterValue>(() => ({
    from: periodMonth,
    to: lastOfMonth(month),
    outletId: isPusat ? 'all' : (target || 'all'),
    source: 'all',
  }), [periodMonth, month, target, isPusat])
  const { rows } = useExpenses(filter)

  const categories: readonly ExpenseCategory[] = isPusat ? PUSAT_CATEGORIES : OUTLET_CATEGORIES
  const [amounts, setAmounts] = useState<Record<string, string>>({})

  useEffect(() => {
    const next: Record<string, string> = {}
    for (const c of categories) {
      const match = rows.find(r => r.category === c &&
        (isPusat ? r.outlet_id === null : r.outlet_id === target) &&
        r.period_month === periodMonth)
      next[c] = match ? String(match.amount) : ''
    }
    setAmounts(next)
  }, [rows, target, month, isPusat, categories, periodMonth])

  const upsert = useUpsertExpenses()
  const canSubmit = !!target && (!isPusat || isOwner)

  async function handleSave() {
    const items = categories
      .filter(c => amounts[c] !== '' && amounts[c] != null)
      .map(c => ({
        outletId: isPusat ? null : target,
        category: c,
        periodMonth,
        amount: Number(amounts[c]) || 0,
      }))
    await upsert.mutateAsync(items)
  }

  const runningTotal = categories.reduce((s, c) => s + (Number(amounts[c]) || 0), 0)

  const selectOptions = [
    ...(isOwner ? [{ label: '🏢 Pengeluaran Pusat (company-wide)', value: 'PUSAT' }] : []),
    ...outlets.map(o => ({ label: o.name, value: o.id }))
  ]

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="bg-white p-4 rounded-2xl border border-suka-gray-200 shadow-sm">
        <h2 className="text-xl font-extrabold text-suka-brown tracking-tight">Input Pengeluaran (Rekap Bulanan)</h2>
        <p className="text-xs text-suka-gray-500 font-medium">Isi/koreksi rekap bulanan per outlet atau pusat. Menyimpan menimpa nilai bulan yang sama.</p>
        <div className="flex flex-wrap gap-3 mt-3">
          <input type="month" value={month} onChange={e => setMonth(e.target.value)}
            className="border border-suka-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-suka-brown/20" />
          <Select 
            options={selectOptions}
            value={target}
            onChange={setTarget}
            placeholder="— Pilih target —"
            className="flex-1 min-w-[15rem]"
          />
        </div>
      </div>

      {target && (
        <div className="bg-white p-4 rounded-2xl border border-suka-gray-200 shadow-sm space-y-2">
          {categories.map(c => (
            <label key={c} className="flex items-center justify-between gap-3 group cursor-pointer p-2 hover:bg-suka-gray-50 rounded-lg transition-colors">
              <span className="text-sm font-medium text-suka-ink">{CATEGORY_META[c].label}</span>
              <input type="number" min={0} value={amounts[c] ?? ''}
                onChange={e => setAmounts(a => ({ ...a, [c]: e.target.value }))}
                className="border border-suka-gray-200 rounded-lg px-3 py-1.5 text-sm text-right w-44 focus:outline-none focus:ring-2 focus:ring-suka-brown/20 transition-shadow" placeholder="0" />
            </label>
          ))}
          <div className="flex items-center justify-between p-2 mt-2 border-t border-suka-gray-100">
            <span className="text-sm font-bold text-suka-brown uppercase tracking-wider">Total</span>
            <span className="text-sm font-extrabold text-suka-brown">{rupiah(runningTotal)}</span>
          </div>
          
          <button disabled={!canSubmit || upsert.isPending} onClick={handleSave}
            className="mt-4 w-full bg-suka-orange text-white font-bold rounded-lg py-3 hover:bg-suka-orange/90 active:scale-[0.99] transition-all disabled:opacity-50 disabled:active:scale-100 flex items-center justify-center gap-2">
            {upsert.isPending ? (
              <>
                <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Menyimpan...
              </>
            ) : 'Simpan Rekap'}
          </button>
          
          {upsert.isError && (
            <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-lg flex items-start gap-3 mt-4">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-bold">Gagal Menyimpan</p>
                <p className="text-xs mt-1">{(upsert.error as Error).message || 'Terjadi kesalahan sistem.'}</p>
              </div>
            </div>
          )}
          
          {upsert.isSuccess && (
            <div className="bg-green-50 border border-green-200 text-suka-green p-3 rounded-lg flex items-center gap-3 mt-4">
              <CheckCircle2 className="w-5 h-5 shrink-0" />
              <p className="text-sm font-bold">Data rekap berhasil disimpan!</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
