require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const userList = [
  // Table 1
  { no: 1, name: 'kiaaa', subtotal: 51000, promo: 17541, total: 33459, dbOrderNo: 72 },
  { no: 2, name: 'agungnugraha070299', subtotal: 41000, promo: 9429, total: 31571, dbOrderNo: 71 },
  { no: 3, name: 'Ulfah', subtotal: 123000, promo: 38028, total: 84972, dbOrderNo: 68 },
  { no: 4, name: 'Arina', subtotal: 33000, promo: 7983, total: 25017, dbOrderNo: 65 },
  { no: 5, name: 'abueve', subtotal: 35000, promo: 8346, total: 26654, dbOrderNo: 64 },
  { no: 6, name: 'raayusna', subtotal: 41000, promo: 8036, total: 32964, dbOrderNo: 63 },
  { no: 7, name: 'Cinta', subtotal: 77000, promo: 19901, total: 57099, dbOrderNo: 62 },
  { no: 8, name: 'evi', subtotal: 33000, promo: 6900, total: 26100, dbOrderNo: 44 },
  { no: 9, name: 'MAT', subtotal: 90000, promo: 19930, total: 70070, dbOrderNo: 46 },
  { no: 10, name: 'Adis', subtotal: 39000, promo: 6900, total: 32100, dbOrderNo: 45 },
  // Table 2
  { no: 11, name: 'Tuti', subtotal: 108000, promo: 34488, total: 73512, dbOrderNo: 2 },
  { no: 12, name: 'Stefanny', subtotal: 62000, promo: 16803, total: 45197, dbOrderNo: 35 },
  { no: 13, name: 'Ikhsan', subtotal: 121000, promo: 35056, total: 85944, dbOrderNo: 12 },
  { no: 14, name: '547u00vb8o', subtotal: 78000, promo: 21028, total: 56972, dbOrderNo: 7 },
  { no: 15, name: 'Diana', subtotal: 29000, promo: 5880, total: 23120, dbOrderNo: 21 },
  { no: 16, name: 'nandagabrielle', subtotal: 33000, promo: 10894, total: 22106, dbOrderNo: 28 },
  { no: 17, name: 'Ruddy', subtotal: 105000, promo: 33780, total: 71220, dbOrderNo: 6 },
  { no: 18, name: 'Wita', subtotal: 36000, promo: 7645, total: 28355, dbOrderNo: 4 }
];

async function verifyAll18() {
  const empangId = '550e8400-e29b-41d4-a716-446655440002';
  const { data: orders } = await supabase
    .from('orders')
    .select('*')
    .eq('outlet_id', empangId)
    .gte('created_at', '2026-07-20T17:00:00Z')
    .lte('created_at', '2026-07-21T17:00:00Z');

  const report = [];
  let totalSubtotal = 0;
  let totalPromo = 0;
  let totalNetPayment = 0;

  for (const u of userList) {
    const o = orders.find(ord => ord.order_number === u.dbOrderNo);
    if (!o) {
      console.error(`Order #${u.dbOrderNo} not found!`);
      continue;
    }
    totalSubtotal += u.subtotal;
    totalPromo += u.promo;
    totalNetPayment += u.total;

    report.push({
      no: u.no,
      userCust: u.name,
      dbCust: o.customer_name,
      dbOrderId: o.id,
      orderNumber: o.order_number,
      channel: o.channel || o.sales_source,
      subtotal: u.subtotal,
      dbTotalAmount: o.total_amount,
      promoDisc: u.promo,
      netPayment: u.total,
      currentDiscInDb: o.discount_amount,
      currentPromoSubsidyInDb: o.promo_subsidy
    });
  }

  console.log(JSON.stringify(report, null, 2));
  console.log("\n=== TOTAL RECAP ===");
  console.log(`Total Subtotal: Rp ${totalSubtotal.toLocaleString('id-ID')}`);
  console.log(`Total Potongan Promo: Rp ${totalPromo.toLocaleString('id-ID')}`);
  console.log(`Total Pembayaran (Net): Rp ${totalNetPayment.toLocaleString('id-ID')}`);
}

verifyAll18();
