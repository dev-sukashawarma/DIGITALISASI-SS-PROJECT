import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
async function run() {
  const { data: outlets } = await supabase.from('outlets').select('id, name, type');
  
  const internal = outlets.find(o => o.name.includes('BEJI') || o.type === 'outlet');
  const mitra = outlets.find(o => o.name.includes('CIBUBUR') || o.type === 'mitra');
  
  async function getSample(outlet) {
    if (!outlet) return;
    const { data: orders } = await supabase.from('orders')
      .select('id, created_at')
      .eq('outlet_id', outlet.id)
      .eq('source', 'pos')
      .order('created_at', { ascending: true })
      .limit(200);
      
    if (!orders || orders.length === 0) return console.log(outlet.name, 'No orders found');
    
    const targetDayStr = orders[0].created_at.split('T')[0];
    const targetOrders = orders.filter(o => o.created_at.startsWith(targetDayStr));
    const orderIds = targetOrders.map(o => o.id);
    
    const { data: items } = await supabase.from('order_items')
      .select('menu_item_id, menu_item_name, quantity, subtotal, menu_items(hpp_override)')
      .in('order_id', orderIds);
      
    let totalOmset = 0;
    let totalHpp = 0;
    const itemSummary = {};
    
    for (const it of items) {
      totalOmset += it.subtotal;
      const hpp = it.menu_items?.hpp_override || 5000; // Mock HPP if null for demo purposes
      const totalItemHpp = hpp * it.quantity;
      totalHpp += totalItemHpp;
      
      if (!itemSummary[it.menu_item_name]) {
        itemSummary[it.menu_item_name] = { qty: 0, omset: 0, hpp: 0, hpp_unit: hpp };
      }
      itemSummary[it.menu_item_name].qty += it.quantity;
      itemSummary[it.menu_item_name].omset += it.subtotal;
      itemSummary[it.menu_item_name].hpp += totalItemHpp;
    }
    
    console.log('\n--- SAMPLE FOR ' + outlet.name + ' (' + outlet.type + ') on ' + targetDayStr + ' ---');
    console.log('Total Orders: ' + targetOrders.length);
    console.log('Total Revenue: Rp' + totalOmset.toLocaleString('id-ID'));
    console.log('Total HPP: Rp' + totalHpp.toLocaleString('id-ID'));
    console.log('Gross Profit: Rp' + (totalOmset - totalHpp).toLocaleString('id-ID'));
    console.log('Top Items:');
    const sorted = Object.entries(itemSummary).sort((a,b) => b[1].omset - a[1].omset).slice(0, 4);
    for (const [name, stats] of sorted) {
      console.log(' - ' + name + ': ' + stats.qty + ' pcs | Omset Rp' + stats.omset.toLocaleString('id-ID') + ' | HPP (Rp' + stats.hpp_unit.toLocaleString('id-ID') + ' x ' + stats.qty + ') = Rp' + stats.hpp.toLocaleString('id-ID') + ' | Laba Rp' + (stats.omset - stats.hpp).toLocaleString('id-ID'));
    }
  }
  
  await getSample(internal);
  await getSample(mitra);
}
run();
