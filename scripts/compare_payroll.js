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
      base: row[5] || 0,
      total: row[13] || 0
    };
  }
  
  const { data: staffData } = await sb.from('outlet_staff').select('id, name');
  const staffMap = {};
  staffData.forEach(s => staffMap[s.id] = s.name);
  
  const { data: payroll } = await sb.from('payroll_records').select('*').eq('period_month', 8).eq('period_year', 2026);
  
  console.log(`Found ${payroll.length} payroll records for August 2026 in DB.\n`);
  
  if (payroll.length === 0) {
    console.log("BELUM ADA DATA GAJI BULAN AGUSTUS DI DATABASE.");
    return;
  }
  
  let matchCount = 0;
  let mismatchCount = 0;
  
  for (const p of payroll) {
    const name = staffMap[p.staff_id];
    if (!name) continue;
    
    const ex = excelStaff[name.toLowerCase()];
    if (!ex) {
      console.log(`⚠️ ${name} ada di DB Payroll tapi tidak ada di Excel.`);
      continue;
    }
    
    // compare total
    if (Math.abs(p.total_salary - ex.total) < 1) { // allow floating point diff
      matchCount++;
    } else {
      console.log(`❌ MISMATCH - ${name}: DB Total = ${p.total_salary}, Excel Total = ${ex.total}`);
      mismatchCount++;
    }
  }
  
  console.log(`\nHasil: ${matchCount} Cocok, ${mismatchCount} Tidak Cocok.`);
}

main();
