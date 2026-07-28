const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '../apps/admin-dashboard/.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkStaffOutlets() {
  const { data: staffOutlets, error } = await supabase
    .from('staff_outlets')
    .select('*, outlet_staff(id, name, role, is_active, outlet_id), outlets(id, name)');

  console.log('staff_outlets mapping count:', staffOutlets?.length, error);
  console.log('Sample staff_outlets:', JSON.stringify(staffOutlets?.slice(0, 10), null, 2));
}

checkStaffOutlets();
