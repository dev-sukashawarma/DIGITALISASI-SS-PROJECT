'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Wallet, Pencil, Loader2 } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { useOutletBudgetAdmin } from '@/hooks/useOutletBudgetAdmin'
import type { PeriodType } from '@/app/actions/budgetOutlet'

const PERIOD_LABELS: Record<PeriodType, string> = {
  harian: 'Harian',
  mingguan: 'Mingguan',
  bulanan: 'Bulanan',
  custom: 'Custom',
}

const PERIOD_OPTIONS: PeriodType[] = ['harian', 'mingguan', 'bulanan', 'custom']

function formatRupiah(n: number): string {
  return `Rp ${Math.round(n).toLocaleString('id-ID')}`
}

function formatPeriodLabel(periodType: PeriodType | null, customDays: number | null): string {
  if (!periodType) return '-'
  if (periodType === 'custom' && customDays) return `Per ${customDays} Hari`
  return PERIOD_LABELS[periodType]
}

function EditForm({
  initialNominal,
  initialPeriod,
  initialCustomDays,
  onCancel,
  onSave,
}: {
  initialNominal: number
  initialPeriod: PeriodType
  initialCustomDays: number | null
  onCancel: () => void
  onSave: (nominal: number, periodType: PeriodType, customDays?: number | null) => Promise<void>
}) {
  const [nominal, setNominal] = useState(initialNominal > 0 ? String(initialNominal) : '')
  const [periodType, setPeriodType] = useState<PeriodType>(initialPeriod)
  const [customDays, setCustomDays] = useState<string>(
    initialCustomDays != null ? String(initialCustomDays) : ''
  )
  const [saving, setSaving] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)

  const handleSave = async () => {
    const parsed = Number(nominal)
    if (!Number.isFinite(parsed) || parsed < 0) {
      setLocalError('Nominal harus berupa angka 0 atau lebih')
      return
    }
    if (periodType === 'custom') {
      const parsedDays = Number(customDays)
      if (!Number.isInteger(parsedDays) || parsedDays < 1) {
        setLocalError('Jumlah hari custom harus berupa bilangan bulat minimal 1')
        return
      }
    }
    setLocalError(null)
    setSaving(true)
    try {
      const days = periodType === 'custom' ? Number(customDays) : null
      await onSave(parsed, periodType, days)
      toast.success('Budget outlet tersimpan')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gagal menyimpan budget')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mt-4 pt-4 border-t border-suka-gray-200 flex flex-col gap-3">
      <div>
        <label className="block text-xs font-semibold text-suka-ink/60 mb-1">Nominal Plafon (Rp)</label>
        <input
          type="number"
          min={0}
          value={nominal}
          onChange={(e) => setNominal(e.target.value)}
          placeholder="mis. 5000000"
          className="w-full border border-suka-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-suka-brown/20"
        />
      </div>

      <div>
        <label className="block text-xs font-semibold text-suka-ink/60 mb-1">Periode</label>
        <div className="grid grid-cols-2 gap-2">
          {PERIOD_OPTIONS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPeriodType(p)}
              className={`text-sm font-semibold rounded-lg px-3 py-2 border transition-colors ${
                periodType === p
                  ? 'bg-suka-orange/10 border-suka-orange text-suka-brown'
                  : 'bg-white border-suka-gray-200 text-suka-ink/60 hover:border-suka-gray-300'
              }`}
            >
              {PERIOD_LABELS[p]}
            </button>
          ))}
        </div>
      </div>

      {periodType === 'custom' && (
        <div>
          <label className="block text-xs font-semibold text-suka-ink/60 mb-1">
            Jumlah Hari (contoh: 3 = reset setiap 3 hari)
          </label>
          <input
            type="number"
            min={1}
            step={1}
            value={customDays}
            onChange={(e) => setCustomDays(e.target.value)}
            placeholder="mis. 3"
            className="w-full border border-suka-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-suka-brown/20"
          />
        </div>
      )}

      {localError && <p className="text-xs text-red-600 font-medium">{localError}</p>}

      <div className="flex gap-2 justify-end mt-1">
        <Button type="button" variant="secondary" onClick={onCancel} disabled={saving}>
          Batal
        </Button>
        <Button type="button" variant="primary" onClick={handleSave} disabled={saving}>
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
          Simpan
        </Button>
      </div>
    </div>
  )
}

