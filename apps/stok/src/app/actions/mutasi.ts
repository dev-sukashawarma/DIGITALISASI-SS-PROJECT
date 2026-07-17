'use server'
import { cookies } from 'next/headers'
import { createSupabaseServerClient } from '@suka/auth'
import type { MutasiAntarOutlet } from '@/lib/types/mutasi'

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
// fetchMutasiList — lihat mutasi berdasarkan outlet terkait
// ---------------------------------------------------------------------------
export async function fetchMutasiList(outletId?: string): Promise<MutasiAntarOutlet[]> {
  const supabase = await getAuthClient()
  
  let query = supabase
    .from('mutasi_antar_outlet')
    .select('*, mutasi_antar_outlet_item(*, bahan_baku(nama, satuan)), outlet_asal:outlets!outlet_asal_id(name), outlet_tujuan:outlets!outlet_tujuan_id(name)')
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
        bahan_baku: item.bahan_baku ? { nama: item.bahan_baku.nama, satuan: item.bahan_baku.satuan } : undefined
      }))
    } as unknown as MutasiAntarOutlet
  })
}

// ---------------------------------------------------------------------------
// Action: Ajukan Mutasi
// ---------------------------------------------------------------------------
export async function ajukanMutasi(
  outletAsalId: string,
  outletTujuanId: string,
  catatan: string,
  items: { bahan_baku_id: string, qty_diajukan: number }[]
): Promise<void> {
  const supabase = await getAuthClient()
  
  const { error } = await supabase.rpc('ajukan_mutasi', {
    p_outlet_asal_id: outletAsalId,
    p_outlet_tujuan_id: outletTujuanId,
    p_catatan: catatan,
    p_items: items
  })
  
  if (error) throw new Error(error.message)
}

// ---------------------------------------------------------------------------
// Action: Approve Mutasi
// ---------------------------------------------------------------------------
export async function approveMutasi(
  mutasiId: string,
  isApproved: boolean,
  catatanPenolakan?: string
): Promise<void> {
  const supabase = await getAuthClient()
  
  const { error } = await supabase.rpc('approve_mutasi', {
    p_mutasi_id: mutasiId,
    p_is_approved: isApproved,
    p_catatan_penolakan: catatanPenolakan || null
  })
  
  if (error) throw new Error(error.message)
}

// ---------------------------------------------------------------------------
// Action: Kirim Mutasi
// ---------------------------------------------------------------------------
export async function kirimMutasi(
  mutasiId: string,
  kurirInfo: any,
  itemsDikirim: { item_id: string, qty_dikirim: number }[]
): Promise<void> {
  const supabase = await getAuthClient()
  
  const { error } = await supabase.rpc('kirim_mutasi', {
    p_mutasi_id: mutasiId,
    p_kurir_info: kurirInfo,
    p_items_dikirim: itemsDikirim
  })
  
  if (error) throw new Error(error.message)
}

// ---------------------------------------------------------------------------
// Action: Terima Mutasi
// ---------------------------------------------------------------------------
export async function terimaMutasi(
  mutasiId: string,
  itemsDiterima: { item_id: string, qty_diterima: number, kondisi_diterima: string, foto_bukti_terima?: string }[]
): Promise<void> {
  const supabase = await getAuthClient()
  
  const { error } = await supabase.rpc('terima_mutasi', {
    p_mutasi_id: mutasiId,
    p_items_diterima: itemsDiterima
  })
  
  if (error) throw new Error(error.message)
}
