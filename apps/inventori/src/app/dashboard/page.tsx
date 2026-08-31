'use client'

import { type ChangeEvent, type KeyboardEvent as ReactKeyboardEvent, useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Camera, Check, ChevronDown, ClipboardCheck, ExternalLink, LogOut, Store } from 'lucide-react'
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

function isFreezerItem(item: MasterItem) {
  return item.name.toLowerCase().includes('freezer')
}

function groupItems(items: MasterItem[]) {
  return items.reduce<Record<string, MasterItem[]>>((groups, item) => {
    groups[item.subsection] = [...(groups[item.subsection] ?? []), item]
    return groups
  }, {})
}

type CustomSelectOption = { value: string; label: string }

function CustomSelect({ value, options, onChange, disabled = false, ariaLabel }: {
  value: string
  options: CustomSelectOption[]
  onChange: (value: string) => void
  disabled?: boolean
  ariaLabel: string
}) {
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(Math.max(0, options.findIndex((option) => option.value === value)))
  const containerRef = useRef<HTMLDivElement>(null)
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([])
  const selected = options.find((option) => option.value === value) ?? options[0]

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false)
    }
    const handleEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', handleOutsideClick)
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [])

  useEffect(() => {
    const nextIndex = options.findIndex((option) => option.value === value)
    setActiveIndex(nextIndex >= 0 ? nextIndex : 0)
  }, [options, value])

  useEffect(() => {
    if (open) optionRefs.current[activeIndex]?.focus()
  }, [activeIndex, open])

  function choose(option: CustomSelectOption) {
    onChange(option.value)
    setOpen(false)
  }

  function handleTriggerKeyDown(event: ReactKeyboardEvent<HTMLButtonElement>) {
    if (disabled) return
    if (event.key === 'Enter' || event.key === ' ' || event.key === 'ArrowDown') {
      event.preventDefault()
      setOpen(true)
      setActiveIndex(Math.max(0, options.findIndex((option) => option.value === value)))
    }
  }

  function handleOptionKeyDown(event: ReactKeyboardEvent<HTMLButtonElement>, index: number) {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setActiveIndex(Math.min(options.length - 1, index + 1))
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActiveIndex(Math.max(0, index - 1))
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      choose(options[index])
    } else if (event.key === 'Tab') {
      setOpen(false)
    }
  }

  return (
    <div ref={containerRef} className="relative w-full">
      <button type="button" disabled={disabled} aria-label={ariaLabel} aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen((current) => !current)} onKeyDown={handleTriggerKeyDown} className="flex w-full items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 py-3 text-left text-sm text-slate-700 outline-none transition hover:border-orange-300 focus:border-[#f29744] focus:ring-2 focus:ring-orange-100 disabled:cursor-not-allowed disabled:opacity-60">
        <span className="truncate">{selected?.label ?? 'Pilih'}</span>
        <ChevronDown size={17} className={`shrink-0 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && <div role="listbox" aria-label={ariaLabel} className="absolute left-0 right-0 top-[calc(100%+6px)] z-40 max-h-60 overflow-y-auto rounded-2xl border border-orange-100 bg-white p-1.5 shadow-xl shadow-orange-950/10">
        {options.map((option, index) => <button key={option.value} ref={(element) => { optionRefs.current[index] = element }} type="button" role="option" aria-selected={option.value === value} tabIndex={index === activeIndex ? 0 : -1} onClick={() => choose(option)} onKeyDown={(event) => handleOptionKeyDown(event, index)} className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm transition ${option.value === value ? 'bg-orange-50 font-bold text-[#701604]' : 'text-slate-600 hover:bg-orange-50/70 hover:text-[#701604]'}`}>
          <span>{option.label}</span>
          {option.value === value && <Check size={16} className="text-[#f29744]" />}
        </button>)}
      </div>}
    </div>
  )
}

