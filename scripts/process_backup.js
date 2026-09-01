const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const env = {};
try {
  fs.readFileSync(path.join(__dirname, '../apps/HR/.env.local'), 'utf8')
    .split('\n')
    .forEach(l => {
      const m = l.match(/^([^=]+)=(.*)$/);
      if (m) env[m[1].trim()] = m[2].trim().replace(/^['"]|['"]$/g, '');
    });
} catch (e) {
  process.exit(1);
}

const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  console.log('=== MEMPROSES SS BACKUP ===\n');

  // 1. Cek atau Buat Outlet "SS BACKUP"
  let backupOutletId = null;
  const { data: existingOutlet } = await sb.from('outlets').select('*').eq('name', 'SS BACKUP').single();
  
  if (existingOutlet) {
    backupOutletId = existingOutlet.id;
    console.log(`Outlet "SS BACKUP" sudah ada (ID: ${backupOutletId})`);
  } else {
    // Generate simple UUID or let supabase do it (depends on schema)
    const { data: newOutlet, error: errOutlet } = await sb.from('outlets').insert({ name: 'SS BACKUP' }).select().single();
    if (errOutlet) {
      console.error("Gagal membuat outlet SS BACKUP:", errOutlet.message);
      return;
    }
    backupOutletId = newOutlet.id;
    console.log(`✅ Outlet "SS BACKUP" berhasil dibuat (ID: ${backupOutletId})`);
  }

  // 2. Update Ricki
  const rickiId = 'b7d6bc3f-11de-4764-8716-4c436326a60b';
  const { error: errRicki } = await sb.from('outlet_staff').update({
    name: 'Ricki Septiawanto',
    outlet_id: backupOutletId
    // note: role dan username tidak diubah sesuai instruksi awal
  }).eq('id', rickiId);
  
  if (!errRicki) {
    console.log("✅ Sukses update: Ricki -> Ricki Septiawanto (dipindah ke SS BACKUP)");
  } else {
    console.error("❌ Error update Ricki:", errRicki.message);
  }

  // 3. Insert 3 Crew Baru
  const newStaff = [
    { name: "Muhammad Naufal Munawwir", pos: "crew" },
    { name: "Exel Vernando Putra", pos: "crew" },
    { name: "Rayhan Saputra", pos: "crew" }
  ];

  for (const s of newStaff) {
    let username = s.name.toLowerCase().replace(/[^a-z0-9]/g, '').substring(0, 8);
    const pin = '123456'; 
    
    const insertData = {
      name: s.name,
      username: username + Math.floor(10 + Math.random() * 90),
      pin: pin,
      role: s.pos,
      outlet_id: backupOutletId,
      status: 'active'
    };

    const { error } = await sb.from('outlet_staff').insert(insertData);
    if (!error) {
      console.log(`✅ Insert sukses: ${s.name} (Role: ${s.pos})`);
    } else {
      console.error(`❌ Error insert ${s.name}:`, error.message);
    }
  }
}

main();
