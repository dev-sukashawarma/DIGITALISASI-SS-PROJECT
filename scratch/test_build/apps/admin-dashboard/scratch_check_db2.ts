import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'dummy',
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'dummy'
)

async function check() {
  const { data: orders, error } = await supabase
    .from('orders')
    .select('id, total_amount, discount_amount, promo_subsidy, order_items(subtotal, quantity, unit_price)')
    .eq('status', 'completed')
    
  if (error) {
    console.error('Supabase error:', error)
    return
  }

  let sumOrderItems = 0
  let sumGrossWidget = 0
  
  for (const o of orders || []) {
    const oiSum = (o.order_items || []).reduce((s: number, oi: any) => s + Number(oi.subtotal), 0)
    const disc = Number(o.discount_amount) || 0
    const promo = Number(o.promo_subsidy) || 0
    const deductions = disc + promo
    const kpiGross = Number(o.total_amount) + deductions

    sumOrderItems += oiSum
    sumGrossWidget += kpiGross
    
    if (Math.abs(oiSum - kpiGross) > 1) {
        console.log(`Order ${o.id}: oiSum=${oiSum}, kpiGross=${kpiGross} (diff: ${kpiGross - oiSum})`)
    }
  }
  
  console.log(`Sum Order Items (PDF Revenue): ${sumOrderItems}`);
  console.log(`Sum KPI Gross (Widget Revenue): ${sumGrossWidget}`);
  console.log(`Difference: ${sumGrossWidget - sumOrderItems}`);
}

check().catch(console.error)
