'use client'

import { useEffect, useMemo, useState } from 'react'
import { AlertCircle, Camera, CheckCircle2, ChevronDown, ClipboardList, Clock3, ImageOff, Package, Search, Store, X, ZoomIn } from 'lucide-react'
import { createClient } from '@/lib/supabase'
import { PageHeader } from '@/components/ui'

type UnknownRecord = Record<string, unknown>

type ReportItem = {
  id: string
  name: string
  category: string
  status: string
  quantity: string
  targetQuantity: string
  notes: string | null
  purchaseDate: string | null
  price: number | null
  depreciationRate: number | null
  brand: string | null
  photoUrl: string | null
}

type ReportSubmission = {
  id: string
  outletId: string
  outletName: string
  submittedBy: string
  submittedAt: string | null
  notes: string | null
  items: ReportItem[]
}

type StatusFilter = 'all' | 'missing' | 'complete'

type Lookup = Map<string, string>

function asRecord(value: unknown): UnknownRecord {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as UnknownRecord : {}
}

function firstValue(row: UnknownRecord, keys: string[]): unknown {
  for (const key of keys) {
    if (row[key] !== undefined && row[key] !== null && row[key] !== '') return row[key]
  }
  return null
}

function asText(value: unknown, fallback = ''): string {
  if (typeof value === 'string' || typeof value === 'number') return String(value)
  return fallback
}

function relationId(value: unknown): string {
  if (Array.isArray(value)) return relationId(value[0])
  if (value && typeof value === 'object') {
    return asText(firstValue(asRecord(value), ['id', 'uuid']))
  }
  return asText(value)
}

function titleCaseStatus(value: string): string {
  return value
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function statusKind(status: string): 'available' | 'missing' | 'damaged' | 'other' {
  const normalized = status.trim().toLowerCase().replace(/[_-]+/g, ' ')
  if (['ada', 'available', 'found', 'ok', 'baik', 'sesuai', 'lengkap'].includes(normalized)) return 'available'
  if (['tidak ada', 'missing', 'not found', 'not available', 'unavailable', 'tidak ditemukan'].includes(normalized)) return 'missing'
  if (['rusak', 'damaged', 'broken', 'perlu perbaikan', 'kurang', 'di luar target'].includes(normalized)) return 'damaged'
  return 'other'
}

function statusLabel(status: string): string {
  if (!status) return 'Belum dicatat'
  return titleCaseStatus(status)
}

function formatDateTime(value: string | null): string {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).replace(/\./g, ':')
}

function normalizePhotoPath(value: unknown): string | null {
  const path = asText(value).trim()
  return path || null
}

function resolvePhotoUrl(value: unknown): string | null {
  const path = normalizePhotoPath(value)
  if (!path) return null
  if (/^https?:\/\//i.test(path)) {
    // Older rows may contain an expired Supabase signed URL. Convert it back
    // to a storage path so the authenticated server proxy can sign it again.
    try {
      const url = new URL(path)
      const marker = '/storage/v1/object/sign/inventaris-foto/'
      const markerIndex = url.pathname.indexOf(marker)
      if (markerIndex >= 0) {
        const storagePath = decodeURIComponent(url.pathname.slice(markerIndex + marker.length))
        if (storagePath) return `/api/inventaris/photo?path=${encodeURIComponent(storagePath)}`
      }
    } catch {
      // Keep the original URL as a last-resort fallback below.
    }
    return path
  }
  return `/api/inventaris/photo?path=${encodeURIComponent(path)}`
}

function asNullableNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

function formatCurrency(value: number | null): string | null {
  if (value === null || !Number.isFinite(value)) return null
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(value)
}

function badgeClass(status: string): string {
  switch (statusKind(status)) {
    case 'available': return 'bg-emerald-50 text-emerald-700 border-emerald-200'
    case 'missing': return 'bg-rose-50 text-rose-700 border-rose-200'
    case 'damaged': return 'bg-amber-50 text-amber-700 border-amber-200'
    default: return 'bg-slate-50 text-slate-600 border-slate-200'
  }
}

