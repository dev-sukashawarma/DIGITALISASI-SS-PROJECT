export interface OpsiSuaraJarvis {
  id: string
  label: string
  deskripsi: string
  gender: 'Pria' | 'Wanita'
  voiceName: string
  geminiVoice: string
  elevenLabsVoiceId?: string
  pitch: string
  rate: string
}

export const GEMINI_TTS_MODELS = [
  'gemini-3.1-flash-tts-preview',
  'gemini-2.5-flash-preview-tts',
  'gemini-2.5-pro-preview-tts',
  'gemini-3.8-flash-lite-tts',
  'gemini-3.8-flash-tts',
] as const

export const DAFTAR_SUARA_JARVIS: OpsiSuaraJarvis[] = [
  {
    id: 'brian',
    label: 'BRIAN / ALIF HD (Jarvis Conversational)',
    deskripsi: 'Suara AI Pria Bariton Luwes & Natural (ElevenLabs Alif / Brian HD)',
    gender: 'Pria',
    voiceName: 'en-US-BrianMultilingualNeural',
    geminiVoice: 'Puck',
    elevenLabsVoiceId: 'R2tdno8o9nwUiDvfnMIJ', // Alif - Premium & Professional
    pitch: '-2Hz',
    rate: '+3%',
  },
  {
    id: 'andrew',
    label: 'ANDREW / JANU HD (Warm Executive)',
    deskripsi: 'Suara AI Pria Hangat, Santai & Mengalir (ElevenLabs Janu / Andrew HD)',
    gender: 'Pria',
    voiceName: 'en-US-AndrewMultilingualNeural',
    geminiVoice: 'Charon',
    elevenLabsVoiceId: 'TIXYCOMzK2Vw9OZovSLs', // Janu – Calm Narrator
    pitch: '-1Hz',
    rate: '+4%',
  },
  {
    id: 'william',
    label: 'WILLIAM / DANIEL HD (Aksen Jarvis Klasik)',
    deskripsi: 'Suara AI Pria Elegan ala Butler J.A.R.V.I.S. (ElevenLabs Daniel / William HD)',
    gender: 'Pria',
    voiceName: 'en-AU-WilliamMultilingualNeural',
    geminiVoice: 'Orus',
    elevenLabsVoiceId: 'onwK4e9ZLuTAKqWW03F9', // Daniel - Classic British Butler
    pitch: '-2Hz',
    rate: '+4%',
  },
  {
    id: 'florian',
    label: 'FLORIAN / AKBAR HD (Deep Commander)',
    deskripsi: 'Suara AI Pria Berat & Berwibawa (ElevenLabs Akbar / Florian HD)',
    gender: 'Pria',
    voiceName: 'de-DE-FlorianMultilingualNeural',
    geminiVoice: 'Fenrir',
    elevenLabsVoiceId: 'JHVv68mDAV9BgIEbto2A', // PAK AKBAR ALATAS
    pitch: '-2Hz',
    rate: '+4%',
  },
  {
    id: 'remy',
    label: 'REMY / JEFRI HD (Smooth Analyst)',
    deskripsi: 'Suara AI Pria Halus & Tenang (ElevenLabs Jefri / Remy HD)',
    gender: 'Pria',
    voiceName: 'fr-FR-RemyMultilingualNeural',
    geminiVoice: 'Zephyr',
    elevenLabsVoiceId: '1ijzBXcD3AIVH8RGMcQd', // Jefri - Soft Explanatory
    pitch: '-1Hz',
    rate: '+4%',
  },
  {
    id: 'ava',
    label: 'F.R.I.D.A.Y. / VELORA HD (Wanita AI)',
    deskripsi: 'Suara AI Wanita Luwes & Ekspresif (ElevenLabs Velora / Ava HD)',
    gender: 'Wanita',
    voiceName: 'en-US-AvaMultilingualNeural',
    geminiVoice: 'Kore',
    elevenLabsVoiceId: 'TrU3igk19A4aIUi2GAA2', // Rara — Velora
    pitch: '+0Hz',
    rate: '+4%',
  },
  {
    id: 'emma',
    label: 'EMMA / RENATA HD (Wanita Hangat)',
    deskripsi: 'Suara AI Wanita Lembut & Natural (ElevenLabs Renata / Emma HD)',
    gender: 'Wanita',
    voiceName: 'en-US-EmmaMultilingualNeural',
    geminiVoice: 'Aoede',
    elevenLabsVoiceId: 'tkD44aBEYVXxC4GxZoBV', // Rara — Renata
    pitch: '+0Hz',
    rate: '+4%',
  },
  {
    id: 'ardi',
    label: 'ARDI / ALIF (Pria Indonesia)',
    deskripsi: 'Suara Pria Indonesia Formal & Tegas',
    gender: 'Pria',
    voiceName: 'id-ID-ArdiNeural',
    geminiVoice: 'Enceladus',
    elevenLabsVoiceId: 'R2tdno8o9nwUiDvfnMIJ', // Alif - Premium & Professional
    pitch: '-2Hz',
    rate: '+4%',
  },
  {
    id: 'gadis',
    label: 'GADIS / ANJANI (Wanita Indonesia)',
    deskripsi: 'Suara Wanita Indonesia Jernih & Ramah',
    gender: 'Wanita',
    voiceName: 'id-ID-GadisNeural',
    geminiVoice: 'Zephyr',
    elevenLabsVoiceId: '52LXmmR0nGnIcDs1TL3f', // Rara — Anjani
    pitch: '+0Hz',
    rate: '+5%',
  },
]

