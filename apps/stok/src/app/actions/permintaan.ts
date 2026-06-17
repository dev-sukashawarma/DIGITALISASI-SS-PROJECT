'use server'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { createSupabaseServerClient } from '@suka/auth'
import type { PermintaanWithItems, BuatPermintaanItemInput, ApproveItemInput } from '@/types/permintaan'

// ---------------------------------------------------------------------------
// Service role client — bypass RLS, dipakai untuk semua permintaan actions.
// Aman karena:
//  1. File ini hanya dieksekusi server-side ('use server')
//  2. Role check dilakukan middleware (redirect ke portal jika bukan spv/admin/owner)
//  3. Page-level guard isKitchen = outletStaff.role in [admin,spv,owner] | kitchenOutlet
// ---------------------------------------------------------------------------

function makeServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

async function getCurrentUserId(): Promise<string> {
  const cookieStore = await cookies()
  const supabase = createSupabaseServerClient({
    getAll: () => cookieStore.getAll(),
    setAll: (toSet) =>
      toSet.forEach(({ name, value, options }) =>
        cookieStore.set(name, value, options as any)
      ),
  })
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) {
    throw new Error('Unauthorized: No active user session found')
  }
  return user.id
}

function mapRow(row: any): PermintaanWithItems {
  const outlet_name = row.outlets?.name ?? undefined
  const { outlets, permintaan_bahan_item, ...rest } = row
  return {
    ...rest,
    items: (permintaan_bahan_item ?? []).map((it: any) => ({
      ...it,
      nama: it.bahan_baku?.nama ?? it.bahan_baku_id,
    })),
    outlet_name,
  } as PermintaanWithItems
}

// ---------------------------------------------------------------------------
// fetchPermintaanOutlet — crew lihat riwayat outlet sendiri
// ---------------------------------------------------------------------------

export async function fetchPermintaanOutlet(outletId: string): Promise<PermintaanWithItems[]> {
  const supabase = makeServiceClient()
  const { data, error } = await supabase
    .from('permintaan_bahan')
    .select('*, permintaan_bahan_item(*, bahan_baku(nama)), outlets(name)')
    .eq('outlet_id', outletId)
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)
  return (data ?? []).map(mapRow)
}

// ---------------------------------------------------------------------------
// fetchPermintaanPending — kitchen/spv/admin lihat semua yang menunggu approval
// ---------------------------------------------------------------------------

export async function fetchPermintaanPending(): Promise<PermintaanWithItems[]> {
  const supabase = makeServiceClient()
  const { data, error } = await supabase
    .from('permintaan_bahan')
    .select('*, permintaan_bahan_item(*, bahan_baku(nama)), outlets(name)')
    .eq('status', 'menunggu')
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)
  return (data ?? []).map(mapRow)
}

// ---------------------------------------------------------------------------
// buatPermintaan — crew kirim permintaan baru
// Pakai service role agar tidak bergantung pada browser refresh-token
// ---------------------------------------------------------------------------

export async function buatPermintaan(
  outletId: string,
  items: BuatPermintaanItemInput[]
): Promise<void> {
  const supabase = makeServiceClient()
  const currentUserId = await getCurrentUserId()
  const { error } = await supabase.rpc('buat_permintaan_svc', {
    p_outlet_id: outletId,
    p_items: items,
    p_dibuat_oleh: currentUserId,
  })
  if (error) throw new Error(error.message)
}

// ---------------------------------------------------------------------------
// approvePermintaan — kitchen/spv setujui permintaan
// ---------------------------------------------------------------------------

export async function approvePermintaan(
  permintaanId: string,
  items: ApproveItemInput[]
): Promise<void> {
  const supabase = makeServiceClient()
  const { error } = await supabase.rpc('approve_permintaan_svc', {
    p_permintaan_id: permintaanId,
    p_items: items,
  })
  if (error) throw new Error(error.message)
}

// ---------------------------------------------------------------------------
// tolakPermintaan — kitchen/spv tolak permintaan
// ---------------------------------------------------------------------------

export async function tolakPermintaan(
  permintaanId: string,
  alasan: string
): Promise<void> {
  const supabase = makeServiceClient()
  const { error } = await supabase.rpc('tolak_permintaan_svc', {
    p_permintaan_id: permintaanId,
    p_alasan: alasan,
  })
  if (error) throw new Error(error.message)
}
