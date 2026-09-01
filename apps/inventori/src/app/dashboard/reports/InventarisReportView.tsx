'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { AlertCircle, ArrowLeft, CalendarDays, Camera, CheckCircle2, ChevronDown, CircleDollarSign, ClipboardCheck, ClipboardX, ExternalLink, Grid2X2, ImageOff, LogOut, Package, Search, Store, Tag, TrendingDown, X, ZoomIn } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@suka/auth'
import { AdminInventoryNavigation } from '@/components/AdminInventoryNavigation'
import { createClient } from '@/lib/supabase'

type Raw = Record<string, any>
type StatusFilter = 'all' | 'incomplete' | 'complete'
type OutletOption = { id: string; name: string }
type Item = { id: string; name: string; category: string; status: string; quantity: string; target: string; notes: string | null; purchaseDate: string | null; price: number | null; depreciation: number | null; brand: string | null; photoPath: string | null }
type Submission = { id: string; outletId: string; outletName: string; submittedBy: string; submittedAt: string | null; notes: string | null; items: Item[] }

const text = (value: unknown, fallback = '') => typeof value === 'string' || typeof value === 'number' ? String(value) : fallback
const number = (value: unknown) => value === null || value === undefined || value === '' || !Number.isFinite(Number(value)) ? null : Number(value)
const available = (status: string) => ['sesuai', 'baik', 'ada', 'available', 'lengkap', 'ok'].includes(status.trim().toLowerCase().replace(/[_-]/g, ' '))
const formatPurchaseDate = (value: string | null) => value ? new Date(value).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : '-'
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
          return { id: text(row.id, `${id}-${index}`), name: text(row.item_name ?? source.name, 'Item inventaris'), category: text(row.category ?? source.section ?? source.subsection, 'Lainnya'), status: text(row.status_penilaian ?? row.status ?? row.kondisi), quantity: text(row.observed_qty ?? row.quantity) || (row.is_present === false ? 'Tidak ada' : row.is_present ? 'Ada' : '-'), target: text(row.target_quantity ?? source.target_qty), notes: text(row.catatan ?? row.notes) || null, purchaseDate: text(row.purchase_date) || null, price: number(row.purchase_price), depreciation: number(row.depreciation_rate), brand: text(row.brand) || null, photoPath: text(row.photo_path ?? row.photo_url) || null }
        })
        latest.set(outletId, { id, outletId, outletName: outletNames.get(outletId) ?? 'Outlet tanpa nama', submittedBy: staffNames.get(text((submission as Raw).submitted_by)) ?? 'Area Manager', submittedAt: text((submission as Raw).updated_at ?? (submission as Raw).submitted_at ?? (submission as Raw).created_at) || null, notes: text((submission as Raw).notes) || null, items })
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
    const searchable = [submission.outletName, submission.submittedBy, submission.notes ?? '', ...submission.items.flatMap((item) => [item.name, item.category, item.status, item.notes ?? ''])].join(' ').toLowerCase()
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
      {loading ? <div className="grid gap-4 md:grid-cols-3"><div className="h-28 animate-pulse rounded-3xl bg-white" /><div className="h-28 animate-pulse rounded-3xl bg-white" /><div className="h-28 animate-pulse rounded-3xl bg-white" /></div> : error ? <div className="rounded-3xl border border-rose-200 bg-rose-50 p-8 text-center text-rose-700"><AlertCircle className="mx-auto mb-3" /><b>Gagal memuat laporan</b><p className="mt-1 text-sm">{error}</p></div> : <>
         {!outletId && <OutletCards data={visible} outlets={allOutlets} query={query} onQueryChange={setQuery} onOpen={(id) => router.push(`/dashboard/reports/${id}`)} />}
         {outletId && visible.length === 0 && <EmptyOutletState outletName={selectedOutletName} />}
         {outletId && visible.length > 0 && <>
        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><Metric icon={Store} label="Outlet" value={visible.length} tone="maroon" /><Metric icon={Package} label="Total item" value={allItems.length} tone="orange" /><Metric icon={CheckCircle2} label="Lengkap" value={complete} tone="green" /><Metric icon={Camera} label="Dengan foto" value={allItems.filter((item) => item.photoPath).length} tone="terracotta" /></section>
        <section className="rounded-3xl border border-suka-brown/10 bg-white p-4 shadow-sm sm:p-5">
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
    <div className="rounded-3xl border border-suka-brown/10 bg-white p-4 shadow-sm sm:p-5"><div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_280px]"><label className="relative block"><span className="sr-only">Cari outlet</span><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-suka-ink/40" /><input value={query} onChange={(event) => onQueryChange(event.target.value)} placeholder="Cari outlet atau Area Manager..." className="w-full rounded-xl border border-suka-brown/15 bg-white py-3 pl-10 pr-3 text-sm outline-none transition focus:border-suka-orange focus:ring-2 focus:ring-orange-100" /></label><OutletSwitcher data={outlets} onOpen={onOpen} /></div></div>
    <div className="grid gap-4 sm:grid-cols-2">{data.map((submission, index) => { const recorded = submission.items.length > 0; const tone = cardTones[index % cardTones.length]; return <button key={submission.outletId} type="button" onClick={() => onOpen(submission.outletId)} className={`group relative min-h-[245px] overflow-hidden rounded-[1.75rem] border p-5 text-left shadow-lg transition hover:-translate-y-1 hover:shadow-2xl focus:outline-none focus:ring-4 focus:ring-orange-200 ${tone.card}`}><span className="pointer-events-none absolute -right-12 -top-16 h-40 w-40 rounded-full border border-white/15" /><span className="pointer-events-none absolute -bottom-24 -left-10 h-44 w-44 rounded-full bg-white/10" /><div className="relative flex h-full flex-col"><div className="flex items-start justify-between gap-4"><span className={`grid h-12 w-12 place-items-center rounded-2xl ${tone.icon}`}>{recorded ? <ClipboardCheck className="h-6 w-6" /> : <ClipboardX className="h-6 w-6" />}</span><span className={`rounded-full px-3 py-1 text-xs font-black ${tone.chip}`}>{recorded ? `${submission.items.length} item` : 'Belum dicatat'}</span></div><div className="mt-auto pt-10"><p className={`text-[10px] font-black uppercase tracking-[0.18em] ${tone.eyebrow}`}>{recorded ? 'Laporan terbaru' : 'Menunggu pencatatan'}</p><h3 className="mt-2 text-xl font-black leading-tight">{submission.outletName}</h3><p className={`mt-2 text-sm ${tone.muted}`}>{recorded ? `Laporan terakhir oleh ${submission.submittedBy}` : 'Belum ada pencatatan inventaris'}</p></div><div className={`mt-5 flex items-center justify-between border-t pt-4 text-xs font-black ${tone.footer}`}><span>{recorded ? 'Buka laporan inventori' : 'Mulai pencatatan'}</span><ArrowLeft className="h-4 w-4 rotate-180 transition group-hover:translate-x-1" /></div></div></button> })}{data.length === 0 && <div className="sm:col-span-2 rounded-3xl border border-dashed border-orange-200 bg-white p-12 text-center text-sm text-suka-ink/60">Outlet tidak ditemukan.</div>}</div>
  </section>
}

