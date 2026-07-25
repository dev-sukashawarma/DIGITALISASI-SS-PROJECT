const fs = require('fs')
const path = require('path')

function searchGradients(dir) {
  const files = fs.readdirSync(dir)
  for (const f of files) {
    const full = path.join(dir, f)
    const stat = fs.statSync(full)
    if (stat.isDirectory()) {
      searchGradients(full)
    } else if (f.endsWith('.tsx') || f.endsWith('.ts') || f.endsWith('.css')) {
      const content = fs.readFileSync(full, 'utf8')
      if (content.includes('gradient')) {
        console.log(`Gradient found in: ${full}`)
        const lines = content.split('\n')
        lines.forEach((l, idx) => {
          if (l.includes('gradient')) console.log(`  L${idx+1}: ${l.trim()}`)
        })
      }
    }
  }
}

searchGradients('c:\\Users\\Creator MPB\\OneDrive\\Desktop\\New folder\\DIGITALISASI-SS-PROJECT\\apps\\admin-dashboard\\src\\app\\dashboard')
