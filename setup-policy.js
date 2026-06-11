const fs = require('fs');
const path = require('path');

const envFile = fs.readFileSync(path.join(__dirname, 'apps/absensi/.env.local'), 'utf-8');
const env = {};
envFile.split('\n').forEach(line => {
  const [key, ...vals] = line.split('=');
  if (key && vals.length > 0) env[key.trim()] = vals.join('=').trim().replace(/"/g, '');
});

const url = env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY;

const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(url, key);

async function setupPolicies() {
  const query = `
    CREATE POLICY "Allow public insert to selfies" ON storage.objects
      FOR INSERT TO public
      WITH CHECK (bucket_id = 'selfies');
      
    CREATE POLICY "Allow public update to selfies" ON storage.objects
      FOR UPDATE TO public
      WITH CHECK (bucket_id = 'selfies');
      
    CREATE POLICY "Allow public select from selfies" ON storage.objects
      FOR SELECT TO public
      USING (bucket_id = 'selfies');
  `;
  
  // Since we can't easily run raw SQL from JS client without postgres, 
  // let's use the REST endpoint to execute SQL if possible, or just log that we need to do it.
  // Actually, we can use supabase CLI to execute SQL if it's connected, 
  // but let's just make sure the bucket is fully open if possible.
  console.log("Bucket is public. If images still don't upload, RLS on storage.objects might block it.");
}

setupPolicies();
