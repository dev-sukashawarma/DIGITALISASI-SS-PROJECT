const fs = require('fs');
const path = require('path');

function search(dir, regex) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    if (file === 'node_modules' || file === '.next' || file === 'dist' || file === 'build') continue;
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      search(fullPath, regex);
    } else if (file.endsWith('.ts') || file.endsWith('.tsx')) {
      const content = fs.readFileSync(fullPath, 'utf8');
      if (regex.test(content)) {
        console.log(`Found in: ${fullPath}`);
        const lines = content.split('\n');
        lines.forEach((line, idx) => {
          if (regex.test(line)) {
            console.log(`  ${idx + 1}: ${line.trim()}`);
          }
        });
      }
    }
  }
}

search('apps/pos-kasir', /petty_cash|kas_kecil/i);
search('apps/admin-dashboard', /petty_cash|kas_kecil/i);
search('packages', /petty_cash|kas_kecil/i);
