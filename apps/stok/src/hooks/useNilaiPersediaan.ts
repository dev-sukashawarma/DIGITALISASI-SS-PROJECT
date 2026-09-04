'use client'
import { useId, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase'
import { useRealtimeInvalidate } from '@suka/realtime'

/**
 * Tiga tingkat keyakinan, sengaja dipisah supaya angka yang belum bisa
 * dipegang tidak menyusup ke total seolah pasti:
 *
 *   pasti               nilai = nilai_min = nilai_max
 *   skala_belum_pasti   satuan baris belum dipastikan opname; nilai sebenarnya
 *                       ada di antara nilai_min..nilai_max. Hilang sendiri
 *                       setelah outlet opname bahan tersebut.
 *   data_belum_lengkap  harga beli atau isi kemasan belum diisi, jadi nilai = 0.
 *                       BUKAN berarti stoknya tak bernilai.
 */
export type StatusNilai = 'pasti' | 'skala_belum_pasti' | 'data_belum_lengkap'

/** Satu baris nilai persediaan: satu bahan di satu outlet. */
export type NilaiPersediaanRow = {
  outlet_id: string
  outlet: string
  outlet_type: string | null
  bahan_baku_id: string
  bahan: string
  kategori: string | null
  satuan: string | null
  satuan_kecil: string | null
  kemasan_qty: number | null
  harga_beli: number | null
  saldo: number
  status: StatusNilai
  skala_pasti: boolean
  jumlah_satuan_besar: number
  nilai: number
  nilai_min: number
  nilai_max: number
  updated_at: string | null
}

/** Ringkasan satu outlet, hasil agregasi baris-barisnya. */
export type NilaiPersediaanOutlet = {
  outlet_id: string
  outlet: string
  outlet_type: string | null
  /** Nilai dari baris berstatus 'pasti'. Angka ini bisa dipegang. */
  nilai_pasti: number
  /** Tafsir terbaik untuk baris berstatus 'skala_belum_pasti'. */
  nilai_belum_pasti: number
  /** Batas bawah & atas gabungan, memasukkan ketidakpastian skala. */
  batas_bawah: number
  batas_atas: number
  jml_bahan: number
  jml_belum_pasti: number
  jml_data_kurang: number
  items: NilaiPersediaanRow[]
}

function ringkas(rows: NilaiPersediaanRow[]): NilaiPersediaanOutlet[] {
  const per = new Map<string, NilaiPersediaanOutlet>()

  for (const r of rows) {
    let o = per.get(r.outlet_id)
    if (!o) {
      o = {
        outlet_id: r.outlet_id,
        outlet: r.outlet,
        outlet_type: r.outlet_type,
        nilai_pasti: 0,
        nilai_belum_pasti: 0,
        batas_bawah: 0,
        batas_atas: 0,
        jml_bahan: 0,
        jml_belum_pasti: 0,
        jml_data_kurang: 0,
        items: [],
      }
      per.set(r.outlet_id, o)
    }

    o.items.push(r)
    o.jml_bahan += 1
    o.batas_bawah += r.nilai_min
    o.batas_atas += r.nilai_max

    if (r.status === 'pasti') {
      o.nilai_pasti += r.nilai
    } else if (r.status === 'skala_belum_pasti') {
      o.nilai_belum_pasti += r.nilai
      o.jml_belum_pasti += 1
    } else {
      o.jml_data_kurang += 1
    }
  }

  return [...per.values()]
    .map((o) => ({
      ...o,
      items: [...o.items].sort((a, b) => b.nilai - a.nilai),
    }))
    .sort((a, b) => b.nilai_pasti + b.nilai_belum_pasti - (a.nilai_pasti + a.nilai_belum_pasti))
}

export function useNilaiPersediaan() {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['nilai_persediaan'],
    queryFn: async () => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('nilai_persediaan_spv')
        .select(
          'outlet_id, outlet, outlet_type, bahan_baku_id, bahan, kategori, satuan, satuan_kecil, kemasan_qty, harga_beli, saldo, status, skala_pasti, jumlah_satuan_besar, nilai, nilai_min, nilai_max, updated_at',
        )
      if (error) throw error
      return (data as NilaiPersediaanRow[]) ?? []
    },
    staleTime: 60000,
    gcTime: 300000,
  })

  const rows = data ?? []
  const outlets = useMemo(() => ringkas(rows), [rows])

  const total = useMemo(() => {
    const t = {
      nilai_pasti: 0,
      nilai_belum_pasti: 0,
      batas_bawah: 0,
      batas_atas: 0,
      jml_belum_pasti: 0,
      jml_data_kurang: 0,
    }
    for (const o of outlets) {
      t.nilai_pasti += o.nilai_pasti
      t.nilai_belum_pasti += o.nilai_belum_pasti
      t.batas_bawah += o.batas_bawah
      t.batas_atas += o.batas_atas
      t.jml_belum_pasti += o.jml_belum_pasti
      t.jml_data_kurang += o.jml_data_kurang
    }
    return t
  }, [outlets])

  const instanceId = useId()
  useRealtimeInvalidate({
    channelName: `nilai_persediaan_${instanceId}`,
    subs: [
      { table: 'stok_balance', queryKeys: [['nilai_persediaan']] },
      { table: 'bahan_baku_harga', queryKeys: [['nilai_persediaan']] },
    ],
  })

  return { rows, outlets, total, loading: isLoading, error, refresh: refetch }
}
