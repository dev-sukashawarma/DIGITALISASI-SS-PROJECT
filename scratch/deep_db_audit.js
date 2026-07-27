const fs = require('fs');
const path = require('path');
const dir = 'supabase/migrations';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.sql'));

let foreignKeys = [];
let indexedCols = new Set();

files.forEach(f => {
  const content = fs.readFileSync(path.join(dir, f), 'utf8');
  
  // Extract indexes
  const idxMatches = content.matchAll(/CREATE\s+(?:UNIQUE\s+)?INDEX\s+(?:IF\s+NOT\s+EXISTS\s+)?([a-zA-Z0-9_]+)\s+ON\s+([a-zA-Z0-9_]+)\s*\(([^)]+)\)/gi);
  for (const m of idxMatches) {
    const table = m[2].toLowerCase();
    const cols = m[3].toLowerCase().replace(/\s+/g, '').split(',');
    // first column of index
    const firstCol = cols[0].replace(/desc|asc/gi, '');
    indexedCols.add(`${table}.${firstCol}`);
  }

  // Extract REFERENCES (foreign keys)
  // Simple table parsing: table name context
  const lines = content.split('\n');
  let currentTable = null;
  lines.forEach(line => {
    const tblMatch = line.match(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?([a-zA-Z0-9_]+)/i);
    if (tblMatch) currentTable = tblMatch[1].toLowerCase();
    
    if (currentTable && line.includes('REFERENCES')) {
      const colMatch = line.match(/([a-zA-Z0-9_]+)\s+.*REFERENCES\s+([a-zA-Z0-9_]+)/i);
      if (colMatch) {
        const col = colMatch[1].toLowerCase();
        const refTable = colMatch[2].toLowerCase();
        foreignKeys.push({ table: currentTable, col: col, refTable: refTable, file: f });
      }
    }
  });
});

console.log('=== FOREIGN KEYS WITHOUT INDEX ON KEY COLUMN ===');
let missingIndexCount = 0;
foreignKeys.forEach(fk => {
  const key = `${fk.table}.${fk.col}`;
  if (!indexedCols.has(key) && fk.col !== 'id') {
    console.log(`[MISSING INDEX] ${fk.table}.${fk.col} -> references ${fk.refTable} (${fk.file})`);
    missingIndexCount++;
  }
});

console.log(`\nTotal FKs checked: ${foreignKeys.length}`);
console.log(`Total missing FK indexes: ${missingIndexCount}`);
