import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { buildDynamicCatalog } from '@/kantor/engine/office/layout/furnitureCatalog'
import { migrateLayoutColors } from '@/kantor/engine/office/layout/layoutSerializer'
import { OfficeState } from '@/kantor/engine/office/engine/officeState'

const A = join(__dirname, '..', '..', 'public', 'kantor', 'assets')
const baca = (f: string) => JSON.parse(readFileSync(join(A, f), 'utf8'))

describe('engine kantor (porting)', () => {
  it('layout bawaan punya kursi & karakter mendapat kursi', () => {
    const katalog = baca('furniture-catalog.json') as Array<{ id: string; width: number; height: number }>
    const sprites = Object.fromEntries(katalog.map((e) => [e.id, Array.from({ length: e.height }, () => Array(e.width).fill(''))]))
    buildDynamicCatalog({ catalog: katalog as never, sprites })
    const os = new OfficeState(migrateLayoutColors(baca('default-layout-1.json')))
    expect(os.seats.size).toBeGreaterThanOrEqual(4)
    os.addAgent(11, 0, undefined, undefined, true)
    os.addAgent(22, 1, undefined, undefined, true)
    const ch = os.getCharacters()
    expect(ch.map((c) => c.id).sort()).toEqual([11, 22])
    expect(ch.every((c) => c.seatId)).toBe(true)
    os.setAgentActive(11, true)
    os.setAgentTool(11, 'rekap_absensi')
    os.update(0.1)
    // removeAgent memicu animasi despawn; karakter baru hilang setelah animasinya selesai.
    os.removeAgent(22)
    for (let i = 0; i < 100; i++) os.update(0.1)
    expect(os.getCharacters().map((c) => c.id)).toEqual([11])
  })
})
