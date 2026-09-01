'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { AlertTriangle, Camera, Check, CheckCircle2, ChevronRight, ClipboardCheck, FileCheck2, ImageOff, Loader2, MapPin, PartyPopper, Search, ShieldCheck, Store, X } from 'lucide-react'
import { toast } from 'sonner'
import type { SidakOutlet, SidakReview, SidakSubmission } from '@/lib/inventaris-sidak-server'
import { loadSidakDraft, removeSidakDraft, saveSidakDraft } from '@/lib/inventaris-sidak-draft-store'

type CheckStatus = 'ok' | 'issue'
type Props = { initialData: { outlets: SidakOutlet[]; submissions: SidakSubmission[]; reviews: SidakReview[] }; staffId: string; staffName: string; role: string }
type PhotoPreview = { path: string; itemName: string; outletName: string }

const sectionLabels: Record<string, string> = { interior: 'Interior', exterior: 'Exterior', kamar_mandi: 'Kamar mandi', utilitas: 'Utilitas' }
const conditionLabels: Record<string, string> = { baik: 'Baik', perlu_perbaikan: 'Perlu perbaikan', rusak: 'Rusak', tidak_ada: 'Tidak ada' }
const findReview = (reviews: SidakReview[], submission?: SidakSubmission) => reviews.find((candidate) => candidate.items.some((item) => submission?.items.some((source) => source.id === item.submission_item_id)))
const checksFromReview = (review?: SidakReview) => Object.fromEntries((review?.items ?? []).filter((item) => item.status !== 'not_checked').map((item) => [item.submission_item_id, item.status])) as Record<string, CheckStatus | undefined>
const finalSubmissionIds = (reviews: SidakReview[], submissions: SidakSubmission[]) => new Set(submissions.filter((submission) => findReview(reviews, submission)?.status === 'final').map((submission) => submission.id))

