const fs = require('fs');
const path = require('path');

function search(dir, pattern) {
    if (dir.includes('node_modules') || dir.includes('.next') || dir.includes('dist')) return;
    const files = fs.readdirSync(dir);
    for (const f of files) {
        const full = path.join(dir, f);
        if (fs.statSync(full).isDirectory()) {
            search(full, pattern);
        } else if (full.endsWith('.ts') || full.endsWith('.tsx') || full.endsWith('.sql')) {
            const content = fs.readFileSync(full, 'utf8');
            if (content.includes(pattern)) {
                console.log(full);
            }
        }
    }
}
search('apps', 'process_transaction');
search('apps', 'checkout');
search('apps', 'rpc');
