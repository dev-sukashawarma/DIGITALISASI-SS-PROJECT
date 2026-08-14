import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://khpkoreaaucvyqfhynfq.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtocGtvcmVhYXVjdnlxZmh5bmZxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDk2MzI5MiwiZXhwIjoyMDk2NTM5MjkyfQ.Dy0QMAHfB8EU9BK-JuyRrBidpG6iM94t9RtiJ_viZz8'
)

async function addOrder() {
  const { data: outlets } = await supabase.from('outlets').select('id, name')
  const sukmajayaOutlet = outlets?.find(o => o.name.toLowerCase().includes('sukmajaya'))

  if (!sukmajayaOutlet) {
    console.log("Sukmajaya outlet not found")
    return
  }

  // Check existing menu items or order items to get menu_item_id for Best Seller (Mix Jumbo) / Best Seller
  const { data: menuItems } = await supabase.from('menu_items').select('*')
  const mixJumbo = menuItems?.find(m => m.name.toLowerCase().includes('best seller') || m.name.toLowerCase().includes('mix jumbo'))

  console.log("Found menu item:", mixJumbo)

  const menu_item_id = mixJumbo ? mixJumbo.id : null
  const menu_item_name = mixJumbo ? `${mixJumbo.name}|ID|manual_admin` : "Best Seller (Mix Jumbo)|ID|manual_admin"
  const qty = 2
  const unitPrice = 38000
  const totalAmount = qty * unitPrice

  // Insert into orders
  const newOrderObj = {
    outlet_id: sukmajayaOutlet.id,
    customer_name: "Admin",
    status: "completed",
    total_amount: totalAmount,
    created_at: "2026-08-13T21:00:00+07:00",
    updated_at: "2026-08-13T21:00:00+07:00",
    source: "manual",
    sales_source: "tiktok",
    channel: "tiktokgo",
    kitchen_receipt_printed: true,
    customer_receipt_printed: true,
    cashier_name: "Admin"
  }

  const { data: insertedOrder, error: orderErr } = await supabase
    .from('orders')
    .insert(newOrderObj)
    .select()

  if (orderErr) {
    console.error("Order Insert Error:", orderErr)
    return
  }

  const order = insertedOrder[0]
  console.log("Inserted Order:", order)

  // Insert into order_items
  const orderItemObj = {
    order_id: order.id,
    channel: "offline",
    quantity: qty,
    unit_price: unitPrice,
    subtotal: totalAmount,
    menu_item_name: menu_item_name,
    menu_item_id: menu_item_id
  }

  const { data: insertedItem, error: itemErr } = await supabase
    .from('order_items')
    .insert(orderItemObj)
    .select()

  if (itemErr) {
    console.error("Item Insert Error:", itemErr)
  } else {
    console.log(" Inserted Item:", insertedItem)
  }
}

addOrder()
