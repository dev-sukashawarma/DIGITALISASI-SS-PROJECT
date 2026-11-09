'use client'

import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@suka/design-system'
import { X } from 'lucide-react'
import { useSetujuiBayarPo, type PayablePo } from '@/hooks/useSupplierSettlement'
import { rupiah } from '@/lib/format'
import { GRUP_LABEL, URUTAN_GRUP, lokasiGrup } from '@/lib/kas/grupKas'
import type { LocationWithBalance } from '@/lib/types'

const inputCls =
  'mt-1 w-full rounded-xl border border-suka-gray-200 px-3 py-2 text-sm outline-none focus:border-suka-orange bg-white'

/**
 * Setujui pembayaran vendor: pilih rekening yang benar-benar dipakai mentransfer, bukti wajib.
 * Bawaan = rekening yang dipilih saat Approval PO, kalau tidak ada Rekening Bahan Baku Bank.
 * Aturan (rekening pusat aktif, tunai tak melebihi saldo) ditegakkan RPC setujui_bayar_po.
 */
export function SetujuiBayarVendorModal({ po, locations, onClose, onGagal }: {
  po: PayablePo
  locations: LocationWithBalance[]
  onClose: () => void
  /** Dipanggil saat RPC menolak (mis. sudah diputuskan di tab lain) agar daftar disegarkan. */
  onGagal?: () => void
}) {
  const setujui = useSetujuiBayarPo()
  const rekeningPusat = useMemo(() => URUTAN_GRUP.flatMap((g) => lokasiGrup(locations, g)), [locations])
  const bawaan =
    (po.cash_location_id && rekeningPusat.find((r) => r.id === po.cash_location_id)?.id) ||
    lokasiGrup(locations, 'bahan_baku', 'bank')[0]?.id ||
    rekeningPusat[0]?.id ||
    ''
  const [pilihan, setPilihan] = useState('')
  const lokasiId = pilihan || bawaan
  const rek = rekeningPusat.find((r) => r.id === lokasiId)
  const [proofFile, setProofFile] = useState<File | null>(null)
  const [catatan, setCatatan] = useState('')
  const sisa = (rek?.saldo ?? 0) - po.total
  const galat =
    !rek ? 'Pilih rekening sumber dana'
    : rek.kind === 'cash' && sisa < 0 ? `Saldo ${rek.label} tidak mencukupi`
    : !proofFile ? 'Bukti transfer wajib dilampirkan'
    : null

  const simpan = () => {
    if (galat || !proofFile || !rek) return
    setujui.mutate({ poId: po.id, proofFile, catatan, cashLocationId: rek.id }, {
      onSuccess: () => { toast.success(`${po.nomor_po} lunas, ${rupiah(po.total)} terpotong dari ${rek.label}`); onClose() },
      onError: (e) => { toast.error((e as Error).message); onGagal?.() },
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
          <div>Nominal: <b>{rupiah(po.total)}</b></div>
        </div>
        <label className="block text-sm font-semibold text-suka-gray-600">
          Dibayar dari
          <select className={inputCls} value={lokasiId} onChange={(e) => setPilihan(e.target.value)}>
            {rekeningPusat.length === 0 && <option value="">— Belum ada rekening pusat aktif —</option>}
            {URUTAN_GRUP.map((g) => {
              const daftar = rekeningPusat.filter((r) => r.grup === g)
              if (daftar.length === 0) return null
              return (
                <optgroup key={g} label={GRUP_LABEL[g]}>
                  {daftar.map((r) => (
                    <option key={r.id} value={r.id}>{r.label} · {rupiah(r.saldo)}</option>
                  ))}
                </optgroup>
              )
            })}
          </select>
          {rek && (
            <span className={`mt-1.5 block text-xs font-semibold ${sisa < 0 ? 'text-red-600' : 'text-emerald-700'}`}>
              Sisa saldo: {rupiah(sisa)}{sisa < 0 && ' (minus)'}
            </span>
          )}
        </label>
        <label className="block text-sm font-semibold text-suka-gray-600">
          Bukti transfer (wajib)
          <input type="file" accept="image/*,application/pdf" onChange={(e) => setProofFile(e.target.files?.[0] ?? null)}
            className="mt-1 w-full rounded-xl border border-suka-gray-200 px-3 py-2 text-sm" />
        </label>
        <label className="block text-sm font-semibold text-suka-gray-600">
          Catatan (opsional)
          <input value={catatan} onChange={(e) => setCatatan(e.target.value)} className={inputCls} />
        </label>
        {galat && <p className="text-sm font-medium text-red-600">{galat}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Batal</Button>
          <Button onClick={simpan} disabled={!!galat || setujui.isPending}>
            {setujui.isPending ? 'Menyimpan…' : 'Setujui & Tandai Lunas'}
          </Button>
        </div>
      </div>
    </div>
  )
}
