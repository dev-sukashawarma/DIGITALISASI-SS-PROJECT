const fs = require('fs');
let html = fs.readFileSync('kritik-saran.html', 'utf8');
const b64 = fs.readFileSync('logo_base64.txt', 'utf8');
html = html.replace('src="logo.png"', 'src="data:image/png;base64,' + b64 + '"');
fs.writeFileSync('kritik-saran.html', html);
console.log("Done");
