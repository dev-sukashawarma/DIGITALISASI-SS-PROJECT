'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { CheckCircle2, Clock, ExternalLink } from 'lucide-react'
import { Button } from '@suka/design-system'
import { Card, PageHeader } from '@/components/ui'
import {
  bukaKembaliOutlet,
  centangLangkah,
  koreksiTanggalTutup,
  nolkanSisaStok,
  tandaiPenutupanSelesai,
} from '@/app/dashboard/penutupan-outlet/actions'
import { hariIniWib } from '@/lib/pembukaanOutlet/konstanta'
import { ringkasPenutupan } from '@/lib/penutupanOutlet/petakan'
import { tautanLangkahPenutupan } from '@/lib/penutupanOutlet/tautanLangkah'
import type { KunciManual, StatusPenutupan } from '@/lib/penutupanOutlet/types'
import { DialogAlasan } from './DialogAlasan'

function formatTanggal(ymd: string): string {
  return new Date(`${ymd}T00:00:00`).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
}

type Dialog = 'buka' | 'koreksi' | 'stok' | null

export function PapanPenutupan({
  status,
  bolehTulis,
  bolehCentang,
}: {
  status: StatusPenutupan
  bolehTulis: boolean
  bolehCentang: boolean
}) {
  const router = useRouter()
  const [dialog, setDialog] = useState<Dialog>(null)
  const [proses, setProses] = useState(false)
  const hariIni = hariIniWib()

  // Langkah dikerjakan di app lain: segarkan saat admin kembali ke tab ini.
  useEffect(() => {
    const segarkan = () => router.refresh()
    window.addEventListener('focus', segarkan)
    return () => window.removeEventListener('focus', segarkan)
  }, [router])

  const ringkas = ringkasPenutupan(status.langkah)
  const selesai = Boolean(status.penutupanSelesaiAt)
  // Outlet yang nonaktif sebelum wizard ada (tanpa alasan_tutup): RPC centang,
  // nolkan stok, dan tandai selesai pasti menolaknya, jadi tombolnya tak ditampilkan.
  const lewatWizard = Boolean(status.alasanTutup)
  const langkahStok = status.langkah.find(l => l.kunci === 'stok')

  const jalankan = async (aksi: () => Promise<{ ok: boolean; pesan?: string; peringatan?: string }>, sukses: string) => {
    setProses(true)
    try {
      const h = await aksi()
      if (!h.ok) {
        toast.error(h.pesan ?? 'Gagal')
        return false
      }
      if (h.peringatan) toast.warning(h.peringatan, { duration: 10_000 })
      else toast.success(sukses)
      router.refresh()
      return true
    } finally {
      setProses(false)
    }
  }

  const centang = (kunci: string, sudah: boolean) =>
    jalankan(
      () => centangLangkah(status.outletId, kunci as KunciManual, '', sudah),
      sudah ? 'Centang dibatalkan' : 'Langkah dicentang',
    )

  return (
    <div className="space-y-6">
      <PageHeader
        title={status.nama}
        description={`${status.jenis === 'mitra' ? 'Mitra' : 'Internal'} · ${
          selesai ? 'Penutupan selesai' : 'Penutupan berjalan'
        } · ${ringkas.selesai}/${ringkas.total} langkah wajib selesai`}
      >
        <Link href="/dashboard/penutupan-outlet" className="text-sm font-semibold text-suka-orange hover:underline">
          ← Semua outlet penutupan
        </Link>
      </PageHeader>

      <Card>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1">
            <p className="text-sm text-suka-ink/60">Terakhir jualan</p>
            <p className="text-lg font-bold text-suka-ink">
              {status.nonaktifAt ? formatTanggal(status.nonaktifAt) : '—'}
            </p>
            <p className="text-sm text-suka-ink/70">Alasan: {status.alasanTutup ?? '—'}</p>
          </div>
          {bolehTulis && !selesai && (
            <Button variant="secondary" onClick={() => setDialog('koreksi')} disabled={proses}>
              Koreksi tanggal tutup
            </Button>
          )}
        </div>
      </Card>

      {!lewatWizard && (
        <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          Outlet ini dinonaktifkan sebelum Wizard Penutupan ada, jadi belum punya catatan penutupan. Checklist di bawah
          hanya untuk dibaca; yang bisa dilakukan di sini hanya membuka kembali outlet.
        </div>
      )}

      {selesai && (
        <div className="rounded-2xl border border-green-300 bg-green-50 p-4 text-sm font-semibold text-green-900">
          Penutupan outlet ini sudah ditandai selesai.
        </div>
      )}

      <Card padded={false}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-suka-gray-200 text-left text-xs uppercase tracking-wide text-suka-ink/60">
                <th className="w-10 px-4 py-3"></th>
                <th className="px-4 py-3">Langkah</th>
                <th className="px-4 py-3">Penanggung jawab</th>
                <th className="px-4 py-3">Sifat</th>
                <th className="px-4 py-3">Keterangan</th>
              </tr>
            </thead>
            <tbody>
              {status.langkah.map(l => {
                const t = tautanLangkahPenutupan(l.kunci)
                const sudahDicentang = Boolean(l.dicentangOleh)
                return (
                  <tr key={l.kunci} className="border-b border-suka-gray-100 last:border-0">
                    <td className="px-4 py-3">
                      {l.manual && bolehCentang && lewatWizard && !selesai ? (
                        <input
                          type="checkbox"
                          aria-label={`Centang: ${l.label}`}
                          className="h-5 w-5 accent-suka-orange"
                          checked={sudahDicentang}
                          disabled={proses}
                          onChange={() => centang(l.kunci, sudahDicentang)}
                        />
                      ) : l.selesai ? (
                        <CheckCircle2 className="h-5 w-5 text-green-600" aria-label="Selesai" />
                      ) : (
                        <Clock className="h-5 w-5 text-suka-ink/40" aria-label="Belum selesai" />
                      )}
                    </td>
                    <td className="px-4 py-3 font-semibold text-suka-ink">
                      {t ? (
                        <a
                          href={t.href}
                          target={t.eksternal ? '_blank' : undefined}
                          rel={t.eksternal ? 'noreferrer' : undefined}
                          className="inline-flex items-center gap-1 hover:text-suka-orange hover:underline"
                        >
                          {l.label}
                          {t.eksternal && <ExternalLink className="h-3.5 w-3.5" />}
                        </a>
                      ) : (
                        l.label
                      )}
                    </td>
                    <td className="px-4 py-3 text-suka-ink/80">{l.penanggungJawab}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                          l.wajib ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {l.wajib ? 'Wajib' : 'Peringatan'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-suka-ink/70">
                      {l.info ?? (l.selesai ? '' : '—')}
                      {l.dicentangOleh && (
                        <span className="block text-xs text-suka-ink/50">
                          Dicentang {l.dicentangOleh}
                          {l.dicentangAt ? ` · ${l.dicentangAt}` : ''}
                        </span>
                      )}
                      {l.kunci === 'stok' && !l.selesai && bolehTulis && lewatWizard && (
                        <button
                          type="button"
                          onClick={() => setDialog('stok')}
                          className="ml-2 text-xs font-semibold text-suka-orange hover:underline"
                        >
                          Nolkan sisa stok
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {bolehTulis && (
        <div className="flex flex-wrap justify-end gap-3">
          <Button variant="secondary" onClick={() => setDialog('buka')} disabled={proses}>
            Buka kembali outlet
          </Button>
          {!selesai && lewatWizard && (
            <Button
              disabled={!status.siapSelesai || proses}
              onClick={() => jalankan(() => tandaiPenutupanSelesai(status.outletId), 'Penutupan ditandai selesai')}
            >
              {status.siapSelesai
                ? 'Tandai Penutupan Selesai'
                : `Tandai selesai (${ringkas.total - ringkas.selesai} langkah wajib belum)`}
            </Button>
          )}
        </div>
      )}

      {dialog === 'buka' && (
        <DialogAlasan
          judul="Buka kembali outlet"
          deskripsi={
            <p>
              Untuk outlet yang salah ditutup. Outlet kembali aktif, tetapi aplikasi pelanggan dan promo{' '}
              <span className="font-semibold">tidak</span> dinyalakan otomatis. Riwayat penutupan tetap tersimpan.
            </p>
          }
          labelTombol="Buka kembali"
          onKirim={async alasan => {
            const ok = await jalankan(() => bukaKembaliOutlet(status.outletId, alasan), `${status.nama} aktif kembali`)
            if (ok) router.push('/dashboard/outlets')
            return ok
          }}
          onTutup={() => setDialog(null)}
        />
      )}
      {dialog === 'koreksi' && (
        <DialogAlasan
          judul="Koreksi tanggal tutup"
          deskripsi={<p>Isi tanggal terakhir outlet ini benar-benar berjualan.</p>}
          labelTombol="Simpan tanggal"
          pakaiTanggal
          tanggalAwal={status.nonaktifAt ?? hariIni}
          hariIni={hariIni}
          onKirim={(alasan, tanggal) =>
            jalankan(() => koreksiTanggalTutup(status.outletId, tanggal, alasan), 'Tanggal tutup dikoreksi')
          }
          onTutup={() => setDialog(null)}
        />
      )}
      {dialog === 'stok' && (
        <DialogAlasan
          judul="Nolkan sisa stok"
          deskripsi={
            <p>
              Sisa stok di sistem (<span className="font-semibold">{langkahStok?.info ?? '—'}</span>) akan dinolkan
              lewat penyesuaian stok. Pakai ini hanya untuk barang yang secara fisik sudah tidak ada; barang yang masih
              layak seharusnya dipindah lewat Mutasi Stok. Laba tidak berubah, nilai persediaan turun.
            </p>
          }
          labelTombol="Nolkan sisa stok"
          varianTombol="danger"
          onKirim={alasan =>
            jalankan(async () => {
              const h = await nolkanSisaStok(status.outletId, alasan)
              return h.ok ? { ok: true, peringatan: undefined } : h
            }, 'Sisa stok dinolkan')
          }
          onTutup={() => setDialog(null)}
        />
      )}
    </div>
  )
}
