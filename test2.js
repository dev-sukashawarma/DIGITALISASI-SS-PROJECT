const { Client } = require('pg');
const client = new Client('postgres://postgres:Dy0QMAHfB8EU9BK-JuyRrBidpG6iM94t9RtiJ_viZz8@db.khpkoreaaucvyqfhynfq.supabase.co:6543/postgres');

(async () => {
  try {
    await client.connect();
    
    const crewCountRes = await client.query(`
      SELECT *
      FROM public.outlet_staff;
    `);
    
    console.log(crewCountRes.rows);
  } catch (err) {
    console.error(err);
  } finally {
    await client.end();
  }
})();
