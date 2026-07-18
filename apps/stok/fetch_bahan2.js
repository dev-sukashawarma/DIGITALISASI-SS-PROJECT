import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({path: '.env.local'});
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
async function run() {
  const { data, error } = await supabase.from('bahan_baku').select('nama, satuan, satuan_tengah, faktor_tengah, satuan_kecil, faktor_tampilan');
  if (error) console.error(error);
  console.log(JSON.stringify(data, null, 2));
}
run();
