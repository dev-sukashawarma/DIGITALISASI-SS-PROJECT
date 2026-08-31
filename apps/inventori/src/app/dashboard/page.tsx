'use client'

import { type ChangeEvent, useEffect, useMemo, useRef, useState } from 'react'
import { Camera, ClipboardCheck, LogOut, Store } from 'lucide-react'
import { useAuth } from '@suka/auth'
import { createClient } from '@/lib/supabase'
import { loadInventoryDraft, removeInventoryDraft, saveInventoryDraft, type StoredDraft } from '@/lib/inventory-draft-store'

type ItemMode = 'quantity' | 'presence' | 'range'
type Condition = 'baik' | 'perlu_perbaikan' | 'rusak' | 'tidak_ada'
type MasterItem = {
  id: string
  section: string
  subsection: string
  name: string
  mode: ItemMode
  target_qty: number | null
  target_min: number | null
  target_max: number | null
  unit: string | null
  sort_order: number
}
type Outlet = { id: string; name: string }
type Draft = StoredDraft
type ExistingSubmission = {
  id: string
  tanggal: string
  area_scores: Record<string, string>
  notes: string | null
  updated_at: string
  items: Array<{
    master_item_id: string
    observed_qty: number | null
    is_present: boolean | null
    kondisi: Condition
    catatan: string | null
    photo_path: string
    photo_url: string | null
  }>
}

const SCORE_FIELDS = [
  ['kebersihan_outlet', 'Kebersihan outlet'],
  ['kebersihan_peralatan_masak', 'Kebersihan peralatan masak'],
  ['kebersihan_exterior', 'Kebersihan exterior'],
  ['kebersihan_kamar_mandi', 'Kebersihan kamar mandi'],
  ['kondisi_parkir', 'Kondisi parkiran'],
] as const

const todayJakarta = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' })
const asIds = (value: unknown): string[] => (Array.isArray(value) ? value : [])
  .map((row) => typeof row === 'string' ? row : (row as { accessible_outlet_ids?: string } | null)?.accessible_outlet_ids)
  .filter((id): id is string => Boolean(id))

function emptyDraft(): Draft {
  return { observedQty: '', isPresent: true, condition: 'baik', notes: '', photo: null }
}

function draftsForItems(nextItems: MasterItem[], existingDrafts?: Record<string, Draft>, savedDrafts?: Record<string, Draft>) {
  return Object.fromEntries(nextItems.map((item) => {
    const existing = existingDrafts?.[item.id]
    const saved = savedDrafts?.[item.id]
    const draft = { ...emptyDraft(), ...existing, ...saved }
    // Signed URL dari server bisa kedaluwarsa. Jika belum ada foto baru yang
    // dipilih, selalu pakai path dan URL terbaru dari server.
    if (!saved?.photo && existing?.existingPhotoPath) {
      draft.existingPhotoPath = existing.existingPhotoPath
      draft.existingPhotoUrl = existing.existingPhotoUrl
    }
    return [item.id, draft]
  }))
}

function evaluation(item: MasterItem, draft: Draft) {
  if (item.mode === 'presence') return draft.isPresent ? 'sesuai' : 'tidak_ada'
  const qty = Number(draft.observedQty)
  if (!Number.isFinite(qty)) return 'kurang'
  if (item.mode === 'range') return qty >= Number(item.target_min) && qty <= Number(item.target_max) ? 'sesuai' : 'di_luar_target'
  return qty >= Number(item.target_qty) ? 'sesuai' : 'kurang'
}

function targetLabel(item: MasterItem) {
  if (item.mode === 'presence') return 'Wajib tersedia'
  if (item.mode === 'range') return `Target ${item.target_min}–${item.target_max} ${item.unit ?? ''}`
  return `Target min. ${item.target_qty} ${item.unit ?? ''}`
}

function groupItems(items: MasterItem[]) {
  return items.reduce<Record<string, MasterItem[]>>((groups, item) => {
    groups[item.subsection] = [...(groups[item.subsection] ?? []), item]
    return groups
  }, {})
}

