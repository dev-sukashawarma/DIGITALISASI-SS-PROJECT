import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data: menuItems } = await supabase
    .from('menu_items')
    .select('id, name, price, channel_prices, is_available')
    .order('name');
    
  const { data: recipes } = await supabase
    .from('resep')
    .select('menu_item_ref')
    .eq('scope', 'global');
    
  const recipeSet = new Set(recipes?.map(r => r.menu_item_ref) || []);
  
  let markdown = `| Menu | Status POS | Harga Offline | Channel Online | Status HPP (Resep) |\n`;
  markdown += `|---|---|---|---|---|\n`;
  
  for (const m of (menuItems || [])) {
    const posStatus = m.is_available ? '✅ Aktif' : '❌ Nonaktif';
    const offlinePrice = `Rp ${m.price.toLocaleString('id-ID')}`;
    const channels = m.channel_prices ? Object.keys(m.channel_prices).join(', ') : '-';
    const hppStatus = recipeSet.has(m.id) ? '✅ Ada BOM' : '❌ Kosong';
    
    markdown += `| ${m.name} | ${posStatus} | ${offlinePrice} | ${channels || '-'} | ${hppStatus} |\n`;
  }
  
  console.log(markdown);
}

run();
