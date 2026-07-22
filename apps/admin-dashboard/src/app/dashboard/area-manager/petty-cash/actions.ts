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

    // 1. Get Bogor region outlets (or unassigned/HQ)
    const { data: outlets, error: outletErr } = await supabase
      .from('outlets')
      .select('id, name, region')

    if (outletErr) throw outletErr

    const bogorOutlets = (outlets || []).filter(o => !o.region || o.region.toUpperCase() === 'BOGOR')
    const bogorOutletIds = bogorOutlets.map(o => o.id)
    const outletMap = new Map(bogorOutlets.map(o => [o.id, o]))

    if (bogorOutletIds.length === 0) {
      return { success: true, data: [] }
    }

    // 2. Fetch topups for Bogor outlets only, limited to recent 100 entries for fast response
    const { data: topups, error: topupErr } = await supabase
      .from('petty_cash_topups')
      .select('id, outlet_id, amount, description, status, created_at, bank_name, bank_account_number, bank_account_name')
      .in('outlet_id', bogorOutletIds)
      .order('created_at', { ascending: false })
      .limit(100)

    if (topupErr) throw topupErr

    const formattedData = (topups || []).map(r => ({
      ...r,
      outlets: outletMap.get(r.outlet_id) || null
    }))

    return { success: true, data: formattedData }
  } catch (err: any) {
    console.error('Error fetching AM petty cash:', err)
    return { success: false, error: err.message, data: [] }
  }
}
