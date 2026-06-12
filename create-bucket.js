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

async function createBucket() {
  const res = await fetch(`${url}/storage/v1/bucket`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${key}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      id: 'selfies',
      name: 'selfies',
      public: true,
      file_size_limit: 10485760
    })
  });
  const data = await res.json();
  if (res.ok) {
    console.log('Bucket created successfully:', data);
  } else {
    if (data.message && data.message.includes('already exists')) {
      console.log('Bucket already exists. Updating to public...');
      await fetch(`${url}/storage/v1/bucket/selfies`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${key}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ public: true })
      });
      console.log('Bucket made public.');
    } else {
      console.error('Error:', data);
    }
  }
}

createBucket();
