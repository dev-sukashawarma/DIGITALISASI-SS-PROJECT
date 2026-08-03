import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabaseService = createClient(supabaseUrl, supabaseKey)

async function testIncoming() {
  const external_order_id = 'c1234567-89ab-cdef-0123-456789abcdef'
  // cari outlet valid dulu
  const { data: outlets } = await supabaseService.from('outlets').select('*').limit(1)
  const pos_outlet_id = outlets[0].id

  const customer_name = 'Test User'
  const customer_phone = '08123456789'
  const notes = 'Test Note'
  const total_amount = 10000
  
  const { data: order, error: orderError } = await supabaseService
    .from('orders')
    .insert({
      outlet_id: pos_outlet_id,
      customer_name,
      customer_phone,
      notes: notes || null,
      payment_method: 'qris',
      total_amount,
      status: 'preparing',
      source: 'online',
      sales_source: 'online',
      external_order_id,
    })
    .select('id, order_number')
    .single()

  console.log('Order insert result:', order, orderError)
  
  if (order) {
    const items = [
      {
        menu_item_name: "Test Item",
        quantity: 1,
        unit_price: 10000,
        subtotal: 10000
      }
    ]
    
    const { error: itemsError } = await supabaseService.from('order_items').insert(
      items.map((item) => ({
        order_id: order.id,
        menu_item_id: null,
        menu_item_name: item.menu_item_name,
        quantity: item.quantity,
        unit_price: item.unit_price,
        subtotal: item.subtotal,
      }))
    )
    
    console.log('Order items insert result:', itemsError)
    
    // try delete
    await supabaseService.from('orders').delete().eq('id', order.id)
  }
}

testIncoming()
