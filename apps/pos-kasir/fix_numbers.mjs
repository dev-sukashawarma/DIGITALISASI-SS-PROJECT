const fs = require('fs');

const files = [
  'app/kasir/order-manual/page.tsx',
  'app/kasir/shift/close/page.tsx',
  'app/kasir/shift/page.tsx',
  'components/kasir/WalkInCartPanel.tsx',
  'components/ZipUploadModal.tsx'
];

for (const f of files) {
  let content = fs.readFileSync(f, 'utf8');
  content = content.replace(/\.toLocaleString\('id-ID',\s*\{\s*timeZone:\s*'Asia\/Jakarta'\s*\}\)/g, ".toLocaleString('id-ID')");
  content = content.replace(/\.toLocaleString\('id-ID',\s*\{\s*timeZone:\s*'Asia\/Jakarta',\s*/g, ".toLocaleString('id-ID', { ");
  fs.writeFileSync(f, content);
  console.log("Fixed", f);
}
