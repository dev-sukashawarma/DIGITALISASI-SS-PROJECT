const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: 'apps/admin-dashboard/.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
async function main() {
  const { data: menuItems } = await supabase.from('menu_items').select('id, name').ilike('name', '%MIX BESAR%');
  for (const menu of menuItems) {
    console.log('MENU:', menu.name);
    const { data: resep } = await supabase.from('resep').select('*').eq('menu_item_ref', menu.id).limit(1);
    if (resep && resep.length > 0) {
      console.log('  RESEP ID:', resep[0].id, 'NAMA:', resep[0].nama);
      const { data: items } = await supabase.from('resep_item').select('qty_per_porsi, satuan, bahan_baku(nama)').eq('resep_id', resep[0].id);
      console.log('  INGREDIENTS:');
      items.forEach(i => {
        console.log("    - " + (i.bahan_baku ? i.bahan_baku.nama : 'Unknown') + ": " + i.qty_per_porsi + " " + i.satuan);
      });
    } else {
      console.log('  No resep found for this menu_item_ref. Let search by name in resep table');
      const { data: resepByName } = await supabase.from('resep').select('*').ilike('nama', '%MIX BESAR%').limit(1);
      if (resepByName && resepByName.length > 0) {
        console.log('  RESEP BY NAME ID:', resepByName[0].id, 'NAMA:', resepByName[0].nama);
        const { data: items } = await supabase.from('resep_item').select('qty_per_porsi, satuan, bahan_baku(nama)').eq('resep_id', resepByName[0].id);
        console.log('  INGREDIENTS:');
        items.forEach(i => {
          console.log("    - " + (i.bahan_baku ? i.bahan_baku.nama : 'Unknown') + ": " + i.qty_per_porsi + " " + i.satuan);
        });
      }
    }
  }
}
main();
