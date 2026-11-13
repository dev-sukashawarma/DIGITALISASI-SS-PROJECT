'use client'

import { useMemo, useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Store, HeartHandshake, MapPin, Loader2 } from 'lucide-react'
import { Button } from '@suka/design-system'
import { Card, PageHeader } from '@/components/ui'
import { DatePicker, TimeInput } from '@/components/ui/controls'
import { resolveLokasiGoogleMaps } from '@/app/dashboard/outlets/lokasiActions'
import { buatOutletBaru } from '@/app/dashboard/pembukaan-outlet/actions'
import { validasiInputWizard, type KunciGalat } from '@/lib/pembukaanOutlet/validasi'
import { BAWAAN_MITRA, KATEGORI_KECUALI_RAB_BAWAAN } from '@/lib/pembukaanOutlet/konstanta'
import type { InputWizard, JenisOutlet } from '@/lib/pembukaanOutlet/types'

export interface OpsiStaf {
  id: string
  nama: string
}

type Langkah = 'jenis' | 'data' | 'staf' | 'mitra'

const LABEL_LANGKAH: Record<Langkah, string> = {
  jenis: 'Jenis outlet',
  data: 'Data outlet',
  staf: 'AM & Leader',
  mitra: 'Khusus Mitra',
}

/** Kunci galat yang diperiksa di tiap langkah sebelum boleh lanjut. */
const GALAT_PER_LANGKAH: Record<Langkah, KunciGalat[]> = {
  jenis: [],
  data: ['nama', 'jamTutup', 'tanggalGrandOpening'],
  staf: ['amStaffId'],
  mitra: ['mitra', 'mitra.akun', 'rab'],
}

const kelasInput =
  'w-full rounded-xl border border-suka-gray-200 bg-white px-3 py-2.5 text-sm text-suka-ink focus:border-suka-orange focus:outline-none focus:ring-2 focus:ring-suka-orange/30'

function Isian({ label, galat, bantuan, children }: { label: string; galat?: string; bantuan?: string; children: ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-semibold text-suka-ink">{label}</span>
      {children}
      {bantuan && !galat && <span className="block text-xs text-suka-ink/60">{bantuan}</span>}
      {galat && <span className="block text-xs font-semibold text-red-600">{galat}</span>}
    </label>
  )
}

function angka(teks: string): number {
  const n = Number(teks.replace(/[^\d,.-]/g, '').replace(/\./g, '').replace(',', '.'))
  return Number.isFinite(n) ? n : NaN
}

