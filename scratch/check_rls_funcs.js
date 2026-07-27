const fs = require('fs');
const path = require('path');
const dir = 'supabase/migrations';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.sql'));

files.forEach(f => {
  const content = fs.readFileSync(path.join(dir, f), 'utf8');
  if (content.includes('auth_outlet_id') || content.includes('accessible_outlet_ids') || content.includes('auth_is_supervisor')) {
    const matches = content.matchAll(/CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+(auth_outlet_id|accessible_outlet_ids|auth_is_supervisor)[\s\S]*?LANGUAGE\s+[a-zA-Z0-9_]+/gi);
    for (const m of matches) {
      console.log(`=== ${m[1]} in ${f} ===`);
      console.log(m[0]);
    }
  }
});
