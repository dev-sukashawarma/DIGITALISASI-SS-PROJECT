'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Button, Spinner } from '@suka/design-system'
import { Truck, Banknote, FileText } from 'lucide-react'
import { useCashOverview } from '@/hooks/useCashData'
import { usePayablePos, useSettlePo } from '@/hooks/useSupplierSettlement'
import { useFinanceRole } from '@/hooks/useFinanceRole'
import { rupiah, tanggalWaktu } from '@/lib/format'
import { StatCard, SectionCard } from '@/components/ui'
import type { CashLocation, CashBalance } from '@/lib/types'
import type { PayablePo as PurchaseOrder } from '@/hooks/useSupplierSettlement'

const PAY_META: Record<string, { label: string; cls: string }> = {
  unpaid: { label: 'Belum Dibayar', cls: 'bg-suka-gray-100 text-suka-gray-600' },
  pending: { label: 'Proses (menunggu approval)', cls: 'bg-amber-100 text-amber-700' },
  paid: { label: 'Lunas', cls: 'bg-emerald-100 text-emerald-700' },
}

export function SupplierView({
  initialLocations,
  initialBalances,
  initialPos,
}: {
  initialLocations?: CashLocation[];
  initialBalances?: CashBalance[];
  initialPos?: PurchaseOrder[];
}) {
  const { locations } = useCashOverview(initialLocations, initialBalances)
  const bankLocations = locations.filter((l) => l.kind === 'bank')
  const { data: pos = [], isLoading } = usePayablePos(initialPos)
  const settle = useSettlePo()
  const { isFinance } = useFinanceRole()

  const [location, setLocation] = useState('')

  const unpaid = pos.filter((p) => p.payment_status === 'unpaid')
  const totalUnpaid = unpaid.reduce((a, p) => a + p.total, 0)

  const handleSettle = (poId: string, nomor: string, total: number) => {
    if (!location) { toast.error('Pilih rekening bank sumber dana dulu'); return }
    if (!confirm(`Bayar ${nomor} sebesar ${rupiah(total)} dari rekening terpilih? Jadi transaksi kas menunggu approval.`)) return
    settle.mutate(
      { poId, location },
      {
        onSuccess: () => toast.success(`${nomor} diajukan untuk pembayaran. Setujui di menu Transaksi.`),
        onError: (e: unknown) => toast.error((e as Error).message),
      }
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-suka-brown">Pembayaran Supplier</h1>
        <p className="text-suka-gray-500">Bayar PO yang sudah diterima. Tiap pembayaran jadi transaksi kas untuk di-approve.</p>
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-suka-gray-200 bg-white p-4 shadow-sm">
        <label className="text-sm font-semibold text-suka-gray-600">
          Sumber Dana (bank)
          <select value={location} onChange={(e) => setLocation(e.target.value)}
            className="mt-1 block min-w-56 rounded-xl border border-suka-gray-200 px-3 py-2 outline-none focus:border-suka-orange">
            <option value="">— pilih rekening —</option>
            {bankLocations.map((l) => <option key={l.id} value={l.id}>{l.label} · {rupiah(l.saldo)}</option>)}
          </select>
        </label>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Total PO Belum Dibayar" value={rupiah(totalUnpaid)} icon={<Banknote size={22} />} tone="orange" hint={`${unpaid.length} PO`} />
        <StatCard label="Total PO Diterima" value={pos.length} icon={<Truck size={22} />} tone="blue" />
        <StatCard label="Sudah Lunas" value={pos.filter((p) => p.payment_status === 'paid').length} icon={<FileText size={22} />} tone="green" />
      </div>

      <SectionCard title="Daftar PO Diterima">
        {isLoading && !initialPos ? (
          <div className="flex justify-center py-8"><Spinner size={28} /></div>
        ) : pos.length === 0 ? (
          <p className="py-6 text-center text-suka-gray-400">
            Belum ada PO berstatus diterima. PO dibuat &amp; diverifikasi di Admin/Kitchen (modul Purchase Order).
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-suka-gray-500">
                  <th className="py-2">Nomor PO</th>
                  <th className="py-2">Supplier</th>
                  <th className="py-2">Waktu</th>
                  <th className="py-2 text-right">Total</th>
                  <th className="py-2">Status</th>
                  <th className="py-2 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-suka-gray-100">
                {pos.map((p) => {
                  const meta = PAY_META[p.payment_status] ?? PAY_META.unpaid
                  return (
                    <tr key={p.id}>
                      <td className="py-3 font-semibold text-suka-ink">{p.nomor_po}</td>
                      <td className="py-3 text-suka-gray-500">{p.supplier_nama}</td>
                      <td className="py-3 text-suka-gray-500">{tanggalWaktu(p.tanggal_po)}</td>
                      <td className="py-3 text-right font-bold text-suka-ink">{rupiah(p.total)}</td>
                      <td className="py-3"><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${meta.cls}`}>{meta.label}</span></td>
                      <td className="py-3 text-right">
                        {isFinance && p.payment_status === 'unpaid' && (
                          <Button onClick={() => handleSettle(p.id, p.nomor_po, p.total)}
                            disabled={settle.isPending}
                            className="px-3 py-1 text-xs">Bayar</Button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>
    </div>
  )
}
