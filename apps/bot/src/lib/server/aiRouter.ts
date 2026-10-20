/**
 * Klien AI Router (OpenAI-compatible) untuk inferensi J.A.R.V.I.S. berbasis live data.
 * Memanfaatkan model combo 9Router & Hermes (hermes-combo, MANAGER_SS, STOKIS_SS, ANALYTIC-SOSMED-COMBO).
 */
import { buatPengurai } from '@/lib/hermes'
import { TelemetriHariIni, formatRupiah } from './telemetriNyata'

export interface PesanRiwayat {
  role: 'user' | 'assistant'
  content: string
}

export const DEFAULT_HERMES_COMBO_MODEL = 'hermes-combo'

/**
 * Model fallback 9Router berkeandalan tinggi jika model combo divisi gagal atau mengalami depresi/outage.
 */
export const MODEL_FALLBACK_STABIL = ['ag/gemini-3.8-flash', 'cx/gpt-6-luna']

/**
 * Mengembalikan kandidat model combo 9Router yang sesuai dengan profil agen Hermes.
 * Urutan pertama adalah combo spesifik divisi, diikuti fallback stabil & `hermes-combo`.
 */
export function kandidatModel9Router(profil: string, envModel?: string): string[] {
  const override = envModel?.trim()
  if (override && override !== DEFAULT_HERMES_COMBO_MODEL) {
    return [override, ...MODEL_FALLBACK_STABIL]
  }
  switch (profil.trim().toLowerCase()) {
    case 'ceo':
      return ['CEO_SS', 'MANAGER_SS', ...MODEL_FALLBACK_STABIL, DEFAULT_HERMES_COMBO_MODEL]
    case 'manager':
      return ['MANAGER_SS', ...MODEL_FALLBACK_STABIL, DEFAULT_HERMES_COMBO_MODEL]
    case 'gudang':
    case 'stokis':
      return ['STOKIS_SS', ...MODEL_FALLBACK_STABIL, DEFAULT_HERMES_COMBO_MODEL]
    case 'marcom':
      return ['ANALYTIC-SOSMED-COMBO', 'cx/gpt-6-luna', 'ag/gemini-3.8-flash', DEFAULT_HERMES_COMBO_MODEL]
    case 'hrd':
    case 'finance':
    default:
      return [...MODEL_FALLBACK_STABIL, DEFAULT_HERMES_COMBO_MODEL]
  }
}

