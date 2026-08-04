const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkTriggers() {
    const { data, error } = await supabase.rpc('query_triggers', {});
    // Since we don't have a known RPC for triggers, we can query the pg_trigger table directly using a standard query if it works,
    // or just fetch orders for cirendeu and see their shift_id compared to created_at.
    
    // Fetch recent orders for Cirendeu with their shift_id
    const { data: orders, error: ordersError } = await supabase
        .from('orders')
        .select('id, created_at, shift_id, outlet_id, cashier_name, total_amount')
        .eq('outlet_id', '550e8400-e29b-41d4-a716-446655440011')
        .order('created_at', { ascending: false })
        .limit(10);
        
    if (ordersError) {
        console.error("Error:", ordersError);
        return;
    }
    
    console.table(orders);
    
    // Let's also fetch the shifts for this outlet
    const { data: shifts, error: shiftsError } = await supabase
        .from('shifts')
        .select('id, outlet_id, start_time, end_time, status')
        .eq('outlet_id', '550e8400-e29b-41d4-a716-446655440011')
        .order('start_time', { ascending: false })
        .limit(5);
        
    if (shiftsError) {
        console.error("Error fetching shifts:", shiftsError);
        return;
    }
    
    console.log("\nRecent Shifts:");
    console.table(shifts);
}

checkTriggers();
