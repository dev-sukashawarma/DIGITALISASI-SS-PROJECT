'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  Banknote,
  CalendarClock,
  CheckCircle2,
  History,
  Loader2,
  LockKeyhole,
  PencilLine,
  Save,
  Store,
  Wallet,
} from 'lucide-react'
import { toast } from 'sonner'
import { PageHeader } from '@/components/ui'
import { OutletCombobox } from '@/components/OutletCombobox'
import { createClient } from '@/lib/supabase'
import { useDialogStore } from '@/lib/dialogStore'
import { overridePettyCashBalance } from './actions'
import type { PettyCashHistory, PettyCashOutlet, PettyCashShift } from './page'

type Props = {
  outlets: PettyCashOutlet[]
  shifts: PettyCashShift[]
  balances: Record<string, number>
  history: PettyCashHistory[]
}
const rupiah = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  maximumFractionDigits: 0,
})

function parseMoney(value: string) {
  return Number(value.replace(/\D/g, '')) || 0
}

function moneyInput(value: string) {
  const amount = parseMoney(value)
  return amount ? amount.toLocaleString('id-ID') : ''
}

function dateTime(value: string | null) {
  if (!value) return 'Belum pernah diubah Admin'
  return new Date(value).toLocaleString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function PettyCashBalanceView({ outlets, shifts, balances, history }: Props) {
  const router = useRouter()
  const { showConfirm } = useDialogStore()
  const [selectedOutletId, setSelectedOutletId] = useState('')
  const [startingBalance, setStartingBalance] = useState('')
  const [currentBalance, setCurrentBalance] = useState('')
  const [note, setNote] = useState('')
  const [isPending, startTransition] = useTransition()

  const selectedOutlet = outlets.find((outlet) => outlet.id === selectedOutletId) ?? null
  const selectedShift = shifts.find((shift) => shift.outlet_id === selectedOutletId) ?? null
  const selectedCurrentBalance = selectedOutletId ? balances[selectedOutletId] ?? 0 : 0
  const selectedHistory = useMemo(
    () => history.filter((row) => row.outlet_id === selectedOutletId),
    [history, selectedOutletId]
  )

  useEffect(() => {
    if (!selectedShift) {
      setStartingBalance('')
      setCurrentBalance('')
      setNote('')
      return
    }

    setStartingBalance(moneyInput(String(selectedShift.starting_petty_cash ?? 0)))
    setCurrentBalance(moneyInput(String(selectedCurrentBalance)))
    setNote('')
  }, [selectedShift, selectedCurrentBalance])

  useEffect(() => {
    if (!selectedOutletId) return
    const supabase = createClient()
    let refreshTimer: ReturnType<typeof setTimeout> | null = null
    const refresh = () => {
      if (refreshTimer) clearTimeout(refreshTimer)
      refreshTimer = setTimeout(() => router.refresh(), 250)
    }

    const channel = supabase
      .channel(`admin_petty_cash_balance_${selectedOutletId}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'shifts',
        filter: `outlet_id=eq.${selectedOutletId}`,
      }, refresh)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'petty_cash_balance_history',
        filter: `outlet_id=eq.${selectedOutletId}`,
      }, refresh)
      .subscribe()

    return () => {
      if (refreshTimer) clearTimeout(refreshTimer)
      supabase.removeChannel(channel)
    }
  }, [router, selectedOutletId])

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (!selectedOutlet || !selectedShift) return

    const nextStarting = parseMoney(startingBalance)
    const nextCurrent = parseMoney(currentBalance)

    if (note.trim().length < 5) {
      toast.error('Catatan perubahan minimal 5 karakter')
      return
    }

    const confirmed = await showConfirm(
      `Modal awal: ${rupiah.format(Number(selectedShift.starting_petty_cash) || 0)} → ${rupiah.format(nextStarting)}\nSaldo saat ini: ${rupiah.format(selectedCurrentBalance)} → ${rupiah.format(nextCurrent)}\n\nCatatan: ${note.trim()}`,
      `Ubah saldo ${selectedOutlet.name}?`,
      'Simpan Perubahan'
    )
    if (!confirmed) return

    startTransition(async () => {
      const result = await overridePettyCashBalance({
        outletId: selectedOutlet.id,
        startingBalance: nextStarting,
        currentBalance: nextCurrent,
        note,
      })

      if (!result.success) {
        toast.error(result.error)
        return
      }

      toast.success('Saldo petty cash disimpan')
      setNote('')
      router.refresh()
    })
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 animate-fade-in">
      <PageHeader
        title="Saldo Petty Cash"
        description="Pilih outlet, lalu ubah modal awal dan saldo yang dipakai kasir."
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
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-orange-50 text-suka-orange">
            <Store size={28} />
          </div>
          <h2 className="text-lg font-black text-suka-brown">Pilih outlet dulu</h2>
          <p className="mx-auto mt-2 max-w-sm text-sm font-medium text-slate-500">
            Data saldo dan histori akan muncul setelah outlet dipilih.
          </p>
        </div>
      ) : !selectedShift ? (
        <div className="rounded-3xl border border-amber-200 bg-amber-50 p-8 text-center">
          <CalendarClock className="mx-auto h-10 w-10 text-amber-600" />
          <h2 className="mt-3 text-lg font-black text-amber-950">Belum ada shift</h2>
          <p className="mt-1 text-sm font-medium text-amber-800">
            Outlet ini perlu membuka shift sebelum saldonya dapat diubah.
          </p>
        </div>
      ) : (
        <>
          <section className="grid gap-4 md:grid-cols-2">
            <div className="rounded-3xl border border-orange-100 bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-orange-50 text-suka-orange">
                  <Banknote size={22} />
                </div>
                <span className={`rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-wide ${selectedShift.status === 'open' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                  Shift {selectedShift.status === 'open' ? 'Aktif' : 'Tutup'}
                </span>
              </div>
              <p className="mt-5 text-xs font-black uppercase tracking-widest text-slate-400">Modal Awal</p>
              <p className="mt-1 text-3xl font-black tracking-tight text-suka-brown">
                {rupiah.format(Number(selectedShift.starting_petty_cash) || 0)}
              </p>
            </div>

            <div className="rounded-3xl border border-emerald-100 bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
                  <Wallet size={22} />
                </div>
                {selectedShift.admin_petty_cash_updated_at && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-3 py-1 text-[11px] font-black text-blue-700">
                    <CheckCircle2 size={13} /> Diubah Admin
                  </span>
                )}
              </div>
              <p className="mt-5 text-xs font-black uppercase tracking-widest text-slate-400">Saldo Saat Ini</p>
              <p className="mt-1 text-3xl font-black tracking-tight text-emerald-700">
                {rupiah.format(selectedCurrentBalance)}
              </p>
              <p className="mt-2 text-xs font-medium text-slate-500">
                {selectedShift.admin_name
                  ? `${selectedShift.admin_name} · ${dateTime(selectedShift.admin_petty_cash_updated_at)}`
                  : dateTime(null)}
              </p>
            </div>
          </section>

          <section className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.8fr)]">
            <form onSubmit={handleSubmit} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
              <div className="mb-6 flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
                  <PencilLine size={20} />
                </div>
                <div>
                  <h2 className="font-black text-suka-brown">Ubah saldo {selectedOutlet.name}</h2>
                  <p className="mt-1 text-xs font-medium text-slate-500">Nilai baru langsung dipakai di POS dan dashboard operasional.</p>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <MoneyField label="Modal Awal" value={startingBalance} onChange={setStartingBalance} />
                <MoneyField label="Saldo Saat Ini" value={currentBalance} onChange={setCurrentBalance} />
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

              <button
                type="submit"
                disabled={isPending}
                className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-suka-brown px-5 py-3.5 text-sm font-black text-white transition hover:bg-suka-brown/90 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
              >
                {isPending ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                {isPending ? 'Menyimpan...' : 'Simpan Saldo'}
              </button>
            </form>

            <aside className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-violet-50 text-violet-600">
                  <History size={20} />
                </div>
                <div>
                  <h2 className="font-black text-suka-brown">Histori Perubahan</h2>
                  <p className="text-xs font-medium text-slate-500">{selectedHistory.length} perubahan tercatat</p>
                </div>
              </div>

              <div className="mt-5 max-h-[560px] space-y-3 overflow-y-auto pr-1">
                {selectedHistory.length === 0 ? (
                  <div className="rounded-2xl bg-slate-50 p-6 text-center">
                    <LockKeyhole className="mx-auto h-6 w-6 text-slate-300" />
                    <p className="mt-2 text-sm font-bold text-slate-500">Belum ada perubahan Admin.</p>
                  </div>
                ) : selectedHistory.map((row) => (
                  <article key={row.id} className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-sm font-black text-slate-800">{row.admin_name || 'Admin'}</p>
                      <time className="shrink-0 text-[11px] font-semibold text-slate-400">{dateTime(row.changed_at)}</time>
                    </div>
                    <p className="mt-2 text-sm font-medium text-slate-600">{row.note}</p>
                    <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                      <HistoryValue label="Modal awal" oldValue={row.old_starting_balance} newValue={row.new_starting_balance} />
                      <HistoryValue label="Saldo" oldValue={row.old_current_balance} newValue={row.new_current_balance} />
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
        <input
          inputMode="numeric"
          required
          value={value}
          onChange={(event) => onChange(moneyInput(event.target.value))}
          placeholder="0"
          className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 pl-12 pr-4 text-lg font-black text-slate-900 outline-none transition focus:border-suka-orange focus:bg-white focus:ring-4 focus:ring-orange-50"
        />
      </div>
    </label>
  )
}

function HistoryValue({ label, oldValue, newValue }: { label: string; oldValue: number; newValue: number }) {
  return (
    <div className="rounded-xl bg-white p-3">
      <p className="font-bold text-slate-400">{label}</p>
      <p className="mt-1 font-black text-slate-700">{rupiah.format(Number(newValue) || 0)}</p>
      <p className="mt-0.5 text-[10px] font-semibold text-slate-400 line-through">{rupiah.format(Number(oldValue) || 0)}</p>
    </div>
  )
}
