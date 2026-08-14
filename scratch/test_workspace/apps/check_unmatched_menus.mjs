import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import * as xlsx from 'xlsx';
import fs from 'fs';
dotenv.config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
async function run() {
  const { data: menus } = await supabase.from('menu_items').select('id, name');
  const menuMap = {};
  menus.forEach(m => menuMap[m.name.toLowerCase()] = m);
  
  const buf = fs.readFileSync('D:\\MIT\\CLAUDE CODE PROJECT\\SS DIGITAL PROJECT\\Format Import Channel\\TIKTOKGO SS JULY v2.xlsx');
  const workbook = xlsx.read(buf, { type: 'buffer' });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const data = xlsx.utils.sheet_to_json(sheet);
  
  const uniqueItems = [...new Set(data.map(d => d['Item name']))];
  console.log('Unmatched Menus:');
  for (const item of uniqueItems) {
    if (!item) continue;
    if (!menuMap[item.toLowerCase()]) {
      console.log(item);
    }
  }
}
run();
