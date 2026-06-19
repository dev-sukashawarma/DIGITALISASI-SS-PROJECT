const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

const orderSupabaseUrl = 'https://ipwkiizicobqdpfcmgvc.supabase.co';
const orderSupabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imlwd2tpaXppY29icWRwZmNtZ3ZjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE3MjE5MjgsImV4cCI6MjA5NzI5NzkyOH0.TAPd3KfXRk3TcW0JOJcix7zP-enBeZ7ExiQHK_QjYNQ';
const orderSupabase = createClient(orderSupabaseUrl, orderSupabaseAnonKey);

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });
const kasirSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const kasirSupabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const kasirSupabase = createClient(kasirSupabaseUrl, kasirSupabaseKey);

function normalizeName(name) {
  return name.toLowerCase()
    .replace('mitra', '')
    .replace('(pusat)', '')
    .replace('kitchen', '')
    .trim();
}

async function generateSQL() {
  const { data: kasirOutlets, error: kasirError } = await kasirSupabase.from('outlets').select('id, name');
  if (kasirError) throw kasirError;

  const { data: orderOutlets, error: orderError } = await orderSupabase.from('outlets').select('id, name, pos_outlet_id');
  if (orderError) throw orderError;

  console.log('--- COPY AND PASTE THIS SQL INTO SS_ORDER SUPABASE SQL EDITOR ---');
  console.log('-- Mengupdate pemetaan cabang (pos_outlet_id) otomatis dari nama cabang yang cocok\\n');

  let updates = 0;
  for (const oOutlet of orderOutlets) {
    const oName = normalizeName(oOutlet.name);
    let match = kasirOutlets.find(k => normalizeName(k.name) === oName);

    if (match) {
      if (oOutlet.pos_outlet_id !== match.id) {
        console.log(`UPDATE outlets SET pos_outlet_id = '${match.id}' WHERE id = '${oOutlet.id}'; -- ${oOutlet.name}`);
        updates++;
      }
    }
  }
  
  if (updates === 0) {
    console.log('-- Semua cabang sudah terpetakan dengan benar.');
  }
  console.log('\\n------------------------------------------------------------------');
}

generateSQL().catch(console.error);
