import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://khpkoreaaucvyqfhynfq.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtocGtvcmVhYXVjdnlxZmh5bmZxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDk2MzI5MiwiZXhwIjoyMDk2NTM5MjkyfQ.Dy0QMAHfB8EU9BK-JuyRrBidpG6iM94t9RtiJ_viZz8'
)

async function fixOrder5() {
  const { data, error } = await supabase
    .from('orders')
    .update({
      total_amount: 38000,
      promo_subsidy: 0
    })
    .eq('id', '0edeb9b5-1901-4b8e-b548-109b1aa0eadf')

  if (error) console.error("Error updating order 5:", error)
  else console.log(" Berhasil memperbarui Pesanan #3 (Nomor: 5) menjadi Rp 38.000 (menghapus -5/promo_subsidy 5).")
}

fixOrder5()
