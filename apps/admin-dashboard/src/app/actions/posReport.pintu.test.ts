import { readFileSync } from 'node:fs'
import { join } from 'node:path'

// Setiap ekspor berkas 'use server' = endpoint POST publik. Fungsi yang menerima
// cakupan dari pemanggil (laporanPosUntukScope) TIDAK boleh lewat sini.
const sumber = readFileSync(join(__dirname, 'posReport.ts'), 'utf8')

describe('posReport.ts = pintu server action', () => {
  it('hanya mengekspor empat fungsi yang memeriksa sesi', () => {
    const ekspor = [...sumber.matchAll(/export\s+async\s+function\s+(\w+)/g)].map((m) => m[1]).sort()
    expect(ekspor).toEqual(['getPosReport', 'getPosReportExport', 'invalidatePosReportDays', 'refreshPosReportRange'])
  })
  it('getPosReport & getPosReportExport selalu memanggil resolveCallerScope()', () => {
    for (const nama of ['getPosReport', 'getPosReportExport']) {
      const badan = sumber.split(`export async function ${nama}(`)[1]?.split('\nexport ')[0] ?? ''
      expect(badan).toContain('resolveCallerScope()')
    }
  })
  it('tidak ada fungsi bercakupan yang bocor ke berkas server action', () => {
    expect(sumber).not.toMatch(/export\s+(async\s+)?function\s+\w*UntukScope/)
  })
  it('tidak me-re-export tipe (transform server action menjadikannya ReferenceError)', () => {
    expect(sumber).not.toMatch(/^export\s+(type\s+)?\{/m)
    expect(sumber).not.toMatch(/^export\s+type\s/m)
  })
})
