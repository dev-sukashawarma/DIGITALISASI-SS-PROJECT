const url = 'https://khpkoreaaucvyqfhynfq.supabase.co';
const serviceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtocGtvcmVhYXVjdnlxZmh5bmZxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDk2MzI5MiwiZXhwIjoyMDk2NTM5MjkyfQ.Dy0QMAHfB8EU9BK-JuyRrBidpG6iM94t9RtiJ_viZz8';

const outletId = 'eb174b2b-ff69-47eb-97af-b6c824d3ce4a';

async function req(path, method = 'GET', body = null) {
  const options = {
    method,
    headers: {
      'apikey': serviceKey,
      'Authorization': `Bearer ${serviceKey}`,
      'Content-Type': 'application/json'
    }
  };
  if (body) {
    options.body = JSON.stringify(body);
  }
  const res = await fetch(`${url}/rest/v1/${path}`, options);
  if (!res.ok) {
    const text = await res.text();
    console.log(`Failed ${method} ${path}:`, text);
    return null;
  }
  if (method === 'GET') {
    return res.json();
  }
  return res.text();
}

async function cleanData() {
  console.log('Fetching orders...');
  const orders = await req(`orders?outlet_id=eq.${outletId}&select=id`);
  if (orders) {
    console.log(`Found ${orders.length} orders.`);
    
    // Deleting order_items
    for (const order of orders) {
      await req(`order_items?order_id=eq.${order.id}`, 'DELETE');
    }
    console.log('Deleted order_items.');
    
    // Try to delete cancellation_requests by order_id
    for (const order of orders) {
      await req(`cancellation_requests?order_id=eq.${order.id}`, 'DELETE');
    }
    
    // Delete orders
    await req(`orders?outlet_id=eq.${outletId}`, 'DELETE');
    console.log('Deleted orders.');
  }

  // cash_transaction
  await req(`cash_transaction?outlet_id=eq.${outletId}`, 'DELETE');
  console.log('Deleted cash_transaction.');
  
  // ledger_transaksi_ringkas
  await req(`ledger_transaksi_ringkas?outlet_id=eq.${outletId}`, 'DELETE');
  console.log('Deleted ledger_transaksi_ringkas.');
  
  // ledger_stok
  await req(`ledger_stok?outlet_id=eq.${outletId}`, 'DELETE');
  console.log('Deleted ledger_stok.');
  
  // shifts
  await req(`shifts?outlet_id=eq.${outletId}`, 'DELETE');
  console.log('Deleted shifts.');
  
  // outlet_order_counters
  await req(`outlet_order_counters?outlet_id=eq.${outletId}`, 'DELETE');
  console.log('Deleted outlet_order_counters.');
  
  // petty_cash_expenses
  await req(`petty_cash_expenses?outlet_id=eq.${outletId}`, 'DELETE');
  console.log('Deleted petty_cash_expenses.');
  
  // petty_cash_topups
  await req(`petty_cash_topups?outlet_id=eq.${outletId}`, 'DELETE');
  console.log('Deleted petty_cash_topups.');
  
  // daily_sales_targets
  await req(`daily_sales_targets?outlet_id=eq.${outletId}`, 'DELETE');
  console.log('Deleted daily_sales_targets.');
  
  // opname
  await req(`opname?outlet_id=eq.${outletId}`, 'DELETE');
  console.log('Deleted opname.');
  
  // cash_balance
  await req(`cash_balance?outlet_id=eq.${outletId}`, 'DELETE');
  console.log('Deleted cash_balance.');
  
  // mutasi_antar_outlet
  await req(`mutasi_antar_outlet?origin_outlet_id=eq.${outletId}`, 'DELETE');
  await req(`mutasi_antar_outlet?destination_outlet_id=eq.${outletId}`, 'DELETE');
  console.log('Deleted mutasi_antar_outlet.');
  
  // hr_cash_advances (if any related? probably not)
  // ecommerce_sales ?
  // What about ecommerce_sales? Let's check how it references. 
  // It probably uses outlet_id or order_id. We'll leave it for now.
  
  console.log('Cleanup complete.');
}

cleanData();
