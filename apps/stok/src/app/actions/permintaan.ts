'use server'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { createSupabaseServerClient } from '@suka/auth'
import { canApprovePermintaan, isApproverRole } from '@/lib/stok/approver'
import { assertOutletAccessible, getAccessibleOutletIds } from '@/lib/stok/outletAccess'
import type { PermintaanWithItems, BuatPermintaanItemInput, ApproveItemInput } from '@/types/permintaan'

// ---------------------------------------------------------------------------
// Service role client — bypass RLS, dipakai untuk semua permintaan actions.
//
// ⚠️ JANGAN andalkan middleware atau guard halaman sebagai pengaman di sini:
//  - `'use server'` TIDAK berarti privat. Setiap export adalah endpoint POST
//    yang bisa dipanggil langsung oleh siapa pun yang punya sesi, tanpa lewat
//    halaman mana pun.
//  - Middleware hanya cek `hasAppAccess(role, 'stok')` — crew pun lolos.
//  - Guard halaman berjalan di browser; tidak melindungi Server Action.
//
// Karena itu setiap action yang mengubah data WAJIB memanggil gerbang
// otorisasinya sendiri (lihat `requirePermintaanApprover`) — apalagi RPC
// `*_svc` di DB adalah SECURITY DEFINER tanpa pemeriksaan role.
// ---------------------------------------------------------------------------

function makeServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

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

async function getCurrentUserId(supabase: Awaited<ReturnType<typeof getAuthedClient>>): Promise<string> {
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) {
    throw new Error('Unauthorized: No active user session found')
  }
  return user.id
}

/**
 * Gerbang otorisasi server-side untuk approval permintaan bahan.
 *
 * WAJIB dipanggil sebelum menyentuh service-role client. RPC
 * `approve_permintaan_svc` / `tolak_permintaan_svc` adalah SECURITY DEFINER dan
 * TIDAK memeriksa role pemanggil sama sekali (hanya cek `status='menunggu'`),
 * sedangkan `makeServiceClient()` mem-bypass RLS — dan approval menerbitkan
 * surat jalan lewat `create_surat_jalan()`. Server Action = endpoint POST yang
 * bisa dipanggil siapa pun yang punya sesi, jadi guard di UI tidak melindungi
 * apa pun.
 */
async function requirePermintaanApprover(): Promise<string> {
  const authedClient = await getAuthedClient()
  const userId = await getCurrentUserId(authedClient)

  const { data: staff, error } = await makeServiceClient()
    .from('outlet_staff')
    .select('role, status')
    .eq('id', userId)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!staff || staff.status !== 'active' || !canApprovePermintaan(staff.role)) {
    throw new Error(
      'Forbidden: hanya Gudang Pusat (kitchen) atau admin/owner yang boleh memproses permintaan bahan'
    )
  }

  // Tidak perlu assertOutletAccessible: semua role di canApprovePermintaan
  // (kitchen/admin/owner) sudah privileged untuk SEMUA outlet di
  // accessible_outlet_ids() — beda dengan opname/waste/threshold yang
  // approver-nya termasuk 'leader' (multi-outlet-scoped).
  return userId
}

/**
 * Gerbang untuk melihat (bukan memutuskan) daftar permintaan pending —
 * kitchen/spv/leader/admin/owner ("approver (leader/SPV/kitchen) perlu
 * melihat request dari semua outlet accessible baginya", lihat komentar di
 * useApprovalList). Mengembalikan outlet mana saja yang boleh dilihat supaya
 * query di-filter, bukan dibiarkan unrestricted lintas semua outlet.
 */
async function requirePermintaanViewer(): Promise<Set<string>> {
  const authedClient = await getAuthedClient()
  const userId = await getCurrentUserId(authedClient)

  const { data: staff, error } = await makeServiceClient()
    .from('outlet_staff')
    .select('role, status')
    .eq('id', userId)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!staff || staff.status !== 'active' || !(isApproverRole(staff.role) || canApprovePermintaan(staff.role))) {
    throw new Error('Forbidden: hanya leader/SPV/RM/kitchen/admin/owner yang boleh melihat daftar permintaan pending')
  }

  return getAccessibleOutletIds(authedClient)
}

function mapRow(row: any): PermintaanWithItems {
  const outlet_name = row.outlets?.name ?? undefined
  const { outlets, permintaan_bahan_item, ...rest } = row
  return {
    ...rest,
    items: (permintaan_bahan_item ?? []).map((it: any) => ({
      ...it,
      nama: it.bahan_baku?.nama ?? it.bahan_baku_id,
      satuan: it.bahan_baku?.satuan,
    })),
    outlet_name,
  } as PermintaanWithItems
}

// ---------------------------------------------------------------------------
// fetchPermintaanOutlet — crew lihat riwayat outlet sendiri
// ---------------------------------------------------------------------------

export async function fetchPermintaanOutlet(outletId: string): Promise<PermintaanWithItems[]> {
  const authedClient = await getAuthedClient()
  await getCurrentUserId(authedClient)
  await assertOutletAccessible(authedClient, outletId)

  const supabase = makeServiceClient()
  const { data, error } = await supabase
    .from('permintaan_bahan')
    .select('*, permintaan_bahan_item(*, bahan_baku(nama, satuan)), outlets(name)')
    .eq('outlet_id', outletId)
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)
  
  const rawData = data ?? []
  const staffIds = [...new Set(rawData.map(d => d.dibuat_oleh).filter(Boolean))]
  let staffMap: Record<string, string> = {}
  
  if (staffIds.length > 0) {
    const { data: staffData } = await supabase.from('outlet_staff').select('id, name').in('id', staffIds)
    if (staffData) {
      staffData.forEach(s => {
        staffMap[s.id] = s.name
      })
    }
  }

  return rawData.map(d => {
    const res = mapRow(d)
    return { ...res, staff_name: staffMap[d.dibuat_oleh] || 'Sistem' }
  })
}

