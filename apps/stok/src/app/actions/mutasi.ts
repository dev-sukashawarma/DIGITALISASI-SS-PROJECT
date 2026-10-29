'use server'
import { cookies } from 'next/headers'
import { createSupabaseServerClient } from '@suka/auth'
import type { MutasiAntarOutlet } from '@/lib/types/mutasi'
import type { PendingMutasiItem } from '@/lib/stok/mutasiBadge'
import { canApproveMutasi } from '@/lib/stok/approver'

export type MutasiActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string }

function formatMutasiError(rawMsg: string): string {
  if (!rawMsg) return 'Terjadi kesalahan sistem'
  if (rawMsg.includes('Stok tidak cukup')) {
    return rawMsg
  }
  if (rawMsg.includes('Not authorized to send')) {
    return 'Anda tidak memiliki hak otorisasi untuk mengirim mutasi dari outlet asal ini.'
  }
  if (rawMsg.includes('Not authorized to receive')) {
    return 'Anda tidak memiliki hak otorisasi untuk menerima mutasi ini.'
  }
  if (rawMsg.includes('Not authorized to create')) {
    return 'Anda tidak memiliki hak otorisasi untuk membuat mutasi untuk outlet ini.'
  }
  if (rawMsg.includes('Not authorized to approve')) {
    return 'Hanya Admin Kitchen yang berhak menyetujui atau menolak mutasi.'
  }
  if (rawMsg.includes('Invalid status for sending')) {
    return 'Status mutasi tidak valid untuk pengiriman (mungkin sudah dikirim atau dibatalkan).'
  }
  if (rawMsg.includes('Invalid status for receiving')) {
    return 'Status mutasi tidak valid untuk penerimaan (belum dikirim atau sudah selesai).'
  }
  return rawMsg
}

// ---------------------------------------------------------------------------
// Authenticated client — respects RLS and sets auth.uid()
// ---------------------------------------------------------------------------
async function getAuthClient() {
  const cookieStore = await cookies()
  return createSupabaseServerClient({
    getAll: () => cookieStore.getAll(),
    setAll: (toSet) =>
      toSet.forEach(({ name, value, options }) =>
        cookieStore.set(name, value, options as any)
      ),
  })
}
 
// ---------------------------------------------------------------------------
// fetchPendingMutasiRaw — query ringan untuk realtime badge mutasi
// ---------------------------------------------------------------------------
export async function fetchPendingMutasiRaw(outletId?: string | null): Promise<PendingMutasiItem[]> {
  const supabase = await getAuthClient()
  
  let query = supabase
    .from('mutasi_antar_outlet')
    .select('id, status, outlet_asal_id, outlet_tujuan_id, created_at')
    .in('status', ['menunggu_persetujuan', 'menunggu_pengiriman', 'dikirim'])
    .order('created_at', { ascending: false })

  if (outletId) {
    query = query.or(`status.eq.menunggu_persetujuan,outlet_asal_id.eq.${outletId},outlet_tujuan_id.eq.${outletId}`)
  }

  const { data, error } = await query
  if (error) throw new Error(error.message)
  return (data ?? []) as PendingMutasiItem[]
}

