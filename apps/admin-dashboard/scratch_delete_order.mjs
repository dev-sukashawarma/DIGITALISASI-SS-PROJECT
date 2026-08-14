import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://khpkoreaaucvyqfhynfq.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtocGtvcmVhYXVjdnlxZmh5bmZxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDk2MzI5MiwiZXhwIjoyMDk2NTM5MjkyfQ.Dy0QMAHfB8EU9BK-JuyRrBidpG6iM94t9RtiJ_viZz8'
)

async function deleteOrder() {
  const { data: outlets } = await supabase.from('outlets').select('id, name')
  const bejiOutlet = outlets?.find(o => o.name.toLowerCase().includes('beji'))
  
  if (!bejiOutlet) {
    console.log("Outlet Beji not found.")
    return
  }

  // Find order with order_number 37 in Beji outlet on 13 August 2026
  const { data: orders, error: fetchError } = await supabase
    .from('orders')
    .select('id, order_number, created_at, status, total_amount, discount_amount, order_items(id, menu_item_name, quantity, unit_price)')
    .eq('outlet_id', bejiOutlet.id)
    .eq('channel', 'tiktokgo')
    .eq('order_number', 37)
    .gte('created_at', '2026-08-13T00:00:00+07:00')
    .lt('created_at', '2026-08-14T00:00:00+07:00')

  if (fetchError) {
    console.error("Fetch Error:", fetchError)
    return
  }

  if (!orders || orders.length === 0) {
    console.log("Pesanan dengan Nomor: 37 tidak ditemukan.")
    return
  }

  const targetOrder = orders[0]
  console.log("Target Order to Delete:", JSON.stringify(targetOrder, null, 2))

  // Delete order_items first
  const { error: deleteItemsError } = await supabase
    .from('order_items')
    .delete()
    .eq('order_id', targetOrder.id)

  if (deleteItemsError) {
    console.error("Error deleting order items:", deleteItemsError)
  }

  const { error: deleteOrderError } = await supabase
    .from('orders')
    .delete()
    .eq('id', targetOrder.id)

  if (deleteOrderError) {
    console.error("Error deleting order:", deleteOrderError)
  } else {
    console.log(` Berhasil menghapus Pesanan Nomor 37 (ID: ${targetOrder.id})`)
  }
}

deleteOrder()
