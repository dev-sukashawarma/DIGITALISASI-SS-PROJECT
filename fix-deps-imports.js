const fs = require('fs');
const path = require('path');

const posKasirRoot = path.join(__dirname, 'apps/pos-kasir');
const adminDashboardRoot = path.join(__dirname, 'apps/admin-dashboard');

const filesToCopy = [
  { src: 'lib/order-source.ts', dest: 'src/lib/order-source.ts' }
];

// Copy files
filesToCopy.forEach(file => {
  const srcPath = path.join(posKasirRoot, file.src);
  const destPath = path.join(adminDashboardRoot, file.dest);
  
  if (fs.existsSync(srcPath)) {
    fs.copyFileSync(srcPath, destPath);
    console.log(`Copied ${file.src} to ${file.dest}`);
  } else {
    console.warn(`Warning: Could not find ${srcPath}`);
  }
});

const filesToUpdate = [
  'src/components/ZipUploadModal.tsx',
  'src/components/OrderSourceBadge.tsx',
  'src/components/BranchFilter.tsx',
  'src/components/BrandContext.tsx',
  'src/lib/admin-analytics.ts',
  'src/lib/validations.ts',
  'src/lib/order-item-name.ts',
  'src/lib/dialogStore.ts',
  'src/lib/order-source.ts'
];

filesToUpdate.forEach(file => {
  const fullPath = path.join(adminDashboardRoot, file);
  if (fs.existsSync(fullPath)) {
    let content = fs.readFileSync(fullPath, 'utf8');
    let originalContent = content;

    // Replace supabase import
    content = content.replace(/from\s+['"]@\/lib\/supabase\/client['"]/g, "from '@/lib/supabase'");
    
    // Replace types import
    content = content.replace(/from\s+['"]@\/types['"]/g, "from '@/pos-types'");
    content = content.replace(/from\s+['"]@\/types\/index['"]/g, "from '@/pos-types'");

    if (content !== originalContent) {
      fs.writeFileSync(fullPath, content);
      console.log(`Updated imports in ${fullPath}`);
    }
  }
});

console.log('Finished updating dependencies');
