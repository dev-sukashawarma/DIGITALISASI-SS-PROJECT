require('dotenv').config({ path: 'apps/admin-dashboard/.env.local' });
if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    require('dotenv').config({ path: '.env.local' });
}
const xlsx = require('xlsx');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function printMarkdownTable() {
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

  const pawoonItems = new Map();
  if (headerRowIdx !== -1) {
      const headers = data[headerRowIdx];
      const nameColIdx = headers.findIndex(h => typeof h === 'string' && h.toLowerCase().includes('nama produk'));
      const priceColIdx = headers.findIndex(h => typeof h === 'string' && h.toLowerCase().includes('harga produk'));
      const katColIdx = headers.findIndex(h => typeof h === 'string' && h.toLowerCase().includes('kategori'));
      
      if (nameColIdx !== -1 && priceColIdx !== -1) {
          for (let i = headerRowIdx + 1; i < data.length; i++) {
              if (data[i] && data[i][nameColIdx]) {
                  let pName = data[i][nameColIdx].toString().trim();
                  if (pName.startsWith('+')) continue; 
                  if (pName === '') continue;
                  
                  let pCat = data[i][katColIdx] ? data[i][katColIdx].toString() : '';
                  
                  if (!pawoonItems.has(pName)) {
                      pawoonItems.set(pName, { price: parseFloat(data[i][priceColIdx]) || 0, cat: pCat });
                  }
              }
          }
      }
  }

  const { data: menuItems } = await supabase.from('menu_items').select('id, name, price, channel_prices');

  let mdTable = "| Nama Menu Pawoon | Channel | Harga Pawoon | ➡️ Nama Menu di Sistem | Harga Sistem (Offline) | Harga Sistem (Channel) | Status |\n";
  mdTable += "| :--- | :--- | :--- | :--- | :--- | :--- | :--- |\n";
  
  pawoonItems.forEach((info, pName) => {
      let matchedName = null;
      let matchedPrice = 0;
      let matchedChannelPrices = {};
      
      let cleanPName = pName;
      if (cleanPName.includes('FOOD APPS ORIGINAL')) cleanPName = cleanPName.replace('FOOD APPS ORIGINAL', '').trim();
      else if (cleanPName.includes('BEST SELLER - ORI')) cleanPName = cleanPName.replace('BEST SELLER - ORI', '').trim();
      else if (cleanPName.includes('FOOD APPS')) cleanPName = cleanPName.replace('FOOD APPS', '').trim();
      else if (cleanPName.includes('BEST SELLER - ')) cleanPName = cleanPName.replace('BEST SELLER - ', '').trim();
      if (cleanPName === 'ORI DUO COMBO') cleanPName = 'SHAWARMA DUO COMBO';
      
      const pNameLower = cleanPName.toLowerCase();
      for (const m of menuItems) {
          if (m.name.toLowerCase() === pNameLower) {
              matchedName = m.name; 
              matchedPrice = m.price;
              matchedChannelPrices = m.channel_prices || {};
              break;
          }
      }
      if (!matchedName) {
          for (const m of menuItems) {
              if (m.name.toLowerCase().includes(pNameLower)) {
                  if (pNameLower === 'sapi jumbo' && m.name.toLowerCase().includes('best seller')) continue;
                  matchedName = m.name; 
                  matchedPrice = m.price;
                  matchedChannelPrices = m.channel_prices || {};
                  break;
              }
          }
      }
      
      // Determine Channel
      let channel = '`pos` (Offline)';
      let expectedSystemPrice = matchedPrice;
      let expectedSystemPriceStr = '-';
      
      if (pName.includes('FOOD APPS') || info.cat === 'FOOD APPS') {
          channel = '`food_apps`';
          expectedSystemPrice = matchedChannelPrices['gofood'] || matchedPrice;
          expectedSystemPriceStr = matchedChannelPrices['gofood'] ? `Rp ${matchedChannelPrices['gofood'].toLocaleString('id-ID')}` : '*(Tidak diset)*';
      } else if (pName.includes('BEST SELLER - ') || info.cat === 'SS TIKTOK GO') {
          channel = '`tiktok`';
          expectedSystemPrice = matchedChannelPrices['tiktokgo'] || matchedPrice;
          expectedSystemPriceStr = matchedChannelPrices['tiktokgo'] ? `Rp ${matchedChannelPrices['tiktokgo'].toLocaleString('id-ID')}` : '*(Tidak diset)*';
      }
      
      const diff = info.price - expectedSystemPrice;
      let diffStr = diff === 0 ? "✅ MATCH" : (diff > 0 ? `❌ +${diff.toLocaleString('id-ID')}` : `❌ ${diff.toLocaleString('id-ID')}`);
      
      if (channel === '`pos` (Offline)') {
           expectedSystemPriceStr = `Rp ${matchedPrice.toLocaleString('id-ID')}`; // for pos, channel price is just offline price
      }
      
      mdTable += `| \`${pName}\` | ${channel} | **Rp ${info.price.toLocaleString('id-ID')}** | ${matchedName} | Rp ${matchedPrice.toLocaleString('id-ID')} | ${expectedSystemPriceStr} | ${diffStr} |\n`;
  });

  console.log(mdTable);
}

printMarkdownTable();
