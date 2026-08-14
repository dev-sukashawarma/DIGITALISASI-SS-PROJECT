import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://khpkoreaaucvyqfhynfq.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtocGtvcmVhYXVjdnlxZmh5bmZxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDk2MzI5MiwiZXhwIjoyMDk2NTM5MjkyfQ.Dy0QMAHfB8EU9BK-JuyRrBidpG6iM94t9RtiJ_viZz8'
)

async function fixEmpangReal() {
  console.log("Updating Empang orders to match real report...")

  // 1. Update Order #93 from Mix Jumbo (38.000) to Best Seller 2 (34.000)
  const order93Id = "0b6d4f09-c151-4ecc-abdf-66e70c5334a9"
  
  const { error: upd93Err } = await supabase
    .from('orders')
    .update({ total_amount: 34000 })
    .eq('id', order93Id)

  const { error: updItem93Err } = await supabase
    .from('order_items')
    .update({
      menu_item_name: "Best Seller 2|ID|sync_real",
      menu_item_id: "8657f72e-d1a2-4829-a5cf-33535f7b293c",
      unit_price: 34000,
      subtotal: 34000
    })
    .eq('order_id', order93Id)

  if (upd93Err || updItem93Err) {
    console.error("Err updating order 93:", upd93Err || updItem93Err)
  } else {
    console.log(" Updated Order #93 to Best Seller 2 (Rp 34.000)")
  }

  // 2. Merge Order #50 into Order #49 (2x Best Seller 2 = Rp 68.000) and delete Order #50
  const order49Id = "6a2ff2a4-dfbb-4ca1-bd31-ca5a743aa29e" // let's fetch id for order 49 & 50 first
  const { data: outlets } = await supabase.from('outlets').select('id, name')
  const empangOutlet = outlets?.find(o => o.name.toLowerCase().includes('empang'))

  const { data: order50 } = await supabase
    .from('orders')
    .select('id')
    .eq('outlet_id', empangOutlet.id)
    .eq('order_number', 50)
    .single()

  const { data: order49 } = await supabase
    .from('orders')
    .select('id')
    .eq('outlet_id', empangOutlet.id)
    .eq('order_number', 49)
    .single()

  if (order50) {
    await supabase.from('order_items').delete().eq('order_id', order50.id)
    await supabase.from('orders').delete().eq('id', order50.id)
    console.log(" Deleted Order #50")
  }

  if (order49) {
    await supabase.from('orders').update({ total_amount: 68000 }).eq('id', order49.id)
    await supabase.from('order_items').update({ quantity: 2, subtotal: 68000 }).eq('order_id', order49.id)
    console.log(" Updated Order #49 to 2x Best Seller 2 (Rp 68.000)")
  }
}

fixEmpangReal()
