const fs = require('fs');
const path = require('path');

const appsDir = path.join(__dirname, 'apps');
const apps = fs.readdirSync(appsDir).filter(name => {
  return fs.statSync(path.join(appsDir, name)).isDirectory() && 
         fs.existsSync(path.join(appsDir, name, 'Dockerfile'));
});

for (const app of apps) {
  if (app === 'admin-dashboard') continue; // Already manually fixed

  const dockerfilePath = path.join(appsDir, app, 'Dockerfile');
  let content = fs.readFileSync(dockerfilePath, 'utf8');

  // Regex to match the start of Stage 2 and all the COPY commands that we no longer need
  const stage2Regex = /# --- Stage 2: Build Next\.js application ---\s*FROM node:24-bookworm-slim AS builder\s*WORKDIR \/repo\s*COPY --from=deps \/repo\/node_modules \.\/node_modules\s*# Safely copy local node_modules if it exists \(for unhoisted packages like next\.js\)\s*COPY --from=deps \/repo\/apps\/[^\/]+\/node_module\[s\] \.\/apps\/[^\/]+\/node_modules\/\s*COPY package\.json yarn\.lock \.npmrc tsconfig\.json \.\/\s*COPY packages packages\s*COPY apps\/[^\s]+ apps\/[^\s]+/m;
  
  if (stage2Regex.test(content)) {
    // 1. Rename AS deps to AS builder
    content = content.replace(/AS deps/g, 'AS builder');
    
    // 2. Replace the Stage 2 boilerplate with just the source code copies
    content = content.replace(stage2Regex, 
`# Copy source code
COPY packages packages
COPY apps/${app} apps/${app}`);

    fs.writeFileSync(dockerfilePath, content);
    console.log(`Updated ${app}`);
  } else {
    console.log(`Skipped ${app} (pattern not matched)`);
  }
}
