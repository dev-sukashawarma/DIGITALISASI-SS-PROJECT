import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import * as path from 'path'
import * as fs from 'fs'

const envPath = path.resolve(process.cwd(), 'apps/pos-kasir/.env.local')
const envConfig = dotenv.parse(fs.readFileSync(envPath))

const supabase = createClient(
  envConfig.NEXT_PUBLIC_SUPABASE_URL,
  envConfig.SUPABASE_SERVICE_ROLE_KEY
)

async function test() {
  const { data: defaultOutlet } = await supabase.from('outlets').select('id').limit(1).single()
  console.log('Outlet:', defaultOutlet)

  const baseOrder = {
    outlet_id: defaultOutlet.id,
    customer_name: 'Test',
    payment_method: 'cash',
    total_amount: 10000,
    discount_amount: null,
    status: 'preparing',
    source: 'pos',
    channel: null,
    sales_source: 'pos',
    amount_received: 10000,
    change_amount: 0
  }

  const { data, error } = await supabase
    .from('orders')
    .insert(baseOrder)
    .select('id, order_number')
    .single()

  console.log('Error:', error)
  console.log('Data:', data)
}

test()
