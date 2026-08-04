const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function main() {
  const { data: staff, error } = await supabase
    .from('outlet_staff')
    .select('id, name, username, email, role, is_active')
    .or('username.eq.am,email.eq.am@test.com,email.eq.am@ss.com,role.eq.area_manager');
    
  if (error) {
    console.error('Error fetching outlet_staff:', error.message);
  } else {
    console.log('Outlet Staff matching criteria:');
    console.log(staff);
  }
}
main();
