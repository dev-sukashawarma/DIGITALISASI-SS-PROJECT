'use client'
import { useMemo } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase'

export type DataBahan = Partial<{
  nama: string
  merek: string | null
  kategori: string
  peruntukan: 'outlet' | 'gudang' | 'keduanya'
  is_opname: boolean
  default_reorder_point: number
  satuan: string
  satuan_tengah: string | null
  faktor_tengah: number | null
  satuan_kecil: string | null
  isi_kecil_per_tengah: number | null
  satuan_po: string | null
  satuan_distribusi: string | null
  image_url: string | null
  image_url_tengah: string | null
  image_url_kecil: string | null
  image_urls: string[]
}>

export type DataSku = Partial<{ nama_kemasan: string; qty_isi: number; harga_beli: number; is_active: boolean }>

export type LevelFoto = 'besar' | 'tengah' | 'kecil'

const KOLOM_FOTO: Record<LevelFoto, 'image_url' | 'image_url_tengah' | 'image_url_kecil'> = {
  besar: 'image_url', tengah: 'image_url_tengah', kecil: 'image_url_kecil',
}

/** Kunci yang disegarkan setelah tulis master apa pun. */
const KUNCI_SEGAR: readonly (readonly string[])[] = [
  ['master_bahan'], ['katalog_vendor'], ['suppliers'], ['po-price-alerts'], ['harga-history'],
]

/**
 * Satu-satunya jalur tulis master bahan dari admin-dashboard (spec K10).
 * Galat RPC dilempar apa adanya (PostgrestError) supaya bacaGalatRpc membaca kodenya.
 */
export function useMutasiMasterBahan() {
  const supabase = useMemo(() => createClient(), [])
  const qc = useQueryClient()
  const segarkan = () => {
    for (const k of KUNCI_SEGAR) qc.invalidateQueries({ queryKey: [...k] })
  }

  async function rpc<T>(nama: string, args: Record<string, unknown>): Promise<T> {
    const { data, error } = await supabase.rpc(nama, args)
    if (error) throw error
    return data as T
  }

  const simpanBahan = useMutation({
    mutationFn: (v: { id: string | null; data: DataBahan; alasan?: string | null }) =>
      rpc<string>('simpan_bahan_baku', { p_id: v.id, p_data: v.data, p_alasan: v.alasan ?? null }),
    onSuccess: segarkan,
  })

  const nonaktifkan = useMutation({
    mutationFn: (v: { id: string; alasan: string }) => rpc<null>('nonaktifkan_bahan_baku', { p_id: v.id, p_alasan: v.alasan }),
    onSuccess: segarkan,
  })

  const aktifkan = useMutation({
    mutationFn: (v: { id: string; alasan: string }) => rpc<null>('aktifkan_bahan_baku', { p_id: v.id, p_alasan: v.alasan }),
    onSuccess: segarkan,
  })

  const hapus = useMutation({
    mutationFn: (v: { id: string; alasan: string }) => rpc<null>('hapus_bahan_baku', { p_id: v.id, p_alasan: v.alasan }),
    onSuccess: segarkan,
  })

  const simpanSku = useMutation({
    mutationFn: (v: { id: string | null; bahanId: string; data: DataSku }) =>
      rpc<string>('simpan_sku', { p_id: v.id, p_bahan_baku_id: v.bahanId, p_data: v.data }),
    onSuccess: segarkan,
  })

  const setDefaultSku = useMutation({
    mutationFn: (skuId: string) => rpc<null>('set_default_sku', { p_id: skuId }),
    onSuccess: segarkan,
  })

  const hapusSku = useMutation({
    mutationFn: (skuId: string) => rpc<null>('hapus_sku', { p_id: skuId }),
    onSuccess: segarkan,
  })

  const unggahFoto = useMutation({
    mutationFn: async (v: { bahanId: string; file: File; level: LevelFoto }) => {
      const ext = v.file.name.split('.').pop()
      const path = `${v.bahanId}_${v.level}_${Date.now()}.${ext}`
      const { error: galatUnggah } = await supabase.storage.from('bahan-baku').upload(path, v.file)
      if (galatUnggah) throw galatUnggah
      const { data: { publicUrl } } = supabase.storage.from('bahan-baku').getPublicUrl(path)
      return rpc<string>('simpan_bahan_baku', {
        p_id: v.bahanId,
        p_data: { [KOLOM_FOTO[v.level]]: publicUrl },
        p_alasan: `Foto ${v.level} diganti`,
      })
    },
    onSuccess: segarkan,
  })

  const simpanHargaVendor = useMutation({
    mutationFn: (v: {
      bahanId: string; supplierId: string; harga: number; satuanBeli: string; isi: number; alasan: string; paksa?: boolean
    }) =>
      rpc<string>('simpan_harga_vendor', {
        p_bahan: v.bahanId, p_supplier: v.supplierId, p_harga: v.harga, p_satuan_beli: v.satuanBeli,
        p_isi_satuan_kecil: v.isi, p_alasan: v.alasan, p_paksa: v.paksa ?? false,
      }),
    onSuccess: segarkan,
  })

  const nonaktifkanHargaVendor = useMutation({
    mutationFn: (v: { id: string; alasan: string }) => rpc<null>('nonaktifkan_harga_vendor', { p_id: v.id, p_alasan: v.alasan }),
    onSuccess: segarkan,
  })

  return {
    simpanBahan, nonaktifkan, aktifkan, hapus, simpanSku, setDefaultSku, hapusSku, unggahFoto,
    simpanHargaVendor, nonaktifkanHargaVendor,
  }
}