export function WizardPembukaan({
  am,
  leader,
  mitra,
  hariIni,
}: {
  am: OpsiStaf[]
  leader: OpsiStaf[]
  mitra: OpsiStaf[]
  hariIni: string
}) {
  const router = useRouter()
  const [langkah, setLangkah] = useState<Langkah>('jenis')
  const [menyimpan, setMenyimpan] = useState(false)
  const [mencariLokasi, setMencariLokasi] = useState(false)
  const [linkMaps, setLinkMaps] = useState('')
  const [galatTampil, setGalatTampil] = useState<Partial<Record<KunciGalat, string>>>({})

  const [jenis, setJenis] = useState<JenisOutlet>('internal')
  const [nama, setNama] = useState('')
  const [alamat, setAlamat] = useState('')
  const [lat, setLat] = useState<number | null>(null)
  const [lng, setLng] = useState<number | null>(null)
  const [telepon, setTelepon] = useState('')
  const [region, setRegion] = useState('')
  const [jamBuka, setJamBuka] = useState('14:00')
  const [jamTutup, setJamTutup] = useState('22:00')
  const [grandOpening, setGrandOpening] = useState('')
  const [amId, setAmId] = useState('')
  const [leaderId, setLeaderId] = useState('')

  const [nilaiInvestasi, setNilaiInvestasi] = useState('')
  const [bagiHasil, setBagiHasil] = useState(String(BAWAAN_MITRA.persentaseBagiHasil))
  const [fee, setFee] = useState(String(BAWAAN_MITRA.managementFee))
  const [namaMitra, setNamaMitra] = useState('')
  const [modeAkun, setModeAkun] = useState<'baru' | 'lama'>('baru')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [akunLama, setAkunLama] = useState('')
  const [pakaiRab, setPakaiRab] = useState(true)
  const [rabSampai, setRabSampai] = useState('')
  const [kategoriKecuali, setKategoriKecuali] = useState<string[]>([...KATEGORI_KECUALI_RAB_BAWAAN])

  const urutan: Langkah[] = jenis === 'mitra' ? ['jenis', 'data', 'staf', 'mitra'] : ['jenis', 'data', 'staf']
  const posisi = urutan.indexOf(langkah)

  const input: InputWizard = useMemo(
    () => ({
      jenis,
      nama,
      alamat,
      lat,
      lng,
      telepon,
      region,
      jamBuka,
      jamTutup,
      tanggalGrandOpening: grandOpening || null,
      amStaffId: amId,
      leaderStaffId: leaderId || null,
      mitra:
        jenis === 'mitra'
          ? {
              nilaiInvestasi: angka(nilaiInvestasi || '0'),
              persentaseBagiHasil: angka(bagiHasil),
              managementFee: angka(fee),
              namaMitra: namaMitra.trim() || nama.trim(),
              akun:
                modeAkun === 'baru'
                  ? { mode: 'baru', nama: namaMitra.trim(), username, password }
                  : { mode: 'lama', userId: akunLama },
            }
          : null,
      rab: jenis === 'mitra' && pakaiRab && rabSampai ? { berlakuSampai: rabSampai, kategoriKecuali } : null,
    }),
    [jenis, nama, alamat, lat, lng, telepon, region, jamBuka, jamTutup, grandOpening, amId, leaderId,
      nilaiInvestasi, bagiHasil, fee, namaMitra, modeAkun, username, password, akunLama, pakaiRab, rabSampai, kategoriKecuali],
  )

  const galatLangkah = (l: Langkah) => {
    const v = validasiInputWizard(input, hariIni)
    if (v.ok) return {}
    return Object.fromEntries(
      Object.entries(v.galat).filter(([k]) => GALAT_PER_LANGKAH[l].includes(k as KunciGalat)),
    ) as Partial<Record<KunciGalat, string>>
  }

  const lanjut = () => {
    const g = galatLangkah(langkah)
    if (langkah === 'mitra' && pakaiRab && !rabSampai) g.rab = 'Isi tanggal akhir masa RAB, atau matikan masa RAB'
    setGalatTampil(g)
    if (Object.keys(g).length > 0) return
    if (posisi < urutan.length - 1) setLangkah(urutan[posisi + 1])
    else void simpan()
  }

  const cariLokasi = async () => {
    if (!linkMaps.trim()) return
    setMencariLokasi(true)
    try {
      const h = await resolveLokasiGoogleMaps(linkMaps.trim())
      if (!h.ok) {
        toast.error(h.pesan)
        return
      }
      setLat(h.lat)
      setLng(h.lng)
      if (h.alamat && !alamat.trim()) setAlamat(h.alamat)
      toast.success('Titik peta terisi')
    } finally {
      setMencariLokasi(false)
    }
  }

  const simpan = async () => {
    setMenyimpan(true)
    try {
      const h = await buatOutletBaru(input)
      if (!h.ok) {
        toast.error(h.pesan)
        return
      }
      if (h.peringatan) toast.warning(h.peringatan, { duration: 10_000 })
      else toast.success('Outlet dibuat dengan status Persiapan')
      router.push(`/dashboard/pembukaan-outlet/${h.outletId}`)
    } finally {
      setMenyimpan(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader title="Buka Outlet Baru" description="Outlet tercipta berstatus Persiapan. Langkah lain dicatat di papan persiapan." />

      <ol className="flex flex-wrap gap-2">
        {urutan.map((l, i) => (
          <li
            key={l}
            className={`rounded-full px-3 py-1 text-xs font-bold ${
              i === posisi ? 'bg-suka-orange text-white' : i < posisi ? 'bg-suka-cream text-suka-brown' : 'bg-suka-gray-100 text-suka-ink/50'
            }`}
          >
            {i + 1}. {LABEL_LANGKAH[l]}
          </li>
        ))}
      </ol>

      <Card>
        {langkah === 'jenis' && (
          <div className="grid gap-3 sm:grid-cols-2">
            {([
              { v: 'internal', judul: 'Internal', ket: 'Milik Suka Shawarma', Icon: Store },
              { v: 'mitra', judul: 'Mitra', ket: 'Dibiayai investor, ada bagi hasil', Icon: HeartHandshake },
            ] as const).map(({ v, judul, ket, Icon }) => (
              <button
                key={v}
                type="button"
                onClick={() => setJenis(v)}
                className={`rounded-2xl border-2 p-4 text-left transition-colors ${
                  jenis === v ? 'border-suka-orange bg-suka-cream' : 'border-suka-gray-200 hover:border-suka-orange/50'
                }`}
              >
                <Icon className="mb-2 h-6 w-6 text-suka-orange" />
                <div className="font-bold text-suka-ink">{judul}</div>
                <div className="text-sm text-suka-ink/60">{ket}</div>
              </button>
            ))}
            <p className="text-xs text-suka-ink/60 sm:col-span-2">Jenis outlet terkunci setelah Go-Live.</p>
          </div>
        )}

        {langkah === 'data' && (
          <div className="space-y-4">
            <Isian label="Nama outlet" galat={galatTampil.nama}>
              <input id="wiz-nama" className={kelasInput} value={nama} onChange={e => setNama(e.target.value)} placeholder="SUKA SHAWARMA ..." />
            </Isian>
            <Isian label="Link Google Maps" bantuan="Tempel link lalu tekan Cari untuk mengisi titik peta dan alamat.">
              <div className="flex gap-2">
                <input id="wiz-maps" className={kelasInput} value={linkMaps} onChange={e => setLinkMaps(e.target.value)} placeholder="https://maps.app.goo.gl/..." />
                <Button type="button" variant="secondary" onClick={cariLokasi} disabled={mencariLokasi}>
                  {mencariLokasi ? <Loader2 className="h-4 w-4 animate-spin" /> : <MapPin className="h-4 w-4" />} Cari
                </Button>
              </div>
            </Isian>
            {lat !== null && lng !== null && (
              <p className="text-xs text-suka-ink/70">
                Titik peta: {lat.toFixed(6)}, {lng.toFixed(6)}
              </p>
            )}
            <Isian label="Alamat">
              <textarea id="wiz-alamat" className={kelasInput} rows={2} value={alamat} onChange={e => setAlamat(e.target.value)} />
            </Isian>
            <div className="grid gap-4 sm:grid-cols-2">
              <TimeInput label="Jam buka" value={jamBuka} onChange={setJamBuka} />
              <div>
                <TimeInput label="Jam tutup" value={jamTutup} onChange={setJamTutup} />
                {galatTampil.jamTutup && <p className="mt-1 text-xs font-semibold text-red-600">{galatTampil.jamTutup}</p>}
              </div>
              <Isian label="Telepon (opsional)">
                <input id="wiz-telepon" className={kelasInput} value={telepon} onChange={e => setTelepon(e.target.value)} />
              </Isian>
              <Isian label="Region (opsional)">
                <input id="wiz-region" className={kelasInput} value={region} onChange={e => setRegion(e.target.value)} />
              </Isian>
            </div>
            <div>
              <DatePicker label="Tanggal grand opening (boleh kosong)" value={grandOpening} onChange={setGrandOpening} today={hariIni} />
              <p className="mt-1 text-xs text-suka-ink/60">Wajib diisi sebelum Go-Live. Bisa diisi atau diubah nanti di papan persiapan.</p>
              {galatTampil.tanggalGrandOpening && <p className="mt-1 text-xs font-semibold text-red-600">{galatTampil.tanggalGrandOpening}</p>}
            </div>
          </div>
        )}

        {langkah === 'staf' && (
          <div className="space-y-4">
            <Isian label="Area Manager (wajib)" galat={galatTampil.amStaffId}>
              <select id="wiz-am" className={kelasInput} value={amId} onChange={e => setAmId(e.target.value)}>
                <option value="">Pilih AM</option>
                {am.map(s => <option key={s.id} value={s.id}>{s.nama}</option>)}
              </select>
            </Isian>
            <Isian label="Leader (opsional)" bantuan="Boleh dikosongkan dan ditautkan belakangan di HR.">
              <select id="wiz-leader" className={kelasInput} value={leaderId} onChange={e => setLeaderId(e.target.value)}>
                <option value="">Belum ada</option>
                {leader.map(s => <option key={s.id} value={s.id}>{s.nama}</option>)}
              </select>
            </Isian>
            <p className="rounded-xl bg-suka-cream px-3 py-2 text-sm text-suka-brown">
              Minimal 1 crew wajib didaftarkan di HR sebelum Go-Live. Crew tidak dibuat di wizard ini.
            </p>
          </div>
        )}

        {langkah === 'mitra' && (
          <div className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-3">
              <Isian label="Nilai investasi (Rp)" galat={galatTampil.mitra}>
                <input id="wiz-investasi" inputMode="numeric" className={kelasInput} value={nilaiInvestasi} onChange={e => setNilaiInvestasi(e.target.value)} placeholder="150.000.000" />
              </Isian>
              <Isian label="Bagi hasil (%)">
                <input id="wiz-bagi-hasil" inputMode="numeric" className={kelasInput} value={bagiHasil} onChange={e => setBagiHasil(e.target.value)} />
              </Isian>
              <Isian label="Management fee (%)">
                <input id="wiz-fee" inputMode="decimal" className={kelasInput} value={fee} onChange={e => setFee(e.target.value)} />
              </Isian>
            </div>

            <div className="space-y-3">
              <span className="text-sm font-semibold text-suka-ink">Akun mitra</span>
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
                <div className="grid gap-4 sm:grid-cols-3">
                  <Isian label="Nama mitra">
                    <input id="wiz-nama-mitra" className={kelasInput} value={namaMitra} onChange={e => setNamaMitra(e.target.value)} />
                  </Isian>
                  <Isian label="Username">
                    <input id="wiz-username" className={kelasInput} value={username} onChange={e => setUsername(e.target.value)} autoComplete="off" />
                  </Isian>
                  <Isian label="Password sementara" galat={galatTampil['mitra.akun']}>
                    <input id="wiz-password" type="text" className={kelasInput} value={password} onChange={e => setPassword(e.target.value)} autoComplete="new-password" />
                  </Isian>
                </div>
              ) : (
                <Isian label="Pilih mitra" galat={galatTampil['mitra.akun']} bantuan="Outlet baru ditambahkan ke dashboard mitra ini.">
                  <select
                    id="wiz-akun-lama"
                    className={kelasInput}
                    value={akunLama}
                    onChange={e => {
                      setAkunLama(e.target.value)
                      setNamaMitra(mitra.find(m => m.id === e.target.value)?.nama ?? '')
                    }}
                  >
                    <option value="">Pilih mitra</option>
                    {mitra.map(m => <option key={m.id} value={m.id}>{m.nama}</option>)}
                  </select>
                </Isian>
              )}
            </div>

            <div className="space-y-3 rounded-2xl border border-suka-gray-200 p-4">
              <label className="flex items-center gap-2 text-sm font-semibold text-suka-ink">
                <input id="wiz-pakai-rab" type="checkbox" checked={pakaiRab} onChange={e => setPakaiRab(e.target.checked)} />
                Pengeluaran awal ditanggung RAB
              </label>
              {pakaiRab && (
                <>
                  <DatePicker label="RAB berlaku sampai" value={rabSampai} onChange={setRabSampai} today={hariIni} />
                  <div>
                    <p className="mb-2 text-xs text-suka-ink/70">Kategori yang tetap dihitung OPEX:</p>
                    <div className="flex flex-wrap gap-2">
                      {KATEGORI_KECUALI_RAB_BAWAAN.map(k => {
                        const aktif = kategoriKecuali.includes(k)
                        return (
                          <button
                            key={k}
                            type="button"
                            onClick={() => setKategoriKecuali(aktif ? kategoriKecuali.filter(x => x !== k) : [...kategoriKecuali, k])}
                            className={`rounded-full px-3 py-1 text-xs font-semibold ${aktif ? 'bg-suka-brown text-white' : 'bg-suka-gray-100 text-suka-ink/60'}`}
                          >
                            {k}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                </>
              )}
              {galatTampil.rab && <p className="text-xs font-semibold text-red-600">{galatTampil.rab}</p>}
            </div>
          </div>
        )}
      </Card>

      <div className="flex justify-between gap-3">
        <Button
          type="button"
          variant="ghost"
          onClick={() => (posisi === 0 ? router.push('/dashboard/pembukaan-outlet') : setLangkah(urutan[posisi - 1]))}
          disabled={menyimpan}
        >
          {posisi === 0 ? 'Batal' : 'Kembali'}
        </Button>
        <Button type="button" onClick={lanjut} disabled={menyimpan}>
          {menyimpan ? 'Menyimpan…' : posisi === urutan.length - 1 ? 'Buat Outlet' : 'Lanjut'}
        </Button>
      </div>
    </div>
  )
}
