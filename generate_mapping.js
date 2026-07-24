require('dotenv').config({ path: 'apps/admin-dashboard/.env.local' });
if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    require('dotenv').config({ path: '.env.local' });
}
const fs = require('fs');
const xlsx = require('xlsx');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function generateMapping() {
  const workbook = xlsx.readFile('D:\\MIT\\CLAUDE CODE PROJECT\\SS DIGITAL PROJECT\\SS COGS SET\\data transaksi pawoon.xls');
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const data = xlsx.utils.sheet_to_json(sheet, { header: 1 });
  
  let headerRowIdx = -1;
  for (let i = 0; i < 20; i++) {
      const rowStr = (data[i] || []).join(' ').toLowerCase();
      if (rowStr.includes('id struk') || rowStr.includes('nama produk')) {
          headerRowIdx = i;
          break;
      }
  }

  const pawoonNames = new Set();
  if (headerRowIdx !== -1) {
      const headers = data[headerRowIdx];
      const nameColIdx = headers.findIndex(h => typeof h === 'string' && h.toLowerCase().includes('nama produk'));
      
      if (nameColIdx !== -1) {
          for (let i = headerRowIdx + 1; i < data.length; i++) {
              if (data[i] && data[i][nameColIdx]) {
                  let pName = data[i][nameColIdx].toString().trim();
                  if (pName.startsWith('+')) continue; 
                  if (pName === '') continue;
                  pawoonNames.add(pName);
              }
          }
      }
  }

  const { data: menuItems, error } = await supabase.from('menu_items').select('id, name');
  if (error) {
      console.error("Error fetching menu_items:", error);
      return;
  }

  const mapping = {};
  const unmatched = [];
  
  pawoonNames.forEach(pName => {
      let matchedId = null;
      let matchedName = null;
      
      let cleanPName = pName;
      if (cleanPName.includes('FOOD APPS ORIGINAL')) cleanPName = cleanPName.replace('FOOD APPS ORIGINAL', '').trim();
      else if (cleanPName.includes('BEST SELLER - ORI')) cleanPName = cleanPName.replace('BEST SELLER - ORI', '').trim();
      else if (cleanPName.includes('FOOD APPS')) cleanPName = cleanPName.replace('FOOD APPS', '').trim();
      else if (cleanPName.includes('BEST SELLER - ')) cleanPName = cleanPName.replace('BEST SELLER - ', '').trim();
      
      if (cleanPName === 'ORI DUO COMBO') cleanPName = 'SHAWARMA DUO COMBO';
      
      const pNameLower = cleanPName.toLowerCase();
      
      for (const m of menuItems) {
          const mLower = m.name.toLowerCase();
          
          if (mLower === pNameLower) {
              matchedId = m.id;
              matchedName = m.name;
              break;
          }
      }
      
      // Secondary pass for includes if exact fails
      if (!matchedId) {
          for (const m of menuItems) {
              const mLower = m.name.toLowerCase();
              if (mLower.includes(pNameLower)) {
                  // Prevent SAPI JUMBO from matching Best Seller 2
                  if (pNameLower === 'sapi jumbo' && mLower.includes('best seller')) {
                      continue;
                  }
                  matchedId = m.id;
                  matchedName = m.name;
                  break;
              }
          }
      }
      
      if (matchedId) {
          mapping[pName] = { system_id: matchedId, system_name: matchedName };
      } else {
          unmatched.push(pName);
      }
  });

  const output = {
      _unmatched: unmatched,
      mapping: mapping
  };

  const outDir = 'D:\\MIT\\CLAUDE CODE PROJECT\\SS DIGITAL PROJECT\\scripts';
  fs.writeFileSync(outDir + '\\pawoon_item_map.json', JSON.stringify(output, null, 2));
}

generateMapping();
