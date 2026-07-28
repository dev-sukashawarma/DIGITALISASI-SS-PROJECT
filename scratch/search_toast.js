const fs = require('fs');
const path = require('path');

function searchFiles(dir, regex) {
  if (!fs.existsSync(dir)) return;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== 'node_modules' && entry.name !== '.next' && entry.name !== '.git') {
        searchFiles(fullPath, regex);
      }
    } else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx') || entry.name.endsWith('.js') || entry.name.endsWith('.jsx'))) {
      const content = fs.readFileSync(fullPath, 'utf8');
      if (regex.test(content)) {
        console.log(fullPath);
      }
    }
  }
}

console.log('--- Search "Terbuka - Siap Transaksi" or "BELUM ABSEN" ---');
searchFiles('apps/pos-kasir', /Terbuka - Siap Transaksi|BELUM ABSEN|BEKERJA/i);
searchFiles('apps/absensi', /Terbuka - Siap Transaksi|BELUM ABSEN|BEKERJA/i);
