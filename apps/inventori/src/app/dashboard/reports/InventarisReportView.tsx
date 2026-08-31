'use client'

import { useEffect, useMemo, useState } from 'react'
import { AlertCircle, ArrowLeft, Camera, CheckCircle2, ChevronDown, ClipboardList, Clock3, ImageOff, Package, Search, Store, X, ZoomIn } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'

type Raw = Record<string, any>
type StatusFilter = 'all' | 'incomplete' | 'complete'
type Item = { id: string; name: string; category: string; status: string; quantity: string; target: string; notes: string | null; purchaseDate: string | null; price: number | null; depreciation: number | null; brand: string | null; photoPath: string | null }
type Submission = { id: string; outletId: string; outletName: string; submittedBy: string; submittedAt: string | null; notes: string | null; items: Item[] }

const text = (value: unknown, fallback = '') => typeof value === 'string' || typeof value === 'number' ? String(value) : fallback
const number = (value: unknown) => value === null || value === undefined || value === '' || !Number.isFinite(Number(value)) ? null : Number(value)
const available = (status: string) => ['sesuai', 'baik', 'ada', 'available', 'lengkap', 'ok'].includes(status.trim().toLowerCase().replace(/[_-]/g, ' '))
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
const formatDate = (value: string | null) => value ? new Date(value).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' }) : '-'
const formatMoney = (value: number | null) => value === null ? null : new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(value)

export default function InventarisReportView() {
  const router = useRouter()
  const [data, setData] = useState<Submission[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [outlet, setOutlet] = useState('all')
  const [filter, setFilter] = useState<StatusFilter>('all')
  const [open, setOpen] = useState<Set<string>>(new Set())
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
      if (alive) { setData([...latest.values()]); setLoading(false) }
    }
    void load(); return () => { alive = false }
  }, [])

  const visible = useMemo(() => data.filter((submission) => (outlet === 'all' || submission.outletId === outlet) && (!query.trim() || `${submission.outletName} ${submission.submittedBy}`.toLowerCase().includes(query.toLowerCase()))), [data, outlet, query])
  const allItems = visible.flatMap((submission) => submission.items)
  const complete = allItems.filter((item) => available(item.status)).length
  const toggle = (id: string) => setOpen((current) => { const next = new Set(current); next.has(id) ? next.delete(id) : next.add(id); return next })

  return <main className="min-h-screen bg-[#fffaf5] px-4 py-6 text-suka-ink sm:px-6 lg:px-10">
    <div className="mx-auto max-w-7xl space-y-5">
      <button type="button" onClick={() => router.push('/dashboard')} className="inline-flex items-center gap-2 rounded-xl border border-suka-orange/30 bg-white px-4 py-2 text-sm font-bold text-suka-brown shadow-sm transition hover:bg-suka-cream"><ArrowLeft className="h-4 w-4" /> Kembali ke dashboard</button>
      <header className="rounded-3xl bg-suka-brown px-6 py-7 text-white shadow-lg sm:px-8"><div className="flex items-center gap-3"><ClipboardList className="h-7 w-7 text-suka-orange" /><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-suka-orange">Admin area</p><h1 className="text-2xl font-extrabold sm:text-3xl">Laporan Inventaris Outlet</h1></div></div><p className="mt-3 max-w-2xl text-sm text-white/80">Laporan aset terbaru tiap outlet, termasuk foto bukti dan data pembelian.</p></header>
      {loading ? <div className="grid gap-4 md:grid-cols-3"><div className="h-28 animate-pulse rounded-3xl bg-white" /><div className="h-28 animate-pulse rounded-3xl bg-white" /><div className="h-28 animate-pulse rounded-3xl bg-white" /></div> : error ? <div className="rounded-3xl border border-rose-200 bg-rose-50 p-8 text-center text-rose-700"><AlertCircle className="mx-auto mb-3" /><b>Gagal memuat laporan</b><p className="mt-1 text-sm">{error}</p></div> : <>
        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><Metric icon={Store} label="Outlet" value={visible.length} /><Metric icon={Package} label="Total item" value={allItems.length} /><Metric icon={CheckCircle2} label="Lengkap" value={complete} green /><Metric icon={Camera} label="Dengan foto" value={allItems.filter((item) => item.photoPath).length} /></section>
        <section className="rounded-3xl border border-suka-brown/10 bg-white p-4 shadow-sm"><div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-suka-ink/40" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Cari outlet atau Area Manager..." className="w-full rounded-xl border border-suka-brown/15 py-3 pl-10 pr-3 text-sm outline-none focus:border-suka-orange" /></div><div className="mt-3 flex gap-2 overflow-x-auto pb-1"><FilterButton active={outlet === 'all'} onClick={() => setOutlet('all')}>Semua outlet</FilterButton>{data.map((item) => <FilterButton key={item.outletId} active={outlet === item.outletId} onClick={() => setOutlet(item.outletId)}>{item.outletName}</FilterButton>)}</div><div className="mt-3 flex gap-2"><FilterButton active={filter === 'all'} onClick={() => setFilter('all')}>Semua</FilterButton><FilterButton active={filter === 'incomplete'} onClick={() => setFilter('incomplete')}>Kurang</FilterButton><FilterButton active={filter === 'complete'} onClick={() => setFilter('complete')}>Lengkap</FilterButton></div></section>
        <section className="space-y-4">{visible.map((submission) => <SubmissionCard key={submission.id} submission={submission} open={open.has(submission.id)} filter={filter} onToggle={() => toggle(submission.id)} onPhoto={setPhoto} />)}{visible.length === 0 && <div className="rounded-3xl border border-dashed border-suka-brown/20 bg-white p-12 text-center text-sm text-suka-ink/60">Belum ada laporan yang sesuai.</div>}</section>
      </>}
    </div>
    {photo && <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4" onClick={() => setPhoto(null)}><div className="relative max-h-full max-w-3xl rounded-3xl bg-white p-2" onClick={(event) => event.stopPropagation()}><button type="button" className="absolute right-4 top-4 rounded-full bg-black/60 p-2 text-white" onClick={() => setPhoto(null)}><X className="h-5 w-5" /></button><img src={photo.url} alt={`Foto ${photo.name}`} className="max-h-[78vh] max-w-full rounded-2xl object-contain" /><p className="p-2 text-center text-sm font-bold">{photo.name}</p></div></div>}
  </main>
}

