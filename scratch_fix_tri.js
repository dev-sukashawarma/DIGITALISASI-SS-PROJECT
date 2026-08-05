const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function fixTriRizky() {
  const staffId = 'caf351f1-ea40-4fff-99ce-a4af71c59d47'; // Tri Rizky
  const sukmajayaId = '550e8400-e29b-41d4-a716-446655440005';
  
  // Check if he has Sukmajaya
  const { data: hasSukmajaya } = await supabase
    .from('staff_outlets')
    .select('id')
    .eq('staff_id', staffId)
    .eq('outlet_id', sukmajayaId);
    
  if (hasSukmajaya && hasSukmajaya.length === 0) {
    console.log("Adding Sukmajaya to Tri Rizky...");
    const { error } = await supabase.from('staff_outlets').insert({
      staff_id: staffId,
      outlet_id: sukmajayaId
    });
    if (error) {
      console.log("Error:", error);
    } else {
      console.log("Added Sukmajaya successfully.");
    }
  } else {
    console.log("Tri Rizky already has Sukmajaya.");
  }
}

fixTriRizky();
