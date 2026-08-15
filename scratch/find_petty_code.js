const fs = require('fs');
const path = require('path');

function searchDir(dir, pattern, extFilter) {
  let results = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== 'node_modules' && entry.name !== '.next' && entry.name !== '.git') {
        results = results.concat(searchDir(fullPath, pattern, extFilter));
      }
    } else {
      if (!extFilter || extFilter.test(entry.name)) {
        try {
          const content = fs.readFileSync(fullPath, 'utf8');
          if (pattern.test(content)) {
            results.push(fullPath);
          }
        } catch (e) {}
      }
    }
  }
  return results;
}

const appsDir = path.join(__dirname, '..', 'apps');
console.log("Searching in apps/ for petty cash references...");
const files = searchDir(appsDir, /petty|patty|cash_balance|cash_location/i, /\.(ts|tsx|js|jsx|json)$/);
console.log("Found matching files:", files);
