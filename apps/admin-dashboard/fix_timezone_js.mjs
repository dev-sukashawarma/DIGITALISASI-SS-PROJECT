import fs from 'fs';
import path from 'path';

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(function(file) {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) { 
      results = results.concat(walk(file));
    } else {
      if (file.endsWith('.ts') || file.endsWith('.tsx')) {
        results.push(file);
      }
    }
  });
  return results;
}

const files = walk('./src');
let changedCount = 0;

for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');
  let original = content;

  // Replace .toLocaleTimeString('id-ID') with .toLocaleTimeString('id-ID', { timeZone: 'Asia/Jakarta' })
  content = content.replace(/\.toLocaleTimeString\(\s*['"]id-ID['"]\s*\)/g, ".toLocaleTimeString('id-ID', { timeZone: 'Asia/Jakarta' })");
  
  // Replace .toLocaleTimeString('id-ID', { with .toLocaleTimeString('id-ID', { timeZone: 'Asia/Jakarta', 
  // Use regex that looks for the start of the options object, being careful not to duplicate if it already exists
  content = content.replace(/\.toLocaleTimeString\(\s*['"]id-ID['"]\s*,\s*\{(?![^}]*timeZone)/g, ".toLocaleTimeString('id-ID', { timeZone: 'Asia/Jakarta', ");

  // Same for toLocaleDateString
  content = content.replace(/\.toLocaleDateString\(\s*['"]id-ID['"]\s*\)/g, ".toLocaleDateString('id-ID', { timeZone: 'Asia/Jakarta' })");
  content = content.replace(/\.toLocaleDateString\(\s*['"]id-ID['"]\s*,\s*\{(?![^}]*timeZone)/g, ".toLocaleDateString('id-ID', { timeZone: 'Asia/Jakarta', ");

  // Same for toLocaleString
  content = content.replace(/\.toLocaleString\(\s*['"]id-ID['"]\s*\)/g, ".toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })");
  content = content.replace(/\.toLocaleString\(\s*['"]id-ID['"]\s*,\s*\{(?![^}]*timeZone)/g, ".toLocaleString('id-ID', { timeZone: 'Asia/Jakarta', ");

  if (content !== original) {
    fs.writeFileSync(file, content);
    changedCount++;
    console.log("Updated", file);
  }
}

console.log("Done. Changed files:", changedCount);
