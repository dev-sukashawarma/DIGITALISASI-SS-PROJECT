'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { X } from 'lucide-react'
import { Button, CurrencyInput } from '@suka/design-system'
import { useTopUpSaldo } from '@/hooks/useTopUpSaldo'
import { rupiah } from '@/lib/format'
import { GRUP_LABEL } from '@/lib/kas/grupKas'
import type { LocationWithBalance } from '@/lib/types'

const inputCls =
  'mt-1 w-full rounded-xl border border-suka-gray-200 px-3 py-2 text-sm outline-none focus:border-suka-orange bg-white'

function namaRekening(l: LocationWithBalance) {
  return `${l.grup ? GRUP_LABEL[l.grup] : l.label} · ${l.kind === 'bank' ? 'Bank' : 'Tunai'}`
}

/** Uang masuk dari luar sistem ke rekening pusat; aturannya ditegakkan RPC record_top_up_saldo. */
export function TopUpModal({
  rekening,
  rekeningAwal,
  onClose,
}: {
  rekening: LocationWithBalance[]
  rekeningAwal: string
  onClose: () => void
}) {
  const { catat } = useTopUpSaldo()
  const [ke, setKe] = useState(rekeningAwal)
  const [nominal, setNominal] = useState(0)
  const [sumber, setSumber] = useState('')
  const [proofFile, setProofFile] = useState<File | null>(null)
  const [note, setNote] = useState('')

  const tujuan = rekening.find(r => r.id === ke)
  const galat =
    !tujuan ? 'Pilih rekening tujuan'
    : nominal <= 0 ? 'Isi nominal top up'
    : !sumber.trim() ? 'Isi sumber dana (mis. Owner, Atasan)'
    : !proofFile ? 'Bukti top up wajib dilampirkan'
    : null

  function simpan() {
    if (galat || !proofFile) return
    catat.mutate(
      { rekening: ke, nominal, sumber, proofFile, note },
      {
        onSuccess: () => { toast.success('Top up tercatat'); onClose() },
        onError: (e: unknown) => toast.error((e as Error).message),
      },
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-md space-y-4 rounded-2xl bg-white p-5 shadow-xl">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-2xl text-suka-brown">Top Up Saldo</h2>
          <button type="button" onClick={onClose} aria-label="Tutup" className="text-suka-gray-400 hover:text-suka-ink"><X size={20} /></button>
        </div>
        <p className="text-xs text-suka-gray-500">
          Untuk uang yang masuk dari luar (owner, atasan, modal). Pindah uang antar rekening pusat pakai Transfer.
        </p>

        <label className="block text-sm font-semibold text-suka-gray-600">
          Ke rekening
          <select className={inputCls} value={ke} onChange={e => setKe(e.target.value)}>
            <option value="">— pilih —</option>
            {rekening.map(r => <option key={r.id} value={r.id}>{namaRekening(r)} · {rupiah(r.saldo)}</option>)}
          </select>
        </label>
        <div className="text-sm font-semibold text-suka-gray-600">
          <CurrencyInput
            label="Nominal"
            value={nominal || ''}
            onChange={(v) => setNominal(Number(v) || 0)}
            className="mt-1 w-full rounded-xl border border-suka-gray-200 px-3 py-2 outline-none focus:border-suka-orange"
          />
        </div>
        {tujuan && nominal > 0 && (
          <p className="text-xs font-semibold text-emerald-700">Saldo menjadi {rupiah(tujuan.saldo + nominal)}</p>
        )}
        <label className="block text-sm font-semibold text-suka-gray-600">
          Sumber dana
          <input value={sumber} onChange={e => setSumber(e.target.value)} placeholder="mis. Owner, Atasan, Modal" className={inputCls} />
        </label>
        <label className="block text-sm font-semibold text-suka-gray-600">
          Bukti (wajib)
          <input type="file" accept="image/*,application/pdf" onChange={e => setProofFile(e.target.files?.[0] ?? null)}
            className="mt-1 w-full rounded-xl border border-suka-gray-200 px-3 py-2 text-sm" />
        </label>
        <label className="block text-sm font-semibold text-suka-gray-600">
          Catatan (opsional)
          <input value={note} onChange={e => setNote(e.target.value)} className={inputCls} />
        </label>

        {galat && <p className="text-sm font-medium text-red-600">{galat}</p>}

        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Batal</Button>
          <Button onClick={simpan} disabled={!!galat || catat.isPending}>
            {catat.isPending ? 'Menyimpan…' : 'Simpan Top Up'}
          </Button>
        </div>
      </div>
    </div>
  )
}
