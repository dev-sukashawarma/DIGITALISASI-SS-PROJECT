const fs = require('fs');
const path = require('path');

function searchDir(dir, pattern) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      searchDir(filePath, pattern);
    } else if (file.endsWith('.tsx') || file.endsWith('.ts') || file.endsWith('.jsx') || file.endsWith('.js')) {
      const content = fs.readFileSync(filePath, 'utf-8');
      if (content.includes(pattern)) {
        console.log(`Found in: ${filePath}`);
      }
    }
  }
}

console.log('Searching for "Cetak Struk Ulang"...');
searchDir(path.join(__dirname, '../app'), 'Cetak Struk Ulang');
searchDir(path.join(__dirname, '../components'), 'Cetak Struk Ulang');
