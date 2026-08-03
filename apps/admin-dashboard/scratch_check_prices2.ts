import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function main() {
  const { data: items } = await supabase
    .from('order_items')
    .select('menu_item_name, quantity, unit_price, subtotal, order_id')
    .eq('menu_item_name', 'SHAWARMA DUO COMBO')
  
  if (items) {
    let totalQty = 0;
    let totalSub = 0;
    items.forEach(i => {
      totalQty += i.quantity;
      totalSub += i.subtotal;
      if (i.subtotal / i.quantity !== 41000) {
        console.log('DIFF PRICE:', i);
      }
    });
    console.log(`TOTAL QTY: ${totalQty}, TOTAL SUB: ${totalSub}, AVG: ${totalSub/totalQty}`);
  }
}
main()
