import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://khpkoreaaucvyqfhynfq.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtocGtvcmVhYXVjdnlxZmh5bmZxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDk2MzI5MiwiZXhwIjoyMDk2NTM5MjkyfQ.Dy0QMAHfB8EU9BK-JuyRrBidpG6iM94t9RtiJ_viZz8'
)

const orderId = 'e26a39b4-92f4-46e8-890e-d4825094e9cf'

async function updateOrder23() {
  console.log("Updating Order #23 to 1x Best Seller 2 (Rp 34.000)...")

  const { error: orderErr } = await supabase
    .from('orders')
    .update({ total_amount: 34000 })
    .eq('id', orderId)

  if (orderErr) {
    console.error("Order Update Error:", orderErr)
    return
  }

  const { error: itemErr } = await supabase
    .from('order_items')
    .update({
      quantity: 1,
      subtotal: 34000
    })
    .eq('order_id', orderId)

  if (itemErr) {
    console.error("Item Update Error:", itemErr)
  } else {
    console.log(" Berhasil memperbarui Pesanan #23 menjadi 1x Best Seller 2 (Rp 34.000).")
  }
}

updateOrder23()
