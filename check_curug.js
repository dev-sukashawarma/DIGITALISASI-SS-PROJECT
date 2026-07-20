const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function main() {
  const outletId = 'd9a2ef93-c298-4501-a471-1c5e2b3dff08';

  // 2. Check Attendance Configuration
  console.log('\n--- 2. ATTENDANCE CONFIGURATION ---');
  const { data: configData, error: configError } = await supabase
    .from('outlet_attendance_config')
    .select('*')
    .eq('outlet_id', outletId);

  if (configError) {
    console.error('Error fetching config:', configError);
  } else {
    console.log(JSON.stringify(configData, null, 2));
  }
}
main();
