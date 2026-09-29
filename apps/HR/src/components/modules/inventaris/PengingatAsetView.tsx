'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import {
  AlertCircle,
  AlertTriangle,
  CalendarX,
  CheckCircle2,
  Clock,
  Hourglass,
  RefreshCw,
  Search,
  Settings2,
  Undo2,
  Wrench,
  X,
} from 'lucide-react'
import { Button, Spinner } from '@suka/design-system'
import { PageHeader } from '@/components/ui/PageHeader'
import { Select } from '@/components/ui/Select'
import { usePengingatAset, useSimpanTindakLanjut } from '@/hooks/usePengingatAset'
import { formatTanggalPendek } from '@/lib/dateIso'
import {
  batalkanTindakLanjut,
  buatTindakLanjut,
  formatSisa,
  formatUmur,
  LABEL_ALASAN,
  LABEL_KEPUTUSAN,
  PILIHAN_TUNDA,
  tambahHari,
  CEK_ULANG_SETELAH_SELESAI_HARI,
  type Alasan,
  type AsetPengingat,
  type Keputusan,
} from '@/lib/pengingatAset'

type Tab = 'perlu' | 'selesai' | 'kosong'

const ALASAN_TONE: Record<Alasan, string> = {
  rusak: 'bg-rose-100 text-rose-800 ring-rose-200',
  lewat_umur: 'bg-red-100 text-red-800 ring-red-200',
  perbaikan: 'bg-amber-100 text-amber-800 ring-amber-200',
  segera: 'bg-orange-100 text-orange-800 ring-orange-200',
}

const TILES: { alasan: Alasan; icon: typeof AlertTriangle; tone: string; hint: string }[] = [
  { alasan: 'rusak', icon: AlertCircle, tone: 'border-rose-200 bg-rose-50/60 text-rose-900', hint: 'Dilaporkan AM' },
  { alasan: 'lewat_umur', icon: Hourglass, tone: 'border-red-200 bg-red-50/60 text-red-900', hint: 'Umur pakai habis' },
  { alasan: 'perbaikan', icon: Wrench, tone: 'border-amber-200 bg-amber-50/60 text-amber-900', hint: 'Dilaporkan AM' },
  { alasan: 'segera', icon: Clock, tone: 'border-orange-200 bg-orange-50/60 text-orange-900', hint: '≤ 3 bulan lagi' },
]

