'use client'

/*
 * Monitoring laporan checklist inventaris outlet (read-only) untuk HR.
 * Tampilan disalin dari `apps/inventori/src/app/dashboard/reports/InventarisReportView.tsx`
 * agar konsisten; lapisan datanya ditulis ulang supaya hemat kueri — lihat
 * `@/hooks/useInventarisReports`.
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { AlertCircle, ArrowLeft, Camera, CheckCircle2, ChevronDown, ClipboardCheck, ClipboardX, Clock, ImageOff, Package, PencilLine, RefreshCw, Search, Store, AlertTriangle, X } from 'lucide-react'
import { useRole } from '@/components/layout/RoleContext'
import { useOutlets } from '@/hooks/useOutlets'
import { useInventarisPhotoUrls, useInventarisReport, useInventarisReports } from '@/hooks/useInventarisReports'
import {
  conditionKey,
  conditionLabel,
  conditionTones,
  formatDateTime,
  formatMoney,
  formatPurchaseDate,
  isAvailable,
  statusLabel,
  type InventarisDetail,
  type InventarisSummary,
} from '@/lib/inventaris'

type StatusFilter = 'all' | 'incomplete' | 'complete'
type OutletOption = { id: string; name: string }

const BASE_PATH = '/inventaris'

export default function InventarisReportView({ outletId }: { outletId?: string }) {
  const { staffName } = useRole()
  const { data: outlets = [] } = useOutlets()
  const outletOptions = useMemo<OutletOption[]>(() => outlets.map((o) => ({ id: o.id, name: o.name })), [outlets])

  return (
    <div className={`mx-auto w-full space-y-5 ${outletId ? 'max-w-[1600px]' : 'max-w-[1280px]'}`}>
      {outletId
        ? <OutletDetail outletId={outletId} outlets={outletOptions} staffName={staffName} />
        : <OutletList outlets={outletOptions} staffName={staffName} />}
    </div>
  )
}

function Hero({ staffName, title, description }: { staffName: string; title: string; description: string }) {
  return (
    <section className="rounded-3xl bg-[#701604] p-5 text-white shadow-lg sm:p-7">
      <p className="text-sm text-orange-100">Halo, {staffName}</p>
      <h2 className="mt-1 text-2xl font-extrabold">{title}</h2>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-orange-100">{description}</p>
    </section>
  )
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="rounded-3xl border border-rose-200 bg-rose-50 p-8 text-center text-rose-700">
      <AlertCircle className="mx-auto mb-3" />
      <b>Gagal memuat laporan</b>
      <p className="mt-1 text-sm">{message}</p>
      <button type="button" onClick={onRetry} className="mt-4 inline-flex items-center gap-2 rounded-xl bg-rose-600 px-4 py-2 text-sm font-bold text-white hover:bg-rose-700">
        <RefreshCw className="h-4 w-4" /> Coba lagi
      </button>
    </div>
  )
}

function LoadingState() {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      <div className="h-28 animate-pulse rounded-3xl bg-[#701604]" />
      <div className="h-28 animate-pulse rounded-3xl bg-[#f29744]" />
      <div className="h-28 animate-pulse rounded-3xl bg-[#283c35]" />
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Daftar outlet                                                       */
/* ------------------------------------------------------------------ */

