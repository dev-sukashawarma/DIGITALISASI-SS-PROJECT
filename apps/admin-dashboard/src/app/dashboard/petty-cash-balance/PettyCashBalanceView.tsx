'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowRight, CalendarClock, CheckCircle2, History, Loader2, LockKeyhole, PencilLine, Save, Store, Wallet } from 'lucide-react'
import { toast } from 'sonner'
import { PageHeader } from '@/components/ui'
import { OutletCombobox } from '@/components/OutletCombobox'
import { createClient } from '@/lib/supabase'
import { useDialogStore } from '@/lib/dialogStore'
import { adjustPettyCashBalance } from './actions'
import type { PettyCashHistory, PettyCashOutlet, PettyCashShift } from './page'

type Props = {
  outlets: PettyCashOutlet[]
  shifts: PettyCashShift[]
  balances: Record<string, number>
  history: PettyCashHistory[]
}

const rupiah = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 })

function parseMoney(value: string) {
  return Number(value.replace(/\D/g, '')) || 0
}

function moneyInput(value: string) {
  const digits = value.replace(/\D/g, '')
  return digits ? Number(digits).toLocaleString('id-ID') : ''
}

function dateTime(value: string | null) {
  if (!value) return '-'
  return new Date(value).toLocaleString('id-ID', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

function adjustmentLabel(row: PettyCashHistory) {
  if (row.status === 'pending') return 'Menunggu shift berikutnya'
  if (row.status === 'superseded') return 'Diganti penyesuaian baru'
  return row.application_mode === 'active_shift' ? 'Diterapkan ke shift aktif' : 'Dipakai saat shift dibuka'
}

export default function PettyCashBalanceView({ outlets, shifts, balances, history }: Props) {
  const router = useRouter()
  const { showConfirm } = useDialogStore()
  const [selectedOutletId, setSelectedOutletId] = useState('')
  const [targetBalance, setTargetBalance] = useState('')
  const [note, setNote] = useState('')
  const [isPending, startTransition] = useTransition()

  const selectedOutlet = outlets.find((outlet) => outlet.id === selectedOutletId) ?? null
  const selectedShift = shifts.find((shift) => shift.outlet_id === selectedOutletId) ?? null
  const hasActiveShift = selectedShift?.status === 'open'
  const selectedBalance = selectedOutletId ? balances[selectedOutletId] ?? 0 : 0
  const selectedHistory = useMemo(
    () => history.filter((row) => row.outlet_id === selectedOutletId),
    [history, selectedOutletId]
  )

  useEffect(() => {
    if (!selectedOutlet) {
      setTargetBalance('')
      setNote('')
      return
    }
    setTargetBalance(moneyInput(String(selectedBalance)))
    setNote('')
  }, [selectedOutlet, selectedBalance])

  useEffect(() => {
    if (!selectedOutletId) return
    const supabase = createClient()
    let refreshTimer: ReturnType<typeof setTimeout> | null = null
    const refresh = () => {
      if (refreshTimer) clearTimeout(refreshTimer)
      refreshTimer = setTimeout(() => router.refresh(), 250)
    }

    const channel = supabase
      .channel(`admin_petty_cash_adjustment_${selectedOutletId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'shifts', filter: `outlet_id=eq.${selectedOutletId}` }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'petty_cash_adjustments', filter: `outlet_id=eq.${selectedOutletId}` }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'petty_cash_topups', filter: `outlet_id=eq.${selectedOutletId}` }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'petty_cash_expenses', filter: `outlet_id=eq.${selectedOutletId}` }, refresh)
      .subscribe()

    return () => {
      if (refreshTimer) clearTimeout(refreshTimer)
      supabase.removeChannel(channel)
    }
  }, [router, selectedOutletId])

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (!selectedOutlet) return

    const target = parseMoney(targetBalance)
    if (note.trim().length < 5) {
      toast.error('Catatan perubahan minimal 5 karakter')
      return
    }

    const destination = hasActiveShift
      ? 'Sistem akan menyesuaikan saldo shift yang sedang aktif.'
      : 'Sistem akan memakai nilai ini ketika shift berikutnya dibuka.'
    const confirmed = await showConfirm(
      `Saldo berlaku: ${rupiah.format(selectedBalance)}\nPenyesuaian menjadi: ${rupiah.format(target)}\nSelisih: ${rupiah.format(target - selectedBalance)}\n\n${destination}\n\nCatatan: ${note.trim()}`,
      `Sesuaikan petty cash ${selectedOutlet.name}?`,
      'Simpan Penyesuaian'
    )
    if (!confirmed) return

    startTransition(async () => {
      const result = await adjustPettyCashBalance({ outletId: selectedOutlet.id, targetBalance: target, note })
      if (!result.success) {
        toast.error(result.error)
        return
      }
      toast.success(result.result.application_mode === 'active_shift'
        ? 'Saldo shift aktif berhasil disesuaikan'
        : 'Penyesuaian akan dipakai saat shift berikutnya dibuka')
      setNote('')
      router.refresh()
    })
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 animate-fade-in">
      <PageHeader
        title="Penyesuaian Petty Cash"
        description="Pilih outlet dan masukkan satu nilai. Sistem otomatis menentukan penerapannya dari status shift."
        icon={Wallet}
      >
        <OutletCombobox
          value={selectedOutletId}
          outlets={outlets}
          onChange={setSelectedOutletId}
          includeAll={false}
          placeholder="Pilih outlet"
          className="sm:min-w-64"
        />
      </PageHeader>

      {!selectedOutlet ? (
        <div className="rounded-3xl border border-dashed border-suka-orange/30 bg-white px-6 py-16 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-orange-50 text-suka-orange"><Store size={28} /></div>
          <h2 className="text-lg font-black text-suka-brown">Pilih outlet dulu</h2>
          <p className="mx-auto mt-2 max-w-sm text-sm font-medium text-slate-500">Nilai dan histori penyesuaian akan muncul setelah outlet dipilih.</p>
        </div>
      ) : (
        <>
          <section className="grid gap-4 md:grid-cols-2">
            <div className="rounded-3xl border border-emerald-100 bg-white p-6 shadow-sm">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600"><Wallet size={22} /></div>
              <p className="mt-5 text-xs font-black uppercase tracking-widest text-slate-400">Saldo Petty Cash Berlaku</p>
              <p className="mt-1 text-3xl font-black tracking-tight text-emerald-700">{rupiah.format(selectedBalance)}</p>
              <p className="mt-2 text-xs font-medium text-slate-500">Nilai referensi sebelum penyesuaian berikutnya.</p>
            </div>

            <div className={`rounded-3xl border bg-white p-6 shadow-sm ${hasActiveShift ? 'border-blue-100' : 'border-amber-100'}`}>
              <div className={`flex h-11 w-11 items-center justify-center rounded-2xl ${hasActiveShift ? 'bg-blue-50 text-blue-600' : 'bg-amber-50 text-amber-600'}`}>
                {hasActiveShift ? <CheckCircle2 size={22} /> : <CalendarClock size={22} />}
              </div>
              <p className="mt-5 text-xs font-black uppercase tracking-widest text-slate-400">Penerapan Otomatis</p>
              <p className="mt-1 text-lg font-black text-suka-brown">{hasActiveShift ? 'Langsung ke shift aktif' : 'Saat shift berikutnya dibuka'}</p>
              <p className="mt-2 text-xs font-medium text-slate-500">Sistem mengecek ulang status shift ketika penyesuaian disimpan.</p>
            </div>
          </section>

          <section className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.8fr)]">
            <form onSubmit={handleSubmit} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
              <div className="mb-6 flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-slate-700"><PencilLine size={20} /></div>
                <div>
                  <h2 className="font-black text-suka-brown">Sesuaikan petty cash {selectedOutlet.name}</h2>
                  <p className="mt-1 text-xs font-medium text-slate-500">Masukkan saldo yang seharusnya berlaku setelah penyesuaian.</p>
                </div>
              </div>

              <MoneyField label="Penyesuaian Petty Cash" value={targetBalance} onChange={setTargetBalance} />
              <div className={`mt-4 rounded-2xl px-4 py-3 text-sm font-semibold ${hasActiveShift ? 'bg-blue-50 text-blue-800' : 'bg-amber-50 text-amber-900'}`}>
                {hasActiveShift
                  ? 'Shift sedang aktif. Nilai ini akan langsung menjadi saldo petty cash yang berlaku di kasir.'
                  : 'Belum ada shift aktif. Nilai ini akan otomatis dipakai ketika kasir membuka shift.'}
              </div>

              <label className="mt-5 block">
                <span className="text-sm font-black text-slate-700">Catatan Perubahan</span>
                <textarea
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  rows={3}
                  required
                  minLength={5}
                  placeholder="Contoh: Penyesuaian setelah hitung kas fisik"
                  className="mt-2 w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-900 outline-none transition focus:border-suka-orange focus:bg-white focus:ring-4 focus:ring-orange-50"
                />
                <span className="mt-1 block text-xs font-medium text-slate-400">Wajib diisi, minimal 5 karakter.</span>
              </label>

              <button type="submit" disabled={isPending} className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-suka-brown px-5 py-3.5 text-sm font-black text-white transition hover:bg-suka-brown/90 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto">
                {isPending ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                {isPending ? 'Menyimpan...' : 'Simpan Penyesuaian'}
              </button>
            </form>

            <aside className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-violet-50 text-violet-600"><History size={20} /></div>
                <div>
                  <h2 className="font-black text-suka-brown">Histori Penyesuaian</h2>
                  <p className="text-xs font-medium text-slate-500">{selectedHistory.length} perubahan tercatat</p>
                </div>
              </div>

              <div className="mt-5 max-h-[560px] space-y-3 overflow-y-auto pr-1">
                {selectedHistory.length === 0 ? (
                  <div className="rounded-2xl bg-slate-50 p-6 text-center">
                    <LockKeyhole className="mx-auto h-6 w-6 text-slate-300" />
                    <p className="mt-2 text-sm font-bold text-slate-500">Belum ada penyesuaian Admin.</p>
                  </div>
                ) : selectedHistory.map((row) => (
                  <article key={row.id} className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-black text-slate-800">{row.admin_name || 'Admin'}</p>
                        <p className={`mt-1 text-[11px] font-bold ${row.status === 'pending' ? 'text-amber-600' : row.status === 'superseded' ? 'text-slate-400' : 'text-emerald-600'}`}>{adjustmentLabel(row)}</p>
                      </div>
                      <time className="shrink-0 text-[11px] font-semibold text-slate-400">{dateTime(row.created_at)}</time>
                    </div>
                    <p className="mt-2 text-sm font-medium text-slate-600">{row.note}</p>
                    <div className="mt-3 flex items-center gap-2 rounded-xl bg-white p-3 text-xs">
                      <span className="font-black text-slate-500">{rupiah.format(Number(row.balance_before) || 0)}</span>
                      <ArrowRight size={14} className="text-slate-300" />
                      <span className="font-black text-slate-800">{rupiah.format(Number(row.target_balance) || 0)}</span>
                      <span className={`ml-auto font-black ${Number(row.adjustment_amount) >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                        {Number(row.adjustment_amount) >= 0 ? '+' : ''}{rupiah.format(Number(row.adjustment_amount) || 0)}
                      </span>
                    </div>
                  </article>
                ))}
              </div>
            </aside>
          </section>
        </>
      )}
    </div>
  )
}

function MoneyField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="block">
      <span className="text-sm font-black text-slate-700">{label}</span>
      <div className="relative mt-2">
        <span className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-sm font-black text-slate-400">Rp</span>
        <input inputMode="numeric" required value={value} onChange={(event) => onChange(moneyInput(event.target.value))} placeholder="0" className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 pl-12 pr-4 text-lg font-black text-slate-900 outline-none transition focus:border-suka-orange focus:bg-white focus:ring-4 focus:ring-orange-50" />
      </div>
    </label>
  )
}