export default function PengingatAsetView() {
  const { ringkasan, today, isLoading, error, refetch, isFetching } = usePengingatAset()
  const simpan = useSimpanTindakLanjut()
  const [tab, setTab] = useState<Tab>('perlu')
  const [alasanFilter, setAlasanFilter] = useState<Alasan | null>(null)
  const [outletFilter, setOutletFilter] = useState('all')
  const [query, setQuery] = useState('')
  const [dipilih, setDipilih] = useState<AsetPengingat | null>(null)

  const outletOptions = useMemo(() => {
    const map = new Map<string, string>()
    for (const a of ringkasan.aset) map.set(a.outletId, a.outletName)
    return [{ label: 'Semua Outlet', value: 'all' }, ...[...map].sort((a, b) => a[1].localeCompare(b[1])).map(([value, label]) => ({ value, label }))]
  }, [ringkasan.aset])

  const saring = (list: AsetPengingat[]) => {
    const q = query.trim().toLowerCase()
    return list.filter((a) =>
      (outletFilter === 'all' || a.outletId === outletFilter)
      && (!alasanFilter || tab !== 'perlu' || a.alasan.includes(alasanFilter))
      && (!q || `${a.itemName} ${a.outletName} ${a.brand ?? ''} ${a.subsection}`.toLowerCase().includes(q))
    )
  }

  const perlu = saring(ringkasan.perluTindakan)
  const selesai = saring(ringkasan.ditindaklanjuti)
  const kosong = saring(ringkasan.tanggalKosong)

  const batalkan = (aset: AsetPengingat) => {
    simpan.mutate(batalkanTindakLanjut(aset, today), {
      onSuccess: () => toast.success(`${aset.itemName} kembali ke daftar perlu tindakan`),
      onError: (e: any) => toast.error(e.message || 'Gagal membatalkan'),
    })
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Pengingat Aset Outlet"
        description="Barang outlet yang rusak, perlu perbaikan, atau mendekati akhir umur pakainya. Tandai setelah ditindaklanjuti."
      >
        <Button type="button" variant="ghost" onClick={() => void refetch()} disabled={isFetching} className="rounded-xl border border-suka-gray-200 gap-1.5 font-bold">
          <RefreshCw size={15} className={isFetching ? 'animate-spin' : ''} /> Muat ulang
        </Button>
        <Link href="/inventaris/pengingat/umur" className="inline-flex items-center gap-1.5 rounded-xl bg-suka-brown px-4 py-2 text-sm font-bold text-white hover:bg-[#4A1713]">
          <Settings2 size={15} /> Atur umur barang
        </Link>
      </PageHeader>

      {isLoading ? (
        <div className="flex justify-center p-12"><Spinner /></div>
      ) : error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-8 text-center text-rose-700">
          <AlertCircle className="mx-auto mb-2" />
          <b>Gagal memuat pengingat</b>
          <p className="mt-1 text-sm">{(error as Error).message}</p>
        </div>
      ) : (
        <>
          {/* Ringkasan — klik untuk menyaring */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {TILES.map(({ alasan, icon: Icon, tone, hint }) => {
              const aktif = tab === 'perlu' && alasanFilter === alasan
              return (
                <button
                  key={alasan}
                  type="button"
                  onClick={() => { setTab('perlu'); setAlasanFilter(aktif ? null : alasan) }}
                  className={`flex items-center gap-3 rounded-2xl border p-4 text-left shadow-sm transition hover:shadow-md ${tone} ${aktif ? 'ring-2 ring-suka-brown' : ''}`}
                >
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/80"><Icon size={20} /></span>
                  <span className="min-w-0">
                    <span className="block text-[11px] font-bold uppercase tracking-wide opacity-80">{LABEL_ALASAN[alasan]}</span>
                    <span className="block text-2xl font-black leading-tight">{ringkasan.hitung[alasan]}</span>
                    <span className="block text-[11px] font-semibold opacity-70">{hint}</span>
                  </span>
                </button>
              )
            })}
          </div>

          {/* Tab + filter */}
          <div className="flex flex-col gap-3 rounded-2xl border border-suka-gray-200 bg-white p-3.5 shadow-sm lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap gap-1.5 rounded-xl border border-suka-brown/10 bg-[#FDF9F3] p-1">
              <TabButton active={tab === 'perlu'} onClick={() => setTab('perlu')}>Perlu tindakan ({ringkasan.perluTindakan.length})</TabButton>
              <TabButton active={tab === 'selesai'} onClick={() => setTab('selesai')}>Sudah ditindaklanjuti ({ringkasan.ditindaklanjuti.length})</TabButton>
              <TabButton active={tab === 'kosong'} onClick={() => setTab('kosong')}>Tanggal beli kosong ({ringkasan.tanggalKosong.length})</TabButton>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <label className="relative block sm:w-60">
                <span className="sr-only">Cari barang</span>
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-suka-gray-400" />
                <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Cari barang atau outlet..." className="w-full rounded-xl border border-suka-gray-200 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-suka-orange focus:ring-1 focus:ring-suka-orange" />
              </label>
              <Select options={outletOptions} value={outletFilter} onChange={setOutletFilter} className="sm:min-w-[190px]" aria-label="Filter outlet" />
            </div>
          </div>

          {alasanFilter && tab === 'perlu' && (
            <button type="button" onClick={() => setAlasanFilter(null)} className="inline-flex items-center gap-1.5 rounded-full bg-suka-brown px-3 py-1 text-xs font-bold text-white">
              Hanya: {LABEL_ALASAN[alasanFilter]} <X size={12} />
            </button>
          )}

          {tab === 'perlu' && (
            perlu.length === 0
              ? <Kosong icon={CheckCircle2} judul="Tidak ada aset yang perlu ditindaklanjuti" teks="Semua barang yang dilacak masih dalam umur pakai dan tidak ada laporan rusak." />
              : <div className="grid gap-3">{perlu.map((a) => <KartuAset key={a.key} aset={a} onAksi={() => setDipilih(a)} />)}</div>
          )}

          {tab === 'selesai' && (
            selesai.length === 0
              ? <Kosong icon={Clock} judul="Belum ada tindak lanjut aktif" teks="Barang yang sudah Anda tandai akan muncul di sini sampai jadwal cek ulangnya." />
              : <div className="grid gap-3">{selesai.map((a) => <KartuSelesai key={a.key} aset={a} disabled={simpan.isPending} onBatal={() => batalkan(a)} />)}</div>
          )}

          {tab === 'kosong' && <DaftarTanggalKosong list={kosong} />}
        </>
      )}

      {dipilih && (
        <TindakLanjutDialog
          aset={dipilih}
          today={today}
          submitting={simpan.isPending}
          onClose={() => setDipilih(null)}
          onSubmit={(keputusan, tundaHari, catatan) => {
            simpan.mutate(buatTindakLanjut(dipilih, keputusan, today, { tundaHari, catatan }), {
              onSuccess: () => {
                toast.success(`${dipilih.itemName} — ${LABEL_KEPUTUSAN[keputusan].toLowerCase()}`)
                setDipilih(null)
              },
              onError: (e: any) => toast.error(e.message || 'Gagal menyimpan tindak lanjut'),
            })
          }}
        />
      )}
    </div>
  )
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} className={`rounded-lg px-3.5 py-1.5 text-xs font-bold transition-all ${active ? 'bg-suka-brown text-white shadow-xs' : 'text-suka-brown hover:bg-amber-100'}`}>
      {children}
    </button>
  )
}

