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
      if (content.toLowerCase().includes(pattern.toLowerCase())) {
        console.log(`FOUND '${pattern}' in: ${fullPath}`);
      }
    }
  }
}

searchInDir('c:\\Users\\Creator MPB\\OneDrive\\Desktop\\New folder\\DIGITALISASI-SS-PROJECT', 'web_order');
searchInDir('c:\\Users\\Creator MPB\\OneDrive\\Desktop\\New folder\\DIGITALISASI-SS-PROJECT', 'website_online');
searchInDir('c:\\Users\\Creator MPB\\OneDrive\\Desktop\\New folder\\DIGITALISASI-SS-PROJECT\\apps\\pos-kasir', 'website');
