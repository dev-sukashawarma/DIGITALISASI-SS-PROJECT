const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://khpkoreaaucvyqfhynfq.supabase.co';
const serviceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtocGtvcmVhYXVjdnlxZmh5bmZxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDk2MzI5MiwiZXhwIjoyMDk2NTM5MjkyfQ.Dy0QMAHfB8EU9BK-JuyRrBidpG6iM94t9RtiJ_viZz8';

const admin = createClient(supabaseUrl, serviceKey);

async function findAdrian() {
  const { data: staff, error } = await admin
    .from('outlet_staff')
    .select('*')
    .ilike('name', '%adrian%');
    
  if (error) {
    console.error('Error fetching outlet_staff:', error.message);
  } else {
    console.log('Adrian staff records:', JSON.stringify(staff, null, 2));
  }
}

findAdrian();
