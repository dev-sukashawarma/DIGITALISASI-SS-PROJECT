'use client'

import { useCallback, useMemo, useState } from 'react'
import { createSupabaseBrowserClient } from '@suka/auth'
import { useRole } from '@/components/layout/RoleContext'
import { rupiah } from '@/lib/format'
import { PageHeader } from '@/components/ui'
import {
  Save, RotateCcw, Store, Globe, CheckCircle2, Loader2, Search, Send,
  Target as TargetIcon, Sparkles, Info, AlertTriangle, Clock, Eye, Power,
} from 'lucide-react'
import { toast } from 'sonner'

type Kind = 'motivasi' | 'info' | 'peringatan'

export interface TargetRow {
  outlet_id: string
  outlet_name: string
  target_amount: number
  per_item_bonus: number
  is_override: boolean
}

export interface OverviewRow {
  id: string
  kind: Kind
  title: string | null
  body: string
  target_type: 'all' | 'outlets'
  is_active: boolean
  is_live: boolean
  expires_at: string | null
  created_at: string
  read_count: number
  outlet_ids: string[]
}

const KINDS: { key: Kind; label: string; icon: typeof Info; color: string }[] = [
  { key: 'motivasi', label: 'Motivasi', icon: Sparkles, color: '#f29744' },
  { key: 'info', label: 'Info', icon: Info, color: '#0a7d2c' },
  { key: 'peringatan', label: 'Peringatan', icon: AlertTriangle, color: '#dc2626' },
]

const QUOTES = [
  'Senyum terbaikmu adalah pelayanan terbaik untuk pelanggan. Semangat hari ini! 🔥',
  'Setiap pesanan yang kamu layani membangun nama baik Suka Shawarma. Terima kasih! 🙏',
  'Hari ini kesempatan baru untuk pecahkan rekor penjualan. Kamu pasti bisa! 💪',
  'Pelayanan cepat + ramah = pelanggan balik lagi. Kalian luar biasa! ⭐',
  'Kerja rapi, hati gembira. Mari buat hari ini produktif & menyenangkan! ✨',
]

const EXPIRY_PRESETS: { key: string; label: string; ms: number | 'custom' | 'forever' }[] = [
  { key: '1h', label: '1 Jam', ms: 60 * 60 * 1000 },
  { key: '6h', label: '6 Jam', ms: 6 * 60 * 60 * 1000 },
  { key: '1d', label: '1 Hari', ms: 24 * 60 * 60 * 1000 },
  { key: '3d', label: '3 Hari', ms: 3 * 24 * 60 * 60 * 1000 },
  { key: '7d', label: '1 Minggu', ms: 7 * 24 * 60 * 60 * 1000 },
  { key: 'forever', label: 'Selamanya', ms: 'forever' },
  { key: 'custom', label: 'Kustom', ms: 'custom' },
]

function cleanName(name: string) {
  return name.replace('SUKA SHAWARMA ', '').replace('MITRA SUKA ', 'MITRA ')
}

interface TargetsViewProps {
  initialTargets: TargetRow[]
  initialGlobalDefault: number
  initialGlobalDefaultBonus: number
  initialHistory: OverviewRow[]
}

