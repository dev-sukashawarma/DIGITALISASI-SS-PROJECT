require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function applyGrabfoodUpdate() {
  const grabfoodOrderId = '79fda54b-baad-4748-9e42-4d53473d4c7d'; // Order #8 (Jayanti - GF-902)
  const promoAmount = 47400;
  const netAmount = 72600;

  console.log("=== UPDATING GRABFOOD ORDER GF-902 (Order #8 - Jayanti) ===");

  const { data, error } = await supabase
    .from('orders')
    .update({
      total_amount: netAmount,
      promo_subsidy: promoAmount
    })
    .eq('id', grabfoodOrderId)
    .select('id, order_number, customer_name, channel, total_amount, promo_subsidy');

  if (error) {
    console.error("❌ Failed to update GrabFood order:", error);
  } else {
    const o = data[0];
    console.log(`✅ Successfully updated Order #${o.order_number} (${o.customer_name}):`);
    console.log(`   - total_amount (Net Payment): Rp ${o.total_amount.toLocaleString('id-ID')}`);
    console.log(`   - promo_subsidy (Potongan Promo): Rp ${o.promo_subsidy.toLocaleString('id-ID')}`);
  }
}

applyGrabfoodUpdate();
