require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const grabfoodUpdates = [
  { no: 1, code: 'GF-902', dbOrderNo: 8, dbOrderId: '79fda54b-baad-4748-9e42-4d53473d4c7d', subtotal: 120000, promo: 47400, net: 72600 },
  { no: 2, code: 'GF-136', dbOrderNo: 16, dbOrderId: 'a8265a72-d93b-47dc-9198-bf369dac9aed', subtotal: 57000, promo: 18012, net: 38988 },
  { no: 3, code: 'GF-356', dbOrderNo: 66, dbOrderId: 'a9d40c01-0834-4835-9fac-e74d14b241ce', subtotal: 33000, promo: 10350, net: 22650 }
];

async function applyAllGrabfoodUpdates() {
  console.log("=== UPDATING ALL 3 GRABFOOD ORDERS (GF-902, GF-136, GF-356) ===");
  let count = 0;

  for (const item of grabfoodUpdates) {
    const { data, error } = await supabase
      .from('orders')
      .update({
        total_amount: item.net,
        promo_subsidy: item.promo
      })
      .eq('id', item.dbOrderId)
      .select('id, order_number, customer_name, channel, total_amount, promo_subsidy');

    if (error) {
      console.error(`❌ Error updating GrabFood ${item.code}:`, error);
    } else {
      count++;
      const o = data[0];
      console.log(`✅ Updated Order #${o.order_number} (${item.code} - ${o.customer_name}): total_amount=${o.total_amount} | promo_subsidy=${o.promo_subsidy}`);
    }
  }

  console.log(`\n=== SUCCESS: Updated ${count} / ${grabfoodUpdates.length} GrabFood orders ===`);
}

applyAllGrabfoodUpdates();
