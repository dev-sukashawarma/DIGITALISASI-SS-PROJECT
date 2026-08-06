'use server'

import { createClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/authz'

export async function fetchOrdersGlobal(limit = 50, filterOutletId = '') {
  await requireRole(['developer'])
  const supabase = await createClient()
  
  let query = supabase
    .from('pos_sales')
    .select(`
      id,
      receipt_number,
      outlet_id,
      outlets:outlet_id (name),
      total_amount,
      payment_method,
      order_source,
      status,
      created_at
    `)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (filterOutletId && filterOutletId.trim() !== '') {
    query = query.eq('outlet_id', filterOutletId)
  }

  const { data, error } = await query

  if (error) {
    throw new Error(error.message)
  }

  return data
}
