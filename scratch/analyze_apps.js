const fs = require('fs');
const path = require('path');

const appsDir = path.join(__dirname, '../apps');
const apps = fs.readdirSync(appsDir).filter(f => fs.statSync(path.join(appsDir, f)).isDirectory() && f !== 'graphify-out');

const result = {};

for (const app of apps) {
  const appPath = path.join(appsDir, app);
  const info = {};
  
  // Package.json
  const pkgPath = path.join(appPath, 'package.json');
  if (fs.existsSync(pkgPath)) {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    info.deps = pkg.dependencies || {};
    info.scripts = pkg.scripts || {};
  }
  
  // .env files
  const envFiles = ['.env', '.env.local', '.env.example'];
  info.envs = [];
  for (const ef of envFiles) {
    const efp = path.join(appPath, ef);
    if (fs.existsSync(efp)) {
      const content = fs.readFileSync(efp, 'utf8');
      const vars = content.split('\n')
        .map(l => l.trim())
        .filter(l => l && !l.startsWith('#'))
        .map(l => l.split('=')[0]);
      info.envs.push(...vars);
    }
  }
  info.envs = [...new Set(info.envs)];

  // next config
  const nextConfigPathM = path.join(appPath, 'next.config.mjs');
  const nextConfigPath = path.join(appPath, 'next.config.js');
  const nextConfigPathT = path.join(appPath, 'next.config.ts');
  if (fs.existsSync(nextConfigPathM)) info.nextConfig = 'mjs';
  else if (fs.existsSync(nextConfigPath)) info.nextConfig = 'js';
  else if (fs.existsSync(nextConfigPathT)) info.nextConfig = 'ts';
  else info.nextConfig = 'none';
  
  // Dockerfile
  info.hasDockerfile = fs.existsSync(path.join(appPath, 'Dockerfile'));
  
  result[app] = info;
}

console.log(JSON.stringify(result, null, 2));
