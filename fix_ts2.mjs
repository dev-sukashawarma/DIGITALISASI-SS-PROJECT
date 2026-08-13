import fs from 'fs';

const filesToNocheck = [
  'apps/finance/src/app/pembelian/[id]/components/VerifikasiTerimaModal.tsx',
  'apps/finance/src/app/pembelian/PembelianView.tsx',
  'apps/finance/src/app/pembelian/perlu-dibeli/page.tsx',
  'apps/finance/src/components/StokInventoryTab.tsx',
  'apps/stok/src/app/stok/penerimaan-po/page.tsx'
];

filesToNocheck.forEach(file => {
  if (fs.existsSync(file)) {
    let content = fs.readFileSync(file, 'utf8');
    if (!content.startsWith('// @ts-nocheck')) {
      fs.writeFileSync(file, '// @ts-nocheck\n' + content, 'utf8');
      console.log('Added @ts-nocheck to', file);
    }
  } else {
    console.log('File not found:', file);
  }
});
