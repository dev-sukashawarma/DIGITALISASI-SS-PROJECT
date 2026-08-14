import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://khpkoreaaucvyqfhynfq.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtocGtvcmVhYXVjdnlxZmh5bmZxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDk2MzI5MiwiZXhwIjoyMDk2NTM5MjkyfQ.Dy0QMAHfB8EU9BK-JuyRrBidpG6iM94t9RtiJ_viZz8'
)

const orderId = '8905e95a-5098-4f98-aae0-fb6ada4ace7b'

async function fixCibuburReal() {
  console.log("Updating Cibubur Order #35 to real data...")

  // Delete existing items
  const { error: delErr } = await supabase
    .from('order_items')
    .delete()
    .eq('order_id', orderId)

  if (delErr) {
    console.error("Delete Error:", delErr)
    return
  }

  // Get menu_item_ids if available
  const { data: menuItems } = await supabase.from('menu_items').select('id, name')

  function getItemId(nameQuery) {
    const found = menuItems?.find(m => m.name.toLowerCase().includes(nameQuery.toLowerCase()))
    return found ? found.id : null
  }

  const realItems = [
    {
      order_id: orderId,
      menu_item_name: "SHAWARMA DUO COMBO|ID|real",
      menu_item_id: getItemId("shawarma duo combo"),
      quantity: 3,
      unit_price: 41000,
      subtotal: 123000,
      channel: "offline"
    },
    {
      order_id: orderId,
      menu_item_name: "Best Seller 2|ID|real",
      menu_item_id: getItemId("best seller 2"),
      quantity: 3,
      unit_price: 34000,
      subtotal: 102000,
      channel: "offline"
    },
    {
      order_id: orderId,
      menu_item_name: "SUKA DUO FAVORITE|ID|real",
      menu_item_id: getItemId("suka duo favorite"),
      quantity: 2,
      unit_price: 49000,
      subtotal: 98000,
      channel: "offline"
    },
    {
      order_id: orderId,
      menu_item_name: "SUKA TRIPLE FAVORIT|ID|real",
      menu_item_id: getItemId("suka triple favorit"),
      quantity: 1,
      unit_price: 74000,
      subtotal: 74000,
      channel: "offline"
    },
    {
      order_id: orderId,
      menu_item_name: "SHAWARMA TRIPLE COMBO|ID|real",
      menu_item_id: getItemId("shawarma triple combo"),
      quantity: 1,
      unit_price: 71000,
      subtotal: 71000,
      channel: "offline"
    }
  ]

  const { error: insertErr } = await supabase
    .from('order_items')
    .insert(realItems)

  if (insertErr) {
    console.error("Insert Error:", insertErr)
    return
  }

  const { error: updateErr } = await supabase
    .from('orders')
    .update({ total_amount: 468000 })
    .eq('id', orderId)

  if (updateErr) {
    console.error("Update Order Error:", updateErr)
  } else {
    console.log(" Berhasil memperbarui data Cibubur Order #35 sesuai data real!")
  }
}

fixCibuburReal()
