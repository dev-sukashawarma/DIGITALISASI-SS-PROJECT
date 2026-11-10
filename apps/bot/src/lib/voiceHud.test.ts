import { describe, it, expect, vi } from 'vitest'
import {
  ringkasUntukSuara,
  PILIHAN_SUARA_JARVIS,
  ekstrakKalimatAwalStreaming,
  ekstrakAntreanKalimatSuara,
  apakahPerangkatIos,
  buatStatusVadAwal,
  evaluasiFrameVad,
  mulaiMendengar,
  hentiMendengar,
  apakahSedangMendengar,
  aktifkanSesiPanggilanKontinu,
  matikanSesiPanggilanKontinu,
  apakahSesiPanggilanKontinuAktif,
  encodeWav16kBase64,
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

  it('evaluasiFrameVad peka terhadap suara pelan mikrofon iPhone (jarak tangan ~0.0065 RMS) dan otomatis kirim saat hening', () => {
    let t = 10_000
    const st = buatStatusVadAwal(t)

    // Kalibrasi ruangan hening (~0.0016 RMS) selama 5 frame
    for (let i = 0; i < 5; i++) {
      t += 45
      expect(evaluasiFrameVad(st, 0.0016, 0.004, t, 1200)).toBe('lanjut')
    }

    // Pengguna berbicara dengan jarak tangan di iPhone (~0.0068 RMS — di bawah ambang lama 0.012!)
    t += 45
    expect(evaluasiFrameVad(st, 0.0068, 0.019, t, 1200)).toBe('lanjut') // Frame ke-1
    t += 45
    expect(evaluasiFrameVad(st, 0.0072, 0.022, t, 1200)).toBe('mulai_bicara') // Frame ke-2 langsung terdeteksi!

    // Lanjut bicara selama ~500ms
    for (let i = 0; i < 10; i++) {
      t += 45
      expect(evaluasiFrameVad(st, 0.0075, 0.024, t, 1200)).toBe('lanjut')
    }

    // Pengguna selesai bicara -> hening selama 1250ms -> otomatis kirim!
    let aksiAkhir = 'lanjut'
    for (let i = 0; i < 30; i++) {
      t += 45
      aksiAkhir = evaluasiFrameVad(st, 0.0016, 0.003, t, 1200)
      if (aksiAkhir === 'kirim_suara') break
    }
    expect(aksiAkhir).toBe('kirim_suara')
  })

  it('evaluasiFrameVad tetap otomatis berhenti & kirim di ruangan bising (kafe/AC/mobil ~0.015 RMS)', () => {
    let t = 50_000
    const st = buatStatusVadAwal(t)

    // Kalibrasi noise ruangan ber-AC / kafe (~0.015 RMS) selama 20 frame (~900ms)
    for (let i = 0; i < 20; i++) {
      t += 45
      expect(evaluasiFrameVad(st, 0.015, 0.03, t, 1200)).toBe('lanjut')
    }
    expect(st.pernahBicara).toBe(false)

    // Pengguna bicara jelas di atas kebisingan latar (~0.055 RMS) selama 12 frame
    let mulaiTerdeteksi = false
    for (let i = 0; i < 12; i++) {
      t += 45
      const aksi = evaluasiFrameVad(st, 0.055, 0.14, t, 1200)
      if (aksi === 'mulai_bicara') mulaiTerdeteksi = true
    }
    expect(mulaiTerdeteksi).toBe(true)

    // Pengguna berhenti bicara -> audio turun kembali ke noise AC/kafe (~0.015 RMS, bukan 0!)
    let terkirim = false
    for (let i = 0; i < 32; i++) {
      t += 45
      const aksi = evaluasiFrameVad(st, 0.015, 0.03, t, 1200)
      if (aksi === 'kirim_suara') {
        terkirim = true
        break
      }
    }
    expect(terkirim).toBe(true)
  })

  it('evaluasiFrameVad menangani AudioContext suspended di iOS auto-loop (rms === 0 tepat nol) tanpa menggantung', () => {
    const st = buatStatusVadAwal(1000)
    let infoMuncul = false
    let autoKirim = false

    for (let i = 1; i <= 125; i++) {
      const aksi = evaluasiFrameVad(st, 0, 0, 1000 + i * 45, 1200)
      if (aksi === 'info_fallback_ios') infoMuncul = true
      if (aksi === 'kirim_suara') {
        autoKirim = true
        break
      }
    }
    expect(infoMuncul).toBe(true)
    expect(autoKirim).toBe(true)
  })

  it('hentiMendengar selalu memanggil onSelesai meskipun getUserMedia atau AudioContext.resume menggantung di iOS', async () => {
    const origWindow = (globalThis as any).window
    const origNav = globalThis.navigator

    const stopTrackSpy = vi.fn()
    let resolveGum: ((s: any) => void) | null = null

    ;(globalThis as any).window = {
      AudioContext: class {
        state = 'suspended'
        sampleRate = 48000
        // Simulasi bug iOS WebKit: ctx.resume() di luar user gesture menggantung selamanya!
        resume() {
          return new Promise<void>(() => {})
        }
        createBuffer() {
          return {}
        }
        createBufferSource() {
          return { connect() {}, start() {} }
        }
        createMediaStreamSource() {
          return { connect() {}, disconnect() {} }
        }
        createAnalyser() {
          return {
            fftSize: 512,
            getFloatTimeDomainData(buf: Float32Array) {
              buf.fill(0)
            },
          }
        }
        createScriptProcessor() {
          return { connect() {}, disconnect() {}, onaudioprocess: null }
        }
        createGain() {
          return { gain: { value: 0 }, connect() {}, disconnect() {} }
        }
        destination = {}
      },
    }

    Object.defineProperty(globalThis, 'navigator', {
      value: {
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1',
        platform: 'iPhone',
        maxTouchPoints: 5,
        mediaDevices: {
          getUserMedia: () =>
            new Promise((resolve) => {
              resolveGum = resolve
            }),
        },
      },
      configurable: true,
    })

    const onSelesai = vi.fn()
    const onHasil = vi.fn()

    // Skenario 1: User menekan tombol batal/kirim SAAT getUserMedia masih pending
    const ok = mulaiMendengar({ onHasil, onSelesai })
    expect(ok).toBe(true)
    expect(apakahSedangMendengar()).toBe(true)

    hentiMendengar(true)
    expect(apakahSedangMendengar()).toBe(false)
    expect(onSelesai).toHaveBeenCalledTimes(1)

    // Ketika getUserMedia akhirnya selesai terlambat, track mikrofon harus langsung dimatikan
    resolveGum!({ getTracks: () => [{ stop: stopTrackSpy }] })
    await new Promise((r) => setTimeout(r, 20))
    expect(stopTrackSpy).toHaveBeenCalledTimes(1)

    // Skenario 2: getUserMedia berhasil, namun ctx.resume() menggantung selamanya -> tidak boleh memblokir hentiMendengar!
    const onSelesai2 = vi.fn()
    Object.defineProperty(globalThis, 'navigator', {
      value: {
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1',
        platform: 'iPhone',
        maxTouchPoints: 5,
        mediaDevices: {
          getUserMedia: () =>
            Promise.resolve({
              getTracks: () => [{ stop: vi.fn() }],
            }),
        },
      },
      configurable: true,
    })

    mulaiMendengar({ onHasil: vi.fn(), onSelesai: onSelesai2 })
    await new Promise((r) => setTimeout(r, 230)) // Lewati batas 180ms resumeAudioContextDenganBatasWaktu
    hentiMendengar(false)
    await new Promise((r) => setTimeout(r, 30))
    expect(apakahSedangMendengar()).toBe(false)
    expect(onSelesai2).toHaveBeenCalledTimes(1)

    ;(globalThis as any).window = origWindow
    Object.defineProperty(globalThis, 'navigator', {
      value: origNav,
      configurable: true,
    })
  })

  it('aktifkanSesiPanggilanKontinu menjaga stream mikrofon tetap hidup antargiliran tanpa memanggil getUserMedia ulang di giliran ke-2+', async () => {
    const origWindow = (globalThis as any).window
    const origNav = globalThis.navigator

    const stopTrackSpy = vi.fn()
    const mockTrack = { readyState: 'live', enabled: true, stop: stopTrackSpy }
    const getUserMediaSpy = vi.fn(() =>
      Promise.resolve({
        getAudioTracks: () => [mockTrack],
        getTracks: () => [mockTrack],
      })
    )

    ;(globalThis as any).window = {
      AudioContext: class {
        state = 'running'
        sampleRate = 48000
        resume() {
          return Promise.resolve()
        }
        createBuffer() {
          return {}
        }
        createBufferSource() {
          return { connect() {}, start() {} }
        }
        createMediaStreamSource() {
          return { connect() {}, disconnect() {} }
        }
        createAnalyser() {
          return {
            fftSize: 512,
            getFloatTimeDomainData(buf: Float32Array) {
              buf.fill(0.002)
            },
          }
        }
        createScriptProcessor() {
          return { connect() {}, disconnect() {}, onaudioprocess: null }
        }
        createGain() {
          return { gain: { value: 0 }, connect() {}, disconnect() {} }
        }
        destination = {}
      },
    }

    Object.defineProperty(globalThis, 'navigator', {
      value: {
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1',
        platform: 'iPhone',
        maxTouchPoints: 5,
        mediaDevices: {
          getUserMedia: getUserMediaSpy,
        },
      },
      configurable: true,
    })

    // 1x Tap di awal: aktifkan sesi panggilan kontinu & mulai giliran ke-1
    aktifkanSesiPanggilanKontinu()
    expect(apakahSesiPanggilanKontinuAktif()).toBe(true)

    mulaiMendengar({ onHasil: vi.fn(), onSelesai: vi.fn() })
    await new Promise((r) => setTimeout(r, 30))
    expect(getUserMediaSpy).toHaveBeenCalledTimes(1)
    expect(stopTrackSpy).not.toHaveBeenCalled()

    // Giliran ke-1 selesai -> track mikrofon TIDAK dimatikan (hanya dibisukan sementara)
    hentiMendengar(false)
    await new Promise((r) => setTimeout(r, 20))
    expect(stopTrackSpy).not.toHaveBeenCalled()
    expect(mockTrack.enabled).toBe(false)

    // Giliran ke-2 (dipicu otomatis sesudah Jarvis menjawab, tanpa user gesture):
    // Langsung pakai stream yang sama TANPA memanggil getUserMedia ke-2 kalinya!
    mulaiMendengar({ onHasil: vi.fn(), onSelesai: vi.fn() })
    await new Promise((r) => setTimeout(r, 30))
    expect(getUserMediaSpy).toHaveBeenCalledTimes(1)
    expect(mockTrack.enabled).toBe(true)
    expect(stopTrackSpy).not.toHaveBeenCalled()

    // Saat user menekan AKHIRI (matikanSesiPanggilanKontinu), barulah mikrofon hardware ditutup penuh
    matikanSesiPanggilanKontinu()
    await new Promise((r) => setTimeout(r, 20))
    expect(apakahSesiPanggilanKontinuAktif()).toBe(false)
    expect(stopTrackSpy).toHaveBeenCalledTimes(1)

    ;(globalThis as any).window = origWindow
    Object.defineProperty(globalThis, 'navigator', {
      value: origNav,
      configurable: true,
    })
  })

  it('evaluasiFrameVad kebal terhadap lonjakan klik/pop awal mikrofon (rms 0.08 di frame 1) dan tetap peka mendengar ucapan normal', () => {
    let t = 20_000
    const st = buatStatusVadAwal(t)

    // Frame 1: Lonjakan klik mouse / DC pop mikrofon saat baru dibuka (rms = 0.08)
    expect(evaluasiFrameVad(st, 0.08, 0.2, t, 1100)).toBe('lanjut')

    // 3 frame hening ruangan normal (~0.002 RMS) -> noiseFloorRms langsung turun cepat!
    for (let i = 0; i < 3; i++) {
      t += 45
      expect(evaluasiFrameVad(st, 0.002, 0.005, t, 1100)).toBe('lanjut')
    }

    // Pengguna langsung bicara normal (~0.014 RMS — sebelumnya terbutakan oleh ambang 0.075!)
    t += 45
    expect(evaluasiFrameVad(st, 0.014, 0.035, t, 1100)).toBe('lanjut')
    t += 45
    expect(evaluasiFrameVad(st, 0.015, 0.038, t, 1100)).toBe('mulai_bicara')
  })

  it('ekstrakAntreanKalimatSuara mengirim klausa pertama lebih dini pada kalimat panjang berkoma secara 100% monoton tanpa memotong sapaan Sir/Bos', () => {
    const teksPenuh =
      'Bos, kemarin yang paling kuat itu **Mitra Cileungsi** dengan omzet kotor 4,6 juta, diikuti Empang di angka 3,7 juta dan Pamulang 3,6 juta. Cileungsi bawa 85 struk dengan rata-rata transaksi 54 ribu per nota.'

    // Pada karakter ke-90 (klausa pertama selesai + 4 huruf klausa berikutnya sudah masuk), chunk 0 langsung siap dikirim ke ElevenLabs!
    const saatStreamDini = ekstrakAntreanKalimatSuara(teksPenuh.slice(0, 90), false)
    expect(saatStreamDini.length).toBe(1)
    expect(saatStreamDini[0]).toContain('Mitra Cileungsi')
    expect(saatStreamDini[0]).toContain('4,6 juta')

    // Begitu stream selesai, chunk 0 tetap 100% identik (monoton) sehingga antrean tidak mengulang kalimat!
    const saatSelesai = ekstrakAntreanKalimatSuara(teksPenuh, true)
    expect(saatSelesai.length).toBe(3)
    expect(saatSelesai[0]).toBe(saatStreamDini[0])
    expect(saatSelesai[1]).toContain('diikuti Empang')

    // Pastikan ", Sir" pada kalimat panjang tidak dipotong sebelum kata "Sir"
    const denganSapaanSir =
      'Cabang paling rendah kemarin adalah **MITRA SENTUL**, Sir hanya Rp 772.000 dengan 16 struk. Jauh di bawah rata-rata.'
    const qSir = ekstrakAntreanKalimatSuara(denganSapaanSir, true)
    expect(qSir[0]).toContain('MITRA SENTUL, Sir')
  })

  it('encodeWav16kBase64 mempertahankan ucapan pelan iPhone (~0.003) setelah klik awal mikrofon', () => {
    // 2 detik pada 16kHz: klik awal (sampel 0..50 = 0.02), lalu bicara pelan (sampel 1000..28000 = 0.003)
    const buf = new Float32Array(32_000)
    for (let i = 0; i < 50; i++) buf[i] = 0.02
    for (let i = 1_000; i < 28_000; i++) buf[i] = i % 2 === 0 ? 0.003 : -0.003

    const b64 = encodeWav16kBase64([buf], 16_000)
    const raw = Buffer.from(b64, 'base64')
    // Header WAV 44 byte + ~29.880 sampel x 2 byte (~59.800 byte) -> tidak terpotong di klik awal!
    expect(raw.byteLength).toBeGreaterThan(50_000)
  })
})
