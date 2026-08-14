import { SupabaseClient } from '@supabase/supabase-js'

// --- TypeScript Types ---

export interface InventoryUnit {
  id: string
  name: string
  description: string | null
}

export interface InventoryItem {
  id: string
  name: string
  base_unit_id: string
}

export interface InventoryConversion {
  id: string
  item_id: string
  unit_id: string
  multiplier_to_base: number
}

export interface InventoryBatch {
  id: string
  location_id: string // Outlet ID or 'KITCHEN'
  item_id: string
  qty_initial: number
  qty_remaining: number
  price_per_base_unit: number
  received_at: string
}

export interface InternalRequest {
  id: string
  outlet_id: string
  status: 'PENDING' | 'APPROVED' | 'DISPATCHED' | 'RECEIVED' | 'REJECTED'
}

export interface InternalRequestItem {
  id: string
  request_id: string
  item_id: string
  requested_unit_id: string
  requested_qty: number
  converted_base_qty: number
}

// --- Core Functions ---



/**
 * Memproses pengiriman barang dari Kitchen ke Outlet (FIFO).
 * Fungsi ini mengeksekusi logika FIFO secara berurutan.
 */
export async function dispatchRequest(
  supabase: SupabaseClient,
  params: {
    requestId: string
    kitchenLocationId: string
  }
) {
  const { requestId, kitchenLocationId } = params

  // 1. Ambil data request dan item-itemnya
  const { data: request, error: reqError } = await supabase
    .from('internal_requests')
    .select('*, internal_request_items(*)')
    .eq('id', requestId)
    .single()

  if (reqError || !request) throw new Error('Request tidak ditemukan')
  if (request.status !== 'PENDING') throw new Error('Request sudah diproses sebelumnya')

  const items: InternalRequestItem[] = request.internal_request_items || []
  
  // Array untuk menyimpan update batch (pengurangan stok kitchen)
  const batchUpdates: { id: string, qty_remaining: number }[] = []
  // Array untuk menyimpan insert batch baru (penambahan stok outlet)
  const newOutletBatches: any[] = []

  // 2. Loop setiap item yang di-request dan jalankan logika FIFO
  for (const item of items) {
    let qtyNeeded = Number(item.converted_base_qty)
    let totalCogs = 0

    // Cari stok batch kitchen yang masih ada, urut dari yang paling tua (FIFO)
    const { data: availableBatches, error: batchError } = await supabase
      .from('inventory_batches')
      .select('*')
      .eq('location_id', kitchenLocationId)
      .eq('item_id', item.item_id)
      .gt('qty_remaining', 0)
      .order('received_at', { ascending: true })

    if (batchError) throw new Error(`Gagal mengambil stok: ${batchError.message}`)
    
    // Validasi apakah total stok cukup
    const totalAvailable = availableBatches.reduce((sum, b) => sum + Number(b.qty_remaining), 0)
    if (totalAvailable < qtyNeeded) {
      throw new Error(`Stok tidak cukup untuk item_id ${item.item_id}. Butuh ${qtyNeeded}, tersedia ${totalAvailable}`)
    }

    // Proses FIFO Loop
    for (const batch of availableBatches) {
      if (qtyNeeded <= 0) break

      const remainingInBatch = Number(batch.qty_remaining)
      const price = Number(batch.price_per_base_unit)

      if (remainingInBatch <= qtyNeeded) {
        // Habiskan batch ini
        qtyNeeded -= remainingInBatch
        totalCogs += remainingInBatch * price
        batchUpdates.push({ id: batch.id, qty_remaining: 0 })
      } else {
        // Kurangi sebagian batch ini
        const newRemaining = remainingInBatch - qtyNeeded
        totalCogs += qtyNeeded * price
        batchUpdates.push({ id: batch.id, qty_remaining: newRemaining })
        qtyNeeded = 0
      }
    }

    // Hitung rata-rata modal (HPP) untuk outlet
    const outletPricePerUnit = totalCogs / Number(item.converted_base_qty)

    // Siapkan batch baru untuk outlet
    newOutletBatches.push({
      location_id: request.outlet_id,
      item_id: item.item_id,
      qty_initial: item.converted_base_qty,
      qty_remaining: item.converted_base_qty,
      price_per_base_unit: outletPricePerUnit
    })
  }

  // 3. Eksekusi semua perubahan ke Database
  
  // a. Update Batch Kitchen
  // Idealnya ini dibungkus dalam Supabase RPC (Stored Procedure) agar atomic (aman dari race-condition),
  // Namun untuk versi aplikasi ini dijalankan berurutan di backend:
  for (const update of batchUpdates) {
    await supabase
      .from('inventory_batches')
      .update({ qty_remaining: update.qty_remaining })
      .eq('id', update.id)
  }

  // b. Insert Batch Outlet
  if (newOutletBatches.length > 0) {
    await supabase.from('inventory_batches').insert(newOutletBatches)
  }

  // c. Update Status Request
  await supabase
    .from('internal_requests')
    .update({ status: 'DISPATCHED' })
    .eq('id', requestId)

  return { success: true, message: 'Request berhasil diproses secara FIFO.' }
}
