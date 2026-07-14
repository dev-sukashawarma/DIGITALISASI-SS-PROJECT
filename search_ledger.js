const fs = require('fs');
const path = require('path');

function searchInDir(dir, query) {
  if (!fs.existsSync(dir)) return;
  const files = fs.readdirSync(dir);
  for (const file of files) {
    if (file === 'node_modules' || file === '.next' || file === '.git') continue;
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      searchInDir(fullPath, query);
    } else if (stat.isFile() && (fullPath.endsWith('.ts') || fullPath.endsWith('.tsx') || fullPath.endsWith('.sql'))) {
      const content = fs.readFileSync(fullPath, 'utf8');
      if (content.toLowerCase().includes(query.toLowerCase())) {
        console.log(`Match found in: ${fullPath}`);
        // print a few lines around the match
        const lines = content.split('\n');
        for (let i = 0; i < lines.length; i++) {
          if (lines[i].toLowerCase().includes(query.toLowerCase())) {
            console.log(`  Line ${i + 1}: ${lines[i].trim()}`);
          }
        }
      }
    }
  }
}

searchInDir(path.join(__dirname, 'apps', 'stok'), 'ledger_stok');
searchInDir(path.join(__dirname, 'apps', 'pos-kasir'), 'ledger_stok');
searchInDir(path.join(__dirname, 'apps', 'stok'), 'insert into ledger_stok');
