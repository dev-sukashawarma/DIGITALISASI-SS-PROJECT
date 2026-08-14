const fs = require('fs');
const path = 'src/components/StaffForm.tsx';
let content = fs.readFileSync(path, 'utf8');

// The line looks like: {errors.name && <span ...>{errors..message as string}</span>}
// We want to capture 'name' and put it inside the braces.
content = content.replace(/\{errors\.([a-zA-Z0-9_]+) && (<span[^>]+>)\{errors\.\.message as string\}(<\/span>)\}/g, '{errors.$1 && $2{errors.$1?.message as string}$3}');

fs.writeFileSync(path, content);
console.log("Fixed StaffForm.tsx");
