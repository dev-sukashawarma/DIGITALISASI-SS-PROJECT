'use client'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase'

// Semua otorisasi ada di RPC (SECURITY DEFINER + peran_saya()). Jangan panggil
// lewat service-role: auth.uid() jadi NULL dan pemeriksaan peran gagal.
// createClient() di sini delegasi ke @suka/auth (lihat src/lib/supabase.ts) --
// pola yang sama dengan useTerimaVendor.ts.

export type RingkasanBaris = {
  outlet_id: string
  outlet_nama: string
  bahan_baku_id: string
  bahan_nama: string
  jumlah_catatan: number
  total_qty: number
  total_nilai: number
}

export type VendorDropShip = { id: string; nama: string; termin_hari: number | null }

// Vendor drop-ship = supplier dengan katalog aktif di bahan_baku_supplier (Task 0/1).
// Tidak menyaring is_active di sisi klien karena baris katalog nonaktif = vendor
// yang tak lagi dipakai; join menyaringnya lewat keberadaan baris.
export function useVendorDropShip() {
  return useQuery<VendorDropShip[]>({
    queryKey: ['nota-vendor', 'vendor'],
    queryFn: async () => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('supplier')
        .select('id, nama, termin_hari, bahan_baku_supplier!inner(id)')
        .eq('is_active', true)
        .order('nama')
      if (error) throw new Error(error.message)
      const seen = new Set<string>()
      const hasil: VendorDropShip[] = []
      for (const row of (data ?? []) as any[]) {
        if (seen.has(row.id)) continue
        seen.add(row.id)
        hasil.push({ id: row.id, nama: row.nama, termin_hari: row.termin_hari })
      }
      return hasil
    },
  })
}

export type CatatanNotaVendor = {
  id: string
  outlet_id: string
  outlet_nama: string
  bahan_baku_id: string
  bahan_nama: string
  satuan: string
  qty: number
  tanggal_terima: string
  catatan: string | null
}

// Daftar per-catatan (bukan agregat) supaya "Tolak" punya id baris yang benar
// untuk dikirim ke tolak_terima_vendor. RLS tvo_select mengizinkan pengesah
// (purchasing/kitchen/admin/owner/admin_finance) membaca SEMUA outlet, bukan
// hanya accessible_outlet_ids() -- lihat migration 20260911120000.
// periodeMulai/periodeAkhir dihitung di komponen lewat periodeTagihan() (Task 1),
// cermin SQL public.periode_tagihan() -- keduanya harus dijaga sinkron.
export function useDaftarCatatanNota(
  supplierId: string | null,
  periodeMulai: string | null,
  periodeAkhir: string | null
) {
  return useQuery<CatatanNotaVendor[]>({
    queryKey: ['nota-vendor', 'catatan', supplierId, periodeMulai, periodeAkhir],
    enabled: !!supplierId && !!periodeMulai && !!periodeAkhir,
    queryFn: async () => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('terima_vendor_outlet')
        .select('id, outlet_id, bahan_baku_id, qty, tanggal_terima, catatan, outlets(name), bahan_baku(nama, satuan)')
        .eq('supplier_id', supplierId)
        .eq('status', 'dicatat')
        .gte('tanggal_terima', periodeMulai)
        .lte('tanggal_terima', periodeAkhir)
        .order('tanggal_terima')
      if (error) throw new Error(error.message)
      return ((data ?? []) as any[]).map((r) => ({
        id: r.id,
        outlet_id: r.outlet_id,
        outlet_nama: r.outlets?.name ?? '?',
        bahan_baku_id: r.bahan_baku_id,
        bahan_nama: r.bahan_baku?.nama ?? '?',
        satuan: r.bahan_baku?.satuan ?? '',
        qty: Number(r.qty),
        tanggal_terima: r.tanggal_terima,
        catatan: r.catatan,
      }))
    },
  })
}

export function useRingkasanNota(supplierId: string | null, tanggalTagihan: string | null) {
  return useQuery<RingkasanBaris[]>({
    queryKey: ['nota-vendor', 'ringkasan', supplierId, tanggalTagihan],
    enabled: !!supplierId && !!tanggalTagihan,
    queryFn: async () => {
      const supabase = createClient()
      const { data, error } = await supabase.rpc('ringkasan_nota_vendor', {
        p_supplier_id: supplierId,
        p_tanggal_tagihan: tanggalTagihan,
      })
      if (error) throw new Error(error.message)
      return (data ?? []) as RingkasanBaris[]
    },
  })
}

export type RincianNotaVendor = { outlet_id: string; tanggal_kirim: string | null; qty_kg: number }

export function useSahkanNota() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (a: {
      supplierId: string
      tanggalTagihan: string
      totalKg: number
      totalRupiah: number
      fotoNotaUrl: string
      catatanSelisih?: string
      rincian: RincianNotaVendor[]
    }) => {
      const supabase = createClient()
      const { data, error } = await supabase.rpc('sahkan_nota_vendor', {
        p_supplier_id: a.supplierId,
        p_tanggal_tagihan: a.tanggalTagihan,
        p_total_kg: a.totalKg,
        p_total_rupiah: a.totalRupiah,
        p_foto_nota_url: a.fotoNotaUrl,
        p_catatan_selisih: a.catatanSelisih ?? null,
        p_rincian: a.rincian,
      })
      if (error) throw new Error(error.message)
      return data as string
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['nota-vendor'] }),
  })
}

export function useTolakTerimaVendor() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (a: { id: string; alasan: string }) => {
      const supabase = createClient()
      const { error } = await supabase.rpc('tolak_terima_vendor', { p_id: a.id, p_alasan: a.alasan })
      if (error) throw new Error(error.message)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['nota-vendor'] })
      qc.invalidateQueries({ queryKey: ['terima-vendor'] })
    },
  })
}