function SubmissionSuccessScreen({ outletName, updated, onContinue }: {
  outletName: string
  updated: boolean
  onContinue: () => void
}) {
  return (
    <main className="grid min-h-screen place-items-center bg-[#fffaf5] p-6">
      <section className="w-full max-w-lg rounded-[2rem] border border-green-100 bg-white px-6 py-12 text-center shadow-xl shadow-green-950/10 sm:px-12" aria-live="polite">
        <div className="relative mx-auto mb-7 h-28 w-28">
          <span className="absolute inset-0 rounded-full bg-green-200/70 animate-ping" />
          <div className="relative grid h-28 w-28 place-items-center rounded-full bg-gradient-to-br from-green-400 to-emerald-600 text-white shadow-lg shadow-green-200 transition-transform duration-300 hover:scale-110">
            <Check size={54} strokeWidth={3.5} className="animate-bounce" />
          </div>
        </div>
        <p className="text-sm font-extrabold uppercase tracking-[0.18em] text-green-600">Berhasil disimpan</p>
        <h1 className="mt-3 text-2xl font-extrabold text-[#400a07]">Inventaris {updated ? 'berhasil diperbarui' : 'berhasil dicatat'}</h1>
        <p className="mt-3 text-base font-semibold text-slate-700">Data inventaris <span className="text-[#701604]">{outletName}</span> sudah tersimpan.</p>
        <p className="mt-2 text-sm leading-6 text-slate-500">Data sudah masuk ke database dan dapat dilihat di dashboard admin.</p>
        <button type="button" onClick={onContinue} className="mt-8 inline-flex items-center justify-center rounded-2xl bg-[#f29744] px-6 py-3 text-sm font-extrabold text-white shadow-lg shadow-orange-200 transition hover:-translate-y-0.5 hover:bg-[#e6842f] focus:outline-none focus:ring-2 focus:ring-orange-200 focus:ring-offset-2">Kembali ke daftar outlet</button>
      </section>
    </main>
  )
}