function OutletList({ outlets, staffName }: { outlets: OutletOption[]; staffName: string }) {
  const router = useRouter()
  const { data = [], isLoading, error, refetch, isFetching } = useInventarisReports()
  const [query, setQuery] = useState('')

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return data
    return data.filter((row) => `${row.outletName} ${row.submittedBy}`.toLowerCase().includes(q))
  }, [data, query])

  const reported = useMemo(() => new Set(data.map((row) => row.outletId)), [data])
  const pending = useMemo(() => outlets.filter((o) => !reported.has(o.id)), [outlets, reported])

  return <>
    <Hero staffName={staffName} title="Monitoring laporan inventaris" description="Pantau checklist inventaris aset tiap outlet. Pilih outlet untuk melihat laporan secara lengkap." />
    {isLoading ? <LoadingState /> : error ? <ErrorState message={(error as Error).message} onRetry={() => void refetch()} /> : <>
      <section className="grid gap-3 sm:grid-cols-3">
        <Metric icon={ClipboardCheck} label="Outlet sudah lapor" value={data.length} tone="maroon" />
        <Metric icon={ClipboardX} label="Belum lapor" value={pending.length} tone="orange" />
        <Metric icon={Package} label="Total item tercatat" value={data.reduce((sum, row) => sum + row.itemCount, 0)} tone="green" />
      </section>
      <OutletCards
        data={visible}
        outlets={outlets}
        query={query}
        refreshing={isFetching}
        onRefresh={() => void refetch()}
        onQueryChange={setQuery}
        onOpen={(id) => router.push(`${BASE_PATH}/${id}`)}
      />
      {pending.length > 0 && !query.trim() && (
        <section className="rounded-[1.6rem] border border-[#e8b56f]/45 bg-white p-4 shadow-sm sm:p-5">
          <div className="flex items-center gap-2 text-sm font-black text-[#400a07]"><AlertTriangle className="h-4 w-4 text-[#f29744]" /> Outlet belum mengirim laporan inventaris ({pending.length})</div>
          <div className="mt-3 flex flex-wrap gap-2">
            {pending.map((o) => (
              <Link key={o.id} href={`${BASE_PATH}/${o.id}`} className="rounded-full bg-[#fff7eb] px-3 py-1.5 text-xs font-bold text-[#701604] ring-1 ring-[#e8b56f]/60 transition hover:bg-[#f5d6a0]">{o.name}</Link>
            ))}
          </div>
        </section>
      )}
    </>}
  </>
}

