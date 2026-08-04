const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://khpkoreaaucvyqfhynfq.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtocGtvcmVhYXVjdnlxZmh5bmZxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDk2MzI5MiwiZXhwIjoyMDk2NTM5MjkyfQ.Dy0QMAHfB8EU9BK-JuyRrBidpG6iM94t9RtiJ_viZz8');

async function run() {
  const shiftId = '4be92cf8-b037-4f1b-a838-164395c0bff7';
  
  // Perbaiki nilai starting_petty_cash untuk shift cicurug yang bermasalah (tertelan)
  const { data, error } = await supabase
    .from('shifts')
    .update({ starting_petty_cash: 403500 })
    .eq('id', shiftId)
    .select();
    
  if (error) {
    console.error('Error updating shift:', error);
  } else {
    console.log('Successfully updated shift:', data);
  }
}

run();
