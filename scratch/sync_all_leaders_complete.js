const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: 'apps/absensi/.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function syncAllLeadersComplete() {
  console.log('=====================================================');
  console.log('   SYNCING ALL LEADERS MULTI-OUTLET MAPPINGS IN DB   ');
  console.log('=====================================================\n');

  // Fetch all staff members with role leader, korlap, spv
  const { data: staffList, error: errStaff } = await supabase
    .from('outlet_staff')
    .select('id, name, email, role, outlet_id')
    .in('role', ['leader', 'korlap', 'spv']);

  if (errStaff) {
    console.error('Error fetching staff:', errStaff);
    return;
  }

  console.log(`Found ${staffList.length} leaders/korlaps/spvs in outlet_staff:`);

  for (const s of staffList) {
    // 1. Ensure primary outlet_id from outlet_staff is in staff_outlets
    if (s.outlet_id) {
      const { data: existPrimary } = await supabase
        .from('staff_outlets')
        .select('*')
        .eq('staff_id', s.id)
        .eq('outlet_id', s.outlet_id)
        .maybeSingle();

      if (!existPrimary) {
        await supabase.from('staff_outlets').insert({ staff_id: s.id, outlet_id: s.outlet_id });
        console.log(`  + Inserted primary outlet for ${s.name} (${s.role})`);
      }
    }
  }

  // Define multi-outlet mappings for leaders based on operational assignments:
  // 1. Leader Reza: MITRA CICURUG & SUKA SHAWARMA DRAMAGA
  // 2. Leader Abdurrahman: SUKA SHAWARMA EMPANG & MITRA PALEDANG
  // 3. Korlap Budi Korlap: MITRA PALEDANG & SUKA SHAWARMA DEPOK SUKMAJAYA
  // 4. Leader Muchtar: MITRA CIBINONG, MITRA CISEENG, MITRA SENTUL
  // 5. Leader Tri Rizky: SUKA SHAWARMA JAGAKARSA, MITRA KALISARI, MITRA CIBUBUR
  // 6. Leader Mulyadi: MITRA PEKAYON, SUKA SHAWARMA JATIWARINGIN, SUKA SHAWARMA JATIASIH
  // 7. Leader Abyansah: SUKA SHAWARMA BNR, MITRA PALEDANG, SUKA SHAWARMA PAJAJARAN, GUDANG PUSAT (HQ)

  const { data: outlets } = await supabase.from('outlets').select('id, name');
  const outletNameToId = {};
  outlets?.forEach(o => { outletNameToId[o.name] = o.id; });

  const multiLeaderConfigs = [
    { email: 'reza@ss.com', outletNames: ['MITRA CICURUG', 'SUKA SHAWARMA DRAMAGA'] },
    { email: 'abdurrahmanss@ss.com', outletNames: ['SUKA SHAWARMA EMPANG', 'MITRA PALEDANG'] },
    { name: 'Budi Korlap', outletNames: ['MITRA PALEDANG', 'SUKA SHAWARMA DEPOK SUKMAJAYA'] },
    { email: 'muchtar@ss.com', outletNames: ['MITRA CIBINONG', 'MITRA CISEENG', 'MITRA SENTUL'] },
    { email: 'tririzky@ss.com', outletNames: ['SUKA SHAWARMA JAGAKARSA', 'MITRA KALISARI', 'MITRA CIBUBUR'] },
    { email: 'mulyadi@ss.com', outletNames: ['MITRA PEKAYON', 'SUKA SHAWARMA JATIWARINGIN', 'SUKA SHAWARMA JATIASIH'] },
    { email: 'abyansah@ss.com', outletNames: ['GUDANG PUSAT (HQ)', 'SUKA SHAWARMA BNR', 'MITRA PALEDANG', 'SUKA SHAWARMA PAJAJARAN'] }
  ];

  for (const cfg of multiLeaderConfigs) {
    let leader = null;
    if (cfg.email) {
      const { data } = await supabase.from('outlet_staff').select('id, name').eq('email', cfg.email).maybeSingle();
      leader = data;
    } else if (cfg.name) {
      const { data } = await supabase.from('outlet_staff').select('id, name').eq('name', cfg.name).maybeSingle();
      leader = data;
    }

    if (!leader) continue;

    const targetOutletIds = cfg.outletNames.map(n => outletNameToId[n]).filter(Boolean);
    for (const outId of targetOutletIds) {
      const { data: existing } = await supabase
        .from('staff_outlets')
        .select('*')
        .eq('staff_id', leader.id)
        .eq('outlet_id', outId)
        .maybeSingle();

      if (!existing) {
        await supabase.from('staff_outlets').insert({ staff_id: leader.id, outlet_id: outId });
        console.log(`  + Added ${cfg.outletNames.find(n => outletNameToId[n] === outId)} for ${leader.name}`);
      }
    }
  }

  console.log('\n✅ DATABASE MULTI-OUTLET SYNC COMPLETED SUCCESSFULLY!');
}

syncAllLeadersComplete();
