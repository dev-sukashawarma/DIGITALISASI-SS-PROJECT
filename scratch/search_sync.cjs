const fs = require('fs');
const path = require('path');

function search(dir, regex) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    if (['node_modules', '.next', 'dist', 'build', '.git'].includes(file)) continue;
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      search(fullPath, regex);
    } else if (file.endsWith('.ts') || file.endsWith('.tsx')) {
      const content = fs.readFileSync(fullPath, 'utf8');
      if (regex.test(content)) {
        console.log(`Found in: ${fullPath}`);
      }
    }
  }
}

search('apps/pos-kasir', /syncLocalOrders|queueStatusMutation/i);
