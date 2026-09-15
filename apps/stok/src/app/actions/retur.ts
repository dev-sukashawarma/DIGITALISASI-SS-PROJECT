'use server'

import { cookies } from 'next/headers'
import { createSupabaseServerClient } from '@suka/auth'
import { ReturStok } from '@/types/retur'

async function getAuthedClient() {
  const cookieStore = await cookies()
  return createSupabaseServerClient({
    getAll: () => cookieStore.getAll(),
    setAll: (toSet) =>
      toSet.forEach(({ name, value, options }) =>
        cookieStore.set(name, value, options as any)
      ),
  })
}

/**
 * Mengambil daftar tiket retur stok (dengan filter status / outlet jika ada).
 */
export async function fetchDaftarRetur(options?: {
  outletId?: string | null
  status?: string | null
  limit?: number
}): Promise<ReturStok[]> {
  const supabase = await getAuthedClient()

  let query = supabase
    .from('retur_stok')
    .select(`
      *,
      outlets:outlet_id (id, name),
      created_by_staff:created_by (name),
      approved_by_staff:approved_by_manager (name),
      verified_by_staff:verified_by_kitchen (name),
      surat_jalan_pengganti:ref_surat_jalan_pengganti_id (id, nomor_surat:document_number, status),
      items:retur_stok_item (
        id,
        retur_stok_id,
        bahan_baku_id,
        qty_klaim,
        qty_diterima_kitchen,
        foto_fisik_url,
        foto_timbangan_url,
        alasan,
        catatan,
        created_at,
        bahan_baku:bahan_baku_id (
          id, nama, satuan, faktor_tampilan, satuan_kecil, faktor_tengah, satuan_tengah
        )
      )
    `)
    .order('created_at', { ascending: false })

  if (options?.outletId) {
    query = query.eq('outlet_id', options.outletId)
  }

  if (options?.status && options.status !== 'semua') {
    query = query.eq('status', options.status)
  }

  if (options?.limit) {
    query = query.limit(options.limit)
  }

  const { data, error } = await query

  if (error) {
    console.error('fetchDaftarRetur error:', error)
    throw new Error(error.message)
  }

  return (data as unknown as ReturStok[]) ?? []
}

/**
 * Mengambil detail 1 tiket retur.
 */
export async function fetchReturDetail(returId: string): Promise<ReturStok | null> {
  const supabase = await getAuthedClient()

  const { data, error } = await supabase
    .from('retur_stok')
    .select(`
      *,
      outlets:outlet_id (id, name),
      created_by_staff:created_by (name),
      approved_by_staff:approved_by_manager (name),
      verified_by_staff:verified_by_kitchen (name),
      surat_jalan_pengganti:ref_surat_jalan_pengganti_id (id, nomor_surat:document_number, status),
      items:retur_stok_item (
        id,
        retur_stok_id,
        bahan_baku_id,
        qty_klaim,
        qty_diterima_kitchen,
        foto_fisik_url,
        foto_timbangan_url,
        alasan,
        catatan,
        created_at,
        bahan_baku:bahan_baku_id (
          id, nama, satuan, faktor_tampilan, satuan_kecil, faktor_tengah, satuan_tengah
        )
      )
    `)
    .eq('id', returId)
    .maybeSingle()

  if (error) {
    console.error('fetchReturDetail error:', error)
    throw new Error(error.message)
  }

  return (data as unknown as ReturStok) ?? null
}

/**
 * Submit pengajuan retur dari outlet.
 */
export async function submitReturClaim(payload: {
  outlet_id: string
  tipe_retur?: 'inbound_sj' | 'chiller_outlet'
  items: Array<{
    bahan_baku_id: string
    qty_klaim: number
    foto_fisik_url: string
    foto_timbangan_url?: string
    alasan: string
    catatan?: string
  }>
  catatan?: string
}) {
  const supabase = await getAuthedClient()

  const { data, error } = await supabase.rpc('ajukan_retur_stok', {
    p_outlet_id: payload.outlet_id,
    p_tipe_retur: payload.tipe_retur ?? 'chiller_outlet',
    p_items: payload.items,
    p_catatan: payload.catatan ?? null,
  })

  if (error) {
    console.error('submitReturClaim error:', error)
    throw new Error(error.message)
  }

  return data
}

