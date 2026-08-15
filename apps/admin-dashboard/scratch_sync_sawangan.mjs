import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://khpkoreaaucvyqfhynfq.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtocGtvcmVhYXVjdnlxZmh5bmZxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDk2MzI5MiwiZXhwIjoyMDk2NTM5MjkyfQ.Dy0QMAHfB8EU9BK-JuyRrBidpG6iM94t9RtiJ_viZz8'
)

async function syncSawangan() {
  const { data: outlets } = await supabase.from('outlets').select('id, name')
  const outlet = outlets?.find(o => o.name.toLowerCase().includes('sawangan'))

  if (!outlet) return

  const { data: menuItems } = await supabase.from('menu_items').select('*')
  
  const duo = menuItems?.find(m => m.name.toLowerCase().includes('shawarma duo combo') || m.name.toLowerCase().includes('duo combo'))
  const crispy = menuItems?.find(m => m.name.toLowerCase().includes('premium crispy') || m.name.toLowerCase().includes('crispy'))

  console.log("Found Duo:", duo?.name, duo?.id)
  console.log("Found Crispy:", crispy?.name, crispy?.id)

  const itemsToInsert = [
    {
      item_name: duo ? `${duo.name}|ID|sync_crew` : "SHAWARMA DUO COMBO|ID|sync_crew",
      item_id: duo ? duo.id : null,
      unit_price: 41000,
      qty: 1,
      total: 41000,
      time: "2026-08-14T20:00:00+07:00",
      customer: "Customer TikTok #1"
    },
    {
      item_name: crispy ? `${crispy.name}|ID|sync_crew` : "SUKA PREMIUM CRISPY|ID|sync_crew",
      item_id: crispy ? crispy.id : null,
      unit_price: 48000,
      qty: 1,
      total: 48000,
      time: "2026-08-14T20:30:00+07:00",
      customer: "Customer TikTok #2"
    }
  ]

  for (let i = 0; i < itemsToInsert.length; i++) {
    const o = itemsToInsert[i]
    const orderObj = {
      outlet_id: outlet.id,
      customer_name: o.customer,
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
    else console.log(` Inserted Sawangan order ${i+1}: ${o.item_name} (Rp ${o.total})`)
  }
}

syncSawangan()
