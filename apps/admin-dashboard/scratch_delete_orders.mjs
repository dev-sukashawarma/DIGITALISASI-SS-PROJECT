import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://khpkoreaaucvyqfhynfq.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtocGtvcmVhYXVjdnlxZmh5bmZxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDk2MzI5MiwiZXhwIjoyMDk2NTM5MjkyfQ.Dy0QMAHfB8EU9BK-JuyRrBidpG6iM94t9RtiJ_viZz8'
)

async function deleteSelectedOrders() {
  const { data: outlets } = await supabase.from('outlets').select('id, name')
  const bejiOutlet = outlets?.find(o => o.name.toLowerCase().includes('beji'))
  
  if (!bejiOutlet) {
    console.log("Outlet Beji not found.")
    return
  }

  const targetNumbers = [34]

  const { data: orders, error: fetchError } = await supabase
    .from('orders')
    .select('id, order_number, created_at, total_amount')
    .eq('outlet_id', bejiOutlet.id)
    .eq('channel', 'tiktokgo')
    .in('order_number', targetNumbers)
    .gte('created_at', '2026-08-13T00:00:00+07:00')
    .lt('created_at', '2026-08-14T00:00:00+07:00')

  if (fetchError) {
    console.error("Fetch Error:", fetchError)
    return
  }

  if (!orders || orders.length === 0) {
    console.log("Pesanan target tidak ditemukan.")
    return
  }

  for (const order of orders) {
    const { error: deleteItemsError } = await supabase
      .from('order_items')
      .delete()
      .eq('order_id', order.id)

    if (deleteItemsError) {
      console.error(`Error deleting items for order ${order.order_number}:`, deleteItemsError)
      continue
    }

    const { error: deleteOrderError } = await supabase
      .from('orders')
      .delete()
      .eq('id', order.id)

    if (deleteOrderError) {
      console.error(`Error deleting order ${order.order_number}:`, deleteOrderError)
    } else {
      console.log(` Berhasil menghapus Pesanan Nomor ${order.order_number} (Total: Rp ${order.total_amount.toLocaleString('id-ID')})`)
    }
  }
}

deleteSelectedOrders()
