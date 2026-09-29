import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase'
import { isTestOutlet } from '@/lib/outletFilters'
import {
  INVENTARIS_PHOTO_BUCKET,
  latestPerOutlet,
  resolvePhotoRef,
  text,
  toNumber,
  type InventarisDetail,
  type InventarisItem,
  type InventarisSummary,
} from '@/lib/inventaris'

type Raw = Record<string, any>

/*
 * Hemat resource DB dibanding versi app inventori:
 *  - Daftar outlet TIDAK menarik baris item sama sekali. Jumlah item dihitung
 *    DB lewat embed `inventaris_submission_items(count)`, nama outlet &
 *    pelapor lewat embed FK — bukan menarik seluruh `outlet_staff` (1.000
 *    baris) dan seluruh `inventaris_submission_items` (ribuan baris, paging).
 *  - Detail hanya memuat SATU laporan terbaru milik outlet yang dibuka,
 *    beserta item & master-nya dalam satu request.
 *  - Foto ditandatangani sekaligus (`createSignedUrls`, 1 request) alih-alih
 *    1 request API + 2 kueri DB per thumbnail.
 *  - Semua di-cache React Query; kembali ke halaman = tanpa request baru.
 */

const SECTION_ORDER = ['interior', 'exterior', 'kamar_mandi', 'utilitas']
const SIGNED_URL_TTL_SECONDS = 60 * 60

function toSummary(row: Raw): InventarisSummary {
  const count = Array.isArray(row.inventaris_submission_items) ? toNumber(row.inventaris_submission_items[0]?.count) : null
  return {
    id: text(row.id),
    outletId: text(row.outlet_id),
    outletName: text(row.outlets?.name, 'Outlet tanpa nama'),
    submittedBy: text(row.outlet_staff?.name, 'Area Manager'),
    createdAt: text(row.created_at) || null,
    updatedAt: text(row.updated_at) || null,
    itemCount: count ?? 0,
  }
}

export function useInventarisReports() {
  const supabase = useMemo(() => createClient(), [])
  return useQuery<InventarisSummary[]>({
    queryKey: ['inventaris-reports'],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      // Satu data inventaris aktif per outlet (submit berikutnya = update),
      // jadi tabel ini kecil (± 1 baris per outlet). Batas 500 = jaga-jaga.
      const { data, error } = await supabase
        .from('inventaris_submissions')
        .select('id, outlet_id, created_at, updated_at, outlets(name), outlet_staff(name), inventaris_submission_items(count)')
        .order('updated_at', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(500)
      if (error) throw error
      const rows = latestPerOutlet((data ?? []).map((row: Raw) => toSummary(row)))
      return rows.filter((row) => !isTestOutlet({ id: row.outletId, name: row.outletName }))
    },
  })
}

function toItem(row: Raw, index: number, submissionId: string): InventarisItem {
  const master: Raw = row.inventaris_master_items ?? {}
  const quantity = text(row.observed_qty) || (row.is_present === false ? 'Tidak ada' : row.is_present ? 'Ada' : '-')
  const target = master.target_qty != null
    ? text(master.target_qty)
    : master.target_min != null && master.target_max != null
      ? `${text(master.target_min)}–${text(master.target_max)}`
      : ''
  const sectionIndex = SECTION_ORDER.indexOf(text(master.section))
  return {
    id: text(row.id, `${submissionId}-${index}`),
    name: text(master.name, 'Item inventaris'),
    category: text(master.subsection ?? master.section, 'Lainnya'),
    sortKey: `${String(sectionIndex < 0 ? 9 : sectionIndex)}-${String(toNumber(master.sort_order) ?? 9999).padStart(6, '0')}`,
    status: text(row.status_penilaian ?? row.kondisi),
    condition: text(row.kondisi),
    quantity,
    target,
    notes: text(row.catatan) || null,
    purchaseDate: text(row.purchase_date) || null,
    price: toNumber(row.purchase_price),
    depreciation: toNumber(row.depreciation_rate),
    brand: text(row.brand) || null,
    photoPath: text(row.photo_path) || null,
  }
}

export function useInventarisReport(outletId: string) {
  const supabase = useMemo(() => createClient(), [])
  return useQuery<InventarisDetail | null>({
    queryKey: ['inventaris-report', outletId],
    enabled: Boolean(outletId),
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('inventaris_submissions')
        .select(
          'id, outlet_id, created_at, updated_at, notes, outlets(name), outlet_staff(name), ' +
          'inventaris_submission_items(id, observed_qty, is_present, kondisi, status_penilaian, catatan, photo_path, purchase_date, purchase_price, depreciation_rate, brand, ' +
          'inventaris_master_items(name, section, subsection, target_qty, target_min, target_max, sort_order))'
        )
        .eq('outlet_id', outletId)
        .order('updated_at', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (error) throw error
      if (!data) return null
      const row = data as Raw
      const summary = toSummary({ ...row, inventaris_submission_items: undefined })
      const items = ((row.inventaris_submission_items ?? []) as Raw[])
        .map((item, index) => toItem(item, index, summary.id))
        .sort((a, b) => a.sortKey.localeCompare(b.sortKey) || a.name.localeCompare(b.name))
      return { ...summary, itemCount: items.length, notes: text(row.notes) || null, items }
    },
  })
}

/** Tanda tangani semua foto satu laporan dalam SATU request storage. */
export function useInventarisPhotoUrls(report: InventarisDetail | null | undefined) {
  const supabase = useMemo(() => createClient(), [])
  const refs = useMemo(
    () => (report?.items ?? []).map((item) => ({ id: item.id, ref: resolvePhotoRef(item.photoPath) })),
    [report]
  )
  const paths = useMemo(
    () => [...new Set(refs.flatMap(({ ref }) => (ref && 'path' in ref ? [ref.path] : [])))],
    [refs]
  )

  const signed = useQuery<Record<string, string>>({
    queryKey: ['inventaris-photos', report?.id, report?.updatedAt],
    enabled: paths.length > 0,
    // URL berlaku 60 mnt — segarkan sebelum kedaluwarsa.
    staleTime: 50 * 60_000,
    gcTime: 55 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.storage.from(INVENTARIS_PHOTO_BUCKET).createSignedUrls(paths, SIGNED_URL_TTL_SECONDS)
      if (error) throw error
      const map: Record<string, string> = {}
      for (const entry of data ?? []) {
        if (entry.path && entry.signedUrl && !entry.error) map[entry.path] = entry.signedUrl
      }
      return map
    },
  })

  return useMemo(() => {
    const byItem = new Map<string, string>()
    for (const { id, ref } of refs) {
      if (!ref) continue
      const url = 'url' in ref ? ref.url : signed.data?.[ref.path]
      if (url) byItem.set(id, url)
    }
    return { urls: byItem, loading: signed.isLoading && paths.length > 0 }
  }, [refs, signed.data, signed.isLoading, paths.length])
}
