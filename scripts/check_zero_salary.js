const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const xlsx = require('xlsx');
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
  const filePath = 'C:\\Users\\lu.DESKTOP-HRO3RNS\\Downloads\\payroll agutus.xlsx';
  const workbook = xlsx.readFile(filePath);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = xlsx.utils.sheet_to_json(sheet, { header: 1 });
  
  const excelStaff = {};
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || !row[1] || typeof row[1] !== 'string') continue;
    
    excelStaff[row[1].trim().toLowerCase()] = {
      status: row[3] || 'N/A',
      total: row[13] || 0
    };
  }
  
  const { data: staffData } = await sb.from('outlet_staff').select('id, name, status');
  const staffMap = {};
  staffData.forEach(s => {
    staffMap[s.id] = { name: s.name, status: s.status };
  });
  
  const { data: payroll } = await sb.from('payroll_records').select('*').eq('period_month', 8).eq('period_year', 2026);
  
  console.log("=== ANALISIS KARYAWAN DENGAN GAJI DB = 0 ===\n");
  
  for (const p of payroll) {
    const sInfo = staffMap[p.staff_id];
    if (!sInfo) continue;
    
    const ex = excelStaff[sInfo.name.toLowerCase()];
    if (!ex) continue;
    
    if (p.total_salary === 0) {
      console.log(`- ${sInfo.name}:`);
      console.log(`  Gaji di DB: 0 | Gaji di Excel: ${ex.total}`);
      console.log(`  Status DB : ${sInfo.status}`);
      console.log(`  Status XL : ${ex.status}`);
      console.log();
    }
  }
}

main();
