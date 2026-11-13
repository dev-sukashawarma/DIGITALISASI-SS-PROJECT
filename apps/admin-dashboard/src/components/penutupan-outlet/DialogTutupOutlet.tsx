'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@suka/design-system'
import { DatePicker } from '@/components/ui/controls'
import { tutupOutlet } from '@/app/dashboard/penutupan-outlet/actions'
import { hariIniWib } from '@/lib/pembukaanOutlet/konstanta'
import { validasiTutup } from '@/lib/penutupanOutlet/validasi'
import { Bingkai, kelasInput } from './DialogAlasan'

function tanggalWib(iso: string): string {
  return new Date(iso).toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' })
}

/**
 * Tutup Outlet: satu-satunya cara menonaktifkan outlet internal/mitra.
 * Outlet langsung nonaktif; pembersihannya dilanjutkan di papan Penutupan.
 */
export function DialogTutupOutlet({
  outlet,
  onTutup,
}: {
  outlet: { id: string; name: string; createdAt: string }
  onTutup: () => void
}) {
  const router = useRouter()
  const hariIni = hariIniWib()
  const [tanggal, setTanggal] = useState(hariIni)
  const [alasan, setAlasan] = useState('')
  const [ketik, setKetik] = useState('')
  const [proses, setProses] = useState(false)
  const galat = validasiTutup(
    { tanggalTerakhir: tanggal, alasan, konfirmasiNama: ketik },
    { namaOutlet: outlet.name, hariIni, tanggalDibuat: tanggalWib(outlet.createdAt) },
  )

  const kirim = async () => {
    setProses(true)
    try {
      const h = await tutupOutlet({ outletId: outlet.id, tanggalTerakhir: tanggal, alasan: alasan.trim() })
      if (!h.ok) {
        toast.error(h.pesan)
        return
      }
      if (h.peringatan) toast.warning(h.peringatan, { duration: 10_000 })
      else toast.success(`${outlet.name} ditutup`)
      router.push(`/dashboard/penutupan-outlet/${outlet.id}`)
    } finally {
      setProses(false)
    }
  }

  return (
    <Bingkai judul="Tutup Outlet" onTutup={onTutup}>
      <div className="space-y-2 text-sm text-suka-ink/80">
        <p>
          <span className="font-bold text-suka-ink">{outlet.name}</span> akan langsung nonaktif. Saat itu juga
          aplikasi pelanggan, Order Online, dan promo outlet ini dimatikan.
        </p>
        <p>
          Crew, sisa stok, surat jalan, dan kas kecil dibereskan sesudahnya di papan Penutupan. Data penjualan yang
          sudah berjalan tidak hilang.
        </p>
      </div>
      <DatePicker label="Tanggal terakhir jualan" value={tanggal} onChange={setTanggal} today={hariIni} />
      <div>
        <label htmlFor="tutup-alasan" className="mb-1 block text-xs font-semibold text-suka-ink/70">
          Alasan tutup
        </label>
        <textarea id="tutup-alasan" className={kelasInput} rows={2} value={alasan} onChange={e => setAlasan(e.target.value)} />
      </div>
      <div>
        <label htmlFor="tutup-nama" className="mb-1 block text-xs font-semibold text-suka-ink/70">
          Ketik nama outlet untuk konfirmasi
        </label>
        <input id="tutup-nama" className={kelasInput} value={ketik} onChange={e => setKetik(e.target.value)} autoComplete="off" />
      </div>
      {galat && (alasan || ketik) && <p className="text-xs text-red-600">{galat}</p>}
      <div className="flex justify-end gap-3">
        <Button variant="secondary" onClick={onTutup} disabled={proses}>
          Batal
        </Button>
        <Button variant="danger" disabled={Boolean(galat) || proses} onClick={kirim}>
          Tutup Outlet
        </Button>
      </div>
    </Bingkai>
  )
}
