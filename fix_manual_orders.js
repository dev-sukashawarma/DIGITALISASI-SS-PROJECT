const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  'https://khpkoreaaucvyqfhynfq.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtocGtvcmVhYXVjdnlxZmh5bmZxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDk2MzI5MiwiZXhwIjoyMDk2NTM5MjkyfQ.Dy0QMAHfB8EU9BK-JuyRrBidpG6iM94t9RtiJ_viZz8'
);

async function run() {
  const { data: orders, error } = await supabase.from('orders').select('id, channel, sales_source').eq('source', 'manual');
  console.log("Error finding manual orders:", error);
  if (!orders) return;

  for (const o of orders) {
    if (o.channel && o.channel !== o.sales_source) {
      const mappedSource = o.channel === 'tiktokgo' ? 'tiktok' : o.channel;
      const validSalesSource = ['pos','online','gofood','grabfood','shopeefood','tiktok'].includes(mappedSource) ? mappedSource : 'pos';
      if (validSalesSource !== o.sales_source) {
        console.log(`Fixing order ${o.id}: sales_source = ${validSalesSource}`);
        const { error: updErr } = await supabase.from('orders').update({ sales_source: validSalesSource }).eq('id', o.id);
        if (updErr) console.error(updErr);
      }
    }
  }
  console.log("Done");
}
run();
