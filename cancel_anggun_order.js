const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://khpkoreaaucvyqfhynfq.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtocGtvcmVhYXVjdnlxZmh5bmZxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDk2MzI5MiwiZXhwIjoyMDk2NTM5MjkyfQ.Dy0QMAHfB8EU9BK-JuyRrBidpG6iM94t9RtiJ_viZz8'
);

async function main() {
  const outletId = '550e8400-e29b-41d4-a716-446655440018'; // MITRA PEKAYON
  
  // 1. Get all negative stock for this outlet
  const { data: negativeStocks } = await supabase.from('stok_balance')
      .select('id, saldo, bahan_baku_id')
      .eq('outlet_id', outletId)
      .lt('saldo', 0);
      
  console.log(`Found ${negativeStocks ? negativeStocks.length : 0} items with negative stock.`);
  
  // 2. Temporarily increase stock to 100
  if (negativeStocks && negativeStocks.length > 0) {
      console.log('Temporarily setting negative stocks to 100...');
      for (const st of negativeStocks) {
          await supabase.from('stok_balance')
              .update({ saldo: 100 })
              .eq('id', st.id);
      }
  }

  // 3. Cancel order
  const orderId = '727ad419-9c40-4e6c-b2a7-61c7de05c369';
  console.log('Cancelling order...');
  const { data: cancelled, error } = await supabase
    .from('orders')
    .update({ 
      status: 'cancelled', 
      cancellation_status: 'approved',
      cancellation_reason: 'cancelled by admin',
      updated_at: new Date().toISOString()
    })
    .eq('id', orderId)
    .select('order_number, customer_name, status, cancellation_status, cancellation_reason');
    
  if (error) {
    console.error('Cancel Error:', error);
  } else {
    console.log('Successfully cancelled:', cancelled);
  }

  // 4. Set stock back to what it was
  if (negativeStocks && negativeStocks.length > 0) {
      console.log('Restoring original stock...');
      for (const st of negativeStocks) {
          await supabase.from('stok_balance')
              .update({ saldo: st.saldo }) // Set back to original negative value
              .eq('id', st.id);
      }
      console.log('Stock restored.');
  }
}
main();
