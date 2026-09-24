'use client'

import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase'
import type { BarisKatalogVendor } from '@/lib/katalogGroup'

const KEY = ['katalog_vendor'] as const

/** Bentuk mentah dari PostgREST: relasi ikut sebagai objek bersarang. */
type BarisMentah = {
  id: string
  bahan_baku_id: string
  supplier_id: string
  satuan_beli: string
  isi_satuan_kecil: number
  harga: number
  is_active: boolean
  perlu_ditinjau: boolean
  sumber: string
  harga_updated_at: string | null
  bahan_baku: {
    nama: string
    kategori: string | null
    satuan: string | null
    satuan_po: string | null
    satuan_kecil: string | null
    faktor_po: number | null
    /**
     * Embed bersarang. `bahan_baku_harga.bahan_baku_id` adalah PK sekaligus FK,
     * jadi PostgREST semestinya mengenalinya satu-ke-satu dan mengembalikan
     * objek — tapi deteksi itu tidak dijamin, jadi bentuk array ikut ditangani.
     */
    bahan_baku_harga: HargaMaster | HargaMaster[] | null
  } | null
  supplier: { nama: string; termin_hari: number | null } | null
}

type HargaMaster = { harga_beli: number | null; kemasan_qty: number | null }

/** harga_beli per satuan besar dibagi isi kemasannya -> harga per satuan kecil. */
function masterPerKecil(h: HargaMaster | HargaMaster[] | null | undefined): number | null {
  const satu = Array.isArray(h) ? h[0] : h
  const harga = Number(satu?.harga_beli ?? 0)
  const kemasan = Number(satu?.kemasan_qty ?? 0)
  if (!Number.isFinite(harga) || harga <= 0) return null
  if (!Number.isFinite(kemasan) || kemasan <= 0) return null
  return harga / kemasan
}

function ratakan(r: BarisMentah): BarisKatalogVendor {
  return {
    id: r.id,
    bahan_baku_id: r.bahan_baku_id,
    bahan: r.bahan_baku?.nama ?? '(bahan terhapus)',
    kategori: r.bahan_baku?.kategori ?? null,
    satuan: r.bahan_baku?.satuan ?? null,
    satuan_po: r.bahan_baku?.satuan_po ?? null,
    satuan_kecil: r.bahan_baku?.satuan_kecil ?? null,
    faktor_po: r.bahan_baku?.faktor_po ?? null,
    supplier_id: r.supplier_id,
    supplier_nama: r.supplier?.nama ?? '(vendor terhapus)',
    termin_hari: r.supplier?.termin_hari ?? null,
    satuan_beli: r.satuan_beli,
    isi_satuan_kecil: Number(r.isi_satuan_kecil),
    harga: Number(r.harga),
    is_active: r.is_active,
    perlu_ditinjau: r.perlu_ditinjau,
    sumber: r.sumber,
    harga_updated_at: r.harga_updated_at,
    harga_master_per_kecil: masterPerKecil(r.bahan_baku?.bahan_baku_harga),
  }
}

export function useKatalogVendor() {
  const supabase = useMemo(() => createClient(), [])

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: KEY,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bahan_baku_supplier')
        .select(
          'id, bahan_baku_id, supplier_id, satuan_beli, isi_satuan_kecil, harga, is_active, perlu_ditinjau, sumber, harga_updated_at, bahan_baku!inner(nama, kategori, satuan, satuan_po, satuan_kecil, faktor_po, is_active, bahan_baku_harga(harga_beli, kemasan_qty)), supplier!inner(nama, termin_hari, is_active)',
        )
        // Hanya pasangan yang masih berlaku: baris katalog aktif, vendor aktif, bahan aktif.
        // Baris yang dinonaktifkan (mis. uncheck di Master Supplier) tak boleh tampil
        // seolah vendor itu masih memasok bahan tersebut.
        .eq('is_active', true)
        .eq('supplier.is_active', true)
        .eq('bahan_baku.is_active', true)
      if (error) throw error
      return ((data ?? []) as unknown as BarisMentah[]).map(ratakan)
    },
    staleTime: 60000,
    gcTime: 300000,
  })

  return { rows: data ?? [], loading: isLoading, error, refresh: refetch }
}
