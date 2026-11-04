const XLSX = require('d:/MIT/CLAUDE CODE PROJECT/SS DIGITAL PROJECT/node_modules/xlsx');
const { createClient } = require('d:/MIT/CLAUDE CODE PROJECT/SS DIGITAL PROJECT/node_modules/@supabase/supabase-js');
const fs = require('fs');

const envLocal = fs.readFileSync('.env.local', 'utf8');
const env = {};
envLocal.split('\n').forEach(line => {
  const [k, ...v] = line.split('=');
  if (k && v) env[k.trim()] = v.join('=').trim();
});

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

async function inject() {
  console.log('=== MEMULAI INJEKSI BONUS PAYROLL OKTOBER 2026 ===');
  const filePath = 'C:\\Users\\lu.DESKTOP-HRO3RNS\\Downloads\\Rekap_Absensi_SukaHR_2026-10-01_sd_2026-10-31.xlsx';
  const wb = XLSX.readFile(filePath);
  const ws = wb.Sheets['Ringkasan per Karyawan'];
  const excelData = XLSX.utils.sheet_to_json(ws, { range: 2 });
  const excelEmployees = excelData.filter(r => typeof r['No'] === 'number' && r['Nama Karyawan']);

  const { data: dbRecords, error: fetchErr } = await supabase
    .from('payroll_records')
    .select(`
      id, staff_id, period_month, period_year,
      basic_salary, allowance_meal, allowance_position, allowance_transport, allowance_communication,
      bonus, sales_bonus, bonus_note,
      deductions, deduction_kasbon, deduction_bpjs, deduction_note,
      total_salary, status,
      outlet_staff!payroll_records_staff_id_fkey(
        id, name, role, account_category, outlet_id
      )
    `)
    .eq('period_month', 10)
    .eq('period_year', 2026);

  if (fetchErr) {
    console.error('Gagal mengambil data DB:', fetchErr);
    process.exit(1);
  }

  const dbByName = new Map();
  dbRecords.forEach(r => {
    const nameNorm = r.outlet_staff?.name?.trim().toLowerCase();
    if (nameNorm) dbByName.set(nameNorm, r);
  });

  const staffPusatNames = [
    'Achmad Luthfi', 'Ahmad Darin', 'Alijar Billal Ramadhan', 'Hesti Qodriani',
    'Maulana Yusuf', 'Melanie Sahira Putri', 'Muhammad Fazri Ardiansyah',
    'Putri Lestari Hambali', 'Reva Aulina Sugandi', 'Shakila Ramadhan', 'Sri Mawar'
  ];

  let successCount = 0;
  let failCount = 0;

  for (const e of excelEmployees) {
    const name = String(e['Nama Karyawan'] || '').trim();
    const nameNorm = name.toLowerCase();
    const dbRec = dbByName.get(nameNorm);

    if (!dbRec) {
      console.warn(`⚠️ Karyawan tidak ditemukan di DB: ${name}`);
      failCount++;
      continue;
    }

    const exBonus = Number(e['Bonus']) || 0;
    const exTelat = Number(e['Total Telat (mnt)']) || 0;

    let targetBonus = exBonus;
    let targetSalesBonus = exBonus;
    let targetBonusNote = dbRec.bonus_note;
    let targetDeductions = Number(dbRec.deductions) || 0;
    let targetDeductionNote = dbRec.deduction_note;

    const isStaffPusatReward = staffPusatNames.some(n => n.toLowerCase() === nameNorm);

    if (isStaffPusatReward) {
      targetBonus = 50000;
      targetSalesBonus = 50000;
      targetBonusNote = 'Reward Absensi (Staff Office): Rp 50.000 (Bonus diberikan setelah gapok)';
    } else if (nameNorm === 'chairul rizky') {
      targetBonus = 573700;
      targetSalesBonus = 573700;
      targetBonusNote = 'Sales Bonus AM: Rp 573.700 (Final Excel Okt 2026 - Bonus diberikan setelah gapok)';
    } else if (nameNorm === 'mulyadi') {
      targetBonus = 320900;
      targetSalesBonus = 320900;
      targetBonusNote = 'Sales Bonus AM: Rp 320.900 (Final Excel Okt 2026 - Bonus diberikan setelah gapok)';
    } else if (nameNorm === 'tri rizky') {
      targetBonus = 557000;
      targetSalesBonus = 557000;
      targetBonusNote = 'Sales Bonus AM: Rp 557.000 (Final Excel Okt 2026 - Bonus diberikan setelah gapok)';
      if (targetDeductions === 0 && exTelat > 0) {
        targetDeductions = exTelat;
        targetDeductionNote = `Telat (Final Excel): Rp ${exTelat.toLocaleString('id-ID')}`;
      }
    } else if (nameNorm === 'maulana hairulloh') {
      targetBonus = 97400;
      targetSalesBonus = 97400;
      targetBonusNote = 'Sales Bonus: Rp 97.400 (MITRA CILEUDUG 19 hari - Final Excel Okt 2026 - Bonus diberikan setelah gapok)';
    } else {
      if (targetBonus > 0) {
        if (!targetBonusNote || !targetBonusNote.includes('Bonus diberikan setelah gapok')) {
          targetBonusNote = (targetBonusNote ? targetBonusNote + ' | ' : '') + '(Bonus diberikan setelah gapok)';
        }
      }
    }

    // Pastikan denda telat tercatat bila di Excel ada telat tapi di DB masih 0
    if (exTelat > 0 && targetDeductions === 0) {
      targetDeductions = exTelat;
      targetDeductionNote = `Telat (Absensi Okt 2026): Rp ${exTelat.toLocaleString('id-ID')}`;
    }

    // Rekalkulasi total gaji bersih (Take Home Pay)
    const basicSalary = Number(dbRec.basic_salary) || 0;
    const allowanceMeal = Number(dbRec.allowance_meal) || 0;
    const allowanceTransport = Number(dbRec.allowance_transport) || 0;
    const allowanceComm = Number(dbRec.allowance_communication) || 0;
    const allowancePos = Number(dbRec.allowance_position) || 0;

    const totalEarnings = basicSalary + allowanceMeal + allowanceTransport + allowanceComm + allowancePos + targetSalesBonus;
    const newTotalSalary = Math.max(0, totalEarnings - targetDeductions);

    const updatePayload = {
      bonus: targetBonus,
      sales_bonus: targetSalesBonus,
      bonus_note: targetBonusNote,
      deductions: targetDeductions,
      deduction_note: targetDeductionNote,
      total_salary: newTotalSalary,
      updated_at: new Date().toISOString()
    };

    const { error: updateErr } = await supabase
      .from('payroll_records')
      .update(updatePayload)
      .eq('id', dbRec.id);

    if (updateErr) {
      console.error(`❌ Gagal update ${name}:`, updateErr.message);
      failCount++;
    } else {
      successCount++;
    }
  }

  console.log(`\n=== HASIL INJEKSI ===`);
  console.log(`Berhasil di-update: ${successCount} karyawan`);
  console.log(`Gagal: ${failCount} karyawan`);

  // Verifikasi total bonus di database setelah update
  const { data: verifyData } = await supabase
    .from('payroll_records')
    .select('bonus, sales_bonus')
    .eq('period_month', 10)
    .eq('period_year', 2026);

  const totalBonusDbAfter = verifyData.reduce((s, r) => s + (Number(r.bonus) || 0), 0);
  console.log(`Total Bonus di DB Sekarang: Rp ${totalBonusDbAfter.toLocaleString('id-ID')}`);
  console.log(`Target Excel: Rp 11.970.604`);
  if (totalBonusDbAfter === 11970604) {
    console.log(`✅ VERIFIKASI BERHASIL: Total bonus kotor di DB telah sinkron 100% dengan Excel!`);
  } else {
    console.warn(`⚠️ Perhatian: Total bonus berbeda dengan target Excel (selisih: ${totalBonusDbAfter - 11970604})`);
  }
}

inject();
