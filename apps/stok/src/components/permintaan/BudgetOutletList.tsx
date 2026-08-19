'use client'
import { useState } from 'react'
import { useOutletBudgetAdmin } from '@/hooks/useOutletBudget'
import type { PeriodType } from '@/lib/stok/budget'

const PERIOD_OPTIONS: { value: PeriodType; label: string }[] = [
  { value: 'harian', label: 'Harian' },
  { value: 'mingguan', label: 'Mingguan' },
  { value: 'bulanan', label: 'Bulanan' },
]

export function BudgetOutletList() {
  const { budgets, loading, error, save } = useOutletBudgetAdmin()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [nominalInput, setNominalInput] = useState('')
  const [periodInput, setPeriodInput] = useState<PeriodType>('bulanan')
  const [busy, setBusy] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  function startEdit(outletId: string, currentNominal: number, currentPeriod: PeriodType | null) {
    setEditingId(outletId)
    setNominalInput(currentNominal > 0 ? String(currentNominal) : '')
    setPeriodInput(currentPeriod ?? 'bulanan')
    setSaveError(null)
  }

  async function handleSave(outletId: string) {
    const nominal = Number(nominalInput)
    if (!Number.isFinite(nominal) || nominal < 0) {
      setSaveError('Nominal harus angka positif.')
      return
    }
    setBusy(true)
    setSaveError(null)
    try {
      await save(outletId, nominal, periodInput)
      setEditingId(null)
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <p className="text-xs text-[#544437]/60">Memuat…</p>
  if (error) return <p className="text-xs text-[#ba1a1a]">{error}</p>

  return (
    <div className="space-y-3">
      {budgets.map(b => (
        <div key={b.outletId} className="bg-white border border-[#d9c2b2]/40 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <h3 className="font-bold text-[#701604] text-sm truncate">{b.outletName}</h3>
              {b.hasConfig ? (
                <>
                  <p className="text-xs text-[#544437] mt-0.5">
                    Rp {b.nominal.toLocaleString('id-ID')} / {PERIOD_OPTIONS.find(p => p.value === b.periodType)?.label ?? b.periodType}
                  </p>
                  <div className="w-full h-1.5 bg-[#f5ede3] rounded-full mt-2 overflow-hidden">
                    <div
                      className="h-full bg-[#f29744]"
                      style={{ width: `${Math.min(100, b.nominal > 0 ? (b.terpakai / b.nominal) * 100 : 0)}%` }}
                    />
                  </div>
                  <p className="text-[10px] text-[#544437]/70 mt-1">
                    Terpakai Rp {b.terpakai.toLocaleString('id-ID')} — Sisa Rp {b.sisa.toLocaleString('id-ID')}
                  </p>
                </>
              ) : (
                <p className="text-xs text-[#544437]/60 mt-0.5">Belum diset</p>
              )}
            </div>
            <button
              onClick={() => startEdit(b.outletId, b.nominal, b.periodType)}
              className="shrink-0 text-xs font-bold text-[#f29744] border border-[#f29744]/40 rounded-lg px-3 py-1.5 hover:bg-orange-50 transition-colors"
            >
              Atur
            </button>
          </div>

          {editingId === b.outletId && (
            <div className="mt-3 pt-3 border-t border-[#d9c2b2]/30 space-y-2">
              <input
                type="number"
                min="0"
                placeholder="Nominal budget (Rp)"
                value={nominalInput}
                onChange={e => setNominalInput(e.target.value)}
                className="w-full border border-[#d9c2b2] rounded-lg px-3 py-2 text-sm"
              />
              <div className="flex gap-2">
                {PERIOD_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => setPeriodInput(opt.value)}
                    className={`flex-1 text-xs font-bold py-2 rounded-lg border transition-colors ${
                      periodInput === opt.value
                        ? 'bg-[#f29744] text-white border-[#f29744]'
                        : 'bg-white text-[#544437] border-[#d9c2b2]'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              {saveError && <p className="text-[11px] font-bold text-[#ba1a1a]">{saveError}</p>}
              <div className="flex gap-2">
                <button
                  onClick={() => setEditingId(null)}
                  disabled={busy}
                  className="flex-1 text-xs font-bold text-[#544437] border border-[#d9c2b2] rounded-lg py-2"
                >
                  Batal
                </button>
                <button
                  onClick={() => handleSave(b.outletId)}
                  disabled={busy}
                  className="flex-1 text-xs font-bold text-white bg-[#701604] rounded-lg py-2 disabled:opacity-50"
                >
                  {busy ? 'Menyimpan…' : 'Simpan'}
                </button>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
