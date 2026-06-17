'use server'
import { cookies } from 'next/headers'
import { createSupabaseServerClient } from '@suka/auth'
import type { PermintaanWithItems, BuatPermintaanItemInput, ApproveItemInput } from '@/types/permintaan'

// ---------------------------------------------------------------------------
// Helper: buat server-side supabase client (baca session dari cookies server)
// ---------------------------------------------------------------------------

async function makeServerClient() {
  const cookieStore = await cookies()
  return createSupabaseServerClient({
    getAll: () => cookieStore.getAll(),
    setAll: (toSet) =>
      toSet.forEach(({ name, value, options }) =>
        cookieStore.set(name, value, options as Parameters<typeof cookieStore.set>[2])
      ),
  })
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
// fetchPermintaanOutlet — untuk crew (riwayat outlet sendiri)
// ---------------------------------------------------------------------------

export async function fetchPermintaanOutlet(outletId: string): Promise<PermintaanWithItems[]> {
  const supabase = await makeServerClient()
  const { data, error } = await supabase
    .from('permintaan_bahan')
    .select('*, permintaan_bahan_item(*, bahan_baku(nama)), outlets(name)')
    .eq('outlet_id', outletId)
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)
  return (data ?? []).map(mapRow)
}

// ---------------------------------------------------------------------------
// fetchPermintaanPending — untuk kitchen/spv/admin approval list
// ---------------------------------------------------------------------------

export async function fetchPermintaanPending(): Promise<PermintaanWithItems[]> {
  const supabase = await makeServerClient()

  // --- DEBUG: cek auth uid di server ---
  const { data: { user } } = await supabase.auth.getUser()
  // eslint-disable-next-line no-console
  console.log('[fetchPermintaanPending] server auth uid:', user?.id ?? 'ANON/NULL')

  // --- DEBUG: service-role bypass RLS untuk lihat total semua permintaan ---
  const { createClient: createServiceClient } = await import('@supabase/supabase-js')
  const svc = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
  const { data: allData, error: allErr } = await svc
    .from('permintaan_bahan')
    .select('id, outlet_id, status, created_at')
    .order('created_at', { ascending: false })
    .limit(10)
  // eslint-disable-next-line no-console
  console.log('[fetchPermintaanPending] SERVICE ROLE - semua permintaan (max 10):', JSON.stringify(allData), 'err:', allErr?.message)

  // --- Query normal via user session ---
  const { data, error } = await supabase
    .from('permintaan_bahan')
    .select('*, permintaan_bahan_item(*, bahan_baku(nama)), outlets(name)')
    .eq('status', 'menunggu')
    .order('created_at', { ascending: false })

  // eslint-disable-next-line no-console
  console.log('[fetchPermintaanPending] user-session result count:', data?.length ?? 0, 'error:', error?.message ?? null)

  if (error) throw new Error(error.message)
  return (data ?? []).map(mapRow)
}

// ---------------------------------------------------------------------------
// buatPermintaan — crew buat permintaan baru
// ---------------------------------------------------------------------------

export async function buatPermintaan(
  outletId: string,
  items: BuatPermintaanItemInput[]
): Promise<void> {
  const supabase = await makeServerClient()
  const { error } = await supabase.rpc('buat_permintaan', {
    p_outlet_id: outletId,
    p_items: items,
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
  const supabase = await makeServerClient()
  const { error } = await supabase.rpc('approve_permintaan', {
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
  const supabase = await makeServerClient()
  const { error } = await supabase.rpc('tolak_permintaan', {
    p_permintaan_id: permintaanId,
    p_alasan: alasan,
  })
  if (error) throw new Error(error.message)
}