const cardTones = [
  { card: 'border-[#701604] bg-[#701604] text-white', icon: 'bg-white/15 text-[#ffd4a8]', chip: 'bg-white/15 text-white', eyebrow: 'text-orange-200', muted: 'text-orange-100', footer: 'border-white/20 text-orange-100' },
  { card: 'border-[#f29744] bg-[#f29744] text-[#400a07]', icon: 'bg-white/35 text-[#701604]', chip: 'bg-white/55 text-[#701604]', eyebrow: 'text-[#701604]/70', muted: 'text-[#4A1713]/75', footer: 'border-[#701604]/20 text-[#701604]' },
  { card: 'border-[#283c35] bg-[#283c35] text-white', icon: 'bg-white/15 text-[#f7c58b]', chip: 'bg-[#f7c58b] text-[#283c35]', eyebrow: 'text-[#f7c58b]', muted: 'text-white/70', footer: 'border-white/20 text-[#f7c58b]' },
  { card: 'border-[#a65e44] bg-[#a65e44] text-white', icon: 'bg-white/15 text-white', chip: 'bg-white/20 text-white', eyebrow: 'text-orange-100', muted: 'text-white/75', footer: 'border-white/20 text-white' },
]

function EmptyOutletState({ outletName }: { outletName: string }) {
  return <section className="rounded-3xl border border-dashed border-suka-brown/15 bg-white px-6 py-16 text-center shadow-sm"><span className="mx-auto grid h-20 w-20 place-items-center rounded-[1.75rem] bg-slate-100 text-slate-400"><ClipboardX className="h-10 w-10" /></span><h2 className="mt-6 text-xl font-extrabold text-suka-brown">Belum ada laporan inventaris</h2><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-suka-ink/60">Outlet <b>{outletName}</b> belum melakukan pencatatan inventaris. Data akan muncul di sini setelah pemeriksaan disimpan.</p></section>
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

const itemCardTones = [
  { surface: 'border-[#701604] bg-[#701604] text-white', accent: 'text-orange-200', panel: 'border-white/15 bg-white/10', muted: 'text-orange-100/75' },
  { surface: 'border-[#f29744] bg-[#f29744] text-[#400a07]', accent: 'text-[#701604]', panel: 'border-[#701604]/15 bg-white/30', muted: 'text-[#4A1713]/70' },
  { surface: 'border-[#283c35] bg-[#283c35] text-white', accent: 'text-[#f7c58b]', panel: 'border-white/15 bg-white/10', muted: 'text-white/65' },
  { surface: 'border-[#a65e44] bg-[#a65e44] text-white', accent: 'text-orange-100', panel: 'border-white/15 bg-white/10', muted: 'text-white/70' },
]

function InventoryItemGrid({ submissions, filter, onPhoto }: { submissions: Submission[]; filter: StatusFilter; onPhoto: (photo: { url: string; name: string }) => void }) {
  const rows = submissions.flatMap((submission) => submission.items.filter((item) => filter === 'all' || (filter === 'complete' ? available(item.status) : !available(item.status))).map((item) => ({ ...item, outletName: submission.outletName })))
  return <section className="space-y-4"><div className="flex flex-col justify-between gap-3 rounded-[1.5rem] bg-[#400a07] px-5 py-4 text-white shadow-lg sm:flex-row sm:items-center"><div><div className="flex items-center gap-2"><Grid2X2 className="h-5 w-5 text-[#f29744]" /><h2 className="font-black">Kartu inventori outlet</h2></div><p className="mt-1 text-xs text-orange-100/75">{rows.length} item ditampilkan sesuai pencarian dan filter</p></div><span className="w-fit rounded-full bg-white/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.16em] text-orange-100">Klik foto untuk memperbesar</span></div><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{rows.map((item, index) => { const tone = itemCardTones[index % itemCardTones.length]; const isAvailable = available(item.status); const imageUrl = photoUrl(item.photoPath); return <article key={item.id} className={`group relative overflow-hidden rounded-[1.75rem] border shadow-lg transition duration-300 hover:-translate-y-1.5 hover:shadow-2xl ${tone.surface}`}><div className="relative h-40 overflow-hidden bg-black/10">{imageUrl ? <button type="button" onClick={() => onPhoto({ url: imageUrl, name: item.name })} className="block h-full w-full overflow-hidden text-left focus:outline-none focus:ring-4 focus:ring-inset focus:ring-orange-200"><img src={imageUrl} alt={`Foto ${item.name}`} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" /><span className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/10" /><span className="absolute bottom-3 right-3 inline-flex items-center gap-1.5 rounded-full bg-black/55 px-3 py-1.5 text-[10px] font-black uppercase tracking-wide text-white backdrop-blur"><ZoomIn className="h-3.5 w-3.5" /> Lihat foto</span></button> : <div className="grid h-full place-items-center bg-white/10"><span className="flex flex-col items-center gap-2 text-white/60"><ImageOff className="h-8 w-8" /><span className="text-xs font-bold">Foto belum tersedia</span></span></div>}<span className="absolute left-3 top-3 rounded-full bg-black/55 px-3 py-1.5 text-[10px] font-black uppercase tracking-wide text-white backdrop-blur">{item.category}</span><span className={`absolute right-3 top-3 rounded-full px-3 py-1.5 text-[10px] font-black uppercase tracking-wide shadow-sm ${isAvailable ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>{item.status || 'Belum dicatat'}</span></div><div className="relative p-5"><p className={`text-[10px] font-black uppercase tracking-[0.18em] ${tone.accent}`}>{item.outletName}</p><h3 className="mt-2 min-h-12 text-xl font-black leading-tight">{item.name}</h3><div className={`mt-4 flex items-center justify-between rounded-2xl border p-3 ${tone.panel}`}><div><p className={`text-[9px] font-black uppercase tracking-wider ${tone.muted}`}>Terinput</p><p className="mt-1 text-lg font-black">{item.quantity || '-'}</p></div><div className="h-9 w-px bg-current opacity-15" /><div className="text-right"><p className={`text-[9px] font-black uppercase tracking-wider ${tone.muted}`}>Target</p><p className="mt-1 text-lg font-black">{item.target || '-'}</p></div></div><dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-xs"><div><dt className={`flex items-center gap-1.5 ${tone.muted}`}><Tag className="h-3.5 w-3.5" /> Merek</dt><dd className="mt-1 truncate font-bold">{item.brand || '-'}</dd></div><div><dt className={`flex items-center gap-1.5 ${tone.muted}`}><CalendarDays className="h-3.5 w-3.5" /> Pembelian</dt><dd className="mt-1 font-bold">{formatPurchaseDate(item.purchaseDate)}</dd></div><div><dt className={`flex items-center gap-1.5 ${tone.muted}`}><CircleDollarSign className="h-3.5 w-3.5" /> Harga</dt><dd className="mt-1 truncate font-bold">{formatMoney(item.price)}</dd></div><div><dt className={`flex items-center gap-1.5 ${tone.muted}`}><TrendingDown className="h-3.5 w-3.5" /> Depresiasi</dt><dd className="mt-1 font-bold">{item.depreciation === null ? '-' : `${item.depreciation}% / tahun`}</dd></div></dl>{item.notes && <p className={`mt-4 rounded-xl border px-3 py-2 text-xs leading-5 ${tone.panel}`}>{item.notes}</p>}</div></article> })}{rows.length === 0 && <div className="rounded-[1.75rem] border border-dashed border-orange-200 bg-white px-6 py-16 text-center md:col-span-2 xl:col-span-3"><ClipboardX className="mx-auto h-9 w-9 text-orange-300" /><h3 className="mt-3 font-black text-[#701604]">Tidak ada item pada filter ini</h3><p className="mt-1 text-sm text-slate-500">Coba ubah pencarian atau pilih status lainnya.</p></div>}</div></section>
}
function FilterButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) { return <button type="button" onClick={onClick} className={`whitespace-nowrap rounded-xl px-4 py-2 text-sm font-bold transition ${active ? 'bg-suka-brown text-white' : 'bg-suka-cream text-suka-ink/70 hover:bg-suka-orange/15'}`}>{children}</button> }
