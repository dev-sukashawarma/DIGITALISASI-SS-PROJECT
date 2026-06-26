const fs = require('fs');
const path = require('path');
const glob = require('glob');

const files = glob.sync('{apps,packages}/*/package.json');
files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  content = content.replace(/"@suka\/([^"]+)": "\*"/g, '"@suka/$1": "workspace:*"');
  fs.writeFileSync(file, content);
  console.log('Updated', file);
});
