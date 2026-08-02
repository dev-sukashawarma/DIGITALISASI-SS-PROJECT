'use server'

import { createClient } from '@supabase/supabase-js'
import { headers } from 'next/headers'
import { parseStaffHeader, STAFF_HEADER } from '@suka/auth'

function getAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  return createClient(supabaseUrl, serviceKey)
}

export async function getAreaManagerPettyCashTopups(selectedOutletId: string | null = null) {
  try {
    const headersList = await headers()
    const staff = parseStaffHeader(headersList.get(STAFF_HEADER))
    
    if (!staff) {
      throw new Error("Unauthorized")
    }

    const supabase = getAdminClient()

    // 1. Get all assigned outlets for this staff
    let outletQuery = supabase.from('outlets').select('id, name, region').eq('is_active', true)
    
    if (staff.role === 'area_manager') {
      const { data: so } = await supabase.from('staff_outlets').select('outlet_id').eq('staff_id', staff.id)
      if (so && so.length > 0) {
        outletQuery = outletQuery.in('id', so.map((s: any) => s.outlet_id))
      } else {
        return { success: true, data: [], outlets: [] } // No assigned outlets
      }
    }
    
    const { data: outlets, error: outletErr } = await outletQuery
    if (outletErr) throw outletErr

    const allOutlets = outlets || []
    const outletIds = allOutlets.map(o => o.id)
    const outletMap = new Map(allOutlets.map(o => [o.id, o]))

    if (outletIds.length === 0) {
      return { success: true, data: [], outlets: [] }
    }

    // Determine which outlets to fetch topups for
    let targetOutletIds = outletIds
    if (selectedOutletId && selectedOutletId !== 'all') {
      // Ensure the selected outlet is one of the assigned outlets
      if (outletIds.includes(selectedOutletId)) {
        targetOutletIds = [selectedOutletId]
      } else {
        return { success: false, error: "Unauthorized access to this outlet", data: [], outlets: allOutlets }
      }
    }

    // 2. Fetch topups for target outlets
    const { data: topups, error: topupErr } = await supabase
      .from('petty_cash_topups')
      .select('id, outlet_id, amount, description, status, created_at, created_by, bank_name, bank_account_number, bank_account_name, proof_of_transfer_url')
      .in('outlet_id', targetOutletIds)
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
