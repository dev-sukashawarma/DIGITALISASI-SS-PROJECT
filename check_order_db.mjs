import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://qntuhtkujpwudcpudwbj.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFudHVodGt1anB3dWRjcHVkd2JqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkyNTMyNjcsImV4cCI6MjA5NDgyOTI2N30.X2pjS2ont0ekVVc71HLacM2I49aLeypLRRgoPQV6OTw'
)

async function check() {
  const { data: order, error: orderErr } = await supabase.from('orders').select('*').limit(1)
  console.log("Order:", order, orderErr)
  if (order && order.length > 0) {
    const { data: items, error: itemsErr } = await supabase.from('order_items').select('*').eq('order_id', order[0].id)
    console.log("Items:", items, itemsErr)
  }
}
check()
