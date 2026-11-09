import { describe, it, expect } from 'vitest'
import {
  ringkasUntukSuara,
  PILIHAN_SUARA_JARVIS,
  ekstrakKalimatAwalStreaming,
  ekstrakAntreanKalimatSuara,
} from './voiceHud'
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

  it('ringkasUntukSuara menangani tag <suara> yang belum tertutup saat streaming', () => {
    const streaming = '<suara>Siap Sir, total omzet hari ini mencapai Rp 25.000.000.'
    const ringkasan = ringkasUntukSuara(streaming)
    expect(ringkasan).toContain('25 juta rupiah')
    expect(ringkasan).not.toContain('<suara>')
  })

  it('ekstrakKalimatAwalStreaming mengekstrak kalimat pembuka utuh untuk streaming TTS', () => {
    // 1. Kalimat pembuka normal (> 28 karakter)
    const t1 = 'Selamat pagi Pak Luqman, penjualan cabang hari ini berjalan optimal. Seluruh outlet buka.'
    const k1 = ekstrakKalimatAwalStreaming(t1)
    expect(k1).toBe('Selamat pagi Pak Luqman, penjualan cabang hari ini berjalan optimal.')

    // 2. Kalimat pertama sangat pendek (misal greeting "Siap Sir!"), gabungkan sampai batas kedua
    const t2 = 'Siap Sir! Total penjualan hari ini mencapai 15 juta rupiah. Tebet memimpin.'
    const k2 = ekstrakKalimatAwalStreaming(t2)
    expect(k2).toBe('Siap Sir! Total penjualan hari ini mencapai 15 juta rupiah.')

    // 3. Hanya salam pendek tanpa kelanjutan belum cukup untuk trigger TTS mandiri
    const t3 = 'Baik Sir! '
    const k3 = ekstrakKalimatAwalStreaming(t3)
    expect(k3).toBeNull()

    // 4. Input kosong atau terlalu pendek
    expect(ekstrakKalimatAwalStreaming('')).toBeNull()
    expect(ekstrakKalimatAwalStreaming('Halo')).toBeNull()
  })

  it('mendukung 5 pilihan karakter suara (Brian, Andrew, Ardi, Ava/Friday, Gadis)', () => {
    expect(PILIHAN_SUARA_JARVIS.length).toBeGreaterThanOrEqual(5)
    expect(cariKonfigurasiSuara('brian').voiceName).toBe('en-US-BrianMultilingualNeural')
    expect(cariKonfigurasiSuara('ava').voiceName).toBe('en-US-AvaMultilingualNeural')
    expect(cariKonfigurasiSuara('ardi').voiceName).toBe('id-ID-ArdiNeural')
  })

  it('tidak menyisipkan kata kaku "tercatat" pada kalimat percakapan bertitik dua & membaca desimal juta/persen dengan natural', () => {
    const teks = 'Catatan kecil hari ini: cabang Condet naik 12,5% mencapai Rp 9.850.000, Sir!'
    const hasil = naturalisasiTeksSuara(teks)
    expect(hasil).not.toContain('tercatat')
    expect(hasil).toContain('9,85 juta rupiah')
    expect(hasil).toContain('12,5 persen')
    expect(hasil).not.toContain('!.')
  })

  it('ekstrakAntreanKalimatSuara menggabungkan sapaan pendek & memecah kalimat berikutnya secara paralel tanpa salah potong Rp. atau J.A.R.V.I.S.', () => {
    const partial =
      'Kabar baik, Sir. Sore ini J.A.R.V.I.S. memantau omzet berjalan Rp. 9.850.000 dari 22 cabang. Seluruh kru shift sore juga hadir tepat waktu di lapangan. Sementara untuk stok bahan sedang'
    const antreanSaatStream = ekstrakAntreanKalimatSuara(partial, false)
    expect(antreanSaatStream.length).toBe(2)
    expect(antreanSaatStream[0]).toContain('Kabar baik, Sir')
    expect(antreanSaatStream[0]).toContain('9,85 juta rupiah')
    expect(antreanSaatStream[1]).toContain('Seluruh kru shift sore juga hadir tepat waktu')

    const antreanSelesai = ekstrakAntreanKalimatSuara(partial + ' aman terkendali.', true)
    expect(antreanSelesai.length).toBe(3)
    expect(antreanSelesai[2]).toContain('Sementara untuk stok bahan sedang aman terkendali')
  })
})
