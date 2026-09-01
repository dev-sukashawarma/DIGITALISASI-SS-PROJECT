const fs = require('fs');
const path = require('path');

function search(dir, ext) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const full = path.join(dir, file);
    if (fs.statSync(full).isDirectory()) {
      search(full, ext);
    } else if (full.endsWith(ext)) {
      const content = fs.readFileSync(full, 'utf8');
      if (content.includes('bucket') || content.includes('storage') || content.includes('getPublicUrl')) {
        console.log(full);
      }
    }
  }
}
search('src', '.ts');
search('src', '.tsx');
