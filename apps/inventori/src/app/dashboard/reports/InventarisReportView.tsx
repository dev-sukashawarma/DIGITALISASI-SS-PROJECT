'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { AlertCircle, ArrowLeft, Camera, CheckCircle2, ChevronDown, ClipboardCheck, ClipboardX, ExternalLink, ImageOff, LogOut, Package, Search, Store, Table2, X } from 'lucide-react'
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

  return <main className="min-h-screen bg-[#fffaf5] pb-24 text-suka-ink md:pb-12">
    <header className="border-b border-orange-100 bg-white px-4 py-4 shadow-sm sm:px-8">
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
    <div className={`mx-auto grid w-full gap-5 px-4 pt-6 md:grid-cols-[230px_minmax(0,1fr)] sm:px-8 ${outletId ? 'max-w-[1600px]' : 'max-w-[1280px]'}`}>
      <AdminInventoryNavigation active="reports" />
      <div className="min-w-0 space-y-5">
      <section className="rounded-3xl bg-[#701604] p-5 text-white shadow-lg sm:p-7"><p className="text-sm text-orange-100">Halo, {outletStaff?.name ?? 'Admin'}</p><h2 className="mt-1 text-2xl font-extrabold">{outletId ? `Laporan ${selectedOutletName}` : 'Pusat laporan inventaris'}</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-orange-100">{outletId ? 'Kelola dan periksa detail laporan inventaris outlet dalam format tabel.' : 'Pilih outlet untuk melihat laporan inventaris secara lengkap.'}</p></section>
      <button type="button" onClick={() => router.push(outletId ? '/dashboard/reports' : '/dashboard')} className="inline-flex items-center gap-2 rounded-xl border border-orange-200 bg-white px-4 py-2 text-sm font-bold text-[#701604] shadow-sm"><ArrowLeft className="h-4 w-4" /> {outletId ? 'Kembali ke daftar outlet' : 'Kembali ke dashboard'}</button>
      {loading ? <div className="grid gap-4 md:grid-cols-3"><div className="h-28 animate-pulse rounded-3xl bg-white" /><div className="h-28 animate-pulse rounded-3xl bg-white" /><div className="h-28 animate-pulse rounded-3xl bg-white" /></div> : error ? <div className="rounded-3xl border border-rose-200 bg-rose-50 p-8 text-center text-rose-700"><AlertCircle className="mx-auto mb-3" /><b>Gagal memuat laporan</b><p className="mt-1 text-sm">{error}</p></div> : <>
         {!outletId && <OutletCards data={visible} outlets={allOutlets} query={query} onQueryChange={setQuery} onOpen={(id) => router.push(`/dashboard/reports/${id}`)} />}
         {outletId && visible.length === 0 && <EmptyOutletState outletName={selectedOutletName} />}
         {outletId && visible.length > 0 && <>
        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><Metric icon={Store} label="Outlet" value={visible.length} /><Metric icon={Package} label="Total item" value={allItems.length} /><Metric icon={CheckCircle2} label="Lengkap" value={complete} green /><Metric icon={Camera} label="Dengan foto" value={allItems.filter((item) => item.photoPath).length} /></section>
        <section className="rounded-3xl border border-suka-brown/10 bg-white p-4 shadow-sm sm:p-5">
          <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_280px]">
            <label className="relative block"><span className="sr-only">Cari laporan inventaris</span><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-suka-ink/40" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Cari outlet, Area Manager, atau item..." className="w-full rounded-xl border border-suka-brown/15 bg-white py-3 pl-10 pr-3 text-sm outline-none transition focus:border-suka-orange focus:ring-2 focus:ring-orange-100" /></label>
            <OutletSwitcher data={allOutlets} onOpen={(id) => router.push(`/dashboard/reports/${id}`)} />
          </div>
          <div className="mt-4 flex flex-wrap gap-2"><span className="self-center pr-1 text-xs font-extrabold uppercase tracking-wide text-suka-ink/50">Status</span><FilterButton active={filter === 'all'} onClick={() => setFilter('all')}>Semua</FilterButton><FilterButton active={filter === 'incomplete'} onClick={() => setFilter('incomplete')}>Kurang</FilterButton><FilterButton active={filter === 'complete'} onClick={() => setFilter('complete')}>Lengkap</FilterButton></div>
        </section>
        <ReportTable submissions={visible} filter={filter} onPhoto={setPhoto} />
        </>}
      </>}
      </div>
    </div>
    {photo && <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4" onClick={() => setPhoto(null)}><div className="relative max-h-full max-w-3xl rounded-3xl bg-white p-2" onClick={(event) => event.stopPropagation()}><button type="button" className="absolute right-4 top-4 rounded-full bg-black/60 p-2 text-white" onClick={() => setPhoto(null)}><X className="h-5 w-5" /></button><img src={photo.url} alt={`Foto ${photo.name}`} className="max-h-[78vh] max-w-full rounded-2xl object-contain" /><p className="p-2 text-center text-sm font-bold">{photo.name}</p></div></div>}
  </main>
}

