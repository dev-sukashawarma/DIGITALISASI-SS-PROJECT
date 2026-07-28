const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '../apps/admin-dashboard/.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://khpkoreaaucvyqfhynfq.supabase.co';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtocGtvcmVhYXVjdnlxZmh5bmZxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDk2MzI5MiwiZXhwIjoyMDk2NTM5MjkyfQ.Dy0QMAHfB8EU9BK-JuyRrBidpG6iM94t9RtiJ_viZz8';

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function testFixServerAction() {
  const { data: topup } = await supabase.from('petty_cash_topups').select('*').eq('id', 'db7c9f17-0820-412e-89c7-2920b8c6b6eb').single();
  
  const { data: updateData, error: updateError } = await supabase
    .from('petty_cash_topups')
    .update({
      status: 'approved_by_finance',
      finance_approved_by: null,
      disbursement_method: 'transfer',
      disbursed_from_cash_location_id: null,
      proof_of_transfer_url: null,
      amount: 400000,
      description: topup.description
    })
    .eq('id', 'db7c9f17-0820-412e-89c7-2920b8c6b6eb')
    .select();

  console.log('Update verified data:', updateData, updateError);
}

testFixServerAction();
