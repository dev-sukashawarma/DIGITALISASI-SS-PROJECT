import { describe, it, expect } from 'vitest'
import { ringkasUntukSuara, PILIHAN_SUARA_JARVIS } from './voiceHud'
import { naturalisasiTeksSuara, cariKonfigurasiSuara } from './ttsConfig'

describe('voiceHud & naturalisasiTeksSuara', () => {
  it('mengubah format angka Rupiah dan ribuan non-Rupiah menjadi kalimat lisan natural', () => {
    const teks =
      'Total omzet J.A.R.V.I.S. hari ini mencapai Rp 42.500.000 (1.080 struk) dengan rata-rata Rp 150.000.'
    const hasil = naturalisasiTeksSuara(teks)
    expect(hasil).toContain('Jarvis')
    expect(hasil).toContain('42,5 juta rupiah')
    expect(hasil).toContain('1080 struk')
    expect(hasil).not.toContain('1.080')
    expect(hasil).toContain('150 ribu rupiah')
  })

  it('ringkasUntukSuara membuang judul laporan kaku & tabel markdown lalu menyisakan obrolan natural', () => {
    const markdown = [
      '### Laporan Penjualan Hari Ini',
      'RINGKASAN EKSEKUTIF:',
      '> [!NOTE]',
      '> Siap Sir, total omzet cabang hari ini mencapai Rp 18.000.000 dari 22 cabang aktif.',
      '| No | Cabang | Omzet |',
      '| --- | --- | --- |',
      '| 1 | Tebet | Rp 3.500.000 |',
      '| 2 | Bintaro | Rp 2.900.000 |',
      'Seluruh stasiun kasir berjalan optimal, Sir.',
    ].join('\n')

    const ringkasan = ringkasUntukSuara(markdown)
    expect(ringkasan).toContain('18 juta rupiah')
    expect(ringkasan).not.toContain('Laporan Penjualan Hari Ini')
    expect(ringkasan).not.toContain('RINGKASAN EKSEKUTIF')
    expect(ringkasan).not.toContain('| Tebet |')
    expect(ringkasan).not.toContain('[!NOTE]')
  })

  it('mendukung 5 pilihan karakter suara (Brian, Andrew, Ardi, Ava/Friday, Gadis)', () => {
    expect(PILIHAN_SUARA_JARVIS.length).toBeGreaterThanOrEqual(5)
    expect(cariKonfigurasiSuara('brian').voiceName).toBe('en-US-BrianMultilingualNeural')
    expect(cariKonfigurasiSuara('ava').voiceName).toBe('en-US-AvaMultilingualNeural')
    expect(cariKonfigurasiSuara('ardi').voiceName).toBe('id-ID-ArdiNeural')
  })
})
