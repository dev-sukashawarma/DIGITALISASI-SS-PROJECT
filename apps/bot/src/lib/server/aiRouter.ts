/**
 * Klien AI Router (OpenAI-compatible) untuk inferensi J.A.R.V.I.S. berbasis live data.
 * Memanfaatkan model 9Router (misal cx/gpt-5.5) yang dikonfigurasi di lingkungan.
 */
import { buatPengurai } from '@/lib/hermes'
import { TelemetriHariIni, formatRupiah } from './telemetriNyata'

export interface PesanRiwayat {
  role: 'user' | 'assistant'
  content: string
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
  const model = process.env.AI_MODEL || 'cx/gpt-5.5'

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

    konteksData = `
TANGGAL OPERASIONAL (WIB): ${t.tanggalWIB}
TOTAL PENJUALAN KESELURUHAN: ${formatRupiah(t.omzetTotal)}
TOTAL TRANSAKSI ORDER: ${t.totalOrder} order
RATA-RATA ORDER (AOV): ${formatRupiah(t.aov)}
TOTAL CABANG AKTIF TERDATA: ${t.totalOutletAktif} cabang

PERINGKAT CABANG DENGAN TRANSAKSI HARI INI (${t.outletsAktifTransaksi.length} cabang):
${listTransaksi || '(Belum ada cabang bertransaksi)'}

CABANG / UNIT BELUM MENCATATKAN ORDER HARI INI (${t.outletsNolTransaksi.length} unit):
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

  const promptSistem = `
Anda adalah J.A.R.V.I.S., Chief Executive Command Centre AI untuk Suka Shawarma.
Anda bertugas mendampingi Bos/Owner dan manajemen Suka Shawarma.

PANDUAN KOMUNIKASI & PERILAKU:
1. Panggil pengguna selalu dengan "Sir".
2. Bersikap sangat profesional, taktis, presisi, analitis, sigap, dan berorientasi data (seperti AI Command HUD Iron Man).
3. RESPON KONTEKSTUAL & PROPORSIONAL:
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

  const res = await fetch(`${base}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
    },
    body: JSON.stringify({
      model,
      stream: true,
      messages,
      temperature: 0.2,
    }),
    signal,
  })

  if (!res.ok || !res.body) {
    throw new Error(`AI Router HTTP ${res.status}`)
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
