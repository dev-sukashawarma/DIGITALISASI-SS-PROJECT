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
  console.log("=== EKSEKUSI UPDATE CUSTOM ===");
  
  // 1. Update Abyansah
  const abyRes = await sb.from('outlet_staff').update({
    name: 'Muhammad Abyansah Mandala',
    role: 'kitchen',
    outlet_id: 'd23e11b3-23f1-4f9a-b428-cc73e1aa9b90' // GUDANG PUSAT (HQ)
  }).eq('id', '805b7b81-5635-4320-ba75-13334424d681');
  
  if (!abyRes.error) console.log("✅ Sukses update: Muhammad Abyansah Mandala (Role: kitchen, Outlet: GUDANG PUSAT)");
  else console.error("❌ Error Abyansah:", abyRes.error.message);

  // 2. Update Indra (rm@ss.com)
  const indraRes = await sb.from('outlet_staff').update({
    name: 'Indra Adam Sami'
  }).eq('id', '1a7cd03c-c878-402d-9e55-1ed49830e00a');
  
  if (!indraRes.error) console.log("✅ Sukses update: Indra Adam Sami (Link ke akun rm@ss.com)");
  else console.error("❌ Error Indra:", indraRes.error.message);
  
  // 3. Update Muchtar -> Muhtar Arifin
  const muhtarRes = await sb.from('outlet_staff').update({
    name: 'Muhtar Arifin'
  }).eq('id', '78cd9a59-ac3f-4e25-8766-75dcfdcc373f');
  
  if (!muhtarRes.error) console.log("✅ Sukses update: Muchtar menjadi Muhtar Arifin");
  else console.error("❌ Error Muhtar:", muhtarRes.error.message);

}

main();
