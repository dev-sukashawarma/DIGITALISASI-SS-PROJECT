require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const query = `
CREATE OR REPLACE FUNCTION ledger_stamp_saldo() RETURNS trigger AS $$
DECLARE cur NUMERIC;
BEGIN
  SELECT saldo INTO cur FROM stok_balance
    WHERE outlet_id = NEW.outlet_id AND bahan_baku_id = NEW.bahan_baku_id;
  cur := COALESCE(cur, 0);
  NEW.saldo_sebelum := cur;
  NEW.saldo_sesudah := cur + NEW.qty;

  -- Pengecualian: tipe 'opname_selisih', 'rejected_kiriman', dan 'pemakaian' boleh hasilkan saldo negatif
  -- FIX: Only throw error if we are reducing stock (qty < 0)
  IF NEW.saldo_sesudah < 0
    AND NEW.qty < 0
    AND NEW.tipe NOT IN ('opname_selisih', 'rejected_kiriman', 'pemakaian')
  THEN
    RAISE EXCEPTION 'Stok tidak cukup: saldo saat ini % %, pengurangan % %',
      trim_scale(cur), (SELECT satuan FROM bahan_baku WHERE id = NEW.bahan_baku_id),
      trim_scale(ABS(NEW.qty)), (SELECT satuan FROM bahan_baku WHERE id = NEW.bahan_baku_id)
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
  `;
  
  const { data, error } = await supabase.rpc('exec_sql', { sql: query });
  if (error) {
    console.error("RPC exec_sql error:", error);
    // try rest
    const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
          'Content-Type': 'application/json',
          'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY,
          'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`
      },
      body: JSON.stringify({ sql: query })
    });
    console.log(await res.text());
  } else {
    console.log("Trigger updated successfully!");
  }
}

run();