function OutletCards({ data, outlets, query, refreshing, onRefresh, onQueryChange, onOpen }: {
  data: InventarisSummary[]
  outlets: OutletOption[]
  query: string
  refreshing: boolean
  onRefresh: () => void
  onQueryChange: (value: string) => void
  onOpen: (id: string) => void
}) {
  return <section className="space-y-4">
    <div className="rounded-[1.6rem] bg-[#f5d6a0] p-4 shadow-lg shadow-orange-950/5 sm:p-5">
      <div className="grid items-end gap-3 md:grid-cols-[minmax(0,1fr)_280px_auto]">
        <label className="relative block"><span className="sr-only">Cari outlet</span><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#701604]/50" /><input value={query} onChange={(event) => onQueryChange(event.target.value)} placeholder="Cari outlet atau Area Manager..." className="w-full rounded-xl border border-[#701604]/15 bg-white/85 py-3 pl-10 pr-3 text-sm font-semibold text-[#400a07] outline-none transition focus:border-[#701604] focus:bg-white focus:ring-4 focus:ring-white/50" /></label>
        <OutletSwitcher data={outlets} onOpen={onOpen} />
        <button type="button" onClick={onRefresh} disabled={refreshing} className="inline-flex h-[46px] items-center justify-center gap-2 rounded-xl border border-suka-brown/15 bg-white px-4 text-sm font-bold text-suka-brown transition hover:bg-orange-50 disabled:opacity-60"><RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} /> Muat ulang</button>
      </div>
    </div>
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {data.map((submission, index) => {
        const recorded = submission.itemCount > 0
        const tone = cardTones[index % cardTones.length]
        return <button key={submission.outletId} type="button" onClick={() => onOpen(submission.outletId)} className={`group relative flex min-h-[19rem] flex-col overflow-hidden rounded-[1.5rem] border p-4 text-left shadow-lg transition hover:-translate-y-1 hover:shadow-2xl focus:outline-none focus:ring-4 focus:ring-orange-200 ${tone.card}`}>
          <span className="pointer-events-none absolute -right-12 -top-16 h-40 w-40 rounded-full border border-white/15" />
          <span className="pointer-events-none absolute -bottom-24 -left-10 h-44 w-44 rounded-full bg-white/10" />
          <div className="relative flex min-w-0 flex-1 flex-col">
            <div className="flex items-start justify-between gap-4">
              <span className={`grid h-12 w-12 place-items-center rounded-2xl ${tone.icon}`}>{recorded ? <ClipboardCheck className="h-6 w-6" /> : <ClipboardX className="h-6 w-6" />}</span>
              <span className={`rounded-full px-3 py-1 text-xs font-black ${tone.chip}`}>{recorded ? `${submission.itemCount} item` : 'Belum dicatat'}</span>
            </div>
            <div className="mt-auto pt-5">
              <p className={`text-[10px] font-black uppercase tracking-[0.18em] ${tone.eyebrow}`}>{recorded ? 'Laporan terbaru' : 'Menunggu pencatatan'}</p>
              <h3 className="mt-2 text-lg font-black leading-tight">{submission.outletName}</h3>
              <p className={`mt-2 text-sm ${tone.muted}`}>{recorded ? `Laporan terakhir oleh ${submission.submittedBy}` : 'Belum ada pencatatan inventaris'}</p>
              {recorded && <dl className={`mt-3 space-y-1 text-[11px] font-bold ${tone.muted}`}>
                <div className="flex items-center gap-1.5"><Clock className="h-3.5 w-3.5 shrink-0" /><dt className="sr-only">Waktu input</dt><dd className="truncate">Input {formatDateTime(submission.createdAt)}</dd></div>
                <div className="flex items-center gap-1.5"><PencilLine className="h-3.5 w-3.5 shrink-0" /><dt className="sr-only">Waktu edit terakhir</dt><dd className="truncate">Edit {submission.updatedAt && submission.updatedAt !== submission.createdAt ? formatDateTime(submission.updatedAt) : 'belum pernah'}</dd></div>
              </dl>}
            </div>
            <div className={`mt-5 flex items-center justify-between border-t pt-4 text-xs font-black ${tone.footer}`}><span>Buka laporan inventori</span><ArrowLeft className="h-4 w-4 rotate-180 transition group-hover:translate-x-1" /></div>
          </div>
        </button>
      })}
      {data.length === 0 && <div className="rounded-3xl bg-[#a65e44] p-12 text-center text-sm font-semibold text-white shadow-lg sm:col-span-2">Outlet tidak ditemukan.</div>}
    </div>
  </section>
}

const cardTones = [
  { card: 'border-[#701604] bg-[#701604] text-white', icon: 'bg-white/15 text-[#ffd4a8]', chip: 'bg-white/15 text-white', eyebrow: 'text-orange-200', muted: 'text-orange-100', footer: 'border-white/20 text-orange-100' },
  { card: 'border-[#f29744] bg-[#f29744] text-[#400a07]', icon: 'bg-white/35 text-[#701604]', chip: 'bg-white/55 text-[#701604]', eyebrow: 'text-[#701604]/70', muted: 'text-[#4A1713]/75', footer: 'border-[#701604]/20 text-[#701604]' },
  { card: 'border-[#283c35] bg-[#283c35] text-white', icon: 'bg-white/15 text-[#f7c58b]', chip: 'bg-[#f7c58b] text-[#283c35]', eyebrow: 'text-[#f7c58b]', muted: 'text-white/70', footer: 'border-white/20 text-[#f7c58b]' },
  { card: 'border-[#a65e44] bg-[#a65e44] text-white', icon: 'bg-white/15 text-white', chip: 'bg-white/20 text-white', eyebrow: 'text-orange-100', muted: 'text-white/75', footer: 'border-white/20 text-white' },
]

/* ------------------------------------------------------------------ */
/* Detail satu outlet                                                  */
/* ------------------------------------------------------------------ */

