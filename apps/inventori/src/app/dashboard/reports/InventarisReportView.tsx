'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { AlertCircle, ArrowLeft, Camera, CheckCircle2, ChevronDown, ClipboardCheck, ClipboardX, Clock, ExternalLink, ImageOff, LogOut, Package, PencilLine, Search, Store, X } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@suka/auth'
import { AdminInventoryNavigation } from '@/components/AdminInventoryNavigation'
import { createClient } from '@/lib/supabase'

type Raw = Record<string, any>
type StatusFilter = 'all' | 'incomplete' | 'complete'
type OutletOption = { id: string; name: string }
type Item = { id: string; name: string; category: string; status: string; condition: string; quantity: string; target: string; notes: string | null; purchaseDate: string | null; price: number | null; depreciation: number | null; brand: string | null; photoPath: string | null }
type Submission = { id: string; outletId: string; outletName: string; submittedBy: string; submittedAt: string | null; createdAt: string | null; updatedAt: string | null; notes: string | null; items: Item[] }

const text = (value: unknown, fallback = '') => typeof value === 'string' || typeof value === 'number' ? String(value) : fallback
const number = (value: unknown) => value === null || value === undefined || value === '' || !Number.isFinite(Number(value)) ? null : Number(value)
const available = (status: string) => ['sesuai', 'baik', 'ada', 'available', 'lengkap', 'ok'].includes(status.trim().toLowerCase().replace(/[_-]/g, ' '))
const conditionLabels: Record<string, string> = { baik: 'Baik', perlu_perbaikan: 'Perlu perbaikan', rusak: 'Rusak', tidak_ada: 'Tidak ada' }
const conditionTones: Record<string, string> = { baik: 'bg-emerald-100 text-emerald-800', perlu_perbaikan: 'bg-amber-100 text-amber-800', rusak: 'bg-rose-100 text-rose-800', tidak_ada: 'bg-slate-200 text-slate-700' }
const conditionKey = (value: string) => value.trim().toLowerCase().replace(/[\s-]/g, '_')
const conditionLabel = (value: string) => conditionLabels[conditionKey(value)] ?? value
const formatPurchaseDate = (value: string | null) => value ? new Date(value).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : '-'
const formatDateTime = (value: string | null) => {
  if (!value) return '-'
  const moment = new Date(value)
  if (Number.isNaN(moment.getTime())) return '-'
  const day = moment.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Jakarta' })
  const clock = moment.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' }).replace('.', ':')
  return `${day} · ${clock} WIB`
}
const formatMoney = (value: number | null) => value === null ? '-' : new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(value)
const photoUrl = (path: unknown) => {
  const value = text(path).trim()
  if (!value) return null
  if (value.startsWith('http')) {
    try {
      const parsed = new URL(value)
      const marker = '/storage/v1/object/sign/inventaris-foto/'
      const index = parsed.pathname.indexOf(marker)
      if (index >= 0) return `/api/inventaris/photo?path=${encodeURIComponent(decodeURIComponent(parsed.pathname.slice(index + marker.length)))}`
    } catch { /* fallback below */ }
    return value
  }
  return `/api/inventaris/photo?path=${encodeURIComponent(value)}`
}
export default function InventarisReportView({ outletId }: { outletId?: string }) {
  const router = useRouter()
  const { outletStaff, signOut } = useAuth()
  const [sessionMenuOpen, setSessionMenuOpen] = useState(false)
  const sessionMenuRef = useRef<HTMLDivElement>(null)
  const [data, setData] = useState<Submission[]>([])
  const [allOutlets, setAllOutlets] = useState<OutletOption[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<StatusFilter>('all')
  const [photo, setPhoto] = useState<{ url: string; name: string } | null>(null)

  useEffect(() => {
    let alive = true
    const load = async () => {
      setLoading(true)
      const db = createClient()
      const [submissions, rows, masters, outlets, staff] = await Promise.all([
        db.from('inventaris_submissions').select('*').limit(500),
        db.from('inventaris_submission_items').select('*').limit(5000),
        db.from('inventaris_master_items').select('*').limit(1000),
        db.from('outlets').select('id,name').limit(200),
        db.from('outlet_staff').select('id,name').limit(1000),
      ])
      const failure = submissions.error || rows.error || masters.error || outlets.error || staff.error
      if (failure) { if (alive) { setError(failure.message); setLoading(false) }; return }
      const outletNames = new Map((outlets.data ?? []).map((row: Raw) => [text(row.id), text(row.name, 'Outlet tanpa nama')]))
      const staffNames = new Map((staff.data ?? []).map((row: Raw) => [text(row.id), text(row.name, 'Area Manager')]))
      const master = new Map((masters.data ?? []).map((row: Raw) => [text(row.id), row]))
      const grouped = new Map<string, Raw[]>()
      for (const row of rows.data ?? []) { const id = text((row as Raw).submission_id); if (id) grouped.set(id, [...(grouped.get(id) ?? []), row as Raw]) }
      const latest = new Map<string, Submission>()
      for (const submission of [...(submissions.data ?? [])].sort((a: Raw, b: Raw) => +new Date(b.updated_at ?? b.created_at) - +new Date(a.updated_at ?? a.created_at))) {
        const outletId = text((submission as Raw).outlet_id)
        if (!outletId || latest.has(outletId)) continue
        const id = text((submission as Raw).id)
        const items = (grouped.get(id) ?? []).map((row, index) => {
          const source = master.get(text(row.master_item_id)) ?? {}
          return { id: text(row.id, `${id}-${index}`), name: text(row.item_name ?? source.name, 'Item inventaris'), category: text(row.category ?? source.section ?? source.subsection, 'Lainnya'), status: text(row.status_penilaian ?? row.status ?? row.kondisi), condition: text(row.kondisi), quantity: text(row.observed_qty ?? row.quantity) || (row.is_present === false ? 'Tidak ada' : row.is_present ? 'Ada' : '-'), target: text(row.target_quantity ?? source.target_qty), notes: text(row.catatan ?? row.notes) || null, purchaseDate: text(row.purchase_date) || null, price: number(row.purchase_price), depreciation: number(row.depreciation_rate), brand: text(row.brand) || null, photoPath: text(row.photo_path ?? row.photo_url) || null }
        })
        latest.set(outletId, { id, outletId, outletName: outletNames.get(outletId) ?? 'Outlet tanpa nama', submittedBy: staffNames.get(text((submission as Raw).submitted_by)) ?? 'Area Manager', submittedAt: text((submission as Raw).updated_at ?? (submission as Raw).submitted_at ?? (submission as Raw).created_at) || null, createdAt: text((submission as Raw).created_at) || null, updatedAt: text((submission as Raw).updated_at) || null, notes: text((submission as Raw).notes) || null, items })
      }
      // Katalog admin hanya menampilkan outlet yang sudah memiliki laporan inventaris.
      const completeData = [...latest.values()]
      if (alive) { setData(completeData); setLoading(false) }
      if (alive) setAllOutlets((outlets.data ?? []).map((row: Raw) => ({ id: text(row.id), name: text(row.name, 'Outlet tanpa nama') })).filter((outlet) => outlet.id))
    }
    void load(); return () => { alive = false }
  }, [])

  const visible = useMemo(() => data.filter((submission) => {
    if (outletId && submission.outletId !== outletId) return false
    if (!query.trim()) return true
    const searchable = [submission.outletName, submission.submittedBy, submission.notes ?? '', ...submission.items.flatMap((item) => [item.name, item.category, item.status, conditionLabel(item.condition), item.notes ?? ''])].join(' ').toLowerCase()
    return searchable.includes(query.trim().toLowerCase())
  }), [data, outletId, query])
  const allItems = visible.flatMap((submission) => submission.items)
  const complete = allItems.filter((item) => available(item.status)).length
  useEffect(() => {
    if (!sessionMenuOpen) return
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (!sessionMenuRef.current?.contains(event.target as Node)) setSessionMenuOpen(false)
    }
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSessionMenuOpen(false)
    }
    document.addEventListener('mousedown', closeOnOutsideClick)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('mousedown', closeOnOutsideClick)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [sessionMenuOpen])

  const selectedOutlet = data.find((submission) => submission.outletId === outletId)
  const selectedOutletName = selectedOutlet?.outletName ?? allOutlets.find((outlet) => outlet.id === outletId)?.name ?? 'outlet'

  return <main className="min-h-screen bg-[#4A1713] pb-24 text-suka-ink md:pb-12">
    <div className="flex min-h-screen flex-col lg:flex-row">
    <AdminInventoryNavigation active="reports" />
    <div className="min-w-0 flex-1 bg-[#fffaf5] lg:rounded-l-[2.5rem]">
    <header className="border-b border-orange-100 bg-white px-4 py-4 shadow-sm sm:px-8 lg:rounded-tl-[2.5rem]">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
        <div className="flex items-center gap-3"><span className="grid h-11 w-11 place-items-center rounded-2xl bg-[#701604] text-white"><ClipboardCheck size={23} /></span><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-[#f29744]">SUKASHAWARMA</p><h1 className="text-xl font-extrabold text-[#400a07]">Inventaris Outlet</h1></div></div>
        <div ref={sessionMenuRef} className="relative">
          <button type="button" aria-haspopup="menu" aria-expanded={sessionMenuOpen} onClick={() => setSessionMenuOpen((current) => !current)} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-600 outline-none transition hover:bg-slate-50 focus:border-[#f29744] focus:ring-2 focus:ring-orange-100"><LogOut size={16} /> Menu <ChevronDown size={16} className={`transition-transform ${sessionMenuOpen ? 'rotate-180' : ''}`} /></button>
          {sessionMenuOpen && <div role="menu" className="absolute right-0 top-[calc(100%+8px)] z-50 w-52 rounded-2xl border border-orange-100 bg-white p-1.5 shadow-xl shadow-orange-950/10">
            <button type="button" role="menuitem" onClick={() => { setSessionMenuOpen(false); router.push('/dashboard') }} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-slate-700 transition hover:bg-orange-50 hover:text-[#701604]"><ClipboardCheck size={16} className="text-[#f29744]" /> Dashboard</button>
            <button type="button" role="menuitem" onClick={() => { setSessionMenuOpen(false); window.location.href = process.env.NEXT_PUBLIC_PORTAL_URL || 'https://app.sukashawarma.com' }} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-slate-700 transition hover:bg-orange-50 hover:text-[#701604]"><ExternalLink size={16} className="text-[#f29744]" /> Kembali ke portal</button>
            <button type="button" role="menuitem" onClick={() => { setSessionMenuOpen(false); void signOut() }} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-red-700 transition hover:bg-red-50"><LogOut size={16} /> Keluar dari akun</button>
          </div>}
        </div>
      </div>
    </header>
    <div className={`mx-auto w-full space-y-5 px-4 pt-6 sm:px-8 ${outletId ? 'max-w-[1600px]' : 'max-w-[1280px]'}`}>
      <section className="rounded-3xl bg-[#701604] p-5 text-white shadow-lg sm:p-7"><p className="text-sm text-orange-100">Halo, {outletStaff?.name ?? 'Admin'}</p><h2 className="mt-1 text-2xl font-extrabold">{outletId ? `Laporan ${selectedOutletName}` : 'Pusat laporan inventaris'}</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-orange-100">{outletId ? 'Kelola dan periksa detail laporan inventaris outlet dalam format tabel.' : 'Pilih outlet untuk melihat laporan inventaris secara lengkap.'}</p></section>
      <button type="button" onClick={() => router.push(outletId ? '/dashboard/reports' : '/dashboard')} className="inline-flex items-center gap-2 rounded-xl border border-orange-200 bg-white px-4 py-2 text-sm font-bold text-[#701604] shadow-sm"><ArrowLeft className="h-4 w-4" /> {outletId ? 'Kembali ke daftar outlet' : 'Kembali ke dashboard'}</button>
      {loading ? <div className="grid gap-4 md:grid-cols-3"><div className="h-28 animate-pulse rounded-3xl bg-[#701604]" /><div className="h-28 animate-pulse rounded-3xl bg-[#f29744]" /><div className="h-28 animate-pulse rounded-3xl bg-[#283c35]" /></div> : error ? <div className="rounded-3xl border border-rose-200 bg-rose-50 p-8 text-center text-rose-700"><AlertCircle className="mx-auto mb-3" /><b>Gagal memuat laporan</b><p className="mt-1 text-sm">{error}</p></div> : <>
         {!outletId && <OutletCards data={visible} outlets={allOutlets} query={query} onQueryChange={setQuery} onOpen={(id) => router.push(`/dashboard/reports/${id}`)} />}
         {outletId && visible.length === 0 && <EmptyOutletState outletName={selectedOutletName} />}
         {outletId && visible.length > 0 && <>
        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><Metric icon={Store} label="Outlet" value={visible.length} tone="maroon" /><Metric icon={Package} label="Total item" value={allItems.length} tone="orange" /><Metric icon={CheckCircle2} label="Lengkap" value={complete} tone="green" /><Metric icon={Camera} label="Dengan foto" value={allItems.filter((item) => item.photoPath).length} tone="terracotta" /></section>
        <section className="rounded-[1.6rem] bg-[#f5d6a0] p-4 shadow-lg shadow-orange-950/5 sm:p-5">
          <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_280px]">
            <label className="relative block"><span className="sr-only">Cari laporan inventaris</span><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-suka-ink/40" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Cari outlet, Area Manager, atau item..." className="w-full rounded-xl border border-suka-brown/15 bg-white py-3 pl-10 pr-3 text-sm outline-none transition focus:border-suka-orange focus:ring-2 focus:ring-orange-100" /></label>
            <OutletSwitcher data={allOutlets} onOpen={(id) => router.push(`/dashboard/reports/${id}`)} />
          </div>
          <div className="mt-4 flex flex-wrap gap-2"><span className="self-center pr-1 text-xs font-extrabold uppercase tracking-wide text-suka-ink/50">Status</span><FilterButton active={filter === 'all'} onClick={() => setFilter('all')}>Semua</FilterButton><FilterButton active={filter === 'incomplete'} onClick={() => setFilter('incomplete')}>Kurang</FilterButton><FilterButton active={filter === 'complete'} onClick={() => setFilter('complete')}>Lengkap</FilterButton></div>
        </section>
        <InventoryItemGrid submissions={visible} filter={filter} onPhoto={setPhoto} />
        </>}
      </>}
    </div>
    {photo && <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4" onClick={() => setPhoto(null)}><div className="relative max-h-full max-w-3xl rounded-3xl bg-white p-2" onClick={(event) => event.stopPropagation()}><button type="button" className="absolute right-4 top-4 rounded-full bg-black/60 p-2 text-white" onClick={() => setPhoto(null)}><X className="h-5 w-5" /></button><img src={photo.url} alt={`Foto ${photo.name}`} className="max-h-[78vh] max-w-full rounded-2xl object-contain" /><p className="p-2 text-center text-sm font-bold">{photo.name}</p></div></div>}
    </div>
    </div>
  </main>
}

function OutletCards({ data, outlets, query, onQueryChange, onOpen }: { data: Submission[]; outlets: OutletOption[]; query: string; onQueryChange: (value: string) => void; onOpen: (id: string) => void }) {
  return <section className="space-y-4">
    <div className="rounded-[1.6rem] bg-[#f5d6a0] p-4 shadow-lg shadow-orange-950/5 sm:p-5"><div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_280px]"><label className="relative block"><span className="sr-only">Cari outlet</span><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#701604]/50" /><input value={query} onChange={(event) => onQueryChange(event.target.value)} placeholder="Cari outlet atau Area Manager..." className="w-full rounded-xl border border-[#701604]/15 bg-white/85 py-3 pl-10 pr-3 text-sm font-semibold text-[#400a07] outline-none transition focus:border-[#701604] focus:bg-white focus:ring-4 focus:ring-white/50" /></label><OutletSwitcher data={outlets} onOpen={onOpen} /></div></div>
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{data.map((submission, index) => { const recorded = submission.items.length > 0; const tone = cardTones[index % cardTones.length]; return <button key={submission.outletId} type="button" onClick={() => onOpen(submission.outletId)} className={`group relative flex min-h-[19rem] flex-col overflow-hidden rounded-[1.5rem] border p-4 text-left shadow-lg transition hover:-translate-y-1 hover:shadow-2xl focus:outline-none focus:ring-4 focus:ring-orange-200 ${tone.card}`}><span className="pointer-events-none absolute -right-12 -top-16 h-40 w-40 rounded-full border border-white/15" /><span className="pointer-events-none absolute -bottom-24 -left-10 h-44 w-44 rounded-full bg-white/10" /><div className="relative flex min-w-0 flex-1 flex-col"><div className="flex items-start justify-between gap-4"><span className={`grid h-12 w-12 place-items-center rounded-2xl ${tone.icon}`}>{recorded ? <ClipboardCheck className="h-6 w-6" /> : <ClipboardX className="h-6 w-6" />}</span><span className={`rounded-full px-3 py-1 text-xs font-black ${tone.chip}`}>{recorded ? `${submission.items.length} item` : 'Belum dicatat'}</span></div><div className="mt-auto pt-5"><p className={`text-[10px] font-black uppercase tracking-[0.18em] ${tone.eyebrow}`}>{recorded ? 'Laporan terbaru' : 'Menunggu pencatatan'}</p><h3 className="mt-2 text-lg font-black leading-tight">{submission.outletName}</h3><p className={`mt-2 text-sm ${tone.muted}`}>{recorded ? `Laporan terakhir oleh ${submission.submittedBy}` : 'Belum ada pencatatan inventaris'}</p>{recorded && <dl className={`mt-3 space-y-1 text-[11px] font-bold ${tone.muted}`}><div className="flex items-center gap-1.5"><Clock className="h-3.5 w-3.5 shrink-0" /><dt className="sr-only">Waktu input</dt><dd className="truncate">Input {formatDateTime(submission.createdAt)}</dd></div><div className="flex items-center gap-1.5"><PencilLine className="h-3.5 w-3.5 shrink-0" /><dt className="sr-only">Waktu edit terakhir</dt><dd className="truncate">Edit {submission.updatedAt && submission.updatedAt !== submission.createdAt ? formatDateTime(submission.updatedAt) : 'belum pernah'}</dd></div></dl>}</div><div className={`mt-5 flex items-center justify-between border-t pt-4 text-xs font-black ${tone.footer}`}><span>{recorded ? 'Buka laporan inventori' : 'Mulai pencatatan'}</span><ArrowLeft className="h-4 w-4 rotate-180 transition group-hover:translate-x-1" /></div></div></button> })}{data.length === 0 && <div className="rounded-3xl bg-[#a65e44] p-12 text-center text-sm font-semibold text-white shadow-lg sm:col-span-2">Outlet tidak ditemukan.</div>}</div>
  </section>
}

const cardTones = [
  { card: 'border-[#701604] bg-[#701604] text-white', icon: 'bg-white/15 text-[#ffd4a8]', chip: 'bg-white/15 text-white', eyebrow: 'text-orange-200', muted: 'text-orange-100', footer: 'border-white/20 text-orange-100' },
  { card: 'border-[#f29744] bg-[#f29744] text-[#400a07]', icon: 'bg-white/35 text-[#701604]', chip: 'bg-white/55 text-[#701604]', eyebrow: 'text-[#701604]/70', muted: 'text-[#4A1713]/75', footer: 'border-[#701604]/20 text-[#701604]' },
  { card: 'border-[#283c35] bg-[#283c35] text-white', icon: 'bg-white/15 text-[#f7c58b]', chip: 'bg-[#f7c58b] text-[#283c35]', eyebrow: 'text-[#f7c58b]', muted: 'text-white/70', footer: 'border-white/20 text-[#f7c58b]' },
  { card: 'border-[#a65e44] bg-[#a65e44] text-white', icon: 'bg-white/15 text-white', chip: 'bg-white/20 text-white', eyebrow: 'text-orange-100', muted: 'text-white/75', footer: 'border-white/20 text-white' },
]

function EmptyOutletState({ outletName }: { outletName: string }) {
  return <section className="rounded-[1.75rem] bg-[#a65e44] px-6 py-16 text-center text-white shadow-lg"><span className="mx-auto grid h-20 w-20 place-items-center rounded-[1.75rem] bg-white/15 text-orange-100"><ClipboardX className="h-10 w-10" /></span><h2 className="mt-6 text-xl font-extrabold">Belum ada laporan inventaris</h2><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-white/70">Outlet <b>{outletName}</b> belum melakukan pencatatan inventaris. Data akan muncul di sini setelah pemeriksaan disimpan.</p></section>
}

function OutletSwitcher({ data, onOpen }: { data: Array<Submission | OutletOption>; onOpen: (id: string) => void }) {
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
  const getOutletId = (item: Submission | OutletOption) => 'outletId' in item ? item.outletId : item.id
  const getOutletName = (item: Submission | OutletOption) => 'outletName' in item ? item.outletName : item.name
  const filteredData = data.filter((item) => getOutletName(item).toLowerCase().includes(outletQuery.trim().toLowerCase()))
  return <div ref={switcherRef} className="relative block"><span className="mb-1.5 block text-xs font-extrabold uppercase tracking-wide text-suka-ink/60">Outlet switcher</span><button type="button" aria-haspopup="listbox" aria-expanded={isOpen} onClick={() => setIsOpen((current) => !current)} className="flex w-full items-center justify-between gap-3 rounded-xl border border-suka-brown/15 bg-suka-cream px-3 py-3 text-left text-sm font-bold text-suka-brown outline-none transition hover:border-suka-orange hover:bg-orange-50 focus:border-suka-orange focus:ring-2 focus:ring-orange-100"><span className="flex min-w-0 items-center gap-2"><span className="grid h-6 w-6 shrink-0 place-items-center rounded-lg bg-white text-suka-orange"><Store className="h-3.5 w-3.5" /></span><span className="truncate">Pilih outlet...</span></span><ChevronDown className={`h-4 w-4 shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} /></button>{isOpen && <div role="listbox" aria-label="Pilih outlet" className="absolute left-0 right-0 top-[calc(100%+8px)] z-30 max-h-[min(28rem,calc(100vh-11rem))] overflow-y-auto overscroll-contain rounded-2xl border border-suka-brown/10 bg-white p-1.5 shadow-2xl shadow-suka-brown/15"><label className="sticky top-0 z-10 relative block bg-white p-1.5"><span className="sr-only">Cari outlet di switcher</span><Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-suka-ink/40" /><input autoFocus value={outletQuery} onChange={(event) => setOutletQuery(event.target.value)} placeholder="Cari outlet..." className="w-full rounded-xl border border-suka-brown/10 bg-suka-cream/50 py-2.5 pl-9 pr-3 text-sm font-semibold text-suka-brown outline-none transition placeholder:text-suka-ink/45 focus:border-suka-orange focus:ring-2 focus:ring-orange-100" /></label><div className="px-3 py-2 text-[10px] font-extrabold uppercase tracking-[0.16em] text-suka-ink/45">Pilih outlet untuk melihat laporan</div>{filteredData.map((item) => <button key={getOutletId(item)} type="button" role="option" onClick={() => choose(getOutletId(item))} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-bold text-suka-brown transition hover:bg-suka-cream hover:text-suka-orange focus:bg-suka-cream focus:outline-none"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-suka-cream text-suka-orange"><ClipboardCheck className="h-4 w-4" /></span><span className="truncate">{getOutletName(item)}</span><ArrowLeft className="ml-auto h-4 w-4 rotate-180 text-suka-orange" /></button>)}{filteredData.length === 0 && <p className="px-3 py-4 text-center text-xs text-suka-ink/55">Outlet tidak ditemukan.</p>}</div>}</div>
}

const metricTones = {
  maroon: 'bg-[#701604] text-white shadow-[#701604]/15',
  orange: 'bg-[#f29744] text-[#400a07] shadow-[#f29744]/20',
  green: 'bg-[#283c35] text-white shadow-[#283c35]/15',
  terracotta: 'bg-[#a65e44] text-white shadow-[#a65e44]/15',
}

function Metric({ icon: Icon, label, value, tone }: { icon: typeof Store; label: string; value: number; tone: keyof typeof metricTones }) { return <div className={`relative overflow-hidden rounded-[1.4rem] p-4 shadow-lg ${metricTones[tone]}`}><span className="pointer-events-none absolute -right-5 -top-8 h-20 w-20 rounded-full border border-white/15" /><div className="relative flex items-center justify-between"><div><div className="text-[10px] font-black uppercase tracking-[0.16em] opacity-70">{label}</div><div className="mt-2 text-3xl font-black tracking-tight">{value}</div></div><span className="grid h-11 w-11 place-items-center rounded-2xl bg-white/15"><Icon className="h-5 w-5" /></span></div></div> }

function InventoryItemGrid({ submissions, filter, onPhoto }: { submissions: Submission[]; filter: StatusFilter; onPhoto: (photo: { url: string; name: string }) => void }) {
  const rows = submissions.flatMap((submission) => submission.items.filter((item) => filter === 'all' || (filter === 'complete' ? available(item.status) : !available(item.status))).map((item) => ({ ...item, outletName: submission.outletName })))
  return <section className="overflow-hidden rounded-[1.75rem] border border-[#e8b56f]/45 bg-white shadow-lg shadow-orange-950/5"><div className="flex items-center justify-between gap-3 border-b border-[#e8b56f]/45 bg-[#f5d6a0] px-5 py-4"><div><div className="flex items-center gap-2"><ClipboardCheck className="h-5 w-5 text-[#701604]" /><h2 className="font-black text-[#400a07]">Tabel laporan inventori</h2></div><p className="mt-1 text-xs font-semibold text-[#701604]/65">{rows.length} item ditampilkan sesuai filter</p></div><span className="hidden rounded-full bg-[#701604] px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.14em] text-white sm:inline-flex">Detail outlet</span></div><div className="overflow-x-auto"><table className="w-full min-w-[1080px] text-left text-sm"><caption className="sr-only">Daftar detail inventaris outlet</caption><thead className="bg-[#fff7eb] text-[10px] uppercase tracking-[0.14em] text-[#701604]/70"><tr><th className="border-b border-[#e8b56f]/35 px-5 py-4 font-black">Item inventori</th><th className="border-b border-[#e8b56f]/35 px-4 py-4 font-black">Kategori</th><th className="border-b border-[#e8b56f]/35 px-4 py-4 font-black">Status</th><th className="border-b border-[#e8b56f]/35 px-4 py-4 font-black">Kondisi</th><th className="border-b border-[#e8b56f]/35 px-4 py-4 text-right font-black">Jumlah</th><th className="border-b border-[#e8b56f]/35 px-4 py-4 font-black">Tgl pembelian</th><th className="border-b border-[#e8b56f]/35 px-4 py-4 font-black">Merek</th><th className="border-b border-[#e8b56f]/35 px-4 py-4 text-right font-black">Harga</th><th className="border-b border-[#e8b56f]/35 px-4 py-4 text-right font-black">Depresiasi</th><th className="border-b border-[#e8b56f]/35 px-4 py-4 text-center font-black">Foto</th></tr></thead><tbody className="divide-y divide-[#e8b56f]/25">{rows.map((item) => <tr key={item.id} className="transition-colors odd:bg-white even:bg-[#fffdf9] hover:bg-[#fff1dc]"><td className="px-5 py-4"><p className="font-black text-[#400a07]">{item.name}</p>{item.notes && <p className="mt-1 max-w-xs truncate text-xs text-slate-500" title={item.notes}>{item.notes}</p>}</td><td className="px-4 py-4 text-xs font-semibold text-slate-600">{item.category}</td><td className="px-4 py-4"><span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-black ${available(item.status) ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>{item.status || 'Belum dicatat'}</span></td><td className="px-4 py-4">{item.condition ? <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-black ${conditionTones[conditionKey(item.condition)] ?? 'bg-slate-200 text-slate-700'}`}>{conditionLabel(item.condition)}</span> : <span className="text-xs font-semibold text-slate-400">-</span>}</td><td className="px-4 py-4 text-right font-mono text-xs font-black text-[#701604]">{item.quantity}{item.target ? ' / ' + item.target : ''}</td><td className="whitespace-nowrap px-4 py-4 text-xs font-semibold text-slate-600">{formatPurchaseDate(item.purchaseDate)}</td><td className="px-4 py-4 text-xs font-semibold text-slate-600">{item.brand || '-'}</td><td className="whitespace-nowrap px-4 py-4 text-right text-xs font-semibold text-slate-600">{formatMoney(item.price)}</td><td className="whitespace-nowrap px-4 py-4 text-right text-xs font-semibold text-slate-600">{item.depreciation === null ? '-' : item.depreciation + '% / tahun'}</td><td className="px-4 py-4 text-center">{item.photoPath ? <button type="button" aria-label={'Lihat foto ' + item.name} onClick={() => { const url = photoUrl(item.photoPath); if (url) onPhoto({ url, name: item.name }) }} className="inline-flex rounded-xl border border-[#e8b56f]/60 bg-[#fff7eb] p-1 transition hover:border-[#701604] hover:bg-[#f5d6a0] focus:outline-none focus:ring-2 focus:ring-[#f29744]"><img src={photoUrl(item.photoPath) ?? ''} alt={'Foto ' + item.name} className="h-11 w-11 rounded-lg object-cover" /></button> : <ImageOff className="mx-auto h-4 w-4 text-slate-300" />}</td></tr>)}{rows.length === 0 && <tr><td colSpan={10} className="px-5 py-14 text-center text-sm font-semibold text-slate-500">Belum ada data laporan sesuai filter.</td></tr>}</tbody></table></div></section>
}

function FilterButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) { return <button type="button" onClick={onClick} className={`whitespace-nowrap rounded-xl px-4 py-2 text-sm font-bold transition ${active ? 'bg-suka-brown text-white' : 'bg-suka-cream text-suka-ink/70 hover:bg-suka-orange/15'}`}>{children}</button> }







