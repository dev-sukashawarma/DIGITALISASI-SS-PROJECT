require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const gofoodInput = [
  { no: 1, name: 'destria bianti', subtotal: 45000, promo: 2655, net: 42345 },
  { no: 2, name: 'Ervina Fitriani', subtotal: 33000, promo: 0, net: 33000 },
  { no: 3, name: 'Nofitra Dewi Suparno', subtotal: 74000, promo: 16650, net: 57350 },
  { no: 4, name: 'muhammad zain', subtotal: 51000, promo: 11475, net: 39525 },
  { no: 5, name: 'Arfi', subtotal: 108000, promo: 0, net: 108000 },
  { no: 6, name: 'Sonia Rahmawati', subtotal: 33000, promo: 0, net: 33000 },
  { no: 7, name: 'Zahra', subtotal: 111000, promo: 8100, net: 102900 },
  { no: 8, name: 'Lukman', subtotal: 60000, promo: 13500, net: 46500 },
  { no: 9, name: 'daffa zein', subtotal: 42000, promo: 9450, net: 32550 },
  { no: 10, name: 'Widi Andika w', subtotal: 29000, promo: 0, net: 29000 }
];

async function checkGofoodOrders() {
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

  console.log('Total orders in DB for Empang on 21/07/2026:', orders.length);

  const matched = [];
  const unmatched = [];

  for (const item of gofoodInput) {
    const normInput = item.name.toLowerCase().trim();
    // Search DB
    const found = orders.find(o => {
      const dbCust = (o.customer_name || '').toLowerCase().trim();
      const firstWordInput = normInput.split(' ')[0];
      const firstWordDb = dbCust.split(' ')[0];
      const nameMatch = dbCust.includes(normInput) || normInput.includes(dbCust) || (firstWordInput.length >= 3 && firstWordDb === firstWordInput);
      const subtotalMatch = Math.abs(Number(o.total_amount) - item.subtotal) < 100 || Math.abs(Number(o.total_amount) - item.net) < 100;
      return nameMatch && subtotalMatch;
    });

    if (found) {
      matched.push({ input: item, dbOrder: found });
    } else {
      // Try name match only
      const nameOnly = orders.filter(o => {
        const dbCust = (o.customer_name || '').toLowerCase().trim();
        const firstWordInput = normInput.split(' ')[0];
        return dbCust.includes(firstWordInput);
      });
      unmatched.push({ input: item, candidates: nameOnly });
    }
  }

  console.log('\n--- GOFOOD MATCH RESULTS ---');
  matched.forEach(m => {
    const o = m.dbOrder;
    const i = m.input;
    console.log(`[Input #${i.no}] Cust: '${i.name}' -> DB Order #${o.order_number} (ID: ${o.id}) | DB Cust: '${o.customer_name}' | Channel: '${o.channel||o.sales_source}' | DB Total: ${o.total_amount} | Current PromoSub: ${o.promo_subsidy} | Expected Promo: ${i.promo} | Expected Net: ${i.net}`);
  });

  if (unmatched.length > 0) {
    console.log('\n--- UNMATCHED GOFOOD INPUTS ---');
    unmatched.forEach(u => {
      console.log(`[Input #${u.input.no}] Cust: '${u.input.name}' (Subtotal: ${u.input.subtotal})`);
      if (u.candidates.length > 0) {
        u.candidates.forEach(c => {
          console.log(`   Candidate DB Order #${c.order_number}: Cust='${c.customer_name}', Channel='${c.channel||c.sales_source}', Total=${c.total_amount}`);
        });
      } else {
        console.log('   No candidate found');
      }
    });
  }
}

checkGofoodOrders();