function OutletDetail({ outletId, outlets, staffName }: { outletId: string; outlets: OutletOption[]; staffName: string }) {
  const router = useRouter()
  const { data: report, isLoading, error, refetch } = useInventarisReport(outletId)
  const { urls: photoUrls, loading: photosLoading } = useInventarisPhotoUrls(report)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<StatusFilter>('all')
  const [photo, setPhoto] = useState<{ url: string; name: string } | null>(null)

  const outletName = report?.outletName ?? outlets.find((o) => o.id === outletId)?.name ?? 'outlet'
  const items = report?.items ?? []
  const complete = items.filter((item) => isAvailable(item.status)).length
  const open = (id: string) => router.push(`${BASE_PATH}/${id}`)

  useEffect(() => {
    if (!photo) return
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') setPhoto(null) }
    document.addEventListener('keydown', closeOnEscape)
    return () => document.removeEventListener('keydown', closeOnEscape)
  }, [photo])

  return <>
    <Hero staffName={staffName} title={`Laporan ${outletName}`} description="Periksa detail laporan inventaris outlet dalam format tabel." />
    <Link href={BASE_PATH} className="inline-flex items-center gap-2 rounded-xl border border-orange-200 bg-white px-4 py-2 text-sm font-bold text-[#701604] shadow-sm"><ArrowLeft className="h-4 w-4" /> Kembali ke daftar outlet</Link>
    {isLoading ? <LoadingState /> : error ? <ErrorState message={(error as Error).message} onRetry={() => void refetch()} /> : !report ? <>
      <div className="max-w-sm"><OutletSwitcher data={outlets} onOpen={open} /></div>
      <EmptyOutletState outletName={outletName} />
    </> : <>
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Metric icon={Package} label="Total item" value={items.length} tone="maroon" />
        <Metric icon={CheckCircle2} label="Sesuai" value={complete} tone="green" />
        <Metric icon={AlertTriangle} label="Perlu tindak lanjut" value={items.length - complete} tone="orange" />
        <Metric icon={Camera} label="Dengan foto" value={items.filter((item) => item.photoPath).length} tone="terracotta" />
      </section>
      <section className="flex flex-wrap items-center gap-x-5 gap-y-1 text-xs font-bold text-[#701604]/70">
        <span className="inline-flex items-center gap-1.5"><Store className="h-3.5 w-3.5" /> Dilaporkan oleh {report.submittedBy}</span>
        <span className="inline-flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" /> Input {formatDateTime(report.createdAt)}</span>
        <span className="inline-flex items-center gap-1.5"><PencilLine className="h-3.5 w-3.5" /> Edit {report.updatedAt && report.updatedAt !== report.createdAt ? formatDateTime(report.updatedAt) : 'belum pernah'}</span>
      </section>
      {report.notes && <p className="rounded-2xl border border-[#e8b56f]/45 bg-white px-4 py-3 text-sm text-[#400a07]"><b>Catatan:</b> {report.notes}</p>}
      <section className="rounded-[1.6rem] bg-[#f5d6a0] p-4 shadow-lg shadow-orange-950/5 sm:p-5">
        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_280px]">
          <label className="relative block self-end"><span className="sr-only">Cari item inventaris</span><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-suka-ink/40" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Cari item, kategori, kondisi, atau catatan..." className="w-full rounded-xl border border-suka-brown/15 bg-white py-3 pl-10 pr-3 text-sm outline-none transition focus:border-suka-orange focus:ring-2 focus:ring-orange-100" /></label>
          <OutletSwitcher data={outlets} onOpen={open} />
        </div>
        <div className="mt-4 flex flex-wrap gap-2"><span className="self-center pr-1 text-xs font-extrabold uppercase tracking-wide text-suka-ink/50">Status</span><FilterButton active={filter === 'all'} onClick={() => setFilter('all')}>Semua</FilterButton><FilterButton active={filter === 'incomplete'} onClick={() => setFilter('incomplete')}>Kurang</FilterButton><FilterButton active={filter === 'complete'} onClick={() => setFilter('complete')}>Lengkap</FilterButton></div>
      </section>
      <InventoryItemGrid report={report} query={query} filter={filter} photoUrls={photoUrls} photosLoading={photosLoading} onPhoto={setPhoto} />
    </>}
    {photo && <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4" onClick={() => setPhoto(null)}><div className="relative max-h-full max-w-3xl rounded-3xl bg-white p-2" onClick={(event) => event.stopPropagation()}><button type="button" aria-label="Tutup foto" className="absolute right-4 top-4 rounded-full bg-black/60 p-2 text-white" onClick={() => setPhoto(null)}><X className="h-5 w-5" /></button><img src={photo.url} alt={`Foto ${photo.name}`} className="max-h-[78vh] max-w-full rounded-2xl object-contain" /><p className="p-2 text-center text-sm font-bold">{photo.name}</p></div></div>}
  </>
}

