import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://khpkoreaaucvyqfhynfq.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtocGtvcmVhYXVjdnlxZmh5bmZxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDk2MzI5MiwiZXhwIjoyMDk2NTM5MjkyfQ.Dy0QMAHfB8EU9BK-JuyRrBidpG6iM94t9RtiJ_viZz8'
)

async function checkOrders() {
  const { data: outlets } = await supabase.from('outlets').select('id, name')
  const bnrOutlet = outlets?.find(o => o.name.toLowerCase().includes('bnr'))
  
  if (bnrOutlet) {
    const { data: orders, error } = await supabase
      .from('orders')
      .select('id, order_number, created_at, status, total_amount, discount_amount, order_items(id, menu_item_name, quantity, unit_price)')
      .eq('outlet_id', bnrOutlet.id)
      .eq('channel', 'tiktokgo')
      .gte('created_at', '2026-08-13T00:00:00+07:00')
      .lt('created_at', '2026-08-14T00:00:00+07:00')
      .order('created_at', { ascending: true })

    if (error) console.error("Error:", error)
    else {
      console.log(`\n=== PESANAN TIKTOK GO DI BNR TANGGAL 13 AGUSTUS 2026 ===`)
      if (orders?.length === 0) {
        console.log("Tidak ada pesanan.")
      } else {
        orders.forEach((order, index) => {
          console.log(`\nPesanan #${index + 1}`)
          console.log(`ID/Nomor: ${order.order_number || order.id}`)
          console.log(`Waktu: ${new Date(order.created_at).toLocaleString('id-ID')}`)
          console.log(`Status: ${order.status}`)
          console.log(`Diskon: Rp ${order.discount_amount?.toLocaleString('id-ID')}`)
          console.log(`Total: Rp ${order.total_amount?.toLocaleString('id-ID')}`)
          console.log(`Item:`)
          order.order_items.forEach(item => {
            console.log(`  - ${item.quantity}x ${item.menu_item_name} (Rp ${item.unit_price?.toLocaleString('id-ID')})`)
          })
        })
      }
    }
  }
}

checkOrders()
