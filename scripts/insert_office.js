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

const officeStaff = [
  { name: "Indra Irawan", excelPos: "HRD" },
  { name: "Muhammad Gian Mahadika", excelPos: "HRD" },
  { name: "Rendi Irawan", excelPos: "PROGRAMMER" },
  { name: "Muhammad Irsyad Tawaqal", excelPos: "PROGRAMMER" },
  { name: "Maulana Yusuf", excelPos: "PROGRAMMER" },
  { name: "Achmad Luthfi", excelPos: "CS" },
  { name: "Nadya Siti Sabilla", excelPos: "FINANCE" },
  { name: "Hesti Qodriani", excelPos: "ADMIN FINANCE" },
  { name: "Reva Aulina Sugandi", excelPos: "ADMIN PURCHASING" },
  { name: "Revita Al Keyla", excelPos: "TELEMARKETING" },
  { name: "Deri Pristayadi", excelPos: "MARKETING KEMITRAAN" },
  { name: "M. Haedar", excelPos: "OB" },
  { name: "Ahmad Darin", excelPos: "PACKING" },
  { name: "Muhammad Idrus", excelPos: "PACKING" },
  { name: "Abdul Hanan", excelPos: "SS ONLINE" }
];

function getRole(pos) {
  const p = pos.toUpperCase();
  if (p.includes('HRD')) return 'admin_hr';
  if (p.includes('PROGRAMMER')) return 'developer';
  if (p.includes('FINANCE')) return 'admin_finance';
  if (p.includes('PURCHASING')) return 'purchasing';
  return 'staff_pusat';
}

async function main() {
  console.log('=== MENGINPUT 15 KARYAWAN OFFICE PUSAT BARU ===\n');
  const outlet_id = 'ffffffff-ffff-ffff-ffff-ffffffffffff'; // KANTOR PUSAT
  
  for (const s of officeStaff) {
    let username = s.name.toLowerCase().replace(/[^a-z0-9]/g, '').substring(0, 8);
    const pin = '123456'; 
    const role = getRole(s.excelPos);
    
    const insertData = {
      name: s.name,
      username: username + Math.floor(10 + Math.random() * 90),
      pin: pin,
      role: role,
      outlet_id: outlet_id,
      status: 'active'
    };

    const { error } = await sb.from('outlet_staff').insert(insertData);
    if (!error) {
      console.log(`✅ Insert sukses: ${s.name} (Role: ${role})`);
    } else {
      console.error(`❌ Error insert ${s.name}:`, error.message);
    }
  }
}

main();
