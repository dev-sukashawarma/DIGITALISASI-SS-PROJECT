const fs = require('fs');
const path = require('path');

function searchFiles(dir, text) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      if (!filePath.includes('node_modules') && !filePath.includes('.next')) {
        searchFiles(filePath, text);
      }
    } else if (filePath.endsWith('.ts') || filePath.endsWith('.tsx') || filePath.endsWith('.js')) {
      const content = fs.readFileSync(filePath, 'utf8');
      if (content.toLowerCase().includes(text.toLowerCase())) {
        console.log(`Found in: ${filePath}`);
      }
    }
  }
}

searchFiles('c:\\Users\\Creator MPB\\OneDrive\\Desktop\\New folder\\DIGITALISASI-SS-PROJECT\\apps\\pos-kasir', 'outlet_id');
