import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: 'apps/pos-kasir/.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
(async () => {
  const outlet = '550e8400-e29b-41d4-a716-446655440001';
  
  // Ambil semua resep yang aktif
  const { data: resepData, error: resepErr } = await supabase.from('resep').select('id, menu_item_ref, scope, outlet_id, nama').eq('is_active', true);
  
  if (resepErr || !resepData) {
    console.log('Error resep:', resepErr);
    return;
  }
  
  // Ambil semua item dari resep
  const { data: riData, error: riErr } = await supabase.from('resep_item').select('resep_id, bahan_baku_id, qty_per_porsi, satuan');
  
  // Ambil semua bahan baku
  const { data: bbData } = await supabase.from('bahan_baku').select('id, nama, satuan');
  
  // Ambil semua stok di outlet
  const { data: stokData } = await supabase.from('stok_balance').select('*').eq('outlet_id', outlet);
  
  let result = [];
  for (let res of resepData) {
    if (res.scope !== 'global' && res.outlet_id !== outlet) continue;
    
    let isUnavailable = false;
    let reason = [];
    
    let items = riData.filter(ri => ri.resep_id === res.id);
    for (let ri of items) {
      let bb = bbData.find(b => b.id === ri.bahan_baku_id);
      let sb = stokData.find(s => s.bahan_baku_id === ri.bahan_baku_id);
      
      let saldo = sb ? sb.saldo : null;
      let ri_satuan = (ri.satuan || '').toLowerCase();
      let bb_satuan = (bb.satuan || '').toLowerCase();
      let required = ri.qty_per_porsi;
      
      if (ri_satuan === 'gram' && bb_satuan === 'kg') required = ri.qty_per_porsi / 1000.0;
      else if (ri_satuan === 'ml' && bb_satuan === 'liter') required = ri.qty_per_porsi / 1000.0;
      else if (ri_satuan === 'kg' && bb_satuan === 'gram') required = ri.qty_per_porsi * 1000.0;
      else if (ri_satuan === 'liter' && bb_satuan === 'ml') required = ri.qty_per_porsi * 1000.0;
      
      if (saldo === null || saldo < required) {
        isUnavailable = true;
        reason.push(`${bb?.nama} (Need: ${required} ${bb?.satuan}, Have: ${saldo})`);
      }
    }
    
    if (isUnavailable) {
      result.push({
        menu: res.nama,
        menu_ref: res.menu_item_ref,
        reasons: reason
      });
    }
  }
  
  console.log(JSON.stringify(result, null, 2));
})();
