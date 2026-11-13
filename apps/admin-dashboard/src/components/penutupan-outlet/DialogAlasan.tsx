'use client'

import { useState, type ReactNode } from 'react'
import { Button } from '@suka/design-system'
import { DatePicker } from '@/components/ui/controls'
import { validasiAlasan } from '@/lib/penutupanOutlet/validasi'

export const kelasInput =
  'w-full rounded-xl border border-suka-gray-200 bg-white px-3 py-2.5 text-sm text-suka-ink focus:border-suka-orange focus:outline-none focus:ring-2 focus:ring-suka-orange/30'

export function Bingkai({ judul, children, onTutup }: { judul: string; children: ReactNode; onTutup: () => void }) {
  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={judul}
      onClick={onTutup}
    >
      <div className="w-full max-w-lg space-y-4 rounded-2xl bg-white p-6 shadow-xl" onClick={e => e.stopPropagation()}>
        <h2 className="font-display text-2xl text-suka-brown">{judul}</h2>
        {children}
      </div>
    </div>
  )
}

/**
 * Dialog satu isian alasan (opsional + tanggal). Dipakai Buka kembali,
 * Koreksi tanggal tutup, dan Nolkan sisa stok.
 */
export function DialogAlasan({
  judul,
  deskripsi,
  labelTombol,
  varianTombol = 'primary',
  pakaiTanggal,
  tanggalAwal,
  hariIni,
  onKirim,
  onTutup,
}: {
  judul: string
  deskripsi: ReactNode
  labelTombol: string
  varianTombol?: 'primary' | 'danger'
  pakaiTanggal?: boolean
  tanggalAwal?: string
  hariIni?: string
  /** Kembalikan true bila berhasil (dialog ditutup). */
  onKirim: (alasan: string, tanggal: string) => Promise<boolean>
  onTutup: () => void
}) {
  const [alasan, setAlasan] = useState('')
  const [tanggal, setTanggal] = useState(tanggalAwal ?? '')
  const [proses, setProses] = useState(false)
  const galat = validasiAlasan(alasan)
  const siap = !galat && (!pakaiTanggal || Boolean(tanggal))

  return (
    <Bingkai judul={judul} onTutup={onTutup}>
      <div className="text-sm text-suka-ink/80">{deskripsi}</div>
      {pakaiTanggal && (
        <DatePicker label="Tanggal terakhir jualan" value={tanggal} onChange={setTanggal} today={hariIni} />
      )}
      <div>
        <label htmlFor="dialog-alasan" className="mb-1 block text-xs font-semibold text-suka-ink/70">
          Alasan
        </label>
        <textarea
          id="dialog-alasan"
          className={kelasInput}
          rows={3}
          value={alasan}
          onChange={e => setAlasan(e.target.value)}
        />
        {alasan && galat && <p className="mt-1 text-xs text-red-600">{galat}</p>}
      </div>
      <div className="flex justify-end gap-3">
        <Button variant="secondary" onClick={onTutup} disabled={proses}>
          Batal
        </Button>
        <Button
          variant={varianTombol}
          disabled={!siap || proses}
          onClick={async () => {
            setProses(true)
            try {
              if (await onKirim(alasan.trim(), tanggal)) onTutup()
            } finally {
              setProses(false)
            }
          }}
        >
          {labelTombol}
        </Button>
      </div>
    </Bingkai>
  )
}