function PhotoPicker({ outletId, itemName, itemId, photo, uploadedPhotoPath, uploadedPhotoUrl, existingPhotoUrl, onPhotoChange, onPhotoUploaded }: {
  outletId: string
  itemName: string
  itemId: string
  photo: File | null
  uploadedPhotoPath?: string
  uploadedPhotoUrl?: string | null
  existingPhotoUrl?: string | null
  onPhotoChange: (photo: File | null) => void
  onPhotoUploaded: (path: string | null, url?: string | null) => void
}) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const uploadControllerRef = useRef<AbortController | null>(null)

  useEffect(() => {
    if (!photo) {
      setPreviewUrl(null)
      return
    }
    const objectUrl = URL.createObjectURL(photo)
    setPreviewUrl(objectUrl)
    return () => URL.revokeObjectURL(objectUrl)
  }, [photo])

  async function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const nextPhoto = event.currentTarget.files?.[0] ?? null
    uploadControllerRef.current?.abort()
    onPhotoChange(nextPhoto)
    onPhotoUploaded(null)
    setUploadError(null)
    if (nextPhoto) {
      setUploading(true)
      const controller = new AbortController()
      uploadControllerRef.current = controller
      const formData = new FormData()
      formData.append('outlet_id', outletId)
      formData.append('item_id', itemId)
      if (uploadedPhotoPath) formData.append('previous_path', uploadedPhotoPath)
      formData.append('photo', nextPhoto, nextPhoto.name)
      try {
        const response = await fetch('/api/inventaris/photo', { method: 'POST', body: formData, signal: controller.signal })
        const result = await response.json().catch(() => null) as { error?: string; photo_path?: string; photo_url?: string | null } | null
        if (!response.ok || !result?.photo_path) throw new Error(result?.error ?? 'Foto gagal disimpan ke server.')
        onPhotoUploaded(result.photo_path, result.photo_url)
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return
        setUploadError(error instanceof Error ? error.message : 'Foto gagal disimpan ke server.')
      } finally {
        if (uploadControllerRef.current === controller) {
          uploadControllerRef.current = null
          setUploading(false)
        }
      }
    }
    // Memungkinkan kamera memilih foto yang sama lagi pada percobaan berikutnya.
    event.currentTarget.value = ''
  }

  const inputId = `photo-${itemId}`
  return (
    <div className="mx-auto w-full max-w-56 shrink-0 lg:mx-0 lg:w-56">
      <label htmlFor={inputId} className="relative flex aspect-square w-full cursor-pointer flex-col items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed border-orange-200 bg-orange-50/40 text-center hover:border-[#f29744]">
        {photo && previewUrl ? <>
          <img src={previewUrl} alt={`Foto ${itemName}`} className="h-full w-full object-cover" />
          <span className={`absolute inset-x-0 bottom-0 bg-white/90 px-2 py-2 text-[11px] font-bold backdrop-blur-sm ${uploading ? 'text-orange-600' : uploadError ? 'text-red-600' : 'text-green-700'}`}>{uploading ? 'Mengunggah foto…' : uploadError ? 'Gagal · tekan untuk coba lagi' : 'Foto tersimpan · server mengoptimalkan'}</span>
        </> : existingPhotoUrl ? <>
          <img src={existingPhotoUrl} alt={`Foto ${itemName}`} className="h-full w-full object-cover" />
          <span className="absolute inset-x-0 bottom-0 bg-white/90 px-2 py-2 text-[11px] font-bold text-green-700 backdrop-blur-sm">Foto tersimpan · tekan untuk ganti</span>
        </> : uploadedPhotoUrl ? <>
          <img src={uploadedPhotoUrl} alt={`Foto ${itemName}`} className="h-full w-full object-cover" />
          <span className={`absolute inset-x-0 bottom-0 bg-white/90 px-2 py-2 text-[11px] font-bold backdrop-blur-sm ${uploading ? 'text-orange-600' : 'text-green-700'}`}>{uploading ? 'Mengunggah foto…' : 'Foto tersimpan · server mengoptimalkan'}</span>
        </> : <>
          <Camera className="text-[#f29744]" size={28} />
          <span className="mt-2 text-xs font-bold text-[#701604]">Ambil foto barang</span>
          <span className="mt-1 text-[10px] text-slate-500">JPG/PNG/WebP</span>
        </>}
      </label>
      <input id={inputId} type="file" accept="image/jpeg,image/png,image/webp" capture="environment" className="sr-only" onChange={handleChange} />
      <p className="mt-2 truncate text-[10px] text-slate-500" title={photo?.name}>
        {uploadError ? uploadError : uploading ? 'Mengunggah foto asli…' : photo && uploadedPhotoPath ? `${photo.name} · tersimpan, server mengoptimalkan` : photo ? `${photo.name} · menunggu upload` : existingPhotoUrl ? 'Foto database tetap digunakan' : uploadedPhotoPath ? 'Foto tersimpan, server mengoptimalkan' : 'Belum ada foto'}
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
  const [savedOutletIds, setSavedOutletIds] = useState<Set<string>>(new Set())
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [switchingOutlet, setSwitchingOutlet] = useState(false)
  const [draftStatus, setDraftStatus] = useState<'idle' | 'saving' | 'saved'>('idle')
  const [message, setMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null)
  const [completedSubmission, setCompletedSubmission] = useState<{ outletName: string; updated: boolean } | null>(null)
  const [sessionMenuOpen, setSessionMenuOpen] = useState(false)
  const routeParams = useParams<{ outletId?: string }>()
  const editOutletId = typeof routeParams?.outletId === 'string' ? routeParams.outletId : null
  const router = useRouter()
  const staffId = outletStaff?.id ?? null
  const draftReadyRef = useRef(false)
  const sessionMenuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!sessionMenuOpen) return
    const handleOutsideClick = (event: MouseEvent) => {
      if (!sessionMenuRef.current?.contains(event.target as Node)) setSessionMenuOpen(false)
    }
    const handleEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') setSessionMenuOpen(false)
    }
    document.addEventListener('mousedown', handleOutsideClick)
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [sessionMenuOpen])

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
      const [outletResult, itemResult, submissionResult] = await Promise.all([
        supabase.from('outlets').select('id, name').in('id', ids).order('name'),
        supabase.from('inventaris_master_items').select('id, section, subsection, name, mode, target_qty, target_min, target_max, unit, sort_order').order('sort_order'),
        supabase.from('inventaris_submissions').select('outlet_id').in('outlet_id', ids),
      ])
      if (!cancelled) {
        if (outletResult.error || itemResult.error) {
          setMessage({ type: 'error', text: outletResult.error?.message ?? itemResult.error?.message ?? 'Gagal memuat data' })
        } else {
          const nextOutlets = (outletResult.data ?? []) as Outlet[]
          const nextItems = (itemResult.data ?? []) as MasterItem[]
          const initialOutletId = editOutletId && nextOutlets.some((outlet) => outlet.id === editOutletId)
            ? editOutletId
            : nextOutlets[0]?.id ?? ''
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
          setSavedOutletIds(new Set((submissionResult.data ?? []).map((row: { outlet_id: string }) => row.outlet_id)))
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
  }, [editOutletId, staffId, supabase])

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
  const completedOutlets = outlets.filter((outlet) => savedOutletIds.has(outlet.id))
  const allPhotos = items.length > 0 && items.every((item) => {
    const draft = drafts[item.id]
    return draft?.photo ? Boolean(draft.uploadedPhotoPath) : Boolean(draft?.uploadedPhotoPath || draft?.existingPhotoPath)
  })
  const photoUploadsPending = items.some((item) => Boolean(drafts[item.id]?.photo && !drafts[item.id]?.uploadedPhotoPath))
  const allFieldsValid = items.length > 0 && items.every((item) => {
    const draft = drafts[item.id]
    const quantityValid = item.mode === 'presence' || (draft?.observedQty.trim() !== '' && Number.isFinite(Number(draft?.observedQty)))
    const freezerNotesValid = !isFreezerItem(item) || Boolean(draft?.notes.trim())
    return quantityValid && freezerNotesValid
  })

  if (completedSubmission) {
    return <SubmissionSuccessScreen outletName={completedSubmission.outletName} updated={completedSubmission.updated} onContinue={() => {
      setCompletedSubmission(null)
      if (editOutletId) router.push('/dashboard')
    }} />
  }

  function updateDraft(itemId: string, patch: Partial<Draft>) {
    setDrafts((current) => ({ ...current, [itemId]: { ...emptyDraft(), ...current[itemId], ...patch } }))
  }

  async function handleOutletChange(nextOutletId: string) {
    if (editOutletId || !nextOutletId || nextOutletId === selectedOutletId || !staffId || switchingOutlet) return
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
      setMessage({ type: 'error', text: !allPhotos ? 'Foto wajib diisi untuk setiap item sebelum dikirim.' : 'Lengkapi jumlah item dan catatan wajib freezer sebelum dikirim.' })
      return
    }
    setSubmitting(true)
    try {
      const formData = new FormData()
      const detailRows: Array<Record<string, string | number | boolean | null>> = []
      for (const item of items) {
        const draft = drafts[item.id] ?? emptyDraft()
        if (draft.photo && !draft.uploadedPhotoPath) throw new Error(`Foto ${item.name} masih diproses server.`)
        if (!draft.uploadedPhotoPath && !draft.existingPhotoPath) throw new Error(`Foto ${item.name} belum dipilih.`)
        detailRows.push({
          master_item_id: item.id,
          observed_qty: item.mode === 'presence' ? null : Number(draft.observedQty),
          is_present: item.mode === 'presence' ? draft.isPresent : null,
          kondisi: draft.condition,
          catatan: draft.notes.trim() || null,
          photo_path: draft.uploadedPhotoPath ?? draft.existingPhotoPath ?? null,
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
      setSavedOutletIds((current) => new Set([...current, selectedOutletId]))
      setDraftStatus('idle')
      setMessage(null)
      setCompletedSubmission({ outletName: selectedOutlet?.name ?? 'outlet', updated: Boolean(result?.updated) })
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
          <div ref={sessionMenuRef} className="relative">
            <button type="button" aria-haspopup="menu" aria-expanded={sessionMenuOpen} onClick={() => setSessionMenuOpen((current) => !current)} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-600 outline-none transition hover:bg-slate-50 focus:border-[#f29744] focus:ring-2 focus:ring-orange-100"><LogOut size={16} /> Menu <ChevronDown size={16} className={`transition-transform ${sessionMenuOpen ? 'rotate-180' : ''}`} /></button>
            {sessionMenuOpen && <div role="menu" className="absolute right-0 top-[calc(100%+8px)] z-50 w-52 rounded-2xl border border-orange-100 bg-white p-1.5 shadow-xl shadow-orange-950/10">
              <button type="button" role="menuitem" onClick={() => { setSessionMenuOpen(false); window.location.href = process.env.NEXT_PUBLIC_PORTAL_URL || 'https://app.sukashawarma.com' }} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-slate-700 transition hover:bg-orange-50 hover:text-[#701604]"><ExternalLink size={16} className="text-[#f29744]" /> Kembali ke portal</button>
              <button type="button" role="menuitem" onClick={() => { setSessionMenuOpen(false); void signOut() }} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-red-700 transition hover:bg-red-50"><LogOut size={16} /> Keluar dari akun</button>
            </div>}
          </div>
        </div>
      </header>
      <div className="mx-auto max-w-6xl space-y-5 px-4 pt-6 sm:px-8">
        <section className="rounded-3xl bg-[#701604] p-5 text-white shadow-lg sm:p-7"><p className="text-sm text-orange-100">Halo, {outletStaff.name}</p><h2 className="mt-1 text-2xl font-extrabold">{editOutletId ? `Edit inventaris ${selectedOutlet?.name ?? 'outlet'}` : 'Data inventaris outlet'}</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-orange-100">Catat setiap aset sesuai kondisi sebenarnya. Setiap item wajib difoto. Data tersimpan sebagai database inventaris dan dapat diperbarui jika ada perubahan.</p></section>
        {editOutletId && <button onClick={() => router.push('/dashboard')} className="inline-flex items-center gap-2 rounded-xl border border-orange-200 bg-white px-4 py-2 text-sm font-bold text-[#701604] shadow-sm"><ArrowLeft size={16} /> Kembali ke daftar outlet</button>}
        {!editOutletId && <section className="rounded-2xl border border-orange-100 bg-white p-4 shadow-sm sm:p-5"><label className="mb-2 flex items-center gap-2 text-sm font-bold text-[#400a07]"><Store size={17} /> Pilih outlet</label><CustomSelect value={selectedOutletId} disabled={switchingOutlet} ariaLabel="Pilih outlet" options={outlets.map((outlet) => ({ value: outlet.id, label: outlet.name }))} onChange={(value) => { void handleOutletChange(value) }} /><p className="mt-2 text-xs text-slate-500">{switchingOutlet ? 'Memuat data outlet...' : draftStatus === 'saving' ? 'Menyimpan draft...' : draftStatus === 'saved' ? 'Data/draft tersimpan otomatis di perangkat ini.' : 'Isian dan foto tersimpan otomatis di perangkat ini.'}</p><button type="button" disabled={!selectedOutletId || switchingOutlet} onClick={() => router.push(`/dashboard/edit/${selectedOutletId}`)} className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#701604] px-4 py-3 text-sm font-extrabold text-white transition hover:bg-[#5c1203] disabled:cursor-not-allowed disabled:opacity-50">Mulai isi inventaris <ArrowLeft size={16} className="rotate-180" /></button></section>}
        {!editOutletId && completedOutlets.length > 0 && <section className="rounded-3xl border border-green-200 bg-green-50/70 p-5 shadow-sm"><div className="flex items-center justify-between gap-3"><div><h2 className="font-extrabold text-green-900">Outlet sudah tersimpan</h2><p className="mt-1 text-xs text-green-700">Klik kartu untuk membuka halaman edit inventaris outlet.</p></div><span className="rounded-full bg-green-100 px-3 py-1 text-xs font-bold text-green-700">{completedOutlets.length} outlet</span></div><div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{completedOutlets.map((outlet) => <button key={outlet.id} onClick={() => router.push(`/dashboard/edit/${outlet.id}`)} className="rounded-2xl border border-green-200 bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-green-400"><div className="flex items-start justify-between gap-3"><div><p className="text-sm font-extrabold text-[#400a07]">{outlet.name}</p><p className="mt-1 text-xs text-green-700">Inventaris tersimpan</p></div><span className="rounded-lg bg-green-100 px-2 py-1 text-[10px] font-bold text-green-700">EDIT</span></div></button>)}</div></section>}
        {message && <div className={`rounded-2xl border p-4 text-sm font-semibold ${message.type === 'success' ? 'border-green-200 bg-green-50 text-green-700' : 'border-red-200 bg-red-50 text-red-700'}`}>{message.text}</div>}
        {editOutletId && <>
          {Object.entries(groups).map(([subsection, group]) => <section key={subsection} className="overflow-hidden rounded-3xl border border-orange-100 bg-white shadow-sm"><div className="border-b border-orange-100 bg-orange-50/70 px-5 py-4"><h2 className="font-extrabold text-[#400a07]">{subsection}</h2><p className="mt-1 text-xs text-slate-500">{group.length} item · foto wajib per item</p></div><div className="divide-y divide-slate-100">{group.map((item) => { const draft = drafts[item.id] ?? emptyDraft(); const result = evaluation(item, draft); const freezer = isFreezerItem(item); return <article key={item.id} className="p-5"><div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between"><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h3 className="font-bold text-slate-800">{item.name}</h3><span className={`rounded-full px-2 py-1 text-[10px] font-bold uppercase ${result === 'sesuai' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>{result.replace('_', ' ')}</span>{freezer && <span className="rounded-full bg-red-50 px-2 py-1 text-[10px] font-bold uppercase text-red-700">Catatan wajib</span>}</div><p className="mt-1 text-xs font-medium text-slate-500">{freezer ? 'Catat total unit dan ukuran freezer yang tersedia (400L, 600L, atau 750L).' : targetLabel(item)}</p><div className="mt-4 flex flex-wrap items-center gap-3">{item.mode === 'presence' ? <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={draft.isPresent} onChange={(event) => updateDraft(item.id, { isPresent: event.target.checked, condition: event.target.checked ? draft.condition : 'tidak_ada' })} className="h-5 w-5 accent-[#701604]" /> Barang tersedia</label> : <label className="flex items-center gap-2 text-sm font-semibold text-slate-600">Jumlah<input type="number" min="0" step="0.01" value={draft.observedQty} onChange={(event) => updateDraft(item.id, { observedQty: event.target.value })} className="w-28 rounded-xl border border-slate-200 px-3 py-2 text-sm" />{item.unit}</label>}<label className="flex items-center gap-2 text-sm text-slate-600">Kondisi<CustomSelect value={draft.condition} ariaLabel={`Kondisi ${item.name}`} options={[{ value: 'baik', label: 'Baik' }, { value: 'perlu_perbaikan', label: 'Perlu perbaikan' }, { value: 'rusak', label: 'Rusak' }, { value: 'tidak_ada', label: 'Tidak ada' }]} onChange={(value) => updateDraft(item.id, { condition: value as Condition })} /></label></div><input value={draft.notes} onChange={(event) => updateDraft(item.id, { notes: event.target.value })} placeholder={freezer ? 'Wajib: contoh “400L 1 unit, 600L 1 unit, 750L tidak ada; kondisi baik”' : 'Catatan item (opsional)'} className={`mt-3 w-full rounded-xl border px-3 py-2 text-sm outline-none focus:border-[#f29744] ${freezer && !draft.notes.trim() ? 'border-red-200 bg-red-50/30' : 'border-slate-200'}`} />{freezer && <p className="mt-1 text-xs text-red-600">Tuliskan ukuran freezer dan kondisinya agar data aset lengkap.</p>}</div><PhotoPicker outletId={selectedOutletId} itemName={item.name} itemId={item.id} photo={draft.photo} uploadedPhotoPath={draft.uploadedPhotoPath} uploadedPhotoUrl={draft.uploadedPhotoUrl} existingPhotoUrl={draft.existingPhotoUrl} onPhotoChange={(photo) => updateDraft(item.id, { photo })} onPhotoUploaded={(path, url) => updateDraft(item.id, { uploadedPhotoPath: path ?? undefined, uploadedPhotoUrl: url ?? null })} /></div></article> })}</div></section>)}
          <button disabled={submitting || photoUploadsPending || !allPhotos || !allFieldsValid || !items.length} onClick={() => void submit()} className="w-full rounded-2xl bg-[#f29744] px-5 py-4 text-sm font-extrabold text-white shadow-lg shadow-orange-200 transition hover:bg-[#e6842f] disabled:cursor-not-allowed disabled:opacity-50">{submitting ? 'Menyimpan data inventaris...' : photoUploadsPending ? 'Menunggu foto selesai disimpan...' : savedOutletIds.has(selectedOutletId) ? `Simpan perubahan ${selectedOutlet?.name ?? ''}` : `Simpan inventaris ${selectedOutlet?.name ?? ''}`}</button>
        </>}
      </div>
    </main>
  )
}
