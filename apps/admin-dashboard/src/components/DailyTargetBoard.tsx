'use client'
import { useMemo, useState, useEffect } from 'react'
import { useTargetProgress } from '@/hooks/useTargetProgress'
import { rupiahCompact } from '@/lib/format'
import { Target, Trophy, Radio, Edit3, X, Save, Trash2, Loader2, CheckCircle2, ChevronLeft, ChevronRight } from 'lucide-react'
import { createSupabaseBrowserClient } from '@suka/auth'
import { useRole } from '@/components/layout/RoleContext'

function cleanName(name: string) {
  return name.replace('SUKA SHAWARMA ', '').replace('MITRA SUKA ', 'MITRA ')
}

export function DailyTargetBoard() {
  const { rows, loading, refetch } = useTargetProgress()
  const supabase = createSupabaseBrowserClient()
  const { isReadOnly } = useRole()

  // Modal states
  const [modalOpen, setModalOpen] = useState(false)
  const [targetScope, setTargetScope] = useState<string>('global')
  const [currentTarget, setCurrentTarget] = useState<number>(0)
  const [targetInput, setTargetInput] = useState<string>('')
  const [savingKey, setSavingKey] = useState<string | null>(null)
  const [savedKey, setSavedKey] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 6

  const loadTarget = async (scope: string) => {
    let query = supabase
      .from('daily_sales_targets')
      .select('target_amount')
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
    setCurrentTarget(val)
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
    const { error } = await supabase.rpc('set_daily_target', { p_outlet: outletId, p_amount: amount })
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
      const { error } = await supabase.rpc('set_daily_target', { p_outlet: null, p_amount: 0 })
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

  const withTarget = useMemo(
    () =>
      rows
        .filter((r) => r.target_amount > 0)
        .map((r) => ({ ...r, pct: r.target_amount > 0 ? (r.omzet_today / r.target_amount) * 100 : 0 }))
        .sort((a, b) => b.pct - a.pct),
    [rows]
  )

  const achieved = withTarget.filter((r) => r.pct >= 100).length
  
  const totalPages = Math.ceil(withTarget.length / itemsPerPage)
  const paginatedItems = withTarget.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)

  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(totalPages)
    }
  }, [totalPages, currentPage])

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
      <div className="bg-white p-5 sm:p-6 rounded-2xl border border-suka-gray-200 shadow-sm relative">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
          <div className="flex items-center gap-2">
            <Target className="w-4 h-4 text-suka-orange" />
            <h3 className="font-extrabold text-suka-brown text-sm tracking-tight uppercase">Target Penjualan Hari Ini</h3>
            {withTarget.length > 0 && (
              <span className="flex items-center gap-1 text-[9px] font-bold text-suka-green bg-suka-green/10 px-2 py-0.5 rounded-full uppercase">
                <Radio className="w-2.5 h-2.5" /> Live
              </span>
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
              {paginatedItems.map((r) => {
                const pct = r.pct
                const pctClamped = Math.min(pct, 100)
                const isGreen = pct >= 100
                const isYellow = pct >= 30 && pct < 100
                
                const colorText = isGreen ? 'text-suka-green' : isYellow ? 'text-suka-orange' : 'text-red-500'
                const colorBg = isGreen ? 'bg-suka-green' : isYellow ? 'bg-suka-orange' : 'bg-red-500'
                const cardStyle = isGreen 
                  ? 'border-suka-green/30 bg-suka-green/5' 
                  : isYellow 
                    ? 'border-suka-orange/30 bg-suka-orange/5' 
                    : 'border-red-500/30 bg-red-500/5'

                return (
                  <div
                    key={r.outlet_id}
                    onClick={() => {
                      if (isReadOnly) return
                      setTargetScope(r.outlet_id)
                      setModalOpen(true)
                    }}
                    className={`rounded-xl border p-3 transition-all cursor-pointer hover:shadow-md ${cardStyle}`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-1.5 truncate">
                        <div className="relative flex items-center justify-center w-3 h-3 shrink-0 ml-0.5 mr-1">
                          <div className={`absolute inset-0 rounded-full blur-[3px] opacity-60 ${colorBg} ${isGreen ? '' : isYellow ? 'animate-pulse' : 'animate-blink-fast'}`}></div>
                          <div className={`relative w-2 h-2 rounded-full ${colorBg} shadow-sm ${isGreen ? '' : isYellow ? 'animate-pulse' : 'animate-blink-fast'}`}></div>
                        </div>
                        <span className="text-xs font-extrabold text-suka-ink truncate">{cleanName(r.outlet_name)}</span>
                      </div>
                      <span className={`text-xs font-extrabold shrink-0 ${colorText}`}>
                        {Math.round(r.pct)}%
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-suka-gray-200/70 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-700 ${colorBg}`}
                        style={{ width: `${pctClamped}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between mt-1.5 text-[10px] font-bold text-suka-gray-500">
                      <span className={colorText}>{rupiahCompact(r.omzet_today)}</span>
                      <span>/ {rupiahCompact(r.target_amount)}</span>
                    </div>
                  </div>
                )
              })}
            </div>
            
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-4 pt-3 border-t border-suka-gray-100">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-suka-gray-500 hover:text-suka-brown disabled:opacity-30 disabled:hover:text-suka-gray-500 transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" /> Prev
                </button>
                <span className="text-xs font-bold text-suka-gray-400">
                  Hal {currentPage} dari {totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-suka-gray-500 hover:text-suka-brown disabled:opacity-30 disabled:hover:text-suka-gray-500 transition-colors"
                >
                  Next <ChevronRight className="w-4 h-4" />
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
                {rows.map(r => (
                  <option key={r.outlet_id} value={r.outlet_id}>{cleanName(r.outlet_name)}</option>
                ))}
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
    </>
  )
}