function Metric({ icon: Icon, label, value, green }: { icon: typeof Store; label: string; value: number; green?: boolean }) { return <div className="rounded-2xl border border-suka-brown/10 bg-white p-4 shadow-sm"><div className={`flex items-center gap-2 text-xs font-bold uppercase ${green ? 'text-emerald-700' : 'text-suka-orange'}`}><Icon className="h-4 w-4" />{label}</div><div className="mt-2 text-2xl font-extrabold">{value}</div></div> }
function FilterButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) { return <button type="button" onClick={onClick} className={`whitespace-nowrap rounded-xl px-4 py-2 text-sm font-bold transition ${active ? 'bg-suka-brown text-white' : 'bg-suka-cream text-suka-ink/70 hover:bg-suka-orange/15'}`}>{children}</button> }
function SubmissionCard({ submission, open, filter, onToggle, onPhoto }: { submission: Submission; open: boolean; filter: StatusFilter; onToggle: () => void; onPhoto: (photo: { url: string; name: string }) => void }) {
  const items = submission.items.filter((item) => filter === 'all' || (filter === 'complete' ? available(item.status) : !available(item.status)))
  const full = submission.items.filter((item) => available(item.status)).length
  return <article className="overflow-visible rounded-3xl border border-suka-brown/10 bg-white shadow-sm"><button type="button" onClick={onToggle} className="sticky top-0 z-10 flex w-full flex-wrap items-center justify-between gap-4 rounded-t-3xl border-b border-suka-brown/10 bg-[#fffaf5]/95 px-5 py-4 text-left backdrop-blur"><div><h2 className="font-extrabold text-suka-brown">{submission.outletName}</h2><div className="mt-1 flex flex-wrap gap-x-3 text-xs text-suka-ink/60"><span>{submission.items.length} item</span><span className="font-bold text-emerald-700">{full} lengkap</span><span><Clock3 className="mr-1 inline h-3.5 w-3.5" />{formatDate(submission.submittedAt)}</span></div></div><div className="flex items-center gap-3 text-right text-xs"><span><span className="text-suka-ink/50">Dikirim oleh</span><br /><b>{submission.submittedBy}</b></span><ChevronDown className={`h-5 w-5 transition ${open ? 'rotate-180' : ''}`} /></div></button>{submission.notes && <p className="border-b border-suka-brown/10 px-5 py-3 text-sm"><b>Catatan pemeriksaan:</b> {submission.notes}</p>}{open && <div className="divide-y divide-suka-brown/10">{items.map((item) => <div key={item.id} className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center"><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h3 className="font-bold">{item.name}</h3><span className={`rounded-md px-2 py-1 text-xs font-bold ${available(item.status) ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>{item.status || 'Belum dicatat'}</span></div><p className="mt-1 text-xs uppercase tracking-wide text-suka-ink/45">{item.category}</p><p className="mt-2 text-sm">Jumlah: <b>{item.quantity}{item.target ? ` / ${item.target}` : ''}</b></p>{item.notes && <p className="mt-2 rounded-lg bg-suka-cream px-3 py-2 text-sm"><b>Catatan:</b> {item.notes}</p>}{(item.purchaseDate || item.brand || item.price !== null || item.depreciation !== null) && <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-suka-ink/70">{item.purchaseDate && <span><b>Dibeli:</b> {item.purchaseDate}</span>}{item.brand && <span><b>Merek:</b> {item.brand}</span>}{item.price !== null && <span><b>Harga:</b> {formatMoney(item.price)}</span>}{item.depreciation !== null && <span><b>Depresiasi:</b> {item.depreciation}%/tahun</span>}</div>}</div>{item.photoPath ? <button type="button" onClick={() => { const url = photoUrl(item.photoPath); if (url) onPhoto({ url, name: item.name }) }} className="group relative h-20 w-20 shrink-0 overflow-hidden rounded-xl border border-suka-brown/10"><img src={photoUrl(item.photoPath) ?? ''} alt={`Foto ${item.name}`} className="h-full w-full object-cover" /><span className="absolute inset-0 grid place-items-center bg-black/0 text-white opacity-0 transition group-hover:bg-black/30 group-hover:opacity-100"><ZoomIn className="h-5 w-5" /></span></button> : <span className="inline-flex items-center gap-1 text-xs text-suka-ink/40"><ImageOff className="h-4 w-4" />Tidak ada foto</span>}</div>)}{items.length === 0 && <p className="p-8 text-center text-sm text-suka-ink/50">Tidak ada item pada filter ini.</p>}</div>}</article>
}