function EmptyOutletState({ outletName }: { outletName: string }) {
  return <section className="rounded-[1.75rem] bg-[#a65e44] px-6 py-16 text-center text-white shadow-lg"><span className="mx-auto grid h-20 w-20 place-items-center rounded-[1.75rem] bg-white/15 text-orange-100"><ClipboardX className="h-10 w-10" /></span><h2 className="mt-6 text-xl font-extrabold">Belum ada laporan inventaris</h2><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-white/70">Outlet <b>{outletName}</b> belum melakukan pencatatan inventaris. Data akan muncul di sini setelah pemeriksaan disimpan.</p></section>
}

function OutletSwitcher({ data, onOpen }: { data: OutletOption[]; onOpen: (id: string) => void }) {
  const [isOpen, setIsOpen] = useState(false)
  const [outletQuery, setOutletQuery] = useState('')
  const switcherRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!isOpen) return
    const closeOnOutsideClick = (event: MouseEvent) => { if (!switcherRef.current?.contains(event.target as Node)) setIsOpen(false) }
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') setIsOpen(false) }
    document.addEventListener('mousedown', closeOnOutsideClick)
    document.addEventListener('keydown', closeOnEscape)
    return () => { document.removeEventListener('mousedown', closeOnOutsideClick); document.removeEventListener('keydown', closeOnEscape) }
  }, [isOpen])
  const choose = (id: string) => { setIsOpen(false); onOpen(id) }
  const filteredData = data.filter((item) => item.name.toLowerCase().includes(outletQuery.trim().toLowerCase()))
  return <div ref={switcherRef} className="relative block"><span className="mb-1.5 block text-xs font-extrabold uppercase tracking-wide text-suka-ink/60">Outlet switcher</span><button type="button" aria-haspopup="listbox" aria-expanded={isOpen} onClick={() => setIsOpen((current) => !current)} className="flex w-full items-center justify-between gap-3 rounded-xl border border-suka-brown/15 bg-suka-cream px-3 py-3 text-left text-sm font-bold text-suka-brown outline-none transition hover:border-suka-orange hover:bg-orange-50 focus:border-suka-orange focus:ring-2 focus:ring-orange-100"><span className="flex min-w-0 items-center gap-2"><span className="grid h-6 w-6 shrink-0 place-items-center rounded-lg bg-white text-suka-orange"><Store className="h-3.5 w-3.5" /></span><span className="truncate">Pilih outlet...</span></span><ChevronDown className={`h-4 w-4 shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} /></button>{isOpen && <div role="listbox" aria-label="Pilih outlet" className="absolute left-0 right-0 top-[calc(100%+8px)] z-30 max-h-[min(28rem,calc(100vh-11rem))] overflow-y-auto overscroll-contain rounded-2xl border border-suka-brown/10 bg-white p-1.5 shadow-2xl shadow-suka-brown/15"><label className="sticky top-0 z-10 relative block bg-white p-1.5"><span className="sr-only">Cari outlet di switcher</span><Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-suka-ink/40" /><input autoFocus value={outletQuery} onChange={(event) => setOutletQuery(event.target.value)} placeholder="Cari outlet..." className="w-full rounded-xl border border-suka-brown/10 bg-suka-cream/50 py-2.5 pl-9 pr-3 text-sm font-semibold text-suka-brown outline-none transition placeholder:text-suka-ink/45 focus:border-suka-orange focus:ring-2 focus:ring-orange-100" /></label><div className="px-3 py-2 text-[10px] font-extrabold uppercase tracking-[0.16em] text-suka-ink/45">Pilih outlet untuk melihat laporan</div>{filteredData.map((item) => <button key={item.id} type="button" role="option" aria-selected={false} onClick={() => choose(item.id)} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-bold text-suka-brown transition hover:bg-suka-cream hover:text-suka-orange focus:bg-suka-cream focus:outline-none"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-suka-cream text-suka-orange"><ClipboardCheck className="h-4 w-4" /></span><span className="truncate">{item.name}</span><ArrowLeft className="ml-auto h-4 w-4 rotate-180 text-suka-orange" /></button>)}{filteredData.length === 0 && <p className="px-3 py-4 text-center text-xs text-suka-ink/55">Outlet tidak ditemukan.</p>}</div>}</div>
}

const metricTones = {
  maroon: 'bg-[#701604] text-white shadow-[#701604]/15',
  orange: 'bg-[#f29744] text-[#400a07] shadow-[#f29744]/20',
  green: 'bg-[#283c35] text-white shadow-[#283c35]/15',
  terracotta: 'bg-[#a65e44] text-white shadow-[#a65e44]/15',
}

function Metric({ icon: Icon, label, value, tone }: { icon: typeof Store; label: string; value: number; tone: keyof typeof metricTones }) {
  return <div className={`relative overflow-hidden rounded-[1.4rem] p-4 shadow-lg ${metricTones[tone]}`}><span className="pointer-events-none absolute -right-5 -top-8 h-20 w-20 rounded-full border border-white/15" /><div className="relative flex items-center justify-between"><div><div className="text-[10px] font-black uppercase tracking-[0.16em] opacity-70">{label}</div><div className="mt-2 text-3xl font-black tracking-tight">{value}</div></div><span className="grid h-11 w-11 place-items-center rounded-2xl bg-white/15"><Icon className="h-5 w-5" /></span></div></div>
}

function InventoryItemGrid({ report, query, filter, photoUrls, photosLoading, onPhoto }: {
  report: InventarisDetail
  query: string
  filter: StatusFilter
  photoUrls: Map<string, string>
  photosLoading: boolean
  onPhoto: (photo: { url: string; name: string }) => void
}) {
  const rows = useMemo(() => {
    const q = query.trim().toLowerCase()
    return report.items.filter((item) => {
      if (filter !== 'all' && (filter === 'complete') !== isAvailable(item.status)) return false
      if (!q) return true
      return [item.name, item.category, statusLabel(item.status), conditionLabel(item.condition), item.brand ?? '', item.notes ?? ''].join(' ').toLowerCase().includes(q)
    })
  }, [report.items, query, filter])

  return <section className="overflow-hidden rounded-[1.75rem] border border-[#e8b56f]/45 bg-white shadow-lg shadow-orange-950/5"><div className="flex items-center justify-between gap-3 border-b border-[#e8b56f]/45 bg-[#f5d6a0] px-5 py-4"><div><div className="flex items-center gap-2"><ClipboardCheck className="h-5 w-5 text-[#701604]" /><h2 className="font-black text-[#400a07]">Tabel laporan inventori</h2></div><p className="mt-1 text-xs font-semibold text-[#701604]/65">{rows.length} item ditampilkan sesuai filter</p></div><span className="hidden rounded-full bg-[#701604] px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.14em] text-white sm:inline-flex">Detail outlet</span></div><div className="overflow-x-auto"><table className="w-full min-w-[1080px] text-left text-sm"><caption className="sr-only">Daftar detail inventaris outlet</caption><thead className="bg-[#fff7eb] text-[10px] uppercase tracking-[0.14em] text-[#701604]/70"><tr><th className="border-b border-[#e8b56f]/35 px-5 py-4 font-black">Item inventori</th><th className="border-b border-[#e8b56f]/35 px-4 py-4 font-black">Kategori</th><th className="border-b border-[#e8b56f]/35 px-4 py-4 font-black">Status</th><th className="border-b border-[#e8b56f]/35 px-4 py-4 font-black">Kondisi</th><th className="border-b border-[#e8b56f]/35 px-4 py-4 text-right font-black">Jumlah</th><th className="border-b border-[#e8b56f]/35 px-4 py-4 font-black">Tgl pembelian</th><th className="border-b border-[#e8b56f]/35 px-4 py-4 font-black">Merek</th><th className="border-b border-[#e8b56f]/35 px-4 py-4 text-right font-black">Harga</th><th className="border-b border-[#e8b56f]/35 px-4 py-4 text-right font-black">Depresiasi</th><th className="border-b border-[#e8b56f]/35 px-4 py-4 text-center font-black">Foto</th></tr></thead><tbody className="divide-y divide-[#e8b56f]/25">{rows.map((item) => {
    const url = photoUrls.get(item.id)
    return <tr key={item.id} className="transition-colors odd:bg-white even:bg-[#fffdf9] hover:bg-[#fff1dc]"><td className="px-5 py-4"><p className="font-black text-[#400a07]">{item.name}</p>{item.notes && <p className="mt-1 max-w-xs truncate text-xs text-slate-500" title={item.notes}>{item.notes}</p>}</td><td className="px-4 py-4 text-xs font-semibold text-slate-600">{item.category}</td><td className="px-4 py-4"><span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-black ${isAvailable(item.status) ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>{item.status ? statusLabel(item.status) : 'Belum dicatat'}</span></td><td className="px-4 py-4">{item.condition ? <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-black ${conditionTones[conditionKey(item.condition)] ?? 'bg-slate-200 text-slate-700'}`}>{conditionLabel(item.condition)}</span> : <span className="text-xs font-semibold text-slate-400">-</span>}</td><td className="px-4 py-4 text-right font-mono text-xs font-black text-[#701604]">{item.quantity}{item.target ? ' / ' + item.target : ''}</td><td className="whitespace-nowrap px-4 py-4 text-xs font-semibold text-slate-600">{formatPurchaseDate(item.purchaseDate)}</td><td className="px-4 py-4 text-xs font-semibold text-slate-600">{item.brand || '-'}</td><td className="whitespace-nowrap px-4 py-4 text-right text-xs font-semibold text-slate-600">{formatMoney(item.price)}</td><td className="whitespace-nowrap px-4 py-4 text-right text-xs font-semibold text-slate-600">{item.depreciation === null ? '-' : item.depreciation + '% / tahun'}</td><td className="px-4 py-4 text-center">{url ? <button type="button" aria-label={'Lihat foto ' + item.name} onClick={() => onPhoto({ url, name: item.name })} className="inline-flex rounded-xl border border-[#e8b56f]/60 bg-[#fff7eb] p-1 transition hover:border-[#701604] hover:bg-[#f5d6a0] focus:outline-none focus:ring-2 focus:ring-[#f29744]"><img src={url} alt={'Foto ' + item.name} loading="lazy" decoding="async" className="h-11 w-11 rounded-lg object-cover" /></button> : item.photoPath && photosLoading ? <span className="mx-auto block h-11 w-11 animate-pulse rounded-lg bg-[#fff1dc]" /> : <ImageOff className="mx-auto h-4 w-4 text-slate-300" />}</td></tr>
  })}{rows.length === 0 && <tr><td colSpan={10} className="px-5 py-14 text-center text-sm font-semibold text-slate-500">Belum ada data laporan sesuai filter.</td></tr>}</tbody></table></div></section>
}

function FilterButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button type="button" onClick={onClick} className={`whitespace-nowrap rounded-xl px-4 py-2 text-sm font-bold transition ${active ? 'bg-suka-brown text-white' : 'bg-suka-cream text-suka-ink/70 hover:bg-suka-orange/15'}`}>{children}</button>
}
