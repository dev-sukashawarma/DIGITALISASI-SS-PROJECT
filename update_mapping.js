require('dotenv').config({ path: 'apps/admin-dashboard/.env.local' });
const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const pawoonNamesToMap = [
  "ORI TRIPLE COMBO",
  "COMBO #1 ORI SAPI JUMBO UP-SIZE",
  "COMBO #3 ORI MIX JUMBO UP-SIZE",
  "COMBO #1 ORI SAPI SEDANG",
  "SUKA BEEF",
  "FOOD APPS SHAWARMIE SAPI",
  "SUKA FRIED CHICKEN",
  "FOOD APPS SUKA CHICKEN",
  "FOOD APPS SHAWARMIE AYAM",
  "SUKA SAMYANG",
  "SAPI SHAWARMIE",
  "SUKA PREMIUM CRISPY",
  "AYAM SHAWARMIE"
];

async function updateMapping() {
  const mapPath = 'apps/admin-dashboard/src/data/pawoon_item_map.json';
  let mapData = { mapping: {} };
  if (fs.existsSync(mapPath)) {
    mapData = JSON.parse(fs.readFileSync(mapPath, 'utf8'));
  }

  const { data: menuItems } = await supabase.from('menu_items').select('id, name');

  const nameToId = {};
  menuItems.forEach(m => {
    nameToId[m.name.toLowerCase()] = { id: m.id, name: m.name };
  });

  // Helper to find ID
  const findItem = (searchString) => {
    const s = searchString.toLowerCase();
    if (nameToId[s]) return nameToId[s];
    
    // partial match
    for (const m of menuItems) {
      if (m.name.toLowerCase().includes(s)) {
        return { id: m.id, name: m.name };
      }
    }
    return null;
  };

  pawoonNamesToMap.forEach(pName => {
    let clean = pName.toLowerCase();
    
    // Apply known replacements
    clean = clean.replace('food apps ', '');
    clean = clean.replace('ori triple combo', 'triple combo');
    clean = clean.replace('combo #1 ori sapi jumbo up-size', 'combo #1');
    clean = clean.replace('combo #3 ori mix jumbo up-size', 'combo #3');
    clean = clean.replace('combo #1 ori sapi sedang', 'combo #1');
    clean = clean.replace('sapi shawarmie', 'shawarmie sapi');
    clean = clean.replace('ayam shawarmie', 'shawarmie ayam');
    clean = clean.replace('suka premium crispy', 'suka premius krispy');
    
    const matched = findItem(clean);
    if (matched) {
      mapData.mapping[pName] = { system_id: matched.id, name: matched.name };
      console.log(`Mapped: "${pName}" -> "${matched.name}"`);
    } else {
      console.log(`COULD NOT MAP: "${pName}" (cleaned: "${clean}")`);
    }
  });

  fs.writeFileSync(mapPath, JSON.stringify(mapData, null, 2));
  console.log("Mapping updated successfully.");
}

updateMapping();
