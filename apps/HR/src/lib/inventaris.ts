/**
 * Helper murni laporan inventaris outlet — disalin dari
 * `apps/inventori/src/app/dashboard/reports/InventarisReportView.tsx` agar
 * tampilan & aturan status di HR identik dengan app inventori.
 */

export const INVENTARIS_PHOTO_BUCKET = 'inventaris-foto'

export type InventarisSummary = {
  id: string
  outletId: string
  outletName: string
  submittedBy: string
  createdAt: string | null
  updatedAt: string | null
  itemCount: number
}

export type InventarisItem = {
  id: string
  name: string
  category: string
  sortKey: string
  status: string
  condition: string
  quantity: string
  target: string
  notes: string | null
  purchaseDate: string | null
  price: number | null
  depreciation: number | null
  brand: string | null
  photoPath: string | null
}

export type InventarisDetail = InventarisSummary & {
  notes: string | null
  items: InventarisItem[]
}

export const text = (value: unknown, fallback = '') =>
  typeof value === 'string' || typeof value === 'number' ? String(value) : fallback

export const toNumber = (value: unknown) =>
  value === null || value === undefined || value === '' || !Number.isFinite(Number(value)) ? null : Number(value)

export const isAvailable = (status: string) =>
  ['sesuai', 'baik', 'ada', 'available', 'lengkap', 'ok'].includes(status.trim().toLowerCase().replace(/[_-]/g, ' '))

const statusLabels: Record<string, string> = {
  sesuai: 'Sesuai',
  kurang: 'Kurang',
  tidak_ada: 'Tidak ada',
  di_luar_target: 'Di luar target',
}
export const statusLabel = (value: string) => statusLabels[value] ?? value

const conditionLabels: Record<string, string> = { baik: 'Baik', perlu_perbaikan: 'Perlu perbaikan', rusak: 'Rusak', tidak_ada: 'Tidak ada' }
export const conditionTones: Record<string, string> = {
  baik: 'bg-emerald-100 text-emerald-800',
  perlu_perbaikan: 'bg-amber-100 text-amber-800',
  rusak: 'bg-rose-100 text-rose-800',
  tidak_ada: 'bg-slate-200 text-slate-700',
}
export const conditionKey = (value: string) => value.trim().toLowerCase().replace(/[\s-]/g, '_')
export const conditionLabel = (value: string) => conditionLabels[conditionKey(value)] ?? value

export const formatPurchaseDate = (value: string | null) =>
  value ? new Date(value).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : '-'

export const formatDateTime = (value: string | null) => {
  if (!value) return '-'
  const moment = new Date(value)
  if (Number.isNaN(moment.getTime())) return '-'
  const day = moment.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Jakarta' })
  const clock = moment.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' }).replace('.', ':')
  return `${day} · ${clock} WIB`
}

export const formatMoney = (value: number | null) =>
  value === null ? '-' : new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(value)

/**
 * `photo_path` normalnya path bucket; data lama kadang menyimpan signed URL
 * penuh. Kembalikan path bucket bila bisa diekstrak (agar ikut ditandatangani
 * massal), atau `url` apa adanya untuk URL asing.
 */
export function resolvePhotoRef(value: string | null): { path: string } | { url: string } | null {
  const raw = (value ?? '').trim()
  if (!raw) return null
  if (!raw.startsWith('http')) return { path: raw }
  try {
    const parsed = new URL(raw)
    const marker = `/storage/v1/object/sign/${INVENTARIS_PHOTO_BUCKET}/`
    const index = parsed.pathname.indexOf(marker)
    if (index >= 0) return { path: decodeURIComponent(parsed.pathname.slice(index + marker.length)) }
  } catch {
    /* bukan URL valid — pakai apa adanya */
  }
  return { url: raw }
}

/** Pilih laporan terbaru per outlet (satu outlet = satu data inventaris aktif). */
export function latestPerOutlet<T extends { outletId: string; updatedAt: string | null; createdAt: string | null }>(rows: T[]): T[] {
  const stamp = (row: T) => +new Date(row.updatedAt ?? row.createdAt ?? 0)
  const latest = new Map<string, T>()
  for (const row of [...rows].sort((a, b) => stamp(b) - stamp(a))) {
    if (row.outletId && !latest.has(row.outletId)) latest.set(row.outletId, row)
  }
  return [...latest.values()]
}
