'use client'

import { useState } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { Button, Spinner } from '@suka/design-system'
import { Banknote, ArrowRight } from 'lucide-react'
import { useCashOverview, useCashTransactions } from '@/hooks/useCashData'
import { useOutlets, useCashDeposit } from '@/hooks/useCashDeposit'
import { useExpectedCash } from '@/hooks/useExpectedCash'
import { rupiah, tanggal } from '@/lib/format'
import { StatCard, SectionCard, TxStatusBadge } from '@/components/ui'
import { summarizeBalances } from '@/lib/cashSummary'

export default function SetoranPage() {
  const { locations } = useCashOverview()
  const cashLocations = locations.filter((l) => l.kind === 'cash')
  const { data: outlets = [] } = useOutlets()
  const { data: txs = [] } = useCashTransactions(100)
  const deposit = useCashDeposit()

  const [location, setLocation] = useState('')
  const [outletId, setOutletId] = useState('')
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [proofFile, setProofFile] = useState<File | null>(null)
  const [salesDate, setSalesDate] = useState(() => new Date().toISOString().split('T')[0])

  const { data: expectedCash = 0, isLoading: isLoadingExpected } = useExpectedCash(outletId || null, salesDate)

  const summary = summarizeBalances(locations)
  const deposits = txs.filter((t) => t.source_type === 'cash_deposit')

  const reset = () => { setLocation(''); setOutletId(''); setAmount(''); setNote(''); setProofFile(null) }

  const handleSubmit = () => {
    const amt = Number(amount)
    if (!location) { toast.error('Pilih Kas Pusat tujuan'); return }
    if (!amt || amt <= 0) { toast.error('Nominal harus lebih dari 0'); return }
    
    if (outletId && amt !== expectedCash && !note.trim()) {
      toast.error('Nominal fisik berbeda dengan estimasi POS. Wajib mengisi kolom Catatan!')
      return
    }

    deposit.mutate(
      { location, amount: amt, outletId: outletId || null, note: note.trim() || null, proofFile },
      {
        onSuccess: () => { toast.success('Setoran berhasil dicatat & masuk Kas Pusat!'); reset() },
        onError: (e: unknown) => toast.error((e as Error).message),
      }
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-suka-brown">Setoran Tunai</h1>
        <p className="text-suka-gray-500">
          <b>Hop-1:</b> outlet setor tunai ke Kas Pusat. Setelah tervalidasi, setor Kas Pusat ke bank di{' '}
          <Link href="/transfer" className="font-semibold text-suka-orange underline">Transfer</Link> (Hop-2).
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <StatCard label="Kas Tunai (mengendap di Kas Pusat)" value={rupiah(summary.totalCash)} icon={<Banknote size={22} />} tone="orange" hint="Belum disetor ke bank" />
        <div className="flex items-center gap-3 rounded-2xl border border-suka-gray-200 bg-white p-5 shadow-sm">
          <span className="text-sm text-suka-gray-500">Setelah Kas Pusat terisi, setor ke bank:</span>
          <Link href="/transfer"><Button className="flex items-center gap-1 px-3 py-1 text-sm">Transfer <ArrowRight size={14} /></Button></Link>
        </div>
      </div>

      <SectionCard title="Catat Setoran (Outlet → Kas Pusat)">
        {cashLocations.length === 0 ? (
          <p className="py-4 text-center text-amber-600">
            Belum ada lokasi <b>Kas Tunai</b>. Buat dulu di <Link href="/lokasi" className="underline">Rekening &amp; Kas</Link>.
          </p>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <label className="text-sm font-semibold text-suka-gray-600">
                Kas Pusat Tujuan
                <select value={location} onChange={(e) => setLocation(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-suka-gray-200 px-3 py-2 outline-none focus:border-suka-orange">
                  <option value="">— pilih —</option>
                  {cashLocations.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}
                </select>
              </label>
              <label className="text-sm font-semibold text-suka-gray-600">
                Outlet Asal (opsional)
                <select value={outletId} onChange={(e) => setOutletId(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-suka-gray-200 px-3 py-2 outline-none focus:border-suka-orange">
                  <option value="">— tidak ditentukan —</option>
                  {outlets.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                </select>
              </label>
              
              {outletId && (
                <div className="sm:col-span-2 rounded-xl bg-amber-50 p-4 border border-amber-200">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <p className="text-sm text-amber-800 font-medium">Estimasi Penjualan Tunai POS</p>
                      <div className="text-2xl font-bold text-amber-900 mt-1">
                        {isLoadingExpected ? <Spinner size={20} /> : rupiah(expectedCash)}
                      </div>
                    </div>
                    <label className="text-sm font-semibold text-amber-800 shrink-0">
                      Cek Tanggal
                      <input type="date" value={salesDate} onChange={(e) => setSalesDate(e.target.value)}
                        className="ml-2 rounded-lg border border-amber-300 px-2 py-1 outline-none focus:border-amber-500 bg-white" />
                    </label>
                  </div>
                  {amount && Number(amount) !== expectedCash && (
                    <p className="text-xs text-red-600 mt-2 font-medium">
                      ⚠️ Terdapat selisih antara nominal fisik dengan estimasi POS. Harap jelaskan alasannya di kolom Catatan.
                    </p>
                  )}
                </div>
              )}

              <label className="text-sm font-semibold text-suka-gray-600">
                Nominal (Rp)
                <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} min={0}
                  className="mt-1 w-full rounded-xl border border-suka-gray-200 px-3 py-2 outline-none focus:border-suka-orange" />
              </label>
              <label className="text-sm font-semibold text-suka-gray-600">
                Bukti Serah-Terima (opsional)
                <input type="file" accept="image/*" onChange={(e) => setProofFile(e.target.files?.[0] ?? null)}
                  className="mt-1 w-full rounded-xl border border-suka-gray-200 px-3 py-2 text-sm outline-none file:mr-3 file:rounded-lg file:border-0 file:bg-suka-cream file:px-3 file:py-1 file:text-suka-brown" />
              </label>
              <label className="text-sm font-semibold text-suka-gray-600 sm:col-span-2">
                Catatan
                <input value={note} onChange={(e) => setNote(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-suka-gray-200 px-3 py-2 outline-none focus:border-suka-orange" />
              </label>
            </div>
            <div className="mt-4">
              <Button onClick={handleSubmit} disabled={deposit.isPending}>
                {deposit.isPending ? <Spinner size={16} /> : 'Catat Setoran'}
              </Button>
            </div>
          </>
        )}
      </SectionCard>

      <SectionCard title="Setoran Terbaru">
        {deposits.length === 0 ? (
          <p className="py-6 text-center text-suka-gray-400">Belum ada setoran tunai.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-suka-gray-500">
                  <th className="py-2 px-3">Tanggal</th>
                  <th className="py-2 px-3">Kas Tujuan</th>
                  <th className="py-2 px-3">Outlet Asal</th>
                  <th className="py-2 px-3 text-right">Nominal</th>
                  <th className="py-2 px-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-suka-gray-100">
                {deposits.map((t) => (
                  <tr key={t.id}>
                    <td className="py-3 px-3 text-suka-gray-500">{tanggal(t.occurred_at)}</td>
                    <td className="py-3 px-3 font-semibold text-suka-ink">{t.cash_location?.label ?? '—'}</td>
                    <td className="py-3 px-3 text-suka-gray-500">{t.outlet?.name ?? '—'}</td>
                    <td className="py-3 px-3 text-right font-bold text-emerald-600">+{rupiah(t.amount)}</td>
                    <td className="py-3 px-3"><TxStatusBadge status={t.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>
    </div>
  )
}