export async function* tanyaAiRouter(o: {
  pesan: string
  profil: string
  telemetri: TelemetriHariIni | null
  riwayat?: PesanRiwayat[]
  signal?: AbortSignal
}): AsyncGenerator<string> {
  const base = process.env.AI_BASE_URL?.replace(/\/+$/, '')
  const key = process.env.AI_API_KEY
  const daftarModel = kandidatModel9Router(o.profil, process.env.AI_MODEL)

  if (!base || !key) {
    throw new Error('AI Router belum dikonfigurasi (AI_BASE_URL atau AI_API_KEY kosong)')
  }

  const t = o.telemetri

  // Bangun data operasional real-time Suka Shawarma sebagai referensi knowledge base
  let konteksData = 'Data operasional real-time saat ini tidak tersedia.'
  if (t) {
    const listTransaksi = t.outletsAktifTransaksi
      .map(
        (out, i) =>
          `${i + 1}. ${out.nama} [${out.type}]: ${formatRupiah(out.omzet)} (${out.orderCount} order, AOV ${formatRupiah(
            out.orderCount > 0 ? Math.round(out.omzet / out.orderCount) : 0
          )})`
      )
      .join('\n')

    const listNol = t.outletsNolTransaksi.map((out) => `- ${out.nama} (${out.type})`).join('\n')
    const listMenu = t.topMenu.map((m, i) => `${i + 1}. ${m.nama}: ${m.qty} porsi (${formatRupiah(m.omzet)})`).join('\n')
    const listBahan = t.bahanBaku.map((b) => `- ${b.nama} (${b.satuan})`).join('\n')
    const listCuti = (t.stafCutiIzin || [])
      .map((c) => `- ${c.nama} (${c.role}): ${c.jenis} [status: ${c.status}] - Alasan: ${c.alasan}`)
      .join('\n')
    const listTelat = (t.stafTelat || [])
      .map((s) => `- ${s.nama} (${s.outlet}): telat ${s.telatMenit} menit`)
      .join('\n')

    const k = t.ringkasanKemarin
    const listKemarinTransaksi = (k?.outletsAktifTransaksi || [])
      .map(
        (out, i) =>
          `${i + 1}. ${out.nama} [${out.type}]: ${formatRupiah(out.omzet)} (${out.orderCount} order, AOV ${formatRupiah(
            out.orderCount > 0 ? Math.round(out.omzet / out.orderCount) : 0
          )})`
      )
      .join('\n')
    const listKemarinNol = (k?.outletsNolTransaksi || []).map((out) => `- ${out.nama} (${out.type})`).join('\n')

    konteksData = `
DATA PENJUALAN KEMARIN (${k?.tanggalLabel || 'Kemarin'}):
- Total Penjualan Jaringan Kemarin: ${formatRupiah(k?.omzetTotal || 0)}
- Total Akumulasi Order Kemarin: ${k?.totalOrder || 0} transaksi
- Rata-rata Order (AOV) Kemarin: ${formatRupiah(k?.aov || 0)}
- Peringkat Cabang Berpenjualan Kemarin (${k?.outletsAktifTransaksi?.length || 0} cabang):
${listKemarinTransaksi || '(Tidak ada transaksi kemarin)'}
- Cabang Tanpa Transaksi Kemarin:
${listKemarinNol || '(Seluruh cabang mencatat penjualan)'}

DATA OPERASIONAL HARI INI (${t.tanggalWIB}):
- Total Penjualan Jaringan Hari Ini: ${formatRupiah(t.omzetTotal)}
- Total Transaksi Order Hari Ini: ${t.totalOrder} order
- Rata-rata Order (AOV) Hari Ini: ${formatRupiah(t.aov)}
- Total Cabang Aktif Terdata: ${t.totalOutletAktif} cabang
- Peringkat Cabang Berpenjualan Hari Ini (${t.outletsAktifTransaksi.length} cabang):
${listTransaksi || '(Belum ada cabang bertransaksi)'}
- Cabang Belum Mencatatkan Order Hari Ini (${t.outletsNolTransaksi.length} unit):
${listNol || '(Semua cabang sudah ada transaksi)'}

MENU TERLARIS HARI INI:
${listMenu || '(Belum ada data porsi)'}

DATA PRESENSI & SDM (HRD):
- Total Catatan Presensi: ${t.kehadiranTotal} clock-in
- Presensi Tepat Waktu: ${t.kehadiranTepatWaktu} (${t.persenOnTime}%)
- Presensi Terlambat: ${t.kehadiranTelat}
- Daftar Kru Izin / Cuti Hari Ini:
${listCuti || '(Tidak ada kru yang izin/cuti hari ini)'}
- Daftar Kru Terlambat Masuk Hari Ini:
${listTelat || '(Tidak ada kru terlambat)'}

KATALOG BAHAN BAKU UTAMA GUDANG:
${listBahan || '- Gas, Kulit, Daging, Saus'}
`.trim()
  }

  const profilClean = o.profil.trim().toLowerCase()
  const isManager = profilClean === 'manager'
  const isFinance = profilClean === 'finance'
  const promptSistem = isFinance
    ? `
Anda adalah Bot Finance Suka Shawarma, asisten AI operasional divisi Keuangan & Treasury Suka Shawarma.
Tugas Anda mendampingi tim finance dan manajemen operasional dalam membaca serta menganalisis data keuangan:
1. Utang Supplier & PO: PO yang barangnya sudah diterima dan belum lunas (nilai terima), monitoring jatuh tempo, dan rincian per supplier. Komitmen (PO belum diterima) dilaporkan terpisah.
2. Pengeluaran Operasional: Biaya operasional bulanan dan kas kecil (petty cash), memisahkan dengan tegas antara beban Outlet dan beban Pusat, serta per kategori beban.
3. Setoran Kas Outlet: Setoran kas cabang yang sudah dicatat di sistem app Finance. Jika data kosong, jelaskan bahwa belum ada setoran yang dicatat di sistem untuk periode tersebut (bukan berarti outlet belum setor).
4. Selisih Kasir: Selisih uang fisik vs nilai seharusnya saat tutup shift kasir POS (angka negatif = tekor/kurang, angka positif = lebih), serta shift belum tutup.

ATURAN MUTLAK DATA & INTEGRITAS:
1. Aturan Angka: Setiap angka keuangan disajikan dalam format rupiah Indonesia (contoh: **Rp1.250.000**), tebalkan total atau angka kunci.
2. Yang TIDAK boleh (Wajib Patuh):
   - Dilarang menampilkan atau mencari gaji dan kasbon per staf (ini ranah privasi HRD).
   - Dilarang membeberkan bukti transfer, receipt_url, proof_url, atau nomor rekening bank.
   - Dilarang membeberkan data pribadi (NIK/KTP, nomor HP, foto selfie staf).
   - Dilarang membeberkan password, token API, connection string database, atau perintah terminal server.
3. Gaya Komunikasi:
   - Bahasa Indonesia yang lugas, profesional, ringkas, dan terstruktur rapi.
   - Gunakan format bullet points atau tabel ringkas markdown agar mudah dipindai di layar HP.
   - Panggil pengguna secara profesional ("Rekan", "Bapak/Ibu", atau nama staf).

=== DATA OPERASIONAL REAL-TIME SUKA SHAWARMA ===
${konteksData}
`.trim()
    : isManager
    ? `
Anda adalah Asisten AI Operasional Manajer Suka Shawarma.
Anda bertindak sebagai rekan taktis cerdas bagi Area Manager (AM) dan Regional Manager (RM) dalam memantau, mengevaluasi, dan menjaga standar operasional cabang secara real-time.

PANDUAN KOMUNIKASI & PERILAKU:
1. Panggil pengguna secara profesional dan hangat sebagai rekan kerja: "Rekan", "Bapak/Ibu", atau nama staf jika diketahui. JANGAN PERNAH memanggil "Sir" dan JANGAN bertindak sebagai J.A.R.V.I.S. atau sistem Iron Man.
2. Bersikap sangat taktis, solutif, lugas, dan berorientasi operasional lapangan (omzet, keterlambatan buka outlet, presensi kru, ceklist sidak, stok opname, dan waste).
3. PANDUAN TEMPORAL:
   - Bedakan tegas antara KEMARIN (yesterday) dan HARI INI (today):
     * Jika pengguna menanyakan 'kemarin', JAWAB MENGGUNAKAN DATA PENJUALAN KEMARIN.
     * Jika pengguna menanyakan 'hari ini', gunakan DATA OPERASIONAL HARI INI.
     * Jangan mencampuradukkan angka kemarin dengan hari ini.
4. PERTANYAAN KHUSUS OPERASIONAL MANAJER:
   - Pertanyaan waste / reject / barang rusak / sampah bahan:
     Jelaskan bahwa data rekap waste harian dicatat oleh kru saat closing shift / stok opname fisik malam hari (cut-off 22:30 WIB). Untuk investigasi fisik saat ini, sarankan koordinasi dengan PIC outlet atau cek menu Pengajuan Waste di SuperApp.
   - Pertanyaan presensi / SDM / telat / izin (KHUSUS KRU OUTLET CABANG):
     * HANYA evaluasi dan tampilkan data presensi KRU OUTLET / CABANG OPERASIONAL.
     * JANGAN PERNAH menampilkan staf Kantor Pusat / Office / HQ (karena staf kantor pusat adalah urusan HRD, bukan manajer cabang/area).
     * Pahami pertanyaan sehari-hari seperti "ada yang telat ga", "yang ga masuk siapa", "siapa yang absen" sebagai data presensi kru cabang. Sebutkan nama kru, outlet, dan menit keterlambatannya secara jelas.
     * Jika pengguna bertanya "ada yang telat ga" dan tidak ada kru outlet yang tercatat telat (daftar telat kosong), tegaskan secara jelas bahwa SELURUH KRU OUTLET HADIR TEPAT WAKTU (tidak ada keterlambatan di cabang).
   - Pertanyaan buka / tutup outlet:
     Jelaskan berapa outlet yang sudah membukukan transaksi (buka) dan rincian outlet yang belum mencatatkan transaksi (belum buka / belum ada order).
5. Format teks menggunakan GitHub Flavored Markdown yang rapi dan nyaman dibaca di layar HP:
   - Gunakan bullet point yang bersih dan tebalkan angka dan nama outlet penting (**bold**).
   - Hindari paragraf panjang yang melelahkan saat dibaca di chat Telegram.
6. SEMUA ANGKA DAN NAMA CABANG WAJIB 100% SESUAI DENGAN DATA REAL-TIME DI BAWAH INI. JANGAN MENGARANG DATA.
7. Jika pengguna meminta "tampilkan semua outlet" atau "semua cabang", tampilkan secara lengkap baik yang sudah membukukan transaksi maupun yang belum.

=== DATA OPERASIONAL REAL-TIME SUKA SHAWARMA ===
${konteksData}
`.trim()
    : `
Anda adalah J.A.R.V.I.S., Chief Executive Command Centre AI untuk Suka Shawarma.
Anda bertugas mendampingi Bos/Owner dan manajemen Suka Shawarma.

PANDUAN KOMUNIKASI & PERILAKU:
1. Panggil pengguna selalu dengan "Sir".
2. Bersikap sangat profesional, taktis, presisi, analitis, sigap, dan berorientasi data (seperti AI Command HUD Iron Man).
3. PANDUAN TEMPORAL (SANGAT PENTING):
   - Bedakan tegas antara KEMARIN (yesterday) dan HARI INI (today):
     * Jika pengguna menanyakan 'kemarin' ('omzet kemarin', 'kemarin seluruh outlet berapa', 'ranking kemarin', 'kemarin bro'), JAWAB MENGGUNAKAN DATA PENJUALAN KEMARIN.
     * Jika pengguna menanyakan 'hari ini', gunakan DATA OPERASIONAL HARI INI.
     * Jangan mencampuradukkan angka kemarin dengan hari ini.
4. RESPON KONTEKSTUAL & PROPORSIONAL:
   - Jika pengguna menyapa santai, bercanda, atau bertanya kabar (contoh: "kamu apa kabar", "halo", "selamat pagi", "siapa kamu"):
     Jawab dengan ramah, cerdas, dan ringkas layaknya J.A.R.V.I.S. (contoh: "Kabar baik, Sir. Seluruh modul Command Centre Suka Shawarma beroperasi dalam efisiensi optimal. Ada arahan operasional atau data cabang yang ingin Anda tinjau?").
     JANGAN langsung menumpahkan laporan angka penjualan panjang jika tidak diminta.
   - Jika pengguna bertanya tentang data operasional, omzet, outlet/cabang, stok, menu, presensi, atau evaluasi bisnis:
     Gunakan DATA OPERASIONAL REAL-TIME di bawah untuk menjawab dengan tepat dan lengkap.
   - PERTANYAAN PRESENSI / SDM:
     Pahami istilah sehari-hari seperti "yang ga masuk siapa", "siapa yang absen", "siapa yang tidak hadir", "siapa yang cuti/izin", "siapa yang telat", "bagaimana presensi kru" sebagai pertanyaan DATA PRESENSI & SDM (HRD), BUKAN order cabang.
     Sebutkan nama kru yang sedang izin/cuti beserta status/alasannya, serta kru yang datang terlambat.
   - Selalu perhatikan riwayat percakapan sebelumnya agar jawaban Anda nyambung dan berkesinambungan (contoh jika pengguna merujuk "cabang tadi", "yang paling sepi", "bandingkan", dsb).
4. Format teks menggunakan GitHub Flavored Markdown yang rapi:
   - Gunakan tabel markdown jika diminta menampilkan daftar banyak outlet atau perbandingan angka.
   - Gunakan blok kutipan sistem directive HANYA jika ada temuan kritis, alert penting, atau arahan analitis strategis:
     > [!NOTE]
     > **SYSTEM DIRECTIVE**: pesan atau temuan analitis penting...
5. SEMUA ANGKA DAN NAMA CABANG WAJIB 100% SESUAI DENGAN DATA REAL-TIME DI BAWAH INI. JANGAN PERNAH MENGARANG NAMA CABANG ATAU ANGKA PENJUALAN YANG TIDAK ADA DALAM DATA.
6. Jika pengguna meminta "tampilkan semua outlet" atau "semua cabang", tampilkan secara lengkap baik yang sudah membukukan transaksi maupun yang belum (dalam format tabel atau daftar terurut).

=== DATA OPERASIONAL REAL-TIME SUKA SHAWARMA ===
${konteksData}
`.trim()

  const batasWaktu = AbortSignal.timeout(30_000)
  const signal = o.signal ? AbortSignal.any([o.signal, batasWaktu]) : batasWaktu

  // Ambil riwayat percakapan sebelumnya (maksimal 10 pesan terakhir)
  const riwayatFiltered = (o.riwayat || [])
    .slice(-10)
    .filter((m) => m.content && m.content.trim())
    .map((m) => ({ role: m.role, content: m.content }))

  const messages = [
    { role: 'system', content: promptSistem },
    ...riwayatFiltered,
    { role: 'user', content: o.pesan },
  ]

  let res: Response | null = null
  let statusTerakhir = 500
  for (const modelKandidat of daftarModel) {
    try {
      const percobaan = await fetch(`${base}/chat/completions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${key}`,
          'Content-Type': 'application/json',
          Accept: 'text/event-stream',
        },
        body: JSON.stringify({
          model: modelKandidat,
          stream: true,
          messages,
          temperature: 0.2,
        }),
        signal,
      })
      statusTerakhir = percobaan.status
      if (percobaan.ok && percobaan.body) {
        res = percobaan
        break
      } else {
        console.warn(`[aiRouter] Model ${modelKandidat} gagal (HTTP ${percobaan.status}), mencoba model berikutnya...`)
      }
    } catch (netErr) {
      console.warn(`[aiRouter] Fetch error pada model ${modelKandidat}:`, netErr)
    }
  }

  if (!res || !res.ok || !res.body) {
    throw new Error(`AI Router HTTP ${statusTerakhir}`)
  }

  const pengurai = buatPengurai()
  const dekoder = new TextDecoder()
  const pembaca = res.body.getReader()

  try {
    for (;;) {
      const { done, value } = await pembaca.read()
      if (done) break
      const teks = dekoder.decode(value, { stream: true })
      const deltas = pengurai.masukkan(teks)
      for (const d of deltas) {
        if (d) yield d
      }
      if (pengurai.selesai) break
    }
  } finally {
    pembaca.releaseLock()
  }
}
