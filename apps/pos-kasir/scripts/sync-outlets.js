const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '../../SS_ORDER/.env') });

const orderSupabaseUrl = 'https://ipwkiizicobqdpfcmgvc.supabase.co';
const orderSupabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const orderSupabase = createClient(orderSupabaseUrl, orderSupabaseKey);

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

async function syncOutlets() {
  console.log('Fetching Kasir outlets...');
  const { data: kasirOutlets, error: kasirError } = await kasirSupabase.from('outlets').select('id, name');
  if (kasirError) throw kasirError;

  console.log('Fetching SS_ORDER outlets...');
  const { data: orderOutlets, error: orderError } = await orderSupabase.from('outlets').select('id, name, pos_outlet_id');
  if (orderError) throw orderError;

  for (const oOutlet of orderOutlets) {
    const oName = normalizeName(oOutlet.name);
    
    // Check for exact mapped match first based on normalized
    let match = kasirOutlets.find(k => normalizeName(k.name) === oName);

    if (match) {
      if (oOutlet.pos_outlet_id !== match.id) {
        console.log(`Mapping "${oOutlet.name}" -> Kasir ID: ${match.id}`);
        await orderSupabase.from('outlets').update({ pos_outlet_id: match.id }).eq('id', oOutlet.id);
      } else {
        console.log(`"${oOutlet.name}" is already correctly mapped.`);
      }
    } else {
      console.log(`Warning: Could not find Kasir outlet for SS_ORDER outlet "${oOutlet.name}" (Normalized: ${oName})`);
    }
  }
  console.log('Done mapping outlets.');
}

syncOutlets().catch(console.error);
