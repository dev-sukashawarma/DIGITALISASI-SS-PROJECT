import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function main() {
  const { data: outlets, error: outletError } = await supabase
    .from('outlets')
    .select('*')
    .ilike('name', '%cicurug%');

  if (outletError || !outlets || outlets.length === 0) {
    console.error("Outlet Cicurug not found:", outletError);
    return;
  }
  
  const outletId = outlets[0].id;

  const updates = [
    { id: '4e94bec4-c473-49d7-8791-aa8a6a80337f', qty: 5 }, // SAOS CABE
    { id: '841dc31e-a5c0-4a8d-b599-eead717108cc', qty: 3 }, // SAOS TOMAT
    { id: '0b03221b-d1a7-47e2-8c3f-2d2b514d1273', qty: 1 }, // SAOS SAMYANG
    { id: '98684c07-1311-41cf-a8e9-767d2cb8fed3', qty: 7 }, // MAYONES
    { id: '860ca70e-8546-4ea4-a0c7-c02952bb006e', qty: 30 }, // KULIT 25
    { id: '7c3ab107-2e91-48ed-b7fd-7b0788ccb32a', qty: 20 }, // KULIT 28
    { id: '9ae8f795-b7c4-473d-8c94-650cda128e84', qty: 15 }, // KULIT 32
    { id: 'c06138d3-75d0-450a-a731-aa6957284e20', qty: 60 }, // AYAM
    { id: 'a606d977-266a-4526-8ba6-a92b3760aff2', qty: 5 }, // KENTANG
    { id: '60fe69c1-3943-4dbc-9ba9-c23440de471d', qty: 1 }, // KEJU
    { id: 'b4062dcd-5833-4b4b-af90-17b2e78b427f', qty: 5 }, // TUM
    { id: '805a0197-42bb-4105-8dad-7efd100a725e', qty: 3 }, // BAWANG
    { id: '51b9bca7-9804-474c-a0c5-3eba54143b3b', qty: 10 }, // TEPUNG
    { id: '99483bfb-4ab0-4828-90ae-349b65999950', qty: 2 }, // MINYAK SAYUR
    { id: '4804d1fc-f06c-4306-adfd-a798bda1275a', qty: 4 }, // FOIL
    { id: 'f0f23ba8-72e7-4d2c-842f-fc2f7a5d9b30', qty: 5 }, // PAPER WRAP
    { id: '74f5a25b-4b92-4281-ab02-9a1f76c3343d', qty: 1 }, // POWDER TEH
    { id: 'fd157e24-3cab-463b-8d16-d565b04290d8', qty: 1 }, // POWDER JERUK
    { id: '32275b6f-9f17-487d-992b-9e4dfe911f1c', qty: 100 }, // CUP + TUTUP
    { id: 'ea22c9f6-dd51-4965-b6b5-b67507cfd2ef', qty: 20 }, // SAPI
    { id: '4a7f5352-dc0f-448e-a7d2-37d74f5d45c3', qty: 10 }, // KERTAS STRUK
    { id: '4170c04f-418a-4ae6-a069-a4cd1907fc0f', qty: 20 }, // SARUNG TANGAN
    { id: 'bfb13b95-08bb-40bd-bbbc-29b4a023684f', qty: 2 }, // PLASTIK MERAH
    { id: '42381bbb-7edb-4327-a191-272a589316f9', qty: 4 }, // POLYBAG
  ];

  // Get current stock
  const { data: currentStock, error: currentStockError } = await supabase
    .from('stok_balance')
    .select('*')
    .eq('outlet_id', outletId);
    
  if (currentStockError) {
    console.error("Error fetching current stock", currentStockError);
    return;
  }

  for (const item of updates) {
    const existingStok = currentStock.find(x => x.bahan_baku_id === item.id);
    const now = new Date().toISOString();
    
    if (existingStok) {
      const { error: updateError } = await supabase
        .from('stok_balance')
        .update({ saldo: item.qty, updated_at: now })
        .eq('id', existingStok.id);
        
      if (updateError) {
        console.error(`Error updating ${item.id}:`, updateError);
      } else {
        console.log(`✅ Updated ID ${item.id} to ${item.qty} (was ${existingStok.saldo})`);
      }
    } else {
      const { error: insertError } = await supabase
        .from('stok_balance')
        .insert({
          outlet_id: outletId,
          bahan_baku_id: item.id,
          saldo: item.qty,
          updated_at: now
        });
        
      if (insertError) {
        console.error(`Error inserting ${item.id}:`, insertError);
      } else {
        console.log(`✅ Inserted ID ${item.id} with qty ${item.qty}`);
      }
    }
  }

  console.log("Done updating stock!");
}

main();
