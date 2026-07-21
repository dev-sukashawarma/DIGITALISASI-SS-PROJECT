import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function run() {
  const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/rpc/set_daily_target`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY,
      'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`
    },
    body: JSON.stringify({
      p_outlet: null,
      p_amount: 5000000,
      p_per_item_bonus: 0
    })
  });
  
  const text = await res.text();
  console.log("Status set_daily_target:", res.status);
  console.log("Body:", text);
}
run();
