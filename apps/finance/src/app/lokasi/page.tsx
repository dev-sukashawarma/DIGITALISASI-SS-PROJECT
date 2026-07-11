'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Button, Spinner } from '@suka/design-system'
import { Plus } from 'lucide-react'
import { useCashOverview } from '@/hooks/useCashData'
import { useCashMutations } from '@/hooks/useCashMutations'
import { useFinanceRole } from '@/hooks/useFinanceRole'
import { rupiah } from '@/lib/format'
import { StatCard, SectionCard } from '@/components/ui'
import { Wallet, Landmark, Banknote } from 'lucide-react'
import { summarizeBalances } from '@/lib/cashSummary'
import type { CashKind } from '@/lib/types'

export default function LokasiPage() {
  const { locations, isLoading } = useCashOverview()
  const { createLocation } = useCashMutations()
  const { isChecker } = useFinanceRole()
  const [showForm, setShowForm] = useState(false)

  const [label, setLabel] = useState('')
  const [kind, setKind] = useState<CashKind>('bank')
  const [bankName, setBankName] = useState('')
  const [accountNo, setAccountNo] = useState('')
  const [holder, setHolder] = useState('')

  const summary = summarizeBalances(locations)

  const reset = () => {
    setLabel(''); setKind('bank'); setBankName(''); setAccountNo(''); setHolder('')
  }

  const handleSubmit = () => {
    if (!label.trim()) { toast.error('Nama lokasi wajib diisi'); return }
    createLocation.mutate(
      {
        label: label.trim(),
        kind,
        bank_name: kind === 'bank' ? bankName.trim() || null : null,
        account_no: kind === 'bank' ? accountNo.trim() || null : null,
        holder_name: holder.trim() || null,
      },
      {
        onSuccess: () => { toast.success('Lokasi kas ditambahkan'); reset(); setShowForm(false) },
        onError: (e: unknown) => toast.error((e as Error).message),
      }
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-suka-brown">Rekening &amp; Kas</h1>
          <p className="text-suka-gray-500">Kelola rekening bank dan kas tunai (mis. Kas Pusat).</p>
        </div>
        {isChecker && (
          <Button onClick={() => setShowForm((s) => !s)} className="flex items-center gap-2">
            <Plus size={16} /> Tambah
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Total" value={rupiah(summary.total)} icon={<Wallet size={22} />} tone="green" />
        <StatCard label="Bank" value={rupiah(summary.totalBank)} icon={<Landmark size={22} />} tone="blue" />
        <StatCard label="Tunai" value={rupiah(summary.totalCash)} icon={<Banknote size={22} />} tone="orange" />
      </div>

      {showForm && isChecker && (
        <SectionCard title="Tambah Lokasi Kas">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="text-sm font-semibold text-suka-gray-600">
              Nama Lokasi
              <input value={label} onChange={(e) => setLabel(e.target.value)}
                placeholder="mis. BCA Operasional / Kas Pusat"
                className="mt-1 w-full rounded-xl border border-suka-gray-200 px-3 py-2 outline-none focus:border-suka-orange" />
            </label>
            <label className="text-sm font-semibold text-suka-gray-600">
              Jenis
              <select value={kind} onChange={(e) => setKind(e.target.value as CashKind)}
                className="mt-1 w-full rounded-xl border border-suka-gray-200 px-3 py-2 outline-none focus:border-suka-orange">
                <option value="bank">Bank</option>
                <option value="cash">Kas Tunai</option>
              </select>
            </label>
            {kind === 'bank' && (
              <>
                <label className="text-sm font-semibold text-suka-gray-600">
                  Nama Bank
                  <input value={bankName} onChange={(e) => setBankName(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-suka-gray-200 px-3 py-2 outline-none focus:border-suka-orange" />
                </label>
                <label className="text-sm font-semibold text-suka-gray-600">
                  No. Rekening
                  <input value={accountNo} onChange={(e) => setAccountNo(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-suka-gray-200 px-3 py-2 outline-none focus:border-suka-orange" />
                </label>
              </>
            )}
            <label className="text-sm font-semibold text-suka-gray-600">
              Pemilik / Atas Nama
              <input value={holder} onChange={(e) => setHolder(e.target.value)}
                className="mt-1 w-full rounded-xl border border-suka-gray-200 px-3 py-2 outline-none focus:border-suka-orange" />
            </label>
          </div>
          <div className="mt-4 flex gap-2">
            <Button onClick={handleSubmit} disabled={createLocation.isPending}>
              {createLocation.isPending ? <Spinner size={16} /> : 'Simpan'}
            </Button>
            <Button onClick={() => { reset(); setShowForm(false) }}
              className="bg-white text-suka-ink border-suka-gray-200 hover:bg-suka-gray-50">Batal</Button>
          </div>
        </SectionCard>
      )}

      <SectionCard title="Daftar Lokasi">
        {isLoading ? (
          <div className="flex justify-center py-8"><Spinner size={28} /></div>
        ) : locations.length === 0 ? (
          <p className="py-6 text-center text-suka-gray-400">Belum ada lokasi kas.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-suka-gray-500">
                  <th className="py-2">Lokasi</th>
                  <th className="py-2">Jenis</th>
                  <th className="py-2">Detail</th>
                  <th className="py-2 text-right">Saldo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-suka-gray-100">
                {locations.map((l) => (
                  <tr key={l.id}>
                    <td className="py-3 font-semibold text-suka-ink">{l.label}</td>
                    <td className="py-3">
                      <span className={`rounded-lg px-2 py-1 text-xs font-bold ${l.kind === 'bank' ? 'bg-blue-50 text-blue-600' : 'bg-orange-50 text-suka-orange'}`}>
                        {l.kind === 'bank' ? 'BANK' : 'TUNAI'}
                      </span>
                    </td>
                    <td className="py-3 text-suka-gray-500">
                      {l.kind === 'bank' ? `${l.bank_name ?? '-'} · ${l.account_no ?? '-'}` : (l.holder_name ?? '-')}
                    </td>
                    <td className={`py-3 text-right font-bold ${l.saldo < 0 ? 'text-red-600' : 'text-suka-ink'}`}>{rupiah(l.saldo)}</td>
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
