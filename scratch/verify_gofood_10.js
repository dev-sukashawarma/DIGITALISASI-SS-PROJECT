require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const gofoodOrders = [
  { no: 1, userCust: 'destria bianti', dbOrderNo: 70, subtotal: 45000, promo: 2655, net: 42345 },
  { no: 2, userCust: 'Ervina Fitriani', dbOrderNo: 67, subtotal: 33000, promo: 0, net: 33000 },
  { no: 3, userCust: 'Nofitra Dewi Suparno', dbOrderNo: 37, subtotal: 74000, promo: 16650, net: 57350 },
  { no: 4, userCust: 'muhammad zain', dbOrderNo: 36, subtotal: 51000, promo: 11475, net: 39525 },
  { no: 5, userCust: 'Arfi', dbOrderNo: 33, subtotal: 108000, promo: 0, net: 108000 },
  { no: 6, userCust: 'Sonia Rahmawati', dbOrderNo: 32, subtotal: 33000, promo: 0, net: 33000 },
  { no: 7, userCust: 'Zahra', dbOrderNo: 27, subtotal: 111000, promo: 8100, net: 102900 },
  { no: 8, userCust: 'Lukman', dbOrderNo: 19, subtotal: 60000, promo: 13500, net: 46500 },
  { no: 9, userCust: 'daffa zein', dbOrderNo: 13, subtotal: 42000, promo: 9450, net: 32550 },
  { no: 10, userCust: 'Widi Andika w', dbOrderNo: 3, subtotal: 29000, promo: 0, net: 29000 }
];

async function verifyGofood10() {
  const empangId = '550e8400-e29b-41d4-a716-446655440002';
  const { data: orders } = await supabase
    .from('orders')
    .select('*')
    .eq('outlet_id', empangId)
    .gte('created_at', '2026-07-20T17:00:00Z')
    .lte('created_at', '2026-07-21T17:00:00Z');

  const result = [];
  let totalSub = 0;
  let totalPromo = 0;
  let totalNet = 0;

  for (const item of gofoodOrders) {
    const o = orders.find(ord => ord.order_number === item.dbOrderNo);
    if (!o) {
      console.error(`Order #${item.dbOrderNo} not found`);
      continue;
    }

    totalSub += item.subtotal;
    totalPromo += item.promo;
    totalNet += item.net;

    result.push({
      no: item.no,
      userCust: item.userCust,
      dbCust: o.customer_name,
      dbOrderId: o.id,
      orderNumber: o.order_number,
      channel: o.channel || o.sales_source,
      subtotal: item.subtotal,
      currentDbTotal: o.total_amount,
      promoSubsidyToApply: item.promo,
      netTotalToApply: item.net
    });
  }

  console.log(JSON.stringify(result, null, 2));
  console.log("\n=== GOFOOD RECAP ===");
  console.log(`Total Subtotal: Rp ${totalSub.toLocaleString('id-ID')}`);
  console.log(`Total Promo (Merchant): Rp ${totalPromo.toLocaleString('id-ID')}`);
  console.log(`Total Net Payment: Rp ${totalNet.toLocaleString('id-ID')}`);
}

verifyGofood10();
