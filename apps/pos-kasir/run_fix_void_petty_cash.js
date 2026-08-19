// run_fix_void_petty_cash.js
// Jalankan: node run_fix_void_petty_cash.js
// dari folder: apps/pos-kasir

require('dotenv').config({ path: '.env.local' });
const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
  const sql = fs.readFileSync(
    '../../supabase/migrations/20300108000002_fix_void_petty_cash_balance.sql',
    'utf8'
  );

  console.log('Menerapkan migration fix void petty cash balance...');
  const { error } = await supabase.rpc('exec_sql', { sql });
  if (error) {
    // exec_sql mungkin tidak ada, coba jalankan langsung via REST
    console.error('exec_sql gagal:', error.message);
    console.log('\nCoba jalankan SQL berikut langsung di Supabase SQL Editor:');
    console.log(sql);
    process.exit(1);
  } else {
    console.log('✅ Migration berhasil diterapkan!');
    console.log('Saldo petty cash sekarang akan kembali saat pengeluaran dibatalkan.');
  }
}

run();
