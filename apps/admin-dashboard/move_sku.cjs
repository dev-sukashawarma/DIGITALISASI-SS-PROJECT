const fs = require('fs');
const path = require('path');

const filePath = path.resolve('d:/MIT/CLAUDE CODE PROJECT/SS DIGITAL PROJECT/apps/admin-dashboard/src/app/public/form-bahan-baku/page.tsx');
let content = fs.readFileSync(filePath, 'utf-8');

// The marker for the start of SKU section
const skuStart = '                {/* SKU / Variasi Kemasan */}';

// Find the exact indices
const startIdx = content.indexOf(skuStart);
if (startIdx === -1) throw new Error('Could not find SKU start');

const nextSection = '          {/* Slot Kecil */}';
const endIdx = content.indexOf(nextSection);
if (endIdx === -1) throw new Error('Could not find next section');

// Extract the SKU block
const skuBlock = content.slice(startIdx, endIdx);

// Remove the SKU block from its current location
content = content.slice(0, startIdx) + content.slice(endIdx);

// Now find where to insert it: Before "Foto Masing-masing Kemasan"
const targetStr = '              {/* Foto Masing-masing Kemasan */}';
const targetIdx = content.indexOf(targetStr);
if (targetIdx === -1) throw new Error('Could not find target insert location');

// Insert the SKU block
content = content.slice(0, targetIdx) + skuBlock + content.slice(targetIdx);

fs.writeFileSync(filePath, content, 'utf-8');
console.log('Successfully moved SKU section!');
