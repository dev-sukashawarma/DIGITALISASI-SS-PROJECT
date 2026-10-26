import { NextResponse } from 'next/server'
import { ambilSesi } from '@/lib/server/sesi'
import { ambilTelemetriNyata, formatRupiah, type TelemetriHariIni } from '@/lib/server/telemetriNyata'
import {
  bangunSaranStrategisDivisi,
  formatBadgeTren,
  type SaranStrategisDivisi,
} from '@/lib/server/devSimulasi'
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
  actionItemsKemarin: JarvisActionItem[]
  actionItemsHariIni: JarvisActionItem[]
  saranStrategisKemarin: SaranStrategisDivisi[]
  saranStrategisHariIni: SaranStrategisDivisi[]
  narasiSuaraHariIni: string
  narasiSuaraKemarin: string
  teksLaporanHariIni: string
  teksLaporanKemarin: string
}

function bangunActionItems(
  t: TelemetriHariIni | null,
  jamWib: number,
  mode: 'kemarin' | 'hari_ini' = 'kemarin'
): JarvisActionItem[] {
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
  const isKemarin = mode === 'kemarin'

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

  // 2. Evaluasi Selisih Kasir & Rekonsiliasi Tutup Shift Kemarin (Finance H-1)
  if (isKemarin) {
    const selisihList = t.finance?.selisihKasir?.selisihKemarin?.length
      ? t.finance.selisihKasir.selisihKemarin
      : t.finance?.selisihKasir?.daftarSelisihTerbaru ?? []
    const minusList = selisihList.filter((s) => s.selisih < 0)
    if (minusList.length > 0) {
      const topMinus = minusList[0]
      items.push({
        id: 'fin-variance-kemarin',
        level: Math.abs(topMinus.selisih) >= 50_000 ? 'critical' : 'warning',
        divisi: 'FINANCE',
        judul: `Selisih Kasir Tutup Shift: ${formatRupiah(topMinus.selisih)} (${topMinus.outlet})`,
        deskripsi: `Ditemukan ${minusList.length} shift dengan selisih kas minus (Kasir: ${topMinus.kasir}, fisik ${formatRupiah(topMinus.fisik)} vs sistem ${formatRupiah(topMinus.seharusnya)}).`,
        perintahTindakLanjut: 'Tampilkan rincian selisih kasir tutup shift kemarin dan siapa kasir yang bertugas.',
      })
    }

    const belumDirekap = t.finance?.setoranKas?.tutupShiftKemarin?.belumDirekap ?? 0
    if (belumDirekap > 0) {
      const contohBelum = (t.finance?.setoranKas?.tutupShiftKemarin?.daftarBelumSetor ?? []).slice(0, 3).join(', ')
      items.push({
        id: 'fin-unreconciled-kemarin',
        level: 'warning',
        divisi: 'FINANCE',
        judul: `${belumDirekap} Shift Tutup Kemarin Belum Direkap Setorannya`,
        deskripsi: `Total kas fisik closing kemarin ${formatRupiah(t.finance?.setoranKas?.tutupShiftKemarin?.totalFisikKas ?? 0)}${contohBelum ? ` (belum setor: ${contohBelum})` : ''}.`,
        perintahTindakLanjut: 'Cabang mana saja yang sudah tutup shift kemarin tapi belum direkap setoran kasnya?',
      })
    }
  }

  // 3. Evaluasi Void Order POS (Kemarin vs Hari Ini)
  const voidCount = isKemarin
    ? (t.voidOrder?.totalVoidKemarin ?? 0)
    : (t.voidOrder?.totalVoidHariIni ?? 0)
  const voidRp = isKemarin
    ? (t.voidOrder?.totalNilaiVoidKemarin ?? 0)
    : (t.voidOrder?.totalNilaiVoidHariIni ?? 0)
  const voidDaftar = isKemarin
    ? (t.voidOrder?.daftarOutletVoidKemarin ?? [])
    : (t.voidOrder?.daftarOutletVoidHariIni ?? [])

  if (voidCount > 0) {
    const cabangVoid = Array.from(new Set(voidDaftar.map((v) => v.outlet))).slice(0, 3).join(', ') || 'Cabang'
    items.push({
      id: voidRp >= 50_000 ? 'ops-void-crit' : 'ops-void-warn',
      level: voidRp >= 50_000 ? 'critical' : 'warning',
      divisi: 'OPERASIONAL',
      judul: `${voidCount} Transaksi Void POS ${isKemarin ? 'Kemarin' : 'Hari Ini'} (${formatRupiah(voidRp)})`,
      deskripsi: `Pembatalan struk terdeteksi di ${cabangVoid}. Pastikan bukti pembatalan kasir telah diverifikasi Area Manager.`,
      perintahTindakLanjut: isKemarin
        ? 'Tampilkan rincian audit transaksi void POS kemarin per cabang.'
        : 'Tampilkan rincian audit transaksi void POS hari ini per cabang.',
    })
  }

  // 4. Evaluasi Cabang 0 Transaksi (Kemarin vs Hari Ini)
  if (isKemarin) {
    const nolKemarin = t.ringkasanKemarin?.outletsNolTransaksi ?? []
    if (nolKemarin.length > 0) {
      const contohCabang = nolKemarin.slice(0, 3).map((o) => o.nama).join(', ')
      items.push({
        id: 'sales-zero-kemarin',
        level: 'warning',
        divisi: 'SALES',
        judul: `${nolKemarin.length} Cabang Tercatat 0 Transaksi Kemarin`,
        deskripsi: `Cabang ${contohCabang} tidak mencatat transaksi POS sepanjang hari kemarin.`,
        perintahTindakLanjut: 'Cabang mana saja yang nol transaksi kemarin dan bagaimana peringkat penjualan kemarin?',
      })
    }
  } else {
    const belumBukaCount = t.statusBuka?.totalBelumBuka ?? 0
    const nolTransaksiCount = t.outletsNolTransaksi.length
    if (jamWib >= 10 && nolTransaksiCount > 0) {
      const contohCabang = t.outletsNolTransaksi.slice(0, 3).map((o) => o.nama).join(', ')
      items.push({
        id: 'sales-zero-today',
        level: jamWib >= 13 ? 'critical' : 'warning',
        divisi: 'SALES',
        judul: `${nolTransaksiCount} Cabang Belum Mencatat Order Hari Ini`,
        deskripsi: `Cabang seperti ${contohCabang} masih Rp 0 transaksi (${belumBukaCount} belum buka shift kasir).`,
        perintahTindakLanjut: 'Cabang mana saja yang belum buka shift kasir atau masih nol transaksi hari ini?',
      })
    }
  }

  // 5. Evaluasi Keterlambatan Kru Outlet (HRD Kemarin vs Hari Ini)
  const telatCount = isKemarin
    ? (t.hrdKemarin?.kehadiranTelat ?? 0)
    : (t.kehadiranTelat ?? 0)
  const onTimePct = isKemarin
    ? (t.hrdKemarin?.persenOnTime ?? 100)
    : (t.persenOnTime ?? 100)
  const listTelat = isKemarin
    ? (t.hrdKemarin?.stafTelat ?? [])
    : (t.stafTelat ?? [])

  if (telatCount > 0) {
    const topTelat = listTelat[0]
    const ketTelat = topTelat ? `Terlama: ${topTelat.nama} (${topTelat.outlet}, ${topTelat.telatMenit} mnt).` : ''
    items.push({
      id: 'hrd-late',
      level: 'warning',
      divisi: 'HRD',
      judul: `${telatCount} Kru Cabang Terlambat Clock-In ${isKemarin ? 'Kemarin' : 'Hari Ini'}`,
      deskripsi: `Tingkat ketepatan waktu ${isKemarin ? 'kemarin' : 'hari ini'} ${onTimePct}%. ${ketTelat}`,
      perintahTindakLanjut: isKemarin
        ? 'Siapa saja kru outlet yang datang terlambat atau izin/cuti kemarin?'
        : 'Siapa saja kru outlet yang datang terlambat atau izin/cuti hari ini?',
    })
  }

  // 6. Evaluasi Waste Bahan Baku (Loss Prevention)
  const wasteRp = t.waste?.totalEstKerugianRp ?? 0
  const wasteKemarinCount = t.waste?.laporanKemarinCount ?? 0
  const wasteKemarinRp = t.waste?.estKerugianKemarinRp ?? 0
  const topWasteBahan = t.waste?.topBahan?.[0]
  if (wasteRp > 0 && topWasteBahan) {
    items.push({
      id: 'ops-waste',
      level: wasteRp > 500_000 ? 'warning' : 'optimal',
      divisi: 'OPERASIONAL',
      judul:
        isKemarin && wasteKemarinCount > 0
          ? `Waste Kemarin: ${wasteKemarinCount} Laporan (${formatRupiah(wasteKemarinRp)})`
          : `Audit Waste 30 Hari: ${formatRupiah(wasteRp)}`,
      deskripsi: `Komoditas 30H tertinggi: ${topWasteBahan.nama} (${topWasteBahan.totalQty} ${topWasteBahan.satuan}, alasan: ${topWasteBahan.alasanDominan}).`,
      perintahTindakLanjut: 'Analisis laporan waste bahan baku tertinggi beserta cabang penyumbangnya.',
    })
  }

  // 7. Evaluasi Ulasan Pelanggan (SukaReview)
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

  // 8. Evaluasi Stok Kritis & Menipis (Gudang & Cabang)
  const kritisStok = (t.saldoStok || []).filter((s) => s.outletKritisCount > 0)
  if (kritisStok.length > 0) {
    const topKritis = kritisStok[0]
    items.push({
      id: 'stok-kritis',
      level: topKritis.outletKritisCount >= 3 ? 'critical' : 'warning',
      divisi: 'OPERASIONAL',
      judul: `Stok Kritis: ${topKritis.nama} Kosong di ${topKritis.outletKritisCount} Cabang`,
      deskripsi: `Sisa stok di gudang pusat: ${topKritis.stokGudangPusat} ${topKritis.satuan}. Total jaringan: ${topKritis.totalStokJaringan} ${topKritis.satuan}.`,
      perintahTindakLanjut: 'Tampilkan status stok bahan baku kritis dan cabang mana saja yang kehabisan.',
    })
  }

  // 9. Evaluasi Distribusi & Selisih Surat Jalan
  const dist = t.distribusi
  if (dist && dist.totalSuratJalanAdaSelisih > 0) {
    const sjSelisih = dist.daftarSuratJalanTerbaru.find((s) => s.adaSelisih)
    const catatan = sjSelisih?.rincianSelisih?.[0] || 'Terdapat perbedaan qty kirim vs terima'
    items.push({
      id: 'dist-selisih',
      level: 'warning',
      divisi: 'OPERASIONAL',
      judul: `${dist.totalSuratJalanAdaSelisih} Surat Jalan Pengiriman Ada Catatan Selisih/Rusak`,
      deskripsi: `Terbaru ke ${sjSelisih?.outlet || 'Cabang'}: ${catatan}.`,
      perintahTindakLanjut: 'Tampilkan audit surat jalan dan pengiriman yang mengalami selisih atau barang rusak.',
    })
  }

  // 10. Evaluasi Ceklist Harian & Sidak Area Manager (app manager)
  const ceklist = t.ceklistHarian
  if (ceklist && (ceklist.totalPerluPerhatianKemarin > 0 || ceklist.daftarTemuanTerbaru.length > 0)) {
    const temuan0 = ceklist.daftarTemuanTerbaru[0]
    items.push({
      id: 'mgr-sidak-temuan',
      level: temuan0?.nilaiTerburuk === 'buruk' ? 'critical' : 'warning',
      divisi: 'OPERASIONAL',
      judul: `Catatan Sidak AM di ${temuan0?.outlet || 'Cabang'} (${ceklist.totalSudahDicekKemarin} Cabang Disidak dari ${ceklist.totalOutletWajib} Jaringan)`,
      deskripsi: `${temuan0 ? `Oleh AM ${temuan0.namaAm}: ${temuan0.temuan[0] || `Status ${temuan0.nilaiTerburuk}`}.` : `${ceklist.totalPerluPerhatianKemarin} cabang butuh tindakan perbaikan.`}`,
      perintahTindakLanjut: 'Buat laporan evaluasi komprehensif kemarin (H-1) dari semua aplikasi beserta rekomendasi taktisnya.',
    })
  }

  // 11. Evaluasi Kasbon Kru Pending (app HR)
  const kasbonPending = t.kasbonHrd?.totalPendingCount ?? 0
  if (kasbonPending > 0) {
    items.push({
      id: 'hrd-kasbon-pending',
      level: 'warning',
      divisi: 'HRD',
      judul: `${kasbonPending} Pengajuan Kasbon Baru Menunggu Approval HR (${formatRupiah(t.kasbonHrd?.totalPendingNominal ?? 0)})`,
      deskripsi: `Belum cair (menunggu persetujuan). Selain itu terdapat ${t.kasbonHrd?.totalAktifCount ?? 0} kru dengan pinjaman kasbon berjalan yang sedang dicicil (sisa piutang ${formatRupiah(t.kasbonHrd?.totalSisaPiutang ?? 0)}).`,
      perintahTindakLanjut: 'Siapa saja kru outlet yang mengajukan kasbon atau izin/cuti terbaru?',
    })
  }

  if (items.length === 0) {
    items.push({
      id: 'all-optimal',
      level: 'optimal',
      divisi: 'SALES',
      judul: `Seluruh Indikator Operasional ${isKemarin ? 'Kemarin' : 'Hari Ini'} Optimal`,
      deskripsi: `Tidak ada anomali kritis pada POS, kasir, presensi kru, maupun rantai pasok ${isKemarin ? 'kemarin' : 'hari ini'}.`,
      perintahTindakLanjut: isKemarin
        ? 'Berikan peringkat lengkap omzet seluruh cabang kemarin.'
        : 'Berikan peringkat lengkap omzet seluruh cabang hari ini.',
    })
  }

  return items
}