export const VOICE_DEFAULT = DAFTAR_SUARA_JARVIS[0]

export function cariKonfigurasiSuara(voiceId?: string): OpsiSuaraJarvis {
  if (!voiceId) return VOICE_DEFAULT
  const clean = voiceId.trim().toLowerCase()
  return (
    DAFTAR_SUARA_JARVIS.find(
      (v) => v.id === clean || v.voiceName.toLowerCase() === clean
    ) ?? VOICE_DEFAULT
  )
}

/**
 * Mengubah teks laporan/markdown yang kaku menjadi kalimat bahasa lisan/percakapan Indonesia yang natural
 * sehingga saat diucapkan terdengar seperti mengobrol langsung dengan asisten pribadi (bukan membaca teks laporan).
 */
export function naturalisasiTeksSuara(teks: string): string {
  if (!teks) return ''

  // 1. Jika ada blok khusus <suara>...</suara>, prioritaskan isi percakapan di dalamnya
  const matchSuara = teks.match(/<suara>([\s\S]*?)<\/suara>/i)
  const sumberTeks = (matchSuara ? matchSuara[1] : teks).replace(/<\/?suara>/gi, '')

  // 2. Bersihkan baris tabel, garis pemisah, dan judul-judul laporan yang kaku
  const baris = sumberTeks
    .split('\n')
    .map((b) => b.trim())
    .filter((b) => {
      if (!b) return false
      if (b.startsWith('|') && b.endsWith('|')) return false
      if (/^[-━═*]{3,}$/.test(b)) return false
      if (/^\[!(NOTE|WARNING|IMPORTANT|TIP|CAUTION)\]/i.test(b)) return false
      if (b.startsWith('📍') && b.includes('_Sumber:')) return false
      if (/^#{1,6}\s+/.test(b)) return false
      if (/^(?:\*\*|__)?(?:LAPORAN|RINGKASAN|EVALUASI|REKAPITULASI|DATA OPERASIONAL|RINCIAN|DAFTAR)\b[^:.\n]*[*_]*:?$/i.test(b)) {
        return false
      }
      return true
    })
    .map((b) => {
      let line = b
        .replace(/^#{1,6}\s+/, '')
        .replace(/^>\s*/, '')
        .replace(/^[-*•]\s+/, '')
        .replace(/^\d+\.\s+/, '')
        .replace(/\*\*/g, '')
        .replace(/__/g, '')
        .trim()

      // Hanya ubah label metrik kaku spesifik tanpa merusak kalimat percakapan biasa yang memakai titik dua
      line = line
        .replace(/^Total Omzet(?:\s+Jaringan)?\s*(Hari Ini|Kemarin)?\s*:\s*/i, 'Total omzet $1 ada di ')
        .replace(/^Total Penjualan(?:\s+Jaringan)?\s*(Hari Ini|Kemarin)?\s*:\s*/i, 'Total penjualan $1 mencapai ')
        .replace(/^Total(?:\s+Akumulasi)?\s+(?:Order|Transaksi)\s*(Hari Ini|Kemarin)?\s*:\s*/i, 'dengan total transaksi $1 sebanyak ')
        .replace(/^Rata-rata\s+(?:Order|Struk)(?:\s*\(AOV\))?\s*(Hari Ini|Kemarin)?\s*:\s*/i, 'dan rata-rata struk ')
        .replace(/^TEMUAN PENTING\s*:\s*/i, 'Catatan penting, ')
        .replace(/^PERINGATAN(?:\s+MIKROFON)?\s*:\s*/i, 'Perhatian, ')

      return line
    })

  // Gabungkan maksimal 5 baris pertama secara natural tanpa menumpuk tanda baca ganda (misal "?. ")
  let out = ''
  for (const line of baris.slice(0, 5)) {
    if (!line) continue
    if (!out) {
      out = line
    } else if (/[.!?,;:]$/.test(out)) {
      out += ' ' + line
    } else {
      out += '. ' + line
    }
  }

  out = out
    .replace(/\.\s*\./g, '.')
    // Ubah Rp X.XXX.XXX.XXX menjadi pengucapan lisan natural ("42,5 juta rupiah", "9,85 juta rupiah")
    .replace(/Rp\s?(\d{1,3}(?:\.\d{3})+)/gi, (_m, angkaStr: string) => {
      const n = Number(angkaStr.replace(/\./g, ''))
      if (isNaN(n) || n === 0) return 'nol rupiah'
      if (n >= 1_000_000_000) {
        const val = (n / 1_000_000_000).toFixed(2).replace(/\.00$/, '').replace(/(\.\d)0$/, '$1').replace('.', ',')
        return `${val} miliar rupiah`
      }
      if (n >= 1_000_000) {
        const val = (n / 1_000_000).toFixed(2).replace(/\.00$/, '').replace(/(\.\d)0$/, '$1').replace('.', ',')
        return `${val} juta rupiah`
      }
      if (n >= 1_000) {
        const val = Math.round(n / 1_000)
        return `${val} ribu rupiah`
      }
      return `${n} rupiah`
    })
    .replace(/(\d+(?:[.,]\d+)?)\s*%/g, '$1 persen')
    // Hilangkan titik ribuan pada angka non-Rupiah (misal 1.080 struk -> 1080 struk)
    .replace(/\b(\d{1,3})\.(\d{3})(?!\d)/g, '$1$2')
    .replace(/\(\s*(\d+\s*(?:struk|order|transaksi|cabang|outlet|PO|laporan|kru|ulasan)[^)]*)\)/gi, ', sekitar $1, ')
    .replace(/\bSUKA SHAWARMA\s+/gi, 'Cabang ')
    .replace(/\bCabang\s+Cabang\s+/gi, 'Cabang ')
    .replace(/\bBerikut adalah\b/gi, 'Ini')
    .replace(/\bBerikut rincian\b/gi, 'Ini rincian')
    .replace(/\bTidak terdapat\b/gi, 'Belum ada')
    .replace(/\bTercatat sebesar\b/gi, 'ada di')
    .replace(/J\.A\.R\.V\.I\.S\.?/gi, 'Jarvis')
    .replace(/F\.R\.I\.D\.A\.Y\.?/gi, 'Friday')
    .replace(/\bAOV\b/g, 'rata-rata struk')
    .replace(/\bATV\b/g, 'rata-rata struk')
    .replace(/\bOPEX\b/gi, 'biaya operasional')
    .replace(/\bPOS\b/g, 'kasir')
    .replace(/\bHQ\b/g, 'Kantor Pusat')
    .replace(/\bQRIS\b/gi, 'kris')
    .replace(/\bWIB\b/g, '')
    .replace(/[#*_`~>|\[\]()]/g, ' ')
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, ' ')
    .replace(/\s+([,.!?])/g, '$1')
    .replace(/,\s*,/g, ',')
    .replace(/\s+/g, ' ')
    .trim()

  if (out.length > 550) {
    const potong = out.slice(0, 550)
    const titikTerakhir = Math.max(potong.lastIndexOf('. '), potong.lastIndexOf('! '), potong.lastIndexOf('? '))
    if (titikTerakhir > 120) {
      out = potong.slice(0, titikTerakhir + 1)
    } else {
      out = potong + '.'
    }
  }

  return out
}