// ---------------------------------------------------------------------------
// fetchMutasiList — lihat mutasi berdasarkan outlet terkait
// ---------------------------------------------------------------------------
export async function fetchMutasiList(outletId?: string): Promise<MutasiAntarOutlet[]> {
  const supabase = await getAuthClient()
  
  let query = supabase
    .from('mutasi_antar_outlet')
    .select('*, mutasi_antar_outlet_item(*, bahan_baku(id, nama, satuan, satuan_tengah, satuan_kecil, faktor_tengah, faktor_tampilan, satuan_distribusi)), outlet_asal:outlets!outlet_asal_id(name), outlet_tujuan:outlets!outlet_tujuan_id(name)')
    .order('created_at', { ascending: false })

  // If outletId is provided, fetch mutasi where outlet is either asal or tujuan
  if (outletId) {
    query = query.or(`outlet_asal_id.eq.${outletId},outlet_tujuan_id.eq.${outletId}`)
  }

  const { data, error } = await query

  if (error) throw new Error(error.message)
  
  const rawData = data ?? []
  
  // Resolve staff names for creator, approver, and receiver
  const staffIds = [...new Set([
    ...rawData.map(d => d.created_by),
    ...rawData.map(d => d.approved_by),
    ...rawData.map(d => d.received_by)
  ].filter(Boolean))]
  
  let staffMap: Record<string, string> = {}
  if (staffIds.length > 0) {
    // service role client may be needed if RLS restricts staff reading, 
    // but typically staff can read outlet_staff. Let's try with auth client.
    const { data: staffData } = await supabase.from('outlet_staff').select('id, name').in('id', staffIds)
    if (staffData) {
      staffData.forEach(s => {
        staffMap[s.id] = s.name
      })
    }
  }

  return rawData.map(d => {
    return { 
      ...d, 
      creator: { name: staffMap[d.created_by] || 'Sistem' },
      approver: d.approved_by ? { name: staffMap[d.approved_by] } : undefined,
      receiver: d.received_by ? { name: staffMap[d.received_by] } : undefined,
      outlet_asal: d.outlet_asal ? { nama: (d.outlet_asal as any).name } : undefined,
      outlet_tujuan: d.outlet_tujuan ? { nama: (d.outlet_tujuan as any).name } : undefined,
      items: (d.mutasi_antar_outlet_item || []).map((item: any) => ({
        ...item,
        bahan_baku: item.bahan_baku ? {
          id: item.bahan_baku.id,
          nama: item.bahan_baku.nama,
          satuan: item.bahan_baku.satuan,
          satuan_tengah: item.bahan_baku.satuan_tengah,
          satuan_kecil: item.bahan_baku.satuan_kecil,
          faktor_tengah: item.bahan_baku.faktor_tengah,
          faktor_tampilan: item.bahan_baku.faktor_tampilan,
          satuan_distribusi: item.bahan_baku.satuan_distribusi,
        } : undefined
      }))
    } as unknown as MutasiAntarOutlet
  })
}

// ---------------------------------------------------------------------------
// fetchMutasiById — lihat detail 1 mutasi berdasarkan ID
// ---------------------------------------------------------------------------
export async function fetchMutasiById(id: string): Promise<MutasiAntarOutlet | null> {
  const supabase = await getAuthClient()
  
  const { data, error } = await supabase
    .from('mutasi_antar_outlet')
    .select('*, mutasi_antar_outlet_item(*, bahan_baku(id, nama, satuan, satuan_tengah, satuan_kecil, faktor_tengah, faktor_tampilan, satuan_distribusi)), outlet_asal:outlets!outlet_asal_id(name), outlet_tujuan:outlets!outlet_tujuan_id(name)')
    .eq('id', id)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!data) return null
  
  const staffIds = [data.created_by, data.approved_by, data.received_by].filter(Boolean) as string[]
  let staffMap: Record<string, string> = {}
  if (staffIds.length > 0) {
    const { data: staffData } = await supabase.from('outlet_staff').select('id, name').in('id', staffIds)
    if (staffData) {
      staffData.forEach(s => {
        staffMap[s.id] = s.name
      })
    }
  }

  return {
    ...data,
    creator: { name: staffMap[data.created_by] || 'Sistem' },
    approver: data.approved_by ? { name: staffMap[data.approved_by] } : undefined,
    receiver: data.received_by ? { name: staffMap[data.received_by] } : undefined,
    outlet_asal: data.outlet_asal ? { nama: (data.outlet_asal as any).name } : undefined,
    outlet_tujuan: data.outlet_tujuan ? { nama: (data.outlet_tujuan as any).name } : undefined,
    items: (data.mutasi_antar_outlet_item || []).map((item: any) => ({
      ...item,
      bahan_baku: item.bahan_baku ? {
        id: item.bahan_baku.id,
        nama: item.bahan_baku.nama,
        satuan: item.bahan_baku.satuan,
        satuan_tengah: item.bahan_baku.satuan_tengah,
        satuan_kecil: item.bahan_baku.satuan_kecil,
        faktor_tengah: item.bahan_baku.faktor_tengah,
        faktor_tampilan: item.bahan_baku.faktor_tampilan,
        satuan_distribusi: item.bahan_baku.satuan_distribusi,
      } : undefined
    }))
  } as unknown as MutasiAntarOutlet
}

