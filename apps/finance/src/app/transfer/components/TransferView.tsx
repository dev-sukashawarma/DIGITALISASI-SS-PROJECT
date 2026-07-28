'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Button, Spinner, CurrencyInput } from '@suka/design-system'
import { ArrowRight } from 'lucide-react'
import { useCashOverview } from '@/hooks/useCashData'
import { useCashMutations } from '@/hooks/useCashMutations'
import { useFinanceRole } from '@/hooks/useFinanceRole'
import { rupiah } from '@/lib/format'
import { SectionCard } from '@/components/ui'
import type { CashLocation, CashBalance } from '@/lib/types'

export function TransferView({
  initialLocations,
  initialBalances,
}: {
  initialLocations?: CashLocation[];
  initialBalances?: CashBalance[];
}) {
  const { locations } = useCashOverview(initialLocations, initialBalances)
  const { transfer } = useCashMutations()
  const { isChecker } = useFinanceRole()

  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')

  const fromLoc = locations.find((l) => l.id === from)
  const toLoc = locations.find((l) => l.id === to)

  const handleTransfer = () => {
    const amt = Number(amount)
    if (!from || !to) { toast.error('Pilih lokasi asal & tujuan'); return }
    if (from === to) { toast.error('Asal & tujuan tidak boleh sama'); return }
    if (!amt || amt <= 0) { toast.error('Nominal harus lebih dari 0'); return }
    transfer.mutate(
      { from, to, amount: amt, note: note.trim() || null },
      {
        onSuccess: () => { toast.success('Transfer tercatat & terrekonsiliasi'); setFrom(''); setTo(''); setAmount(''); setNote('') },
        onError: (e: unknown) => toast.error((e as Error).message),
      }
    )
  }

  if (!isChecker) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-amber-800">
        Transfer antar-lokasi hanya bisa dilakukan oleh <b>owner/admin</b> (checker).
      </div>
    )
  }

  return (
    <div className="space-y-8 font-sans">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <p className="text-suka-orange font-bold uppercase tracking-wider text-sm mb-1">Arus Kas</p>
          <h1 className="font-display text-4xl md:text-5xl text-suka-brown tracking-wide">Transfer Kas</h1>
          <p className="text-suka-ink/60 mt-2 font-medium">Pindah dana antar lokasi, mis. setor <b>Kas Pusat → Bank</b>. Tercatat dua-kaki, langsung terrekonsiliasi.</p>
        </div>
      </div>

      <SectionCard title="Transfer Baru">
        <div className="grid grid-cols-1 items-end gap-4 sm:grid-cols-2">
          <label className="text-sm font-semibold text-suka-gray-600">
            Dari
            <select value={from} onChange={(e) => setFrom(e.target.value)}
              className="mt-1 w-full rounded-xl border border-suka-gray-200 px-3 py-2 outline-none focus:border-suka-orange">
              <option value="">— pilih —</option>
              {locations.map((l) => <option key={l.id} value={l.id}>{l.label} · {rupiah(l.saldo)}</option>)}
            </select>
          </label>
          <label className="text-sm font-semibold text-suka-gray-600">
            Ke
            <select value={to} onChange={(e) => setTo(e.target.value)}
              className="mt-1 w-full rounded-xl border border-suka-gray-200 px-3 py-2 outline-none focus:border-suka-orange">
              <option value="">— pilih —</option>
              {locations.filter((l) => l.id !== from).map((l) => <option key={l.id} value={l.id}>{l.label} · {rupiah(l.saldo)}</option>)}
            </select>
          </label>
          <div className="text-sm font-semibold text-suka-gray-600">
            <CurrencyInput
              label="Nominal (Rp)"
              value={amount}
              onChange={(v) => setAmount(String(v || ''))}
              className="mt-1 w-full rounded-xl border border-suka-gray-200 px-3 py-2 outline-none focus:border-suka-orange"
            />
          </div>
          <label className="text-sm font-semibold text-suka-gray-600">
            Catatan
            <input value={note} onChange={(e) => setNote(e.target.value)}
              className="mt-1 w-full rounded-xl border border-suka-gray-200 px-3 py-2 outline-none focus:border-suka-orange" />
          </label>
        </div>

        {fromLoc && toLoc && (
          <div className="mt-4 flex items-center justify-center gap-3 rounded-xl bg-suka-cream px-4 py-3 text-sm">
            <span className="font-semibold text-suka-ink">{fromLoc.label}</span>
            <ArrowRight size={16} className="text-suka-orange" />
            <span className="font-semibold text-suka-ink">{toLoc.label}</span>
            {Number(amount) > 0 && <span className="ml-2 font-bold text-suka-brown">{rupiah(Number(amount))}</span>}
          </div>
        )}

        <div className="mt-4">
          <Button onClick={handleTransfer} disabled={transfer.isPending}>
            {transfer.isPending ? <Spinner size={16} /> : 'Proses Transfer'}
          </Button>
        </div>
      </SectionCard>
    </div>
  )
}
