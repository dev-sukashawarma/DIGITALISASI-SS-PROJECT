import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://khpkoreaaucvyqfhynfq.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtocGtvcmVhYXVjdnlxZmh5bmZxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDk2MzI5MiwiZXhwIjoyMDk2NTM5MjkyfQ.Dy0QMAHfB8EU9BK-JuyRrBidpG6iM94t9RtiJ_viZz8'
)

async function fixOrderNumbers() {
  const updates = [
    { id: "fe30cbf3-f861-42d7-b5fa-dbd52bfaac59", order_number: 34 },
    { id: "326c89ff-1bc3-4e5e-8151-c7478db7245b", order_number: 36 },
    { id: "0bece025-f8d2-4877-82d1-d6a092c6cc99", order_number: 37 },
  ]

  for (const item of updates) {
    const { error } = await supabase
      .from('orders')
      .update({ order_number: item.order_number })
      .eq('id', item.id)

    if (error) console.error(`Error updating order ${item.id}:`, error)
    else console.log(` Updated order ${item.id} back to order_number ${item.order_number}`)
  }
}

fixOrderNumbers()
