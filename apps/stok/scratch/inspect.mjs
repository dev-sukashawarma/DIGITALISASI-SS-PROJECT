import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const G = 'd23e11b3-23f1-4f9a-b428-cc73e1aa9b90';
const { data: ops } = await s.from('opname').select('id,tanggal,status,created_at,created_by').eq('outlet_id', G).order('created_at',{ascending:false}).limit(3);
console.log('OPNAME:', ops);
for (const o of ops ?? []) {
  const { data: it } = await s.from('opname_item').select('bahan_baku_id,qty_fisik,qty_system,selisih,flagged').eq('opname_id', o.id).limit(5);
  const { data: led } = await s.from('ledger_stok').select('id,qty,bahan_baku_id,tipe').eq('ref_opname_id', o.id);
  const { count } = await s.from('opname_item').select('*',{count:'exact',head:true}).eq('opname_id', o.id);
  console.log(`\n-- ${o.id} status=${o.status} items=${count} ledger=${led?.length}`);
  console.log('sample items:', it);
}
