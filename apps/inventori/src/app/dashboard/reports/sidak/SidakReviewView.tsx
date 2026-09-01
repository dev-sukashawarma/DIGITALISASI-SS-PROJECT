'use client'

import { useEffect, useMemo, useState } from 'react'
import { AlertCircle, Check, ChevronDown, ClipboardCheck, ClipboardX, Loader2, Search, ShieldCheck, Store } from 'lucide-react'
import { AdminInventoryNavigation } from '@/components/AdminInventoryNavigation'
import { createClient } from '@/lib/supabase'

type Raw = Record<string, unknown>
type Review = { id: string; outletName: string; region: string; reviewerName: string; completedAt: string | null; note: string | null; items: Array<{ id: string; name: string; status: 'ok' | 'issue'; note: string | null }> }
const value = (input: unknown, fallback = '') => typeof input === 'string' || typeof input === 'number' ? String(input) : fallback

export default function SidakReviewView() {
  const [reviews, setReviews] = useState<Review[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [openReview, setOpenReview] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    const load = async () => {
      const db = createClient()
      const [reviewsResult, reviewItemsResult, submissionsResult, itemsResult, mastersResult, outletsResult, staffResult] = await Promise.all([
        db.from('inventaris_sidak_reviews').select('id,submission_id,reviewer_id,note,completed_at,status').eq('status', 'final').order('completed_at', { ascending: false }).limit(500),
        db.from('inventaris_sidak_review_items').select('review_id,submission_item_id,status,note').limit(30000),
        db.from('inventaris_submissions').select('id,outlet_id').limit(1000),
        db.from('inventaris_submission_items').select('id,submission_id,master_item_id').limit(30000),
        db.from('inventaris_master_items').select('id,name').limit(3000),
        db.from('outlets').select('id,name,region').limit(300),
        db.from('outlet_staff').select('id,name').limit(2000),
      ])
      const failure = reviewsResult.error || reviewItemsResult.error || submissionsResult.error || itemsResult.error || mastersResult.error || outletsResult.error || staffResult.error
      if (failure) { if (active) { setError(failure.message); setLoading(false) }; return }
      const submissions = new Map((submissionsResult.data ?? []).map((item: Raw) => [value(item.id), item]))
      const sourceItems = new Map((itemsResult.data ?? []).map((item: Raw) => [value(item.id), item]))
      const masters = new Map((mastersResult.data ?? []).map((item: Raw) => [value(item.id), value(item.name, 'Item inventaris')]))
      const outlets = new Map((outletsResult.data ?? []).map((item: Raw) => [value(item.id), item]))
      const staff = new Map((staffResult.data ?? []).map((item: Raw) => [value(item.id), value(item.name, 'Manager')]))
      const itemsByReview = new Map<string, Raw[]>()
      for (const item of reviewItemsResult.data ?? []) { const row = item as Raw; const id = value(row.review_id); itemsByReview.set(id, [...(itemsByReview.get(id) ?? []), row]) }
      const mapped = (reviewsResult.data ?? []).map((row: Raw): Review => {
        const submission = submissions.get(value(row.submission_id)) ?? {}
        const outlet = outlets.get(value((submission as Raw).outlet_id)) ?? {}
        return { id: value(row.id), outletName: value((outlet as Raw).name, 'Outlet'), region: value((outlet as Raw).region, 'Tanpa region'), reviewerName: staff.get(value(row.reviewer_id)) ?? 'Manager', completedAt: value(row.completed_at) || null, note: value(row.note) || null, items: (itemsByReview.get(value(row.id)) ?? []).map((item) => { const source = sourceItems.get(value(item.submission_item_id)) ?? {}; return { id: value(item.submission_item_id), name: masters.get(value((source as Raw).master_item_id)) ?? 'Item inventaris', status: value(item.status) === 'issue' ? 'issue' : 'ok', note: value(item.note) || null } }) }
      })
      if (active) { setReviews(mapped); setLoading(false) }
    }
    void load()
    return () => { active = false }
  }, [])

  const visible = useMemo(() => reviews.filter((review) => `${review.outletName} ${review.region} ${review.reviewerName} ${review.note ?? ''}`.toLowerCase().includes(query.toLowerCase())), [reviews, query])
  const findings = reviews.reduce((sum, review) => sum + review.items.filter((item) => item.status === 'issue').length, 0)
  return <main className="min-h-screen bg-[#fffaf5] pb-24 text-suka-ink lg:pb-12"><div className="mx-auto grid w-full max-w-[1500px] gap-5 px-4 py-5 lg:grid-cols-[260px_minmax(0,1fr)] lg:px-8"><AdminInventoryNavigation active="sidak" /><div className="min-w-0 space-y-5"><section className="relative overflow-hidden rounded-[2rem] bg-[#701604] p-6 text-white shadow-lg sm:p-8"><div className="absolute -right-12 -top-20 h-56 w-56 rounded-full border border-white/10" /><div className="relative"><div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-orange-200"><ShieldCheck size={15} /> Admin Inventori</div><h1 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">Hasil sidak lapangan</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-orange-100">Tinjau keputusan Regional dan Area Manager atas laporan inventaris outlet.</p></div></section><section className="grid gap-3 sm:grid-cols-3"><Metric icon={ClipboardCheck} label="Sidak selesai" value={reviews.length} /><Metric icon={ClipboardX} label="Total temuan" value={findings} warning /><Metric icon={Store} label="Outlet diperiksa" value={new Set(reviews.map((item) => item.outletName)).size} /></section><label className="relative block"><span className="sr-only">Cari hasil sidak</span><Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Cari outlet atau nama manager..." className="w-full rounded-2xl border border-orange-100 bg-white py-3.5 pl-11 pr-4 text-sm font-semibold outline-none transition focus:border-orange-400 focus:ring-4 focus:ring-orange-100" /></label>{loading ? <div className="grid min-h-64 place-items-center rounded-3xl border border-orange-100 bg-white"><Loader2 className="animate-spin text-[#f29744]" /></div> : error ? <div className="rounded-3xl border border-rose-200 bg-rose-50 p-8 text-center text-rose-700"><AlertCircle className="mx-auto mb-3" /><b>Hasil sidak belum dapat dimuat</b><p className="mt-1 text-sm">{error}</p></div> : <section className="space-y-3">{visible.map((review) => <ReviewCard key={review.id} review={review} open={openReview === review.id} onToggle={() => setOpenReview((current) => current === review.id ? null : review.id)} />)}{visible.length === 0 && <div className="rounded-3xl border border-dashed border-orange-200 bg-white px-6 py-16 text-center"><ShieldCheck className="mx-auto text-orange-300" size={34} /><h2 className="mt-4 text-lg font-black text-[#701604]">Belum ada hasil sidak</h2><p className="mt-2 text-sm text-slate-500">Hasil akan muncul otomatis setelah Manager menyelesaikan checklist.</p></div>}</section>}</div></div></main>
}

