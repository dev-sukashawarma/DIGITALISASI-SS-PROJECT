// @ts-nocheck
'use client'
import { useMemo, useState, useEffect } from 'react'
import { useTargetProgress } from '@/hooks/useTargetProgress'
import { rupiahCompact } from '@/lib/format'
import { Target, Trophy, Radio, Edit3, X, Save, Trash2, Loader2, CheckCircle2, ChevronLeft, ChevronRight } from 'lucide-react'
import { createSupabaseBrowserClient } from '@suka/auth'
import { useRole } from '@/components/layout/RoleContext'
import { OutletCombobox } from '@/components/OutletCombobox'
import type { PeriodFilterValue, SalesSummaryRow } from '@/lib/types'

import { User } from '@/lib/types'

interface DailyTargetBoardProps {
  filter?: PeriodFilterValue;
  kpiRows?: SalesSummaryRow[];
}

export function DailyTargetBoard({ filter, kpiRows }: DailyTargetBoardProps = {}) {
  const { rows, loading, refetch } = useTargetProgress(filter?.from, filter?.to)
  const supabase = createSupabaseBrowserClient()
  const { isReadOnly } = useRole()

  // Modal states
  const [modalOpen, setModalOpen] = useState(false)
  const [targetScope, setTargetScope] = useState<string>('global')
  const [currentTarget, setCurrentTarget] = useState<number>(0)
  const [currentBonus, setCurrentBonus] = useState<number>(0)
  const [targetInput, setTargetInput] = useState<string>('')
  const [savingKey, setSavingKey] = useState<string | null>(null)
  const [savedKey, setSavedKey] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  
  // Show More Toggle
  const [showAll, setShowAll] = useState(false)
  const previewCount = 3

  // Local Filter
  const [localOutletFilter, setLocalOutletFilter] = useState<string>('all')

  const loadTarget = async (scope: string) => {
    let query = supabase
      .from('daily_sales_targets')
      .select('target_amount, per_item_bonus')
      .order('effective_from', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(1)

    if (scope === 'global') {
      query = query.is('outlet_id', null)
    } else {
      query = query.eq('outlet_id', scope)
    }
    
    const { data } = await query.maybeSingle()
    const val = data?.target_amount ? Number(data.target_amount) : 0
    const bonusVal = data?.per_item_bonus ? Number(data.per_item_bonus) : 0
    setCurrentTarget(val)
    setCurrentBonus(bonusVal)
    setTargetInput(val ? val.toString() : '')
  }

  useEffect(() => {
    if (modalOpen) loadTarget(targetScope)
  }, [modalOpen, targetScope, supabase])

  const flashSaved = (key: string) => {
    setSavedKey(key)
    setTimeout(() => setSavedKey((k) => (k === key ? null : k)), 1800)
  }

  const saveTarget = async () => {
    const amount = Number(targetInput.replace(/\D/g, ''))
    if (!Number.isFinite(amount) || amount <= 0) return
    setSavingKey('save')
    setError(null)
    const outletId = targetScope === 'global' ? null : targetScope
    const { error } = await supabase.rpc('set_daily_target', { p_outlet: outletId, p_amount: amount, p_per_item_bonus: currentBonus })
    setSavingKey(null)
    if (error) return setError(error.message)
    flashSaved('save')
    await loadTarget(targetScope)
    await refetch()
    setTimeout(() => setModalOpen(false), 1000)
  }

  const deleteTarget = async () => {
    setSavingKey('delete')
    setError(null)
    if (targetScope === 'global') {
      const { error } = await supabase.rpc('set_daily_target', { p_outlet: null, p_amount: 0, p_per_item_bonus: 0 })
      setSavingKey(null)
      if (error) return setError(error.message)
    } else {
      const { error } = await supabase.rpc('clear_daily_target_override', { p_outlet: targetScope })
      setSavingKey(null)
      if (error) return setError(error.message)
    }
    flashSaved('delete')
    await loadTarget(targetScope)
    await refetch()
    setTimeout(() => setModalOpen(false), 1000)
  }

  const isMoreThanOneDay = filter && filter.from !== filter.to;

  const withTarget = useMemo(() => {
    let baseRows = rows;
    
    if (filter && filter.outletId !== 'all') {
      baseRows = baseRows.filter(r => r.outlet_id === filter.outletId);
    } else if (isMoreThanOneDay && localOutletFilter !== 'all') {
      baseRows = baseRows.filter(r => r.outlet_id === localOutletFilter);
    }

    const mergedRows = baseRows.map(r => {
      let currentOmzet = r.omzet_today;
      if (!isMoreThanOneDay && kpiRows) {
        const outletKpiRows = kpiRows.filter(k => k.outlet_id === r.outlet_id);
        if (outletKpiRows.length > 0) {
          currentOmzet = outletKpiRows.reduce((sum, k) => sum + k.omzet, 0);
        } else if (filter) {
          currentOmzet = 0;
        }
      }
      return {
        ...r,
        omzet_today: currentOmzet
      };
    });

    return mergedRows
      .filter((r) => r.target_amount > 0)
      .map((r) => ({ ...r, pct: r.target_amount > 0 ? (r.omzet_today / r.target_amount) * 100 : 0 }))
      .sort((a, b) => {
        if (isMoreThanOneDay && a.date_value && b.date_value) {
          const dateDiff = new Date(b.date_value).getTime() - new Date(a.date_value).getTime();
          if (dateDiff !== 0) return dateDiff;
        }
        return b.pct - a.pct;
      });
  }, [rows, filter, kpiRows, isMoreThanOneDay, localOutletFilter])

  const achieved = withTarget.filter((r) => r.pct >= 100).length
  
  const displayedItems = showAll ? withTarget : withTarget.slice(0, previewCount)
  const hasMore = withTarget.length > previewCount


  if (loading) {
    return (
      <div className="bg-white p-6 rounded-2xl border border-suka-gray-200 shadow-sm">
        <div className="h-5 w-48 bg-suka-gray-100 rounded animate-pulse mb-4" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {[0, 1, 2].map((i) => <div key={i} className="h-16 bg-suka-gray-50 rounded-xl animate-pulse" />)}
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="bg-white/60 backdrop-blur-xl p-5 sm:p-6 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] relative">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
          <div className="flex items-center gap-2">
            <Target className="w-4 h-4 text-suka-orange" />
            <h3 className="font-extrabold text-suka-brown text-sm tracking-tight uppercase">Target Penjualan {isMoreThanOneDay ? 'Harian' : 'Hari Ini'}</h3>
            {withTarget.length > 0 && !isMoreThanOneDay && (
              <span className="flex items-center gap-1 text-[9px] font-bold text-suka-green bg-suka-green/10 px-2 py-0.5 rounded-full uppercase">
                <Radio className="w-2.5 h-2.5" /> Live
              </span>
            )}
            {isMoreThanOneDay && filter?.outletId === 'all' && (
              <div className="ml-2">
                <OutletCombobox
                  value={localOutletFilter}
                  outlets={Array.from(new Set(rows.map(r => r.outlet_id))).map(id => ({
                    id,
                    name: rows.find(r => r.outlet_id === id)?.outlet_name || 'Outlet'
                  }))}
                  onChange={(id) => {
                    setLocalOutletFilter(id);
                    setShowAll(false);
                  }}
                />
              </div>
            )}
          </div>
          
          <div className="flex items-center gap-2">
            {withTarget.length > 0 && (
              <span className="flex items-center gap-1.5 text-xs font-bold text-suka-brown bg-suka-cream px-3 py-1 rounded-full border border-suka-brown/5">
                <Trophy className="w-3.5 h-3.5 text-suka-orange" />
                {achieved}/{withTarget.length} tercapai
              </span>
            )}
            {!isReadOnly && (
              <button
                onClick={() => {
                  setTargetScope('global')
                  setModalOpen(true)
                }}
                className="flex items-center gap-1.5 px-3 py-1 bg-suka-cream/50 hover:bg-suka-cream border border-suka-brown/10 text-suka-brown rounded-lg text-xs font-bold transition-colors"
              >
                <Edit3 className="w-3.5 h-3.5" /> Set Target
              </button>
            )}
          </div>
        </div>

        {withTarget.length === 0 ? (
          <p className="text-sm text-suka-gray-400 mt-2">
            Belum ada target diatur. Klik tombol <b className="text-suka-brown">Set Target</b> di atas.
          </p>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {displayedItems.map((r, i) => {
                const pct = r.pct
                const pctClamped = Math.min(pct, 100)
                const isGreen = pct >= 100
                const isYellow = pct >= 30 && pct < 100
                
                const colorText = isGreen ? 'text-green-700' : isYellow ? 'text-amber-700' : 'text-rose-600'
                const dotBg = isGreen ? 'bg-green-500' : isYellow ? 'bg-amber-500' : 'bg-rose-500'
                const barGradient = isGreen ? 'bg-gradient-to-r from-green-400 to-green-500' : isYellow ? 'bg-gradient-to-r from-amber-400 to-orange-500' : 'bg-gradient-to-r from-rose-400 to-rose-500'

                return (
                  <div
                    key={`${r.outlet_id}-${r.date_value || i}`}
                    onClick={() => {
                      if (isReadOnly) return
                      setTargetScope(r.outlet_id)
                      setModalOpen(true)
                    }}
                    className="bg-white/80 backdrop-blur-md border border-white/60 p-3 rounded-2xl shadow-sm transition-all cursor-pointer hover:shadow-[0_8px_20px_rgb(0,0,0,0.06)] hover:-translate-y-1 group"
                  >
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-1.5 truncate">
                        <div className="relative flex items-center justify-center w-3 h-3 shrink-0 ml-0.5 mr-1">
                          <div className={`absolute inset-0 rounded-full blur-[3px] opacity-60 ${dotBg} ${isGreen ? '' : isYellow ? 'animate-pulse' : 'manual-blink-fast'}`}></div>
                          <div className={`relative w-2 h-2 rounded-full ${dotBg} shadow-sm ${isGreen ? '' : isYellow ? 'animate-pulse' : 'manual-blink-fast'}`}></div>
                        </div>
                        <span className="text-xs font-extrabold text-suka-ink truncate">
                          {r.outlet_name}
                          {isMoreThanOneDay && r.date_value && (
                            <span className="ml-1 text-[10px] font-medium text-suka-gray-500 whitespace-nowrap">
                              ({new Date(r.date_value).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })})
                            </span>
                          )}
                        </span>
                      </div>
                      <span className={`text-xs font-extrabold shrink-0 ${colorText}`}>
                        {Math.round(r.pct)}%
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-suka-gray-100/80 overflow-hidden shadow-inner">
                      <div
                        className={`h-full rounded-full transition-all duration-700 ${barGradient}`}
                        style={{ width: `${pctClamped}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between mt-2 text-[10px] font-bold text-suka-gray-500 whitespace-nowrap gap-1">
                      <span className={`${colorText} truncate`}>{rupiahCompact(r.omzet_today)}</span>
                      <span className="shrink-0 text-suka-gray-400">/ {rupiahCompact(r.target_amount)}</span>
                    </div>
                  </div>
                )
              })}
            </div>
            
            {hasMore && (
              <div className="flex justify-center mt-4 pt-3 border-t border-suka-gray-100">
                <button
                  onClick={() => setShowAll(!showAll)}
                  className="text-xs font-bold text-suka-orange hover:text-suka-brown transition-colors hover:underline px-4 py-2"
                >
                  {showAll ? 'Tampilkan Lebih Sedikit' : `Tampilkan Semua (${withTarget.length})`}
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setModalOpen(false)} />
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 relative shadow-xl animate-fade-in">
            <button
              onClick={() => setModalOpen(false)}
              className="absolute top-4 right-4 text-suka-gray-400 hover:text-suka-ink"
            >
              <X className="w-5 h-5" />
            </button>
            <h3 className="text-lg font-extrabold text-suka-brown mb-1">Set Target Penjualan</h3>
            <p className="text-xs text-suka-gray-500 font-medium mb-4">Ubah target penjualan (global atau per outlet).</p>

            {error && <div className="mb-4 p-3 bg-red-50 text-red-600 text-xs rounded-xl border border-red-100">{error}</div>}

            <div className="mb-3">
              <label className="block text-[11px] font-bold text-suka-gray-500 uppercase tracking-wider mb-2">Pilih Outlet</label>
              <select
                value={targetScope}
                onChange={(e) => setTargetScope(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl text-sm font-bold text-suka-ink bg-suka-cream/30 border border-suka-gray-200 outline-none focus:border-suka-orange focus:ring-2 focus:ring-suka-orange/10"
              >
                <option value="global">Semua Outlet (Default)</option>
                {Array.from(new Set(rows.map(r => r.outlet_id))).map(id => {
                  const name = rows.find(r => r.outlet_id === id)?.outlet_name;
                  return (
                    <option key={id} value={id}>{name}</option>
                  )
                })}
              </select>
            </div>

            <div className="mb-4">
              <label className="block text-[11px] font-bold text-suka-gray-500 uppercase tracking-wider mb-2">Target Baru (Rp)</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-suka-gray-400 text-sm font-bold">Rp</span>
                <input
                  inputMode="numeric"
                  value={targetInput ? Number(targetInput).toLocaleString('id-ID') : ''}
                  onChange={(e) => setTargetInput(e.target.value.replace(/\D/g, ''))}
                  placeholder={currentTarget ? currentTarget.toLocaleString('id-ID') : 'mis. 5.000.000'}
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl text-sm font-bold text-suka-ink bg-suka-cream/30 border border-suka-gray-200 outline-none focus:border-suka-orange focus:ring-2 focus:ring-suka-orange/10"
                />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <button
                onClick={saveTarget}
                disabled={savingKey !== null || !targetInput || targetInput === '0'}
                className="w-full flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-suka-orange hover:bg-amber-600 disabled:opacity-50 text-white font-bold text-sm transition-all"
              >
                {savingKey === 'save' ? <Loader2 className="w-4 h-4 animate-spin" /> : savedKey === 'save' ? <CheckCircle2 className="w-4 h-4" /> : <Save className="w-4 h-4" />}
                Simpan Target
              </button>
              <button
                onClick={deleteTarget}
                disabled={savingKey !== null || currentTarget === 0}
                className="w-full flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-50 font-bold text-sm transition-all"
              >
                {savingKey === 'delete' ? <Loader2 className="w-4 h-4 animate-spin" /> : savedKey === 'delete' ? <CheckCircle2 className="w-4 h-4" /> : <Trash2 className="w-4 h-4" />}
                Hapus Target
              </button>
            </div>
          </div>
        </div>
      )}
      <style>{`
        @keyframes manual-blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
        .manual-blink-fast {
          animation: manual-blink 1s ease-in-out infinite;
        }
      `}</style>
    </>
  )
}
