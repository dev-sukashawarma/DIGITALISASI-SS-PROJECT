'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { createSupabaseBrowserClient } from '@suka/auth'
import {
  Send, Sparkles, Info, AlertTriangle, Loader2,
  CheckCircle2, Power, Clock, Store, Globe, Eye, Search,
} from 'lucide-react'
import { PageHeader } from '@/components/ui'

type Kind = 'motivasi' | 'info' | 'peringatan'

interface Outlet { id: string; name: string }
interface OverviewRow {
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

const KINDS: { key: Kind; label: string; icon: typeof Info; color: string; bg: string }[] = [
  { key: 'motivasi', label: 'Motivasi', icon: Sparkles, color: '#f29744', bg: 'rgba(242,151,68,0.1)' },
  { key: 'info', label: 'Info', icon: Info, color: '#0a7d2c', bg: 'rgba(10,125,44,0.1)' },
  { key: 'peringatan', label: 'Peringatan', icon: AlertTriangle, color: '#dc2626', bg: 'rgba(220,38,38,0.1)' },
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

export default function MessagesPage() {
  const supabase = createSupabaseBrowserClient()
  const [outlets, setOutlets] = useState<Outlet[]>([])
  const [history, setHistory] = useState<OverviewRow[]>([])
  const [loading, setLoading] = useState(true)

  // compose state
  const [kind, setKind] = useState<Kind>('motivasi')
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [targetAll, setTargetAll] = useState(true)
  const [selectedOutlets, setSelectedOutlets] = useState<Set<string>>(new Set())
  const [outletSearch, setOutletSearch] = useState('')
  const [expiryKey, setExpiryKey] = useState('1d')
  const [customExpiry, setCustomExpiry] = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadHistory = useCallback(async () => {
    const { data, error } = await supabase.from('owner_messages_overview').select('*').limit(50)
    if (error) setError(error.message)
    else setHistory((data ?? []) as OverviewRow[])
  }, [supabase])

  useEffect(() => {
    Promise.all([
      supabase.from('outlets').select('id,name').order('name'),
      supabase.from('owner_messages_overview').select('*').limit(50),
    ]).then(([o, h]) => {
      setOutlets((o.data ?? []) as Outlet[])
      setHistory((h.data ?? []) as OverviewRow[])
      setLoading(false)
    })
  }, [supabase])

  const toggleOutlet = (id: string) => {
    setSelectedOutlets((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const computeExpiry = (): string | null => {
    const preset = EXPIRY_PRESETS.find((p) => p.key === expiryKey)
    if (!preset) return null
    if (preset.ms === 'custom') {
      return customExpiry ? new Date(customExpiry).toISOString() : null
    }
    if (preset.ms === 'forever') {
      return null
    }
    return new Date(Date.now() + (preset.ms as number)).toISOString()
  }

  const canSend = body.trim().length > 0 && (targetAll || selectedOutlets.size > 0) && !sending

  const send = async () => {
    if (!canSend) return
    setSending(true)
    setError(null)
    const { error } = await supabase.rpc('send_owner_message', {
      p_kind: kind,
      p_title: title.trim() || null,
      p_body: body.trim(),
      p_target_type: targetAll ? 'all' : 'outlets',
      p_outlet_ids: targetAll ? null : Array.from(selectedOutlets),
      p_expires_at: computeExpiry(),
    })
    setSending(false)
    if (error) return setError(error.message)
    setSent(true)
    setTimeout(() => setSent(false), 2000)
    setTitle('')
    setBody('')
    setSelectedOutlets(new Set())
    setTargetAll(true)
    await loadHistory()
  }

  const deactivate = async (id: string) => {
    const { error } = await supabase.from('owner_messages').update({ is_active: false }).eq('id', id)
    if (error) return setError(error.message)
    await loadHistory()
  }

  const filteredOutlets = useMemo(() => {
    const q = outletSearch.trim().toLowerCase()
    if (!q) return outlets
    return outlets.filter((o) => cleanName(o.name).toLowerCase().includes(q))
  }, [outlets, outletSearch])

  const allFilteredSelected = filteredOutlets.length > 0 && filteredOutlets.every((o) => selectedOutlets.has(o.id))
  const toggleAllFiltered = () => {
    setSelectedOutlets((prev) => {
      const next = new Set(prev)
      if (allFilteredSelected) filteredOutlets.forEach((o) => next.delete(o.id))
      else filteredOutlets.forEach((o) => next.add(o.id))
      return next
    })
  }

  const outletNameById = useMemo(() => {
    const m = new Map<string, string>()
    outlets.forEach((o) => m.set(o.id, cleanName(o.name)))
    return m
  }, [outlets])

  return (
    <div className="space-y-6">
      <PageHeader title="Pesan ke Kasir" description="Kirim kata-kata mutiara / info ke layar POS kasir (pop-up)." />

      {error && <div className="p-4 bg-red-50 text-red-700 rounded-xl border border-red-100 text-sm">{error}</div>}

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Compose */}
        <div className="lg:col-span-3 bg-white p-5 sm:p-6 rounded-2xl border border-suka-gray-200 shadow-sm space-y-5">
          {/* Kind */}
          <div>
            <label className="block text-[11px] font-bold text-suka-gray-500 uppercase tracking-wider mb-2">Jenis Pesan</label>
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
          </div>

          {/* Quote presets */}
          <div>
            <label className="block text-[11px] font-bold text-suka-gray-500 uppercase tracking-wider mb-2">Kata-kata Mutiara (klik untuk pakai)</label>
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
          </div>

          {/* Title */}
          <div>
            <label className="block text-[11px] font-bold text-suka-gray-500 uppercase tracking-wider mb-2">Judul (opsional)</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="mis. Semangat Pagi!"
              maxLength={80}
              className="w-full px-3 py-2.5 rounded-xl text-sm font-bold text-suka-ink bg-suka-cream/30 border border-suka-gray-200 outline-none focus:border-suka-orange focus:ring-2 focus:ring-suka-orange/10"
            />
          </div>

          {/* Body */}
          <div>
            <label className="block text-[11px] font-bold text-suka-gray-500 uppercase tracking-wider mb-2">Isi Pesan</label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={3}
              placeholder="Tulis pesan untuk kasir..."
              maxLength={500}
              className="w-full px-3 py-2.5 rounded-xl text-sm font-medium text-suka-ink bg-suka-cream/30 border border-suka-gray-200 outline-none focus:border-suka-orange focus:ring-2 focus:ring-suka-orange/10 resize-none"
            />
            <p className="text-[10px] text-suka-gray-400 font-semibold mt-1 text-right">{body.length}/500</p>
          </div>

          {/* Target */}
          <div>
            <label className="block text-[11px] font-bold text-suka-gray-500 uppercase tracking-wider mb-2">Kirim Ke</label>
            <div className="flex gap-2 mb-3">
              <button
                onClick={() => setTargetAll(true)}
                className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-sm font-bold transition-all active:scale-95 border ${
                  targetAll ? 'bg-suka-brown text-white border-transparent' : 'text-suka-gray-500 border-suka-gray-200 hover:border-suka-brown/20'
                }`}
              >
                <Globe className="w-4 h-4" /> Semua Kasir
              </button>
              <button
                onClick={() => setTargetAll(false)}
                className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-sm font-bold transition-all active:scale-95 border ${
                  !targetAll ? 'bg-suka-brown text-white border-transparent' : 'text-suka-gray-500 border-suka-gray-200 hover:border-suka-brown/20'
                }`}
              >
                <Store className="w-4 h-4" /> Pilih Outlet
              </button>
            </div>
            {!targetAll && (
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
                    onClick={toggleAllFiltered}
                    disabled={filteredOutlets.length === 0}
                    className="shrink-0 px-3 py-2 rounded-xl text-xs font-bold border border-suka-gray-200 text-suka-brown hover:border-suka-brown/20 disabled:opacity-40 transition-colors"
                  >
                    {allFilteredSelected ? 'Hapus semua' : 'Pilih semua'}
                  </button>
                </div>
                <div className="border border-suka-gray-200 rounded-xl p-2 max-h-44 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 gap-1">
                  {filteredOutlets.length === 0 ? (
                    <p className="col-span-full px-2 py-3 text-xs text-suka-gray-400 text-center">Outlet tidak ditemukan.</p>
                  ) : (
                    filteredOutlets.map((o) => {
                      const checked = selectedOutlets.has(o.id)
                      return (
                        <button
                          key={o.id}
                          onClick={() => toggleOutlet(o.id)}
                          className={`flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs font-bold text-left transition-colors ${
                            checked ? 'bg-suka-orange/10 text-suka-orange' : 'text-suka-brown hover:bg-suka-cream/60'
                          }`}
                        >
                          <span className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${checked ? 'bg-suka-orange border-suka-orange' : 'border-suka-gray-300'}`}>
                            {checked && <CheckCircle2 className="w-3 h-3 text-white" />}
                          </span>
                          <span className="truncate">{cleanName(o.name)}</span>
                        </button>
                      )
                    })
                  )}
                </div>
                <p className="text-[10px] text-suka-gray-400 font-semibold mt-1.5">{selectedOutlets.size} outlet dipilih</p>
              </>
            )}
          </div>

          {/* Expiry */}
          <div>
            <label className="block text-[11px] font-bold text-suka-gray-500 uppercase tracking-wider mb-2">
              <Clock className="w-3 h-3 inline mr-1" /> Kadaluarsa (berhenti tampil setelah)
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

          {/* Send */}
          <button
            onClick={send}
            disabled={!canSend}
            className="w-full flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-suka-orange hover:bg-amber-600 disabled:opacity-40 text-white font-bold text-sm transition-all active:scale-95 shadow-sm shadow-suka-orange/20"
          >
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : sent ? <CheckCircle2 className="w-4 h-4" /> : <Send className="w-4 h-4" />}
            {sent ? 'Terkirim!' : 'Kirim Pesan'}
          </button>
        </div>

        {/* History */}
        <div className="lg:col-span-2 bg-white p-5 rounded-2xl border border-suka-gray-200 shadow-sm">
          <h3 className="font-extrabold text-suka-brown text-sm tracking-tight uppercase mb-4">Riwayat Kiriman</h3>
          {loading ? (
            <div className="flex items-center justify-center py-8 text-suka-brown font-bold text-sm gap-2">
              <Loader2 className="w-4 h-4 animate-spin" /> Memuat...
            </div>
          ) : history.length === 0 ? (
            <p className="text-sm text-suka-gray-400 text-center py-8">Belum ada pesan terkirim.</p>
          ) : (
            <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1">
              {history.map((m) => {
                const meta = KINDS.find((k) => k.key === m.kind) ?? KINDS[0]
                const Icon = meta.icon
                return (
                  <div key={m.id} className="border border-suka-gray-100 rounded-xl p-3 space-y-2">
                    <div className="flex items-start gap-2">
                      <span className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: meta.bg }}>
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
                        onClick={() => deactivate(m.id)}
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
    </div>
  )
}
