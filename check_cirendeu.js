const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkCirendeu() {
    console.log("Checking Cirendeu outlet...");
    const { data: outlets, error: outletError } = await supabase
        .from('outlets')
        .select('*')
        .ilike('name', '%cirendeu%');
        
    if (outletError) {
        console.error("Error fetching outlet:", outletError);
        return;
    }
    console.log("Outlets found:", outlets.map(o => ({ id: o.id, name: o.name })));
    
    if (outlets.length === 0) return;
    
    const cirendeuId = outlets[0].id;
    
    // Check orders for yesterday and today
    // Local time is GMT+7. Today is 2026-08-03. Yesterday was 2026-08-02.
    
    console.log(`\nFetching recent orders for ${outlets[0].name} (ID: ${cirendeuId})...`);
    
    const { data: orders, error: ordersError } = await supabase
        .from('orders')
        .select('*')
        .eq('outlet_id', cirendeuId)
        .order('created_at', { ascending: false })
        .limit(50);
        
    if (ordersError) {
        console.error("Error fetching orders:", ordersError);
        return;
    }
    
    const mapped = orders.map(o => ({
        created_at: o.created_at,
        orig_created: o.original_created_at,
        is_offline: o.is_offline,
        offline_id: o.offline_id,
        customer_name: o.customer_name,
        total_amount: o.total_amount,
        status: o.status
    }));
    
    console.table(mapped);
    
    console.log("\nSummary of sync status:");
    const syncStatusCounts = orders.reduce((acc, order) => {
        const status = order.sync_status || 'null';
        acc[status] = (acc[status] || 0) + 1;
        return acc;
    }, {});
    console.log(syncStatusCounts);
}

checkCirendeu();
