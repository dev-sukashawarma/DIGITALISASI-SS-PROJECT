# Membangkitkan ulang indeks aset Kantor Bot

`public/kantor/assets/asset-index.json` & `furniture-catalog.json` dibangkitkan SEKALI dari
manifest furnitur upstream memakai kode Pixel Agents sendiri (`core/src/assets/build.ts`
@3537e140). Ulangi hanya bila aset di `public/kantor/assets/` ditambah/diubah:

```bash
git clone --depth 1 https://github.com/pixel-agents-hq/pixel-agents.git <scratch>/pa
S=<scratch>/bangun && mkdir -p $S
cp <scratch>/pa/core/src/assets/{build,manifestUtils,types}.ts $S/
sed -i "s#\(from '\./[^']*\)\.js'#\1.ts'#" $S/*.ts
cat > $S/jalan.ts <<'X'
import { writeFileSync } from 'node:fs'
import { buildAssetIndex, buildFurnitureCatalog } from './build.ts'
const dir = process.argv[2]
writeFileSync(`${dir}/asset-index.json`, JSON.stringify(buildAssetIndex(dir), null, 2) + '\n')
writeFileSync(`${dir}/furniture-catalog.json`, JSON.stringify(buildFurnitureCatalog(dir), null, 2) + '\n')
X
node --experimental-strip-types $S/jalan.ts "$(pwd)/apps/bot/public/kantor/assets"
```
