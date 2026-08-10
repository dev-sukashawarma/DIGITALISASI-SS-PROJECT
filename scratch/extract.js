const fs = require('fs'); 
const lines = fs.readFileSync('C:/Users/lu.DESKTOP-HRO3RNS/.gemini/antigravity/brain/0d30b7f1-055a-4ff8-93fe-b4a33dd1cc0e/.system_generated/logs/transcript_full.jsonl', 'utf8').split('\n'); 
const views = lines.map(l => { try { return JSON.parse(l); } catch(e) { return null; } }).filter(Boolean).filter(l => l.type === 'VIEW_FILE' && l.content && l.content.includes('reports/input-pengeluaran/page.tsx')); 
const fullView = views.find(v => v.content.includes("1: 'use client'")); 
if (fullView) { 
  const content = fullView.content; 
  const startIndex = content.indexOf('1:'); 
  const source = content.substring(startIndex).replace(/^\d+: /gm, ''); 
  fs.writeFileSync('scratch/recovered_page.tsx', source); 
  console.log('Recovered!'); 
} else { 
  console.log('Not found'); 
}