function PhotoPicker({ itemName, itemId, photo, existingPhotoUrl, onPhotoChange }: {
  itemName: string
  itemId: string
  photo: File | null
  existingPhotoUrl?: string | null
  onPhotoChange: (photo: File | null) => void
}) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!photo) {
      setPreviewUrl(null)
      return
    }
    const objectUrl = URL.createObjectURL(photo)
    setPreviewUrl(objectUrl)
    return () => URL.revokeObjectURL(objectUrl)
  }, [photo])

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    onPhotoChange(event.currentTarget.files?.[0] ?? null)
    // Memungkinkan kamera memilih foto yang sama lagi pada percobaan berikutnya.
    event.currentTarget.value = ''
  }

  const inputId = `photo-${itemId}`
  return (
    <div className="w-full shrink-0 lg:w-56">
      <label htmlFor={inputId} className="flex min-h-32 cursor-pointer flex-col items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed border-orange-200 bg-orange-50/40 text-center hover:border-[#f29744]">
        {photo && previewUrl ? <>
          <img src={previewUrl} alt={`Foto ${itemName}`} className="h-32 w-full object-cover" />
          <span className="px-2 py-2 text-[11px] font-bold text-green-700">Foto baru siap · tekan untuk ganti</span>
        </> : existingPhotoUrl ? <>
          <img src={existingPhotoUrl} alt={`Foto ${itemName}`} className="h-32 w-full object-cover" />
          <span className="px-2 py-2 text-[11px] font-bold text-green-700">Foto tersimpan · tekan untuk ganti</span>
        </> : <>
          <Camera className="text-[#f29744]" size={28} />
          <span className="mt-2 text-xs font-bold text-[#701604]">Ambil foto barang</span>
          <span className="mt-1 text-[10px] text-slate-500">JPG/PNG/WebP</span>
        </>}
      </label>
      <input id={inputId} type="file" accept="image/jpeg,image/png,image/webp" capture="environment" className="sr-only" onChange={handleChange} />
      <p className="mt-2 truncate text-[10px] text-slate-500" title={photo?.name}>
        {photo ? `${photo.name} · tersimpan sementara` : existingPhotoUrl ? 'Foto database tetap digunakan' : 'Belum ada foto'}
      </p>
    </div>
  )
}

async function fetchCurrentSubmission(outletId: string): Promise<ExistingSubmission | null> {
  const response = await fetch(`/api/inventaris/submit?outlet_id=${encodeURIComponent(outletId)}`, { cache: 'no-store' })
  const result = await response.json().catch(() => null) as { error?: string; submission?: ExistingSubmission | null } | null
  if (!response.ok) throw new Error(result?.error ?? 'Gagal memuat inventaris tersimpan.')
  return result?.submission ?? null
}

function draftsFromSubmission(submission: ExistingSubmission | null) {
  return Object.fromEntries((submission?.items ?? []).map((item) => [item.master_item_id, {
    ...emptyDraft(),
    observedQty: item.observed_qty === null ? '' : String(item.observed_qty),
    isPresent: item.is_present ?? true,
    condition: item.kondisi,
    notes: item.catatan ?? '',
    existingPhotoPath: item.photo_path,
    existingPhotoUrl: item.photo_url,
  }]))
}

function scoresFromSubmission(submission: ExistingSubmission | null) {
  return Object.fromEntries(Object.entries(submission?.area_scores ?? {}).map(([key, value]) => [key, String(value)]))
}

