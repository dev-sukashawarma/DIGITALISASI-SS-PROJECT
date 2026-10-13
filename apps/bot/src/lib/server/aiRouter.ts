/**
 * Klien AI Router (OpenAI-compatible) untuk inferensi J.A.R.V.I.S. berbasis live data.
 * Memanfaatkan model 9Router (misal cx/gpt-5.5) yang dikonfigurasi di lingkungan.
 */
import { buatPengurai } from '@/lib/hermes'
import { TelemetriHariIni, formatRupiah } from './telemetriNyata'

export async function* tanyaAiRouter(o: {
  pesan: string
  profil: string
  telemetri: TelemetriHariIni | null
  signal?: AbortSignal
}): AsyncGenerator<string> {
  const base = process.env.AI_BASE_URL?.replace(/\/+$/, '')
  const key = process.env.AI_API_KEY
  const model = process.env.AI_MODEL || 'cx/gpt-5.5'

  if (!base || !key) {
    throw new Error('AI Router belum dikonfigurasi (AI_BASE_URL atau AI_API_KEY kosong)')
  }

  const t = o.telemetri

  // Bangun prompt sistem dengan konteks operasional real-time Suka Shawarma
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

DATA PRESENSI & SDM:
- Total Catatan Presensi: ${t.kehadiranTotal} clock-in
- Presensi Tepat Waktu: ${t.kehadiranTepatWaktu} (${t.persenOnTime}%)
- Presensi Terlambat: ${t.kehadiranTelat}

KATALOG BAHAN BAKU UTAMA GUDANG:
${listBahan || '- Gas, Kulit, Daging, Saus'}
`.trim()
  }

  const promptSistem = `
Anda adalah J.A.R.V.I.S., Chief Executive Command Centre AI untuk Suka Shawarma.
Anda bertugas mendampingi Bos/Owner dan manajemen Suka Shawarma.

PANDUAN KOMUNIKASI:
1. Panggil pengguna dengan "Sir".
2. Bersikap sangat profesional, taktis, presisi, analitis, sigap, dan berorientasi data (seperti AI Command HUD Iron Man).
3. Format teks menggunakan GitHub Flavored Markdown yang rapi:
   - Gunakan tabel markdown jika diminta menampilkan daftar banyak outlet atau perbandingan angka.
   - Gunakan bullet points yang terstruktur.
   - Gunakan blok kutipan sistem directive untuk poin penting atau insight analitis:
     > [!NOTE]
     > **SYSTEM DIRECTIVE**: pesan atau temuan analitis penting...
4. SEMUA ANGKA DAN NAMA CABANG WAJIB 100% SESUAI DENGAN DATA REAL-TIME DI BAWAH INI. JANGAN PERNAH MENGARANG NAMA CABANG ATAU ANGKA PENJUALAN YANG TIDAK ADA DALAM DATA.
5. Jika pengguna meminta "tampilkan semua outlet" atau "semua cabang", tampilkan secara lengkap baik yang sudah membukukan transaksi maupun yang belum, dengan format tabel atau daftar terurut.

=== DATA OPERASIONAL REAL-TIME SUKA SHAWARMA ===
${konteksData}
`.trim()

  const batasWaktu = AbortSignal.timeout(30_000)
  const signal = o.signal ? AbortSignal.any([o.signal, batasWaktu]) : batasWaktu

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
      messages: [
        { role: 'system', content: promptSistem },
        { role: 'user', content: o.pesan },
      ],
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