export default function TargetsView({ initialTargets, initialGlobalDefault, initialGlobalDefaultBonus, initialHistory }: TargetsViewProps) {
  const supabase = createSupabaseBrowserClient()
  const { isReadOnly } = useRole()

  const [rows, setRows] = useState<TargetRow[]>(initialTargets)
  const [globalDefault, setGlobalDefault] = useState<number>(initialGlobalDefault)
  const [globalDefaultBonus, setGlobalDefaultBonus] = useState<number>(initialGlobalDefaultBonus)
  const [history, setHistory] = useState<OverviewRow[]>(initialHistory)

  // ── Compose (target + pesan) ────────────────────────────────────────────
  const [audienceAll, setAudienceAll] = useState(false)
  const [selectedOutlets, setSelectedOutlets] = useState<Set<string>>(new Set())
  const [outletSearch, setOutletSearch] = useState('')
  const [targetInput, setTargetInput] = useState('')
  const [bonusInput, setBonusInput] = useState('')
  const [kind, setKind] = useState<Kind>('motivasi')
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [expiryKey, setExpiryKey] = useState('1d')
  const [customExpiry, setCustomExpiry] = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)

  // ── Per-outlet quick edit ───────────────────────────────────────────────
  const [overrideInputs, setOverrideInputs] = useState<Record<string, string>>({})
  const [overrideBonusInputs, setOverrideBonusInputs] = useState<Record<string, string>>({})
  const [savingKey, setSavingKey] = useState<string | null>(null)
  const [savedKey, setSavedKey] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  // ── UI State ────────────────────────────────────────────────────────────
  const [isFormOpen, setIsFormOpen] = useState(false)

  const loadTargets = useCallback(async () => {
    const [{ data: targets, error: e1 }, { data: globalRow }] = await Promise.all([
      supabase.rpc('get_current_targets'),
      supabase
        .from('daily_sales_targets')
        .select('target_amount, per_item_bonus')
        .is('outlet_id', null)
        .order('effective_from', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ])
    if (e1) {
      toast.error(e1.message)
      return
    }
    setRows((targets ?? []) as TargetRow[])
    setGlobalDefault(globalRow?.target_amount ? Number(globalRow.target_amount) : 0)
    setGlobalDefaultBonus(globalRow?.per_item_bonus ? Number(globalRow.per_item_bonus) : 0)
  }, [supabase])

  const loadHistory = useCallback(async () => {
    const { data, error } = await supabase.from('owner_messages_overview').select('*').limit(50)
    if (error) toast.error(error.message)
    else setHistory((data ?? []) as OverviewRow[])
  }, [supabase])


  const flashSaved = (key: string) => {
    setSavedKey(key)
    setTimeout(() => setSavedKey((k) => (k === key ? null : k)), 1800)
  }

  // ── Compose helpers ───────────────────────────────────────────────────────
  const toggleOutlet = (id: string) => {
    setSelectedOutlets((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const filteredPickerOutlets = useMemo(() => {
    const q = outletSearch.trim().toLowerCase()
    if (!q) return rows
    return rows.filter((r) => cleanName(r.outlet_name).toLowerCase().includes(q))
  }, [rows, outletSearch])

  const allPickerSelected = filteredPickerOutlets.length > 0 && filteredPickerOutlets.every((o) => selectedOutlets.has(o.outlet_id))
  const toggleAllPicker = () => {
    setSelectedOutlets((prev) => {
      const next = new Set(prev)
      if (allPickerSelected) filteredPickerOutlets.forEach((o) => next.delete(o.outlet_id))
      else filteredPickerOutlets.forEach((o) => next.add(o.outlet_id))
      return next
    })
  }

  const computeExpiry = (): string | null => {
    const preset = EXPIRY_PRESETS.find((p) => p.key === expiryKey)
    if (!preset) return null
    if (preset.ms === 'custom') return customExpiry ? new Date(customExpiry).toISOString() : null
    if (preset.ms === 'forever') return null
    return new Date(Date.now() + (preset.ms as number)).toISOString()
  }

  const targetAmount = Number(targetInput.replace(/\D/g, ''))
  const hasTarget = targetInput.trim() !== '' && Number.isFinite(targetAmount) && targetAmount >= 0
  const bonusAmount = Number(bonusInput.replace(/\D/g, ''))
  const hasBonus = bonusInput.trim() !== '' && Number.isFinite(bonusAmount) && bonusAmount >= 0
  const hasMessage = body.trim().length > 0
  const audienceValid = audienceAll || selectedOutlets.size > 0

  const submit = async () => {
    if (sending) return
    if (!audienceValid) {
      toast.error('Silakan pilih minimal satu outlet terlebih dahulu.')
      return
    }
    if (hasBonus && !hasTarget) {
      toast.error('Nominal target harian harus diisi jika ingin mengatur bonus harian.')
      return
    }
    if (title.trim().length > 0 && body.trim().length === 0) {
      toast.error('Isi pesan tidak boleh kosong jika Anda menulis judul pesan.')
      return
    }
    if (!hasTarget && !hasMessage) {
      toast.error('Silakan isi nominal target harian ATAU tulis pesan untuk kasir.')
      return
    }
    setSending(true)
    try {
      // Dapatkan userId untuk mode bypass RPC
      const { data: { session } } = await supabase.auth.getSession()
      const userId = session?.user?.id

      if (hasTarget) {
        if (audienceAll) {
          const { error } = await supabase.from('daily_sales_targets').insert({
            outlet_id: null,
            target_amount: targetAmount,
            per_item_bonus: hasBonus ? bonusAmount : 0,
            created_by: userId || null
          })
          if (error) throw error
        } else {
          for (const id of selectedOutlets) {
            const { error } = await supabase.rpc('set_daily_target', {
              p_outlet: id,
              p_amount: targetAmount,
              p_per_item_bonus: hasBonus ? bonusAmount : 0
            })
            if (error) throw error
          }
        }
      }
      if (hasMessage) {
        if (audienceAll) {
          const { error } = await supabase.from('owner_messages').insert({
            sender_id: userId || null,
            kind: kind || 'motivasi',
            title: title.trim() || null,
            body: body.trim(),
            target_type: 'all',
            expires_at: computeExpiry()
          })
          if (error) {
            alert(`Error insert message all: ${JSON.stringify(error)}`)
            throw error
          }
        } else {
          const { error } = await supabase.rpc('send_owner_message', {
            p_kind: kind,
            p_title: title.trim() || null,
            p_body: body.trim(),
            p_target_type: 'outlets',
            p_outlet_ids: Array.from(selectedOutlets),
            p_expires_at: computeExpiry(),
          })
          if (error) {
            alert(`Error RPC message outlets: ${JSON.stringify(error)}`)
            throw error
          }
        }
      }
      setSent(true)
      setTimeout(() => setSent(false), 2000)
      setTargetInput('')
      setBonusInput('')
      setTitle('')
      setBody('')
      setSelectedOutlets(new Set())
      setAudienceAll(false)
      await Promise.all([loadTargets(), loadHistory()])
    } catch (e: any) {
      console.error(e)
      toast.error(e?.message || 'Gagal mengirim.')
    } finally {
      setSending(false)
    }
  }

  // ── Per-outlet quick edit ─────────────────────────────────────────────────
  const saveOverride = async (outletId: string) => {
    const row = rows.find((x) => x.outlet_id === outletId)
    if (!row) return

    const rawTarget = overrideInputs[outletId] ?? ''
    const rawBonus = overrideBonusInputs[outletId] ?? ''

    if (!rawTarget.trim() && !rawBonus.trim()) return

    const amount = rawTarget.trim() !== '' ? Number(rawTarget.replace(/\D/g, '')) : row.target_amount
    const bonus = rawBonus.trim() !== '' ? Number(rawBonus.replace(/\D/g, '')) : row.per_item_bonus

    if (!Number.isFinite(amount) || amount < 0) return
    if (!Number.isFinite(bonus) || bonus < 0) return

    setSavingKey(outletId)
    const { error } = await supabase.rpc('set_daily_target', {
      p_outlet: outletId,
      p_amount: amount,
      p_per_item_bonus: bonus
    })
    setSavingKey(null)
    if (error) { toast.error(error.message); return; }
    setOverrideInputs((m) => ({ ...m, [outletId]: '' }))
    setOverrideBonusInputs((m) => ({ ...m, [outletId]: '' }))
    flashSaved(outletId)
    await loadTargets()
  }

  const clearOverride = async (outletId: string) => {
    setSavingKey(outletId)
    const { error } = await supabase.rpc('clear_daily_target_override', { p_outlet: outletId })
    setSavingKey(null)
    if (error) { toast.error(error.message); return; }
    flashSaved(outletId)
    await loadTargets()
  }

  const deactivateMessage = async (id: string) => {
    const { error } = await supabase.from('owner_messages').update({ is_active: false }).eq('id', id)
    if (error) { toast.error(error.message); return; }
    await loadHistory()
  }

  const overrideCount = rows.filter((r) => r.is_override).length
  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return rows
    return rows.filter((r) => cleanName(r.outlet_name).toLowerCase().includes(q))
  }, [rows, search])

  const outletNameById = useMemo(() => {
    const m = new Map<string, string>()
    rows.forEach((r) => m.set(r.outlet_id, cleanName(r.outlet_name)))
    return m
  }, [rows])

  return (
    <div className="space-y-6">
      <PageHeader title="Target & Pesan" description="Atur target penjualan harian dan kirim pesan ke kasir — sekaligus atau salah satu.">
        <span className="text-xs font-bold text-suka-orange bg-suka-cream px-3 py-1.5 rounded-full border border-suka-brown/5">
          {overrideCount} outlet di-override
        </span>
      </PageHeader>

        <>
          {/* ── Compose: target + pesan (owner/admin) ── */}
          {!isReadOnly && (
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
              <div className="lg:col-span-3 bg-white p-5 sm:p-6 rounded-2xl border border-suka-gray-200 shadow-sm space-y-5">
                <button
                  onClick={() => setIsFormOpen(!isFormOpen)}
                  className="w-full flex items-center justify-between group"
                >
                  <div className="flex items-center gap-2">
                    <Send className="w-4 h-4 text-suka-brown" />
                    <h3 className="font-extrabold text-suka-brown text-sm tracking-tight uppercase">Kirim ke Kasir</h3>
                  </div>
                  <span className="text-xs font-bold text-suka-orange group-hover:text-amber-600 transition-colors">
                    {isFormOpen ? 'Tutup' : 'Buat Baru'}
                  </span>
                </button>

                {isFormOpen && (
                  <div className="space-y-5 pt-2 border-t border-suka-gray-100 mt-3">
                    {/* Audience */}
                <div>
                  <label className="block text-[11px] font-bold text-suka-gray-500 uppercase tracking-wider mb-2">Kirim Ke</label>
                  <div className="flex gap-2 mb-3">
                    <button
                      onClick={() => setAudienceAll(true)}
                      className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-sm font-bold transition-all active:scale-95 border ${
                        audienceAll ? 'bg-suka-brown text-white border-transparent' : 'text-suka-gray-500 border-suka-gray-200 hover:border-suka-brown/20'
                      }`}
                    >
                      <Globe className="w-4 h-4" /> Semua Outlet
                    </button>
                    <button
                      onClick={() => setAudienceAll(false)}
                      className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-sm font-bold transition-all active:scale-95 border ${
                        !audienceAll ? 'bg-suka-brown text-white border-transparent' : 'text-suka-gray-500 border-suka-gray-200 hover:border-suka-brown/20'
                      }`}
                    >
                      <Store className="w-4 h-4" /> Pilih Outlet
                    </button>
                  </div>
                  {!audienceAll && (
                    <>
                      <div className="flex items-center gap-2 mb-2">
                        <div className="relative flex-1">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-suka-gray-400" />
                          <input
                            value={outletSearch}
                            onChange={(e) => setOutletSearch(e.target.value)}
                            placeholder="Cari outlet..."
                            className="w-full pl-9 pr-3 py-2 rounded-xl text-xs font-bold text-suka-brown bg-suka-cream/40 border border-suka-gray-200 outline-none focus:border-suka-orange focus:ring-2 focus:ring-suka-orange/10 placeholder:text-suka-gray-400 placeholder:font-medium"
                          />
                        </div>
                        <button
                          onClick={toggleAllPicker}
                          disabled={filteredPickerOutlets.length === 0}
                          className="shrink-0 px-3 py-2 rounded-xl text-xs font-bold border border-suka-gray-200 text-suka-brown hover:border-suka-brown/20 disabled:opacity-40 transition-colors"
                        >
                          {allPickerSelected ? 'Hapus semua' : 'Pilih semua'}
                        </button>
                      </div>
                      <div className="border border-suka-gray-200 rounded-xl p-2 max-h-44 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 gap-1">
                        {filteredPickerOutlets.length === 0 ? (
                          <p className="col-span-full px-2 py-3 text-xs text-suka-gray-400 text-center">Outlet tidak ditemukan.</p>
                        ) : (
                          filteredPickerOutlets.map((o) => {
                            const checked = selectedOutlets.has(o.outlet_id)
                            return (
                              <button
                                key={o.outlet_id}
                                onClick={() => toggleOutlet(o.outlet_id)}
                                className={`flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs font-bold text-left transition-colors ${
                                  checked ? 'bg-suka-orange/10 text-suka-orange' : 'text-suka-brown hover:bg-suka-cream/60'
                                }`}
                              >
                                <span className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${checked ? 'bg-suka-orange border-suka-orange' : 'border-suka-gray-300'}`}>
                                  {checked && <CheckCircle2 className="w-3 h-3 text-white" />}
                                </span>
                                <span className="truncate">{cleanName(o.outlet_name)}</span>
                              </button>
                            )
                          })
                        )}
                      </div>
                      <p className="text-[10px] text-suka-gray-400 font-semibold mt-1.5">{selectedOutlets.size} outlet dipilih</p>
                    </>
                  )}
                </div>

                {/* Target (opsional) */}
                <div>
                  <label className="block text-[11px] font-bold text-suka-gray-500 uppercase tracking-wider mb-2">
                    <TargetIcon className="w-3 h-3 inline mr-1" /> Target Harian (opsional)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-suka-gray-400 text-sm font-bold">Rp</span>
                    <input
                      inputMode="numeric"
                      value={targetInput ? Number(targetInput).toLocaleString('id-ID') : ''}
                      onChange={(e) => setTargetInput(e.target.value.replace(/\D/g, ''))}
                      placeholder="mis. 5.000.000"
                      className="w-full pl-9 pr-3 py-2.5 rounded-xl text-sm font-bold text-suka-ink bg-suka-cream/30 border border-suka-gray-200 outline-none focus:border-suka-orange focus:ring-2 focus:ring-suka-orange/10"
                    />
                  </div>
                  <p className="text-[10px] text-suka-gray-400 font-semibold mt-1.5">
                    {audienceAll
                      ? <>Jadi <b>default global</b> (kini {rupiah(globalDefault)}/hari). Outlet dengan override tidak berubah.</>
                      : <>Jadi <b>override</b> untuk {selectedOutlets.size || 0} outlet terpilih.</>}
                  </p>
                </div>

                {/* Bonus Harian (opsional) */}
                <div>
                  <label className="block text-[11px] font-bold text-suka-gray-500 uppercase tracking-wider mb-2">
                    <Sparkles className="w-3 h-3 inline mr-1" /> Nominal Bonus Per Item (opsional)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-suka-gray-400 text-sm font-bold">Rp</span>
                    <input
                      inputMode="numeric"
                      value={bonusInput ? Number(bonusInput).toLocaleString('id-ID') : ''}
                      onChange={(e) => setBonusInput(e.target.value.replace(/\D/g, ''))}
                      placeholder="mis. 150.000"
                      className="w-full pl-9 pr-3 py-2.5 rounded-xl text-sm font-bold text-suka-ink bg-suka-cream/30 border border-suka-gray-200 outline-none focus:border-suka-orange focus:ring-2 focus:ring-suka-orange/10"
                    />
                  </div>
                  <p className="text-[10px] text-suka-gray-400 font-semibold mt-1.5">
                    {audienceAll
                      ? <>Jadi <b>default global</b> (kini {rupiah(globalDefaultBonus)}/item). Outlet dengan override tidak berubah.</>
                      : <>Jadi <b>override</b> untuk {selectedOutlets.size || 0} outlet terpilih.</>}
                  </p>
                </div>

                {/* Pesan (opsional) */}
                <div className="pt-1 border-t border-suka-gray-100 space-y-4">
                  <label className="block text-[11px] font-bold text-suka-gray-500 uppercase tracking-wider">
                    Pesan (opsional)
                  </label>

                  <div className="flex gap-2">
                    {KINDS.map((k) => {
                      const Icon = k.icon
                      const active = kind === k.key
                      return (
                        <button
                          key={k.key}
                          onClick={() => setKind(k.key)}
                          className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-sm font-bold transition-all active:scale-95 border ${
                            active ? 'text-white border-transparent shadow-sm' : 'text-suka-gray-500 border-suka-gray-200 hover:border-suka-brown/20'
                          }`}
                          style={active ? { backgroundColor: k.color } : undefined}
                        >
                          <Icon className="w-4 h-4" />
                          {k.label}
                        </button>
                      )
                    })}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {QUOTES.map((q, i) => (
                      <button
                        key={i}
                        onClick={() => setBody(q)}
                        className="text-[11px] font-semibold text-suka-brown/80 bg-suka-cream hover:bg-suka-orange/10 border border-suka-brown/5 px-3 py-1.5 rounded-full transition-colors text-left max-w-full truncate"
                        title={q}
                      >
                        {q.length > 38 ? q.slice(0, 38) + '…' : q}
                      </button>
                    ))}
                  </div>

                  <input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Judul (opsional), mis. Semangat Pagi!"
                    maxLength={80}
                    className="w-full px-3 py-2.5 rounded-xl text-sm font-bold text-suka-ink bg-suka-cream/30 border border-suka-gray-200 outline-none focus:border-suka-orange focus:ring-2 focus:ring-suka-orange/10"
                  />

                  <div>
                    <textarea
                      value={body}
                      onChange={(e) => setBody(e.target.value)}
                      rows={3}
                      placeholder={title.trim().length > 0 ? "Wajib diisi jika Anda menulis judul pesan..." : "Tulis pesan untuk kasir... (kosongkan jika hanya set target)"}
                      maxLength={500}
                      className="w-full px-3 py-2.5 rounded-xl text-sm font-medium text-suka-ink bg-suka-cream/30 border border-suka-gray-200 outline-none focus:border-suka-orange focus:ring-2 focus:ring-suka-orange/10 resize-none"
                    />
                    <p className="text-[10px] text-suka-gray-400 font-semibold mt-1 text-right">{body.length}/500</p>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-suka-gray-500 uppercase tracking-wider mb-2">
                      <Clock className="w-3 h-3 inline mr-1" /> Pesan kadaluarsa
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {EXPIRY_PRESETS.map((p) => (
                        <button
                          key={p.key}
                          onClick={() => setExpiryKey(p.key)}
                          className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all active:scale-95 border ${
                            expiryKey === p.key ? 'bg-suka-orange text-white border-transparent' : 'text-suka-gray-500 border-suka-gray-200 hover:border-suka-brown/20'
                          }`}
                        >
                          {p.label}
                        </button>
                      ))}
                    </div>
                    {expiryKey === 'custom' && (
                      <input
                        type="datetime-local"
                        value={customExpiry}
                        onChange={(e) => setCustomExpiry(e.target.value)}
                        className="mt-2 w-full px-3 py-2 rounded-xl text-sm font-medium text-suka-ink bg-suka-cream/30 border border-suka-gray-200 outline-none focus:border-suka-orange"
                      />
                    )}
                  </div>
                </div>

                <button
                  onClick={submit}
                  disabled={
                    sending || 
                    (title.trim().length > 0 && body.trim().length === 0) || 
                    (hasBonus && !hasTarget) || 
                    (!hasTarget && body.trim().length === 0)
                  }
                  className="w-full flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-suka-orange hover:bg-amber-600 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-sm transition-all active:scale-95 shadow-sm shadow-suka-orange/20"
                >
                  {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : sent ? <CheckCircle2 className="w-4 h-4" /> : <Send className="w-4 h-4" />}
                  {sent ? 'Terkirim!' : (title.trim().length > 0 && body.trim().length === 0) ? 'Isi Pesan Wajib Diisi' : (hasBonus && !hasTarget) ? 'Isi Target Harian' : (!hasTarget && body.trim().length === 0) ? 'Isi Target atau Pesan' : hasTarget && hasMessage ? 'Kirim Target & Pesan' : hasMessage ? 'Kirim Pesan' : 'Simpan Target'}
                </button>
                  </div>
                )}
              </div>

              {/* History */}
              <div className="lg:col-span-2 bg-white p-5 rounded-2xl border border-suka-gray-200 shadow-sm">
                <h3 className="font-extrabold text-suka-brown text-sm tracking-tight uppercase mb-4">Riwayat Pesan</h3>
                {history.length === 0 ? (
                  <p className="text-sm text-suka-gray-400 text-center py-8">Belum ada pesan terkirim.</p>
                ) : (
                  <div className="space-y-3 max-h-[640px] overflow-y-auto pr-1">
                    {history.map((m) => {
                      const meta = KINDS.find((k) => k.key === m.kind) ?? KINDS[0]
                      const Icon = meta.icon
                      return (
                        <div key={m.id} className="border border-suka-gray-100 rounded-xl p-3 space-y-2">
                          <div className="flex items-start gap-2">
                            <span className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: `${meta.color}1a` }}>
                              <Icon className="w-3.5 h-3.5" style={{ color: meta.color }} />
                            </span>
                            <div className="min-w-0 flex-1">
                              {m.title && <p className="text-xs font-extrabold text-suka-brown truncate">{m.title}</p>}
                              <p className="text-xs text-suka-gray-600 font-medium line-clamp-2">{m.body}</p>
                            </div>
                            {m.is_live ? (
                              <span className="text-[9px] font-bold text-suka-green bg-suka-green/10 px-2 py-0.5 rounded-full uppercase shrink-0">Aktif</span>
                            ) : (
                              <span className="text-[9px] font-bold text-suka-gray-400 bg-suka-gray-100 px-2 py-0.5 rounded-full uppercase shrink-0">Selesai</span>
                            )}
                          </div>
                          <div className="flex items-center gap-3 text-[10px] font-bold text-suka-gray-400">
                            <span className="flex items-center gap-1">
                              {m.target_type === 'all' ? <><Globe className="w-3 h-3" /> Semua</> : <><Store className="w-3 h-3" /> {m.outlet_ids.length} outlet</>}
                            </span>
                            <span className="flex items-center gap-1"><Eye className="w-3 h-3" /> {m.read_count} dibaca</span>
                            <span className="ml-auto">{new Date(m.created_at).toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                          </div>
                          {m.target_type === 'outlets' && m.outlet_ids.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {m.outlet_ids.slice(0, 4).map((id) => (
                                <span key={id} className="text-[9px] font-bold text-suka-brown/70 bg-suka-cream px-1.5 py-0.5 rounded">{outletNameById.get(id) ?? '—'}</span>
                              ))}
                              {m.outlet_ids.length > 4 && <span className="text-[9px] font-bold text-suka-gray-400">+{m.outlet_ids.length - 4}</span>}
                            </div>
                          )}
                          {m.is_live && (
                            <button
                              onClick={() => deactivateMessage(m.id)}
                              className="flex items-center gap-1.5 text-[10px] font-bold text-red-500 hover:text-red-600 transition-colors"
                            >
                              <Power className="w-3 h-3" /> Nonaktifkan
                            </button>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── Per-outlet target table ── */}
          <div className="bg-white rounded-2xl border border-suka-gray-200 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-suka-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Store className="w-4 h-4 text-suka-brown" />
                <h3 className="font-extrabold text-suka-brown text-sm tracking-tight uppercase">Target Per Outlet</h3>
                {!isReadOnly && (
                  <span className="text-[10px] font-bold text-suka-gray-400">· Default global: Target {rupiah(globalDefault)} & Bonus {rupiah(globalDefaultBonus)} / item</span>
                )}
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
                    <div className="text-xs font-bold text-suka-gray-500 sm:w-64 shrink-0 flex flex-col md:flex-row md:gap-3">
                      <div>Target: <span className="text-suka-brown">{rupiah(r.target_amount)}</span></div>
                      <div>Bonus/item: <span className="text-suka-orange">{rupiah(r.per_item_bonus)}</span></div>
                    </div>
                    {isReadOnly ? (
                      <div className="flex flex-1 items-center gap-4">
                        <div>
                          <span className="text-sm font-extrabold text-suka-brown">{rupiah(r.target_amount)}</span>
                          <span className="ml-1 text-[10px] font-bold text-suka-gray-400 uppercase">Target</span>
                        </div>
                        <div>
                          <span className="text-sm font-extrabold text-suka-orange">{rupiah(r.per_item_bonus)}</span>
                          <span className="ml-1 text-[10px] font-bold text-suka-gray-400 uppercase">Bonus/Item</span>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-1 flex-col md:flex-row gap-2">
                        <div className="relative flex-1">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-suka-gray-400 text-xs font-bold">Rp</span>
                          <input
                            inputMode="numeric"
                            value={overrideInputs[r.outlet_id] ? Number(overrideInputs[r.outlet_id]).toLocaleString('id-ID') : ''}
                            onChange={(e) => setOverrideInputs((m) => ({ ...m, [r.outlet_id]: e.target.value.replace(/\D/g, '') }))}
                            placeholder="target override..."
                            className="w-full pl-8 pr-3 py-2 rounded-xl text-xs font-bold text-suka-ink bg-suka-cream/30 border border-suka-gray-200 outline-none focus:border-suka-orange focus:ring-2 focus:ring-suka-orange/10"
                          />
                        </div>
                        <div className="relative flex-1">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-suka-gray-400 text-xs font-bold">Rp</span>
                          <input
                            inputMode="numeric"
                            value={overrideBonusInputs[r.outlet_id] ? Number(overrideBonusInputs[r.outlet_id]).toLocaleString('id-ID') : ''}
                            onChange={(e) => setOverrideBonusInputs((m) => ({ ...m, [r.outlet_id]: e.target.value.replace(/\D/g, '') }))}
                            placeholder="bonus override..."
                            className="w-full pl-8 pr-3 py-2 rounded-xl text-xs font-bold text-suka-ink bg-suka-cream/30 border border-suka-gray-200 outline-none focus:border-suka-orange focus:ring-2 focus:ring-suka-orange/10"
                          />
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => saveOverride(r.outlet_id)}
                            disabled={isSaving || (!(overrideInputs[r.outlet_id] ?? '').trim() && !(overrideBonusInputs[r.outlet_id] ?? '').trim())}
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
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </>
    </div>
  )
}
