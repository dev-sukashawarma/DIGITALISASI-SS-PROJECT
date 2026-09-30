import { useMemo } from 'react'
import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase'
import { todayWib } from '@/lib/dateIso'
import { INVENTARIS_PHOTO_BUCKET, resolvePhotoRef } from '@/lib/inventaris'
import { susunPengingat, type BarisPengingat, type TindakLanjutBaru } from '@/lib/pengingatAset'

/*
 * Satu RPC (`inventaris_pengingat_aset`) untuk seluruh pengingat — sidebar,
 * kartu dashboard, dan halaman pengingat berbagi cache yang sama, jadi
 * membuka beberapa halaman tidak menambah request. Status dihitung di
 * browser oleh fungsi murni `susunPengingat`.
 */

export const PENGINGAT_ASET_KEY = ['pengingat-aset'] as const
const UMUR_BARANG_KEY = ['inventaris-umur-barang'] as const

export function usePengingatAset() {
  const supabase = useMemo(() => createClient(), [])
  const query = useQuery<BarisPengingat[]>({
    queryKey: PENGINGAT_ASET_KEY,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('inventaris_pengingat_aset')
      if (error) throw error
      return (data ?? []) as BarisPengingat[]
    },
  })
  const today = todayWib()
  const ringkasan = useMemo(() => susunPengingat(query.data ?? [], today), [query.data, today])
  return { ...query, ringkasan, today }
}

/*
 * Foto barang di dialog tindak lanjut. File di bucket sudah WebP hasil
 * kompresi app inventori (±35 KB, sisi panjang 1024 px) — ditampilkan apa
 * adanya, tanpa kompresi ulang. Satu signed URL per foto, dibuat hanya saat
 * dialog dibuka (atau saat tombol di-hover, lewat `prefetchFotoAset`), lalu
 * di-cache 50 mnt supaya membuka ulang dialog tidak mengunduh ulang.
 */
const FOTO_TTL_DETIK = 60 * 60

function fotoAsetOptions(supabase: ReturnType<typeof createClient>, fotoPath: string | null) {
  const ref = resolvePhotoRef(fotoPath)
  return {
    queryKey: ['pengingat-aset-foto', fotoPath] as const,
    enabled: !!ref,
    staleTime: 50 * 60_000,
    gcTime: 55 * 60_000,
    queryFn: async (): Promise<string | null> => {
      if (!ref) return null
      if ('url' in ref) return ref.url
      const { data, error } = await supabase.storage.from(INVENTARIS_PHOTO_BUCKET).createSignedUrl(ref.path, FOTO_TTL_DETIK)
      if (error) throw error
      return data?.signedUrl ?? null
    },
  }
}

export function useFotoAset(fotoPath: string | null) {
  const supabase = useMemo(() => createClient(), [])
  return useQuery(fotoAsetOptions(supabase, fotoPath))
}

/** Tanda tangani URL & mulai unduh gambar sebelum dialog dibuka. */
export function prefetchFotoAset(qc: QueryClient, fotoPath: string | null) {
  if (!fotoPath) return
  const opts = fotoAsetOptions(createClient(), fotoPath)
  void qc.fetchQuery(opts).then((url) => {
    if (url && typeof window !== 'undefined') {
      const img = new Image()
      img.decoding = 'async'
      img.src = url
    }
  }).catch(() => { /* dialog akan mencoba lagi */ })
}

export function useSimpanTindakLanjut() {
  const supabase = useMemo(() => createClient(), [])
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (rows: TindakLanjutBaru[]) => {
      if (rows.length === 0) return
      const { error } = await supabase.from('inventaris_tindak_lanjut').insert(rows)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: PENGINGAT_ASET_KEY }),
  })
}

export type JenisBarang = {
  id: string
  name: string
  section: string
  subsection: string
  sort_order: number
  umur_ekonomis_bulan: number | null
}

export function useUmurBarang() {
  const supabase = useMemo(() => createClient(), [])
  return useQuery<JenisBarang[]>({
    queryKey: UMUR_BARANG_KEY,
    staleTime: 10 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('inventaris_master_items')
        .select('id, name, section, subsection, sort_order, umur_ekonomis_bulan')
        .order('section')
        .order('sort_order')
      if (error) throw error
      return (data ?? []) as JenisBarang[]
    },
  })
}

export function useSimpanUmurBarang() {
  const supabase = useMemo(() => createClient(), [])
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, bulan }: { id: string; bulan: number | null }) => {
      const { error } = await supabase.rpc('set_umur_ekonomis_inventaris', { p_master_item_id: id, p_bulan: bulan })
      if (error) throw error
    },
    onSuccess: (_data, { id, bulan }) => {
      qc.setQueryData<JenisBarang[]>(UMUR_BARANG_KEY, (old) =>
        old?.map((row) => (row.id === id ? { ...row, umur_ekonomis_bulan: bulan } : row))
      )
      qc.invalidateQueries({ queryKey: PENGINGAT_ASET_KEY })
    },
  })
}
