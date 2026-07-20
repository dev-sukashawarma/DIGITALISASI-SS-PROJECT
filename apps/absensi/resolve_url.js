const https = require('https');

const url = 'https://maps.app.goo.gl/oxznbyFRDiLbRXKd8';

https.get(url, (res) => {
  console.log('Redirect Location:', res.headers.location);
}).on('error', (e) => {
  console.error(e);
});
