import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://khpkoreaaucvyqfhynfq.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtocGtvcmVhYXVjdnlxZmh5bmZxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDk2MzI5MiwiZXhwIjoyMDk2NTM5MjkyfQ.Dy0QMAHfB8EU9BK-JuyRrBidpG6iM94t9RtiJ_viZz8'
)

async function syncJatiwaringin() {
  const { data: outlets } = await supabase.from('outlets').select('id, name')
  const outlet = outlets?.find(o => o.name.toLowerCase().includes('jatiwaringin'))

  if (!outlet) return

  const { data: menuItems } = await supabase.from('menu_items').select('*')
  
  const bs2 = menuItems?.find(m => m.name.toLowerCase().includes('best seller 2'))
  const crispy = menuItems?.find(m => m.name.toLowerCase().includes('premium crispy') || m.name.toLowerCase().includes('crispy'))

  console.log("Found BS2:", bs2)
  console.log("Found Crispy:", crispy)

  // Missing 5 orders to add:
  // 4 orders of BEST SELLER 2 (Rp 34.000 each)
  // 1 order of SUKA PREMIUM CRISPY (Rp 48.000)
  // Note: Total discount/subsidy platform overall is 14420 across the 7 orders.

  const missingOrders = [
    {
      item_name: bs2 ? `${bs2.name}|ID|sync_crew` : "Best Seller 2|ID|sync_crew",
      item_id: bs2 ? bs2.id : null,
      unit_price: 34000,
      qty: 1,
      total: 34000,
      time: "2026-08-13T19:00:00+07:00"
    },
    {
      item_name: bs2 ? `${bs2.name}|ID|sync_crew` : "Best Seller 2|ID|sync_crew",
      item_id: bs2 ? bs2.id : null,
      unit_price: 34000,
      qty: 1,
      total: 34000,
      time: "2026-08-13T19:30:00+07:00"
    },
    {
      item_name: bs2 ? `${bs2.name}|ID|sync_crew` : "Best Seller 2|ID|sync_crew",
      item_id: bs2 ? bs2.id : null,
      unit_price: 34000,
      qty: 1,
      total: 34000,
      time: "2026-08-13T20:00:00+07:00"
    },
    {
      item_name: bs2 ? `${bs2.name}|ID|sync_crew` : "Best Seller 2|ID|sync_crew",
      item_id: bs2 ? bs2.id : null,
      unit_price: 34000,
      qty: 1,
      total: 34000,
      time: "2026-08-13T20:15:00+07:00"
    },
    {
      item_name: crispy ? `${crispy.name}|ID|sync_crew` : "SUKA PREMIUM CRISPY|ID|sync_crew",
      item_id: crispy ? crispy.id : null,
      unit_price: 48000,
      qty: 1,
      total: 48000,
      time: "2026-08-13T21:00:00+07:00"
    }
  ]

  for (let i = 0; i < missingOrders.length; i++) {
    const o = missingOrders[i]
    const orderObj = {
      outlet_id: outlet.id,
      customer_name: `Customer TikTok #${i+1}`,
      status: "completed",
      total_amount: o.total,
      created_at: o.time,
      updated_at: o.time,
      source: "manual",
      sales_source: "tiktok",
      channel: "tiktokgo",
      kitchen_receipt_printed: true,
      customer_receipt_printed: true,
      cashier_name: "Sync Crew"
    }

    const { data: insertedOrder, error: orderErr } = await supabase
      .from('orders')
      .insert(orderObj)
      .select()

    if (orderErr) {
      console.error("Order err:", orderErr)
      continue
    }

    const orderId = insertedOrder[0].id
    const itemObj = {
      order_id: orderId,
      channel: "offline",
      quantity: o.qty,
      unit_price: o.unit_price,
      subtotal: o.total,
      menu_item_name: o.item_name,
      menu_item_id: o.item_id
    }

    const { error: itemErr } = await supabase
      .from('order_items')
      .insert(itemObj)

    if (itemErr) console.error("Item err:", itemErr)
    else console.log(` Inserted missing order ${i+1}: ${o.item_name} (Rp ${o.total})`)
  }
}

syncJatiwaringin()
