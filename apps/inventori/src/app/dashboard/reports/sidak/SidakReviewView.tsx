'use client'

import { useEffect, useMemo, useState } from 'react'
import { AlertCircle, CalendarDays, Check, ChevronDown, ClipboardCheck, ClipboardX, ListChecks, Loader2, MapPin, Search, ShieldCheck, Store, UserRound } from 'lucide-react'
import { AdminInventoryNavigation } from '@/components/AdminInventoryNavigation'
import { createClient } from '@/lib/supabase'

type Raw = Record<string, unknown>
type Review = {
  id: string
  outletName: string
  region: string
  reviewerName: string
  completedAt: string | null
  note: string | null
  items: Array<{ id: string; name: string; status: 'ok' | 'issue'; note: string | null }>
}

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
      if (failure) {
        if (active) {
          setError(failure.message)
          setLoading(false)
        }
        return
      }
      const submissions = new Map((submissionsResult.data ?? []).map((item: Raw) => [value(item.id), item]))
      const sourceItems = new Map((itemsResult.data ?? []).map((item: Raw) => [value(item.id), item]))
      const masters = new Map((mastersResult.data ?? []).map((item: Raw) => [value(item.id), value(item.name, 'Item inventaris')]))
      const outlets = new Map((outletsResult.data ?? []).map((item: Raw) => [value(item.id), item]))
      const staff = new Map((staffResult.data ?? []).map((item: Raw) => [value(item.id), value(item.name, 'Manager')]))
      const itemsByReview = new Map<string, Raw[]>()
      for (const item of reviewItemsResult.data ?? []) {
        const row = item as Raw
        const id = value(row.review_id)
        itemsByReview.set(id, [...(itemsByReview.get(id) ?? []), row])
      }
      const mapped = (reviewsResult.data ?? []).map((row: Raw): Review => {
        const submission = submissions.get(value(row.submission_id)) ?? {}
        const outlet = outlets.get(value((submission as Raw).outlet_id)) ?? {}
        return {
          id: value(row.id),
          outletName: value((outlet as Raw).name, 'Outlet'),
          region: value((outlet as Raw).region, 'Tanpa region'),
          reviewerName: staff.get(value(row.reviewer_id)) ?? 'Manager',
          completedAt: value(row.completed_at) || null,
          note: value(row.note) || null,
          items: (itemsByReview.get(value(row.id)) ?? []).map((item) => {
            const source = sourceItems.get(value(item.submission_item_id)) ?? {}
            return {
              id: value(item.submission_item_id),
              name: masters.get(value((source as Raw).master_item_id)) ?? 'Item inventaris',
              status: value(item.status) === 'issue' ? 'issue' : 'ok',
              note: value(item.note) || null,
            }
          }),
        }
      })
      if (active) {
        setReviews(mapped)
        setLoading(false)
      }
    }
    void load()
    return () => { active = false }
  }, [])

  const visible = useMemo(
    () => reviews.filter((review) => `${review.outletName} ${review.region} ${review.reviewerName} ${review.note ?? ''}`.toLowerCase().includes(query.toLowerCase())),
    [reviews, query],
  )
  const findings = reviews.reduce((sum, review) => sum + review.items.filter((item) => item.status === 'issue').length, 0)
  const outletCount = new Set(reviews.map((item) => item.outletName)).size

  return (
    <main className="min-h-screen bg-[#4A1713] pb-24 text-suka-ink lg:pb-0">
      <div className="flex min-h-screen flex-col lg:flex-row">
        <AdminInventoryNavigation active="sidak" />
        <div className="min-w-0 flex-1 bg-[#fffaf5] lg:rounded-l-[2.5rem]">
          <div className="mx-auto w-full max-w-[1500px] space-y-5 px-4 py-5 sm:px-8 sm:py-7">
            <section className="relative overflow-hidden rounded-[2rem] bg-[#701604] p-6 text-white shadow-xl shadow-[#701604]/15 sm:p-8">
              <div className="absolute -right-12 -top-20 h-56 w-56 rounded-full border border-white/10" />
              <div className="absolute -bottom-24 right-32 h-44 w-44 rounded-full bg-[#f29744]/10" />
              <div className="relative">
                <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-orange-200"><ShieldCheck size={15} /> Admin Inventori</div>
                <h1 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">Hasil sidak lapangan</h1>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-orange-100">Tinjau keputusan Regional dan Area Manager atas laporan inventaris outlet.</p>
              </div>
            </section>

            <section className="grid gap-3 sm:grid-cols-3">
              <Metric icon={ClipboardCheck} label="Sidak selesai" value={reviews.length} tone="maroon" />
              <Metric icon={ClipboardX} label="Total temuan" value={findings} tone="orange" />
              <Metric icon={Store} label="Outlet diperiksa" value={outletCount} tone="green" />
            </section>

            <section className="rounded-[1.6rem] bg-[#f5d6a0] p-4 shadow-lg shadow-orange-950/5 sm:p-5">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div><p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#701604]/60">Pencarian hasil</p><h2 className="mt-1 font-black text-[#400a07]">Temukan sidak outlet</h2></div>
                <span className="rounded-full bg-[#701604] px-3 py-1 text-xs font-black text-white">{visible.length} laporan</span>
              </div>
              <label className="relative block">
                <span className="sr-only">Cari hasil sidak</span>
                <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#701604]/50" />
                <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Cari outlet, region, atau nama manager..." className="w-full rounded-2xl border border-[#701604]/15 bg-white/80 py-3.5 pl-11 pr-4 text-sm font-semibold text-[#400a07] outline-none transition placeholder:text-[#701604]/40 focus:border-[#701604] focus:bg-white focus:ring-4 focus:ring-white/50" />
              </label>
            </section>

            {loading ? (
              <div className="grid min-h-64 place-items-center rounded-[1.75rem] bg-[#283c35] text-[#f7c58b] shadow-lg"><Loader2 className="animate-spin" /></div>
            ) : error ? (
              <div className="rounded-[1.75rem] border border-rose-200 bg-rose-50 p-8 text-center text-rose-700"><AlertCircle className="mx-auto mb-3" /><b>Hasil sidak belum dapat dimuat</b><p className="mt-1 text-sm">{error}</p></div>
            ) : (
              <section className="grid gap-4 xl:grid-cols-2">
                {visible.map((review) => <ReviewCard key={review.id} review={review} open={openReview === review.id} onToggle={() => setOpenReview((current) => current === review.id ? null : review.id)} />)}
                {visible.length === 0 && <EmptyState />}
              </section>
            )}
          </div>
        </div>
      </div>
    </main>
  )
}

