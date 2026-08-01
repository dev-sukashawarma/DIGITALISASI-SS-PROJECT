const { createServer } = require('http');
const path = require('path');

const appDir = __dirname;
process.chdir(appDir);

const next = require('module').createRequire(path.join(appDir, 'package.json'))('next');
const app = next({ dev: false, dir: appDir });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  createServer((req, res) => handle(req, res)).listen(process.env.PORT || 3000, (err) => {
    if (err) throw err;
    console.log(`> Ready on port ${process.env.PORT || 3000}`);
  });
}).catch((err) => {
  console.error('Failed to prepare Next.js app:', err);
  process.exit(1);
});