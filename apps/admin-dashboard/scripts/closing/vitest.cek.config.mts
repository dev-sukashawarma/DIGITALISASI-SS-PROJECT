import path from 'path'
import { fileURLToPath } from 'url'

// Hanya untuk cek manual ke DB produksi (baca-saja). Tidak ikut `yarn test`.
const HERE = path.dirname(fileURLToPath(import.meta.url))
const APP = path.resolve(HERE, '../..')
export default {
  root: APP,
  test: { environment: 'node', include: ['scripts/closing/**/*.run.ts'], testTimeout: 600000 },
  resolve: { alias: { '@': path.resolve(APP, './src') } },
}
