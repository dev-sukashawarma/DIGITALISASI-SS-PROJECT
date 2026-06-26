const fs = require('fs');
const glob = require('glob');

const files = glob.sync('{apps,packages}/*/package.json');
files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  content = content.replace(/"@serwist\/next": "\^10.0.0"/g, '"@serwist/next": "^9.0.11"');
  content = content.replace(/"serwist": "\^10.0.0"/g, '"serwist": "^9.0.11"');
  fs.writeFileSync(file, content);
  console.log('Fixed serwist version in', file);
});
