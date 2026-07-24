const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: 'apps/admin-dashboard/.env.local' });
if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    require('dotenv').config({ path: '.env.local' });
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
  const { data, error } = await supabase
    .from('orders')
    .select('created_at, outlets(name)');
    
  if (error) console.error(error);
  else {
    const outletStats = {};
    
    data.forEach(order => {
        if (order.outlets && order.outlets.name) {
            const name = order.outlets.name;
            const dateStr = order.created_at.split('T')[0];
            if (!outletStats[name]) {
                outletStats[name] = { min: dateStr, max: dateStr, count: 0 };
            }
            if (dateStr < outletStats[name].min) outletStats[name].min = dateStr;
            if (dateStr > outletStats[name].max) outletStats[name].max = dateStr;
            outletStats[name].count++;
        }
    });
    
    console.log("Activity per outlet:");
    console.table(
        Object.entries(outletStats)
            .map(([name, stats]) => ({
                Name: name,
                'First Order': stats.min,
                'Last Order': stats.max,
                'Total Orders': stats.count
            }))
            .sort((a, b) => a['First Order'].localeCompare(b['First Order']))
    );
  }
}
run();
