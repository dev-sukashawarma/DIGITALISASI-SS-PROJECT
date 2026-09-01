const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

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
  const { data: outletsData } = await sb.from('outlets').select('id, name');
  
  // Mapping Excel location strings to actual outlet IDs based on earlier observation
  function getOutletId(excelLocation) {
    if (excelLocation === 'SS KITCHEN') return outletsData.find(o => o.name === 'SUKA SHAWARMA BNR')?.id;
    if (excelLocation === 'SS SAWANGAN') return outletsData.find(o => o.name === 'SUKA SHAWARMA SAWANGAN')?.id;
    if (excelLocation === 'SS PAJAJARAN') return outletsData.find(o => o.name === 'SUKA SHAWARMA PAJAJARAN')?.id;
    if (excelLocation === 'SS JATIWARINGIN') return outletsData.find(o => o.name === 'SUKA SHAWARMA JATIWARINGIN')?.id;
    if (excelLocation === 'SS CIRENDEU') return outletsData.find(o => o.name === 'SUKA SHAWARMA CIRENDEU')?.id;
    if (excelLocation === 'SS DRAMAGA') return outletsData.find(o => o.name === 'SUKA SHAWARMA DRAMAGA')?.id;
    if (excelLocation === 'SS CIBINONG') return outletsData.find(o => o.name === 'MITRA CIBINONG')?.id;
    if (excelLocation === 'CIBUBUR') return outletsData.find(o => o.name === 'MITRA CIBUBUR')?.id;
    if (excelLocation === 'SENTUL') return outletsData.find(o => o.name === 'MITRA SENTUL')?.id;
    if (excelLocation === 'CICURUG') return outletsData.find(o => o.name === 'MITRA CICURUG')?.id;
    if (excelLocation === 'CILEUNGSI') return outletsData.find(o => o.name === 'MITRA CILEUNGSI')?.id;
    return null;
  }
  
  function getRole(excelPosition) {
    const pos = excelLocation => excelPosition.toUpperCase();
    if (pos().includes('DRIVER')) return 'crew';
    if (pos().includes('KITCHEN')) return 'kitchen';
    return 'crew';
  }

  // 1. UPDATE TRANSFERS
  const transfers = [
    { dbName: "Abdul Kadir", excelName: "Abdul Qadir", loc: "SS KITCHEN" },
    { dbName: "Fadli", excelName: "Muhamad Fadli Ramadan", loc: "SS PAJAJARAN" },
    { dbName: "Reza", excelName: "Muhamad Reza Meisandi", loc: "SS DRAMAGA" },
    { dbName: "Rifqi", excelName: "M. Rifqi Darmawan", loc: "CIBUBUR" },
    { dbName: "Adi", excelName: "Irwansyah Adi Saputra", loc: "CILEUNGSI" }
  ];

  console.log('=== UPDATING TRANSFERS ===');
  for (const t of transfers) {
    const outlet_id = getOutletId(t.loc);
    // Find the db user
    const { data: dbUser } = await sb.from('outlet_staff').select('id, name').ilike('name', t.dbName).single();
    if (dbUser) {
      const { error } = await sb.from('outlet_staff')
        .update({ name: t.excelName, outlet_id })
        .eq('id', dbUser.id);
      if (!error) console.log(`✅ Di-update & Dipindah: ${t.dbName} -> ${t.excelName} (ke ${t.loc})`);
      else console.error(`❌ Error update ${t.dbName}:`, error.message);
    }
  }

  // 2. INSERT NEW STAFF
  const newStaff = [
    { name: "Fahmi Alaydrus", pos: "DRIVER", loc: "SS KITCHEN" },
    { name: "Dendy Soekma Pratama", pos: "OUTLET CREW", loc: "SS SAWANGAN" },
    { name: "Faturrahman", pos: "OUTLET CREW", loc: "SS JATIWARINGIN" },
    { name: "Ikbal Darmansyah", pos: "OUTLET CREW", loc: "SS CIRENDEU" },
    { name: "Ahmad Saeful", pos: "OUTLET CREW", loc: "SS CIBINONG" },
    { name: "Andika Wirawan", pos: "OUTLET CREW", loc: "CIBUBUR" },
    { name: "Adhi Setiawan", pos: "OUTLET CREW", loc: "CIBUBUR" },
    { name: "Ahmad Khotibul Umam", pos: "OUTLET CREW", loc: "SENTUL" },
    { name: "Muhamad Rifki Muzaki", pos: "OUTLET CREW", loc: "SENTUL" },
    { name: "Maulana Fadila", pos: "OUTLET CREW", loc: "SENTUL" },
    { name: "Abdurahman Algifari", pos: "OUTLET CREW", loc: "CICURUG" },
    { name: "Muhamad Dava Dila Rusliana", pos: "OUTLET CREW", loc: "CICURUG" },
    { name: "Schatzi Sayyid Abiyyu", pos: "OUTLET CREW", loc: "CILEUNGSI" }
  ];

  console.log('\n=== MENGINPUT KARYAWAN BARU ===');
  for (const s of newStaff) {
    const outlet_id = getOutletId(s.loc);
    
    // Generate username from name: lowercase, no spaces, add random 3 digits if needed
    let username = s.name.toLowerCase().replace(/[^a-z0-9]/g, '').substring(0, 8);
    const pin = '123456'; // Default pin
    
    const insertData = {
      name: s.name,
      username: username + Math.floor(10 + Math.random() * 90),
      pin: pin,
      role: getRole(s.pos),
      outlet_id: outlet_id,
      status: 'active'
    };

    const { error } = await sb.from('outlet_staff').insert(insertData);
    if (!error) console.log(`✅ Insert sukses: ${s.name} (${s.loc})`);
    else console.error(`❌ Error insert ${s.name}:`, error.message);
  }
}

main();