function isCompleteStatus(status: string): boolean {
  return statusKind(status) === 'available'
}

function SkeletonReport() {
  return (
    <div className="space-y-5 animate-pulse" aria-label="Memuat laporan inventaris">
      <div className="h-24 rounded-3xl bg-white/70 border border-suka-brown/10" />
      <div className="h-16 rounded-2xl bg-white/70 border border-suka-brown/10" />
      <div className="h-72 rounded-3xl bg-white/70 border border-suka-brown/10" />
    </div>
  )
}

function EmptyReport() {
  return (
    <div className="rounded-3xl border border-dashed border-suka-brown/20 bg-white/70 px-6 py-16 text-center shadow-sm">
      <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-suka-cream text-suka-brown/40">
        <ClipboardList className="h-8 w-8" />
      </div>
      <h2 className="text-lg font-bold text-suka-brown">Belum ada laporan inventaris</h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-suka-ink/60">
        Data akan tampil di sini setelah Area Manager mengirim pemeriksaan inventaris outlet.
      </p>
    </div>
  )
}

export default function InventarisReportView() {
  const [submissions, setSubmissions] = useState<ReportSubmission[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [outletFilter, setOutletFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [search, setSearch] = useState('')
  const [openSubmissionIds, setOpenSubmissionIds] = useState<Set<string>>(new Set())
  const [photoModal, setPhotoModal] = useState<{ url: string; name: string } | null>(null)

  useEffect(() => {
    let active = true
    const supabase = createClient()

    async function loadReport() {
      setLoading(true)
      setError(null)

      const [submissionsResult, itemsResult, masterResult, outletsResult, staffResult] = await Promise.all([
        supabase.from('inventaris_submissions').select('*').limit(500),
        supabase.from('inventaris_submission_items').select('*').limit(5000),
        supabase.from('inventaris_master_items').select('*').limit(1000),
        supabase.from('outlets').select('id, name').limit(200),
        supabase.from('outlet_staff').select('id, name, role').limit(1000),
      ])

      const queryError = submissionsResult.error || itemsResult.error || masterResult.error || outletsResult.error || staffResult.error
      if (queryError) {
        if (active) {
          setError(queryError.message)
          setLoading(false)
        }
        return
      }

      const outletNames: Lookup = new Map()
      for (const rawOutlet of outletsResult.data ?? []) {
        const outlet = asRecord(rawOutlet)
        const id = asText(outlet.id)
        if (id) outletNames.set(id, asText(outlet.name, 'Outlet tanpa nama'))
      }

      const staffNames: Lookup = new Map()
      for (const rawStaff of staffResult.data ?? []) {
        const staff = asRecord(rawStaff)
        const id = asText(staff.id)
        if (id) staffNames.set(id, asText(staff.name, 'AM tanpa nama'))
      }

      const masterItems: Lookup = new Map()
      const masterCategories: Lookup = new Map()
      const masterTargets: Lookup = new Map()
      for (const rawMaster of masterResult.data ?? []) {
        const master = asRecord(rawMaster)
        const id = asText(firstValue(master, ['id', 'item_id']))
        if (!id) continue
        masterItems.set(id, asText(firstValue(master, ['name', 'item_name', 'label']), 'Item inventaris'))
        masterCategories.set(id, asText(firstValue(master, ['category', 'category_name', 'group', 'subsection']), 'Lainnya'))
        const mode = asText(master.mode)
        const min = asText(master.target_min)
        const max = asText(master.target_max)
        const unit = asText(master.unit)
        masterTargets.set(id, mode === 'range' && min && max ? `${min}–${max} ${unit}`.trim() : asText(firstValue(master, ['target_quantity', 'expected_quantity', 'required_quantity', 'target_qty'])))
      }

      const rawItemsBySubmission = new Map<string, UnknownRecord[]>()
      for (const rawItem of itemsResult.data ?? []) {
        const item = asRecord(rawItem)
        const submissionId = relationId(firstValue(item, ['submission_id', 'inventaris_submission_id']))
        if (!submissionId) continue
        const current = rawItemsBySubmission.get(submissionId) ?? []
        current.push(item)
        rawItemsBySubmission.set(submissionId, current)
      }

      const rawSubmissions = [...(submissionsResult.data ?? [])]
        .map(asRecord)
        .sort((a, b) => {
          const aTime = new Date(asText(firstValue(a, ['submitted_at', 'created_at', 'updated_at']))).getTime()
          const bTime = new Date(asText(firstValue(b, ['submitted_at', 'created_at', 'updated_at']))).getTime()
          return bTime - aTime
        })

      const normalizedSubmissions: ReportSubmission[] = []
      for (const rawSubmission of rawSubmissions) {
        const id = asText(firstValue(rawSubmission, ['id', 'submission_id']))
        const outletId = relationId(firstValue(rawSubmission, ['outlet_id', 'outlet']))
        if (!id || !outletId) continue

        const rawItems = rawItemsBySubmission.get(id) ?? []
        const items = await Promise.all(rawItems.map(async (rawItem, index): Promise<ReportItem> => {
          const masterId = relationId(firstValue(rawItem, ['master_item_id', 'inventaris_master_item_id', 'item_id', 'master_item']))
          const status = asText(firstValue(rawItem, ['status_penilaian', 'status', 'availability_status', 'condition', 'kondisi']))
          const photo = resolvePhotoUrl(firstValue(rawItem, [
            // photo_path is canonical and photo_url can be an expired signed URL.
            'photo_path', 'photo_storage_path', 'photo_url', 'image_path', 'image_url', 'evidence_url',
          ]))
          return {
            id: asText(firstValue(rawItem, ['id', 'item_id']), `${id}-${index}`),
            name: asText(firstValue(rawItem, ['item_name', 'name']), masterItems.get(masterId) ?? 'Item inventaris'),
            category: asText(firstValue(rawItem, ['category', 'category_name']), masterCategories.get(masterId) ?? 'Lainnya'),
            status,
            quantity: asText(firstValue(rawItem, ['observed_qty', 'actual_quantity', 'quantity', 'qty', 'count'])) || (rawItem.is_present === true ? 'Ada' : rawItem.is_present === false ? 'Tidak ada' : ''),
            targetQuantity: asText(firstValue(rawItem, ['target_quantity', 'expected_quantity', 'required_quantity', 'target_qty'])) || masterTargets.get(masterId) || '',
            notes: asText(firstValue(rawItem, ['catatan', 'notes'])) || null,
            purchaseDate: asText(firstValue(rawItem, ['purchase_date', 'tanggal_pembelian'])) || null,
            price: asNullableNumber(firstValue(rawItem, ['purchase_price', 'harga'])),
            depreciationRate: asNullableNumber(firstValue(rawItem, ['depreciation_rate', 'depresiasi'])),
            brand: asText(firstValue(rawItem, ['brand', 'merk'])) || null,
            photoUrl: photo,
          }
        }))

        normalizedSubmissions.push({
          id,
          outletId,
          outletName: outletNames.get(outletId) ?? 'Outlet tanpa nama',
          submittedBy: staffNames.get(relationId(firstValue(rawSubmission, ['submitted_by', 'submitted_by_id', 'created_by', 'area_manager_id', 'am_id']))) ?? 'Area Manager',
          submittedAt: asText(firstValue(rawSubmission, ['submitted_at', 'created_at', 'updated_at'])) || null,
          notes: asText(firstValue(rawSubmission, ['notes', 'catatan'])) || null,
          items,
        })
      }

      // Satu outlet hanya memiliki satu kartu: gunakan laporan terbaru jika
      // terdapat data historis/duplikat dari proses submit sebelumnya.
      const latestByOutlet = new Map<string, ReportSubmission>()
      for (const submission of normalizedSubmissions) {
        if (!latestByOutlet.has(submission.outletId)) latestByOutlet.set(submission.outletId, submission)
      }

      if (active) {
        setSubmissions([...latestByOutlet.values()])
        setLoading(false)
      }
    }

    void loadReport()
    return () => { active = false }
  }, [])

  useEffect(() => {
    if (!photoModal) return
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setPhotoModal(null)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [photoModal])

  const summary = useMemo(() => {
    const items = submissions
      .filter((submission) => outletFilter === 'all' || submission.outletId === outletFilter)
      .flatMap((submission) => submission.items)
    return {
      outlets: new Set(submissions.map((submission) => submission.outletId)).size,
      items: items.length,
      available: items.filter((item) => statusKind(item.status) === 'available').length,
      missing: items.filter((item) => statusKind(item.status) === 'missing').length,
      photos: items.filter((item) => item.photoUrl).length,
    }
  }, [outletFilter, submissions])

  const filteredSubmissions = useMemo(() => {
    const query = search.trim().toLowerCase()
    return submissions
      .filter((submission) => outletFilter === 'all' || submission.outletId === outletFilter)
      .filter((submission) => !query || submission.outletName.toLowerCase().includes(query) || submission.submittedBy.toLowerCase().includes(query))
  }, [outletFilter, search, submissions])

  function toggleSubmission(submissionId: string) {
    setOpenSubmissionIds((current) => {
      const next = new Set(current)
      if (next.has(submissionId)) next.delete(submissionId)
      else next.add(submissionId)
      return next
    })
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Inventaris Outlet"
        description="Laporan pemeriksaan aset tetap terbaru per outlet dari Area Manager."
        icon={ClipboardList}
      />

      {loading ? <SkeletonReport /> : error ? (
        <div className="rounded-3xl border border-rose-200 bg-rose-50 px-6 py-12 text-center text-rose-700 shadow-sm">
          <AlertCircle className="mx-auto mb-3 h-8 w-8" />
          <h2 className="font-bold">Gagal memuat laporan inventaris</h2>
          <p className="mt-2 text-sm">{error}</p>
        </div>
      ) : submissions.length === 0 ? <EmptyReport /> : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            <SummaryTile icon={Store} label="Outlet" value={summary.outlets} />
            <SummaryTile icon={Package} label="Total item" value={summary.items} />
            <SummaryTile icon={CheckCircle2} label="Tersedia" value={summary.available} tone="green" />
            <SummaryTile icon={AlertCircle} label="Tidak ada" value={summary.missing} tone="red" />
            <SummaryTile icon={Camera} label="Dengan foto" value={`${summary.photos}/${summary.items}`} tone="orange" />
          </div>

          <div className="rounded-3xl border border-suka-brown/10 bg-white/80 p-4 shadow-sm sm:p-5">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="relative min-w-0 flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-suka-ink/35" />
                <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Cari outlet atau Area Manager..." className="w-full rounded-xl border border-suka-brown/10 bg-white py-2.5 pl-10 pr-3 text-sm text-suka-ink outline-none transition focus:border-suka-orange" />
              </div>
              <label className="flex items-center gap-2 text-sm font-semibold text-suka-ink/65">
                <Store className="h-4 w-4 text-suka-orange" />
                <select value={outletFilter} onChange={(event) => setOutletFilter(event.target.value)} className="min-w-52 rounded-xl border border-suka-brown/10 bg-white px-3 py-2.5 text-sm text-suka-ink outline-none focus:border-suka-orange">
                  <option value="all">Semua outlet</option>
                  {[...new Map(submissions.map((submission) => [submission.outletId, submission.outletName])).entries()].map(([id, name]) => <option key={id} value={id}>{name}</option>)}
                </select>
              </label>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-2" role="tablist" aria-label="Filter status inventaris">
              {([['all', 'Semua'], ['missing', 'Kurang'], ['complete', 'Lengkap']] as const).map(([value, label]) => {
                const count = value === 'all' ? summary.items : value === 'complete' ? summary.available : summary.items - summary.available
                return <button key={value} type="button" role="tab" aria-selected={statusFilter === value} onClick={() => setStatusFilter(value)} className={`rounded-xl px-4 py-2 text-sm font-bold transition ${statusFilter === value ? 'bg-suka-brown text-white shadow-sm' : 'bg-suka-cream/60 text-suka-ink/60 hover:bg-suka-cream'}`}>{label}<span className={`ml-2 rounded-full px-1.5 py-0.5 text-[10px] ${statusFilter === value ? 'bg-white/15 text-white' : 'bg-white text-suka-ink/50'}`}>{count}</span></button>
              })}
            </div>
          </div>

          <div className="space-y-4">
            {filteredSubmissions.map((submission) => <OutletSubmissionCard key={submission.id} submission={submission} statusFilter={statusFilter} isOpen={openSubmissionIds.has(submission.id)} onToggle={() => toggleSubmission(submission.id)} onPhotoClick={(photo) => setPhotoModal(photo)} />)}
            {filteredSubmissions.length === 0 && <div className="rounded-3xl border border-dashed border-suka-brown/20 bg-white/70 px-6 py-12 text-center text-sm text-suka-ink/55">Tidak ada outlet yang sesuai dengan filter.</div>}
          </div>
        </>
      )}

      {photoModal && <div className="fixed inset-0 z-50 flex items-center justify-center bg-suka-ink/70 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label={`Foto ${photoModal.name}`} onClick={() => setPhotoModal(null)}>
        <div className="relative max-h-[90vh] max-w-4xl overflow-hidden rounded-3xl bg-white p-2 shadow-2xl" onClick={(event) => event.stopPropagation()}>
          <button type="button" onClick={() => setPhotoModal(null)} className="absolute right-4 top-4 z-10 rounded-full bg-suka-ink/70 p-2 text-white transition hover:bg-suka-ink" aria-label="Tutup foto"><X className="h-5 w-5" /></button>
          <img src={photoModal.url} alt={`Foto ${photoModal.name}`} className="max-h-[82vh] max-w-full rounded-2xl object-contain" />
          <p className="px-3 pb-2 pt-2 text-center text-sm font-bold text-suka-brown">{photoModal.name}</p>
        </div>
      </div>}
    </div>
  )
}

function SummaryTile({
  icon: Icon,
  label,
  value,
  tone = 'brown',
}: {
  icon: typeof Store
  label: string
  value: number | string
  tone?: 'brown' | 'green' | 'red' | 'orange'
}) {
  const tones = {
    brown: 'text-suka-brown',
    green: 'text-emerald-700',
    red: 'text-rose-700',
    orange: 'text-suka-orange',
  }
  return (
    <div className="rounded-2xl border border-suka-brown/10 bg-white/80 p-4 shadow-sm">
      <div className={`mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wide ${tones[tone]}`}>
        <Icon className="h-4 w-4" /> {label}
      </div>
      <div className="text-2xl font-extrabold text-suka-ink">{value}</div>
    </div>
  )
}

function OutletSubmissionCard({ submission, statusFilter, isOpen, onToggle, onPhotoClick }: {
  submission: ReportSubmission
  statusFilter: StatusFilter
  isOpen: boolean
  onToggle: () => void
  onPhotoClick: (photo: { url: string; name: string }) => void
}) {
  const completeCount = submission.items.filter((item) => isCompleteStatus(item.status)).length
  const missingCount = submission.items.length - completeCount
  const visibleItems = submission.items.filter((item) => statusFilter === 'all' || (statusFilter === 'complete' && isCompleteStatus(item.status)) || (statusFilter === 'missing' && !isCompleteStatus(item.status)))
  return (
    <section className="relative overflow-visible rounded-3xl border border-suka-brown/10 bg-white/85 shadow-sm">
      <button type="button" onClick={onToggle} aria-expanded={isOpen} className="sticky top-0 z-20 flex w-full flex-col gap-3 border-b border-suka-brown/10 bg-suka-cream/95 px-5 py-5 text-left shadow-sm backdrop-blur-sm transition hover:bg-suka-cream sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-suka-orange/10 text-suka-orange">
            <Store className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h2 className="truncate text-base font-extrabold text-suka-brown">{submission.outletName}</h2>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-suka-ink/60">
              <span className="inline-flex items-center gap-1"><ClipboardList className="h-3.5 w-3.5" /> {submission.items.length} item</span>
              <span className="inline-flex items-center gap-1"><Clock3 className="h-3.5 w-3.5" /> {formatDateTime(submission.submittedAt)}</span>
              <span className="font-bold text-emerald-700">{completeCount} lengkap</span>
              {missingCount > 0 && <span className="font-bold text-amber-700">{missingCount} kurang</span>}
            </div>
          </div>
        </div>
        <div className="flex items-center justify-between gap-4 sm:justify-end">
          <div className="text-left text-xs sm:text-right">
            <div className="font-semibold text-suka-ink/50">Dikirim oleh AM</div>
            <div className="mt-0.5 font-bold text-suka-ink">{submission.submittedBy}</div>
          </div>
          <ChevronDown className={`h-5 w-5 shrink-0 text-suka-ink/45 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </div>
      </button>

      {submission.notes && <div className="border-b border-suka-brown/10 bg-white px-5 py-3 text-sm text-suka-ink/75 sm:px-6">
        <span className="font-bold text-suka-brown">Catatan pemeriksaan:</span> {submission.notes}
      </div>}

      {!isOpen ? null : visibleItems.length === 0 ? (
        <div className="px-5 py-8 text-center text-sm text-suka-ink/50">Tidak ada detail item pada filter ini.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="border-b border-suka-brown/10 bg-white text-[11px] uppercase tracking-wide text-suka-ink/50">
              <tr>
                <th className="px-5 py-3 font-bold">Item</th>
                <th className="px-4 py-3 font-bold">Status</th>
                <th className="px-4 py-3 text-right font-bold">Jumlah / target</th>
                <th className="px-4 py-3 font-bold">Foto bukti</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-suka-brown/10">
              {visibleItems.map((item) => (
                <tr key={item.id} className="align-middle transition-colors hover:bg-suka-cream/20">
                  <td className="px-5 py-3">
                    <div className="font-bold text-suka-ink">{item.name}</div>
                    <div className="mt-0.5 text-[11px] font-semibold uppercase tracking-wide text-suka-ink/45">{item.category}</div>
                    {item.notes && <div className="mt-2 max-w-xl rounded-lg bg-suka-cream/60 px-2.5 py-1.5 text-xs leading-5 text-suka-ink/70"><span className="font-bold text-suka-brown">Catatan:</span> {item.notes}</div>}
                    {(item.purchaseDate || item.price !== null || item.depreciationRate !== null || item.brand) && <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-suka-ink/65">
                      {item.purchaseDate && <span><b className="text-suka-brown">Dibeli:</b> {item.purchaseDate}</span>}
                      {item.brand && <span><b className="text-suka-brown">Merek:</b> {item.brand}</span>}
                      {item.price !== null && <span><b className="text-suka-brown">Harga:</b> {formatCurrency(item.price)}</span>}
                      {item.depreciationRate !== null && <span><b className="text-suka-brown">Depresiasi:</b> {item.depreciationRate}%/tahun</span>}
                    </div>}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-lg border px-2.5 py-1 text-xs font-bold ${badgeClass(item.status)}`}>
                      {statusLabel(item.status)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-suka-ink/70">
                    {item.quantity || '-'}{item.targetQuantity ? ` / ${item.targetQuantity}` : ''}
                  </td>
                  <td className="px-4 py-3">
                    {item.photoUrl ? (
                      <button type="button" onClick={() => onPhotoClick({ url: item.photoUrl as string, name: item.name })} className="group relative block h-14 w-14 overflow-hidden rounded-xl border border-suka-brown/10 bg-suka-cream" aria-label={`Lihat foto ${item.name}`}>
                        <img src={item.photoUrl} alt={`Foto ${item.name}`} className="h-full w-full object-cover transition-transform group-hover:scale-105" />
                        <span className="absolute inset-0 grid place-items-center bg-suka-ink/0 text-white opacity-0 transition group-hover:bg-suka-ink/35 group-hover:opacity-100"><ZoomIn className="h-4 w-4" /></span>
                      </button>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-suka-ink/40"><ImageOff className="h-4 w-4" /> Tidak tersedia</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
