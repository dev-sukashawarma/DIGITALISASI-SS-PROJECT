require('dotenv').config({path: '.env.local'});
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const staffId = 'a39b77e1-481f-43f6-914e-04f90ab8c2b5'; // abdurrahman
  const outletId = '550e8400-e29b-41d4-a716-446655440009'; // pajajaran

  const { data, error } = await supabase
    .from('staff_outlets')
    .insert([{ staff_id: staffId, outlet_id: outletId }])
    .select();

  console.log('Insert result:', data, error);
}
run();