function bangunNarasiSuara(t: TelemetriHariIni | null, mode: 'hari_ini' | 'kemarin', sapaanWaktu: string): string {
  if (!t) {
    return `Selamat ${sapaanWaktu}, Bos. Saat ini sistem sedang menyinkronkan telemetri database Suka Shawarma.`
  }

  if (mode === 'kemarin' && t.ringkasanKemarin) {
    const k = t.ringkasanKemarin
    const top1 = k.outletsAktifTransaksi[0]
    const topTeks = top1 ? `Cabang tertinggi dipimpin oleh ${top1.nama} dengan omzet ${formatRupiah(top1.omzet)}.` : ''
    const opexKemarin = t.finance?.pengeluaranKemarin?.totalNominal ?? 0
    const fisikKasKemarin = t.finance?.setoranKas?.tutupShiftKemarin?.totalFisikKas ?? 0
    const voidKemarinCount = t.voidOrder?.totalVoidKemarin ?? 0
    const hrdOnTimeKemarin = t.hrdKemarin?.persenOnTime ?? 100
    const hrdTelatKemarin = t.hrdKemarin?.kehadiranTelat ?? 0
    const infoLiveSingkat =
      t.omzetTotal > 0
        ? `Sementara untuk shift live hari ini, sudah masuk ${formatRupiah(t.omzetTotal)} dari ${t.totalOrder} struk.`
        : `Untuk shift hari ini baru mulai persiapan buka.`

    return (
      `Selamat ${sapaanWaktu}, Bos. Berikut evaluasi penutupan penuh kemarin tanggal ${k.tglIso}: ` +
      `Total omzet jaringan mencapai ${formatRupiah(k.omzetTotal)} dari ${k.totalOrder} struk di ${k.outletsAktifTransaksi.length} cabang aktif. ` +
      `${topTeks} ` +
      `Dari sisi keuangan kemarin, pengeluaran operasional tercatat ${formatRupiah(opexKemarin)} dan kas fisik tutup shift sebesar ${formatRupiah(fisikKasKemarin)}. ` +
      `Ketepatan presensi kru kemarin ${hrdOnTimeKemarin} persen dengan ${hrdTelatKemarin} kru terlambat, serta ${voidKemarinCount} transaksi void. ` +
      `${infoLiveSingkat} Ada cabang atau divisi yang ingin kita bedah, Bos?`
    )
  }

  const top1 = t.outletsAktifTransaksi[0]
  const topTeks = top1 ? `Peringkat pertama sementara dipimpin oleh ${top1.nama} senilai ${formatRupiah(top1.omzet)}.` : 'Saat ini cabang sedang memulai persiapan buka shift.'
  const voidCount = t.voidOrder?.totalVoidHariIni ?? 0
  const voidTeks = voidCount > 0 ? `Terdapat ${voidCount} transaksi void yang perlu ditinjau.` : 'Audit kasir bersih tanpa void.'
  return (
    `Selamat ${sapaanWaktu}, Bos. Laporan eksekutif live hari ini: ` +
    `Total omzet berjalan mencapai ${formatRupiah(t.omzetTotal)} dari ${t.totalOrder} struk di ${t.outletsAktifTransaksi.length} cabang aktif. ` +
    `${topTeks} ` +
    `Kehadiran kru tepat waktu ${t.persenOnTime} persen, dan ${voidTeks} Ada divisi yang ingin dibedah lebih dalam, Bos?`
  )
}

