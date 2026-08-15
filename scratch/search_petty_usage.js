const fs = require('fs');
const path = require('path');

function searchCode(dir, query) {
  let matches = [];
  function walk(d) {
    const files = fs.readdirSync(d, { withFileTypes: true });
    for (const f of files) {
      const p = path.join(d, f.name);
      if (f.isDirectory()) {
        if (!['node_modules', '.next', '.git'].includes(f.name)) walk(p);
      } else if (/\.(ts|tsx|js|sql)$/.test(f.name)) {
        try {
          const content = fs.readFileSync(p, 'utf8');
          if (content.toLowerCase().includes(query.toLowerCase())) {
            matches.push({ file: p, count: (content.match(new RegExp(query, 'gi')) || []).length });
          }
        } catch(e) {}
      }
    }
  }
  walk(dir);
  return matches;
}

console.log("Searching for 'petty_cash_expenses' or 'petty cash balance' or 'saldo petty'...");
console.log("Finance files with petty_cash:", searchCode(path.join(__dirname, '..', 'apps', 'finance'), 'petty_cash'));
console.log("POS files with petty_cash:", searchCode(path.join(__dirname, '..', 'apps', 'pos-kasir'), 'petty_cash'));
console.log("Admin files with petty_cash:", searchCode(path.join(__dirname, '..', 'apps', 'admin-dashboard'), 'petty_cash'));
console.log("Manager files with petty_cash:", searchCode(path.join(__dirname, '..', 'apps', 'manager'), 'petty_cash'));
