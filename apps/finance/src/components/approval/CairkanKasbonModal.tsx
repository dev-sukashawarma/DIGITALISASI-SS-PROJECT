'use client'

import { useMemo, useState } from 'react'
import { Button } from '@suka/design-system'
import { X } from 'lucide-react'
import { rupiah } from '@/lib/format'
import { lokasiGrup } from '@/lib/kas/grupKas'
import { bolehCairkan, type KasbonMenunggu } from '@/lib/approval/kasbon'
import type { LocationWithBalance } from '@/lib/types'

const inputCls =
  'mt-1 w-full rounded-xl border border-suka-gray-200 px-3 py-2 text-sm outline-none focus:border-suka-orange bg-white'

/**
 * Cairkan kasbon yang sudah disetujui HR. Nominal hanya ditentukan HR (read-only di sini).
 * Sumber: Rekening Petty Cash Bank atau Tunai. Aturan (peran, pencair ≠ penyetuju HR,
 * saldo cukup, bukti wajib) ditegakkan RPC finance_cairkan_kasbon.
 */
export function CairkanKasbonModal({ isOpen, kasbon, locations, userId, onClose, onCairkan, isPending = false }: {
  isOpen: boolean
  kasbon: KasbonMenunggu
  locations: LocationWithBalance[]
  userId: string | null
  onClose: () => void
  onCairkan: (cashLocationId: string, proofFile: File) => Promise<void>
  isPending?: boolean
}) {
  const rekening = useMemo(() => lokasiGrup(locations, 'petty_cash'), [locations])
  const [lokasiId, setLokasiId] = useState('')
  const [proofFile, setProofFile] = useState<File | null>(null)
  if (!isOpen) return null

  const rek = rekening.find((r) => r.id === lokasiId)
  const izin = bolehCairkan(kasbon, userId)
  const nominal = Number(kasbon.amount) || 0
  const galat =
    !izin.boleh ? izin.alasan
    : !rek ? 'Pilih rekening sumber dana'
    : rek.saldo < nominal ? `Saldo ${rek.label} tidak mencukupi`
    : !proofFile ? 'Bukti wajib dilampirkan'
    : null
  const labelBukti = rek?.kind === 'cash' ? 'Foto tanda terima bertanda tangan karyawan (wajib)' : 'Bukti transfer (wajib)'
  const cicilan = Number(kasbon.installment_months) || 1

  const simpan = () => {
    if (galat || !rek || !proofFile) return
    void onCairkan(rek.id, proofFile)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-md space-y-4 rounded-2xl bg-white p-5 shadow-xl">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-2xl text-suka-brown">Cairkan Kasbon</h2>
          <button type="button" onClick={onClose} aria-label="Tutup" className="text-suka-gray-400 hover:text-suka-ink"><X size={20} /></button>
        </div>
        <div className="space-y-0.5 rounded-xl bg-suka-cream/70 px-3 py-2 text-sm text-suka-ink">
          <div><b>{kasbon.staff_nama ?? '-'}</b>{kasbon.outlet_nama ? ` · ${kasbon.outlet_nama}` : ''}</div>
          <div>Nominal disetujui HR: <b>{rupiah(nominal)}</b>{cicilan > 1 ? ` · ${cicilan}x cicilan` : ''}</div>
          {kasbon.reason && <div className="text-suka-gray-600">Alasan: {kasbon.reason}</div>}
          {kasbon.approval_note && <div className="text-suka-gray-600">Catatan HR: {kasbon.approval_note}</div>}
          {kasbon.penyetuju_nama && <div className="text-xs text-suka-gray-500">Disetujui HR oleh {kasbon.penyetuju_nama}</div>}
        </div>
        <label className="block text-sm font-semibold text-suka-gray-600">
          Dicairkan dari
          <select className={inputCls} value={lokasiId} onChange={(e) => setLokasiId(e.target.value)}>
            <option value="">— Pilih rekening —</option>
            {rekening.map((r) => (
              <option key={r.id} value={r.id}>{r.label} · {rupiah(r.saldo)}</option>
            ))}
          </select>
        </label>
        <label className="block text-sm font-semibold text-suka-gray-600">
          {labelBukti}
          <input type="file" accept="image/*,application/pdf" onChange={(e) => setProofFile(e.target.files?.[0] ?? null)}
            className="mt-1 w-full rounded-xl border border-suka-gray-200 px-3 py-2 text-sm" />
        </label>
        {galat && <p className="text-sm font-medium text-red-600">{galat}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Batal</Button>
          <Button onClick={simpan} disabled={!!galat || isPending}>
            {isPending ? 'Menyimpan…' : 'Cairkan'}
          </Button>
        </div>
      </div>
    </div>
  )
}
