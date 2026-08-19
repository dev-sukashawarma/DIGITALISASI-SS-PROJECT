// apps/stok/src/app/actions/budget.ts
'use server'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { createSupabaseServerClient } from '@suka/auth'
import type { BudgetStatus, PeriodType } from '@/lib/stok/budget'
import { assertOutletAccessible } from '@/lib/stok/outletAccess'

// ---------------------------------------------------------------------------
// Service role client — bypass RLS. WAJIB dipagari gerbang otorisasi sendiri
// di tiap action (mirror app/actions/permintaan.ts) -- 'use server' bukan
// privat, Server Action bisa dipanggil langsung tanpa lewat halaman mana pun.
// ---------------------------------------------------------------------------

function makeServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL! || 'https://khpkoreaaucvyqfhynfq.supabase.co'
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY! || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtocGtvcmVhYXVjdnlxZmh5bmZxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA5NjMyOTIsImV4cCI6MjA5NjUzOTI5Mn0.RdsvP6OKs6aiRnqqd02BYiv5gzbh4uGqO88dapo0Gso'
  return createClient(url, key)
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

/** Gerbang minimal untuk aksi read-only ringan (estimasi nilai) -- cukup staff aktif. */
async function requireActiveStaff(): Promise<string> {
  const authedClient = await getAuthedClient()
  const userId = await getCurrentUserId(authedClient)

  const { data: staff, error } = await makeServiceClient()
    .from('outlet_staff')
    .select('status')
    .eq('id', userId)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!staff || staff.status !== 'active') {
    throw new Error('Forbidden: akun tidak aktif')
  }
  return userId
}

function mapBudgetRow(row: any, outletId: string): BudgetStatus {
  return {
    outletId,
    nominal: Number(row?.nominal ?? 0),
    periodType: (row?.period_type ?? null) as PeriodType | null,
    periodStart: row?.period_start ?? null,
    periodEnd: row?.period_end ?? null,
    terpakai: Number(row?.terpakai ?? 0),
    sisa: Number(row?.sisa ?? 0),
    hasConfig: !!row?.has_config,
    customDays: row?.custom_days != null ? Number(row.custom_days) : null,
  }
}

// ---------------------------------------------------------------------------
// getOutletBudgetStatus — crew (outlet sendiri) atau approver (semua accessible)
// ---------------------------------------------------------------------------

export async function getOutletBudgetStatus(outletId: string): Promise<BudgetStatus> {
  const authedClient = await getAuthedClient()
  await getCurrentUserId(authedClient)
  await assertOutletAccessible(authedClient, outletId)

  const supabase = makeServiceClient()
  const { data, error } = await supabase.rpc('get_outlet_budget_status', { p_outlet_id: outletId })
  if (error) throw new Error(error.message)
  const row = Array.isArray(data) ? data[0] : data
  return mapBudgetRow(row, outletId)
}

// ---------------------------------------------------------------------------
// estimateCartValue — estimasi nilai Rupiah tanpa expose harga per-item ke client
// ---------------------------------------------------------------------------

export async function estimateCartValue(
  items: { bahan_baku_id: string; qty: number }[]
): Promise<{ totalNilai: number; itemTanpaHarga: string[] }> {
  await requireActiveStaff()

  if (items.length === 0) return { totalNilai: 0, itemTanpaHarga: [] }

  const supabase = makeServiceClient()
  const { data, error } = await supabase.rpc('estimate_permintaan_value', {
    p_items: items.map((it) => ({ bahan_baku_id: it.bahan_baku_id, qty: it.qty })),
  })
  if (error) throw new Error(error.message)
  const row = Array.isArray(data) ? data[0] : data
  return {
    totalNilai: Number(row?.total_nilai ?? 0),
    itemTanpaHarga: (row?.item_tanpa_harga ?? []) as string[],
  }
}
