'use server'

import { cookies } from 'next/headers'
import { createSupabaseServerClient } from '@suka/auth'
import type { HppDinamisBahanRow, HppDinamisMenuRow } from '@/lib/stok/hppDinamis'

async function getAuthedClient() {
  const cookieStore = await cookies()
  return createSupabaseServerClient({
    getAll: () => cookieStore.getAll(),
    setAll: (toSet) =>
      toSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options as any)),
  })
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

// SENGAJA memakai client ber-sesi, bukan makeServiceClient(): RPC-nya memeriksa
// role (can_view_hpp_dinamis) dan cakupan outlet (accessible_outlet_ids) —
// service-role akan melewati keduanya (pelajaran Session 2026-07-20).
export async function fetchHPPDinamis(
  outletId: string,
  from: string,
  to: string,
): Promise<{ menu: HppDinamisMenuRow[]; bahan: HppDinamisBahanRow[] }> {
  if (!outletId || !ISO_DATE.test(from) || !ISO_DATE.test(to)) {
    throw new Error('Parameter outlet/periode tidak valid')
  }
  const supabase = await getAuthedClient()
  const [menuRes, bahanRes] = await Promise.all([
    supabase.rpc('get_hpp_dinamis_menu', { p_outlet: outletId, p_from: from, p_to: to }),
    supabase.rpc('get_hpp_dinamis_bahan', { p_outlet: outletId, p_from: from, p_to: to }),
  ])
  if (menuRes.error) throw new Error(menuRes.error.message)
  if (bahanRes.error) throw new Error(bahanRes.error.message)

  const num = (v: unknown) => (v == null ? null : Number(v))
  const menu = (menuRes.data ?? []).map((r: any): HppDinamisMenuRow => ({
    menu_item_id: r.menu_item_id,
    menu_nama: r.menu_nama,
    harga_jual: Number(r.harga_jual ?? 0),
    qty_terjual: Number(r.qty_terjual ?? 0),
    punya_resep: !!r.punya_resep,
    hpp_override_unit: Number(r.hpp_override_unit ?? 0),
    hpp_override_total: Number(r.hpp_override_total ?? 0),
    hpp_teoritis_total: num(r.hpp_teoritis_total),
    hpp_teoritis_unit: num(r.hpp_teoritis_unit),
  }))
  const bahan = (bahanRes.data ?? []).map((r: any): HppDinamisBahanRow => ({
    bahan_baku_id: r.bahan_baku_id,
    nama_bahan: r.nama_bahan,
    satuan: r.satuan,
    satuan_kecil: r.satuan_kecil ?? null,
    is_gram: !!r.is_gram,
    qty_pemakaian: Number(r.qty_pemakaian ?? 0),
    nilai: Number(r.nilai ?? 0),
    sumber_harga_terakhir: r.sumber_harga_terakhir,
    ref_id_terakhir: r.ref_id_terakhir ?? null,
    ref_tanggal_terakhir: r.ref_tanggal_terakhir ?? null,
    nilai_kiriman: num(r.nilai_kiriman),
    nilai_drop_ship: num(r.nilai_drop_ship),
    nilai_master_historis: num(r.nilai_master_historis),
    nilai_master_sekarang: num(r.nilai_master_sekarang),
    nilai_tidak_ada: num(r.nilai_tidak_ada),
  }))
  return { menu, bahan }
}
