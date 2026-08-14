'use server'

import { createClient } from '@supabase/supabase-js'

function getAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://khpkoreaaucvyqfhynfq.supabase.co'
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtocGtvcmVhYXVjdnlxZmh5bmZxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDk2MzI5MiwiZXhwIjoyMDk2NTM5MjkyfQ.Dy0QMAHfB8EU9BK-JuyRrBidpG6iM94t9RtiJ_viZz8'
  return createClient(supabaseUrl, serviceKey)
}

export async function getAreaManagerPettyCashTopups() {
  try {
    const supabase = getAdminClient()

    // 1. Get all outlets
    const { data: outlets, error: outletErr } = await supabase
      .from('outlets')
      .select('id, name, region')

    if (outletErr) throw outletErr

    const allOutlets = outlets || []
    const outletIds = allOutlets.map(o => o.id)
    const outletMap = new Map(allOutlets.map(o => [o.id, o]))

    if (outletIds.length === 0) {
      return { success: true, data: [] }
    }

    // 2. Fetch topups for all outlets
    const { data: topups, error: topupErr } = await supabase
      .from('petty_cash_topups')
      .select('id, outlet_id, amount, description, status, created_at, created_by, bank_name, bank_account_number, bank_account_name, proof_of_transfer_url')
      .in('outlet_id', outletIds)
      .order('created_at', { ascending: false })
      .limit(100)

    if (topupErr) throw topupErr

    // 3. Fetch staff names for created_by
    const createdByIds = Array.from(new Set((topups || []).map(t => t.created_by).filter(Boolean)))
    let staffMap = new Map<string, { name: string; role: string }>()
    if (createdByIds.length > 0) {
      const { data: staffList } = await supabase
        .from('outlet_staff')
        .select('id, name, role')
        .in('id', createdByIds)
      if (staffList) {
        staffMap = new Map(staffList.map(s => [s.id, { name: s.name, role: s.role }]))
      }
    }

    const formattedData = (topups || []).map(r => ({
      ...r,
      created_by_staff: r.created_by ? staffMap.get(r.created_by) || null : null,
      outlets: outletMap.get(r.outlet_id) || null
    }))

    return { success: true, data: formattedData, outlets: allOutlets }
  } catch (err: any) {
    console.error('Error fetching AM petty cash:', err)
    return { success: false, error: err.message, data: [], outlets: [] }
  }
}
