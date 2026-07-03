'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { createSupabaseBrowserClient } from '@suka/auth'
import { useRole } from '@/components/layout/RoleContext'
import { rupiah } from '@/lib/format'
import { PageHeader, Skeleton } from '@/components/ui'
import { Save, RotateCcw, Store, Globe, CheckCircle2, Loader2, Search } from 'lucide-react'

interface TargetRow {
  outlet_id: string
  outlet_name: string
  target_amount: number
  is_override: boolean
}

function cleanName(name: string) {
  return name.replace('SUKA SHAWARMA ', '').replace('MITRA SUKA ', 'MITRA ')
}

export default function TargetsPage() {
  const supabase = createSupabaseBrowserClient()
  const { isReadOnly } = useRole()
  const [rows, setRows] = useState<TargetRow[]>([])
  const [globalDefault, setGlobalDefault] = useState<number>(0)
  const [globalInput, setGlobalInput] = useState<string>('')
  const [overrideInputs, setOverrideInputs] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [savingKey, setSavingKey] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [savedKey, setSavedKey] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  const load = useCallback(async () => {
    setError(null)
    const [{ data: targets, error: e1 }, { data: globalRow }] = await Promise.all([
      supabase.rpc('get_current_targets'),
      supabase
        .from('daily_sales_targets')
        .select('target_amount')
        .is('outlet_id', null)
        .order('effective_from', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ])
    if (e1) {
      setError(e1.message)
      setLoading(false)
      return
    }
    setRows((targets ?? []) as TargetRow[])
    setGlobalDefault(globalRow?.target_amount ? Number(globalRow.target_amount) : 0)
    setLoading(false)
  }, [supabase])

  useEffect(() => {
    load()
  }, [load])

  const flashSaved = (key: string) => {
    setSavedKey(key)
    setTimeout(() => setSavedKey((k) => (k === key ? null : k)), 1800)
  }

  const saveGlobal = async () => {
    const amount = Number(globalInput.replace(/\D/g, ''))
    if (!Number.isFinite(amount) || amount < 0) return
    setSavingKey('global')
    const { error } = await supabase.rpc('set_daily_target', { p_outlet: null, p_amount: amount })
    setSavingKey(null)
    if (error) return setError(error.message)
    setGlobalInput('')
    flashSaved('global')
    await load()
  }

  const saveOverride = async (outletId: string) => {
    const raw = overrideInputs[outletId] ?? ''
    const amount = Number(raw.replace(/\D/g, ''))
    if (!Number.isFinite(amount) || amount < 0) return
    setSavingKey(outletId)
    const { error } = await supabase.rpc('set_daily_target', { p_outlet: outletId, p_amount: amount })
    setSavingKey(null)
    if (error) return setError(error.message)
    setOverrideInputs((m) => ({ ...m, [outletId]: '' }))
    flashSaved(outletId)
    await load()
  }

  const clearOverride = async (outletId: string) => {
    setSavingKey(outletId)
    const { error } = await supabase.rpc('clear_daily_target_override', { p_outlet: outletId })
    setSavingKey(null)
    if (error) return setError(error.message)
    flashSaved(outletId)
    await load()
  }

  const overrideCount = rows.filter((r) => r.is_override).length
  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return rows
    return rows.filter((r) => cleanName(r.outlet_name).toLowerCase().includes(q))
  }, [rows, search])

  return (
    <div className="space-y-6">
      <PageHeader title="Target Harian" description="Atur target default & override per outlet. Berlaku tiap hari sampai diubah.">
        <span className="text-xs font-bold text-suka-orange bg-suka-cream px-3 py-1.5 rounded-full border border-suka-brown/5">
          {overrideCount} outlet di-override
        </span>
      </PageHeader>

      {error && (
        <div className="p-4 bg-red-50 text-red-700 rounded-xl border border-red-100 text-sm">{error}</div>
      )}

      {loading ? (
        <div className="space-y-4">
          <Skeleton className="h-32" />
          <Skeleton className="h-64" />
        </div>
      ) : (
        <>
          {/* Global default — editing only; mitra (read-only) does not see it */}
          {!isReadOnly && (
            <div className="bg-gradient-to-br from-suka-brown to-suka-ink text-white p-5 sm:p-6 rounded-2xl shadow-md shadow-suka-brown/10">
              <div className="flex items-center gap-2 mb-1">
                <Globe className="w-4 h-4 text-suka-cream/90" />
                <h3 className="text-sm font-extrabold uppercase tracking-wider text-suka-cream">Target Default (Semua Outlet)</h3>
              </div>
              <p className="text-[11px] text-suka-cream/70 font-medium mb-4">
                Outlet tanpa override mengikuti angka ini. Saat ini: <b className="text-white">{rupiah(globalDefault)}</b> / hari
              </p>
              <div className="flex flex-col sm:flex-row gap-2">
                <div className="relative flex-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/60 text-sm font-bold">Rp</span>
                  <input
                    inputMode="numeric"
                    value={globalInput ? Number(globalInput).toLocaleString('id-ID') : ''}
                    onChange={(e) => setGlobalInput(e.target.value.replace(/\D/g, ''))}
                    placeholder={globalDefault ? globalDefault.toLocaleString('id-ID') : 'mis. 5.000.000'}
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl text-sm font-bold text-suka-ink bg-white outline-none focus:ring-2 focus:ring-suka-orange/40"
                  />
                </div>
                <button
                  onClick={saveGlobal}
                  disabled={savingKey === 'global' || !globalInput}
                  className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-suka-orange hover:bg-amber-600 disabled:opacity-50 text-white font-bold text-sm transition-all active:scale-95"
                >
                  {savingKey === 'global' ? <Loader2 className="w-4 h-4 animate-spin" /> : savedKey === 'global' ? <CheckCircle2 className="w-4 h-4" /> : <Save className="w-4 h-4" />}
                  Simpan
                </button>
              </div>
            </div>
          )}

          {/* Per-outlet overrides */}
          <div className="bg-white rounded-2xl border border-suka-gray-200 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-suka-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Store className="w-4 h-4 text-suka-brown" />
                <h3 className="font-extrabold text-suka-brown text-sm tracking-tight uppercase">Target Per Outlet</h3>
              </div>
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-suka-gray-400" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Cari outlet..."
                  className="w-full pl-9 pr-3 py-2 rounded-xl text-xs font-bold text-suka-brown bg-suka-cream/40 border border-suka-gray-200 outline-none focus:border-suka-orange focus:ring-2 focus:ring-suka-orange/10 placeholder:text-suka-gray-400 placeholder:font-medium"
                />
              </div>
            </div>
            <div className="divide-y divide-suka-gray-100">
              {filteredRows.length === 0 && (
                <p className="px-5 py-6 text-sm text-suka-gray-400 text-center">Outlet tidak ditemukan.</p>
              )}
              {filteredRows.map((r) => {
                const isSaving = savingKey === r.outlet_id
                const isSaved = savedKey === r.outlet_id
                return (
                  <div key={r.outlet_id} className="px-5 py-3.5 flex flex-col sm:flex-row sm:items-center gap-3">
                    <div className="flex items-center gap-3 sm:w-56 shrink-0">
                      <span className="font-bold text-suka-ink text-sm truncate">{cleanName(r.outlet_name)}</span>
                      {r.is_override ? (
                        <span className="text-[9px] font-bold text-suka-orange bg-suka-orange/10 px-2 py-0.5 rounded-full uppercase tracking-wide shrink-0">Override</span>
                      ) : (
                        <span className="text-[9px] font-bold text-suka-gray-400 bg-suka-gray-100 px-2 py-0.5 rounded-full uppercase tracking-wide shrink-0">Default</span>
                      )}
                    </div>
                    <div className="text-xs font-bold text-suka-gray-500 sm:w-32 shrink-0">
                      Kini: <span className="text-suka-brown">{rupiah(r.target_amount)}</span>
                    </div>
                    {isReadOnly ? (
                      <div className="flex flex-1 items-center">
                        <span className="text-sm font-extrabold text-suka-brown">{rupiah(r.target_amount)}</span>
                        <span className="ml-2 text-[10px] font-bold text-suka-gray-400 uppercase">/ hari</span>
                      </div>
                    ) : (
                      <div className="flex flex-1 gap-2">
                        <div className="relative flex-1">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-suka-gray-400 text-xs font-bold">Rp</span>
                          <input
                            inputMode="numeric"
                            value={overrideInputs[r.outlet_id] ? Number(overrideInputs[r.outlet_id]).toLocaleString('id-ID') : ''}
                            onChange={(e) => setOverrideInputs((m) => ({ ...m, [r.outlet_id]: e.target.value.replace(/\D/g, '') }))}
                            placeholder="set override..."
                            className="w-full pl-8 pr-3 py-2 rounded-xl text-sm font-bold text-suka-ink bg-suka-cream/30 border border-suka-gray-200 outline-none focus:border-suka-orange focus:ring-2 focus:ring-suka-orange/10"
                          />
                        </div>
                        <button
                          onClick={() => saveOverride(r.outlet_id)}
                          disabled={isSaving || !(overrideInputs[r.outlet_id] ?? '')}
                          className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-suka-orange hover:bg-amber-600 disabled:opacity-40 text-white font-bold text-xs transition-all active:scale-95 shrink-0"
                        >
                          {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : isSaved ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Save className="w-3.5 h-3.5" />}
                          <span className="hidden sm:inline">Simpan</span>
                        </button>
                        {r.is_override && (
                          <button
                            onClick={() => clearOverride(r.outlet_id)}
                            disabled={isSaving}
                            title="Hapus override (ikut default)"
                            className="flex items-center justify-center px-2.5 py-2 rounded-xl border border-suka-gray-200 text-suka-gray-500 hover:text-suka-brown hover:border-suka-brown/20 transition-all active:scale-95 shrink-0"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
