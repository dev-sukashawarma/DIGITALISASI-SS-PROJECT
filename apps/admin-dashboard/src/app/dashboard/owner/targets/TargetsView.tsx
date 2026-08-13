'use client'

import { useCallback, useMemo, useState } from 'react'
import { createSupabaseBrowserClient } from '@suka/auth'
import { useRole } from '@/components/layout/RoleContext'
import { rupiah } from '@/lib/format'
import { PageHeader } from '@/components/ui'
import {
  Save, RotateCcw, Store, Globe, CheckCircle2, Loader2, Search, Send,
  Target as TargetIcon, Sparkles, Info, AlertTriangle, Clock, Eye, Power,
  ChevronDown, ChevronUp, MessageSquare
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

const KINDS: { key: Kind; label: string; icon: typeof Info; color: string; bg: string; border: string; desc: string }[] = [
  { 
    key: 'motivasi', 
    label: 'Motivasi', 
    icon: Sparkles, 
    color: '#ea580c', 
    bg: 'bg-orange-50', 
    border: 'border-orange-200',
    desc: 'Semangat & dorongan performa tim kasir' 
  },
  { 
    key: 'info', 
    label: 'Informasi', 
    icon: Info, 
    color: '#15803d', 
    bg: 'bg-green-50', 
    border: 'border-green-200',
    desc: 'Pengumuman operasional atau SOP penting' 
  },
  { 
    key: 'peringatan', 
    label: 'Peringatan', 
    icon: AlertTriangle, 
    color: '#b91c1c', 
    bg: 'bg-red-50', 
    border: 'border-red-200',
    desc: 'Instruksi mendesak atau hal kritis' 
  },
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
  { key: '1d', label: '1 Hari (24 Jam)', ms: 24 * 60 * 60 * 1000 },
  { key: '3d', label: '3 Hari', ms: 3 * 24 * 60 * 60 * 1000 },
  { key: '7d', label: '1 Minggu', ms: 7 * 24 * 60 * 60 * 1000 },
  { key: 'forever', label: 'Selamanya', ms: 'forever' },
  { key: 'custom', label: 'Atur Jam Sendiri', ms: 'custom' },
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
  const [audienceAll, setAudienceAll] = useState(true)
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

  // ── Form Visibility (Open by default for ease of use) ───────────────────
  const [isFormOpen, setIsFormOpen] = useState(true)

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
      toast.error('Silakan pilih minimal satu cabang outlet penerima terlebih dahulu.')
      return
    }
    if (hasBonus && !hasTarget) {
      toast.error('Silakan isi nominal target harian terlebih dahulu sebelum menentukan bonus.')
      return
    }
    if (title.trim().length > 0 && body.trim().length === 0) {
      toast.error('Isi pesan tidak boleh kosong jika Anda mengisi judul pesan.')
      return
    }
    if (!hasTarget && !hasMessage) {
      toast.error('Silakan isi nominal target harian ATAU tulis pesan motivasi untuk kasir.')
      return
    }
    setSending(true)
    try {
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

          await supabase.from('daily_sales_targets').delete().not('outlet_id', 'is', null)
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
          if (error) throw error
        } else {
          const { error } = await supabase.rpc('send_owner_message', {
            p_kind: kind,
            p_title: title.trim() || null,
            p_body: body.trim(),
            p_target_type: 'outlets',
            p_outlet_ids: Array.from(selectedOutlets),
            p_expires_at: computeExpiry(),
          })
          if (error) throw error
        }
      }
      setSent(true)
      toast.success('Target & Pesan berhasil dikirimkan ke layar kasir!')
      setTimeout(() => setSent(false), 2000)
      setTargetInput('')
      setBonusInput('')
      setTitle('')
      setBody('')
      setSelectedOutlets(new Set())
      setAudienceAll(true)
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
    toast.success(`Target khusus cabang ${cleanName(row.outlet_name)} berhasil diperbarui.`)
    flashSaved(outletId)
    await loadTargets()
  }

  const clearOverride = async (outletId: string) => {
    const row = rows.find((x) => x.outlet_id === outletId)
    setSavingKey(outletId)
    const { error } = await supabase.rpc('clear_daily_target_override', { p_outlet: outletId })
    setSavingKey(null)
    if (error) { toast.error(error.message); return; }
    toast.success(`Cabang ${row ? cleanName(row.outlet_name) : ''} kini kembali mengikuti Target Global.`)
    flashSaved(outletId)
    await loadTargets()
  }

  const deactivateMessage = async (id: string) => {
    const { error } = await supabase.from('owner_messages').update({ is_active: false }).eq('id', id)
    if (error) { toast.error(error.message); return; }
    toast.success('Pesan telah dinonaktifkan dari layar kasir.')
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
      {/* ── Page Header Standard System Design (0 Gradient, 0 Yellow) ── */}
      <PageHeader
        title="Target & Pesan Kasir"
        description="Atur target omzet harian cabang, bonus insentif per porsi, serta kirim pengumuman atau pesan motivasi langsung ke layar kasir."
      >
        <div className="flex flex-wrap items-center gap-2 mt-3 sm:mt-0">
          <span className="text-xs font-bold text-suka-brown bg-suka-cream px-3 py-1.5 rounded-full border border-suka-brown/10">
            Target Global: {rupiah(globalDefault)} / hari
          </span>
          {overrideCount > 0 && (
            <span className="text-xs font-bold text-suka-orange bg-suka-orange/10 px-3 py-1.5 rounded-full border border-suka-orange/20">
              {overrideCount} outlet khusus
            </span>
          )}
        </div>
      </PageHeader>

      {!isReadOnly && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* ── Form Utama (Langkah 1, 2, 3) ── */}
          <div className="lg:col-span-7 bg-white rounded-2xl border border-suka-gray-200 shadow-sm overflow-hidden flex flex-col justify-between">
            {/* Form Header */}
            <div className="p-4 sm:p-6 bg-white border-b border-suka-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-suka-brown text-white flex items-center justify-center font-black shadow-sm shrink-0">
                  <Send className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="font-extrabold text-suka-brown text-base leading-tight uppercase tracking-tight">Form Buat Target & Pesan</h2>
                  <p className="text-suka-gray-400 text-xs font-medium">Ikuti langkah sederhana di bawah untuk mengirim ke kasir</p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsFormOpen(!isFormOpen)}
                className="w-full sm:w-auto justify-center text-xs font-bold text-suka-brown bg-suka-cream hover:bg-suka-orange/10 px-3.5 py-2 sm:py-1.5 rounded-xl transition-all border border-suka-brown/10 flex items-center gap-1.5"
              >
                {isFormOpen ? <>Tutup Form <ChevronUp className="w-4 h-4" /></> : <>Buka Form <ChevronDown className="w-4 h-4" /></>}
              </button>
            </div>

            {isFormOpen && (
              <div className="p-5 sm:p-6 space-y-6">
                {/* ── LANGKAH 1: PILIH PENERIMA ── */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2.5">
                    <span className="px-2.5 py-0.5 rounded-md bg-orange-100 text-suka-orange font-black text-[10px] uppercase tracking-widest border border-orange-200 shadow-[0_2px_4px_rgba(234,88,12,0.1)]">Langkah 1</span>
                    <h3 className="font-extrabold text-suka-brown text-sm">Pilih Cabang / Outlet Penerima</h3>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setAudienceAll(true)}
                      className={`p-3.5 rounded-2xl border text-left transition-all active:scale-[.98] flex items-center gap-3 relative overflow-hidden ${
                        audienceAll
                          ? 'bg-orange-50/60 text-suka-brown border-suka-orange shadow-[0_4px_16px_rgba(234,88,12,0.08)]'
                          : 'bg-white text-suka-gray-600 border-suka-gray-200 hover:border-suka-brown/20 hover:bg-suka-cream/30'
                      }`}
                    >
                      <div className={`p-2 rounded-xl shrink-0 transition-colors ${audienceAll ? 'bg-white text-suka-orange shadow-sm border border-orange-100' : 'bg-suka-gray-50 text-suka-gray-400'}`}>
                        <Globe className="w-4 h-4" />
                      </div>
                      <div className="flex-1 z-10">
                        <p className={`font-extrabold text-xs leading-tight ${audienceAll ? 'text-suka-brown' : ''}`}>Semua Outlet</p>
                        <p className={`text-[10px] mt-0.5 font-medium ${audienceAll ? 'text-suka-orange' : 'text-suka-gray-400'}`}>Terkirim ke seluruh cabang</p>
                      </div>
                      {audienceAll && <CheckCircle2 className="w-8 h-8 text-suka-orange absolute -right-2 -bottom-2 opacity-10" />}
                    </button>

                    <button
                      type="button"
                      onClick={() => setAudienceAll(false)}
                      className={`p-3.5 rounded-2xl border text-left transition-all active:scale-[.98] flex items-center gap-3 relative overflow-hidden ${
                        !audienceAll
                          ? 'bg-orange-50/60 text-suka-brown border-suka-orange shadow-[0_4px_16px_rgba(234,88,12,0.08)]'
                          : 'bg-white text-suka-gray-600 border-suka-gray-200 hover:border-suka-brown/20 hover:bg-suka-cream/30'
                      }`}
                    >
                      <div className={`p-2 rounded-xl shrink-0 transition-colors ${!audienceAll ? 'bg-white text-suka-orange shadow-sm border border-orange-100' : 'bg-suka-gray-50 text-suka-gray-400'}`}>
                        <Store className="w-4 h-4" />
                      </div>
                      <div className="flex-1 z-10">
                        <p className={`font-extrabold text-xs leading-tight ${!audienceAll ? 'text-suka-brown' : ''}`}>Pilih Spesifik</p>
                        <p className={`text-[10px] mt-0.5 font-medium ${!audienceAll ? 'text-suka-orange' : 'text-suka-gray-400'}`}>
                          {selectedOutlets.size > 0 ? `${selectedOutlets.size} cabang dipilih` : 'Pilih cabang tertentu'}
                        </p>
                      </div>
                      {!audienceAll && <CheckCircle2 className="w-8 h-8 text-suka-orange absolute -right-2 -bottom-2 opacity-10" />}
                    </button>
                  </div>

                  {!audienceAll && (
                    <div className="p-3 bg-suka-cream/50 rounded-2xl border border-suka-brown/10 space-y-2 mt-2">
                      <div className="flex items-center gap-2">
                        <div className="relative flex-1">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-suka-gray-400" />
                          <input
                            value={outletSearch}
                            onChange={(e) => setOutletSearch(e.target.value)}
                            placeholder="Cari nama cabang..."
                            className="w-full pl-9 pr-3 py-2 rounded-xl text-xs font-bold text-suka-brown bg-white border border-suka-gray-200 outline-none focus:border-suka-orange"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={toggleAllPicker}
                          disabled={filteredPickerOutlets.length === 0}
                          className="shrink-0 px-3 py-2 rounded-xl text-xs font-bold bg-white border border-suka-gray-200 text-suka-brown hover:bg-suka-cream transition-colors"
                        >
                          {allPickerSelected ? 'Batal Semua' : 'Pilih Semua'}
                        </button>
                      </div>

                      <div className="max-h-40 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 gap-1.5 pr-1">
                        {filteredPickerOutlets.map((o) => {
                          const checked = selectedOutlets.has(o.outlet_id)
                          return (
                            <button
                              key={o.outlet_id}
                              type="button"
                              onClick={() => toggleOutlet(o.outlet_id)}
                              className={`flex items-center gap-2 p-2 rounded-xl text-xs font-bold text-left transition-all ${
                                checked ? 'bg-suka-brown text-white shadow-xs' : 'bg-white text-suka-brown border border-suka-gray-100 hover:bg-suka-cream'
                              }`}
                            >
                              <div className={`w-4 h-4 rounded-md border flex items-center justify-center shrink-0 ${checked ? 'bg-white text-suka-brown' : 'border-suka-gray-300'}`}>
                                {checked && <CheckCircle2 className="w-3 h-3" />}
                              </div>
                              <span className="truncate">{cleanName(o.outlet_name)}</span>
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </div>

                {/* ── LANGKAH 2: TARGET & BONUS SALES ── */}
                <div className="space-y-3 pt-4 border-t border-suka-gray-100">
                  <div className="flex items-center gap-2.5">
                    <span className="px-2.5 py-0.5 rounded-md bg-orange-100 text-suka-orange font-black text-[10px] uppercase tracking-widest border border-orange-200 shadow-[0_2px_4px_rgba(234,88,12,0.1)]">Langkah 2</span>
                    <h3 className="font-extrabold text-suka-brown text-sm">Target Omzet & Bonus Sales <span className="text-suka-gray-400 font-normal">(Opsional)</span></h3>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Target Amount */}
                    <div className="space-y-1">
                      <label className="block text-[11px] font-extrabold text-suka-brown uppercase tracking-widest flex items-center gap-1.5">
                        <TargetIcon className="w-4 h-4 text-suka-brown" /> Target Omzet Harian
                      </label>
                      <div className="relative group">
                        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-suka-gray-400 font-extrabold text-xs group-focus-within:text-suka-orange transition-colors">Rp</span>
                        <input
                          inputMode="numeric"
                          value={targetInput ? Number(targetInput).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' }) : ''}
                          onChange={(e) => setTargetInput(e.target.value.replace(/\D/g, ''))}
                          placeholder="misal: 5.000.000"
                          className="w-full pl-9 pr-3 py-2.5 rounded-xl text-sm font-black text-suka-ink bg-white shadow-inner border border-suka-gray-200 outline-none focus:border-suka-orange focus:ring-4 focus:ring-suka-orange/10 transition-all"
                        />
                      </div>
                      <p className="text-[10px] text-suka-gray-400 font-medium">Target omzet penjualan harian untuk kasir</p>
                    </div>

                    {/* Bonus per Item */}
                    <div className="space-y-1">
                      <label className="block text-[11px] font-extrabold text-suka-brown uppercase tracking-widest flex items-center gap-1.5">
                        <Sparkles className="w-4 h-4 text-suka-brown" /> Bonus Per Item Terjual
                      </label>
                      <div className="relative group">
                        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-suka-gray-400 font-extrabold text-xs group-focus-within:text-suka-orange transition-colors">Rp</span>
                        <input
                          inputMode="numeric"
                          value={bonusInput ? Number(bonusInput).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' }) : ''}
                          onChange={(e) => setBonusInput(e.target.value.replace(/\D/g, ''))}
                          placeholder="misal: 150.000"
                          className="w-full pl-9 pr-3 py-2.5 rounded-xl text-sm font-black text-suka-ink bg-white shadow-inner border border-suka-gray-200 outline-none focus:border-suka-orange focus:ring-4 focus:ring-suka-orange/10 transition-all"
                        />
                      </div>
                      <p className="text-[10px] text-suka-gray-400 font-medium">Nominal bonus tambahan per item terjual</p>
                    </div>
                  </div>
                </div>

                {/* ── LANGKAH 3: TULIS PESAN KASIR ── */}
                <div className="space-y-3 pt-4 border-t border-suka-gray-100">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <span className="px-2.5 py-0.5 rounded-md bg-orange-100 text-suka-orange font-black text-[10px] uppercase tracking-widest border border-orange-200 shadow-[0_2px_4px_rgba(234,88,12,0.1)]">Langkah 3</span>
                      <h3 className="font-extrabold text-suka-brown text-sm">Pesan Pengumuman & Motivasi <span className="text-suka-gray-400 font-normal">(Opsional)</span></h3>
                    </div>
                  </div>

                  {/* Jenis Pesan */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {KINDS.map((k) => {
                      const Icon = k.icon
                      const active = kind === k.key
                      return (
                        <button
                          key={k.key}
                          type="button"
                          onClick={() => setKind(k.key)}
                          className={`p-3 rounded-2xl border text-center transition-all flex flex-col items-center justify-center gap-1.5 relative overflow-hidden ${
                            active
                              ? 'bg-white shadow-[0_4px_16px_rgba(0,0,0,0.06)]'
                              : 'bg-suka-gray-50/50 border-suka-gray-200 hover:bg-white hover:shadow-sm'
                          }`}
                          style={{ borderColor: active ? k.color : undefined }}
                        >
                          <div className={`p-2 rounded-xl transition-colors ${active ? 'bg-white' : 'bg-white shadow-xs'}`} style={{ color: active ? k.color : '#9ca3af' }}>
                            <Icon className="w-5 h-5" />
                          </div>
                          <span className={`text-[11px] font-extrabold uppercase tracking-widest ${active ? 'text-suka-ink' : 'text-suka-gray-400'}`}>{k.label}</span>
                          {active && <div className="absolute top-0 left-0 w-full h-1" style={{ backgroundColor: k.color }} />}
                        </button>
                      )
                    })}
                  </div>

                  {/* Template Pesan Cepat */}
                  <div className="space-y-2">
                    <label className="block text-[10px] font-black text-suka-gray-400 uppercase tracking-widest">
                      💡 Template Cepat:
                    </label>
                    <div className="flex flex-wrap gap-2 max-h-36 overflow-y-auto pr-1">
                      {QUOTES.map((q, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => setBody(q)}
                          className="text-left px-3 py-1.5 rounded-full text-[11px] font-bold text-suka-brown bg-suka-cream hover:bg-orange-50 border border-suka-brown/10 hover:border-orange-200 transition-colors flex items-center gap-1.5"
                        >
                          <span className="line-clamp-1 max-w-[200px]">{q}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Input Judul & Isi Pesan */}
                  <div className="space-y-3">
                    <input
                      type="text"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="Judul Pesan (Opsional), contoh: Semangat Pagi!"
                      maxLength={80}
                      className="w-full px-4 py-3 rounded-xl text-xs font-bold text-suka-ink bg-white shadow-inner border border-suka-gray-200 outline-none focus:border-suka-orange focus:ring-4 focus:ring-suka-orange/10 transition-all"
                    />

                    <div>
                      <textarea
                        value={body}
                        onChange={(e) => setBody(e.target.value)}
                        rows={3}
                        placeholder={title.trim() ? 'Tulis isi pesan lengkap di sini...' : 'Tulis pesan untuk kasir... (Kosongkan jika hanya mengatur target omzet)'}
                        maxLength={500}
                        className="w-full p-4 rounded-xl text-xs font-medium text-suka-ink bg-white shadow-inner border border-suka-gray-200 outline-none focus:border-suka-orange focus:ring-4 focus:ring-suka-orange/10 transition-all resize-none"
                      />
                      <p className="text-[10px] text-suka-gray-400 font-semibold text-right mt-1">{body.length}/500 Karakter</p>
                    </div>
                  </div>

                  {/* Masa Berlaku Pesan */}
                  <div className="space-y-2 pt-2">
                    <label className="block text-[11px] font-extrabold text-suka-brown uppercase tracking-widest flex items-center gap-1.5">
                      <Clock className="w-4 h-4 text-suka-brown" /> Masa Berlaku Tampil Pesan
                    </label>
                    <div className="flex flex-wrap gap-1.5">
                      {EXPIRY_PRESETS.map((p) => (
                        <button
                          key={p.key}
                          type="button"
                          onClick={() => setExpiryKey(p.key)}
                          className={`px-3 py-1.5 rounded-full text-[11px] font-bold transition-all border ${
                            expiryKey === p.key
                              ? 'bg-orange-50 text-suka-orange border-orange-200'
                              : 'bg-white text-suka-gray-500 border-suka-gray-200 hover:bg-suka-gray-50'
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
                        className="mt-2 w-full px-4 py-3 rounded-xl text-sm font-bold text-suka-ink bg-white shadow-inner border border-suka-gray-200 outline-none focus:border-suka-orange focus:ring-4 focus:ring-suka-orange/10 transition-all"
                      />
                    )}
                  </div>
                </div>

                {/* ── TOMBOL SUBMIT EKSPLISIT ── */}
                <button
                  type="button"
                  onClick={submit}
                  disabled={
                    sending || 
                    (title.trim().length > 0 && body.trim().length === 0) || 
                    (hasBonus && !hasTarget) || 
                    (!hasTarget && body.trim().length === 0)
                  }
                  className="w-full py-3.5 px-6 rounded-2xl bg-gradient-to-r from-suka-brown to-suka-ink hover:from-suka-ink hover:to-black text-white font-extrabold text-sm shadow-[0_8px_20px_rgba(44,24,16,0.15)] disabled:opacity-40 disabled:cursor-not-allowed transition-all active:scale-[.99] flex items-center justify-center gap-2 mt-4"
                >
                  {sending ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : sent ? (
                    <CheckCircle2 className="w-5 h-5" />
                  ) : (
                    <Send className="w-5 h-5" />
                  )}
                  {sent
                    ? 'Berhasil Terkirim!'
                    : (title.trim().length > 0 && body.trim().length === 0)
                    ? 'Isi Pesan Wajib Diisi (Judul Terisi)'
                    : (hasBonus && !hasTarget)
                    ? 'Isi Target Omzet Terlebih Dahulu'
                    : (!hasTarget && body.trim().length === 0)
                    ? 'Isi Target Omzet ATAU Tulis Pesan'
                    : '🚀 Kirim Target & Pesan ke Kasir'}
                </button>
              </div>
            )}
          </div>

          {/* ── Riwayat Pesan Terkirim ── */}
          <div className="lg:col-span-5 bg-white rounded-2xl border border-suka-gray-200 shadow-sm p-5 sm:p-6 flex flex-col justify-between">
            <div>
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4 pb-3 border-b border-suka-gray-100">
                <div className="flex items-center gap-2">
                  <MessageSquare className="w-5 h-5 text-suka-brown" />
                  <h3 className="font-extrabold text-suka-brown text-base uppercase tracking-tight">Riwayat Pesan Kasir</h3>
                </div>
                <span className="text-[10px] font-black text-suka-brown bg-suka-cream border border-suka-brown/10 px-3 py-1.5 rounded-full">{history.length} Terkirim</span>
              </div>

              {history.length === 0 ? (
                <div className="h-64 flex flex-col items-center justify-center text-suka-gray-400 text-center p-4">
                  <MessageSquare className="w-8 h-8 text-suka-gray-300 mb-2" />
                  <p className="text-xs font-bold">Belum Ada Pesan Terkirim</p>
                  <p className="text-[11px] text-suka-gray-400 mt-1">Pesan motivasi/pengumuman yang Anda kirim akan tampil di sini.</p>
                </div>
              ) : (
                <div className="space-y-3 max-h-[580px] overflow-y-auto pr-1">
                  {history.map((m) => {
                    const meta = KINDS.find((k) => k.key === m.kind) ?? KINDS[0]
                    const Icon = meta.icon
                    return (
                      <div key={m.id} className="p-4 rounded-2xl border border-suka-gray-200/60 bg-white/40 backdrop-blur-xl hover:bg-white/80 hover:shadow-[0_4px_16px_rgba(0,0,0,0.04)] transition-all duration-300 space-y-3 relative overflow-hidden group">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 shadow-sm" style={{ backgroundColor: `${meta.color}15`, color: meta.color }}>
                              <Icon className="w-4 h-4" />
                            </div>
                            <div>
                              <span className="text-[9px] font-black uppercase tracking-widest opacity-80" style={{ color: meta.color }}>{meta.label}</span>
                              {m.title && <h4 className="text-xs font-extrabold text-suka-ink leading-tight mt-0.5">{m.title}</h4>}
                            </div>
                          </div>

                          {m.is_live ? (
                            <span className="text-[9px] font-black text-suka-green border border-suka-green/20 px-2.5 py-1 rounded-full shrink-0 flex items-center gap-1 shadow-[0_2px_8px_rgba(34,197,94,0.15)]">
                              <span className="w-1.5 h-1.5 rounded-full bg-suka-green animate-pulse" /> AKTIF
                            </span>
                          ) : (
                            <span className="text-[9px] font-bold text-suka-gray-400 border border-suka-gray-200 px-2 py-0.5 rounded-full shrink-0">SELESAI</span>
                          )}
                        </div>

                        <p className="text-xs text-suka-gray-600 leading-relaxed font-medium bg-white/60 p-3 rounded-xl shadow-inner border border-white">{m.body}</p>

                        <div className="flex items-center justify-between text-[11px] font-semibold text-suka-gray-400 pt-1">
                          <div className="flex items-center gap-3">
                            <span className="flex items-center gap-1">
                              {m.target_type === 'all' ? <><Globe className="w-3.5 h-3.5 text-suka-brown" /> Semua Cabang</> : <><Store className="w-3.5 h-3.5 text-suka-brown" /> {m.outlet_ids.length} Cabang</>}
                            </span>
                            <span className="flex items-center gap-1 text-suka-gray-500">
                              <Eye className="w-3.5 h-3.5 text-suka-gray-400" /> {m.read_count} Dibaca
                            </span>
                          </div>
                          <span>{new Date(m.created_at).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta',  day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                        </div>

                        {m.target_type === 'outlets' && m.outlet_ids && m.outlet_ids.length > 0 && (
                          <div className="flex flex-wrap gap-1 pt-1">
                            {m.outlet_ids.slice(0, 4).map((id) => (
                              <span key={id} className="text-[10px] font-bold text-suka-brown bg-suka-cream px-2 py-0.5 rounded-md border border-suka-brown/10">
                                {outletNameById.get(id) ?? id}
                              </span>
                            ))}
                            {m.outlet_ids.length > 4 && (
                              <span className="text-[10px] font-bold text-suka-gray-500 bg-suka-gray-100 px-1.5 py-0.5 rounded-md">
                                +{m.outlet_ids.length - 4} lagi
                              </span>
                            )}
                          </div>
                        )}

                        {m.is_live && (
                          <button
                            type="button"
                            onClick={() => deactivateMessage(m.id)}
                            className="w-full py-1.5 rounded-xl bg-red-50 hover:bg-red-100 text-red-700 text-xs font-bold transition-colors flex items-center justify-center gap-1.5"
                          >
                            <Power className="w-3.5 h-3.5" /> Matikan Pesan Ini Dari Kasir
                          </button>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Tabel Target Per Outlet ── */}
      <div className="bg-white rounded-2xl border border-suka-gray-200 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-suka-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white">
          <div>
            <div className="flex items-center gap-2">
              <Store className="w-5 h-5 text-suka-brown" />
              <h3 className="font-extrabold text-suka-brown text-base uppercase tracking-tight">Daftar Target Omzet Per Cabang</h3>
            </div>
            <p className="text-suka-gray-400 text-xs mt-0.5 font-medium">
              Default Global: <b>{rupiah(globalDefault)}</b>/hari · Bonus <b>{rupiah(globalDefaultBonus)}</b>/item
            </p>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-suka-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari nama cabang..."
              className="w-full pl-9 pr-3.5 py-2 rounded-xl text-xs font-bold text-suka-ink bg-suka-cream/40 border border-suka-gray-200 outline-none focus:border-suka-brown focus:bg-white"
            />
          </div>
        </div>

        <div className="overflow-x-auto pb-2">
          <table className="w-full min-w-[800px] text-left text-xs whitespace-nowrap">
            <thead className="bg-suka-cream/50 text-suka-gray-500 uppercase tracking-wider font-extrabold border-b border-suka-gray-100">
              <tr>
                <th className="py-3.5 px-5">Nama Cabang / Outlet</th>
                <th className="py-3.5 px-4">Status Target</th>
                <th className="py-3.5 px-4">Target Omzet Harian</th>
                <th className="py-3.5 px-4">Bonus Per Item</th>
                {!isReadOnly && <th className="py-3.5 px-5 text-right">Aksi Edit Khusus</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-suka-gray-100 font-medium">
              {filteredRows.map((r) => {
                const targetVal = overrideInputs[r.outlet_id] ?? ''
                const bonusVal = overrideBonusInputs[r.outlet_id] ?? ''
                const isSaving = savingKey === r.outlet_id
                const isSaved = savedKey === r.outlet_id

                return (
                  <tr key={r.outlet_id} className="hover:bg-suka-cream/30 transition-colors">
                    <td className="py-3.5 px-5 font-bold text-suka-brown">{cleanName(r.outlet_name)}</td>
                    <td className="py-3.5 px-4">
                      {r.is_override ? (
                        <span className="text-[10px] font-bold text-suka-orange bg-suka-orange/10 border border-suka-orange/20 px-2.5 py-1 rounded-full">
                          Target Khusus
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold text-suka-gray-500 bg-suka-gray-100 px-2.5 py-1 rounded-full">
                          Ikut Global
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 font-black text-suka-ink">
                      {rupiah(r.target_amount)}
                    </td>
                    <td className="py-3.5 px-4 font-bold text-suka-brown">
                      {rupiah(r.per_item_bonus)}
                    </td>

                    {!isReadOnly && (
                      <td className="py-3.5 px-5 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <div className="flex items-center gap-1.5">
                            <input
                              inputMode="numeric"
                              placeholder="Target baru"
                              value={targetVal ? Number(targetVal).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' }) : ''}
                              onChange={(e) => setOverrideInputs({ ...overrideInputs, [r.outlet_id]: e.target.value.replace(/\D/g, '') })}
                              className="w-24 px-2 py-1 rounded-lg text-xs font-bold bg-suka-cream/30 border border-suka-gray-200 outline-none focus:border-suka-brown"
                            />
                            <input
                              inputMode="numeric"
                              placeholder="Bonus"
                              value={bonusVal ? Number(bonusVal).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' }) : ''}
                              onChange={(e) => setOverrideBonusInputs({ ...overrideBonusInputs, [r.outlet_id]: e.target.value.replace(/\D/g, '') })}
                              className="w-20 px-2 py-1 rounded-lg text-xs font-bold bg-suka-cream/30 border border-suka-gray-200 outline-none focus:border-suka-brown"
                            />
                          </div>

                          <button
                            type="button"
                            onClick={() => saveOverride(r.outlet_id)}
                            disabled={isSaving || (!targetVal.trim() && !bonusVal.trim())}
                            className="p-1.5 rounded-lg bg-suka-brown hover:bg-suka-ink disabled:opacity-30 text-white font-bold transition-all shrink-0"
                            title="Simpan Target Khusus Cabang Ini"
                          >
                            {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : isSaved ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Save className="w-3.5 h-3.5" />}
                          </button>

                          {r.is_override && (
                            <button
                              type="button"
                              onClick={() => clearOverride(r.outlet_id)}
                              disabled={isSaving}
                              className="p-1.5 rounded-lg bg-suka-cream hover:bg-red-50 text-suka-brown hover:text-red-600 font-bold transition-all shrink-0 border border-suka-brown/10"
                              title="Reset Kembali ke Target Global"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
