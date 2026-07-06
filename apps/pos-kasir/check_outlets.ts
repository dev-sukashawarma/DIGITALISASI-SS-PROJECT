import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { join } from 'path';

// Load env
dotenv.config({ path: join(__dirname, '.env') });
dotenv.config({ path: join(__dirname, '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkOutlets() {
  console.log('Fetching outlets...');
  const { data, error } = await supabase.from('outlets').select('*');
  
  if (error) {
    console.error('Error fetching outlets:', error);
    return;
  }
  
  console.log('Total outlets:', data?.length);
  console.log('Outlets:');
  data?.forEach(outlet => {
    console.log(`- ID: ${outlet.id}, Name: ${outlet.name}, Type/Status/etc:`, JSON.stringify(outlet));
  });
}

checkOutlets();
