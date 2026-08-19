const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: 'apps/admin-dashboard/.env.local' });
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);
async function main() {
  const { data: outlets } = await supabase.from('outlets').select('id, name').ilike('name', '%cimanggu%');
  if (outlets && outlets.length > 0) {
    const outletId = outlets[0].id;
    // Test pos_revenue_summary_guarded
    const { data: rpcData, error: rpcError } = await supabase.rpc('pos_revenue_summary_guarded', {
      p_outlet_id: outletId,
      p_start: '2026-08-18T17:00:00Z',
      p_end: '2026-08-19T16:59:59.999Z',
      p_payment_method: null,
      p_channels: null,
      p_include_null_channel: false
    });
    console.log('pos_revenue_summary_guarded Data:', rpcData);
    console.log('pos_revenue_summary_guarded Error:', rpcError);
    
    // Test pos_revenue_summary
    const { data: rpcData2, error: rpcError2 } = await supabase.rpc('pos_revenue_summary', {
      p_outlet_id: outletId,
      p_start: '2026-08-18T17:00:00Z',
      p_end: '2026-08-19T16:59:59.999Z',
      p_payment_method: null,
      p_channels: null,
      p_include_null_channel: false
    });
    console.log('pos_revenue_summary Data:', rpcData2);
    console.log('pos_revenue_summary Error:', rpcError2);
  }
}
main();
