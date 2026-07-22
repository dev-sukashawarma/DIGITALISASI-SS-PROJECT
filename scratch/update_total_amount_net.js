require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const updates = [
  { no: 1, name: 'kiaaa', dbOrderId: '47dbe0d7-eb34-48a6-b662-fcb4fb5ab45c', subtotal: 51000, promo: 17541, net: 33459 },
  { no: 2, name: 'agungnugraha070299', dbOrderId: '3dff1d8e-fdff-4545-8d06-8b0041450e34', subtotal: 41000, promo: 9429, net: 31571 },
  { no: 3, name: 'Ulfah', dbOrderId: 'a90aac22-dd04-42a3-a769-18ea5c945684', subtotal: 123000, promo: 38028, net: 84972 },
  { no: 4, name: 'Arina', dbOrderId: 'c3269df1-8f82-4833-b572-b4b1db81715f', subtotal: 33000, promo: 7983, net: 25017 },
  { no: 5, name: 'abueve', dbOrderId: '9f2d2716-44e7-46ee-acfd-8b4075002e7d', subtotal: 35000, promo: 8346, net: 26654 },
  { no: 6, name: 'raayusna', dbOrderId: '5b47bb93-a0e5-43ba-9384-c25aacd04092', subtotal: 41000, promo: 8036, net: 32964 },
  { no: 7, name: 'Cinta', dbOrderId: '61454c6a-547a-4b81-8fdd-62f171e1c293', subtotal: 77000, promo: 19901, net: 57099 },
  { no: 8, name: 'evi', dbOrderId: '903e266c-7dfd-4abf-8e89-aa4249373acf', subtotal: 33000, promo: 6900, net: 26100 },
  { no: 9, name: 'MAT', dbOrderId: '627d035e-b8c4-4c01-9a44-59b59130fa45', subtotal: 90000, promo: 19930, net: 70070 },
  { no: 10, name: 'Adis', dbOrderId: 'd7baba1d-6f33-4ac3-a5f8-389780b17efb', subtotal: 39000, promo: 6900, net: 32100 },
  { no: 11, name: 'Tuti', dbOrderId: '2f521ce9-e37f-48b2-8c40-1c1f2afb13da', subtotal: 108000, promo: 34488, net: 73512 },
  { no: 12, name: 'Stefanny', dbOrderId: 'cc55eb63-1918-4511-959c-1de05f35cf57', subtotal: 62000, promo: 16803, net: 45197 },
  { no: 13, name: 'Ikhsan', dbOrderId: 'dbab1d0f-9ea7-4c9c-8c7d-f60c22410cc0', subtotal: 121000, promo: 35056, net: 85944 },
  { no: 14, name: '547u00vb8o', dbOrderId: 'c05f7825-1559-4f11-ae1d-f1a81b4ae8c9', subtotal: 78000, promo: 21028, net: 56972 },
  { no: 15, name: 'Diana', dbOrderId: 'ec5c989b-3e9a-40db-9383-75caed209309', subtotal: 29000, promo: 5880, net: 23120 },
  { no: 16, name: 'nandagabrielle', dbOrderId: '0e73e3a8-aed9-466d-88eb-dcabb78c7491', subtotal: 33000, promo: 10894, net: 22106 },
  { no: 17, name: 'Ruddy', dbOrderId: 'd609fcba-27cd-448c-896c-d107bca720b4', subtotal: 105000, promo: 33780, net: 71220 },
  { no: 18, name: 'Wita', dbOrderId: '75df4636-9635-4020-88b2-70c81a3fdba7', subtotal: 36000, promo: 7645, net: 28355 }
];

async function applyNetTotalUpdates() {
  console.log("=== UPDATING total_amount TO NET PAYMENT (subtotal - promo) FOR 18 ORDERS ===");
  let successCount = 0;

  for (const item of updates) {
    const { data, error } = await supabase
      .from('orders')
      .update({
        total_amount: item.net,
        promo_subsidy: item.promo
      })
      .eq('id', item.dbOrderId)
      .select('id, order_number, customer_name, total_amount, promo_subsidy');

    if (error) {
      console.error(`❌ Error updating order #${item.no} (${item.name}):`, error);
    } else {
      successCount++;
      const o = data[0];
      console.log(`✅ Updated Order #${o.order_number} (${o.customer_name}): total_amount=${o.total_amount} | promo_subsidy=${o.promo_subsidy}`);
    }
  }

  console.log(`\n=== SUCCESS: ${successCount} / ${updates.length} orders updated to net payment amount ===`);
}

applyNetTotalUpdates();
