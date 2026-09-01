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

function cleanNumber(val) {
  if (!val) return 0;
  if (typeof val === 'number') return val;
  const parsed = parseFloat(val.toString().replace(/[^\d.-]/g, ''));
  return isNaN(parsed) ? 0 : parsed;
}

async function main() {
  const filePath = 'C:\\Users\\lu.DESKTOP-HRO3RNS\\Downloads\\payroll agutus.xlsx';
  const workbook = xlsx.readFile(filePath);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = xlsx.utils.sheet_to_json(sheet, { header: 1 });
  
  // Ambil semua staff dari DB untuk dicocokkan namanya
  const { data: staffData } = await sb.from('outlet_staff').select('id, name');
  const staffMap = {}; // name (lowercase) -> id
  staffData.forEach(s => {
    staffMap[s.name.toLowerCase().trim()] = s.id;
  });

  console.log("=== MEMULAI IMPORT PAYROLL (SOURCE OF TRUTH: EXCEL) ===");
  
  let successCount = 0;
  let insertCount = 0;
  let updateCount = 0;
  let errorCount = 0;

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || !row[1] || typeof row[1] !== 'string') continue;
    
    const rawName = row[1].trim();
    const staff_id = staffMap[rawName.toLowerCase()];
    
    if (!staff_id) {
      console.log(`⚠️ Skip (Staff ID tidak ditemukan di DB): ${rawName}`);
      continue;
    }

    const basic_salary = cleanNumber(row[5]);
    const overtime = cleanNumber(row[6]);
    const meal = cleanNumber(row[7]);
    const transport = cleanNumber(row[8]);
    const telecom = cleanNumber(row[9]);
    const sales_bonus = cleanNumber(row[10]);
    const kasbon = cleanNumber(row[11]);
    const compensation = cleanNumber(row[12]);
    const total_salary = cleanNumber(row[13]);

    const allowance_presence = meal + transport + telecom;
    const bonus = sales_bonus + overtime;
    const deductions = kasbon + compensation;

    // Cek apakah data payroll bulan 8 tahun 2026 sudah ada
    const { data: existingPayroll } = await sb.from('payroll_records')
      .select('id')
      .eq('staff_id', staff_id)
      .eq('period_month', 8)
      .eq('period_year', 2026)
      .single();

    const payload = {
      staff_id,
      period_month: 8,
      period_year: 2026,
      basic_salary,
      allowance_presence,
      bonus,
      deductions,
      total_salary,
      allowance_position: 0, 
      status: 'draft',
      payment_status: 'unpaid',
      updated_at: new Date().toISOString()
    };

    if (existingPayroll) {
      // UPDATE
      const { error } = await sb.from('payroll_records')
        .update(payload)
        .eq('id', existingPayroll.id);
      
      if (!error) {
        updateCount++;
        successCount++;
      } else {
        console.error(`❌ Error UPDATE ${rawName}:`, error.message);
        errorCount++;
      }
    } else {
      // INSERT
      payload.created_at = new Date().toISOString();
      const { error } = await sb.from('payroll_records')
        .insert(payload);
      
      if (!error) {
        insertCount++;
        successCount++;
      } else {
        console.error(`❌ Error INSERT ${rawName}:`, error.message);
        errorCount++;
      }
    }
  }

  console.log(`\n=== HASIL IMPORT ===`);
  console.log(`Berhasil: ${successCount} Karyawan (${updateCount} Update, ${insertCount} Insert)`);
  console.log(`Gagal/Error: ${errorCount}`);
}

main();
