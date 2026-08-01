const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env' });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function inject(outletId, outletName, amount) {
    const { data, error } = await supabase.from('petty_cash_topups').insert({
        outlet_id: outletId,
        amount: amount,
        description: 'Injection by system (masuk 300)',
        status: 'completed',
        completed_at: new Date().toISOString(),
        created_at: new Date().toISOString()
    }).select().single();
    
    if (error) {
        console.error(`Error injecting petty cash for ${outletName}:`, error);
    } else {
        console.log(`Successfully injected ${amount} for ${outletName}. Record ID: ${data.id}`);
    }
}

async function main() {
   // Sawangan
   await inject('550e8400-e29b-41d4-a716-446655440008', 'Sawangan', 300000); 
   // Jagakarsa
   await inject('550e8400-e29b-41d4-a716-446655440006', 'Jagakarsa', 300000); 
   // Cirendeu
   await inject('550e8400-e29b-41d4-a716-446655440011', 'Cirendeu', 300000); 
}

main();
