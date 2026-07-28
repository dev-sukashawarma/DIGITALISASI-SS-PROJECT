const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: 'apps/absensi/.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function inspectSpvs() {
  console.log('=== INSPECTING SPV / SPV-LEADER / OWNER ACCOUNTS ===\n');

  const { data: spvs } = await supabase
    .from('outlet_staff')
    .select('id, name, email, role, outlet_id')
    .in('role', ['spv', 'admin', 'owner', 'admin_hr', 'korlap', 'leader']);

  console.log(`Found ${spvs ? spvs.length : 0} SPVs / Leaders / Admins:`);

  for (const s of (spvs || [])) {
    const { data: so } = await supabase
      .from('staff_outlets')
      .select('outlet_id, outlets!staff_outlets_outlet_id_fkey(name)')
      .eq('staff_id', s.id);

    const outletNames = (so || []).map(r => r.outlets?.name).filter(Boolean);
    console.log(`- ${s.name} (${s.email || 'no-email'}) | Role: ${s.role} | Primary: ${s.outlet_id} | Mapped Outlets (${outletNames.length}): [${outletNames.join(', ')}]`);
  }
}

inspectSpvs();
