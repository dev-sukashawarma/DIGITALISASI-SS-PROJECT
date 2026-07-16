'use server'

import { createClient } from '@supabase/supabase-js'

function makeServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function updateThresholdAction(outletId: string, bahanBakuId: string, value: number) {
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
