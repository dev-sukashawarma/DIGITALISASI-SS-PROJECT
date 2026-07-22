require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const gofoodUpdates = [
  { no: 1, userCust: 'destria bianti', dbOrderNo: 70, dbOrderId: 'ad1b2039-a4d3-4938-8bc4-1c989ce0281e', promo: 2655, net: 42345 },
  { no: 2, userCust: 'Ervina Fitriani', dbOrderNo: 67, dbOrderId: '27d6e1ce-dc14-4c19-a544-d0c3069c5a45', promo: 0, net: 33000 },
  { no: 3, userCust: 'Nofitra Dewi Suparno', dbOrderNo: 37, dbOrderId: '2a6b9ba3-e869-4c69-967b-1d4cb25e033a', promo: 16650, net: 57350 },
  { no: 4, userCust: 'muhammad zain', dbOrderNo: 36, dbOrderId: 'cb6f8677-d0b7-4ec7-96d6-d601e45a843d', promo: 11475, net: 39525 },
  { no: 5, userCust: 'Arfi', dbOrderNo: 33, dbOrderId: '538314d9-bc4b-48ca-87ff-b842c22f98d9', promo: 0, net: 108000 },
  { no: 6, userCust: 'Sonia Rahmawati', dbOrderNo: 32, dbOrderId: '55b681ac-9057-46dd-aef3-f2c82c04c4cc', promo: 0, net: 33000 },
  { no: 7, userCust: 'Zahra', dbOrderNo: 27, dbOrderId: '40b28055-7683-4ee3-92e6-9df535ae6527', promo: 8100, net: 102900 },
  { no: 8, userCust: 'Lukman', dbOrderNo: 19, dbOrderId: '3cdd4283-c6d1-4054-bc24-fccc8729167b', promo: 13500, net: 46500 },
  { no: 9, userCust: 'daffa zein', dbOrderNo: 13, dbOrderId: 'b009b4e0-4cad-4fe9-80d2-738157d47d92', promo: 9450, net: 32550 },
  { no: 10, userCust: 'Widi Andika w', dbOrderNo: 3, dbOrderId: '82706842-6037-40f7-b399-d22e0bd3671c', promo: 0, net: 29000 }
];

async function applyGofoodUpdates() {
  console.log("=== UPDATING GOFOOD ORDERS FOR OUTLET EMPANG (21/07/2026) ===");
  let count = 0;

  for (const item of gofoodUpdates) {
    const { data, error } = await supabase
      .from('orders')
      .update({
        total_amount: item.net,
        promo_subsidy: item.promo
      })
      .eq('id', item.dbOrderId)
      .select('id, order_number, customer_name, total_amount, promo_subsidy');

    if (error) {
      console.error(`❌ Failed to update order #${item.no} (${item.userCust}):`, error);
    } else {
      count++;
      const o = data[0];
      console.log(`✅ Updated Order #${o.order_number} (${o.customer_name}): total_amount=${o.total_amount} | promo_subsidy=${o.promo_subsidy}`);
    }
  }

  console.log(`\n=== SUCCESS: Updated ${count} / ${gofoodUpdates.length} GoFood orders ===`);
}

applyGofoodUpdates();
