'use server'

import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { createSupabaseServerClient } from '@suka/auth'
import { assertOutletAccessible } from '@/lib/stok/outletAccess'

const THRESHOLD_EDITOR_ROLES = ['spv', 'leader', 'regional_manager', 'admin', 'owner', 'kitchen', 'purchasing'] as const

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

/**
 * Gerbang otorisasi update reorder point untuk SATU outlet tertentu.
 *
 * Role check saja TIDAK CUKUP: leader adalah role multi-outlet-scoped (via
 * staff_outlets), bukan otomatis semua outlet seperti spv/kitchen/admin/owner
 * — tanpa cek assertOutletAccessible(), leader outlet A bisa mengubah
 * reorder point outlet B yang bukan tanggung jawabnya.
 */
async function requireThresholdEditor(outletId: string): Promise<string> {
  const authedClient = await getAuthedClient()
  const { data: { user }, error: userError } = await authedClient.auth.getUser()
  if (userError || !user) {
    throw new Error('Unauthorized: No active user session found')
  }
  const userId = user.id

  const { data: staff, error } = await makeServiceClient()
    .from('outlet_staff')
    .select('role, status')
    .eq('id', userId)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!staff || staff.status !== 'active' || !(THRESHOLD_EDITOR_ROLES as readonly string[]).includes(staff.role)) {
    throw new Error('Forbidden: hanya SPV/Leader/Kitchen/Admin/Owner yang boleh mengubah reorder point')
  }

  await assertOutletAccessible(authedClient, outletId)

  return userId
}

export async function updateThresholdAction(outletId: string, bahanBakuId: string, value: number) {
  await requireThresholdEditor(outletId)
  const supabase = makeServiceClient();
  const { error } = await supabase
    .from('outlet_reorder_point')
    .upsert({
      outlet_id: outletId,
      bahan_baku_id: bahanBakuId,
      reorder_point: value,
      updated_at: new Date().toISOString()
    }, {
      onConflict: 'outlet_id,bahan_baku_id'
    });

  if (error) {
    throw new Error(error.message);
  }
}

