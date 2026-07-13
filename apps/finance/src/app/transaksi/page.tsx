'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Button, Spinner, CurrencyInput } from '@suka/design-system'
import { Plus, Check, X, CheckCircle } from 'lucide-react'
import { useCashOverview, useCashTransactions } from '@/hooks/useCashData'
import { useCashMutations } from '@/hooks/useCashMutations'
import { useFinanceRole } from '@/hooks/useFinanceRole'
import { rupiah, tanggal } from '@/lib/format'
import { SectionCard, TxStatusBadge } from '@/components/ui'
import type { CashDirection } from '@/lib/types'

export default function TransaksiPage() {
  const { locations } = useCashOverview()
  const { data: txs = [], isLoading } = useCashTransactions(100)
  const { submit, approve, reject, markPaid } = useCashMutations()
  const { isChecker } = useFinanceRole()

  const [showForm, setShowForm] = useState(false)
  const [location, setLocation] = useState('')
  const [direction, setDirection] = useState<CashDirection>('out')
  const [amount, setAmount] = useState('')
  const [category, setCategory] = useState('')
  const [note, setNote] = useState('')

  const resetForm = () => { setLocation(''); setDirection('out'); setAmount(''); setCategory(''); setNote('') }

  const handleSubmit = () => {
    const amt = Number(amount)
    if (!location) { toast.error('Pilih lokasi kas'); return }
    if (!amt || amt <= 0) { toast.error('Nominal harus lebih dari 0'); return }
    submit.mutate(
      { location, direction, amount: amt, category: category.trim() || 'manual', note: note.trim() || null },
      {
        onSuccess: () => { toast.success('Transaksi diajukan (menunggu approval)'); resetForm(); setShowForm(false) },
        onError: (e: unknown) => toast.error((e as Error).message),
      }
    )
  }

  const onApprove = (id: string) =>
    approve.mutate(id, { onSuccess: () => toast.success('Transaksi disetujui'), onError: (e: unknown) => toast.error((e as Error).message) })
  const onReject = (id: string) => {
    const reason = window.prompt('Alasan penolakan (opsional):') ?? undefined
    reject.mutate({ id, reason }, { onSuccess: () => toast.success('Transaksi ditolak'), onError: (e: unknown) => toast.error((e as Error).message) })
  }
  const onMarkPaid = (id: string) => {
    if (!confirm('Tandai sudah dibayar & rekonsiliasi? Saldo akan bergerak.')) return
    markPaid.mutate({ id }, { onSuccess: () => toast.success('Transaksi terrekonsiliasi'), onError: (e: unknown) => toast.error((e as Error).message) })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-suka-brown">Transaksi Kas</h1>
          <p className="text-suka-gray-500">Ajukan pengeluaran/pemasukan manual, lalu proses maker-checker.</p>
        </div>
        <Button onClick={() => setShowForm((s) => !s)} className="flex items-center gap-2">
          <Plus size={16} /> Transaksi Manual
        </Button>
      </div>

      {showForm && (
        <SectionCard title="Transaksi Manual Baru">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="text-sm font-semibold text-suka-gray-600">
              Lokasi Kas
              <select value={location} onChange={(e) => setLocation(e.target.value)}
                className="mt-1 w-full rounded-xl border border-suka-gray-200 px-3 py-2 outline-none focus:border-suka-orange">
                <option value="">— pilih —</option>
                {locations.map((l) => <option key={l.id} value={l.id}>{l.label} ({l.kind === 'bank' ? 'Bank' : 'Tunai'})</option>)}
              </select>
            </label>
            <label className="text-sm font-semibold text-suka-gray-600">
              Arah
              <select value={direction} onChange={(e) => setDirection(e.target.value as CashDirection)}
                className="mt-1 w-full rounded-xl border border-suka-gray-200 px-3 py-2 outline-none focus:border-suka-orange">
                <option value="out">Kas Keluar</option>
                <option value="in">Kas Masuk</option>
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
              Kategori
              <input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="mis. operasional"
                className="mt-1 w-full rounded-xl border border-suka-gray-200 px-3 py-2 outline-none focus:border-suka-orange" />
            </label>
            <label className="text-sm font-semibold text-suka-gray-600 sm:col-span-2">
              Catatan
              <input value={note} onChange={(e) => setNote(e.target.value)}
                className="mt-1 w-full rounded-xl border border-suka-gray-200 px-3 py-2 outline-none focus:border-suka-orange" />
            </label>
          </div>
          <div className="mt-4 flex gap-2">
            <Button onClick={handleSubmit} disabled={submit.isPending}>
              {submit.isPending ? <Spinner size={16} /> : 'Ajukan'}
            </Button>
            <Button onClick={() => { resetForm(); setShowForm(false) }}
              className="bg-white text-suka-ink border-suka-gray-200 hover:bg-suka-gray-50">Batal</Button>
          </div>
        </SectionCard>
      )}

      <SectionCard title="Daftar Transaksi">
        {isLoading ? (
          <div className="flex justify-center py-8"><Spinner size={28} /></div>
        ) : txs.length === 0 ? (
          <p className="py-6 text-center text-suka-gray-400">Belum ada transaksi.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-suka-gray-500">
                  <th className="py-2 px-3">Tanggal</th>
                  <th className="py-2 px-3">Lokasi</th>
                  <th className="py-2 px-3">Kategori</th>
                  <th className="py-2 px-3 text-right">Nominal</th>
                  <th className="py-2 px-3">Status</th>
                  <th className="py-2 px-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-suka-gray-100">
                {txs.map((t) => (
                  <tr key={t.id}>
                    <td className="py-3 px-3 text-suka-gray-500">{tanggal(t.occurred_at)}</td>
                    <td className="py-3 px-3 font-semibold text-suka-ink">{t.cash_location?.label ?? '—'}</td>
                    <td className="py-3 px-3 text-suka-gray-500">{t.category ?? t.source_type}</td>
                    <td className={`py-3 px-3 text-right font-bold ${t.direction === 'in' ? 'text-emerald-600' : 'text-red-600'}`}>
                      {t.direction === 'in' ? '+' : '−'}{rupiah(t.amount)}
                    </td>
                    <td className="py-3 px-3"><TxStatusBadge status={t.status} /></td>
                    <td className="py-3 px-3">
                      <div className="flex justify-end gap-1">
                        {isChecker && t.status === 'pending_approval' && (
                          <>
                            <button onClick={() => onApprove(t.id)} title="Setujui"
                              className="rounded-lg bg-emerald-50 p-2 text-emerald-600 hover:bg-emerald-100"><Check size={16} /></button>
                            <button onClick={() => onReject(t.id)} title="Tolak"
                              className="rounded-lg bg-red-50 p-2 text-red-600 hover:bg-red-100"><X size={16} /></button>
                          </>
                        )}
                        {t.status === 'approved' && (
                          <button onClick={() => onMarkPaid(t.id)} title="Tandai dibayar & rekonsiliasi"
                            className="flex items-center gap-1 rounded-lg bg-blue-50 px-2 py-1 text-xs font-bold text-blue-600 hover:bg-blue-100">
                            <CheckCircle size={14} /> Bayar
                          </button>
                        )}
                      </div>
                    </td>
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