export default function InventoryDashboardPage() {
  const { outletStaff, loading: authLoading, signOut } = useAuth()
  const supabase = useMemo(() => createClient(), [])
  const [outlets, setOutlets] = useState<Outlet[]>([])
  const [items, setItems] = useState<MasterItem[]>([])
  const [drafts, setDrafts] = useState<Record<string, Draft>>({})
  const [scores, setScores] = useState<Record<string, string>>({})
  const [selectedOutletId, setSelectedOutletId] = useState('')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [switchingOutlet, setSwitchingOutlet] = useState(false)
  const [draftStatus, setDraftStatus] = useState<'idle' | 'saving' | 'saved'>('idle')
  const [message, setMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null)
  const staffId = outletStaff?.id ?? null
  const draftReadyRef = useRef(false)

  useEffect(() => {
    draftReadyRef.current = false
    if (!staffId) {
      setLoading(false)
      return
    }
    const currentStaffId = staffId
    let cancelled = false
    async function load() {
      setLoading(true)
      const { data: rpcData, error: rpcError } = await supabase.rpc('accessible_outlet_ids')
      if (rpcError) {
        if (!cancelled) setMessage({ type: 'error', text: rpcError.message })
        setLoading(false)
        return
      }
      const ids = asIds(rpcData)
      const [outletResult, itemResult] = await Promise.all([
        supabase.from('outlets').select('id, name').in('id', ids).order('name'),
        supabase.from('inventaris_master_items').select('id, section, subsection, name, mode, target_qty, target_min, target_max, unit, sort_order').order('sort_order'),
      ])
      if (!cancelled) {
        if (outletResult.error || itemResult.error) {
          setMessage({ type: 'error', text: outletResult.error?.message ?? itemResult.error?.message ?? 'Gagal memuat data' })
        } else {
          const nextOutlets = (outletResult.data ?? []) as Outlet[]
          const nextItems = (itemResult.data ?? []) as MasterItem[]
          const initialOutletId = nextOutlets[0]?.id ?? ''
          const [savedDraft, currentSubmission] = initialOutletId
            ? await Promise.all([
              loadInventoryDraft(currentStaffId, todayJakarta(), initialOutletId),
              fetchCurrentSubmission(initialOutletId).catch((error) => {
                if (!cancelled) setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Gagal memuat inventaris tersimpan.' })
                return null
              }),
            ])
            : [null, null]
          if (cancelled) return
          setOutlets(nextOutlets)
          setItems(nextItems)
          setSelectedOutletId(initialOutletId)
          setDrafts(draftsForItems(nextItems, draftsFromSubmission(currentSubmission), savedDraft?.drafts))
          setScores(savedDraft?.scores ?? scoresFromSubmission(currentSubmission))
          setNotes(savedDraft?.notes ?? currentSubmission?.notes ?? '')
          setDraftStatus(savedDraft || currentSubmission ? 'saved' : 'idle')
          draftReadyRef.current = true
        }
        setLoading(false)
      }
    }
    void load()
    return () => { cancelled = true }
  }, [staffId, supabase])

  useEffect(() => {
    if (!staffId || !selectedOutletId || !draftReadyRef.current) return
    const timeout = window.setTimeout(() => {
      setDraftStatus('saving')
      void saveInventoryDraft(staffId, todayJakarta(), selectedOutletId, { drafts, scores, notes })
        .then(() => setDraftStatus('saved'))
    }, 350)
    return () => window.clearTimeout(timeout)
  }, [drafts, scores, notes, selectedOutletId, staffId])

  useEffect(() => {
    if (!staffId || !selectedOutletId || !draftReadyRef.current) return
    const persistImmediately = () => {
      // saveInventoryDraft menulis localStorage secara sinkron sebelum IndexedDB.
      // Ini menjaga draft tetap ada walaupun tab ditutup/di-refresh sebelum debounce selesai.
      void saveInventoryDraft(staffId, todayJakarta(), selectedOutletId, { drafts, scores, notes })
    }
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') persistImmediately()
    }
    window.addEventListener('pagehide', persistImmediately)
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => {
      window.removeEventListener('pagehide', persistImmediately)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [drafts, scores, notes, selectedOutletId, staffId])

  const groups = useMemo(() => groupItems(items), [items])
  const selectedOutlet = outlets.find((outlet) => outlet.id === selectedOutletId)
  const allPhotos = items.length > 0 && items.every((item) => Boolean(drafts[item.id]?.photo || drafts[item.id]?.existingPhotoPath))
  const allFieldsValid = items.length > 0 && items.every((item) => {
    const draft = drafts[item.id]
    return item.mode === 'presence' || (draft?.observedQty.trim() !== '' && Number.isFinite(Number(draft?.observedQty)))
  })

  function updateDraft(itemId: string, patch: Partial<Draft>) {
    setDrafts((current) => ({ ...current, [itemId]: { ...emptyDraft(), ...current[itemId], ...patch } }))
  }

  async function handleOutletChange(nextOutletId: string) {
    if (!nextOutletId || nextOutletId === selectedOutletId || !staffId || switchingOutlet) return
    setSwitchingOutlet(true)
    draftReadyRef.current = false
    try {
      if (selectedOutletId) {
        await saveInventoryDraft(staffId, todayJakarta(), selectedOutletId, { drafts, scores, notes })
      }
      const [savedDraft, currentSubmission] = await Promise.all([
        loadInventoryDraft(staffId, todayJakarta(), nextOutletId),
        fetchCurrentSubmission(nextOutletId).catch((error) => {
          throw error instanceof Error ? error : new Error('Gagal memuat inventaris tersimpan.')
        }),
      ])
      setSelectedOutletId(nextOutletId)
      setDrafts(draftsForItems(items, draftsFromSubmission(currentSubmission), savedDraft?.drafts))
      setScores(savedDraft?.scores ?? scoresFromSubmission(currentSubmission))
      setNotes(savedDraft?.notes ?? currentSubmission?.notes ?? '')
      setMessage(null)
      draftReadyRef.current = true
      setDraftStatus(savedDraft || currentSubmission ? 'saved' : 'idle')
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Gagal memuat data outlet.' })
    } finally {
      setSwitchingOutlet(false)
    }
  }

  async function submit() {
    setMessage(null)
    if (!staffId || !selectedOutletId) return
    if (!allPhotos || !allFieldsValid) {
      setMessage({ type: 'error', text: !allPhotos ? 'Foto wajib diisi untuk setiap item sebelum dikirim.' : 'Jumlah wajib diisi untuk semua item yang memiliki target jumlah.' })
      return
    }
    setSubmitting(true)
    try {
      const formData = new FormData()
      const detailRows: Array<Record<string, string | number | boolean | null>> = []
      for (const item of items) {
        const draft = drafts[item.id] ?? emptyDraft()
        if (draft.photo) formData.append(`photo_${item.id}`, draft.photo, draft.photo.name)
        else if (!draft.existingPhotoPath) throw new Error(`Foto ${item.name} belum dipilih.`)
        detailRows.push({
          master_item_id: item.id,
          observed_qty: item.mode === 'presence' ? null : Number(draft.observedQty),
          is_present: item.mode === 'presence' ? draft.isPresent : null,
          kondisi: draft.condition,
          catatan: draft.notes.trim() || null,
          photo_path: draft.photo ? null : draft.existingPhotoPath ?? null,
        })
      }
      formData.append('payload', JSON.stringify({
        outlet_id: selectedOutletId,
        tanggal: todayJakarta(),
        area_scores: scores,
        notes: notes.trim() || null,
        items: detailRows,
      }))
      const response = await fetch('/api/inventaris/submit', { method: 'POST', body: formData })
      const result = await response.json().catch(() => null) as { error?: string; submission_id?: string; updated?: boolean } | null
      if (!response.ok) throw new Error(result?.error ?? 'Gagal mengirim inventaris.')
      await removeInventoryDraft(staffId, todayJakarta(), selectedOutletId)
      setDraftStatus('idle')
      setMessage({ type: 'success', text: `Inventaris berhasil ${result?.updated ? 'diperbarui' : 'disimpan'}${result?.submission_id ? ` (${result.submission_id})` : ''}. Data tersedia di dashboard admin dan masih bisa diedit.` })
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Gagal mengirim inventaris.' })
    } finally {
      setSubmitting(false)
    }
  }

  if (authLoading || loading) return <main className="grid min-h-screen place-items-center p-6 text-slate-500">Memuat inventaris...</main>
  if (!outletStaff || !['area_manager', 'admin', 'owner'].includes(outletStaff.role)) {
    return <main className="grid min-h-screen place-items-center p-6 text-center"><div><h1 className="text-xl font-bold text-[#400a07]">Akses tidak tersedia</h1><p className="mt-2 text-sm text-slate-500">Aplikasi ini hanya dapat digunakan oleh Area Manager.</p></div></main>
  }

  return (
    <main className="min-h-screen bg-[#fffaf5] pb-12">
      <header className="border-b border-orange-100 bg-white px-4 py-4 shadow-sm sm:px-8">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
          <div className="flex items-center gap-3"><span className="grid h-11 w-11 place-items-center rounded-2xl bg-[#701604] text-white"><ClipboardCheck size={23} /></span><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-[#f29744]">SUKASHAWARMA</p><h1 className="text-xl font-extrabold text-[#400a07]">Inventaris Outlet</h1></div></div>
          <button onClick={() => void signOut()} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"><LogOut size={16} /> Keluar</button>
        </div>
      </header>
      <div className="mx-auto max-w-6xl space-y-5 px-4 pt-6 sm:px-8">
        <section className="rounded-3xl bg-[#701604] p-5 text-white shadow-lg sm:p-7"><p className="text-sm text-orange-100">Halo, {outletStaff.name}</p><h2 className="mt-1 text-2xl font-extrabold">Data inventaris outlet</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-orange-100">Catat setiap aset sesuai kondisi sebenarnya. Setiap item wajib difoto. Data tersimpan sebagai database inventaris dan dapat diperbarui jika ada perubahan.</p></section>
        <section className="rounded-2xl border border-orange-100 bg-white p-4 shadow-sm sm:p-5"><label className="mb-2 flex items-center gap-2 text-sm font-bold text-[#400a07]"><Store size={17} /> Pilih outlet</label><select value={selectedOutletId} disabled={switchingOutlet} onChange={(event) => { void handleOutletChange(event.target.value) }} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm outline-none focus:border-[#f29744] disabled:opacity-60">{outlets.map((outlet) => <option key={outlet.id} value={outlet.id}>{outlet.name}</option>)}</select><p className="mt-2 text-xs text-slate-500">{switchingOutlet ? 'Memuat data outlet...' : draftStatus === 'saving' ? 'Menyimpan draft...' : draftStatus === 'saved' ? 'Data/draft tersimpan otomatis di perangkat ini.' : 'Isian dan foto tersimpan otomatis di perangkat ini.'}</p></section>
        {message && <div className={`rounded-2xl border p-4 text-sm font-semibold ${message.type === 'success' ? 'border-green-200 bg-green-50 text-green-700' : 'border-red-200 bg-red-50 text-red-700'}`}>{message.text}</div>}
        <>
          {Object.entries(groups).map(([subsection, group]) => <section key={subsection} className="overflow-hidden rounded-3xl border border-orange-100 bg-white shadow-sm"><div className="border-b border-orange-100 bg-orange-50/70 px-5 py-4"><h2 className="font-extrabold text-[#400a07]">{subsection}</h2><p className="mt-1 text-xs text-slate-500">{group.length} item · foto wajib per item</p></div><div className="divide-y divide-slate-100">{group.map((item) => { const draft = drafts[item.id] ?? emptyDraft(); const result = evaluation(item, draft); return <article key={item.id} className="p-5"><div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between"><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h3 className="font-bold text-slate-800">{item.name}</h3><span className={`rounded-full px-2 py-1 text-[10px] font-bold uppercase ${result === 'sesuai' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>{result.replace('_', ' ')}</span></div><p className="mt-1 text-xs font-medium text-slate-500">{targetLabel(item)}</p><div className="mt-4 flex flex-wrap items-center gap-3">{item.mode === 'presence' ? <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={draft.isPresent} onChange={(event) => updateDraft(item.id, { isPresent: event.target.checked, condition: event.target.checked ? draft.condition : 'tidak_ada' })} className="h-5 w-5 accent-[#701604]" /> Barang tersedia</label> : <label className="flex items-center gap-2 text-sm font-semibold text-slate-600">Jumlah<input type="number" min="0" step="0.01" value={draft.observedQty} onChange={(event) => updateDraft(item.id, { observedQty: event.target.value })} className="w-28 rounded-xl border border-slate-200 px-3 py-2 text-sm" />{item.unit}</label>}<label className="flex items-center gap-2 text-sm text-slate-600">Kondisi<select value={draft.condition} onChange={(event) => updateDraft(item.id, { condition: event.target.value as Condition })} className="rounded-xl border border-slate-200 px-3 py-2 text-sm"><option value="baik">Baik</option><option value="perlu_perbaikan">Perlu perbaikan</option><option value="rusak">Rusak</option><option value="tidak_ada">Tidak ada</option></select></label></div><input value={draft.notes} onChange={(event) => updateDraft(item.id, { notes: event.target.value })} placeholder="Catatan item (opsional)" className="mt-3 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-[#f29744]" /></div><PhotoPicker itemName={item.name} itemId={item.id} photo={draft.photo} existingPhotoUrl={draft.existingPhotoUrl} onPhotoChange={(photo) => updateDraft(item.id, { photo })} /></div></article> })}</div></section>)}
          <section className="rounded-3xl border border-orange-100 bg-white p-5 shadow-sm"><h2 className="font-extrabold text-[#400a07]">Skor area & catatan</h2><p className="mt-1 text-xs text-slate-500">Nilai 1 (buruk) sampai 5 (sangat baik). Bagian ini tidak menggantikan foto item.</p><div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">{SCORE_FIELDS.map(([key, label]) => <label key={key} className="text-xs font-bold text-slate-600">{label}<select value={scores[key] ?? ''} onChange={(event) => setScores((current) => ({ ...current, [key]: event.target.value }))} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-normal"><option value="">Pilih</option>{[1, 2, 3, 4, 5].map((value) => <option key={value} value={value}>{value}</option>)}</select></label>)}</div><textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Catatan umum outlet (opsional)" className="mt-4 min-h-24 w-full rounded-xl border border-slate-200 px-3 py-3 text-sm outline-none focus:border-[#f29744]" /></section>
          <button disabled={submitting || !allPhotos || !allFieldsValid || !items.length} onClick={() => void submit()} className="w-full rounded-2xl bg-[#f29744] px-5 py-4 text-sm font-extrabold text-white shadow-lg shadow-orange-200 transition hover:bg-[#e6842f] disabled:cursor-not-allowed disabled:opacity-50">{submitting ? 'Mengompres WebP di server dan menyimpan...' : `Kirim inventaris ${selectedOutlet?.name ?? ''}`}</button>
        </>
      </div>
    </main>
  )
}
