import { NextResponse } from 'next/server'
import { ambilSesi } from '@/lib/server/sesi'
import { ambilTelemetriNyata, formatRupiah, type TelemetriHariIni } from '@/lib/server/telemetriNyata'
import { kirimPesanTelegram, supabaseAdmin } from '@/lib/server/telegram'

export const dynamic = 'force-dynamic'

export interface JarvisActionItem {
  id: string
  level: 'critical' | 'warning' | 'optimal'
  divisi: 'SALES' | 'FINANCE' | 'OPERASIONAL' | 'HRD' | 'REVIEW'
  judul: string
  deskripsi: string
  perintahTindakLanjut: string
}

export interface DailyReportPayload {
  diambilAt: string
  jamWib: number
  modeRekomendasi: 'hari_ini' | 'kemarin'
  telemetri: TelemetriHariIni | null
  actionItems: JarvisActionItem[]
  narasiSuaraHariIni: string
  narasiSuaraKemarin: string
  teksLaporanHariIni: string
  teksLaporanKemarin: string
}

function bangunActionItems(t: TelemetriHariIni | null, jamWib: number): JarvisActionItem[] {
  if (!t) {
    return [
      {
        id: 'db-offline',
        level: 'warning',
        divisi: 'OPERASIONAL',
        judul: 'Sinkronisasi Telemetri Tertunda',
        deskripsi: 'Data real-time sedang dimuat ulang dari server database.',
        perintahTindakLanjut: 'Berikan status diagnostik sistem sekarang.',
      },
    ]
  }

  const items: JarvisActionItem[] = []

  // 1. Evaluasi Utang PO Overdue (Finance)
  const overdueRp = t.finance?.utangPo?.totalLewatJatuhTempo ?? 0
  if (overdueRp > 0) {
    const topSup = t.finance?.utangPo?.topSupplier?.[0]?.supplier || 'Supplier'
    items.push({
      id: 'fin-overdue',
      level: 'critical',
      divisi: 'FINANCE',
      judul: `Utang PO Lewat Jatuh Tempo: ${formatRupiah(overdueRp)}`,
      deskripsi: `Terdapat tagihan PO supplier yang sudah overdue (terbesar: ${topSup}). Segera jadwalkan settlement pembayaran.`,
      perintahTindakLanjut: 'Rincikan semua utang PO supplier yang sudah lewat jatuh tempo beserta nomor PO-nya.',
    })
  }

  // 2. Evaluasi Void Order POS Hari Ini (Operasional / Loss Prevention)
  const voidCount = t.voidOrder?.totalVoidHariIni ?? 0
  const voidRp = t.voidOrder?.totalNilaiVoidHariIni ?? 0
  if (voidCount > 0) {
    const cabangVoid = t.voidOrder?.daftarOutletVoidHariIni?.map((v) => v.outlet).slice(0, 3).join(', ') || 'Cabang'
    items.push({
      id: voidRp >= 50_000 ? 'ops-void-crit' : 'ops-void-warn',
      level: voidRp >= 50_000 ? 'critical' : 'warning',
      divisi: 'OPERASIONAL',
      judul: `${voidCount} Transaksi Void POS (${formatRupiah(voidRp)})`,
      deskripsi: `Pembatalan struk terdeteksi di ${cabangVoid}. Pastikan bukti pembatalan kasir telah diverifikasi Area Manager.`,
      perintahTindakLanjut: 'Tampilkan rincian audit transaksi void POS hari ini per cabang.',
    })
  }

  // 3. Evaluasi Cabang Belum Buka / 0 Transaksi
  const belumBukaCount = t.statusBuka?.totalBelumBuka ?? 0
  const nolTransaksiCount = t.outletsNolTransaksi.length
  if (jamWib >= 10 && nolTransaksiCount > 0) {
    const contohCabang = t.outletsNolTransaksi.slice(0, 3).map((o) => o.nama).join(', ')
    items.push({
      id: 'sales-zero',
      level: jamWib >= 13 ? 'critical' : 'warning',
      divisi: 'SALES',
      judul: `${nolTransaksiCount} Cabang Belum Mencatat Order Hari Ini`,
      deskripsi: `Cabang seperti ${contohCabang} masih Rp 0 transaksi (${belumBukaCount} belum buka shift kasir).`,
      perintahTindakLanjut: 'Cabang mana saja yang belum buka shift kasir atau masih nol transaksi hari ini?',
    })
  }

  // 4. Evaluasi Keterlambatan Kru Outlet (HRD)
  const telatCount = t.kehadiranTelat ?? 0
  if (telatCount > 0) {
    const topTelat = t.stafTelat?.[0]
    const ketTelat = topTelat ? `Terlama: ${topTelat.nama} (${topTelat.outlet}, ${topTelat.telatMenit} mnt).` : ''
    items.push({
      id: 'hrd-late',
      level: 'warning',
      divisi: 'HRD',
      judul: `${telatCount} Kru Cabang Terlambat Clock-In`,
      deskripsi: `Tingkat ketepatan waktu hari ini ${t.persenOnTime}%. ${ketTelat}`,
      perintahTindakLanjut: 'Siapa saja kru outlet yang datang terlambat atau izin/cuti hari ini?',
    })
  }

  // 5. Evaluasi Waste Bahan Baku (Loss Prevention)
  const wasteRp = t.waste?.totalEstKerugianRp ?? 0
  const topWasteBahan = t.waste?.topBahan?.[0]
  if (wasteRp > 0 && topWasteBahan) {
    items.push({
      id: 'ops-waste',
      level: wasteRp > 500_000 ? 'warning' : 'optimal',
      divisi: 'OPERASIONAL',
      judul: `Audit Waste 30 Hari: ${formatRupiah(wasteRp)}`,
      deskripsi: `Komoditas tertinggi: ${topWasteBahan.nama} (${topWasteBahan.totalQty} ${topWasteBahan.satuan}, alasan: ${topWasteBahan.alasanDominan}).`,
      perintahTindakLanjut: 'Analisis laporan waste bahan baku tertinggi beserta cabang penyumbangnya.',
    })
  }

  // 6. Evaluasi Ulasan Pelanggan (SukaReview)
  const ulasanNegatif = t.review?.ulasanNegatifTerbaru ?? []
  if (ulasanNegatif.length > 0) {
    const rev = ulasanNegatif[0]
    items.push({
      id: 'rev-neg',
      level: 'warning',
      divisi: 'REVIEW',
      judul: `Alert Ulasan ⭐${rev.rating} di ${rev.outlet}`,
      deskripsi: `"${rev.komentar.slice(0, 90)}${rev.komentar.length > 90 ? '...' : ''}" — Oleh ${rev.reviewer}.`,
      perintahTindakLanjut: 'Tampilkan ulasan negatif pelanggan terbaru dan rekomendasi perbaikannya.',
    })
  }

  if (items.length === 0) {
    items.push({
      id: 'all-optimal',
      level: 'optimal',
      divisi: 'SALES',
      judul: 'Seluruh Indikator Operasional Optimal',
      deskripsi: 'Tidak ada anomali kritis pada POS, kasir, presensi kru, maupun rantai pasok hari ini.',
      perintahTindakLanjut: 'Berikan peringkat lengkap omzet seluruh cabang hari ini.',
    })
  }

  return items
}

