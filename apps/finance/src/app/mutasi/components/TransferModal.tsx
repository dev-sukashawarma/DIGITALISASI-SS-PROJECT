'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { X } from 'lucide-react'
import { Button, CurrencyInput } from '@suka/design-system'
import { useTransferRekening } from '@/hooks/useTransferRekening'
import { rupiah } from '@/lib/format'
import { GRUP_LABEL } from '@/lib/kas/grupKas'
import type { LocationWithBalance } from '@/lib/types'

const inputCls =
  'mt-1 w-full rounded-xl border border-suka-gray-200 px-3 py-2 text-sm outline-none focus:border-suka-orange bg-white'

function namaRekening(l: LocationWithBalance) {
  return `${l.grup ? GRUP_LABEL[l.grup] : l.label} · ${l.kind === 'bank' ? 'Bank' : 'Tunai'}`
}

/** Pemindahan uang sungguhan antar rekening pusat; aturan lengkapnya ditegakkan RPC record_cash_transfer. */
export function TransferModal({
  rekening,
  dariAwal,
  onClose,
}: {
  rekening: LocationWithBalance[]
  dariAwal: string
  onClose: () => void
}) {
  const transfer = useTransferRekening()
  const [dari, setDari] = useState(dariAwal)
  const [ke, setKe] = useState('')
  const [nominal, setNominal] = useState(0)
  const [proofFile, setProofFile] = useState<File | null>(null)
  const [note, setNote] = useState('')

  const asal = rekening.find(r => r.id === dari)
  const tujuan = rekening.find(r => r.id === ke)
  const setorTunai = asal?.grup === 'bahan_baku' && asal.kind === 'cash' && tujuan?.grup === 'bahan_baku' && tujuan.kind === 'bank'
  const galat =
    !asal || !tujuan ? 'Pilih rekening asal dan tujuan'
    : asal.id === tujuan.id ? 'Rekening asal dan tujuan harus berbeda'
    : setorTunai ? 'Setor tunai ke Rekening Bahan Baku Bank pakai fitur Setor ke Bank'
    : nominal <= 0 ? 'Isi nominal transfer'
    : asal.kind === 'cash' && nominal > asal.saldo ? `Saldo ${namaRekening(asal)} tidak mencukupi`
    : !proofFile ? 'Bukti transfer wajib dilampirkan'
    : null

  function simpan() {
    if (galat || !proofFile) return
    transfer.mutate(
      { dari, ke, nominal, proofFile, note },
      {
        onSuccess: () => { toast.success('Transfer tercatat'); onClose() },
        onError: (e: unknown) => toast.error((e as Error).message),
      },
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-md space-y-4 rounded-2xl bg-white p-5 shadow-xl">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-2xl text-suka-brown">Transfer antar Rekening</h2>
          <button type="button" onClick={onClose} aria-label="Tutup" className="text-suka-gray-400 hover:text-suka-ink"><X size={20} /></button>
        </div>

        <label className="block text-sm font-semibold text-suka-gray-600">
          Dari
          <select className={inputCls} value={dari} onChange={e => setDari(e.target.value)}>
            <option value="">— pilih —</option>
            {rekening.map(r => <option key={r.id} value={r.id}>{namaRekening(r)} · {rupiah(r.saldo)}</option>)}
          </select>
        </label>
        <label className="block text-sm font-semibold text-suka-gray-600">
          Ke
          <select className={inputCls} value={ke} onChange={e => setKe(e.target.value)}>
            <option value="">— pilih —</option>
            {rekening.filter(r => r.id !== dari).map(r => <option key={r.id} value={r.id}>{namaRekening(r)} · {rupiah(r.saldo)}</option>)}
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
        <label className="block text-sm font-semibold text-suka-gray-600">
          Bukti transfer (wajib)
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
          <Button onClick={simpan} disabled={!!galat || transfer.isPending}>
            {transfer.isPending ? 'Menyimpan…' : 'Simpan Transfer'}
          </Button>
        </div>
      </div>
    </div>
  )
}
