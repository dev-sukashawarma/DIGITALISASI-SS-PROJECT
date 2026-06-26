
const http = require('http');

const req = http.request({
  hostname: 'localhost',
  port: 3000,
  path: '/api/orders/sync-active',
  method: 'POST'
}, res => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => console.log('Response:', data));
});
req.on('error', e => console.error(e));
req.end();
