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

/** Awal pembukuan baru; sama dengan batas di RPC kas_waktu_dari_tanggal. */
const TANGGAL_PALING_AWAL = '2026-11-01'

function namaRekening(l: LocationWithBalance) {
  return `${l.grup ? GRUP_LABEL[l.grup] : l.label} · ${l.kind === 'bank' ? 'Bank' : 'Tunai'}`
}

function hariIniWib(): string {
  return new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 10)
}

export type ModeDanaLuar = 'top_up' | 'refund'

const TEKS: Record<ModeDanaLuar, {
  judul: string; penjelasan: string; rekening: string; pihak: string; contohPihak: string; simpan: string; sukses: string
}> = {
  top_up: {
    judul: 'Top Up Saldo',
    penjelasan: 'Untuk uang yang masuk dari luar (owner, atasan, modal). Pindah uang antar rekening pusat pakai Transfer.',
    rekening: 'Ke rekening',
    pihak: 'Sumber dana',
    contohPihak: 'mis. Owner, Atasan, Modal',
    simpan: 'Simpan Top Up',
    sukses: 'Top up tercatat',
  },
  refund: {
    judul: 'Refund Dana',
    penjelasan: 'Untuk uang yang dikembalikan ke luar (owner, atasan, pemodal). Pindah uang antar rekening pusat pakai Transfer.',
    rekening: 'Dari rekening',
    pihak: 'Dikembalikan ke',
    contohPihak: 'mis. Owner, Atasan, Pemodal',
    simpan: 'Simpan Refund',
    sukses: 'Refund dana tercatat',
  },
}

/**
 * Uang masuk dari luar (Top Up) atau keluar ke luar (Refund Dana) pada rekening pusat.
 * Aturannya ditegakkan RPC record_top_up_saldo / record_refund_dana.
 */
export function TopUpModal({
  mode = 'top_up',
  rekening,
  rekeningAwal,
  onClose,
}: {
  mode?: ModeDanaLuar
  rekening: LocationWithBalance[]
  rekeningAwal: string
  onClose: () => void
}) {
  const { catat, catatRefund } = useTopUpSaldo()
  const teks = TEKS[mode]
  const hariIni = hariIniWib()
  const [lokasi, setLokasi] = useState(rekeningAwal)
  const [tanggal, setTanggal] = useState(hariIni)
  const [nominal, setNominal] = useState(0)
  const [pihak, setPihak] = useState('')
  const [proofFile, setProofFile] = useState<File | null>(null)
  const [note, setNote] = useState('')

  const rek = rekening.find(r => r.id === lokasi)
  const keluar = mode === 'refund'
  const saldoSesudah = rek ? rek.saldo + (keluar ? -nominal : nominal) : 0
  const galat =
    !rek ? `Pilih rekening ${keluar ? 'asal' : 'tujuan'}`
    : !tanggal ? 'Isi tanggal'
    : tanggal < TANGGAL_PALING_AWAL ? 'Tanggal paling awal 1 November 2026'
    : tanggal > hariIni ? 'Tanggal tidak boleh di masa depan'
    : nominal <= 0 ? `Isi nominal ${keluar ? 'refund' : 'top up'}`
    : keluar && rek.kind === 'cash' && nominal > rek.saldo ? `Saldo ${namaRekening(rek)} tidak mencukupi`
    : !pihak.trim() ? `Isi ${teks.pihak.toLowerCase()} (${teks.contohPihak})`
    : !proofFile ? 'Bukti wajib dilampirkan'
    : null
  const menyimpan = catat.isPending || catatRefund.isPending

  function simpan() {
    if (galat || !proofFile) return
    const opsi = {
      onSuccess: () => { toast.success(teks.sukses); onClose() },
      onError: (e: unknown) => toast.error((e as Error).message),
    }
    if (keluar) catatRefund.mutate({ rekening: lokasi, nominal, tujuan: pihak, proofFile, note, tanggal }, opsi)
    else catat.mutate({ rekening: lokasi, nominal, sumber: pihak, proofFile, note, tanggal }, opsi)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-md space-y-4 rounded-2xl bg-white p-5 shadow-xl">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-2xl text-suka-brown">{teks.judul}</h2>
          <button type="button" onClick={onClose} aria-label="Tutup" className="text-suka-gray-400 hover:text-suka-ink"><X size={20} /></button>
        </div>
        <p className="text-xs text-suka-gray-500">{teks.penjelasan}</p>

        <label className="block text-sm font-semibold text-suka-gray-600">
          {teks.rekening}
          <select className={inputCls} value={lokasi} onChange={e => setLokasi(e.target.value)}>
            <option value="">— pilih —</option>
            {rekening.map(r => <option key={r.id} value={r.id}>{namaRekening(r)} · {rupiah(r.saldo)}</option>)}
          </select>
        </label>
        <label className="block text-sm font-semibold text-suka-gray-600">
          Tanggal
          <input type="date" value={tanggal} min={TANGGAL_PALING_AWAL} max={hariIni}
            onChange={e => setTanggal(e.target.value)} className={inputCls} />
        </label>
        <div className="text-sm font-semibold text-suka-gray-600">
          <CurrencyInput
            label="Nominal"
            value={nominal || ''}
            onChange={(v) => setNominal(Number(v) || 0)}
            className="mt-1 w-full rounded-xl border border-suka-gray-200 px-3 py-2 outline-none focus:border-suka-orange"
          />
        </div>
        {rek && nominal > 0 && (
          <p className={`text-xs font-semibold ${saldoSesudah < 0 ? 'text-red-600' : 'text-emerald-700'}`}>
            Saldo menjadi {rupiah(saldoSesudah)}{saldoSesudah < 0 && ' (minus)'}
          </p>
        )}
        <label className="block text-sm font-semibold text-suka-gray-600">
          {teks.pihak}
          <input value={pihak} onChange={e => setPihak(e.target.value)} placeholder={teks.contohPihak} className={inputCls} />
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
          <Button onClick={simpan} disabled={!!galat || menyimpan}>
            {menyimpan ? 'Menyimpan…' : teks.simpan}
          </Button>
        </div>
      </div>
    </div>
  )
}
