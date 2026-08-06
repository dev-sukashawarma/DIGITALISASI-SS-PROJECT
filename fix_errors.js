const fs = require('fs');
const path = require('path');

function replaceInFile(filePath, regex, replacement) {
  if (fs.existsSync(filePath)) {
    let content = fs.readFileSync(filePath, 'utf8');
    content = content.replace(regex, replacement);
    fs.writeFileSync(filePath, content);
    console.log('Fixed:', filePath);
  } else {
    console.log('Not found:', filePath);
  }
}

// 1. error.tsx & global-error.tsx (remove useEffect)
const errorFiles = [
  'apps/distribusi/src/app/error.tsx',
  'apps/distribusi/src/app/global-error.tsx',
  'apps/owner-dashboard/src/app/error.tsx',
  'apps/owner-dashboard/src/app/global-error.tsx',
  'apps/portal/src/app/error.tsx',
  'apps/portal/src/app/global-error.tsx'
];
errorFiles.forEach(f => {
  replaceInFile(f, /import\s*\{\s*useEffect\s*\}\s*from\s*['"]react['"];?/g, '');
  replaceInFile(f, /,\s*useEffect\b/g, '');
});

// apps/finance
replaceInFile('apps/finance/src/app/petty-cash/components/FinancePettyCashList.tsx', /,\s*Building2\b/g, '');
replaceInFile('apps/finance/src/app/petty-cash/components/FinancePettyCashList.tsx', /,\s*relativeTime\b/g, '');
replaceInFile('apps/finance/src/components/CashLayout.tsx', /,\s*Sparkles\b/g, '');
replaceInFile('apps/finance/src/components/OutletRevenueTab.tsx', /,\s*AnimatePresence\b/g, '');
replaceInFile('apps/finance/src/components/OutletRevenueTab.tsx', /,\s*Download\b/g, '');
replaceInFile('apps/finance/src/components/OutletRevenueTab.tsx', /import\s*\{\s*AnimatePresence\s*\}\s*from\s*['"]framer-motion['"];?/g, '');

// apps/stok
replaceInFile('apps/stok/src/components/stok/OpnameForm.tsx', /,\s*role\b/g, '');
replaceInFile('apps/stok/src/components/stok/OpnameForm.tsx', /const\s*pendingApproval\s*=\s*[^;]+;/g, '');
replaceInFile('apps/stok/src/components/stok/OpnameForm.tsx', /const\s*\{\s*[^}]*\b(role)\b[^}]*\}\s*=\s*[^;]+;/g, (match) => {
    return match.replace(/,\s*role\b|\brole\s*,?/, '');
});


// apps/admin-dashboard
replaceInFile('apps/admin-dashboard/scripts/sync-july-google-sheets.ts', /import\s*\{\s*formatGoogleSheetsPayload\s*\}\s*from\s*[^;]+;/g, '');
replaceInFile('apps/admin-dashboard/scripts/sync-july-google-sheets.ts', /,\s*formatGoogleSheetsPayload\b/g, '');

replaceInFile('apps/admin-dashboard/src/app/actions/cancellations.ts', /import\s*\{\s*enforceAppAccess\s*\}\s*from\s*[^;]+;/g, '');
replaceInFile('apps/admin-dashboard/src/app/actions/cancellations.ts', /,\s*enforceAppAccess\b/g, '');
replaceInFile('apps/admin-dashboard/src/app/actions/cancellations.ts', /import\s*\{\s*headers\s*\}\s*from\s*['"]next\/headers['"];?/g, '');
replaceInFile('apps/admin-dashboard/src/app/actions/cancellations.ts', /,\s*headers\b/g, '');

replaceInFile('apps/admin-dashboard/src/app/developer/users/page.tsx', /,\s*ShieldAlert\b/g, '');
replaceInFile('apps/admin-dashboard/src/app/developer/users/page.tsx', /,\s*Save\b/g, '');
replaceInFile('apps/admin-dashboard/src/app/developer/users/page.tsx', /,\s*CheckCircle2\b/g, '');

replaceInFile('apps/admin-dashboard/src/components/developer/DeveloperHeader.tsx', /import\s*\{\s*motion\s*\}\s*from\s*['"]framer-motion['"];?/g, '');

replaceInFile('apps/admin-dashboard/src/utils/pdfExporter.ts', /\(e\)\s*=>/g, '() =>');

// Rename scratch files
const scratchFiles = [
  'apps/admin-dashboard/scratch_check_diff.ts',
  'apps/admin-dashboard/scratch_menu_check.ts',
  'apps/admin-dashboard/scratch_menu_check_2.ts'
];
scratchFiles.forEach(f => {
  if (fs.existsSync(f)) {
    fs.renameSync(f, f.replace('.ts', '.txt'));
    console.log('Renamed:', f);
  }
});
