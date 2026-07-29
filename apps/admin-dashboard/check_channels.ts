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
    .select('id, name, price, channel_prices, hpp_override, is_available')
    .order('name');
    
  const { data: recipes } = await supabase
    .from('resep')
    .select('menu_item_ref, buffer_amount, resep_item(bahan_baku_id, qty_per_porsi, bahan_baku:bahan_baku_id(bahan_baku_sku(harga_beli, qty_isi, is_default, is_active), bahan_baku_harga(harga_beli_display, kemasan_qty)))')
    .eq('scope', 'global');
    
  const { data: outletPrices } = await supabase
    .from('menu_outlet_prices')
    .select('menu_item_id, is_available');
    
  const recipeHppMap: Record<string, number> = {};
  for (const r of (recipes || [])) {
    const items = r.resep_item || [];
    let total = 0;
    for (const item of items) {
      const bb = (item as any).bahan_baku;
      if (!bb) continue;
      const skus = Array.isArray(bb.bahan_baku_sku) ? bb.bahan_baku_sku.filter(s => s.is_active) : [];
      let harga = 0;
      let qty = 0;
      if (skus.length > 0) {
        const def = skus.find(s => s.is_default) || skus[0];
        harga = Number(def.harga_beli) || 0;
        qty = Number(def.qty_isi) || 0;
      } else {
        const h = Array.isArray(bb.bahan_baku_harga) ? bb.bahan_baku_harga[0] : bb.bahan_baku_harga;
        harga = Number(h?.harga_beli_display) || 0;
        qty = Number(h?.kemasan_qty) || 0;
      }
      if (harga > 0 && qty > 0) {
        total += (harga / qty) * Number((item as any).qty_per_porsi || 0);
      }
    }
    const safeBuffer = Math.max(0, Number(r.buffer_amount) || 0);
    recipeHppMap[r.menu_item_ref] = Math.round(total + safeBuffer);
  }
    
  let markdown = `| Menu | Channel Pembayaran (POS) | Channel Pembayaran (HPP) | HPP Aktif | Distribusi Mitra |\n`;
  markdown += `|---|---|---|---|---|\n`;
  
  for (const m of (menuItems || [])) {
    let posChannels = '-';
    let hppChannels = '-';
    
    if (m.channel_prices) {
      posChannels = Object.keys(m.channel_prices as Record<string, number>).join(', ');
      hppChannels = Object.keys(m.channel_prices as Record<string, number>).join(', ');
    }
    if (!posChannels) posChannels = '-';
    if (!hppChannels) hppChannels = '-';
    
    const effHpp = m.hpp_override !== null ? m.hpp_override : recipeHppMap[m.id];
    const hppText = effHpp ? "Rp " + effHpp.toLocaleString('id-ID') : '-';
    
    const activeMitras = (outletPrices || []).filter(p => p.menu_item_id === m.id && p.is_available).length;
    
    markdown += `| ${m.name} | ${posChannels} | ${hppChannels} | ${hppText} | ${activeMitras} Mitra |\n`;
  }
  
  console.log(markdown);
}

run();
