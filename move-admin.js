const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, 'apps/pos-kasir/app/admin');
const destDir = path.join(__dirname, 'apps/admin-dashboard/src/app/dashboard/pos-admin');

// Create destination directory
if (!fs.existsSync(destDir)) {
  fs.mkdirSync(destDir, { recursive: true });
}

// Function to copy directory recursively
function copyDir(src, dest) {
  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (let entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.name === 'layout.tsx' && src === srcDir) {
      continue; // Skip the root layout.tsx
    }

    if (entry.isDirectory()) {
      if (!fs.existsSync(destPath)) {
        fs.mkdirSync(destPath, { recursive: true });
      }
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

copyDir(srcDir, destDir);
console.log('Successfully copied admin pages to pos-admin in admin-dashboard');