// ---------------------------------------------------------------------------
// fetchPermintaanPending — kitchen/spv/admin lihat semua yang menunggu approval
// ---------------------------------------------------------------------------

export async function fetchPermintaanPending(): Promise<PermintaanWithItems[]> {
  const allowedOutletIds = await requirePermintaanViewer()

  const supabase = makeServiceClient()
  const { data, error } = await supabase
    .from('permintaan_bahan')
    .select('*, permintaan_bahan_item(*, bahan_baku(nama, satuan)), outlets(name)')
    .eq('status', 'menunggu')
    .in('outlet_id', Array.from(allowedOutletIds))
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)
  
  const rawData = data ?? []
  const staffIds = [...new Set(rawData.map(d => d.dibuat_oleh).filter(Boolean))]
  let staffMap: Record<string, string> = {}
  
  if (staffIds.length > 0) {
    const { data: staffData } = await supabase.from('outlet_staff').select('id, name').in('id', staffIds)
    if (staffData) {
      staffData.forEach(s => {
        staffMap[s.id] = s.name
      })
    }
  }

  return rawData.map(d => {
    const res = mapRow(d)
    return { ...res, staff_name: staffMap[d.dibuat_oleh] || 'Sistem' }
  })
}

// ---------------------------------------------------------------------------
// buatPermintaan — crew kirim permintaan baru
// Pakai service role agar tidak bergantung pada browser refresh-token
// ---------------------------------------------------------------------------

export async function buatPermintaan(
  outletId: string,
  items: BuatPermintaanItemInput[],
  targetMetadata?: any
): Promise<void> {
  const authedClient = await getAuthedClient()
  const currentUserId = await getCurrentUserId(authedClient)
  await assertOutletAccessible(authedClient, outletId)

  const supabase = makeServiceClient()
  const { error } = await supabase.rpc('buat_permintaan_svc', {
    p_outlet_id: outletId,
    p_items: items,
    p_dibuat_oleh: currentUserId,
    p_target_metadata: targetMetadata ?? []
  })
  if (error) {
    // Next.js menyembunyikan message asli dari Server Action error di production
    // (redacted jadi "digest"-only) — log di server supaya masih bisa ditelusuri.
    console.error('[buatPermintaan] RPC buat_permintaan_svc gagal:', error)
    throw new Error(error.message)
  }
}

// ---------------------------------------------------------------------------
// approvePermintaan — kitchen/spv setujui permintaan
// ---------------------------------------------------------------------------

export async function approvePermintaan(
  permintaanId: string,
  items: ApproveItemInput[]
): Promise<void> {
  await requirePermintaanApprover()
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
  await requirePermintaanApprover()
  const supabase = makeServiceClient()
  const { error } = await supabase.rpc('tolak_permintaan_svc', {
    p_permintaan_id: permintaanId,
    p_alasan: alasan,
  })
  if (error) throw new Error(error.message)
}

// ---------------------------------------------------------------------------
// fetchCrosscheckStok — ambil sisa stok peminta dan stok gudang
// ---------------------------------------------------------------------------
export async function fetchCrosscheckStok(
  outletId: string,
  bahanBakuIds: string[]
): Promise<Record<string, { outletStok: number; gudangStok: number }>> {
  // Dipakai dari ApprovalModal yang dibuka oleh viewer maupun approver.
  // Cukup viewer-level (spv/leader/kitchen/admin/owner); approve/tolak
  // sendiri tetap memanggil requirePermintaanApprover di action-nya.
  await requirePermintaanViewer()

  if (!bahanBakuIds.length) return {}

  const result: Record<string, { outletStok: number; gudangStok: number }> = {}
  for (const id of bahanBakuIds) {
    result[id] = { outletStok: 0, gudangStok: 0 }
  }

  const supabase = makeServiceClient()

  try {
    // 1. Cari ID Gudang Pusat
    const { data: gudang, error: gudangError } = await supabase
      .from('outlets')
      .select('id')
      .ilike('name', '%GUDANG PUSAT%')
      .single()

    if (gudangError && gudangError.code !== 'PGRST116') {
      console.error('Error fetching gudang pusat:', gudangError)
    }

    const gudangId = gudang?.id

    // 2. Fetch stok outlet peminta
    const { data: outletStok, error: outletStokError } = await supabase
      .from('stok_balance')
      .select('bahan_baku_id, saldo')
      .eq('outlet_id', outletId)
      .in('bahan_baku_id', bahanBakuIds)

    if (outletStokError) {
      console.error('Error fetching outlet stok:', outletStokError)
    }

    // 3. Fetch stok gudang pusat
    let gudangStok: { bahan_baku_id: string; saldo: number }[] = []
    if (gudangId) {
      const { data, error: gudangStokError } = await supabase
        .from('stok_balance')
        .select('bahan_baku_id, saldo')
        .eq('outlet_id', gudangId)
        .in('bahan_baku_id', bahanBakuIds)

      if (gudangStokError) {
        console.error('Error fetching gudang stok:', gudangStokError)
      }
      gudangStok = data || []
    }

    // 4. Map hasil
    outletStok?.forEach(s => {
      if (result[s.bahan_baku_id]) result[s.bahan_baku_id].outletStok = s.saldo
    })

    gudangStok.forEach(s => {
      if (result[s.bahan_baku_id]) result[s.bahan_baku_id].gudangStok = s.saldo
    })

    return result
  } catch (error) {
    console.error('Error in fetchCrosscheckStok:', error)
    return result
  }
}