function bangunNarasiSuara(t: TelemetriHariIni | null, mode: 'hari_ini' | 'kemarin', sapaanWaktu: string): string {
  if (!t) {
    return `Selamat ${sapaanWaktu}, Sir. Saat ini sistem sedang menyinkronkan telemetri database Suka Shawarma.`
  }

  if (mode === 'kemarin' && t.ringkasanKemarin) {
    const k = t.ringkasanKemarin
    const top1 = k.outletsAktifTransaksi[0]
    const topTeks = top1 ? `Cabang tertinggi diraih oleh ${top1.nama} dengan ${formatRupiah(top1.omzet)}.` : ''
    const opexHariIni = t.finance?.pengeluaranHariIni?.totalNominal ?? 0
    return (
      `Selamat ${sapaanWaktu}, Sir. Berikut evaluasi penutupan penuh kemarin: ` +
      `Total omzet jaringan mencapai ${formatRupiah(k.omzetTotal)} dari ${k.totalOrder} transaksi di ${k.outletsAktifTransaksi.length} cabang aktif. ` +
      `${topTeks} ` +
      `Untuk progres hari ini, tercatat omzet berjalan ${formatRupiah(t.omzetTotal)} dengan ketepatan presensi kru ${t.persenOnTime} persen ` +
      `dan pengeluaran operasional ${formatRupiah(opexHariIni)}. Seluruh modul siap menerima instruksi Anda, Sir.`
    )
  }

  const top1 = t.outletsAktifTransaksi[0]
  const topTeks = top1 ? `Peringkat pertama dipimpin oleh ${top1.nama} senilai ${formatRupiah(top1.omzet)}.` : 'Saat ini cabang sedang memulai transaksi.'
  const voidCount = t.voidOrder?.totalVoidHariIni ?? 0
  const voidTeks = voidCount > 0 ? `Terdapat ${voidCount} transaksi void yang perlu ditinjau.` : 'Audit kasir bersih tanpa void.'
  return (
    `Selamat ${sapaanWaktu}, Sir. Laporan eksekutif live hari ini: ` +
    `Total omzet berjalan mencapai ${formatRupiah(t.omzetTotal)} dari ${t.totalOrder} transaksi di ${t.outletsAktifTransaksi.length} cabang aktif. ` +
    `${topTeks} ` +
    `Kehadiran kru tepat waktu ${t.persenOnTime} persen, dan ${voidTeks} Ada divisi yang ingin Anda bedah lebih dalam, Sir?`
  )
}

