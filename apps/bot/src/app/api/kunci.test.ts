import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

// Kunci Hermes (HERMES_*) & klien Hermes hanya boleh dipakai kode server.
function semuaBerkas(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n)
    return statSync(p).isDirectory() ? semuaBerkas(p) : [p]
  })
}
const src = join(__dirname, '..', '..')
const kode = semuaBerkas(src).filter((f) => /\.(ts|tsx)$/.test(f) && !f.endsWith('.test.ts'))

describe('kunci Hermes server-only', () => {
  it("berkas 'use client' tidak menyentuh HERMES_* atau lib/hermes", () => {
    for (const f of kode) {
      const isi = readFileSync(f, 'utf8')
      if (!/^['"]use client['"]/m.test(isi)) continue
      expect(isi, f).not.toMatch(/HERMES_|lib\/hermes/)
    }
  })
  it('tidak ada NEXT_PUBLIC_HERMES_* di kode', () => {
    for (const f of kode) expect(readFileSync(f, 'utf8'), f).not.toMatch(/NEXT_PUBLIC_HERMES/)
  })
})
