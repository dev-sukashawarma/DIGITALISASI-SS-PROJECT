const fs = require('fs');
const path = require('path');

function getFiles(dir, fileList = []) {
  if (!fs.existsSync(dir)) return fileList;
  const files = fs.readdirSync(dir);
  files.forEach(file => {
    const filePath = path.join(dir, file);
    if (fs.statSync(filePath).isDirectory()) {
      if (!file.startsWith('.') && file !== 'node_modules' && file !== 'dist' && file !== '.next') {
        getFiles(filePath, fileList);
      }
    } else if (file.endsWith('.ts') || file.endsWith('.tsx') || file.endsWith('.js') || file.endsWith('.jsx')) {
      fileList.push(filePath);
    }
  });
  return fileList;
}

const allFiles = [...getFiles('apps'), ...getFiles('packages')];

let tableCalls = {};
let rpcCalls = {};
let fileDetails = [];

allFiles.forEach(file => {
  const content = fs.readFileSync(file, 'utf8');
  const relPath = path.relative(process.cwd(), file);
  
  // match .from('table')
  const fromMatches = content.matchAll(/\.from\(\s*['"]([^'"]+)['"]\s*\)/g);
  for (const m of fromMatches) {
    const tbl = m[1];
    tableCalls[tbl] = (tableCalls[tbl] || 0) + 1;
  }

  // match .rpc('func', ...)
  const rpcMatches = content.matchAll(/\.rpc\(\s*['"]([^'"]+)['"]/g);
  for (const m of rpcMatches) {
    const r = m[1];
    rpcCalls[r] = (rpcCalls[r] || 0) + 1;
  }

  // Check select without limit or range
  const lines = content.split('\n');
  lines.forEach((line, idx) => {
    if (line.includes('.from(') && line.includes('.select(')) {
      if (!line.includes('.limit(') && !line.includes('.range(') && !line.includes('.single(') && !line.includes('.maybeSingle(') && !line.includes('.head(')) {
        fileDetails.push({ file: relPath, lineNo: idx + 1, code: line.trim() });
      }
    }
  });
});

console.log('=== TOP QUERIED TABLES IN FRONTEND ===');
console.log(Object.entries(tableCalls).sort((a,b) => b[1]-a[1]).slice(0, 25));

console.log('\n=== TOP RPC CALLS IN FRONTEND ===');
console.log(Object.entries(rpcCalls).sort((a,b) => b[1]-a[1]));

console.log('\n=== QUERIES WITHOUT LIMIT / RANGE (Sample 15) ===');
fileDetails.slice(0, 15).forEach(item => {
  console.log(`${item.file}:${item.lineNo} -> ${item.code}`);
});
console.log(`Total queries potentially missing limits: ${fileDetails.length}`);
