const fs = require('fs');
const path = require('path');
const dir = 'supabase/migrations';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.sql'));

let rpcs = [];
let rlsPolicies = [];

files.forEach(f => {
  const content = fs.readFileSync(path.join(dir, f), 'utf8');
  
  // Extract policy definitions
  const polMatches = content.matchAll(/CREATE\s+POLICY\s+["']?([a-zA-Z0-9_ -]+)["']?\s+ON\s+([a-zA-Z0-9_]+)[^;]+/gi);
  for (const m of polMatches) {
    const policyName = m[1];
    const tableName = m[2];
    const body = m[0];
    if (body.includes('SELECT') || body.includes('auth.uid()') || body.includes('accessible_outlet_ids') || body.includes('get_user_role')) {
      rlsPolicies.push({ file: f, table: tableName, name: policyName, body: body.replace(/\s+/g, ' ').slice(0, 150) });
    }
  }
});

console.log('=== HEAVY RLS POLICIES WITH SUBQUERIES/FUNCTIONS ===');
console.log(`Total RLS policies with subqueries/functions: ${rlsPolicies.length}`);
rlsPolicies.slice(0, 20).forEach(p => {
  console.log(`[${p.table}] Policy: "${p.name}" (${p.file})`);
  console.log(`   -> ${p.body}`);
});
