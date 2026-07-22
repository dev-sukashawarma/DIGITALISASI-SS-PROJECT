require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const providedData = [
  { no: 1, name: 'kiaaa', subtotal: 51000, promo: 17541, total: 33459 },
  { no: 2, name: 'agungnugraha070299', subtotal: 41000, promo: 9429, total: 31571 },
  { no: 3, name: 'Ulfah', subtotal: 123000, promo: 38028, total: 84972 },
  { no: 4, name: 'Arina', subtotal: 33000, promo: 7983, total: 25017 },
  { no: 5, name: 'abueve', subtotal: 35000, promo: 8346, total: 26654 },
  { no: 6, name: 'raayusna', subtotal: 41000, promo: 8036, total: 32964 },
  { no: 7, name: 'Cinta', subtotal: 77000, promo: 19901, total: 57099 },
  { no: 8, name: 'evi', subtotal: 33000, promo: 6900, total: 26100 },
  { no: 9, name: 'MAT', subtotal: 90000, promo: 19930, total: 70070 },
  { no: 10, name: 'Adis', subtotal: 39000, promo: 6900, total: 32100 },
  { no: 11, name: 'Tuti', subtotal: 108000, promo: 34488, total: 73512 },
  { no: 12, name: 'Stefanny', subtotal: 62000, promo: 16803, total: 45197 },
  { no: 13, name: 'Ikhsan', subtotal: 121000, promo: 35056, total: 85944 },
  { no: 14, name: '547u00vb8o', subtotal: 78000, promo: 21028, total: 56972 },
  { no: 15, name: 'Diana', subtotal: 29000, promo: 5880, total: 23120 },
  { no: 16, name: 'nandagabrielle', subtotal: 33000, promo: 10894, total: 22106 },
  { no: 17, name: 'Ruddy', subtotal: 105000, promo: 33780, total: 71220 },
  { no: 18, name: 'Wita', subtotal: 36000, promo: 7645, total: 28355 }
];

async function detailedCheck() {
  const empangId = '550e8400-e29b-41d4-a716-446655440002';

  const { data: orders, error } = await supabase
    .from('orders')
    .select('*, order_items(*)')
    .eq('outlet_id', empangId)
    .gte('created_at', '2026-07-20T17:00:00Z')
    .lte('created_at', '2026-07-21T17:00:00Z')
    .order('created_at', { ascending: true });

  if (error) {
    console.error(error);
    return;
  }

  console.log("=== ALL ORDERS ON 2026-07-21 (WIB) ===");
  orders.forEach(o => {
    console.log(`[Order #${o.order_number}] Cust: ${o.customer_name} | Channel: ${o.channel || o.sales_source} | Amount: ${o.total_amount} | Disc: ${o.discount_amount} | Subsidy: ${o.promo_subsidy} | Created: ${o.created_at}`);
  });

  console.log("\n=== COMPARING EACH USER ITEM TO DB ===");
  for (const item of providedData) {
    const normInput = item.name.toLowerCase();
    // Try matching
    const matches = orders.filter(o => {
      const dbCust = (o.customer_name || '').toLowerCase();
      return dbCust.includes(normInput) || normInput.includes(dbCust) || dbCust.startsWith(normInput.slice(0, 3));
    });

    console.log(`\nInput #${item.no}: '${item.name}' | Subtotal: ${item.subtotal} | Expected Promo: -${item.promo} | Net: ${item.total}`);
    if (matches.length > 0) {
      matches.forEach(m => {
        console.log(`   -> Found DB Order #${m.order_number} (ID: ${m.id}): Cust='${m.customer_name}', Channel='${m.channel || m.sales_source}', Total=${m.total_amount}, Discount=${m.discount_amount}, Subsidy=${m.promo_subsidy}`);
      });
    } else {
      console.log(`   -> ❌ NO MATCH FOUND BY NAME`);
      // Find by exact amount
      const amtMatches = orders.filter(o => Number(o.total_amount) === item.subtotal);
      console.log(`   -> Candidates by exact Subtotal (${item.subtotal}):`, amtMatches.map(a => `#${a.order_number} '${a.customer_name}' (${a.channel || a.sales_source})`).join(', '));
    }
  }
}

detailedCheck();
