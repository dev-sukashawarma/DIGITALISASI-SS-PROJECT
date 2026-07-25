'use client'

import { useRouter } from 'next/navigation'
import { usePurchaseRequests, useRejectPr, type PurchaseRequest } from '@/hooks/usePurchaseRequest'

const URG: Record<string, string> = {
  mendesak: 'bg-red-100 text-red-700', normal: 'bg-suka-cream text-suka-brown', rendah: 'bg-gray-100 text-gray-600',
}
const ST: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-700', jadi_po: 'bg-emerald-100 text-emerald-700', ditolak: 'bg-gray-100 text-gray-500',
}

export default function PermintaanPage() {
  const { rows, loading } = usePurchaseRequests()
  const reject = useRejectPr()
  const router = useRouter()

  if (loading) return <div className="p-6 text-suka-brown">Memuat permintaan…</div>

  const konversi = (r: PurchaseRequest) => {
    sessionStorage.setItem('po_draft_items', JSON.stringify([
      { bahan_baku_id: r.bahan_baku_id, nama: r.nama_bebas ?? '', satuan: r.satuan, qty: r.qty, pr_id: r.id },
    ]))
    router.push('/dashboard/pembelian/new?from=pr')
  }

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">
      <h1 className="text-xl font-bold text-suka-brown mb-4">Permintaan Pembelian</h1>
      <div className="overflow-x-auto rounded-xl border border-suka-outline bg-white">
        <table className="w-full text-sm">
          <thead className="bg-suka-cream text-suka-brown">
            <tr>
              <th className="p-3 text-left">Barang</th>
              <th className="p-3 text-right">Qty</th>
              <th className="p-3 text-left">Alasan</th>
              <th className="p-3 text-center">Urgensi</th>
              <th className="p-3 text-center">Status</th>
              <th className="p-3 text-center">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-suka-outline/50">
                <td className="p-3 font-medium">{r.nama_bebas ?? r.bahan_baku_id}</td>
                <td className="p-3 text-right">{r.qty} {r.satuan ?? ''}</td>
                <td className="p-3">{r.alasan ?? '—'}</td>
                <td className="p-3 text-center"><span className={`px-2 py-0.5 rounded-full text-xs font-bold ${URG[r.urgensi]}`}>{r.urgensi}</span></td>
                <td className="p-3 text-center"><span className={`px-2 py-0.5 rounded-full text-xs font-bold ${ST[r.status]}`}>{r.status}</span></td>
                <td className="p-3 text-center">
                  {r.status === 'pending' && (
                    <div className="flex gap-2 justify-center">
                      <button onClick={() => konversi(r)} className="px-3 py-1 rounded bg-suka-orange text-white text-xs font-bold">Jadikan PO</button>
                      <button onClick={() => reject.mutate(r.id)} className="px-3 py-1 rounded border border-suka-outline text-xs">Tolak</button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={6} className="p-6 text-center text-suka-brown/60">Belum ada permintaan.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}
