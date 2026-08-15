import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://khpkoreaaucvyqfhynfq.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtocGtvcmVhYXVjdnlxZmh5bmZxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDk2MzI5MiwiZXhwIjoyMDk2NTM5MjkyfQ.Dy0QMAHfB8EU9BK-JuyRrBidpG6iM94t9RtiJ_viZz8'
)

async function checkCiseengOrders() {
  const { data: outlets } = await supabase.from('outlets').select('id, name')
  const outlet = outlets?.find(o => o.name.toLowerCase().includes('ciseeng'))

  if (!outlet) {
    console.log("Outlet Ciseeng not found. Available outlets:")
    outlets?.forEach(o => console.log(`- ${o.name} (${o.id})`))
    return
  }

  console.log(`Outlet found: ${outlet.name} (${outlet.id})`)

  const { data: orders, error } = await supabase
    .from('orders')
    .select('id, order_number, created_at, status, total_amount, discount_amount, order_items(id, menu_item_name, quantity, unit_price)')
    .eq('outlet_id', outlet.id)
    .eq('channel', 'tiktokgo')
    .gte('created_at', '2026-08-14T00:00:00+07:00')
    .lt('created_at', '2026-08-15T00:00:00+07:00')
    .order('created_at', { ascending: true })

  if (error) {
    console.error("Error:", error)
    return
  }

  console.log(`\n=== PESANAN TIKTOK GO DI CISEENG TANGGAL 14 AGUSTUS 2026 ===`)
  if (!orders || orders.length === 0) {
    console.log("Tidak ada pesanan.")
  } else {
    let grandTotal = 0
    const summary = {}

    orders.forEach((order, index) => {
      grandTotal += order.total_amount
      console.log(`\nPesanan #${index + 1}`)
      console.log(`ID/Nomor: ${order.order_number || order.id}`)
      console.log(`Waktu: ${new Date(order.created_at).toLocaleString('id-ID')}`)
      console.log(`Status: ${order.status}`)
      console.log(`Total: Rp ${order.total_amount?.toLocaleString('id-ID')}`)
      console.log(`Item:`)
      if (order.order_items) {
        order.order_items.forEach(item => {
          console.log(`  - ${item.quantity}x ${item.menu_item_name} (Rp ${item.unit_price?.toLocaleString('id-ID')})`)
          const cleanName = item.menu_item_name.split('|')[0].trim()
          if (!summary[cleanName]) {
            summary[cleanName] = { qty: 0, unit_price: item.unit_price, subtotal: 0 }
          }
          summary[cleanName].qty += item.quantity
          summary[cleanName].subtotal += (item.quantity * item.unit_price)
        })
      } else {
        console.log(`  (tidak ada item)`)
      }
    })

    console.log(`\nGRAND TOTAL CISEENG: Rp ${grandTotal.toLocaleString('id-ID')}`)
    console.log(`REKAP PER ITEM:`, JSON.stringify(summary, null, 2))
  }
}

checkCiseengOrders()
