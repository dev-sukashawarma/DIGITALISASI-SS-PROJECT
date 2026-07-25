const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: 'apps/absensi/.env.local' });
if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    require('dotenv').config({ path: '.env.local' });
}
if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    require('dotenv').config();
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function main() {
  const cicurugId = 'd9a2ef93-c298-4501-a471-1c5e2b3dff08';

  // 1. Get staff list for Cicurug
  const { data: staffList, error: staffErr } = await supabase
    .from('outlet_staff')
    .select('id, name, username, role, is_active')
    .eq('outlet_id', cicurugId);

  if (staffErr) {
    console.error('Error fetching staff:', staffErr);
    return;
  }

  console.log(`=== DAFTAR STAF OUTLET CICURUG (${staffList.length} orang) ===`);
  console.table(staffList);

  const staffMap = {};
  staffList.forEach(s => {
    staffMap[s.id] = s.name || s.username;
  });

  // 2. Fetch all attendances for Cicurug
  const { data: attendances, error: attErr } = await supabase
    .from('attendance')
    .select('*')
    .eq('outlet_id', cicurugId)
    .order('ts_server', { ascending: true });

  if (attErr) {
    console.error('Error fetching attendances:', attErr);
    return;
  }

  console.log(`\nTotal riwayat absensi Cicurug: ${attendances.length} record`);

  if (attendances.length === 0) {
    console.log('Belum ada data absensi tercatat untuk outlet Cicurug.');
    return;
  }

  // Extract dates (YYYY-MM-DD WIB)
  const getLocalDateStr = (tsStr) => {
    if (!tsStr) return null;
    const d = new Date(tsStr);
    // Convert to Asia/Jakarta (WIB)
    const options = { timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit' };
    const formatter = new Intl.DateTimeFormat('en-CA', options); // returns YYYY-MM-DD
    return formatter.format(d);
  };

  attendances.forEach(a => {
    a.date_wib = getLocalDateStr(a.ts_server || a.ts_client || a.created_at);
  });

  const allDates = [...new Set(attendances.map(a => a.date_wib).filter(Boolean))].sort();
  console.log(`\nRentang Tanggal Absensi yang Memiliki Presensi/Record (${allDates.length} hari):`);
  console.log(allDates);

  // Group by staff member
  const staffAttendanceDays = {};
  const staffRecords = {};

  staffList.forEach(s => {
    staffAttendanceDays[s.id] = new Set();
    staffRecords[s.id] = [];
  });

  attendances.forEach(att => {
    const sId = att.outlet_staff_id;
    if (sId) {
      if (!staffAttendanceDays[sId]) {
        staffAttendanceDays[sId] = new Set();
        staffRecords[sId] = [];
      }
      if (att.date_wib) {
        staffAttendanceDays[sId].add(att.date_wib);
      }
      staffRecords[sId].push(att);
    }
  });

  console.log('\n=== REKAP KEHADIRAN PER STAF CICURUG ===');
  const summary = staffList.map(s => {
    const sId = s.id;
    const daysAttendedSet = staffAttendanceDays[sId] || new Set();
    const daysAttended = daysAttendedSet.size;
    const totalDaysRecorded = allDates.length;
    const percentage = totalDaysRecorded > 0 ? ((daysAttended / totalDaysRecorded) * 100).toFixed(1) + '%' : '0%';
    const datesAttendedList = Array.from(daysAttendedSet).sort();

    return {
      'Nama Staf': s.name || s.username,
      'Username': s.username,
      'Role': s.role,
      'Status Staf': s.is_active ? 'Aktif' : 'Non-aktif',
      'Jumlah Hari Hadir': daysAttended,
      'Total Hari Ada Record': totalDaysRecorded,
      'Persentase Kehadiran': percentage,
      'Hadir di Semua Hari?': (totalDaysRecorded > 0 && daysAttended === totalDaysRecorded) ? 'YA ✅' : 'TIDAK ❌',
      'Tanggal Kehadiran (WIB)': datesAttendedList.join(', ') || 'Belum pernah absen'
    };
  });

  console.table(summary);

  console.log('\n=== DETAIL SELURUH RECORD ABSENSI CICURUG ===');
  console.log(JSON.stringify(attendances, null, 2));

  console.log('\n=== KESIMPULAN ===');
  const perfectStaff = summary.filter(s => s['Hadir di Semua Hari?'] === 'YA ✅');
  if (perfectStaff.length > 0) {
    console.log(`Staf yang hadir di semua hari yang memiliki record absensi (${allDates.length} hari):`);
    perfectStaff.forEach(s => {
      console.log(`- ${s['Nama Staf']} (${s['Role']}) - Total ${s['Jumlah Hari Hadir']} hari [${s['Tanggal Kehadiran (WIB)']}]`);
    });
  } else {
    console.log('Tidak ada staf yang hadir di semua hari.');
  }
}

main();