function bangunTeksTelegram(t: TelemetriHariIni, mode: 'hari_ini' | 'kemarin', actionItems: JarvisActionItem[]): string {
  const isKemarin = mode === 'kemarin' && t.ringkasanKemarin
  const sales = isKemarin ? t.ringkasanKemarin! : {
    tanggalLabel: `Hari Ini (${t.tanggalWIB})`,
    omzetTotal: t.omzetTotal,
    totalOrder: t.totalOrder,
    aov: t.aov,
    outletsAktifTransaksi: t.outletsAktifTransaksi,
    outletsNolTransaksi: t.outletsNolTransaksi,
  }

  const top5 = sales.outletsAktifTransaksi
    .slice(0, 5)
    .map((o, i) => `${i + 1}. **${o.nama}** — **${formatRupiah(o.omzet)}** (${o.orderCount} struk)`)
    .join('\n') || '• Belum ada transaksi tercatat'

  const menuTop3 = t.topMenu
    .slice(0, 3)
    .map((m, i) => `${i + 1}. **${m.nama}** — ${m.qty} porsi (${formatRupiah(m.omzet)})`)
    .join('\n') || '• Belum ada data menu'

  const expHariIni = t.finance?.pengeluaranHariIni?.totalNominal ?? 0
  const utangTotal = t.finance?.utangPo?.totalUtang ?? 0
  const utangOverdue = t.finance?.utangPo?.totalLewatJatuhTempo ?? 0
  const setoranHariIni = t.finance?.setoranKas?.inputHariIni?.totalNominal ?? 0
  const voidCount = t.voidOrder?.totalVoidHariIni ?? 0
  const voidRp = t.voidOrder?.totalNilaiVoidHariIni ?? 0
  const wasteRp = t.waste?.totalEstKerugianRp ?? 0

  const actionLines = actionItems
    .slice(0, 4)
    .map((a, i) => {
      const icon = a.level === 'critical' ? '🚨' : a.level === 'warning' ? '⚠️' : '✅'
      return `${i + 1}. ${icon} **[${a.divisi}] ${a.judul}**\n   _${a.deskripsi}_`
    })
    .join('\n')

  return [
    `⚡ **J.A.R.V.I.S. EXECUTIVE DAILY BRIEFING**`,
    `🗓️ **Periode Fokus:** ${sales.tanggalLabel}`,
    `━━━━━━━━━━━━━━━━━━━━━`,
    ``,
    `### 1. 📊 SALES & POS LEADERBOARD`,
    `- **Total Omzet:** **${formatRupiah(sales.omzetTotal)}**`,
    `- **Total Transaksi:** ${sales.totalOrder} struk (AOV: **${formatRupiah(sales.aov)}**)`,
    `- **Partisipasi Cabang:** ${sales.outletsAktifTransaksi.length} aktif / ${sales.outletsNolTransaksi.length} nol transaksi`,
    ``,
    `**Top 5 Cabang Tertinggi:**`,
    top5,
    ``,
    `**Top 3 Menu Terlaris Hari Ini:**`,
    menuTop3,
    ``,
    `### 2. 🛡️ OPERASIONAL, VOID & WASTE`,
    `- **Status Shift Kasir Hari Ini:** ${t.statusBuka?.totalBuka ?? 0} buka / ${t.statusBuka?.totalBelumBuka ?? 0} belum buka`,
    `- **Audit Void POS Hari Ini:** ${voidCount} transaksi (**${formatRupiah(voidRp)}**)`,
    `- **Estimasi Kerugian Waste (30 Hari):** **${formatRupiah(wasteRp)}** (${t.waste?.totalLaporan30Hari ?? 0} laporan)`,
    ``,
    `### 3. 👥 WORKFORCE & PRESENSI (HRD)`,
    `- **Kehadiran Kru Cabang:** ${t.kehadiranTotal} clock-in (**${t.persenOnTime}%** On-Time)`,
    `- **Terlambat / Cuti:** ${t.kehadiranTelat} terlambat, ${t.stafCutiIzin.length} izin/cuti`,
    ``,
    `### 4. 💰 TREASURY & FINANCE`,
    `- **OPEX / Kas Kecil Hari Ini:** **${formatRupiah(expHariIni)}** (${t.finance?.pengeluaranHariIni?.jumlahTransaksi ?? 0} transaksi)`,
    `- **Setoran Kas Direkap Hari Ini:** **${formatRupiah(setoranHariIni)}**`,
    `- **Utang PO Supplier Belum Lunas:** **${formatRupiah(utangTotal)}** (Overdue: **${formatRupiah(utangOverdue)}**)`,
    ``,
    `### 5. ⭐ CUSTOMER EXPERIENCE (SUKAREVIEW)`,
    `- **Rating Rata-rata:** **${t.review?.ratingRataRata ?? 4.8}⭐** (${t.review?.totalUlasan ?? 0} ulasan terpantau)`,
    ``,
    `### 🎯 AI EXECUTIVE ACTION ITEMS`,
    actionLines,
  ].join('\n')
}