const metricTones = {
  maroon: 'bg-[#701604] text-white',
  orange: 'bg-[#f29744] text-[#400a07]',
  green: 'bg-[#283c35] text-white',
}

function Metric({ icon: Icon, label, value, tone }: { icon: typeof Store; label: string; value: number; tone: keyof typeof metricTones }) {
  return <div className={`relative overflow-hidden rounded-[1.4rem] p-4 shadow-lg ${metricTones[tone]}`}><span className="pointer-events-none absolute -right-5 -top-8 h-20 w-20 rounded-full border border-white/15" /><div className="relative flex items-center justify-between"><div><p className="text-[10px] font-black uppercase tracking-[0.16em] opacity-70">{label}</p><p className="mt-2 text-3xl font-black tracking-tight">{value}</p></div><span className="grid h-11 w-11 place-items-center rounded-2xl bg-white/15"><Icon size={20} /></span></div></div>
}

function ReviewCard({ review, open, onToggle }: { review: Review; open: boolean; onToggle: () => void }) {
  const issues = review.items.filter((item) => item.status === 'issue').length
  const tone = issues ? 'border-[#701604] bg-[#701604] text-white' : 'border-[#283c35] bg-[#283c35] text-white'
  return (
    <article className={`self-start overflow-hidden rounded-[1.75rem] border shadow-lg transition duration-300 hover:-translate-y-1 hover:shadow-2xl ${tone}`}>
      <button type="button" onClick={onToggle} aria-expanded={open} className="relative flex w-full items-center gap-4 overflow-hidden p-5 text-left outline-none focus:ring-4 focus:ring-inset focus:ring-orange-200">
        <span className="pointer-events-none absolute -right-8 -top-12 h-28 w-28 rounded-full border border-white/10" />
        <span className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl ${issues ? 'bg-[#f29744] text-[#400a07]' : 'bg-[#f7c58b] text-[#283c35]'}`}>{issues ? <ClipboardX size={22} /> : <Check size={23} />}</span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2"><span className="text-base font-black">{review.outletName}</span><span className="rounded-full bg-white/15 px-2.5 py-1 text-[10px] font-black">{review.region}</span></span>
          <span className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-semibold text-white/65"><span className="inline-flex items-center gap-1"><UserRound size={12} /> {review.reviewerName}</span><span className="inline-flex items-center gap-1"><CalendarDays size={12} /> {review.completedAt ? new Date(review.completedAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '-'}</span></span>
        </span>
        <span className="hidden text-right sm:block"><span className={`block text-sm font-black ${issues ? 'text-orange-200' : 'text-emerald-200'}`}>{issues ? `${issues} temuan` : 'Semua sesuai'}</span><span className="mt-1 block text-[10px] font-bold text-white/50">{review.items.length} item diperiksa</span></span>
        <ChevronDown className={`shrink-0 text-white/60 transition duration-300 ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && <div className="border-t border-white/15 bg-black/10 p-5"><div className="mb-4 grid grid-cols-2 gap-3 sm:hidden"><div className="rounded-xl bg-white/10 p-3 text-center text-xs font-black">{review.items.length} item</div><div className={`rounded-xl p-3 text-center text-xs font-black ${issues ? 'bg-[#f29744] text-[#400a07]' : 'bg-emerald-100 text-emerald-800'}`}>{issues ? `${issues} temuan` : 'Semua sesuai'}</div></div>{review.note && <p className="mb-4 rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-sm leading-6 text-white/80"><b className="text-orange-200">Catatan Manager:</b> {review.note}</p>}<div className="grid gap-2 sm:grid-cols-2">{review.items.map((item) => <div key={item.id} className={`rounded-2xl border px-4 py-3 ${item.status === 'issue' ? 'border-orange-300/50 bg-[#f29744] text-[#400a07]' : 'border-white/15 bg-white/10 text-white'}`}><div className="flex items-start justify-between gap-3"><p className="text-sm font-extrabold leading-5">{item.name}</p><span className={`shrink-0 rounded-full px-2 py-1 text-[9px] font-black uppercase ${item.status === 'issue' ? 'bg-[#701604] text-white' : 'bg-emerald-100 text-emerald-800'}`}>{item.status === 'issue' ? 'Temuan' : 'Sesuai'}</span></div>{item.note && <p className={`mt-2 text-xs leading-5 ${item.status === 'issue' ? 'text-[#4A1713]/75' : 'text-white/60'}`}>{item.note}</p>}</div>)}</div></div>}
    </article>
  )
}

function EmptyState() {
  return <div className="rounded-[1.75rem] bg-[#a65e44] px-6 py-16 text-center text-white shadow-lg xl:col-span-2"><span className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-white/15"><ListChecks size={30} /></span><h2 className="mt-4 text-lg font-black">Belum ada hasil sidak</h2><p className="mx-auto mt-2 max-w-md text-sm text-white/70">Hasil akan muncul otomatis setelah Manager menyelesaikan checklist.</p><div className="mx-auto mt-5 flex w-fit items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-xs font-bold"><MapPin size={13} /> Menunggu laporan outlet</div></div>
}
