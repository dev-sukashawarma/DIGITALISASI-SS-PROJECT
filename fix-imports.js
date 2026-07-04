const fs = require('fs');
const path = require('path');

const posKasirRoot = path.join(__dirname, 'apps/pos-kasir');
const adminDashboardRoot = path.join(__dirname, 'apps/admin-dashboard');

const filesToCopy = [
  { src: 'types/index.ts', dest: 'src/pos-types.ts', isType: true },
  { src: 'lib/dialogStore.ts', dest: 'src/lib/dialogStore.ts' },
  { src: 'lib/validations.ts', dest: 'src/lib/validations.ts' },
  { src: 'lib/order-item-name.ts', dest: 'src/lib/order-item-name.ts' },
  { src: 'lib/admin-analytics.ts', dest: 'src/lib/admin-analytics.ts' },
  { src: 'components/ZipUploadModal.tsx', dest: 'src/components/ZipUploadModal.tsx' },
  { src: 'components/OrderSourceBadge.tsx', dest: 'src/components/OrderSourceBadge.tsx' },
  { src: 'components/BranchFilter.tsx', dest: 'src/components/BranchFilter.tsx' },
  { src: 'components/BrandContext.tsx', dest: 'src/components/BrandContext.tsx' }
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

// Update imports in pos-admin
const posAdminDir = path.join(adminDashboardRoot, 'src/app/dashboard/pos-admin');

function updateImports(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (let entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      updateImports(fullPath);
    } else if (fullPath.endsWith('.ts') || fullPath.endsWith('.tsx')) {
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
  }
}

updateImports(posAdminDir);
console.log('Successfully updated imports');
