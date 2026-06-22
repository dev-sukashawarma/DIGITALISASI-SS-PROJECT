const { createServer } = require('http');
const path = require('path');
const appDir = path.join(__dirname, 'apps', 'admin-dashboard');
process.chdir(appDir);
const next = require('module').createRequire(appDir + '/package.json')('next');
const app = next({ dev: false, dir: appDir });
const handle = app.getRequestHandler();
app.prepare().then(() => {
  createServer((req, res) => handle(req, res)).listen(process.env.PORT || 3006, () => {
    console.log('Server listening on 3006');
  });
}).catch(err => {
    console.error('Crash during startup', err);
});
