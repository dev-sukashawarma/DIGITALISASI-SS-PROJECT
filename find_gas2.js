const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://khpkoreaaucvyqfhynfq.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtocGtvcmVhYXVjdnlxZmh5bmZxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDk2MzI5MiwiZXhwIjoyMDk2NTM5MjkyfQ.Dy0QMAHfB8EU9BK-JuyRrBidpG6iM94t9RtiJ_viZz8'
);

async function main() {
  const { data: b } = await supabase.from('bahan_baku').select('*').limit(1);
  console.log('bahan_baku schema:', b ? Object.keys(b[0] || {}) : 'error');

  const { data: bb } = await supabase.from('bahan_baku').select('*');
  if(bb) {
     const gas = bb.find(x => Object.values(x).some(v => String(v).toLowerCase().includes('gas')));
     console.log('GAS found:', gas);
     
     if (gas) {
       const { data: stok } = await supabase.from('stok_balance').select('*').eq('outlet_id', '550e8400-e29b-41d4-a716-446655440002').eq('bahan_id', gas.id);
       console.log('Stok:', stok);
     }
  }
}
main();
