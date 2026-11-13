'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { CheckCircle2, Clock, ExternalLink, CalendarDays } from 'lucide-react'
import { Button } from '@suka/design-system'
import { Card, PageHeader } from '@/components/ui'
import { DatePicker } from '@/components/ui/controls'
import {
  buatAkunMitraSusulan,
  simpanMasaRab,
  simpanTanggalGrandOpening,
} from '@/app/dashboard/pembukaan-outlet/actions'
import { hitungMundur, ringkasLangkahWajib } from '@/lib/pembukaanOutlet/petakan'
import { tautanLangkah } from '@/lib/pembukaanOutlet/tautanLangkah'
import { KATEGORI_KECUALI_RAB_BAWAAN } from '@/lib/pembukaanOutlet/konstanta'
import type { StatusPersiapan } from '@/lib/pembukaanOutlet/types'
import type { OpsiStaf } from './WizardPembukaan'
import { DialogBatalkan, DialogGoLive } from './DialogPembukaan'

const kelasInput =
  'w-full rounded-xl border border-suka-gray-200 bg-white px-3 py-2 text-sm text-suka-ink focus:border-suka-orange focus:outline-none focus:ring-2 focus:ring-suka-orange/30'

function formatTanggal(ymd: string): string {
  return new Date(`${ymd}T00:00:00`).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
}

