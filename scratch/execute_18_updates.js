require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const updates = [
  { no: 1, name: 'kiaaa', dbOrderId: '47dbe0d7-eb34-48a6-b662-fcb4fb5ab45c', promo: 17541 },
  { no: 2, name: 'agungnugraha070299', dbOrderId: '3dff1d8e-fdff-4545-8d06-8b0041450e34', promo: 9429 },
  { no: 3, name: 'Ulfah', dbOrderId: 'a90aac22-dd04-42a3-a769-18ea5c945684', promo: 38028 },
  { no: 4, name: 'Arina', dbOrderId: 'c3269df1-8f82-4833-b572-b4b1db81715f', promo: 7983 },
  { no: 5, name: 'abueve', dbOrderId: '9f2d2716-44e7-46ee-acfd-8b4075002e7d', promo: 8346 },
  { no: 6, name: 'raayusna', dbOrderId: '5b47bb93-a0e5-43ba-9384-c25aacd04092', promo: 8036 },
  { no: 7, name: 'Cinta', dbOrderId: '61454c6a-547a-4b81-8fdd-62f171e1c293', promo: 19901 },
  { no: 8, name: 'evi', dbOrderId: '903e266c-7dfd-4abf-8e89-aa4249373acf', promo: 6900 },
  { no: 9, name: 'MAT', dbOrderId: '627d035e-b8c4-4c01-9a44-59b59130fa45', promo: 19930 },
  { no: 10, name: 'Adis', dbOrderId: 'd7baba1d-6f33-4ac3-a5f8-389780b17efb', promo: 6900 },
  { no: 11, name: 'Tuti', dbOrderId: '2f521ce9-e37f-48b2-8c40-1c1f2afb13da', promo: 34488 },
  { no: 12, name: 'Stefanny', dbOrderId: 'cc55eb63-1918-4511-959c-1de05f35cf57', promo: 16803 },
  { no: 13, name: 'Ikhsan', dbOrderId: 'dbab1d0f-9ea7-4c9c-8c7d-f60c22410cc0', promo: 35056 },
  { no: 14, name: '547u00vb8o', dbOrderId: 'c05f7825-1559-4f11-ae1d-f1a81b4ae8c9', promo: 21028 },
  { no: 15, name: 'Diana', dbOrderId: 'ec5c989b-3e9a-40db-9383-75caed209309', promo: 5880 },
  { no: 16, name: 'nandagabrielle', dbOrderId: '0e73e3a8-aed9-466d-88eb-dcabb78c7491', promo: 10894 },
  { no: 17, name: 'Ruddy', dbOrderId: 'd609fcba-27cd-448c-896c-d107bca720b4', promo: 33780 },
  { no: 18, name: 'Wita', dbOrderId: '75df4636-9635-4020-88b2-70c81a3fdba7', promo: 7645 }
];

async function runUpdates() {
  console.log("=== STARTING UPDATE FOR 18 SHOPEEFOOD ORDERS ===");
  let updatedCount = 0;

  for (const item of updates) {
    const { data, error } = await supabase
      .from('orders')
      .update({ promo_subsidy: item.promo })
      .eq('id', item.dbOrderId)
      .select('id, customer_name, total_amount, promo_subsidy');

    if (error) {
      console.error(`❌ Failed to update item #${item.no} (${item.name}, ID: ${item.dbOrderId}):`, error);
    } else {
      updatedCount++;
      console.log(`✅ Updated #${item.no} (${item.name}): ID=${data[0].id} | Cust='${data[0].customer_name}' | PromoSubsidy=${data[0].promo_subsidy}`);
    }
  }

  console.log(`\n=== SUCCESS: Updated ${updatedCount} / ${updates.length} orders ===`);
}

runUpdates();
