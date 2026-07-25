'use client'

import { usePendingPos, useApprovePo, useRejectPo } from '@/hooks/usePoApproval'
import { rupiah, tanggalWaktu } from '@/lib/format'

export default function PoApprovalPage() {
  const { data: pos = [], isLoading } = usePendingPos()
  const approve = useApprovePo()
  const reject = useRejectPo()

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-xl font-black text-slate-900 mb-1">PO Menunggu Approval</h1>
      <p className="text-sm text-slate-500 mb-4">Setujui komitmen pembelian sebelum PO dikirim ke vendor.</p>
      {isLoading ? (
        <div className="text-slate-500">Memuat…</div>
      ) : pos.length === 0 ? (
        <div className="p-6 text-center text-slate-400 rounded-xl border border-slate-200 bg-white">
          Tidak ada PO menunggu approval.
        </div>
      ) : (
        <div className="space-y-3">
          {pos.map((p) => (
            <div
              key={p.id}
              className="rounded-xl border border-slate-200 bg-white p-4 flex items-center justify-between gap-3"
            >
              <div className="min-w-0">
                <div className="font-bold text-slate-900 truncate">
                  {p.nomor_po} · {p.supplier_nama}
                </div>
                <div className="text-sm text-slate-500">
                  {tanggalWaktu(p.tanggal_po)} · {rupiah(p.total)}
                </div>
              </div>
              <div className="flex gap-2 shrink-0">
                <button
                  onClick={() => approve.mutate(p.id)}
                  disabled={approve.isPending || reject.isPending}
                  className="px-4 py-2 rounded-lg bg-emerald-600 text-white font-bold text-sm disabled:opacity-40"
                >
                  Setujui
                </button>
                <button
                  onClick={() => reject.mutate({ poId: p.id })}
                  disabled={approve.isPending || reject.isPending}
                  className="px-4 py-2 rounded-lg border border-slate-200 font-bold text-sm text-slate-700 disabled:opacity-40"
                >
                  Tolak
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
