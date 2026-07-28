const fs = require('fs');
const path = require('path');

function searchInDir(dir, pattern) {
  if (!fs.existsSync(dir)) return;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name === 'node_modules' || entry.name === '.next' || entry.name === '.git') continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      searchInDir(fullPath, pattern);
    } else {
      const content = fs.readFileSync(fullPath, 'utf8');
      if (content.includes(pattern)) {
        console.log(`FOUND in: ${fullPath}`);
      }
    }
  }
}

console.log('--- Searching in admin-dashboard ---');
searchInDir('c:\\Users\\Creator MPB\\OneDrive\\Desktop\\New folder\\DIGITALISASI-SS-PROJECT\\apps\\admin-dashboard', 'petty_cash_topups');

console.log('--- Searching in pos-kasir ---');
searchInDir('c:\\Users\\Creator MPB\\OneDrive\\Desktop\\New folder\\DIGITALISASI-SS-PROJECT\\apps\\pos-kasir', 'petty_cash_topups');
