'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { X } from 'lucide-react'
import { Button, CurrencyInput } from '@suka/design-system'
import { useSetorBank } from '@/hooks/useSetorBank'
import { hitungSetorBank } from '@/lib/kas/setorBank'
import { rupiah } from '@/lib/format'

/**
 * Setor ke Bank (gabungan lintas outlet). Finance mengisi uang yang diambil dari
 * Kas Setoran Tunai dan nominal yang disetor ke rekening (kelipatan Rp 50.000);
 * sisanya otomatis jadi receh di Kas Office Tunai.
 */
export function SetorBankModal({
  open,
  onClose,
  saldoTunai,
}: {
  open: boolean
  onClose: () => void
  saldoTunai: number
}) {
  const setor = useSetorBank()
  const [diambil, setDiambil] = useState(0)
  const [keBank, setKeBank] = useState(0)
  const [note, setNote] = useState('')
  const [proofFile, setProofFile] = useState<File | null>(null)

  useEffect(() => {
    if (!open) return
    const awal = Math.max(0, saldoTunai)
    setDiambil(awal)
    setKeBank(Math.floor(awal / 50_000) * 50_000)
    setNote('')
    setProofFile(null)
  }, [open, saldoTunai])

  if (!open) return null

  const { receh, galat } = hitungSetorBank({ saldoTunai, diambil, keBank })
  const galatTampil = galat ?? (proofFile ? null : 'Bukti setoran bank wajib dilampirkan')

  const simpan = () => {
    if (galatTampil || !proofFile) return
    setor.mutate(
      { diambil, keBank, proofFile, note },
      {
        onSuccess: () => {
          toast.success(`Disetor ${rupiah(keBank)} ke rekening, receh ${rupiah(receh)} ke Kas Office Tunai`)
          onClose()
        },
        onError: (e) => toast.error((e as Error).message),
      },
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-2xl text-suka-brown">Setor ke Bank</h2>
          <button type="button" onClick={onClose} aria-label="Tutup" className="text-suka-gray-400 hover:text-suka-ink">
            <X size={20} />
          </button>
        </div>

        <p className="text-sm text-suka-gray-500">
          Saldo Kas Setoran Tunai: <b className="text-suka-ink">{rupiah(saldoTunai)}</b>
        </p>

        <div className="text-sm font-semibold text-suka-gray-600">
          <CurrencyInput
            label="Uang diambil dari Kas Setoran Tunai"
            value={diambil || ''}
            onChange={(v) => setDiambil(Number(v) || 0)}
            className="mt-1 w-full rounded-xl border border-suka-gray-200 px-3 py-2 outline-none focus:border-suka-orange"
          />
        </div>

        <div className="text-sm font-semibold text-suka-gray-600">
          <CurrencyInput
            label="Disetor ke bank (kelipatan Rp 50.000)"
            value={keBank || ''}
            onChange={(v) => setKeBank(Number(v) || 0)}
            className="mt-1 w-full rounded-xl border border-suka-gray-200 px-3 py-2 outline-none focus:border-suka-orange"
          />
        </div>

        <div className="rounded-xl bg-suka-cream/70 px-3 py-2 text-sm">
          Receh ke Kas Office Tunai: <b className="text-suka-brown">{rupiah(receh)}</b>
        </div>

        <label className="block text-sm font-semibold text-suka-gray-600">
          Bukti setoran bank (wajib)
          <input
            type="file"
            accept="image/*,application/pdf"
            onChange={(e) => setProofFile(e.target.files?.[0] ?? null)}
            className="mt-1 w-full rounded-xl border border-suka-gray-200 px-3 py-2 text-sm"
          />
        </label>

        <label className="block text-sm font-semibold text-suka-gray-600">
          Catatan (opsional)
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="mt-1 w-full rounded-xl border border-suka-gray-200 px-3 py-2 text-sm outline-none focus:border-suka-orange"
          />
        </label>

        {galatTampil && <p className="text-sm font-medium text-red-600">{galatTampil}</p>}

        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Batal</Button>
          <Button onClick={simpan} disabled={!!galatTampil || setor.isPending}>
            {setor.isPending ? 'Menyimpan…' : 'Simpan Setoran'}
          </Button>
        </div>
      </div>
    </div>
  )
}
