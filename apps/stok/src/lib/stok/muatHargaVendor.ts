import type { SupabaseClient } from '@supabase/supabase-js'
import { hitungHargaVendor, type BarisKatalogVendor, type HargaVendorMap } from './hargaVendor'

// Muat katalog vendor untuk bahan tertentu lalu hitung harga per satuan besar.
// Dipanggil dari server action (client service-role, gerbang otorisasi di
// pemanggil). Bukan 'use server' — sengaja bukan endpoint.
export async function muatHargaVendor(supabase: SupabaseClient, bahanIds: string[]): Promise<HargaVendorMap> {
  if (!bahanIds.length) return {}
  const { data: kat, error } = await supabase
    .from('bahan_baku_supplier')
    .select('id, bahan_baku_id, supplier_id, harga, isi_satuan_kecil, is_active, harga_updated_at')
    .in('bahan_baku_id', bahanIds)
    .eq('is_active', true)
  if (error) throw new Error(error.message)
  if (!kat?.length) return {}

  const supplierIds = [...new Set(kat.map((k) => k.supplier_id as string))]
  const [{ data: sup, error: eSup }, { data: bb, error: eBb }, { data: bh, error: eBh }] = await Promise.all([
    supabase.from('supplier').select('id, vendor_induk_id').in('id', supplierIds),
    supabase.from('bahan_baku').select('id, faktor_tampilan').in('id', bahanIds),
    supabase.from('bahan_baku_harga').select('bahan_baku_id, kemasan_qty').in('bahan_baku_id', bahanIds),
  ])
  if (eSup) throw new Error(eSup.message)
  if (eBb) throw new Error(eBb.message)
  if (eBh) throw new Error(eBh.message)

  const induk = new Map((sup ?? []).map((s) => [s.id as string, (s.vendor_induk_id as string | null) ?? (s.id as string)]))
  const faktorTampilan = new Map((bb ?? []).map((b) => [b.id as string, Number(b.faktor_tampilan) || 0]))
  const kemasan = new Map((bh ?? []).map((h) => [h.bahan_baku_id as string, Number(h.kemasan_qty) || 0]))

  const baris: BarisKatalogVendor[] = kat.map((k) => ({
    id: k.id as string,
    bahan_baku_id: k.bahan_baku_id as string,
    vendor_induk: induk.get(k.supplier_id as string) ?? (k.supplier_id as string),
    harga: k.harga == null ? null : Number(k.harga),
    isi_satuan_kecil: k.isi_satuan_kecil == null ? null : Number(k.isi_satuan_kecil),
    is_active: !!k.is_active,
    harga_updated_at: (k.harga_updated_at as string | null) ?? null,
    faktor: kemasan.get(k.bahan_baku_id as string) || faktorTampilan.get(k.bahan_baku_id as string) || null,
  }))
  return hitungHargaVendor(baris)
}