function ReviewCard({ review, open, onToggle }: { review: Review; open: boolean; onToggle: () => void }) { const issues = review.items.filter((item) => item.status === 'issue').length; return <article className="overflow-hidden rounded-3xl border border-orange-100 bg-white shadow-sm"><button type="button" onClick={onToggle} aria-expanded={open} className="flex w-full items-center gap-4 p-5 text-left transition hover:bg-orange-50/50"><span className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl ${issues ? 'bg-rose-100 text-rose-600' : 'bg-emerald-100 text-emerald-700'}`}>{issues ? <ClipboardX size={22} /> : <Check size={23} />}</span><span className="min-w-0 flex-1"><span className="flex flex-wrap items-center gap-2"><span className="text-base font-black text-[#701604]">{review.outletName}</span><span className="rounded-full bg-orange-50 px-2 py-0.5 text-[10px] font-black text-orange-700">{review.region}</span></span><span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-semibold text-slate-500"><span>{review.reviewerName}</span><span>{review.completedAt ? new Date(review.completedAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '-'}</span></span></span><span className="hidden text-right sm:block"><span className={`block text-sm font-black ${issues ? 'text-rose-600' : 'text-emerald-700'}`}>{issues ? `${issues} temuan` : 'Sesuai'}</span><span className="mt-1 block text-[10px] font-bold text-slate-400">{review.items.length} item diperiksa</span></span><ChevronDown className={`shrink-0 text-slate-400 transition ${open ? 'rotate-180' : ''}`} /></button>{open && <div className="border-t border-orange-100 bg-orange-50/30 p-5"><div className="mb-4 grid grid-cols-2 gap-3 sm:hidden"><div className="rounded-xl bg-white p-3 text-center text-xs font-black text-slate-600">{review.items.length} item</div><div className={`rounded-xl bg-white p-3 text-center text-xs font-black ${issues ? 'text-rose-600' : 'text-emerald-700'}`}>{issues ? `${issues} temuan` : 'Semua sesuai'}</div></div>{review.note && <p className="mb-4 rounded-2xl border border-orange-100 bg-white px-4 py-3 text-sm leading-6 text-slate-600"><b className="text-[#701604]">Catatan Manager:</b> {review.note}</p>}<div className="grid gap-2 sm:grid-cols-2">{review.items.map((item) => <div key={item.id} className={`rounded-2xl border px-4 py-3 ${item.status === 'issue' ? 'border-rose-200 bg-rose-50' : 'border-emerald-100 bg-white'}`}><div className="flex items-center justify-between gap-3"><p className="text-sm font-extrabold text-[#701604]">{item.name}</p><span className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-black ${item.status === 'issue' ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'}`}>{item.status === 'issue' ? 'Temuan' : 'Sesuai'}</span></div>{item.note && <p className="mt-1 text-xs leading-5 text-slate-500">{item.note}</p>}</div>)}</div></div>}</article> }
function Metric({ icon: Icon, label, value, warning }: { icon: typeof Store; label: string; value: number; warning?: boolean }) { return <div className="rounded-2xl border border-orange-100 bg-white p-4 shadow-sm"><div className={`flex items-center gap-2 text-xs font-black uppercase tracking-wide ${warning ? 'text-rose-600' : 'text-orange-600'}`}><Icon size={15} />{label}</div><p className="mt-2 text-2xl font-black text-[#701604]">{value}</p></div> }
