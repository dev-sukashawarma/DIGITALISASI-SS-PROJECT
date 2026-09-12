'use client'

import { useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
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
          'id, bahan_baku_id, supplier_id, satuan_beli, isi_satuan_kecil, harga, is_active, perlu_ditinjau, sumber, harga_updated_at, bahan_baku!inner(nama, satuan, satuan_po, satuan_kecil, faktor_po, bahan_baku_harga(harga_beli, kemasan_qty)), supplier!inner(nama, termin_hari)',
        )
      if (error) throw error
      return ((data ?? []) as unknown as BarisMentah[]).map(ratakan)
    },
    staleTime: 60000,
    gcTime: 300000,
  })

  return { rows: data ?? [], loading: isLoading, error, refresh: refetch }
}

export function useKatalogVendorMutations() {
  const supabase = useMemo(() => createClient(), [])
  const qc = useQueryClient()

  /**
   * Menyimpan satu baris. `sumber` selalu jadi 'manual' (menyunting satuan pun
   * perbuatan manusia). `perlu_ditinjau` HANYA dilepas kalau harga > 0 —
   * harga kosong/0 yang lolos ke sini (mis. dari kotak yang dikosongkan)
   * TIDAK BOLEH menandai baris "sudah ditinjau manusia" karena provenance-nya
   * (asal PO, belum ditinjau) akan hilang tanpa bisa dipulihkan dari layar.
   * Baris riwayat ditulis trigger `bbs_tulis_riwayat`, bukan di sini.
   */
  const simpanBaris = useMutation({
    mutationFn: async (v: {
      id: string
      harga: number
      satuan_beli: string
      isi_satuan_kecil: number
    }) => {
      const { data: auth } = await supabase.auth.getUser()
      const payload: Record<string, unknown> = {
        harga: v.harga,
        satuan_beli: v.satuan_beli.trim(),
        isi_satuan_kecil: v.isi_satuan_kecil,
        sumber: 'manual',
        harga_updated_at: new Date().toISOString(),
        updated_by: auth.user?.id ?? null,
      }
      if (v.harga > 0) payload.perlu_ditinjau = false

      const { data, error } = await supabase
        .from('bahan_baku_supplier')
        .update(payload)
        .eq('id', v.id)
        .select('id')
      if (error) throw new Error(error.message)
      if (!data || data.length === 0) {
        throw new Error('Baris tidak tersimpan — kemungkinan hak akses ditolak.')
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  })

  return { simpanBaris }
}
