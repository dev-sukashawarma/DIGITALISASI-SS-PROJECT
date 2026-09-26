// @vitest-environment node
import { describe, it, expect, vi, afterEach } from 'vitest'
import fs from 'fs'
import os from 'os'
import path from 'path'

describe('dayGenerations', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'daygen-'))
  afterEach(() => { vi.restoreAllMocks(); vi.resetModules() })

  it('naik saat dibuang, tersimpan di disk, dan tetap berlaku setelah modul dimuat ulang (restart)', async () => {
    vi.spyOn(process, 'cwd').mockReturnValue(dir)
    const a = await import('./dayGenerations')
    expect(a.dayGeneration('2026-09-20')).toBe(0)
    a.bumpDayGenerations(['2026-09-20', '2026-09-21'])
    a.bumpDayGenerations(['2026-09-20'])
    expect(a.dayGeneration('2026-09-20')).toBe(2)
    expect(a.daysGeneration(['2026-09-19', '2026-09-20', '2026-09-21'])).toBe('0.2.1')

    // "Restart": muat ulang modul → nilai dibaca dari berkas, bukan memori.
    vi.resetModules()
    vi.spyOn(process, 'cwd').mockReturnValue(dir)
    const b = await import('./dayGenerations')
    expect(b.dayGeneration('2026-09-20')).toBe(2)
    expect(fs.existsSync(path.join(dir, '.next', 'cache', 'fetch-cache', 'report-day-generations.json'))).toBe(true)
  })

  it('berkas rusak tidak menggagalkan apa pun — mulai dari nol', async () => {
    const bad = fs.mkdtempSync(path.join(os.tmpdir(), 'daygen-bad-'))
    fs.mkdirSync(path.join(bad, '.next', 'cache', 'fetch-cache'), { recursive: true })
    fs.writeFileSync(path.join(bad, '.next', 'cache', 'fetch-cache', 'report-day-generations.json'), '{rusak')
    vi.spyOn(process, 'cwd').mockReturnValue(bad)
    const m = await import('./dayGenerations')
    expect(m.dayGeneration('2026-09-20')).toBe(0)
  })
})
