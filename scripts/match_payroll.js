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
  const { data: staff } = await sb.from('outlet_staff').select('id, name, role, status');
  
  const dbNames = staff.map(s => ({
    id: s.id,
    original: s.name,
    normalized: normalizeStr(s.name),
    role: s.role,
    status: s.status
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
        rowNum: i + 1,
        original: name.trim(),
        normalized: normalizeStr(name),
        position: row[2],
        location: row[4],
        base: row[5],
        salary: row[13]
      });
    }
  }

  const exactMatches = [];
  const fuzzyMatches = [];
  const noMatches = [];

  for (const ex of excelData) {
    let matched = dbNames.find(db => db.normalized === ex.normalized);
    if (matched) {
      exactMatches.push({ excel: ex, db: matched });
      continue;
    }

    let bestFuzzy = null;
    let minDistance = 999;
    
    for (const db of dbNames) {
      // Direct inclusion
      if (db.normalized.includes(ex.normalized) || ex.normalized.includes(db.normalized)) {
        const dbWords = db.normalized.split(' ');
        const exWords = ex.normalized.split(' ');
        let matchLen = 0;
        for (const w of exWords) {
          if (w.length > 2 && dbWords.includes(w)) matchLen++;
        }
        if (matchLen > 0) {
           bestFuzzy = db;
           minDistance = 0;
           break;
        }
      }

      const dist = levenshtein(ex.normalized, db.normalized);
      if (dist < 4 && dist < minDistance && ex.normalized.length > 4) {
        minDistance = dist;
        bestFuzzy = db;
      }
    }

    if (bestFuzzy) {
      fuzzyMatches.push({ excel: ex, db: bestFuzzy });
    } else {
      noMatches.push(ex);
    }
  }

  console.log("=== EXACT MATCHES ===");
  console.log(`Found ${exactMatches.length} exact matches.\n`);

  console.log("=== FUZZY MATCHES (POTENTIAL MISSPELLING OR ALIAS) ===");
  if (fuzzyMatches.length === 0) console.log("None");
  fuzzyMatches.forEach(m => {
    console.log(`Excel: "${m.excel.original}" -> DB: "${m.db.original}"`);
  });
  console.log();

  console.log("=== NOT FOUND IN DB (MISSING) ===");
  if (noMatches.length === 0) console.log("None");
  noMatches.forEach(ex => {
    console.log(`- ${ex.original} [${ex.position}]`);
  });
  console.log();
}

main();
