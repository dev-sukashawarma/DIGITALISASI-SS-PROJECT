import { describe, it, expect } from 'vitest'
import { ringkasUntukSuara } from './voiceHud'
import { naturalisasiTeksSuara } from '@/app/api/voice/tts/route'

describe('voiceHud & naturalisasiTeksSuara', () => {
  it('mengubah format angka Rupiah menjadi kata jutaan/ribuan natural untuk TTS', () => {
    const teks = 'Total omzet J.A.R.V.I.S. hari ini mencapai Rp 42.500.000 dengan rata-rata Rp 150.000.'
    const hasil = naturalisasiTeksSuara(teks)
    expect(hasil).toContain('Jarvis')
    expect(hasil).toContain('42,5 juta rupiah')
    expect(hasil).toContain('150 ribu rupiah')
  })

  it('ringkasUntukSuara membuang tabel markdown dan menyisakan intisari eksekutif', () => {
    const markdown = [
      '### Laporan Penjualan Hari Ini',
      '> [!NOTE]',
      '> Total omzet cabang mencapai Rp 18.000.000 dari 22 cabang aktif.',
      '| No | Cabang | Omzet |',
      '| --- | --- | --- |',
      '| 1 | Tebet | Rp 3.500.000 |',
      '| 2 | Bintaro | Rp 2.900.000 |',
      'Seluruh stasiun POS berjalan optimal, Sir.',
    ].join('\n')

    const ringkasan = ringkasUntukSuara(markdown)
    expect(ringkasan).toContain('18 juta rupiah')
    expect(ringkasan).not.toContain('| Tebet |')
    expect(ringkasan).not.toContain('[!NOTE]')
  })
})