function Kosong({ icon: Icon, judul, teks }: { icon: typeof CheckCircle2; judul: string; teks: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-suka-gray-300 bg-white px-6 py-14 text-center">
      <Icon className="mx-auto h-10 w-10 text-emerald-500" />
      <p className="mt-3 font-extrabold text-suka-ink">{judul}</p>
      <p className="mx-auto mt-1 max-w-md text-sm text-suka-gray-500">{teks}</p>
    </div>
  )
}

function Chip({ alasan }: { alasan: Alasan }) {
  return <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-black ring-1 ${ALASAN_TONE[alasan]}`}>{LABEL_ALASAN[alasan]}</span>
}

function InfoUmur({ aset }: { aset: AsetPengingat }) {
  if (!aset.umurBulan) return null
  if (!aset.purchaseDate) return <span className="text-amber-700">Tanggal beli belum diisi AM · umur pakai {formatUmur(aset.umurBulan)}</span>
  return (
    <span>
      Beli {formatTanggalPendek(aset.purchaseDate)} · umur pakai {formatUmur(aset.umurBulan)} ·{' '}
      <b className={aset.sisaHari !== null && aset.sisaHari < 0 ? 'text-red-700' : 'text-suka-ink'}>{formatSisa(aset.sisaHari)}</b>
    </span>
  )
}

function KartuAset({ aset, onAksi }: { aset: AsetPengingat; onAksi: () => void }) {
  return (
    <article className="flex flex-col gap-3 rounded-2xl border border-suka-gray-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0 space-y-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-extrabold text-suka-ink">{aset.itemName}</h3>
          {aset.alasan.map((a) => <Chip key={a} alasan={a} />)}
        </div>
        <p className="text-sm font-bold text-suka-brown">{aset.outletName}{aset.brand ? <span className="font-semibold text-suka-gray-500"> · {aset.brand}</span> : null}</p>
        <p className="text-xs text-suka-gray-600"><InfoUmur aset={aset} /></p>
        {aset.catatanAm && <p className="text-xs text-suka-gray-500">Catatan AM: “{aset.catatanAm}”</p>}
        {aset.dilaporkanOleh && <p className="text-[11px] text-suka-gray-400">Laporan terakhir oleh {aset.dilaporkanOleh}</p>}
      </div>
      <Button type="button" onClick={onAksi} className="shrink-0 rounded-xl bg-suka-orange font-bold text-white hover:bg-orange-500">
        Tindak lanjuti
      </Button>
    </article>
  )
}

function KartuSelesai({ aset, disabled, onBatal }: { aset: AsetPengingat; disabled: boolean; onBatal: () => void }) {
  const tl = aset.ditindaklanjuti[0]
  return (
    <article className="flex flex-col gap-3 rounded-2xl border border-emerald-200 bg-emerald-50/30 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0 space-y-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-extrabold text-suka-ink">{aset.itemName}</h3>
          {aset.ditindaklanjuti.map((t) => <Chip key={t.pemicu} alasan={t.alasan} />)}
        </div>
        <p className="text-sm font-bold text-suka-brown">{aset.outletName}</p>
        <p className="text-xs text-suka-gray-600">
          <b className="text-emerald-700">{LABEL_KEPUTUSAN[tl.keputusan]}</b>
          {tl.oleh ? ` oleh ${tl.oleh}` : ''}{tl.at ? ` · ${formatTanggalPendek(tl.at.slice(0, 10))}` : ''} · dicek ulang {formatTanggalPendek(tl.ingatkanLagi)}
        </p>
        {tl.catatan && <p className="text-xs text-suka-gray-500">“{tl.catatan}”</p>}
      </div>
      <Button type="button" variant="ghost" disabled={disabled} onClick={onBatal} className="shrink-0 gap-1.5 rounded-xl border border-suka-gray-200 font-bold">
        <Undo2 size={15} /> Batalkan
      </Button>
    </article>
  )
}

function DaftarTanggalKosong({ list }: { list: AsetPengingat[] }) {
  const perOutlet = useMemo(() => {
    const map = new Map<string, { nama: string; barang: string[] }>()
    for (const a of list) {
      const g = map.get(a.outletId) ?? { nama: a.outletName, barang: [] }
      g.barang.push(a.itemName)
      map.set(a.outletId, g)
    }
    return [...map.values()].sort((a, b) => b.barang.length - a.barang.length)
  }, [list])

  if (list.length === 0) {
    return <Kosong icon={CheckCircle2} judul="Semua tanggal beli sudah terisi" teks="Setiap barang yang dilacak umurnya sudah punya tanggal pembelian." />
  }
  return (
    <div className="space-y-3">
      <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        <CalendarX className="mt-0.5 h-5 w-5 shrink-0" />
        <p>Tanpa tanggal beli, sistem tidak bisa menghitung umur barang. Minta Area Manager mengisi <b>Tanggal pembelian</b> di app <b>Inventaris</b>. Kalau barangnya lebih dari satu unit, isi tanggal unit yang <b>paling lama</b>.</p>
      </div>
      {perOutlet.map((g) => (
        <section key={g.nama} className="rounded-2xl border border-suka-gray-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-extrabold text-suka-ink">{g.nama}</h3>
            <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-black text-amber-800">{g.barang.length} barang</span>
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {g.barang.map((b) => <span key={b} className="rounded-full bg-[#FDF9F3] px-2.5 py-1 text-[11px] font-bold text-suka-brown ring-1 ring-suka-brown/10">{b}</span>)}
          </div>
        </section>
      ))}
    </div>
  )
}

function TindakLanjutDialog({ aset, today, submitting, onClose, onSubmit }: {
  aset: AsetPengingat
  today: string
  submitting: boolean
  onClose: () => void
  onSubmit: (keputusan: Keputusan, tundaHari: number | undefined, catatan: string) => void
}) {
  const [keputusan, setKeputusan] = useState<Keputusan | null>(null)
  const [tundaHari, setTundaHari] = useState(30)
  const [catatan, setCatatan] = useState('')
  const hanyaUmur = aset.alasan.every((a) => a === 'lewat_umur' || a === 'segera')

  const pilihan: { value: Keputusan; judul: string; teks: string }[] = [
    { value: 'diganti', judul: 'Sudah diganti', teks: 'Unit baru sudah terpasang. AM perlu memperbarui tanggal beli di app Inventaris.' },
    ...(!hanyaUmur ? [{ value: 'diperbaiki' as const, judul: 'Sudah diperbaiki', teks: 'Barang sudah diservis. AM perlu mengubah kondisinya menjadi "Baik".' }] : []),
    { value: 'ditunda', judul: hanyaUmur ? 'Masih layak pakai' : 'Tunda dulu', teks: 'Ingatkan saya lagi nanti.' },
  ]

  const cekUlang = keputusan === 'ditunda' ? tambahHari(today, tundaHari) : tambahHari(today, CEK_ULANG_SETELAH_SELESAI_HARI)

  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs" onClick={onClose}>
      <div className="w-full max-w-md space-y-4 rounded-2xl bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-suka-brown">Tindak lanjut: {aset.itemName}</h3>
            <p className="text-xs text-suka-gray-500">{aset.outletName}</p>
            <div className="mt-2 flex flex-wrap gap-1.5">{aset.alasan.map((a) => <Chip key={a} alasan={a} />)}</div>
          </div>
          <button type="button" aria-label="Tutup" onClick={onClose} className="rounded-lg p-1 text-suka-gray-400 hover:bg-suka-gray-100"><X size={18} /></button>
        </div>

        <div className="space-y-2" role="radiogroup" aria-label="Keputusan">
          {pilihan.map((p) => (
            <button
              key={p.value}
              type="button"
              role="radio"
              aria-checked={keputusan === p.value}
              onClick={() => setKeputusan(p.value)}
              className={`w-full rounded-xl border p-3 text-left transition ${keputusan === p.value ? 'border-suka-orange bg-orange-50 ring-1 ring-suka-orange' : 'border-suka-gray-200 hover:border-suka-orange/50'}`}
            >
              <span className="block text-sm font-extrabold text-suka-ink">{p.judul}</span>
              <span className="block text-xs text-suka-gray-500">{p.teks}</span>
            </button>
          ))}
        </div>

        {keputusan === 'ditunda' && (
          <div>
            <p className="mb-1.5 text-xs font-bold text-suka-brown">Ingatkan lagi dalam</p>
            <div className="flex flex-wrap gap-1.5">
              {PILIHAN_TUNDA.map((p) => (
                <button key={p.hari} type="button" onClick={() => setTundaHari(p.hari)} className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${tundaHari === p.hari ? 'bg-suka-brown text-white' : 'bg-[#FDF9F3] text-suka-brown ring-1 ring-suka-brown/10 hover:bg-amber-100'}`}>
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        )}

        <div>
          <label htmlFor="catatan-tl" className="mb-1 block text-xs font-bold text-suka-brown">Catatan (opsional)</label>
          <textarea id="catatan-tl" value={catatan} onChange={(e) => setCatatan(e.target.value)} rows={2} maxLength={500} placeholder="Contoh: sudah dibelikan unit baru merek GEA" className="w-full rounded-xl border border-suka-gray-200 bg-white px-3 py-2.5 text-sm text-suka-ink outline-none focus:border-suka-orange focus:ring-1 focus:ring-suka-orange" />
        </div>

        {keputusan && (
          <p className="rounded-xl bg-[#FDF9F3] px-3 py-2 text-xs text-suka-gray-600">
            Pengingat disembunyikan sampai <b>{formatTanggalPendek(cekUlang)}</b>. Kalau saat itu data dari AM belum berubah, barang ini muncul lagi.
          </p>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="ghost" onClick={onClose} className="rounded-xl font-bold">Batal</Button>
          <Button
            type="button"
            disabled={!keputusan || submitting}
            onClick={() => keputusan && onSubmit(keputusan, keputusan === 'ditunda' ? tundaHari : undefined, catatan)}
            className="rounded-xl bg-suka-brown font-bold text-white hover:bg-[#4A1713]"
          >
            {submitting ? 'Menyimpan...' : 'Simpan'}
          </Button>
        </div>
      </div>
    </div>
  )
}
