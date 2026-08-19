import { createClient } from '@supabase/supabase-js';
const SUPABASE_URL = 'https://khpkoreaaucvyqfhynfq.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtocGtvcmVhYXVjdnlxZmh5bmZxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDk2MzI5MiwiZXhwIjoyMDk2NTM5MjkyfQ.Dy0QMAHfB8EU9BK-JuyRrBidpG6iM94t9RtiJ_viZz8';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function checkCash() {
  const sentulId = 'fc9608aa-8d07-4277-bfcb-f4db95781da2';
  const startDate = '2026-08-17T00:00:00+07:00';
  const endDate = '2026-08-17T23:59:59+07:00';
  
  const { data: orders } = await supabase
    .from('orders')
    .select('*')
    .eq('outlet_id', sentulId)
    .gte('created_at', startDate)
    .lte('created_at', endDate);
    
  let cashTotal = 0;
  let qrisTotal = 0;
  let debitTotal = 0;

  for (const o of orders) {
    if (o.status === 'cancelled') continue;
    
    const gross = (Number(o.total_amount) || 0) + (Number(o.discount_amount) || 0) + (Number(o.promo_subsidy) || 0);
    const net = Number(o.total_amount) || 0;
    
    if (o.payment_method === 'cash') {
      cashTotal += gross;
      if (gross !== net) console.log('CASH Order #' + o.order_number + ' Net: ' + net + ' Gross: ' + gross + ' diff: ' + (gross - net));
    } else if (o.payment_method === 'qris') {
      qrisTotal += gross;
    } else if (o.payment_method === 'card') {
      debitTotal += gross;
    }
  }

  console.log('Total CASH (Gross): ' + cashTotal);
  console.log('Total QRIS (Gross): ' + qrisTotal);
  console.log('Total DEBIT (Gross): ' + debitTotal);
}
checkCash();
