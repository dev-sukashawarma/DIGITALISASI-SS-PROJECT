const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: 'apps/admin-dashboard/.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://khpkoreaaucvyqfhynfq.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtocGtvcmVhYXVjdnlxZmh5bmZxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDk2MzI5MiwiZXhwIjoyMDk2NTM5MjkyfQ.Dy0QMAHfB8EU9BK-JuyRrBidpG6iM94t9RtiJ_viZz8';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function main() {
  const { data: user, error: userError } = await supabase
    .from('outlet_staff')
    .select('id, name, username, role')
    .ilike('name', '%reja%');

  console.log('User Reja:', user);

  const { data: outlet, error: outletError } = await supabase
    .from('outlets')
    .select('id, name')
    .ilike('name', '%cileungsi%');

  console.log('Outlet Cileungsi:', outlet);
  
  if (user && user.length > 0 && outlet && outlet.length > 0) {
      const { data: mapping, error: mappingError } = await supabase
        .from('staff_outlets')
        .select('*')
        .eq('staff_id', user[0].id)
        .eq('outlet_id', outlet[0].id);
      
      console.log('Existing Mapping:', mapping);
  }
}

main();