function getJamWib(): { jam: number; sapaan: string } {
  const wib = new Date(Date.now() + 7 * 60 * 60 * 1000)
  const jam = wib.getUTCHours()
  const sapaan = jam < 11 ? 'pagi' : jam < 15 ? 'siang' : jam < 18 ? 'sore' : 'malam'
  return { jam, sapaan }
}

export async function GET(req: Request) {
  const g = await ambilSesi()
  if (!g.ok) {
    return NextResponse.json({ galat: 'Tidak punya akses.' }, { status: g.status })
  }

  const url = new URL(req.url)
  const force = url.searchParams.get('refresh') === '1'
  const telemetri = await ambilTelemetriNyata(force)
  const { jam, sapaan } = getJamWib()

  // Jika masih pagi (< 11 WIB) atau order hari ini masih sedikit sementara kemarin ramai, sorot Kemarin terlebih dulu
  const pilihKemarin =
    Boolean(telemetri?.ringkasanKemarin && telemetri.ringkasanKemarin.totalOrder > 0) &&
    (jam < 11 || (telemetri?.totalOrder ?? 0) < 5)

  const modeRekomendasi: 'hari_ini' | 'kemarin' = pilihKemarin ? 'kemarin' : 'hari_ini'
  const actionItems = bangunActionItems(telemetri, jam)
  const narasiSuaraHariIni = bangunNarasiSuara(telemetri, 'hari_ini', sapaan)
  const narasiSuaraKemarin = bangunNarasiSuara(telemetri, 'kemarin', sapaan)

  const teksLaporanHariIni = telemetri
    ? bangunTeksTelegram(telemetri, 'hari_ini', actionItems)
    : 'Data telemetri belum tersedia.'
  const teksLaporanKemarin = telemetri
    ? bangunTeksTelegram(telemetri, 'kemarin', actionItems)
    : 'Data telemetri belum tersedia.'

  const payload: DailyReportPayload = {
    diambilAt: new Date().toISOString(),
    jamWib: jam,
    modeRekomendasi,
    telemetri,
    actionItems,
    narasiSuaraHariIni,
    narasiSuaraKemarin,
    teksLaporanHariIni,
    teksLaporanKemarin,
  }

  return NextResponse.json(payload, { headers: { 'Cache-Control': 'no-store' } })
}