function bangunTeksTelegram(
  t: TelemetriHariIni,
  mode: 'hari_ini' | 'kemarin',
  actionItems: JarvisActionItem[],
  saranStrategis: SaranStrategisDivisi[]
): string {
  const isKemarin = mode === 'kemarin' && Boolean(t.ringkasanKemarin)
  const sales = isKemarin ? t.ringkasanKemarin! : {
    tanggalLabel: `Hari Ini (${t.tanggalWIB})`,
    omzetTotal: t.omzetTotal,
    omzetBersihTotal: t.ringkasanHariIni?.omzetBersihTotal ?? t.omzetTotal,
    potonganTotal: t.ringkasanHariIni?.potonganTotal ?? 0,
    totalHpp: t.ringkasanHariIni?.totalHpp ?? 0,
    labaKotorTotal: t.ringkasanHariIni?.labaKotorTotal ?? 0,
    totalPorsi: t.ringkasanHariIni?.totalPorsi ?? 0,
    totalOrder: t.totalOrder,
    aov: t.aov,
    outletsAktifTransaksi: t.outletsAktifTransaksi,
    outletsNolTransaksi: t.outletsNolTransaksi,
    menuTersepi: t.ringkasanHariIni?.menuTersepi ?? [],
  }

  const omzetBersih = sales.omzetBersihTotal ?? sales.omzetTotal
  const hppTotal = sales.totalHpp ?? 0
  const labaKotor = sales.labaKotorTotal ?? Math.max(0, omzetBersih - hppTotal)
  const marginPct = omzetBersih > 0 && labaKotor > 0 ? Math.round((labaKotor / omzetBersih) * 1000) / 10 : 0

  const tren = isKemarin ? t.trenHarian : undefined
  const badgeTrenOmzet = formatBadgeTren(tren?.deltaOmzetPersen, true)
  const badgeTrenOrder = formatBadgeTren(tren?.deltaOrderPersen, true)
  const badgeTrenOpex = formatBadgeTren(tren?.deltaOpexPersen, false)
  const badgeTrenWaste = formatBadgeTren(tren?.deltaWastePersen, false)

  const topMedals = ['🥇', '🥈', '🥉', '4.', '5.']
  const top5 = sales.outletsAktifTransaksi
    .slice(0, 5)
    .map((o, i) => `${topMedals[i] || `${i + 1}.`} <b>${o.nama}</b> — <code>${formatRupiah(o.omzet)}</code> (${o.orderCount} struk)`)
    .join('\n') || '• <i>Belum ada transaksi tercatat</i>'

  const menuSumber = isKemarin ? (t.topMenuKemarin ?? t.ringkasanKemarin?.topMenu ?? []) : t.topMenu
  const menuTop3 = menuSumber
    .slice(0, 3)
    .map((m, i) => `${i + 1}. <b>${m.nama}</b> — <code>${m.qty} porsi</code> (${formatRupiah(m.omzet)})`)
    .join('\n') || '• <i>Belum ada data menu</i>'

  const menuSepiSumber = (isKemarin ? t.ringkasanKemarin?.menuTersepi : t.ringkasanHariIni?.menuTersepi) ?? []
  const menuSepiTeks = menuSepiSumber.length > 0
    ? menuSepiSumber.slice(0, 2).map((m) => `<code>${m.nama}</code> (${m.qty} porsi)`).join(', ')
    : ''

  const expAktif = isKemarin
    ? (t.finance?.pengeluaranKemarin?.totalNominal ?? 0)
    : (t.finance?.pengeluaranHariIni?.totalNominal ?? 0)
  const expTxCount = isKemarin
    ? (t.finance?.pengeluaranKemarin?.jumlahTransaksi ?? 0)
    : (t.finance?.pengeluaranHariIni?.jumlahTransaksi ?? 0)
  const utangTotal = t.finance?.utangPo?.totalUtang ?? 0
  const utangOverdue = t.finance?.utangPo?.totalLewatJatuhTempo ?? 0
  const setoranAktif = isKemarin
    ? (t.finance?.setoranKas?.tutupShiftKemarin?.totalFisikKas ?? 0)
    : (t.finance?.setoranKas?.inputHariIni?.totalNominal ?? 0)
  const voidCount = isKemarin
    ? (t.voidOrder?.totalVoidKemarin ?? 0)
    : (t.voidOrder?.totalVoidHariIni ?? 0)
  const voidRp = isKemarin
    ? (t.voidOrder?.totalNilaiVoidKemarin ?? 0)
    : (t.voidOrder?.totalNilaiVoidHariIni ?? 0)
  const wasteRp = t.waste?.totalEstKerugianRp ?? 0
  const wasteKemarinRp = t.waste?.estKerugianKemarinRp ?? 0
  const hadirTotal = isKemarin ? (t.hrdKemarin?.kehadiranTotal ?? 0) : t.kehadiranTotal
  const hadirOnTime = isKemarin ? (t.hrdKemarin?.persenOnTime ?? 100) : t.persenOnTime
  const hadirTelat = isKemarin ? (t.hrdKemarin?.kehadiranTelat ?? 0) : t.kehadiranTelat
  const hadirCuti = isKemarin ? (t.hrdKemarin?.stafCutiIzin?.length ?? 0) : t.stafCutiIzin.length
  const labelPeriode = isKemarin ? 'Kemarin (H-1)' : 'Hari Ini'

  const ceklist = t.ceklistHarian
  const sudahCekCount = isKemarin
    ? (ceklist?.totalSudahDicekKemarin ?? t.totalOutletAktif)
    : (ceklist?.totalSudahDicekHariIni ?? 0)
  const wajibCekCount = ceklist?.totalOutletWajib ?? t.totalOutletAktif

  const actionLines = actionItems
    .slice(0, 4)
    .map((a) => {
      const icon = a.level === 'critical' ? '🚨' : a.level === 'warning' ? '⚠️' : '✅'
      return `<blockquote>${icon} <b>[${a.divisi}] ${a.judul}</b>\n<i>${a.deskripsi}</i></blockquote>`
    })
    .join('\n\n')

  const saranLines = saranStrategis
    .slice(0, 5)
    .map((s, idx) => {
      const poinUtama = s.poinSaran[0] || s.judul
      return `${idx + 1}. <b>[${s.divisi}]</b> ${poinUtama}`
    })
    .join('\n')

  return [
    `⚡ <b>J.A.R.V.I.S. EXECUTIVE DAILY BRIEFING</b>`,
    `🗓️ <b>Periode Fokus:</b> <code>${sales.tanggalLabel}</code>`,
    `━━━━━━━━━━━━━━━━━━━━━`,
    ``,
    `📊 <b>1. SALES, MARGIN & POS LEADERBOARD (${labelPeriode})</b>`,
    `• <b>Omzet Kotor / Net:</b> <code>${formatRupiah(sales.omzetTotal)}</code> / <code>${formatRupiah(omzetBersih)}</code>${badgeTrenOmzet}`,
    labaKotor > 0
      ? `• <b>Laba Kotor (Gross Profit):</b> <code>${formatRupiah(labaKotor)}</code> (Margin <b>${marginPct}%</b> | HPP: <code>${formatRupiah(hppTotal)}</code>)`
      : `• <b>Rata-Rata Struk (ATV):</b> <code>${formatRupiah(sales.aov)}</code>`,
    `• <b>Total Transaksi:</b> <code>${sales.totalOrder} Struk</code>${badgeTrenOrder} (${sales.outletsAktifTransaksi.length} Aktif / ${sales.outletsNolTransaksi.length} Nol Order)`,
    ``,
    `🏆 <b>Top Cabang Tertinggi:</b>`,
    top5,
    ``,
    `🥇 <b>Top 3 Menu Terlaris (${labelPeriode}):</b>`,
    menuTop3,
    ...(menuSepiTeks ? [`• <b>Menu Paling Sepi:</b> ${menuSepiTeks}`] : []),
    ``,
    `🛡️ <b>2. OPERASIONAL, SIDAK AM, VOID & WASTE (${labelPeriode})</b>`,
    isKemarin
      ? `• <b>Rekap Tutup Shift:</b> <code>${t.statusBuka?.shiftKemarinClosedCount ?? 0} Cabang Closed Shift</code>`
      : `• <b>Status Shift Kasir:</b> <code>${t.statusBuka?.totalBuka ?? 0} Buka / ${t.statusBuka?.totalBelumBuka ?? 0} Belum Buka</code>`,
    `• <b>Kunjungan Sidak AM:</b> <code>${sudahCekCount} Cabang Dikunjungi</code> dari ${wajibCekCount} jaringan${isKemarin ? ` (${ceklist?.totalPerluPerhatianKemarin ?? 0} catatan perhatian)` : ''}`,
    `• <b>Audit Void POS:</b> <code>${voidCount} Transaksi</code> (<code>${formatRupiah(voidRp)}</code>)`,
    isKemarin
      ? `• <b>Loss Prevention Waste:</b> Kemarin <code>${formatRupiah(wasteKemarinRp)}</code>${badgeTrenWaste} | 30H: <code>${formatRupiah(wasteRp)}</code> (${t.waste?.totalLaporan30Hari ?? 0} lap)`
      : `• <b>Loss Prevention Waste:</b> Hari Ini <code>${formatRupiah(t.waste?.estKerugianHariIniRp ?? 0)}</code> (${t.waste?.laporanHariIniCount ?? 0} lap) | 30H: <code>${formatRupiah(wasteRp)}</code> (${t.waste?.totalLaporan30Hari ?? 0} lap)`,
    ``,
    `👥 <b>3. WORKFORCE, PRESENSI & KASBON (${labelPeriode})</b>`,
    `• <b>Kehadiran Kru Cabang:</b> <code>${hadirTotal} Clock-in</code> (<b>${hadirOnTime}%</b> On-Time)`,
    `• <b>Terlambat / Izin:</b> <code>${hadirTelat} Terlambat</code>, <code>${hadirCuti} Izin/Cuti</code>`,
    ...(t.kasbonHrd && (t.kasbonHrd.totalPendingCount > 0 || t.kasbonHrd.totalAktifCount > 0)
      ? [`• <b>Kasbon Kru (HR):</b> <code>${t.kasbonHrd.totalPendingCount} Pengajuan Baru (Pending Approval)</code> (${formatRupiah(t.kasbonHrd.totalPendingNominal)}) | <code>${t.kasbonHrd.totalAktifCount} Pinjaman Berjalan (Dicicil)</code> (Sisa: ${formatRupiah(t.kasbonHrd.totalSisaPiutang)})`]
      : []),
    ``,
    `💰 <b>4. TREASURY & FINANCE (${labelPeriode})</b>`,
    `• <b>OPEX / Kas Kecil (${labelPeriode}):</b> <code>${formatRupiah(expAktif)}</code>${badgeTrenOpex} (${expTxCount} transaksi)`,
    isKemarin
      ? `• <b>Kas Fisik Closing:</b> <code>${formatRupiah(setoranAktif)}</code> (${t.finance?.setoranKas?.tutupShiftKemarin?.sudahDirekap ?? 0} direkap / ${t.finance?.setoranKas?.tutupShiftKemarin?.belumDirekap ?? 0} belum setor)`
      : `• <b>Setoran Kas Direkap:</b> <code>${formatRupiah(setoranAktif)}</code>`,
    `• <b>Utang PO Supplier:</b> <code>${formatRupiah(utangTotal)}</code> (Overdue: <code>${formatRupiah(utangOverdue)}</code>)`,
    ``,
    `⭐ <b>5. CUSTOMER EXPERIENCE (SUKAREVIEW)</b>`,
    `• <b>Rating Rata-rata:</b> <code>${t.review?.ratingRataRata ?? 4.8}⭐</code> (${t.review?.totalUlasan ?? 0} ulasan terpantau)`,
    ``,
    `📦 <b>6. LOGISTIK, DISTRIBUSI & STOK</b>`,
    t.distribusi
      ? `• <b>Pengiriman Surat Jalan:</b> <code>${t.distribusi.totalSuratJalanDikirim} Pengiriman</code> (${t.distribusi.totalSuratJalanAdaSelisih} catatan selisih/rusak)`
      : `• <b>Pengiriman Surat Jalan:</b> <i>Terpantau lancar</i>`,
    t.saldoStok && t.saldoStok.some((s) => s.outletKritisCount > 0)
      ? `• <b>Peringatan Stok Cabang:</b> ${t.saldoStok
          .filter((s) => s.outletKritisCount > 0)
          .map((s) => `<code>${s.nama}</code> (${s.outletKritisCount} cabang kosong)`)
          .slice(0, 3)
          .join(', ')}`
      : `• <b>Status Stok Jaringan:</b> <i>Seluruh bahan baku utama dalam ambang batas aman</i>`,
    ``,
    `━━━━━━━━━━━━━━━━━━━━━`,
    `🎯 <b>AI EXECUTIVE ACTION ITEMS:</b>`,
    actionLines,
    ``,
    `💡 <b>REKOMENDASI & SARAN STRATEGIS AGENT PER DIVISI:</b>`,
    saranLines,
    `━━━━━━━━━━━━━━━━━━━━━`,
    `🕒 <i>J.A.R.V.I.S. Command Centre · agents.sukashawarma.com</i>`,
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

  // Sesuai instruksi CEO: Laporan Daily selalu menjadikan H-1 (Full Closing Kemarin) sebagai acuan utama/default
  const modeRekomendasi: 'hari_ini' | 'kemarin' = 'kemarin'
  const actionItemsKemarin = bangunActionItems(telemetri, jam, 'kemarin')
  const actionItemsHariIni = bangunActionItems(telemetri, jam, 'hari_ini')
  const actionItems = actionItemsKemarin
  const saranStrategisKemarin = bangunSaranStrategisDivisi(telemetri, true)
  const saranStrategisHariIni = bangunSaranStrategisDivisi(telemetri, false)
  const narasiSuaraHariIni = bangunNarasiSuara(telemetri, 'hari_ini', sapaan)
  const narasiSuaraKemarin = bangunNarasiSuara(telemetri, 'kemarin', sapaan)

  const teksLaporanHariIni = telemetri
    ? bangunTeksTelegram(telemetri, 'hari_ini', actionItemsHariIni, saranStrategisHariIni)
    : 'Data telemetri belum tersedia.'
  const teksLaporanKemarin = telemetri
    ? bangunTeksTelegram(telemetri, 'kemarin', actionItemsKemarin, saranStrategisKemarin)
    : 'Data telemetri belum tersedia.'

  const payload: DailyReportPayload = {
    diambilAt: new Date().toISOString(),
    jamWib: jam,
    modeRekomendasi,
    telemetri,
    actionItems,
    actionItemsKemarin,
    actionItemsHariIni,
    saranStrategisKemarin,
    saranStrategisHariIni,
    narasiSuaraHariIni,
    narasiSuaraKemarin,
    teksLaporanHariIni,
    teksLaporanKemarin,
  }

  return NextResponse.json(payload, { headers: { 'Cache-Control': 'no-store' } })
}

const ROLE_PER_BOT_SLUG: Record<'manager' | 'finance' | 'hrd' | 'stokis' | 'review', string[]> = {
  manager: ['area_manager', 'regional_manager', 'korlap', 'owner', 'admin', 'developer'],
  finance: ['admin_finance', 'owner', 'admin', 'developer'],
  hrd: ['admin_hr', 'owner', 'admin', 'developer'],
  stokis: ['kitchen', 'purchasing', 'staff_pusat', 'owner', 'admin', 'developer'],
  review: ['owner', 'admin', 'developer'],
}

export async function POST(req: Request) {
  const g = await ambilSesi()
  if (!g.ok) {
    return NextResponse.json({ galat: 'Tidak punya akses.' }, { status: g.status })
  }

  const body = await req.json().catch(() => ({}))
  const mode: 'hari_ini' | 'kemarin' = body?.mode === 'hari_ini' ? 'hari_ini' : 'kemarin'

  const telemetri = await ambilTelemetriNyata(false)
  if (!telemetri) {
    return NextResponse.json({ galat: 'Data telemetri database belum tersedia.' }, { status: 503 })
  }

  const { jam } = getJamWib()
  const actionItems = bangunActionItems(telemetri, jam, mode)
  const saranStrategis = bangunSaranStrategisDivisi(telemetri, mode === 'kemarin')

  // ── Mode One-Click Dispatch Directive ke Bot Divisi ──
  if (body?.action === 'dispatch') {
    const targetBotRaw = String(body?.targetBot || 'all').toLowerCase()
    const saranId = body?.saranId ? String(body.saranId) : null

    const daftarSaranTarget = saranId
      ? saranStrategis.filter((s) => s.id === saranId)
      : targetBotRaw === 'all'
      ? saranStrategis
      : saranStrategis.filter((s) => s.targetBot === targetBotRaw)

    if (daftarSaranTarget.length === 0) {
      return NextResponse.json({ ok: false, galat: 'Rekomendasi divisi tidak ditemukan.' }, { status: 400 })
    }

    const ceoFallbackTargets = new Set<string>()
    for (const envKey of ['TELEGRAM_OWNER_CHAT_ID', 'TELEGRAM_CHAT_ID']) {
      const val = process.env[envKey]
      if (val) {
        for (const cid of val.split(',')) {
          const clean = cid.trim()
          if (clean) ceoFallbackTargets.add(clean)
        }
      }
    }

    let totalTerkirim = 0
    let galatTerakhir = ''

    for (const saran of daftarSaranTarget) {
      const botProfil = saran.targetBot
      const allowedRoles = ROLE_PER_BOT_SLUG[botProfil] || ['owner', 'admin', 'developer']
      const divTargets = new Set<string>(ceoFallbackTargets)

      try {
        const admin = supabaseAdmin(4_000)
        const [{ data: links }, { data: whitelist }] = await Promise.all([
          admin
            .from('bot_telegram_links')
            .select('chat_id, outlet_staff!inner(role, status)')
            .in('outlet_staff.role', allowedRoles)
            .eq('outlet_staff.status', 'active'),
          admin
            .from('bot_telegram_whitelist')
            .select('telegram_user_id')
            .in('bot_slug', [botProfil, 'ceo'])
            .eq('is_active', true),
        ])
        for (const row of (links || []) as Array<{ chat_id?: string }>) {
          if (row.chat_id) divTargets.add(String(row.chat_id).trim())
        }
        for (const row of (whitelist || []) as Array<{ telegram_user_id?: string }>) {
          if (row.telegram_user_id) divTargets.add(String(row.telegram_user_id).trim())
        }
      } catch (err) {
        console.warn(`[jarvis-dispatch] Gagal memuat target divisi ${botProfil}:`, err)
      }

      for (const chatId of divTargets) {
        try {
          await kirimPesanTelegram(chatId, saran.pesanInstruksiTelegram, undefined, botProfil)
          totalTerkirim++
        } catch {
          // Fallback kirim melalui bot CEO jika token bot divisi belum di-set di env
          try {
            await kirimPesanTelegram(chatId, saran.pesanInstruksiTelegram, undefined, 'ceo')
            totalTerkirim++
          } catch (e2) {
            galatTerakhir = (e2 as Error)?.message || 'Gagal dispatch ke Telegram'
          }
        }
      }
    }

    if (totalTerkirim === 0) {
      return NextResponse.json(
        { ok: false, galat: galatTerakhir || 'Belum ada kontak Telegram divisi/CEO yang tertaut.' },
        { status: 400 }
      )
    }

    const labelDivisi =
      daftarSaranTarget.length === 1 ? daftarSaranTarget[0].labelBot : `${daftarSaranTarget.length} Divisi Operasional`
    return NextResponse.json({
      ok: true,
      terkirimKe: totalTerkirim,
      ringkasanSuara: `Siap, Sir. Instruksi strategis telah berhasil diteruskan ke ${labelDivisi} melalui Telegram.`,
    })
  }

  const teksLaporan = bangunTeksTelegram(telemetri, mode, actionItems, saranStrategis)

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
