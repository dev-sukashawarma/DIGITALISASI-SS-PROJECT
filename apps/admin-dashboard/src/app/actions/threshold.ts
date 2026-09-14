'use server'

import { createServiceClient } from '@/lib/supabase/server'
import { requireRole, assertOutletAccessible } from '@/lib/authz'

const THRESHOLD_EDITOR_ROLES = ['admin', 'owner', 'spv', 'kitchen', 'purchasing', 'leader']

export async function updateThresholdAction(outletId: string, bahanBakuId: string, value: number) {
  await requireRole(THRESHOLD_EDITOR_ROLES)
  await assertOutletAccessible(outletId)

  const supabase = createServiceClient()
  const { error } = await supabase
    .from('outlet_reorder_point')
    .upsert({
      outlet_id: outletId,
      bahan_baku_id: bahanBakuId,
      reorder_point: value,
      updated_at: new Date().toISOString()
    }, {
      onConflict: 'outlet_id,bahan_baku_id'
    })

  if (error) {
    throw new Error(error.message)
  }

  return { success: true }
}