export function BudgetOutletList() {
  const { budgets, loading, error, save } = useOutletBudgetAdmin()
  const [editingOutletId, setEditingOutletId] = useState<string | null>(null)

  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-40 rounded-2xl bg-white border border-suka-gray-200 animate-pulse" />
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 text-red-700 rounded-xl border border-red-100 text-sm">
        Gagal memuat data budget outlet: {error}
      </div>
    )
  }

  if (budgets.length === 0) {
    return (
      <Card>
        <p className="text-sm text-suka-ink/60">Belum ada outlet operasional yang terdeteksi.</p>
      </Card>
    )
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
      {budgets.map((b) => {
        const isEditing = editingOutletId === b.outletId
        const pct = b.hasConfig && b.nominal > 0 ? Math.min(100, (b.terpakai / b.nominal) * 100) : 0
        const isOver = b.hasConfig && b.terpakai > b.nominal

        return (
          <Card key={b.outletId} className={isEditing ? 'ring-2 ring-suka-orange/40' : ''}>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h3 className="font-bold text-suka-brown truncate">{b.outletName}</h3>
                {b.hasConfig ? (
                  <p className="text-xs text-suka-ink/60 mt-0.5">
                    {b.periodType ? formatPeriodLabel(b.periodType, b.customDays) : '-'}
                    {b.periodStart && b.periodEnd ? ` · ${b.periodStart} s/d ${b.periodEnd}` : ''}
                  </p>
                ) : (
                  <p className="text-xs text-suka-ink/40 mt-0.5 italic">Belum diset</p>
                )}
              </div>
              {!isEditing && (
                <Button
                  type="button"
                  variant="secondary"
                  className="!px-3 !py-2 text-xs shrink-0"
                  onClick={() => setEditingOutletId(b.outletId)}
                >
                  <Pencil className="w-3.5 h-3.5" />
                  Atur
                </Button>
              )}
            </div>

            {b.hasConfig ? (
              <div className="mt-4 space-y-1.5">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-suka-ink/60">Terpakai</span>
                  <span className={`font-semibold ${isOver ? 'text-red-600' : 'text-suka-ink'}`}>
                    {formatRupiah(b.terpakai)}
                  </span>
                </div>
                <div className="w-full h-2 bg-suka-gray-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${isOver ? 'bg-red-500' : 'bg-suka-orange'}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-xs text-suka-ink/50">
                  <span>Plafon {formatRupiah(b.nominal)}</span>
                  <span className={isOver ? 'text-red-600 font-semibold' : ''}>
                    {isOver ? `Lebih ${formatRupiah(b.terpakai - b.nominal)}` : `Sisa ${formatRupiah(b.sisa)}`}
                  </span>
                </div>
              </div>
            ) : (
              <div className="mt-4 flex items-center gap-2 text-suka-ink/40 text-sm">
                <Wallet className="w-4 h-4" />
                Plafon belum diatur untuk outlet ini
              </div>
            )}

            {isEditing && (
              <EditForm
                initialNominal={b.nominal}
                initialPeriod={b.periodType ?? 'bulanan'}
                initialCustomDays={b.customDays}
                onCancel={() => setEditingOutletId(null)}
                onSave={async (nominal, periodType, customDays) => {
                  await save(b.outletId, nominal, periodType, customDays)
                  setEditingOutletId(null)
                }}
              />
            )}
          </Card>
        )
      })}
    </div>
  )
}