export async function POST(req: Request) {
  const g = await ambilSesi()
  if (!g.ok) {
    return NextResponse.json({ galat: 'Tidak punya akses.' }, { status: g.status })
  }

  const body = await req.json().catch(() => ({}))
  const mode: 'hari_ini' | 'kemarin' = body?.mode === 'kemarin' ? 'kemarin' : 'hari_ini'

  const telemetri = await ambilTelemetriNyata(false)
  if (!telemetri) {
    return NextResponse.json({ galat: 'Data telemetri database belum tersedia.' }, { status: 503 })
  }

  const { jam } = getJamWib()
  const actionItems = bangunActionItems(telemetri, jam)
  const teksLaporan = bangunTeksTelegram(telemetri, mode, actionItems)

  // Kumpulkan daftar chat_id Telegram eksekutif (Owner / Admin / Developer)
  const targets = new Set<string>()

  for (const envKey of ['TELEGRAM_OWNER_CHAT_ID', 'TELEGRAM_CHAT_ID']) {
    const val = process.env[envKey]
    if (val) {
      for (const cid of val.split(',')) {
        const clean = cid.trim()
        if (clean) targets.add(clean)
      }
    }
  }

  try {
    const admin = supabaseAdmin(5_000)
    const [{ data: links }, { data: whitelist }] = await Promise.all([
      admin
        .from('bot_telegram_links')
        .select('chat_id, outlet_staff!inner(role, status)')
        .in('outlet_staff.role', ['owner', 'admin', 'developer'])
        .eq('outlet_staff.status', 'active'),
      admin
        .from('bot_telegram_whitelist')
        .select('telegram_user_id')
        .eq('bot_slug', 'ceo')
        .eq('is_active', true),
    ])

    for (const row of (links || []) as Array<{ chat_id?: string }>) {
      if (row.chat_id) targets.add(String(row.chat_id).trim())
    }
    for (const row of (whitelist || []) as Array<{ telegram_user_id?: string }>) {
      if (row.telegram_user_id) targets.add(String(row.telegram_user_id).trim())
    }
  } catch (err) {
    console.warn('[jarvis-daily-report] Gagal memuat target chat dari DB:', err)
  }

  if (targets.size === 0) {
    return NextResponse.json(
      {
        ok: false,
        galat: 'Belum ada akun Telegram Owner/CEO yang tertaut. Hubungkan dulu di menu ikon lonceng Telegram.',
      },
      { status: 400 }
    )
  }

  let terkirimKe = 0
  let galatTerakhir = ''

  for (const chatId of targets) {
    try {
      await kirimPesanTelegram(chatId, teksLaporan, 'https://agents.sukashawarma.com', 'ceo')
      terkirimKe++
    } catch (e) {
      galatTerakhir = (e as Error)?.message || 'Gagal kirim ke Telegram'
    }
  }

  if (terkirimKe === 0) {
    return NextResponse.json(
      { ok: false, galat: `Gagal mengirim ke Telegram: ${galatTerakhir}` },
      { status: 502 }
    )
  }

  return NextResponse.json({
    ok: true,
    terkirimKe,
    ringkasanSuara: `Laporan Daily telah berhasil dikirim ke ${terkirimKe} kontak Telegram Eksekutif, Sir.`,
  })
}
