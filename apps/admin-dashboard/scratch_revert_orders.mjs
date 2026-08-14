import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://khpkoreaaucvyqfhynfq.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtocGtvcmVhYXVjdnlxZmh5bmZxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDk2MzI5MiwiZXhwIjoyMDk2NTM5MjkyfQ.Dy0QMAHfB8EU9BK-JuyRrBidpG6iM94t9RtiJ_viZz8'
)

const outletId = '550e8400-e29b-41d4-a716-446655440007'

const deletedOrders = [
  // Order 34
  {
    id: "fe30cbf3-f861-42d7-b5fa-dbd52bfaac59",
    order_number: 34,
    created_at: "2026-08-13T22:49:37.210998+07:00",
    status: "completed",
    total_amount: 34000,
    discount_amount: null,
    outlet_id: outletId,
    channel: "tiktokgo",
    items: [
      {
        id: "e65f72ba-1085-4a5a-a4db-5565c4b9d9de",
        quantity: 1,
        unit_price: 34000,
        subtotal: 34000,
        menu_item_name: "Best Seller 2|ID|6i1e2zr"
      }
    ]
  },
  // Order 36
  {
    id: "326c89ff-1bc3-4e5e-8151-c7478db7245b",
    order_number: 36,
    created_at: "2026-08-13T22:51:11.212854+07:00",
    status: "completed",
    total_amount: 38000,
    discount_amount: null,
    outlet_id: outletId,
    channel: "tiktokgo",
    items: [
      {
        id: "4eefe8da-539f-4e11-9095-663beed07060",
        quantity: 1,
        unit_price: 38000,
        subtotal: 38000,
        menu_item_name: "Best Seller (Mix Jumbo)|ID|e3ezkd7"
      }
    ]
  },
  // Order 37
  {
    id: "0bece025-f8d2-4877-82d1-d6a092c6cc99",
    order_number: 37,
    created_at: "2026-08-13T22:55:44.898482+07:00",
    status: "completed",
    total_amount: 295000,
    discount_amount: null,
    outlet_id: outletId,
    channel: "tiktokgo",
    items: [
      {
        id: "aa58eea3-65f0-4c4d-91d0-c1e26496446a",
        quantity: 4,
        unit_price: 38000,
        subtotal: 152000,
        menu_item_name: "Best Seller (Mix Jumbo)|ID|fq9w5rs"
      },
      {
        id: "992fd8c2-b1a7-4313-9763-21728814d0de",
        quantity: 1,
        unit_price: 41000,
        subtotal: 41000,
        menu_item_name: "SHAWARMA DUO COMBO|ID|1rqao8s"
      },
      {
        id: "258f152c-eaac-4c2f-bdd9-44e9cdfa8241",
        quantity: 3,
        unit_price: 34000,
        subtotal: 102000,
        menu_item_name: "Best Seller 2|ID|p5a0w3z"
      }
    ]
  }
]

async function revertOrders() {
  console.log("Restoring deleted orders & items...")

  for (const orderData of deletedOrders) {
    const { items, ...order } = orderData

    // Check if order already inserted from previous run
    const { data: existingOrder } = await supabase
      .from('orders')
      .select('id')
      .eq('id', order.id)
      .single()

    if (!existingOrder) {
      const { error: orderError } = await supabase
        .from('orders')
        .insert(order)

      if (orderError) {
        console.error(`Error inserting order ${order.order_number}:`, orderError)
        continue
      }
    }

    // Re-insert order items
    const orderItemsToInsert = items.map(item => ({
      ...item,
      order_id: order.id
    }))

    const { error: itemsError } = await supabase
      .from('order_items')
      .insert(orderItemsToInsert)

    if (itemsError) {
      console.error(`Error inserting items for order ${order.order_number}:`, itemsError)
    } else {
      console.log(` Restored order #${order.order_number} (${order.id}) with ${items.length} items.`)
    }
  }
}

revertOrders()
