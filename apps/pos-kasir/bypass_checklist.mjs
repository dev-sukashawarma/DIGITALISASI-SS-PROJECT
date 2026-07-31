
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve('./.env.local') });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const date = '2026-07-30';
  
  // 1. Get Kalisari outlet
  const { data: outlets } = await supabase.from('outlets').select('id, name');
  const kalisari = outlets.find(o => o.name.toLowerCase().includes('kalisari'));
  
  if (!kalisari) {
    console.error('Kalisari outlet not found');
    return;
  }
  
  console.log('Found Kalisari outlet:', kalisari.id);
  
  // 2. Get or create record
  let { data: record } = await supabase
    .from('daily_checklist_records')
    .select('id')
    .eq('outlet_id', kalisari.id)
    .eq('date', date)
    .maybeSingle();
    
  if (!record) {
    console.log('Creating new record for today...');
    const { data: inserted, error } = await supabase
      .from('daily_checklist_records')
      .insert({ outlet_id: kalisari.id, date })
      .select('id')
      .single();
      
    if (error) {
      console.error('Error creating record:', error);
      return;
    }
    record = inserted;
  }
  
  console.log('Record ID:', record.id);
  
  // 3. Get all checklist items
  const { data: items, error: itemsError } = await supabase
    .from('checklist_items')
    .select('id');
    
  if (itemsError || !items) {
    console.error('Error fetching items:', itemsError);
    return;
  }
  
  console.log('Found', items.length, 'checklist items to bypass');
  
  // 4. Tick all of them
  const ticksToInsert = items.map(item => ({
    record_id: record.id,
    item_id: item.id,
    ticked_by: null
  }));
  
  const { error: ticksError } = await supabase
    .from('daily_checklist_ticks')
    .upsert(ticksToInsert, { onConflict: 'record_id, item_id' });
    
  if (ticksError) {
    console.error('Error inserting ticks:', ticksError);
  } else {
    console.log('Successfully bypassed all checklist items for Kalisari for today!');
  }
}

run();