// ---------------------------------------------------------------------------
// Action: Ajukan Mutasi
// ---------------------------------------------------------------------------
export async function ajukanMutasi(
  outletAsalId: string,
  outletTujuanId: string,
  catatan: string,
  items: { bahan_baku_id: string, qty_diajukan: number }[],
  namaKurir: string,
  ongkir: number
): Promise<MutasiActionResult<string>> {
  try {
    const supabase = await getAuthClient()

    // Wajib sejak migrasi 20300254001600; ditinjau Admin Kitchen saat persetujuan.
    if (!namaKurir?.trim()) return { success: false, error: 'Nama kurir wajib diisi' }
    if (!Number.isFinite(ongkir) || ongkir < 0) return { success: false, error: 'Ongkir wajib diisi (boleh 0)' }

    const { data, error } = await supabase.rpc('ajukan_mutasi', {
      p_outlet_asal_id: outletAsalId,
      p_outlet_tujuan_id: outletTujuanId,
      p_catatan: catatan,
      p_items: items,
      p_nama_kurir: namaKurir.trim(),
      p_ongkir: Math.round(ongkir)
    })
    
    if (error) return { success: false, error: formatMutasiError(error.message) }
    return { success: true, data: data as string }
  } catch (err: any) {
    return { success: false, error: formatMutasiError(err?.message || 'Gagal mengajukan mutasi') }
  }
}

// ---------------------------------------------------------------------------
// Action: Approve Mutasi
// ---------------------------------------------------------------------------
export async function approveMutasi(
  mutasiId: string,
  isApproved: boolean,
  catatanPenolakan?: string
): Promise<MutasiActionResult<void>> {
  try {
    const supabase = await getAuthClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return { success: false, error: 'Sesi login tidak valid. Silakan login kembali.' }
    }

    const { data: staff, error: staffError } = await supabase
      .from('outlet_staff')
      .select('role, status')
      .eq('id', user.id)
      .single()

    if (staffError || !staff || staff.status !== 'active' || !canApproveMutasi(staff.role)) {
      return { success: false, error: 'Hanya Admin Kitchen yang berhak menyetujui atau menolak mutasi' }
    }

    if (!isApproved && (!catatanPenolakan || !catatanPenolakan.trim())) {
      return { success: false, error: 'Alasan penolakan mutasi wajib diisi' }
    }

    const { error } = await supabase.rpc('approve_mutasi', {
      p_mutasi_id: mutasiId,
      p_is_approved: isApproved,
      p_catatan_penolakan: catatanPenolakan?.trim() || null
    })

    if (error) return { success: false, error: formatMutasiError(error.message) }
    return { success: true, data: undefined }
  } catch (err: any) {
    return { success: false, error: formatMutasiError(err?.message || 'Gagal memproses persetujuan mutasi') }
  }
}

// ---------------------------------------------------------------------------
// Action: Kirim Mutasi
// ---------------------------------------------------------------------------
export async function kirimMutasi(
  mutasiId: string,
  kurirInfo: any,
  itemsDikirim: { item_id: string, qty_dikirim: number }[]
): Promise<MutasiActionResult<void>> {
  try {
    const supabase = await getAuthClient()
    
    const { error } = await supabase.rpc('kirim_mutasi', {
      p_mutasi_id: mutasiId,
      p_kurir_info: kurirInfo,
      p_items_dikirim: itemsDikirim
    })
    
    if (error) return { success: false, error: formatMutasiError(error.message) }
    return { success: true, data: undefined }
  } catch (err: any) {
    return { success: false, error: formatMutasiError(err?.message || 'Gagal mengirim mutasi') }
  }
}

// ---------------------------------------------------------------------------
// Action: Terima Mutasi
// ---------------------------------------------------------------------------
export async function terimaMutasi(
  mutasiId: string,
  itemsDiterima: { item_id: string, qty_diterima: number, kondisi_diterima: string, foto_bukti_terima?: string }[]
): Promise<MutasiActionResult<void>> {
  try {
    const supabase = await getAuthClient()
    
    const { error } = await supabase.rpc('terima_mutasi', {
      p_mutasi_id: mutasiId,
      p_items_diterima: itemsDiterima
    })
    
    if (error) return { success: false, error: formatMutasiError(error.message) }
    return { success: true, data: undefined }
  } catch (err: any) {
    return { success: false, error: formatMutasiError(err?.message || 'Gagal menerima mutasi') }
  }
}
