import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://khpkoreaaucvyqfhynfq.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtocGtvcmVhYXVjdnlxZmh5bmZxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDk2MzI5MiwiZXhwIjoyMDk2NTM5MjkyfQ.Dy0QMAHfB8EU9BK-JuyRrBidpG6iM94t9RtiJ_viZz8'; // service_role

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function checkCash() {
  console.log('Checking Sentul Cash Income for 2026-08-17...');

  const { data: outlets } = await supabase.from('outlets').select('*').ilike('name', '%sentul%');
  const sentulId = outlets[0].id;

  const startDate = '2026-08-17T00:00:00+07:00';
  const endDate = '2026-08-17T23:59:59+07:00';
  
  const { data: orders } = await supabase
    .from('orders')
    .select(`
      id, order_number, total_amount, payment_method, status, created_at, customer_name, channel,
      order_items ( menu_item_name, quantity, subtotal )
    `)
    .eq('outlet_id', sentulId)
    .gte('created_at', startDate)
    .lte('created_at', endDate);
    
  let cashTotal = 0;
  let qrisTotal = 0;
  let onlineTotal = 0;
  let cancelledTotal = 0;
  let totalPending = 0;
  
  for (const o of orders) {
    if (o.status === 'cancelled') {
      cancelledTotal += Number(o.total_amount);
      continue;
    }
    
    if (o.status === 'pending' || o.status === 'preparing') {
      totalPending += Number(o.total_amount);
    }
    
    if (o.payment_method === 'cash') {
      cashTotal += Number(o.total_amount);
      console.log(`CASH Order #${o.order_number}: ${o.total_amount} (Status: ${o.status})`);
      if (Number(o.total_amount) === 9000) {
        console.log(`  -> THIS IS EXACTLY 9000!`);
      }
    } else if (o.payment_method === 'qris') {
      qrisTotal += Number(o.total_amount);
    } else {
      onlineTotal += Number(o.total_amount);
    }
  }

  console.log(`\n=== SUMMARY ===`);
  console.log(`Total CASH orders: ${cashTotal}`);
  console.log(`Total QRIS orders: ${qrisTotal}`);
  console.log(`Total ONLINE orders: ${onlineTotal}`);
  console.log(`Total CANCELLED orders: ${cancelledTotal}`);
  console.log(`Total PENDING/PREPARING: ${totalPending}`);
  
  // Also check expenses/petty cash
  const { data: expenses } = await supabase
    .from('expenses')
    .select('*')
    .eq('outlet_id', sentulId)
    .gte('created_at', startDate)
    .lte('created_at', endDate);
    
  console.log(`\n=== EXPENSES / PETTY CASH ===`);
  if (!expenses || expenses.length === 0) {
    console.log(`No expenses recorded.`);
  } else {
    for (const e of expenses) {
      console.log(`Expense: ${e.description} - ${e.amount}`);
    }
  }
}

checkCash();
