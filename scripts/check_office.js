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

const officeNames = [
  "Indra Irawan", "Muhammad Gian Mahadika", "Rendi Irawan", "Muhammad Irsyad Tawaqal",
  "Maulana Yusuf", "Achmad Luthfi", "Nadya Siti Sabilla", "Hesti Qodriani",
  "Reva Aulina Sugandi", "Revita Al Keyla", "Deri Pristayadi", "M. Haedar",
  "Ahmad Darin", "Muhammad Idrus", "Abdul Hanan"
];

async function main() {
  const { data: staff } = await sb.from('outlet_staff').select('id, name, role, username, outlet_id');
  
  const { data: outlets } = await sb.from('outlets').select('id, name');
  const outletMap = {};
  outlets.forEach(o => outletMap[o.id] = o.name);
  
  console.log("=== CHECKING OFFICE STAFF IN DB ===");
  for (const n of officeNames) {
    // split name to words and check
    const words = n.split(' ').filter(w => w.length > 2);
    let found = [];
    for (const s of staff) {
      for (const w of words) {
        if (s.name.toLowerCase().includes(w.toLowerCase())) {
          found.push(s);
          break; // break the word loop
        }
      }
    }
    
    if (found.length > 0) {
      console.log(`\n🔍 Excel: ${n}`);
      found.forEach(f => {
        console.log(`   -> DB: ${f.name} (Role: ${f.role}, Outlet: ${outletMap[f.outlet_id]})`);
      });
    }
  }
}

main();
