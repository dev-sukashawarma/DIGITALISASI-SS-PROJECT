const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const xlsx = require('xlsx');
const path = require('path');

const env = {};
try {
  fs.readFileSync(path.join(__dirname, '../apps/HR/.env.local'), 'utf8')
    .split('\n')
    .forEach(l => {
      const m = l.match(/^([^=]+)=(.*)$/);
      if (m) env[m[1].trim()] = m[2].trim().replace(/^['"]|['"]$/g, '');
    });
} catch (e) {
  process.exit(1);
}

const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

function normalizeStr(s) {
  if (!s) return '';
  return s.toLowerCase().replace(/\s+/g, ' ').trim();
}

function normalizeOutlet(s) {
  if (!s) return '';
  return s.toLowerCase()
    .replace('suka shawarma', '')
    .replace('mitra', '')
    .replace('gudang', '')
    .replace('kantor', '')
    .replace('office', '')
    .replace('region', '')
    .replace('ss ', '')
    .replace('pusat', '')
    .replace('hq', '')
    .trim();
}

function levenshtein(a, b) {
  const m = [];
  let i, j;
  const min = Math.min;
  if (!(a && a.length)) return b ? b.length : 0;
  if (!(b && b.length)) return a.length;
  for (i = 0; i <= b.length; m[i] = [i++]);
  for (j = 0; j <= a.length; m[0][j] = j++);
  for (i = 1; i <= b.length; i++) {
    for (j = 1; j <= a.length; j++) {
      m[i][j] = b.charAt(i - 1) == a.charAt(j - 1)
        ? m[i - 1][j - 1]
        : m[i][j] = min(
            m[i - 1][j - 1] + 1,
            min(m[i][j - 1] + 1, m[i - 1][j] + 1)
          );
    }
  }
  return m[b.length][a.length];
}

async function main() {
  const { data: outletsData } = await sb.from('outlets').select('id, name');
  const outletsMap = {};
  outletsData.forEach(o => outletsMap[o.id] = o.name);

  const { data: staff } = await sb.from('outlet_staff').select('id, name, role, status, outlet_id');
  const dbNames = staff.map(s => ({
    id: s.id,
    original: s.name,
    normalized: normalizeStr(s.name),
    role: s.role || '-',
    outlet: outletsMap[s.outlet_id] || '-',
    normalizedOutlet: normalizeOutlet(outletsMap[s.outlet_id] || '-')
  }));

  const filePath = 'C:\\Users\\lu.DESKTOP-HRO3RNS\\Downloads\\payroll agutus.xlsx';
  let excelData = [];
  const workbook = xlsx.readFile(filePath);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = xlsx.utils.sheet_to_json(sheet, { header: 1 });
  
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row) continue;
    const name = row[1];
    if (name && typeof name === 'string' && name.trim() !== '') {
      excelData.push({
        no: excelData.length + 1,
        original: name.trim(),
        normalized: normalizeStr(name),
        position: row[2] || '-',
        location: row[4] || '-',
        normalizedOutlet: normalizeOutlet(row[4] || '-')
      });
    }
  }

  const toUpdate = [];

  for (const ex of excelData) {
    let matched = dbNames.find(db => db.normalized === ex.normalized);
    if (matched) continue;

    let bestFuzzy = null;
    let minDistance = 999;
    
    for (const db of dbNames) {
      let isCandidate = false;
      if (db.normalized.includes(ex.normalized) || ex.normalized.includes(db.normalized)) {
        const dbWords = db.normalized.split(' ');
        const exWords = ex.normalized.split(' ');
        let matchLen = 0;
        for (const w of exWords) {
          if (w.length > 2 && dbWords.includes(w)) matchLen++;
        }
        if (matchLen > 0) isCandidate = true;
      }

      const dist = levenshtein(ex.normalized, db.normalized);
      if (dist < 4 && ex.normalized.length > 4) {
        isCandidate = true;
      }
      
      if (isCandidate) {
        const dbOutWords = db.normalizedOutlet.split(' ').filter(w => w.length > 2);
        const exOutWords = ex.normalizedOutlet.split(' ').filter(w => w.length > 2);
        
        let outletMatch = false;
        for (const w of exOutWords) {
          if (dbOutWords.includes(w)) outletMatch = true;
        }
        if (exOutWords.includes('bcc') && dbOutWords.includes('cimanggu')) outletMatch = true;

        if (outletMatch) {
          if (dist < minDistance || bestFuzzy === null) {
            minDistance = dist;
            bestFuzzy = db;
          }
        }
      }
    }

    if (bestFuzzy) {
      toUpdate.push({ excel: ex, db: bestFuzzy });
    }
  }

  console.log(`Executing ${toUpdate.length} updates...`);
  
  for (const u of toUpdate) {
    const { error } = await sb.from('outlet_staff')
      .update({ name: u.excel.original })
      .eq('id', u.db.id);
      
    if (error) {
      console.error(`Error updating ${u.db.original}:`, error.message);
    } else {
      console.log(`✅ Sukses update: "${u.db.original}" -> "${u.excel.original}"`);
    }
  }
  
  console.log("Selesai!");
}

main();
