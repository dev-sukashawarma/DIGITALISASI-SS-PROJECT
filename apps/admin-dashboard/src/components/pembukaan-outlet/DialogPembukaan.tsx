'use client'

import { useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@suka/design-system'
import { DatePicker } from '@/components/ui/controls'
import { batalkanPembukaan, goLiveOutlet } from '@/app/dashboard/pembukaan-outlet/actions'
import { namaKonfirmasiCocok } from '@/lib/pembukaanOutlet/validasi'
import { TOLERANSI_TANGGAL_GO_LIVE_HARI } from '@/lib/pembukaanOutlet/konstanta'
import { dalamToleransiGoLive, tanggalGoLiveBawaan } from '@/lib/pembukaanOutlet/petakan'
import type { LangkahPersiapan } from '@/lib/pembukaanOutlet/types'

const kelasInput =
  'w-full rounded-xl border border-suka-gray-200 bg-white px-3 py-2.5 text-sm text-suka-ink focus:border-suka-orange focus:outline-none focus:ring-2 focus:ring-suka-orange/30'

function Bingkai({ judul, children, onTutup }: { judul: string; children: ReactNode; onTutup: () => void }) {
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

export function DialogGoLive({
  outletId,
  nama,
  grandOpening,
  hariIni,
  peringatanBelumSelesai,
  onTutup,
}: {
  outletId: string
  nama: string
  grandOpening: string | null
  hariIni: string
  peringatanBelumSelesai: LangkahPersiapan[]
  onTutup: () => void
}) {
  const router = useRouter()
  const [tanggal, setTanggal] = useState(tanggalGoLiveBawaan(grandOpening, hariIni, TOLERANSI_TANGGAL_GO_LIVE_HARI))
  const [ketik, setKetik] = useState('')
  const [proses, setProses] = useState(false)
  const tanggalOk = dalamToleransiGoLive(tanggal, hariIni, TOLERANSI_TANGGAL_GO_LIVE_HARI)
  const cocok = namaKonfirmasiCocok(ketik, nama)

  const kirim = async () => {
    setProses(true)
    try {
      const h = await goLiveOutlet(outletId, ketik, tanggal)
      if (!h.ok) {
        toast.error(h.pesan)
        return
      }
      if (h.peringatan) toast.warning(h.peringatan, { duration: 10_000 })
      else toast.success(`${nama} resmi aktif`)
      router.push('/dashboard/outlets')
    } finally {
      setProses(false)
    }
  }

  return (
    <Bingkai judul="Resmikan outlet (Go-Live)" onTutup={onTutup}>
      <p className="text-sm text-suka-ink/80">
        Outlet langsung tampil di POS kasir dan laporan, potong stok menyala, dan masuk reminder WA AM.
        Tampil di aplikasi pelanggan tetap dinyalakan terpisah.
      </p>
      {peringatanBelumSelesai.length > 0 && (
        <div className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
          <p className="font-semibold">{peringatanBelumSelesai.length} langkah peringatan belum selesai:</p>
          <ul className="mt-1 list-disc pl-5">
            {peringatanBelumSelesai.map(l => <li key={l.kunci}>{l.label}</li>)}
          </ul>
        </div>
      )}
      <div>
        <DatePicker label="Tanggal Go-Live" value={tanggal} onChange={setTanggal} today={hariIni} />
        <p className="mt-1 text-xs text-suka-ink/60">
          Jadi tanggal mulai perhitungan mitra. Maksimal {TOLERANSI_TANGGAL_GO_LIVE_HARI} hari dari hari ini.
        </p>
        {!tanggalOk && <p className="mt-1 text-xs font-semibold text-red-600">Tanggal di luar batas {TOLERANSI_TANGGAL_GO_LIVE_HARI} hari.</p>}
      </div>
      <label className="block space-y-1.5">
        <span className="text-sm font-semibold text-suka-ink">
          Ketik <span className="font-mono">{nama}</span> untuk konfirmasi
        </span>
        <input id="golive-konfirmasi" className={kelasInput} value={ketik} onChange={e => setKetik(e.target.value)} autoComplete="off" />
      </label>
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onTutup} disabled={proses}>Batal</Button>
        <Button onClick={kirim} disabled={!cocok || !tanggalOk || proses}>{proses ? 'Memproses…' : 'Go-Live'}</Button>
      </div>
    </Bingkai>
  )
}

const BERESKAN: Record<string, string> = {
  surat_jalan: 'Surat jalan: kembalikan stok ke Gudang Pusat lewat retur/penyesuaian',
  ledger_stok: 'Mutasi stok tercatat: cek saldo di app stok',
  stok_balance: 'Saldo stok outlet',
  outlet_staff: 'Staf masih tertaut: pindahkan outlet mereka di HR',
  expenses: 'Pengeluaran tercatat: cek di Buku Kas',
  petty_cash_expenses: 'Kas kecil tercatat: cek di Buku Kas',
  orders: 'Pesanan tercatat',
  opname: 'Opname tercatat',
}

export function DialogBatalkan({ outletId, nama, onTutup }: { outletId: string; nama: string; onTutup: () => void }) {
  const router = useRouter()
  const [alasan, setAlasan] = useState('')
  const [proses, setProses] = useState(false)
  const [sisa, setSisa] = useState<{ jenis: string; jumlah: number }[] | null>(null)

  const kirim = async () => {
    setProses(true)
    try {
      const h = await batalkanPembukaan(outletId, alasan)
      if (!h.ok) {
        toast.error(h.pesan)
        return
      }
      if (h.peringatan) toast.warning(h.peringatan, { duration: 10_000 })
      if (h.aksi === 'dihapus') {
        toast.success(`${nama} dihapus`)
        router.push('/dashboard/pembukaan-outlet')
      } else {
        toast.success(`${nama} dinonaktifkan`)
        setSisa(h.sisa)
      }
    } finally {
      setProses(false)
    }
  }

  if (sisa) {
    return (
      <Bingkai judul="Outlet dinonaktifkan" onTutup={() => router.push('/dashboard/pembukaan-outlet')}>
        <p className="text-sm text-suka-ink/80">
          Outlet tidak dihapus karena sudah punya data. Bereskan hal berikut secara manual:
        </p>
        <ul className="list-disc space-y-1 pl-5 text-sm text-suka-ink">
          {sisa.map(s => (
            <li key={s.jenis}>
              {BERESKAN[s.jenis] ?? s.jenis} ({s.jumlah} baris)
            </li>
          ))}
        </ul>
        <div className="flex justify-end">
          <Button onClick={() => router.push('/dashboard/pembukaan-outlet')}>Selesai</Button>
        </div>
      </Bingkai>
    )
  }

  return (
    <Bingkai judul="Batalkan pembukaan" onTutup={onTutup}>
      <p className="text-sm text-suka-ink/80">
        Kalau outlet belum punya data apa pun, outlet dihapus. Kalau sudah ada data (surat jalan, staf, biaya),
        outlet dinonaktifkan dan Anda diberi daftar yang perlu dibereskan.
      </p>
      <label className="block space-y-1.5">
        <span className="text-sm font-semibold text-suka-ink">Alasan (wajib)</span>
        <textarea id="batal-alasan" className={kelasInput} rows={3} value={alasan} onChange={e => setAlasan(e.target.value)} />
      </label>
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onTutup} disabled={proses}>Kembali</Button>
        <Button variant="danger" onClick={kirim} disabled={alasan.trim().length < 5 || proses}>
          {proses ? 'Memproses…' : 'Batalkan pembukaan'}
        </Button>
      </div>
    </Bingkai>
  )
}