export function PapanPersiapan({
  status,
  bolehTulis,
  hariIni,
  rab,
  opsiMitra,
}: {
  status: StatusPersiapan
  bolehTulis: boolean
  hariIni: string
  rab: { berlakuSampai: string; kategoriKecuali: string[] } | null
  opsiMitra: OpsiStaf[]
}) {
  const router = useRouter()
  const [dialog, setDialog] = useState<'golive' | 'batal' | null>(null)
  const [tanggalGo, setTanggalGo] = useState(status.tanggalGrandOpening ?? '')
  const [rabSampai, setRabSampai] = useState(rab?.berlakuSampai ?? '')
  const [rabKecuali, setRabKecuali] = useState<string[]>(rab?.kategoriKecuali ?? [...KATEGORI_KECUALI_RAB_BAWAAN])
  const [editRab, setEditRab] = useState(false)
  const [formAkun, setFormAkun] = useState(false)
  const [modeAkun, setModeAkun] = useState<'baru' | 'lama'>('baru')
  const [akun, setAkun] = useState({ nama: '', username: '', password: '', userId: '' })
  const [proses, setProses] = useState(false)

  // Langkah dikerjakan di app lain: segarkan saat admin kembali ke tab ini.
  useEffect(() => {
    const segarkan = () => router.refresh()
    window.addEventListener('focus', segarkan)
    return () => window.removeEventListener('focus', segarkan)
  }, [router])

  const ringkas = ringkasLangkahWajib(status.langkah)
  const peringatanBelum = status.langkah.filter(l => !l.wajib && !l.selesai)
  const wajibBelum = status.langkah.filter(l => l.wajib && !l.selesai)
  const persiapan = status.status === 'pending'
  const langkahMitra = status.langkah.find(l => l.kunci === 'mitra')
  const akunMitraBelum = langkahMitra && !langkahMitra.selesai && langkahMitra.info?.toLowerCase().includes('akun mitra')

  const jalankan = async (aksi: () => Promise<{ ok: boolean; pesan?: string }>, sukses: string) => {
    setProses(true)
    try {
      const h = await aksi()
      if (!h.ok) {
        toast.error(h.pesan ?? 'Gagal')
        return false
      }
      toast.success(sukses)
      router.refresh()
      return true
    } finally {
      setProses(false)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={status.nama}
        description={`${status.jenis === 'mitra' ? 'Mitra' : 'Internal'} · ${
          persiapan ? 'Persiapan' : status.status === 'active' ? 'Aktif' : 'Nonaktif'
        } · ${ringkas.selesai}/${ringkas.total} langkah wajib selesai`}
      >
        <Link href="/dashboard/pembukaan-outlet" className="text-sm font-semibold text-suka-orange hover:underline">
          ← Semua outlet persiapan
        </Link>
      </PageHeader>

      {persiapan && !status.tanggalGrandOpening && (
        <div className="space-y-3 rounded-2xl border border-amber-300 bg-amber-50 p-4">
          <p className="flex items-center gap-2 font-semibold text-amber-900">
            <CalendarDays className="h-5 w-5" /> Tanggal grand opening belum ditentukan
          </p>
          {bolehTulis && (
            <div className="flex flex-wrap items-end gap-3">
              <div className="min-w-[220px]">
                <DatePicker label="Tanggal grand opening" value={tanggalGo} onChange={setTanggalGo} today={hariIni} />
              </div>
              <Button
                disabled={!tanggalGo || proses}
                onClick={() => jalankan(() => simpanTanggalGrandOpening(status.outletId, tanggalGo), 'Tanggal grand opening disimpan')}
              >
                Simpan
              </Button>
            </div>
          )}
        </div>
      )}

      {status.tanggalGrandOpening && (
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm text-suka-ink/60">Grand opening</p>
              <p className="text-lg font-bold text-suka-ink">
                {formatTanggal(status.tanggalGrandOpening)}
                {persiapan && <span className="ml-2 text-suka-orange">{hitungMundur(status.tanggalGrandOpening, hariIni)}</span>}
              </p>
            </div>
            {persiapan && bolehTulis && (
              <div className="flex items-end gap-2">
                <div className="min-w-[200px]">
                  <DatePicker label="Ubah tanggal" value={tanggalGo} onChange={setTanggalGo} today={hariIni} />
                </div>
                <Button
                  variant="secondary"
                  disabled={!tanggalGo || tanggalGo === status.tanggalGrandOpening || proses}
                  onClick={() => jalankan(() => simpanTanggalGrandOpening(status.outletId, tanggalGo), 'Tanggal grand opening diubah')}
                >
                  Simpan
                </Button>
              </div>
            )}
          </div>
        </Card>
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
                const t = tautanLangkah(l.kunci, status.outletId)
                return (
                  <tr key={l.kunci} className="border-b border-suka-gray-100 last:border-0">
                    <td className="px-4 py-3">
                      {l.selesai ? (
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
                      {l.kunci === 'masa_rab' && persiapan && bolehTulis && (
                        <button type="button" onClick={() => setEditRab(v => !v)} className="ml-2 text-xs font-semibold text-suka-orange hover:underline">
                          {l.selesai ? 'Ubah' : 'Atur'}
                        </button>
                      )}
                      {l.kunci === 'mitra' && akunMitraBelum && persiapan && bolehTulis && (
                        <button type="button" onClick={() => setFormAkun(v => !v)} className="ml-2 text-xs font-semibold text-suka-orange hover:underline">
                          Buat akun mitra
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

      {editRab && (
        <Card className="space-y-4">
          <h2 className="font-bold text-suka-ink">Masa RAB</h2>
          <div className="max-w-xs">
            <DatePicker label="RAB berlaku sampai" value={rabSampai} onChange={setRabSampai} today={hariIni} />
          </div>
          <div>
            <p className="mb-2 text-xs text-suka-ink/70">Kategori yang tetap dihitung OPEX:</p>
            <div className="flex flex-wrap gap-2">
              {KATEGORI_KECUALI_RAB_BAWAAN.map(k => {
                const aktif = rabKecuali.includes(k)
                return (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setRabKecuali(aktif ? rabKecuali.filter(x => x !== k) : [...rabKecuali, k])}
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${aktif ? 'bg-suka-brown text-white' : 'bg-suka-gray-100 text-suka-ink/60'}`}
                  >
                    {k}
                  </button>
                )
              })}
            </div>
          </div>
          <Button
            disabled={!rabSampai || proses}
            onClick={async () => {
              if (await jalankan(() => simpanMasaRab(status.outletId, rabSampai, rabKecuali), 'Masa RAB disimpan')) setEditRab(false)
            }}
          >
            Simpan masa RAB
          </Button>
        </Card>
      )}

      {formAkun && (
        <Card className="space-y-4">
          <h2 className="font-bold text-suka-ink">Akun mitra</h2>
          <div className="flex gap-2">
            {(['baru', 'lama'] as const).map(m => (
              <button
                key={m}
                type="button"
                onClick={() => setModeAkun(m)}
                className={`rounded-xl px-3 py-2 text-sm font-semibold ${modeAkun === m ? 'bg-suka-orange text-white' : 'bg-suka-gray-100 text-suka-ink'}`}
              >
                {m === 'baru' ? 'Buat akun baru' : 'Mitra yang sudah ada'}
              </button>
            ))}
          </div>
          {modeAkun === 'baru' ? (
            <div className="grid gap-3 sm:grid-cols-3">
              <input id="papan-akun-nama" className={kelasInput} placeholder="Nama mitra" value={akun.nama} onChange={e => setAkun({ ...akun, nama: e.target.value })} />
              <input id="papan-akun-username" className={kelasInput} placeholder="Username" value={akun.username} onChange={e => setAkun({ ...akun, username: e.target.value })} autoComplete="off" />
              <input id="papan-akun-password" className={kelasInput} placeholder="Password sementara (min. 8)" value={akun.password} onChange={e => setAkun({ ...akun, password: e.target.value })} autoComplete="new-password" />
            </div>
          ) : (
            <select id="papan-akun-lama" className={kelasInput} value={akun.userId} onChange={e => setAkun({ ...akun, userId: e.target.value, nama: opsiMitra.find(m => m.id === e.target.value)?.nama ?? '' })}>
              <option value="">Pilih mitra</option>
              {opsiMitra.map(m => <option key={m.id} value={m.id}>{m.nama}</option>)}
            </select>
          )}
          <Button
            disabled={proses || (modeAkun === 'baru' ? !akun.username.trim() || akun.password.length < 8 || !akun.nama.trim() : !akun.userId)}
            onClick={async () => {
              const ok = await jalankan(
                () =>
                  buatAkunMitraSusulan(
                    status.outletId,
                    modeAkun === 'baru'
                      ? { mode: 'baru', nama: akun.nama, username: akun.username, password: akun.password }
                      : { mode: 'lama', userId: akun.userId },
                    akun.nama || status.nama,
                  ),
                'Akun mitra tertaut',
              )
              if (ok) setFormAkun(false)
            }}
          >
            Simpan akun mitra
          </Button>
        </Card>
      )}

      {persiapan && bolehTulis && (
        <div className="flex flex-wrap justify-end gap-3">
          <Button variant="danger" onClick={() => setDialog('batal')} disabled={proses}>
            Batalkan pembukaan
          </Button>
          {/* Langkah wajib belum selesai tetap boleh Go-Live, tapi lewat jalur paksa
              (alasan wajib, dicatat di riwayat) — keputusan owner 13 Nov. */}
          <Button
            variant={status.siapGoLive ? 'primary' : 'secondary'}
            onClick={() => setDialog('golive')}
            disabled={proses}
          >
            {status.siapGoLive ? 'Go-Live' : `Go-Live paksa (${wajibBelum.length} langkah wajib belum selesai)`}
          </Button>
        </div>
      )}

      {dialog === 'golive' && (
        <DialogGoLive
          outletId={status.outletId}
          nama={status.nama}
          grandOpening={status.tanggalGrandOpening}
          hariIni={hariIni}
          peringatanBelumSelesai={peringatanBelum}
          wajibBelumSelesai={wajibBelum}
          onTutup={() => setDialog(null)}
        />
      )}
      {dialog === 'batal' && <DialogBatalkan outletId={status.outletId} nama={status.nama} onTutup={() => setDialog(null)} />}
    </div>
  )
}
