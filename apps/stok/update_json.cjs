const fs = require('fs')

const path = 'bahan_baku.json'
const rawData = fs.readFileSync(path)
let data = JSON.parse(rawData)

// Delete 'test'
data = data.filter(item => item.nama.toLowerCase() !== 'test')

// Update categories
data.forEach(item => {
  if (['CUP', 'TUTUP', 'SEDOTAN', 'STIKER'].includes(item.nama.toUpperCase())) {
    item.kategori = 'minuman'
  }
})

fs.writeFileSync(path, JSON.stringify(data, null, 2))
console.log('Updated bahan_baku.json')
