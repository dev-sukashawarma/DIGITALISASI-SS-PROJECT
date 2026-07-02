'use client'

import { useMemo, useState, useEffect } from 'react'
import { useOutlets } from '@/hooks/useOutlets'
import { useExpenses } from '@/hooks/useExpenses'
import { useUpsertExpenses } from '@/hooks/useUpsertExpenses'
import { useRole } from '@/components/layout/RoleContext'
import { OUTLET_CATEGORIES, PUSAT_CATEGORIES, CATEGORY_META, type ExpenseCategory } from '@/lib/expenseCategories'
import type { PeriodFilterValue } from '@/lib/types'
import { rupiah } from '@/lib/format'

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
  }, [rows, target, month]) // eslint-disable-line react-hooks/exhaustive-deps

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

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="bg-white p-4 rounded-2xl border border-suka-gray-200 shadow-sm">
        <h2 className="text-xl font-extrabold text-suka-brown tracking-tight">Input Pengeluaran (Rekap Bulanan)</h2>
        <p className="text-xs text-suka-gray-500 font-medium">Isi/koreksi rekap bulanan per outlet atau pusat. Menyimpan menimpa nilai bulan yang sama.</p>
        <div className="flex flex-wrap gap-3 mt-3">
          <input type="month" value={month} onChange={e => setMonth(e.target.value)}
            className="border border-suka-gray-200 rounded-lg px-3 py-2 text-sm" />
          <select value={target} onChange={e => setTarget(e.target.value)}
            className="border border-suka-gray-200 rounded-lg px-3 py-2 text-sm flex-1 min-w-[12rem]">
            <option value="">— Pilih target —</option>
            {isOwner && <option value="PUSAT">🏢 Pengeluaran Pusat (company-wide)</option>}
            {outlets.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
        </div>
      </div>

      {target && (
        <div className="bg-white p-4 rounded-2xl border border-suka-gray-200 shadow-sm space-y-2">
          {categories.map(c => (
            <label key={c} className="flex items-center justify-between gap-3">
              <span className="text-sm font-medium text-suka-ink">{CATEGORY_META[c].label}</span>
              <input type="number" min={0} value={amounts[c] ?? ''}
                onChange={e => setAmounts(a => ({ ...a, [c]: e.target.value }))}
                className="border border-suka-gray-200 rounded-lg px-3 py-1.5 text-sm text-right w-44" placeholder="0" />
            </label>
          ))}
          <div className="flex items-center justify-between pt-2 border-t border-suka-gray-100">
            <span className="text-sm font-bold text-suka-brown uppercase tracking-wider">Total</span>
            <span className="text-sm font-extrabold text-suka-brown">{rupiah(runningTotal)}</span>
          </div>
          <button disabled={!canSubmit || upsert.isPending} onClick={handleSave}
            className="mt-2 w-full bg-suka-orange text-white font-bold rounded-lg py-2 disabled:opacity-50">
            {upsert.isPending ? 'Menyimpan…' : 'Simpan Rekap'}
          </button>
          {upsert.isError && <p className="text-red-600 text-sm">{(upsert.error as Error).message}</p>}
          {upsert.isSuccess && <p className="text-suka-green text-sm">Tersimpan · Total {rupiah(runningTotal)}</p>}
        </div>
      )}
    </div>
  )
}
