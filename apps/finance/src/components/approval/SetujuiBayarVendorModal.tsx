'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@suka/design-system'
import { X } from 'lucide-react'
import { useSetujuiBayarPo, type PayablePo } from '@/hooks/useSupplierSettlement'
import { rupiah } from '@/lib/format'

/** Setujui pembayaran vendor: bukti wajib, saldo Rekening Bahan Baku Bank terpotong. */
export function SetujuiBayarVendorModal({ po, rekeningLabel, saldo, onClose }: {
  po: PayablePo; rekeningLabel: string; saldo: number; onClose: () => void
}) {
  const setujui = useSetujuiBayarPo()
  const [proofFile, setProofFile] = useState<File | null>(null)
  const [catatan, setCatatan] = useState('')
  const sisa = saldo - po.total

  const simpan = () => {
    if (!proofFile) return
    setujui.mutate({ poId: po.id, proofFile, catatan }, {
      onSuccess: () => { toast.success(`${po.nomor_po} lunas, ${rupiah(po.total)} terpotong dari ${rekeningLabel}`); onClose() },
      onError: (e) => toast.error((e as Error).message),
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-md space-y-4 rounded-2xl bg-white p-5 shadow-xl">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-2xl text-suka-brown">Setujui Pembayaran</h2>
          <button type="button" onClick={onClose} aria-label="Tutup" className="text-suka-gray-400 hover:text-suka-ink"><X size={20} /></button>
        </div>
        <div className="rounded-xl bg-suka-cream/70 px-3 py-2 text-sm text-suka-ink space-y-0.5">
          <div><b>{po.nomor_po}</b> · {po.supplier_nama}</div>
          <div>Dibayar dari {rekeningLabel}: <b>{rupiah(po.total)}</b></div>
          <div className={sisa < 0 ? 'text-red-600 font-semibold' : 'text-emerald-700'}>
            Sisa saldo: {rupiah(sisa)}{sisa < 0 && ' (minus)'}
          </div>
        </div>
        <label className="block text-sm font-semibold text-suka-gray-600">
          Bukti transfer (wajib)
          <input type="file" accept="image/*,application/pdf" onChange={(e) => setProofFile(e.target.files?.[0] ?? null)}
            className="mt-1 w-full rounded-xl border border-suka-gray-200 px-3 py-2 text-sm" />
        </label>
        <label className="block text-sm font-semibold text-suka-gray-600">
          Catatan (opsional)
          <input value={catatan} onChange={(e) => setCatatan(e.target.value)}
            className="mt-1 w-full rounded-xl border border-suka-gray-200 px-3 py-2 text-sm outline-none focus:border-suka-orange" />
        </label>
        {!proofFile && <p className="text-sm font-medium text-red-600">Bukti transfer wajib dilampirkan</p>}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Batal</Button>
          <Button onClick={simpan} disabled={!proofFile || setujui.isPending}>
            {setujui.isPending ? 'Menyimpan…' : 'Setujui & Tandai Lunas'}
          </Button>
        </div>
      </div>
    </div>
  )
}
