import { describe, it, expect } from 'vitest'
import {
  ringkasUntukSuara,
  PILIHAN_SUARA_JARVIS,
  ekstrakKalimatAwalStreaming,
  ekstrakAntreanKalimatSuara,
  apakahPerangkatIos,
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

  it('mendukung pilihan karakter suara ElevenLabs Studio HD dengan fallback Indonesia konsisten', () => {
    expect(PILIHAN_SUARA_JARVIS.length).toBeGreaterThanOrEqual(5)
    expect(cariKonfigurasiSuara('brian').elevenLabsVoiceId).toBe('R2tdno8o9nwUiDvfnMIJ')
    expect(cariKonfigurasiSuara('brian').voiceName).toBe('id-ID-ArdiNeural')
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

  it('apakahPerangkatIos mengenali Safari iPhone dan Chrome iPhone (CriOS) dengan akurat', () => {
    const origNav = globalThis.navigator

    Object.defineProperty(globalThis, 'navigator', {
      value: {
        userAgent:
          'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/126.0.6478.108 Mobile/15E148 Safari/604.1',
        platform: 'iPhone',
        maxTouchPoints: 5,
      },
      configurable: true,
    })
    expect(apakahPerangkatIos()).toBe(true)

    Object.defineProperty(globalThis, 'navigator', {
      value: {
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126.0.0.0',
        platform: 'Win32',
        maxTouchPoints: 0,
      },
      configurable: true,
    })
    expect(apakahPerangkatIos()).toBe(false)

    Object.defineProperty(globalThis, 'navigator', {
      value: origNav,
      configurable: true,
    })
  })

  it('ekstrakAntreanKalimatSuara menjaga indeks kalimat tetap monoton saat abaikanBlokTagSuara aktif', () => {
    const awal =
      'Siap Bos, omzet cabang hari ini tembus Rp 42.000.000. Cabang Buah Batu memimpin di posisi puncak. Sementara stok'
    const akhirDenganSuara =
      awal + ' gudang aman terkendali. <suara>Ringkasan akhir yang muncul belakangan di mode teks.</suara>'

    const q1 = ekstrakAntreanKalimatSuara(awal, false, true)
    const q2 = ekstrakAntreanKalimatSuara(akhirDenganSuara, true, true)
    expect(q1.length).toBe(2)
    expect(q2.length).toBe(3)
    expect(q2[0]).toBe(q1[0])
    expect(q2[1]).toBe(q1[1])
    expect(q2[2]).not.toContain('Ringkasan akhir')
  })
})
