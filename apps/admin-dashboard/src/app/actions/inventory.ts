'use server'

import { createClient } from '@supabase/supabase-js'
import { dispatchRequest } from '@/lib/inventory'

// Inisialisasi Supabase menggunakan Service Role agar bisa bypass RLS saat eksekusi backend
function getSupabase() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
  return createClient(supabaseUrl, supabaseKey)
}

/**
 * Server Action: Memproses dan mengirim request dari Kitchen ke Outlet (FIFO).
 */
export async function dispatchRequestAction(params: {
  requestId: string
  kitchenLocationId: string
}) {
  try {
    const supabase = getSupabase()
    const result = await dispatchRequest(supabase, params)
    return result // returns { success, message }
  } catch (error: any) {
    console.error('Failed to dispatch request:', error)
    return { success: false, error: error.message || 'Terjadi kesalahan saat memproses FIFO dispatch.' }
  }
}

/**
 * Server Action: Outlet membuat request barang ke Kitchen.
 */
export async function createRequestAction(params: {
  outletId: string
  items: {
    itemId: string
    requestedUnitId: string
    requestedQty: number
    convertedBaseQty: number // Di form UI sebaiknya dihitung setelah pilih satuan
  }[]
}) {
  try {
    const supabase = getSupabase()
    
    // 1. Buat Request Header
    const { data: reqData, error: reqError } = await supabase
      .from('internal_requests')
      .insert({
        outlet_id: params.outletId,
        status: 'PENDING'
      })
      .select()
      .single()

    if (reqError || !reqData) throw new Error(reqError?.message || 'Gagal membuat request')

    // 2. Buat Request Items
    const itemsToInsert = params.items.map(it => ({
      request_id: reqData.id,
      item_id: it.itemId,
      requested_unit_id: it.requestedUnitId,
      requested_qty: it.requestedQty,
      converted_base_qty: it.convertedBaseQty
    }))

    const { error: itemsError } = await supabase
      .from('internal_request_items')
      .insert(itemsToInsert)

    if (itemsError) throw new Error(itemsError.message)

    return { success: true, data: reqData }
  } catch (error: any) {
    console.error('Failed to create request:', error)
    return { success: false, error: error.message || 'Terjadi kesalahan saat membuat request.' }
  }
}

