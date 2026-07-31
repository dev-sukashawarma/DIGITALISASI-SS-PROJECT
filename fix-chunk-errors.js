const fs = require('fs');
const path = require('path');

const appsDir = path.join(__dirname, 'apps');
const apps = fs.readdirSync(appsDir);

const targetFiles = [];

for (const app of apps) {
  const appPath = path.join(appsDir, app);
  if (!fs.statSync(appPath).isDirectory()) continue;
  
  const possiblePaths = [
    path.join(appPath, 'src', 'app'),
    path.join(appPath, 'app')
  ];

  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      const errorTsx = path.join(p, 'error.tsx');
      const globalErrorTsx = path.join(p, 'global-error.tsx');
      if (fs.existsSync(errorTsx)) targetFiles.push(errorTsx);
      if (fs.existsSync(globalErrorTsx)) targetFiles.push(globalErrorTsx);
    }
  }
}

for (const file of targetFiles) {
  let content = fs.readFileSync(file, 'utf8');
  
  if (content.includes('ChunkLoadError')) {
    console.log(`Skipping (already fixed): ${file}`);
    continue;
  }

  // Very basic regex to find the component and insert useEffect
  // Need to add import { useEffect } from 'react' if not present
  if (!content.includes("import { useEffect }")) {
    content = content.replace(/(import .* from '@suka\/design-system')/, "$1\nimport { useEffect } from 'react'");
  }

  const hookCode = `  useEffect(() => {
    const isChunkLoadError = error?.name === 'ChunkLoadError' || error?.message?.includes('Failed to load chunk') || error?.message?.includes('Loading chunk failed')
    if (isChunkLoadError) {
      const reloadKey = 'chunk_error_reloaded'
      if (!sessionStorage.getItem(reloadKey)) {
        sessionStorage.setItem(reloadKey, 'true')
        window.location.reload()
      } else {
        sessionStorage.removeItem(reloadKey)
      }
    }
  }, [error])\n\n`;

  // Insert hook inside the component
  content = content.replace(/(export default function (?:Global)?Error\([^)]*\)\s*\{)/, `$1\n${hookCode}`);
  
  fs.writeFileSync(file, content, 'utf8');
  console.log(`Fixed: ${file}`);
}