export default function InventarisSidakClient({ initialData, staffId, staffName, role }: Props) {
  const [selectedOutletId, setSelectedOutletId] = useState(initialData.outlets[0]?.id ?? '')
  const [query, setQuery] = useState('')
  const [section, setSection] = useState('all')
  const firstSubmission = initialData.submissions.find((submission) => submission.outlet_id === (initialData.outlets[0]?.id ?? ''))
  const firstReview = findReview(initialData.reviews, firstSubmission)
  const [checks, setChecks] = useState<Record<string, CheckStatus | undefined>>(() => checksFromReview(firstReview))
  const [note, setNote] = useState(firstReview?.note ?? '')
  const [saving, setSaving] = useState(false)
  const [draftStatus, setDraftStatus] = useState<'idle' | 'saving' | 'saved'>('idle')
  const [photoPreview, setPhotoPreview] = useState<PhotoPreview | null>(null)
  const [completedSubmissionIds, setCompletedSubmissionIds] = useState(() => finalSubmissionIds(initialData.reviews, initialData.submissions))
  const draftReadyRef = useRef(false)

  const submissionByOutlet = useMemo(() => new Map(initialData.submissions.map((submission) => [submission.outlet_id, submission])), [initialData.submissions])
  const selectedSubmission = submissionByOutlet.get(selectedOutletId)
  const visibleOutlets = initialData.outlets.filter((outlet) => `${outlet.name} ${outlet.region ?? ''}`.toLowerCase().includes(query.toLowerCase()))
  const availableSections = useMemo(() => [...new Set((selectedSubmission?.items ?? []).map((item) => item.section))], [selectedSubmission])
  const visibleItems = (selectedSubmission?.items ?? []).filter((item) => section === 'all' || item.section === section)
  const checkedCount = selectedSubmission?.items.filter((item) => checks[item.id]).length ?? 0
  const issueCount = selectedSubmission?.items.filter((item) => checks[item.id] === 'issue').length ?? 0
  const progress = selectedSubmission ? Math.round((checkedCount / selectedSubmission.items.length) * 100) : 0
  const isSubmissionComplete = Boolean(selectedSubmission && completedSubmissionIds.has(selectedSubmission.id))

  useEffect(() => {
    let cancelled = false
    draftReadyRef.current = false
    if (!selectedSubmission) return
    const review = findReview(initialData.reviews, selectedSubmission)
    const restore = async () => {
      const draft = await loadSidakDraft(staffId, selectedSubmission.id, selectedSubmission.updated_at)
      if (cancelled) return
      setChecks(draft?.checks ?? checksFromReview(review))
      setNote(draft?.note ?? review?.note ?? '')
      setDraftStatus(draft ? 'saved' : 'idle')
      draftReadyRef.current = true
    }
    void restore()
    return () => { cancelled = true }
  }, [initialData.reviews, selectedSubmission, staffId])

  useEffect(() => {
    if (!selectedSubmission || !draftReadyRef.current) return
    const timeout = window.setTimeout(() => {
      setDraftStatus('saving')
      void saveSidakDraft(staffId, selectedSubmission.id, selectedSubmission.updated_at, { checks: checks as Record<string, CheckStatus>, note }).then(() => setDraftStatus('saved'))
    }, 350)
    return () => window.clearTimeout(timeout)
  }, [checks, note, selectedSubmission, staffId])

  useEffect(() => {
    if (!photoPreview) return
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') setPhotoPreview(null) }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [photoPreview])

  useEffect(() => {
    if (!selectedSubmission || !draftReadyRef.current) return
    const persistImmediately = () => {
      void saveSidakDraft(staffId, selectedSubmission.id, selectedSubmission.updated_at, { checks: checks as Record<string, CheckStatus>, note })
    }
    const handleVisibilityChange = () => { if (document.visibilityState === 'hidden') persistImmediately() }
    window.addEventListener('pagehide', persistImmediately)
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => {
      window.removeEventListener('pagehide', persistImmediately)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [checks, note, selectedSubmission, staffId])

  const chooseOutlet = (outletId: string) => {
    if (outletId === selectedOutletId) return
    if (selectedSubmission && draftReadyRef.current) {
      void saveSidakDraft(staffId, selectedSubmission.id, selectedSubmission.updated_at, { checks: checks as Record<string, CheckStatus>, note })
    }
    draftReadyRef.current = false
    setSelectedOutletId(outletId)
    setSection('all')
    setChecks({})
    setNote('')
    setDraftStatus('idle')
  }

  const setCheck = (itemId: string, status: CheckStatus) => setChecks((current) => ({ ...current, [itemId]: current[itemId] === status ? undefined : status }))

  const save = async () => {
    if (!selectedSubmission) return
    if (checkedCount !== selectedSubmission.items.length) {
      toast.error(`Masih ada ${selectedSubmission.items.length - checkedCount} item yang belum diperiksa.`)
      return
    }
    setSaving(true)
    try {
      const response = await fetch('/api/inventaris-sidak', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ submission_id: selectedSubmission.id, note, checks: selectedSubmission.items.map((item) => ({ submission_item_id: item.id, status: checks[item.id] })) }) })
      const result = await response.json() as { error?: string }
      if (!response.ok) throw new Error(result.error ?? 'Hasil sidak gagal disimpan.')
      draftReadyRef.current = false
      await removeSidakDraft(staffId, selectedSubmission.id, selectedSubmission.updated_at)
      setDraftStatus('idle')
      setCompletedSubmissionIds((current) => new Set(current).add(selectedSubmission.id))
      toast.success('Hasil sidak tersimpan.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Hasil sidak gagal disimpan.')
    } finally { setSaving(false) }
  }

  return <div className="sidak-page space-y-6">
    <section className="sidak-hero relative overflow-hidden rounded-[2rem] px-5 py-7 text-white sm:px-8 sm:py-9">
      <div className="relative z-10 max-w-3xl"><div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-orange-200"><ShieldCheck size={15} /> Pemeriksaan lapangan</div><h2 className="sidak-display mt-3 text-4xl leading-none sm:text-5xl">Sidak inventaris.</h2><p className="mt-4 max-w-xl text-sm leading-6 text-orange-100">Cocokkan kondisi aset di outlet dengan laporan yang masuk. Tandai temuan saat Anda melihatnya, lalu simpan satu hasil yang bisa ditindaklanjuti.</p></div>
      <div className="sidak-hero-mark" aria-hidden="true"><span>SS</span><span>FIELD<br />CHECK</span></div>
      <div className="relative z-10 mt-7 flex flex-wrap items-center gap-3 text-xs font-semibold text-orange-100"><span className="rounded-full bg-white/12 px-3 py-1.5">{staffName}</span><span className="rounded-full bg-white/12 px-3 py-1.5">{role === 'regional_manager' ? 'Regional Manager · seluruh outlet' : 'Area Manager · outlet terhubung'}</span></div>
    </section>

    <div className="grid gap-5 xl:grid-cols-[290px_minmax(0,1fr)]">
      <aside className="sidak-panel flex min-h-[560px] flex-col rounded-[1.75rem] p-4">
        <div className="mb-4 flex items-center justify-between px-1"><div><p className="text-[11px] font-bold uppercase tracking-[0.16em] text-suka-gray-400">Scope Anda</p><h3 className="mt-1 text-lg font-black text-suka-brown">Pilih outlet</h3></div><span className="rounded-full bg-suka-cream px-2.5 py-1 text-[11px] font-black text-suka-orange">{initialData.outlets.length}</span></div>
        <label className="relative mb-3 block"><span className="sr-only">Cari outlet</span><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-suka-gray-400" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Cari outlet..." className="w-full rounded-xl border border-suka-brown/10 bg-suka-gray-50/70 py-2.5 pl-9 pr-3 text-xs font-semibold outline-none transition focus:border-suka-orange focus:ring-4 focus:ring-orange-100" /></label>
        <div className="space-y-1 overflow-y-auto pr-1">{visibleOutlets.map((outlet) => { const submission = submissionByOutlet.get(outlet.id); const review = initialData.reviews.find((candidate) => candidate.items.some((item) => submission?.items.some((source) => source.id === item.submission_item_id))); const active = outlet.id === selectedOutletId; return <button key={outlet.id} type="button" onClick={() => chooseOutlet(outlet.id)} className={`group flex w-full items-center gap-3 rounded-2xl p-3 text-left transition ${active ? 'bg-suka-brown text-white shadow-lg shadow-suka-brown/15' : 'hover:bg-suka-cream'}`}><span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${active ? 'bg-white/15 text-orange-200' : 'bg-suka-cream text-suka-orange'}`}><Store size={17} /></span><span className="min-w-0 flex-1"><span className={`block truncate text-xs font-black ${active ? 'text-white' : 'text-suka-brown'}`}>{outlet.name}</span><span className={`mt-1 flex items-center gap-1 text-[10px] font-semibold ${active ? 'text-orange-100' : 'text-suka-gray-400'}`}>{review?.status === 'final' ? <><CheckCircle2 size={11} /> Sudah disidak</> : submission ? 'Menunggu sidak' : 'Belum ada laporan AM'}</span></span>{active && <ChevronRight size={15} className="text-orange-200" />}</button> })}</div>
      </aside>

      <main className="min-w-0 space-y-5">
        {!selectedSubmission ? <EmptyState /> : <>
          <section className="sidak-panel rounded-[1.75rem] p-5 sm:p-6"><div className="flex flex-wrap items-start justify-between gap-5"><div><div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-suka-orange"><MapPin size={14} /> {initialData.outlets.find((outlet) => outlet.id === selectedOutletId)?.region ?? 'Outlet'}</div><h1 className="mt-2 text-2xl font-black tracking-tight text-suka-brown sm:text-3xl">{initialData.outlets.find((outlet) => outlet.id === selectedOutletId)?.name}</h1><p className="mt-1 text-xs font-semibold text-suka-gray-500">Laporan AM · {new Date(selectedSubmission.updated_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</p></div><div className="flex items-center gap-3"><div className="progress-ring" style={{ '--progress': `${progress * 3.6}deg` } as React.CSSProperties}><span>{progress}%</span></div><div><p className="text-xs font-black text-suka-brown">{checkedCount}/{selectedSubmission.items.length} diperiksa</p><p className="mt-1 text-[11px] font-semibold text-suka-gray-500">{issueCount ? `${issueCount} temuan dicatat` : 'Belum ada temuan'}</p></div></div></div><div className="mt-5 flex flex-wrap gap-2"><span className="stat-chip"><FileCheck2 size={14} /> {selectedSubmission.items.length} item laporan</span><span className="stat-chip"><Camera size={14} /> Foto AM tersedia</span><span className="stat-chip"><ClipboardCheck size={14} /> Sumber: Inventori</span><span className={`stat-chip ${draftStatus === 'saved' ? 'text-emerald-700' : ''}`}>{draftStatus === 'saving' ? 'Menyimpan draft...' : draftStatus === 'saved' ? 'Draft aman di perangkat' : 'Draft siap disimpan'}</span></div></section>
          {isSubmissionComplete ? <SidakCompletedCard outletName={initialData.outlets.find((outlet) => outlet.id === selectedOutletId)?.name ?? 'Outlet'} onChooseAnother={() => { const nextOutlet = initialData.outlets.find((outlet) => outlet.id !== selectedOutletId); if (nextOutlet) chooseOutlet(nextOutlet.id) }} /> : <><section className="sidak-panel rounded-[1.75rem] p-4 sm:p-6"><div className="sticky top-0 z-10 -mx-1 flex flex-wrap items-center justify-between gap-3 bg-white/95 px-1 pb-4 backdrop-blur-sm"><div><p className="text-[11px] font-bold uppercase tracking-[0.16em] text-suka-gray-400">Checklist verifikasi</p><h2 className="mt-1 text-lg font-black text-suka-brown">Periksa aset satu per satu</h2></div><div className="flex flex-wrap gap-2">{['all', ...availableSections].map((value) => <button key={value} type="button" onClick={() => setSection(value)} className={`rounded-full px-3 py-1.5 text-[11px] font-black transition ${section === value ? 'bg-suka-brown text-white shadow-sm shadow-suka-brown/20' : 'bg-suka-gray-50 text-suka-gray-500 hover:bg-suka-cream hover:text-suka-brown'}`}>{value === 'all' ? 'Semua area' : sectionLabels[value] ?? value}</button>)}</div></div><div className="sidak-checklist-grid mt-1">{visibleItems.map((item) => <ChecklistRow key={item.id} item={item} status={checks[item.id]} onCheck={setCheck} onPreviewPhoto={() => setPhotoPreview({ path: item.photo_path, itemName: item.name, outletName: initialData.outlets.find((outlet) => outlet.id === selectedOutletId)?.name ?? 'Outlet' })} />)}</div></section><section className="sidak-panel rounded-[1.75rem] p-5 sm:p-6"><label className="block text-sm font-black text-suka-brown">Catatan sidak <span className="font-medium text-suka-gray-400">(opsional)</span><textarea value={note} onChange={(event) => setNote(event.target.value)} rows={3} placeholder="Tulis temuan umum, lokasi aset, atau tindak lanjut yang perlu diingat..." className="mt-2 w-full resize-y rounded-2xl border border-suka-brown/10 bg-suka-gray-50/50 p-3 text-sm font-medium text-suka-brown outline-none transition placeholder:text-suka-gray-400 focus:border-suka-orange focus:ring-4 focus:ring-orange-100" /></label><div className="mt-4 flex flex-col-reverse justify-between gap-3 sm:flex-row sm:items-center"><p className="text-xs font-semibold text-suka-gray-500">Semua item harus diberi hasil sebelum disimpan.</p><button type="button" onClick={() => void save()} disabled={saving || checkedCount !== selectedSubmission.items.length} className="inline-flex items-center justify-center gap-2 rounded-xl bg-suka-orange px-5 py-3 text-sm font-black text-white shadow-lg shadow-orange-200 transition hover:bg-[#df8128] disabled:cursor-not-allowed disabled:opacity-45">{saving ? <Loader2 size={17} className="animate-spin" /> : <Check size={17} />} {saving ? 'Menyimpan...' : 'Simpan hasil sidak'}</button></div></section></>}
        </>}
      </main>
    </div>
    {photoPreview && <PhotoPreviewModal photo={photoPreview} onClose={() => setPhotoPreview(null)} />}
  </div>
}

function ChecklistRow({ item, status, onCheck, onPreviewPhoto }: { item: SidakSubmission['items'][number]; status?: CheckStatus; onCheck: (id: string, status: CheckStatus) => void; onPreviewPhoto: () => void }) {
  const target = item.mode === 'range' ? `${item.target_min}–${item.target_max} ${item.unit ?? ''}` : item.target_qty ? `${item.target_qty} ${item.unit ?? ''}` : 'Ada / tidak ada'
  const actual = item.mode === 'quantity' ? `${item.observed_qty ?? 0} ${item.unit ?? ''}` : item.is_present === false ? 'Tidak ada' : item.is_present ? 'Ada' : conditionLabels[item.kondisi] ?? item.kondisi
  return <article className={`check-row relative rounded-2xl border p-3.5 ${status === 'issue' ? 'is-issue border-rose-200 bg-rose-50/60' : status === 'ok' ? 'is-ok border-emerald-200 bg-emerald-50/50' : 'border-suka-brown/10 bg-white'}`}><div className="absolute right-3 top-3"><span className={`status-dot ${status ? status : ''}`}>{status === 'ok' ? 'Sesuai' : status === 'issue' ? 'Temuan' : 'Belum dicek'}</span></div><div className="flex gap-3"><div className={`mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl ${status === 'issue' ? 'bg-rose-100 text-rose-600' : status === 'ok' ? 'bg-emerald-100 text-emerald-700' : 'bg-suka-cream text-suka-orange'}`}>{status === 'issue' ? <AlertTriangle size={17} /> : status === 'ok' ? <CheckCircle2 size={17} /> : <ClipboardCheck size={17} />}</div><div className="min-w-0 flex-1"><div className="flex min-h-11 items-start justify-between gap-2 pr-20"><div><h3 className="text-sm font-black leading-5 text-suka-brown">{item.name}</h3><p className="mt-1 text-[10px] font-semibold text-suka-gray-500">{sectionLabels[item.section]} · {item.subsection}</p></div><button type="button" onClick={onPreviewPhoto} className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-suka-brown/10 px-2 py-1.5 text-[10px] font-black text-suka-brown transition hover:border-suka-orange hover:text-suka-orange"><Camera size={13} /> Foto</button></div><div className="mt-3 grid grid-cols-2 gap-2 rounded-xl bg-suka-gray-50/80 px-3 py-2 text-[10px] font-semibold text-suka-gray-500"><span>Target <b className="ml-1 text-suka-brown">{target}</b></span><span>Terinput <b className="ml-1 text-suka-brown">{actual}</b></span></div><div className="mt-3 grid grid-cols-2 gap-2"><DecisionButton active={status === 'ok'} tone="ok" onClick={() => onCheck(item.id, 'ok')}><Check size={14} /> Sesuai</DecisionButton><DecisionButton active={status === 'issue'} tone="issue" onClick={() => onCheck(item.id, 'issue')}><X size={14} /> Temuan</DecisionButton></div>{item.catatan && <p className="mt-3 line-clamp-2 rounded-lg border border-suka-brown/5 bg-white/70 px-3 py-2 text-[10px] font-medium leading-5 text-suka-gray-500">Catatan AM: {item.catatan}</p>}</div></div></article>
}

// Endpoint foto memerlukan sesi Manager; next/image optimizer tidak meneruskan cookie sesi ini.
/* eslint-disable @next/next/no-img-element */
function PhotoPreviewModal({ photo, onClose }: { photo: PhotoPreview; onClose: () => void }) {
  const [failed, setFailed] = useState(false)
  return <div role="presentation" onMouseDown={onClose} className="fixed inset-0 z-[100] flex items-center justify-center bg-suka-brown/80 p-4 backdrop-blur-sm sm:p-8"><section role="dialog" aria-modal="true" aria-label={`Foto ${photo.itemName}`} onMouseDown={(event) => event.stopPropagation()} className="w-full max-w-5xl overflow-hidden rounded-[1.75rem] border border-white/15 bg-[#22120c] shadow-2xl shadow-black/40"><header className="flex items-center justify-between gap-4 border-b border-white/10 px-5 py-4 text-white sm:px-6"><div className="min-w-0"><p className="text-[10px] font-black uppercase tracking-[0.18em] text-orange-300">Bukti foto inventaris</p><h2 className="mt-1 truncate text-base font-black sm:text-lg">{photo.itemName}</h2><p className="mt-0.5 text-xs font-medium text-orange-100/70">{photo.outletName}</p></div><button type="button" onClick={onClose} className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-white/15 text-white transition hover:bg-white/10 focus:outline-none focus:ring-4 focus:ring-orange-300/30" aria-label="Tutup foto"><X size={19} /></button></header><div className="grid min-h-[280px] max-h-[72vh] place-items-center bg-black/35 p-3 sm:p-5">{failed ? <div className="text-center text-orange-100"><ImageOff className="mx-auto h-9 w-9 text-orange-300" /><p className="mt-3 text-sm font-bold">Foto tidak dapat dimuat.</p><p className="mt-1 text-xs text-orange-100/65">Coba tutup lalu buka kembali.</p></div> : <img src={`/api/inventaris/photo?path=${encodeURIComponent(photo.path)}`} alt={`Foto inventaris ${photo.itemName} di ${photo.outletName}`} onError={() => setFailed(true)} className="max-h-[calc(72vh-1.5rem)] w-auto max-w-full rounded-xl object-contain shadow-2xl" />}</div></section></div>
}
/* eslint-enable @next/next/no-img-element */

function SidakCompletedCard({ outletName, onChooseAnother }: { outletName: string; onChooseAnother: () => void }) {
  return <section className="sidak-completed relative overflow-hidden rounded-[1.75rem] border border-emerald-200 bg-emerald-50 px-6 py-12 text-center shadow-sm sm:px-10"><div className="sidak-completed-ripple" aria-hidden="true" /><div className="relative mx-auto max-w-md"><span className="sidak-completed-check mx-auto grid h-20 w-20 place-items-center rounded-[1.65rem] bg-emerald-600 text-white shadow-xl shadow-emerald-600/25"><Check size={40} strokeWidth={3} /></span><div className="mt-6 flex justify-center text-emerald-600"><PartyPopper size={22} /></div><p className="mt-3 text-[11px] font-black uppercase tracking-[0.18em] text-emerald-700">Pemeriksaan selesai</p><h2 className="mt-2 text-2xl font-black tracking-tight text-emerald-950">Sidak {outletName} tersimpan.</h2><p className="mt-3 text-sm leading-6 text-emerald-800">Hasil checklist sudah dikirim ke dashboard Admin Inventori untuk ditindaklanjuti.</p><button type="button" onClick={onChooseAnother} className="mt-7 inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-5 py-3 text-sm font-black text-white shadow-lg shadow-emerald-700/20 transition hover:bg-emerald-800"><Store size={16} /> Pilih outlet lain</button></div></section>
}

function DecisionButton({ active, tone, children, onClick }: { active: boolean; tone: 'ok' | 'issue'; children: React.ReactNode; onClick: () => void }) { return <button type="button" onClick={onClick} className={`inline-flex items-center justify-center gap-1.5 rounded-xl border py-2 text-xs font-black transition ${active ? tone === 'ok' ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-rose-600 bg-rose-600 text-white' : tone === 'ok' ? 'border-emerald-200 bg-white text-emerald-700 hover:bg-emerald-50' : 'border-rose-200 bg-white text-rose-700 hover:bg-rose-50'}`}>{children}</button> }
function EmptyState() { return <section className="sidak-panel grid min-h-[560px] place-items-center rounded-[1.75rem] p-8 text-center"><div><div className="mx-auto grid h-16 w-16 place-items-center rounded-3xl bg-suka-cream text-suka-orange"><ClipboardCheck size={29} /></div><h2 className="mt-5 text-xl font-black text-suka-brown">Belum ada laporan untuk outlet ini</h2><p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-suka-gray-500">Tunggu laporan inventaris masuk dari aplikasi Inventori, lalu sidak bisa dimulai dari sini.</p></div></section> }