/**
 * Approval manajerial (AM / RM) untuk tiket retur.
 */
export async function approveReturManager(
  returId: string,
  approve: boolean,
  note?: string
) {
  const supabase = await getAuthedClient()

  const { data, error } = await supabase.rpc('approve_retur_by_manager', {
    p_retur_id: returId,
    p_approve: approve,
    p_catatan: note ?? null,
  })

  if (error) {
    console.error('approveReturManager error:', error)
    throw new Error(error.message)
  }

  return data
}

/**
 * Konfirmasi serah terima paket retur ke driver (Internal maupun 3PL: Lalamove, GoSend, dll).
 */
export async function konfirmasiSerahTerimaDriver(payload: {
  retur_id: string
  jenis_logistik: string
  nomor_resi?: string
  driver_nama?: string
  driver_kontak?: string
  driver_plat?: string
  foto_serah_terima?: string
}) {
  const supabase = await getAuthedClient()

  const { data, error } = await supabase.rpc('konfirmasi_serah_terima_logistik', {
    p_retur_id: payload.retur_id,
    p_jenis_logistik: payload.jenis_logistik,
    p_nomor_resi: payload.nomor_resi ?? null,
    p_driver_nama: payload.driver_nama ?? null,
    p_driver_kontak: payload.driver_kontak ?? null,
    p_driver_plat: payload.driver_plat ?? null,
    p_foto_serah_terima: payload.foto_serah_terima ?? null,
  })

  if (error) {
    console.error('konfirmasiSerahTerimaDriver error:', error)
    throw new Error(error.message)
  }

  return data
}

/**
 * Central Kitchen menimbang ulang fisik dan menerbitkan Surat Jalan Pengganti.
 */
export async function verifikasiKitchenDanBuatSJ(
  returId: string,
  itemsVerified: Array<{ id: string; qty_diterima_kitchen: number }>,
  note?: string,
  terbitkanSjSekarang: boolean = true
) {
  const supabase = await getAuthedClient()

  const { data, error } = await supabase.rpc('verifikasi_kitchen_dan_buat_sj', {
    p_retur_id: returId,
    p_items_verified: itemsVerified,
    p_catatan: note ?? null,
    p_terbitkan_sj_sekarang: terbitkanSjSekarang,
  })

  if (error) {
    console.error('verifikasiKitchenDanBuatSJ error:', error)
    throw new Error(error.message)
  }

  return data
}

/**
 * Mengambil detail Surat Jalan Pengganti beserta item-itemnya.
 */
export async function fetchSuratJalanDetail(suratJalanId: string) {
  const supabase = await getAuthedClient()

  const { data, error } = await supabase
    .from('surat_jalan')
    .select(`
      id,
      document_number,
      status,
      created_at,
      verification_code,
      notes,
      is_retur_replacement,
      ref_retur_id,
      outlets:outlet_id (id, name),
      items:surat_jalan_item (
        id,
        qty_dikirim,
        qty_terima,
        kondisi,
        catatan,
        bahan_baku:bahan_baku_id (id, nama, satuan)
      )
    `)
    .eq('id', suratJalanId)
    .single()

  if (error) {
    console.error('fetchSuratJalanDetail error:', error)
    throw new Error(error.message)
  }

  return data
}

/**
 * Mengambil tiket retur aktif untuk outlet tertentu yang sudah ditimbang fisik di Kitchen
 * tetapi belum dikirim penggantinya (status: 'diterima_kitchen').
 */
export async function fetchPendingReturForOutlet(outletId: string) {
  const supabase = await getAuthedClient()

  const { data, error } = await supabase
    .from('retur_stok')
    .select(`
      id,
      nomor_retur,
      outlet_id,
      status,
      catatan_kitchen,
      created_at,
      items:retur_stok_item (
        id,
        qty_klaim,
        qty_diterima_kitchen,
        bahan_baku:bahan_baku_id (id, nama, satuan)
      )
    `)
    .eq('outlet_id', outletId)
    .eq('status', 'diterima_kitchen')
    .order('created_at', { ascending: true })

  if (error) {
    console.error('fetchPendingReturForOutlet error:', error)
    return []
  }

  return data ?? []
}