function OutletCards({ data, outlets, query, onQueryChange, onOpen }: { data: Submission[]; outlets: OutletOption[]; query: string; onQueryChange: (value: string) => void; onOpen: (id: string) => void }) {
  return <section className="space-y-4">
    <div className="rounded-3xl border border-suka-brown/10 bg-white p-4 shadow-sm sm:p-5"><div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_280px]"><label className="relative block"><span className="sr-only">Cari outlet</span><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-suka-ink/40" /><input value={query} onChange={(event) => onQueryChange(event.target.value)} placeholder="Cari outlet atau Area Manager..." className="w-full rounded-xl border border-suka-brown/15 bg-white py-3 pl-10 pr-3 text-sm outline-none transition focus:border-suka-orange focus:ring-2 focus:ring-orange-100" /></label><OutletSwitcher data={outlets} onOpen={onOpen} /></div></div>
    <div className="grid gap-4 sm:grid-cols-2">{data.map((submission) => { const recorded = submission.items.length > 0; return <button key={submission.outletId} type="button" onClick={() => onOpen(submission.outletId)} className="group rounded-3xl border border-orange-100 bg-white p-5 text-left shadow-sm transition hover:-translate-y-1 hover:border-suka-orange/50 hover:shadow-lg hover:shadow-orange-950/10 focus:outline-none focus:ring-2 focus:ring-suka-orange/40"><div className="flex items-start justify-between gap-4"><span className={`grid h-12 w-12 place-items-center rounded-2xl transition ${recorded ? 'bg-suka-cream text-suka-brown group-hover:bg-suka-brown group-hover:text-white' : 'bg-slate-100 text-slate-400 group-hover:bg-slate-700 group-hover:text-white'}`}>{recorded ? <ClipboardCheck className="h-6 w-6" /> : <ClipboardX className="h-6 w-6" />}</span><span className={`rounded-full px-3 py-1 text-xs font-bold ${recorded ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>{recorded ? `${submission.items.length} item` : 'Belum dicatat'}</span></div><h3 className="mt-5 text-lg font-extrabold text-suka-brown">{submission.outletName}</h3><p className={`mt-1 text-sm ${recorded ? 'text-suka-ink/60' : 'font-semibold text-slate-500'}`}>{recorded ? `Laporan terakhir oleh ${submission.submittedBy}` : 'Belum ada pencatatan inventaris'}</p><div className="mt-5 flex items-center justify-between border-t border-orange-100 pt-4 text-xs font-bold text-suka-orange"><span>{recorded ? 'Buka laporan inventori' : 'Mulai pencatatan'}</span><ArrowLeft className="h-4 w-4 rotate-180 transition group-hover:translate-x-1" /></div></button> })}{data.length === 0 && <div className="sm:col-span-2 rounded-3xl border border-dashed border-orange-200 bg-white p-12 text-center text-sm text-suka-ink/60">Outlet tidak ditemukan.</div>}</div>
  </section>
}

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

function Metric({ icon: Icon, label, value, green }: { icon: typeof Store; label: string; value: number; green?: boolean }) { return <div className="rounded-2xl border border-suka-brown/10 bg-white p-4 shadow-sm"><div className={`flex items-center gap-2 text-xs font-bold uppercase ${green ? 'text-emerald-700' : 'text-suka-orange'}`}><Icon className="h-4 w-4" />{label}</div><div className="mt-2 text-2xl font-extrabold">{value}</div></div> }

function ReportTable({ submissions, filter, onPhoto }: { submissions: Submission[]; filter: StatusFilter; onPhoto: (photo: { url: string; name: string }) => void }) {
  const rows = submissions.flatMap((submission) => submission.items.filter((item) => filter === 'all' || (filter === 'complete' ? available(item.status) : !available(item.status))).map((item) => ({ ...item, outletName: submission.outletName })))
  return <section className="overflow-hidden rounded-3xl border border-suka-brown/10 bg-white shadow-sm"><div className="flex items-center justify-between gap-3 border-b border-suka-brown/10 bg-suka-cream/60 px-5 py-4"><div><div className="flex items-center gap-2"><Table2 className="h-5 w-5 text-suka-orange" /><h2 className="font-extrabold text-suka-brown">Tabel laporan inventori</h2></div><p className="mt-1 text-xs text-suka-ink/60">{rows.length} data ditampilkan sesuai filter</p></div><span className="hidden rounded-full bg-white px-3 py-1 text-xs font-bold text-suka-brown sm:inline-flex">CRUD view</span></div><div className="overflow-x-auto"><table className="w-full min-w-[980px] text-left text-sm xl:min-w-0"><thead className="border-b border-suka-brown/10 bg-white text-xs uppercase tracking-wide text-suka-ink/55"><tr><th className="px-5 py-4 font-extrabold">Item inventori</th><th className="px-4 py-4 font-extrabold">Kategori</th><th className="px-4 py-4 font-extrabold">Status</th><th className="px-4 py-4 text-right font-extrabold">Jumlah</th><th className="px-4 py-4 font-extrabold">Tgl pembelian</th><th className="px-4 py-4 font-extrabold">Merek</th><th className="px-4 py-4 text-right font-extrabold">Harga</th><th className="px-4 py-4 text-right font-extrabold">Depresiasi</th><th className="px-4 py-4 text-center font-extrabold">Foto</th></tr></thead><tbody className="divide-y divide-suka-brown/10">{rows.map((item) => <tr key={item.id} className="transition hover:bg-suka-cream/35"><td className="px-5 py-4"><p className="font-bold text-suka-brown">{item.name}</p></td><td className="px-4 py-4 text-xs text-suka-ink/65">{item.category}</td><td className="px-4 py-4"><span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${available(item.status) ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>{item.status || 'Belum dicatat'}</span></td><td className="px-4 py-4 text-right font-mono text-xs font-bold">{item.quantity}{item.target ? ` / ${item.target}` : ''}</td><td className="px-4 py-4 whitespace-nowrap text-xs text-suka-ink/70">{formatPurchaseDate(item.purchaseDate)}</td><td className="px-4 py-4 text-xs font-semibold text-suka-ink/75">{item.brand || '-'}</td><td className="px-4 py-4 text-right whitespace-nowrap text-xs font-semibold text-suka-ink/75">{formatMoney(item.price)}</td><td className="px-4 py-4 text-right whitespace-nowrap text-xs font-semibold text-suka-ink/75">{item.depreciation === null ? '-' : `${item.depreciation}% / tahun`}</td><td className="px-4 py-4 text-center">{item.photoPath ? <button type="button" onClick={() => { const url = photoUrl(item.photoPath); if (url) onPhoto({ url, name: item.name }) }} className="inline-flex rounded-lg border border-suka-brown/10 p-1 transition hover:border-suka-orange"><img src={photoUrl(item.photoPath) ?? ''} alt={`Foto ${item.name}`} className="h-10 w-10 rounded-md object-cover" /></button> : <ImageOff className="mx-auto h-4 w-4 text-suka-ink/30" />}</td></tr>)}{rows.length === 0 && <tr><td colSpan={9} className="px-5 py-12 text-center text-sm text-suka-ink/55">Belum ada data laporan sesuai filter.</td></tr>}</tbody></table></div></section>
}
function FilterButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) { return <button type="button" onClick={onClick} className={`whitespace-nowrap rounded-xl px-4 py-2 text-sm font-bold transition ${active ? 'bg-suka-brown text-white' : 'bg-suka-cream text-suka-ink/70 hover:bg-suka-orange/15'}`}>{children}</button> }
