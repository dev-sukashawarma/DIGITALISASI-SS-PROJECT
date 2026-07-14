import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

dotenv.config({ path: 'apps/pos-kasir/.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function check() {
  const { data, error } = await supabase
    .from('monitoring_view_crew')
    .select('bahan_baku_id, item_name, satuan, kategori, current_qty, threshold, status')
    .eq('outlet_id', '550e8400-e29b-41d4-a716-446655440001')
    .in('status', ['below', 'warning'])
    .order('status')
    
  console.log('Result:', data)
  console.log('Error:', error)
}

check()
