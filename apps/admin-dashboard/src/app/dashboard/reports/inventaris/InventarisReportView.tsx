'use client'

import { useEffect, useMemo, useState } from 'react'
import { AlertCircle, Camera, CheckCircle2, ClipboardList, Clock3, ImageOff, Package, Store } from 'lucide-react'
import { createClient } from '@/lib/supabase'
import { PageHeader } from '@/components/ui'

const PHOTO_BUCKET = process.env.NEXT_PUBLIC_INVENTARIS_PHOTO_BUCKET || 'inventaris-foto'

type UnknownRecord = Record<string, unknown>

type ReportItem = {
  id: string
  name: string
  category: string
  status: string
  quantity: string
  targetQuantity: string
  photoUrl: string | null
}

type ReportSubmission = {
  id: string
  outletId: string
  outletName: string
  submittedBy: string
  submittedAt: string | null
  items: ReportItem[]
}

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

async function resolvePhotoUrl(supabase: ReturnType<typeof createClient>, value: unknown): Promise<string | null> {
  const path = normalizePhotoPath(value)
  if (!path) return null
  if (/^https?:\/\//i.test(path)) return path

  const { data, error } = await supabase.storage.from(PHOTO_BUCKET).createSignedUrl(path, 60 * 60)
  return error ? null : data?.signedUrl ?? null
}

function badgeClass(status: string): string {
  switch (statusKind(status)) {
    case 'available': return 'bg-emerald-50 text-emerald-700 border-emerald-200'
    case 'missing': return 'bg-rose-50 text-rose-700 border-rose-200'
    case 'damaged': return 'bg-amber-50 text-amber-700 border-amber-200'
    default: return 'bg-slate-50 text-slate-600 border-slate-200'
  }
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
          const photo = await resolvePhotoUrl(supabase, firstValue(rawItem, [
            'photo_url', 'photo_path', 'image_url', 'image_path', 'photo_storage_path', 'evidence_url',
          ]))
          return {
            id: asText(firstValue(rawItem, ['id', 'item_id']), `${id}-${index}`),
            name: asText(firstValue(rawItem, ['item_name', 'name']), masterItems.get(masterId) ?? 'Item inventaris'),
            category: asText(firstValue(rawItem, ['category', 'category_name']), masterCategories.get(masterId) ?? 'Lainnya'),
            status,
            quantity: asText(firstValue(rawItem, ['observed_qty', 'actual_quantity', 'quantity', 'qty', 'count'])) || (rawItem.is_present === true ? 'Ada' : rawItem.is_present === false ? 'Tidak ada' : ''),
            targetQuantity: asText(firstValue(rawItem, ['target_quantity', 'expected_quantity', 'required_quantity', 'target_qty'])) || masterTargets.get(masterId) || '',
            photoUrl: photo,
          }
        }))

        normalizedSubmissions.push({
          id,
          outletId,
          outletName: outletNames.get(outletId) ?? 'Outlet tanpa nama',
          submittedBy: staffNames.get(relationId(firstValue(rawSubmission, ['submitted_by', 'submitted_by_id', 'created_by', 'area_manager_id', 'am_id']))) ?? 'Area Manager',
          submittedAt: asText(firstValue(rawSubmission, ['submitted_at', 'created_at', 'updated_at'])) || null,
          items,
        })
      }

      if (active) {
        setSubmissions(normalizedSubmissions)
        setLoading(false)
      }
    }

    void loadReport()
    return () => { active = false }
  }, [])

  const summary = useMemo(() => {
    const items = submissions.flatMap((submission) => submission.items)
    return {
      outlets: new Set(submissions.map((submission) => submission.outletId)).size,
      items: items.length,
      available: items.filter((item) => statusKind(item.status) === 'available').length,
      missing: items.filter((item) => statusKind(item.status) === 'missing').length,
      photos: items.filter((item) => item.photoUrl).length,
    }
  }, [submissions])

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

          <div className="space-y-5">
            {submissions.map((submission) => <OutletSubmissionCard key={submission.id} submission={submission} />)}
          </div>
        </>
      )}
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

function OutletSubmissionCard({ submission }: { submission: ReportSubmission }) {
  return (
    <section className="overflow-hidden rounded-3xl border border-suka-brown/10 bg-white/85 shadow-sm">
      <div className="flex flex-col gap-3 border-b border-suka-brown/10 bg-suka-cream/40 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-suka-orange/10 text-suka-orange">
            <Store className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h2 className="truncate text-base font-extrabold text-suka-brown">{submission.outletName}</h2>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-suka-ink/60">
              <span className="inline-flex items-center gap-1"><ClipboardList className="h-3.5 w-3.5" /> {submission.items.length} item</span>
              <span className="inline-flex items-center gap-1"><Clock3 className="h-3.5 w-3.5" /> {formatDateTime(submission.submittedAt)}</span>
            </div>
          </div>
        </div>
        <div className="text-left text-xs sm:text-right">
          <div className="font-semibold text-suka-ink/50">Dikirim oleh AM</div>
          <div className="mt-0.5 font-bold text-suka-ink">{submission.submittedBy}</div>
        </div>
      </div>

      {submission.items.length === 0 ? (
        <div className="px-5 py-8 text-center text-sm text-suka-ink/50">Tidak ada detail item pada submission ini.</div>
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
              {submission.items.map((item) => (
                <tr key={item.id} className="align-middle transition-colors hover:bg-suka-cream/20">
                  <td className="px-5 py-3">
                    <div className="font-bold text-suka-ink">{item.name}</div>
                    <div className="mt-0.5 text-[11px] font-semibold uppercase tracking-wide text-suka-ink/45">{item.category}</div>
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
                      <a href={item.photoUrl} target="_blank" rel="noreferrer" className="group block h-14 w-14 overflow-hidden rounded-xl border border-suka-brown/10 bg-suka-cream" aria-label={`Buka foto ${item.name}`}>
                        <img src={item.photoUrl} alt={`Foto ${item.name}`} className="h-full w-full object-cover transition-transform group-hover:scale-105" />
                      </a>
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
