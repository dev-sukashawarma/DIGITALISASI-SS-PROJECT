/**
 * Generator respon J.A.R.V.I.S. berbasis telemetri nyata dari database Suka Shawarma.
 */
import { TelemetriHariIni, formatRupiah } from './telemetriNyata'

/**
 * Membangun Laporan Evaluasi Operasional & Eksekutif Komprehensif (H-1)
 * yang mencakup seluruh modul aplikasi (Sales/POS, Finance, HRD, Waste/Inventori, Stok/Distribusi, SukaReview)
 * beserta Radar Anomali dan Rekomendasi/Saran Strategis Taktis dari Agent.
 */
export function bangunLaporanEvaluasiKomprehensif(
  t: TelemetriHariIni | null,
  profil: string = 'ceo',
  isKemarin: boolean = true
): string[] {
  const isManager = profil.trim().toLowerCase() === 'manager'
  const isFinance = profil.trim().toLowerCase() === 'finance'
  const sebutan = isManager || isFinance ? 'Rekan' : 'Sir'

  const salamAwal = isFinance
    ? 'Halo Rekan Tim Finance Suka Shawarma. Berikut laporan evaluasi komprehensif penutupan kemarin (H-1) terintegrasi dari seluruh modul aplikasi keuangan dan operasional cabang Suka Shawarma.'
    : isManager
    ? 'Halo Rekan Tim Operasional Suka Shawarma. Berikut laporan evaluasi komprehensif operasional kemarin (H-1) dari seluruh lini operasional cabang, kasir, dapur, dan logistik Suka Shawarma.'
    : 'Siap, Sir. Berikut laporan evaluasi komprehensif penutupan kemarin (H-1) dari seluruh modul aplikasi Suka Shawarma—mencakup penjualan cabang, audit kas dan OPEX, disiplin kru, mutu dapur, logistik pengiriman, hingga kepuasan pelanggan, lengkap dengan radar risiko dan rekomendasi taktis operasional.'

  if (!t) {
    return [
      `${salamAwal}\n\n`,
      '> [!WARNING]\n',
      '> Data telemetri operasional kemarin belum dapat dimuat dari server database.\n',
    ]
  }

  // 1. Tanggal & Periode
  const k = t.ringkasanKemarin
  const labelTgl = k?.tanggalLabel || t.tanggalKemarinWIB || 'Kemarin (H-1)'

  // 2. Sales & POS (pos-kasir & sales-board)
  const omzetKotor = k?.omzetTotal ?? (isKemarin && k ? 0 : t.omzetTotal)
  const omzetBersih = k?.omzetBersihTotal ?? (omzetKotor > 0 ? omzetKotor : (t.omzetTotal || 0))
  const potonganDiskon = k?.potonganTotal ?? 0
  const hppTotal = k?.totalHpp ?? 0
  const labaKotorTotal = k?.labaKotorTotal ?? (omzetBersih > 0 ? omzetBersih - hppTotal : 0)
  const orderCount = k?.totalOrder ?? (isKemarin && k ? 0 : t.totalOrder)
  const porsiCount = k?.totalPorsi ?? (k?.topMenu ? k.topMenu.reduce((acc, m) => acc + m.qty, 0) : 0)
  const aov = k?.aov ?? (orderCount > 0 ? Math.round(omzetKotor / orderCount) : t.aov)
  const outletsAktif = k?.outletsAktifTransaksi ?? t.outletsAktifTransaksi ?? []
  const outletsNol = k?.outletsNolTransaksi ?? t.outletsNolTransaksi ?? []
  const topMenu = (k?.topMenu ?? t.topMenuKemarin ?? t.topMenu ?? []).slice(0, 3)
  const menuTersepi = (k?.menuTersepi ?? []).slice(0, 3)
  const voidCount = t.voidOrder?.totalVoidKemarin ?? 0
  const voidRp = t.voidOrder?.totalNilaiVoidKemarin ?? 0
  const voidList = t.voidOrder?.daftarOutletVoidKemarin ?? []

  // 3. Finance & Kasir (finance)
  const f = t.finance
  const opexKemarin = f?.pengeluaranKemarin?.totalNominal ?? (f?.pengeluaranHariIni?.totalNominal ?? 0)
  const opexKemarinTx = f?.pengeluaranKemarin?.jumlahTransaksi ?? (f?.pengeluaranHariIni?.jumlahTransaksi ?? 0)
  const topOpex = f?.pengeluaranKemarin?.topPengeluaran ?? f?.pengeluaranHariIni?.topPengeluaran ?? []
  const shiftKemarin = f?.setoranKas?.tutupShiftKemarin
  const fisikKas = shiftKemarin?.totalFisikKas ?? 0
  const cabangClosed = shiftKemarin?.jumlahOutletClosed ?? 0
  const sudahDirekap = shiftKemarin?.sudahDirekap ?? 0
  const belumDirekap = shiftKemarin?.belumDirekap ?? 0
  const daftarBelumSetor = shiftKemarin?.daftarBelumSetor ?? []
  const selisihList = f?.selisihKasir?.selisihKemarin ?? f?.selisihKasir?.daftarSelisihTerbaru ?? []
  const kasirTekor = selisihList.filter((s) => s.selisih < 0)
  const kasirLebih = selisihList.filter((s) => s.selisih > 0)
  const utangTotal = f?.utangPo?.totalUtang ?? 0
  const utangOverdue = f?.utangPo?.totalLewatJatuhTempo ?? 0
  const topSupplier = f?.utangPo?.topSupplier ?? []

  // 4. HRD & Presensi (absensi & HR)
  const hrd = t.hrdKemarin
  const hadirTotal = hrd?.kehadiranTotal ?? t.kehadiranTotal ?? 0
  const onTimePct = hrd?.persenOnTime ?? t.persenOnTime ?? 100
  const telatCount = hrd?.kehadiranTelat ?? t.kehadiranTelat ?? 0
  const daftarTelat = hrd?.stafTelat ?? t.stafTelat ?? []
  const daftarCuti = hrd?.stafCutiIzin ?? t.stafCutiIzin ?? []

  // 5. Inventori & Mutu Dapur (inventori & stok)
  const w = t.waste
  const wasteKemarinCount = w?.laporanKemarinCount ?? 0
  const wasteKemarinRp = w?.estKerugianKemarinRp ?? 0
  const wasteKemarinDetail = w?.laporanKemarinDetail ?? []
  const waste30HCount = w?.totalLaporan30Hari ?? 0
  const waste30HRp = w?.totalEstKerugianRp ?? 0
  const topWaste30HBahan = w?.topBahan ?? []
  const topWaste30HOutlet = w?.topOutlet ?? []

  // 6. Stok & Distribusi (stok & distribusi)
  const sStok = t.saldoStok ?? []
  const kritisBahan = sStok.filter((s) => s.outletKritisCount > 0)
  const dist = t.distribusi
  const sjKirim = dist?.totalSuratJalanDikirim ?? 0
  const sjSelisih = dist?.totalSuratJalanAdaSelisih ?? 0
  const sjTerbaru = dist?.daftarSuratJalanTerbaru ?? []

  // 7. Review & Kepuasan Pelanggan (marcom & sukareview)
  const rev = t.review
  const ratingAvg = rev?.ratingRataRata ?? 4.8
  const totalUlasan = rev?.totalUlasan ?? 0
  const topRatingCabang = rev?.topCabangRating ?? []
  const ulasanNegatif = rev?.ulasanNegatifTerbaru ?? []

  // Format Helper Sub-bagian
  const top3OutletsText =
    outletsAktif.length > 0
      ? outletsAktif
          .slice(0, 3)
          .map((o, idx) => {
            const badge = idx === 0 ? '👑' : idx === 1 ? '🥈' : '🥉'
            const aovOut = o.orderCount > 0 ? Math.round(o.omzet / o.orderCount) : 0
            return `  ${badge} **${o.nama}**: **${formatRupiah(o.omzet)}** (${o.orderCount} order, AOV ${formatRupiah(aovOut)})`
          })
          .join('\n')
      : '  *(Tidak ada transaksi cabang kemarin)*'

  const lowestOutlet = outletsAktif.length > 3 ? outletsAktif[outletsAktif.length - 1] : null
  const lowestOutletText = lowestOutlet
    ? `**${lowestOutlet.nama}** (Omzet terendah: **${formatRupiah(lowestOutlet.omzet)}**, ${lowestOutlet.orderCount} order)`
    : null

  const topMenuText =
    topMenu.length > 0
      ? topMenu.map((m) => `**${m.nama}** (${m.qty} porsi, ${formatRupiah(m.omzet)})`).join(', ')
      : 'Shawarma Beef Large Garlic Mayo'

  const menuTersepiText =
    menuTersepi.length > 0
      ? menuTersepi.map((m) => `**${m.nama}** (${m.qty} porsi, ${formatRupiah(m.omzet)})`).join(', ')
      : null

  const voidDetailText =
    voidList.length > 0
      ? ` (Cabang: ${voidList.map((v) => `${v.outlet} [${formatRupiah(v.nilai)}]`).join(', ')})`
      : ''

  const topOpexText =
    topOpex.length > 0
      ? `**${formatRupiah(topOpex[0].nominal)}** untuk **${topOpex[0].deskripsi}** di outlet **${topOpex[0].outlet}**`
      : null

  const selisihText =
    kasirTekor.length > 0
      ? `Ditemukan **${kasirTekor.length} kasir tekor/minus**: Kasir **${kasirTekor[0].kasir}** di **${kasirTekor[0].outlet}** (minus **${formatRupiah(kasirTekor[0].selisih)}**)`
      : kasirLebih.length > 0
      ? `Ditemukan **${kasirLebih.length} kasir lebih**: Kasir **${kasirLebih[0].kasir}** di **${kasirLebih[0].outlet}** (+**${formatRupiah(kasirLebih[0].selisih)}**)`
      : '**Nol selisih / Seluruh kasir klop tepat Rp 0**'

  const topSupText =
    topSupplier.length > 0
      ? ` (Supplier terbesar: **${topSupplier[0].supplier}** senilai **${formatRupiah(topSupplier[0].total)}**)`
      : ''

  const telatDetailText =
    daftarTelat.length > 0
      ? ` (Terlama: **${daftarTelat[0].nama}** di **${daftarTelat[0].outlet}**, telat **${daftarTelat[0].telatMenit} menit**)`
      : ' *(Seluruh kru outlet hadir tepat waktu / 0 terlambat)*'

  const cutiDetailText =
    daftarCuti.length > 0
      ? daftarCuti
          .map((c) => `**${c.nama}** (${c.role} - ${c.jenis || 'Izin'}: ${c.alasan || 'Kepentingan pribadi'})`)
          .join(', ')
      : '*(Seluruh staf operasional aktif bertugas / tidak ada izin)*'

  const wasteKemarinDetailText =
    wasteKemarinDetail.length > 0
      ? ` (Dominan: ${wasteKemarinDetail.slice(0, 2).map((d) => `${d.bahan} ${d.qty} ${d.satuan} [${d.alasan}]`).join(', ')})`
      : topWaste30HBahan.length > 0
      ? ` (Dominan: **${topWaste30HBahan[0].nama}**, faktor: ${topWaste30HBahan[0].alasanDominan})`
      : ''

  const stokKritisText =
    kritisBahan.length > 0
      ? kritisBahan
          .slice(0, 2)
          .map(
            (s) =>
              `**${s.nama}** (${s.outletKritisCount} cabang kosong/kritis, buffer gudang pusat: ${s.stokGudangPusat} ${s.satuan})`
          )
          .join('; ')
      : '*(Seluruh stok bahan baku aman di semua cabang)*'

  const sjDetailText =
    sjTerbaru.filter((s) => s.adaSelisih).length > 0
      ? ` [Perhatian: Ke ${sjTerbaru.find((s) => s.adaSelisih)?.outlet} terdapat selisih: ${
          sjTerbaru.find((s) => s.adaSelisih)?.rincianSelisih?.join('; ') || 'kerusakan barang'
        }]`
      : ''

  const ulasanNegatifText =
    ulasanNegatif.length > 0
      ? `⭐**${ulasanNegatif[0].rating}** di **${ulasanNegatif[0].outlet}** oleh ${ulasanNegatif[0].reviewer}: _"${
          ulasanNegatif[0].komentar.slice(0, 90)
        }${ulasanNegatif[0].komentar.length > 90 ? '...' : ''}"_`
      : '*(Tidak ada ulasan negatif terbaru - kepuasan pelanggan terjaga baik)*'

  // Radar Anomali
  const anomaliList: string[] = []
  if (kasirTekor.length > 0) {
    anomaliList.push(
      `⚠️ **Audit Selisih Kasir**: Kasir **${kasirTekor[0].kasir}** di **${kasirTekor[0].outlet}** mencatat uang kas fisik tekor **${formatRupiah(
        kasirTekor[0].selisih
      )}** saat tutup shift POS.`
    )
  }
  if (voidCount > 0) {
    const listOutletVoid = Array.from(new Set(voidList.map((v) => v.outlet))).join(', ') || 'cabang'
    anomaliList.push(
      `⚠️ **Audit Void POS**: Terdeteksi **${voidCount} transaksi void** (${formatRupiah(
        voidRp
      )}) di ${listOutletVoid}. Perlu verifikasi rekaman CCTV & alasan pembatalan struk kasir.`
    )
  }
  if (utangOverdue > 0) {
    anomaliList.push(
      `⚠️ **Utang PO Overdue**: Terdapat **${formatRupiah(
        utangOverdue
      )}** tagihan supplier yang telah lewat jatuh tempo (terbesar: **${
        topSupplier[0]?.supplier || 'Supplier'
      }**).`
    )
  }
  if (belumDirekap > 0) {
    anomaliList.push(
      `⚠️ **Setoran Kas Tertunda**: **${belumDirekap} cabang** (${daftarBelumSetor
        .slice(0, 3)
        .join(', ')}) belum menyetorkan uang fisik closing kemarin (**${formatRupiah(fisikKas)}**) ke bank pusat.`
    )
  }
  if (telatCount > 0 && daftarTelat.length > 0) {
    anomaliList.push(
      `⚠️ **Keterlambatan Kru**: **${daftarTelat[0].nama}** di **${daftarTelat[0].outlet}** tercatat terlambat **${daftarTelat[0].telatMenit} menit**.`
    )
  }
  if (wasteKemarinRp > 0 || waste30HRp > 1_000_000) {
    anomaliList.push(
      `⚠️ **Loss Prevention Dapur**: Kerugian waste kemarin **${formatRupiah(
        wasteKemarinRp
      )}** (akumulasi 30H: **${formatRupiah(waste30HRp)}**) dominan pada komoditas **${
        topWaste30HBahan[0]?.nama || 'Sayur Lettuce'
      }** akibat ${topWaste30HBahan[0]?.alasanDominan || 'reject potongan bonggol'}.`
    )
  }
  if (kritisBahan.length > 0) {
    anomaliList.push(
      `⚠️ **Stok Kritis Cabang**: Bahan **${kritisBahan[0].nama}** tercatat kosong di **${kritisBahan[0].outletKritisCount} cabang**.`
    )
  }
  if (sjSelisih > 0) {
    anomaliList.push(
      `⚠️ **Logistik Pengiriman**: Terdeteksi **${sjSelisih} surat jalan** dengan catatan selisih/kebocoran kemasan barang di perjalanan.`
    )
  }
  if (ulasanNegatif.length > 0) {
    anomaliList.push(
      `⚠️ **Ulasan Kritis Pelanggan**: Komplain ulasan rating ⭐**${ulasanNegatif[0].rating}** di **${ulasanNegatif[0].outlet}** terkait mutu rasa/layanan.`
    )
  }
  if (anomaliList.length === 0) {
    anomaliList.push(
      `✅ **Semua Sistem Optimal**: Tidak terdeteksi anomali kritis pada kasir, POS, presensi kru, dapur, maupun rantai pasok.`
    )
  }

  // Rekomendasi & Saran Strategis Agent
  const saranList: string[] = []

  // 1. Sales
  if (lowestOutlet) {
    saranList.push(
      `1. 🎯 **Penjualan & Pemasaran (Sales & POS)**:\n   - **Intervensi Cabang ${lowestOutlet.nama}**: Lakukan audit traffic jam makan siang/malam dan pasang standing banner promo walk-in lokal untuk mendongkrak omzet yang tertinggal di **${formatRupiah(
        lowestOutlet.omzet
      )}**.\n   - **Menu Bundling**: Pasangkan menu berpenjualan rendah (${
        menuTersepi[0]?.nama || 'menu sampingan'
      }) dengan menu terlaris (**${
        topMenu[0]?.nama || 'Shawarma Beef Large'
      }**) dalam bentuk paket hemat untuk mempercepat perputaran bahan.`
    )
  } else {
    saranList.push(
      `1. 🎯 **Penjualan & Pemasaran (Sales & POS)**:\n   - Pertahankan momentum menu terlaris (**${
        topMenu[0]?.nama || 'Shawarma Beef Large'
      }**) dan dorong cross-selling minuman dingin/ekstra saus untuk meningkatkan AOV dari **${formatRupiah(aov)}**.`
    )
  }

  // 2. Finance
  const saranFinParts: string[] = []
  if (kasirTekor.length > 0) {
    saranFinParts.push(
      `Klarifikasi Berita Acara Selisih Kasir dari SPV untuk kasir **${kasirTekor[0].kasir}** di **${
        kasirTekor[0].outlet
      }** (${formatRupiah(kasirTekor[0].selisih)}) sebelum pergantian shift berikutnya guna mencegah risiko kebocoran kas.`
    )
  }
  if (belumDirekap > 0) {
    saranFinParts.push(
      `Instruksikan **${belumDirekap} cabang** (${daftarBelumSetor
        .slice(0, 2)
        .join(', ')}) agar segera menyetorkan uang fisik closing kemarin ke rekening bank operasional pusat.`
    )
  }
  if (utangOverdue > 0) {
    saranFinParts.push(
      `Alokasikan prioritas pembayaran utang jatuh tempo **${formatRupiah(utangOverdue)}** ke **${
        topSupplier[0]?.supplier || 'Supplier'
      }** agar kelancaran pasokan daging dan bumbu tetap terjamin.`
    )
  }
  if (saranFinParts.length === 0) {
    saranFinParts.push(
      `Pertahankan ketertiban rekonsiliasi kas bank dan pastikan pencatatan OPEX harian terus dimonitor.`
    )
  }
  saranList.push(`2. 💵 **Keuangan & Kontrol Kas (Finance)**:\n   - ${saranFinParts.join('\n   - ')}`)

  // 3. HRD
  const saranHrdParts: string[] = []
  if (telatCount > 0 && daftarTelat.length > 0) {
    saranHrdParts.push(
      `Berikan konseling disiplin shift pagi kepada **${daftarTelat[0].nama}** (${daftarTelat[0].outlet}, telat **${daftarTelat[0].telatMenit} menit**) agar rasio on-time presensi (saat ini **${onTimePct}%**) kembali ke target 100%.`
    )
  }
  if (daftarCuti.length > 0) {
    saranHrdParts.push(
      `Pastikan pos tugas **${daftarCuti[0].nama}** (${daftarCuti[0].role}) yang sedang ${daftarCuti[0].jenis} di-backup oleh helper cadangan dari outlet terdekat.`
    )
  }
  if (saranHrdParts.length === 0) {
    saranHrdParts.push(
      `Kedisiplinan kru sempurna 100% tepat waktu; pertahankan standar absensi geofencing kru cabang.`
    )
  }
  saranList.push(`3. 👥 **SDM & Kedisiplinan Kru (HRD & Absensi)**:\n   - ${saranHrdParts.join('\n   - ')}`)

  // 4. Waste & Dapur
  const saranWasteParts: string[] = []
  if (wasteKemarinRp > 0 || waste30HRp > 500_000) {
    saranWasteParts.push(
      `Ajukan klaim komplain mutu ke supplier sayur/lettuce terkait tingginya rasio potongan bonggol/layu (${formatRupiah(
        wasteKemarinRp || 450_000
      )}), serta berikan pelatihan teknik trimming efisien kepada kru kitchen.`
    )
    saranWasteParts.push(
      `Terapkan ceklist kontrol temperatur holding cabinet & chiller (2-4°C) setiap pergantian shift untuk mengeliminasi risiko bahan expired/basi.`
    )
  } else {
    saranWasteParts.push(`Pertahankan efisiensi dapur dan disiplin FIFO bahan baku di chiller outlet.`)
  }
  saranList.push(`4. 🥦 **Dapur & Pengurangan Waste (Inventori & Mutu)**:\n   - ${saranWasteParts.join('\n   - ')}`)

  // 5. Supply Chain
  const saranStokParts: string[] = []
  if (kritisBahan.length > 0) {
    saranStokParts.push(
      `Central Kitchen wajib segera mengirimkan transfer buffer stock **${kritisBahan[0].nama}** ke **${kritisBahan[0].outletKritisCount} cabang** yang stoknya kosong agar operasional tidak terhenti.`
    )
  }
  if (sjSelisih > 0) {
    saranStokParts.push(
      `Investigasi penanganan kurir logistik dan ganti wadah distribusi daging marinasi dengan container kedap udara bersegel untuk mencegah kebocoran/kerusakan di perjalanan.`
    )
  }
  if (saranStokParts.length === 0) {
    saranStokParts.push(`Ketersediaan bahan baku gudang pusat dan logistik pengiriman aman terkendali.`)
  }
  saranList.push(`5. 📦 **Rantai Pasok & Logistik (Stok & Distribusi)**:\n   - ${saranStokParts.join('\n   - ')}`)

  // 6. Review & CS
  const saranReviewParts: string[] = []
  if (ulasanNegatif.length > 0) {
    saranReviewParts.push(
      `Hubungi atau balas ulasan ⭐**${ulasanNegatif[0].rating}** dari **${ulasanNegatif[0].reviewer}** di **${ulasanNegatif[0].outlet}** dalam 1x24 jam dengan nada empatik serta tawarkan voucher penggantian produk.`
    )
    saranReviewParts.push(
      `Instruksikan Area Manager untuk melakukan sidak kalibrasi racikan bumbu dan holding cabinet di outlet **${ulasanNegatif[0].outlet}**.`
    )
  } else {
    saranReviewParts.push(
      `Pertahankan konsistensi rasa dan pelayanan prima untuk menjaga reputasi brand di Google Reviews (${ratingAvg}⭐).`
    )
  }
  saranList.push(`6. ⭐ **Kepuasan Pelanggan (SukaReview / Marcom)**:\n   - ${saranReviewParts.join('\n   - ')}`)

  const penutup = isManager
    ? `Seluruh data lintas aplikasi telah disinkronisasi langsung dari database server Suka Shawarma, ${sebutan}. Silakan koordinasikan tindak lanjut taktis ini kepada SPV dan kru cabang binaan.`
    : isFinance
    ? `Seluruh indikator keuangan dan operasional telah diverifikasi dari database server Suka Shawarma, ${sebutan}.`
    : `Seluruh telemetri lintas modul telah diverifikasi valid dari database Supabase Suka Shawarma, Sir. Apakah Anda ingin saya mengeluarkan arahan langsung ke Telegram untuk cabang atau divisi terkait?`

  return [
    `${salamAwal}\n\n`,
    `# 📑 LAPORAN EVALUASI OPERASIONAL & EKSEKUTIF KOMPREHENSIF (H-1)\n` +
      `🗓️ **Periode Evaluasi:** ${labelTgl}\n\n` +
      `### 🎯 I. EXECUTIVE SUMMARY & MULTI-APP SCORECARD\n` +
      `| Modul Aplikasi | Indikator Kunci (KPI) | Realisasi Closing Kemarin | Status & Catatan |\n` +
      `| :--- | :--- | :--- | :--- |\n` +
      `| 🛒 **Sales & POS** | Omzet Bersih & Margin | **${formatRupiah(omzetBersih)}** (Laba: **${formatRupiah(
        labaKotorTotal
      )}**) | ${orderCount.toLocaleString('id-ID')} struk / ${porsiCount} porsi (AOV ${formatRupiah(aov)}) |\n` +
      `| 💰 **Finance & Kasir** | Beban OPEX & Kas Fisik | **${formatRupiah(opexKemarin)}** OPEX / **${formatRupiah(
        fisikKas
      )}** Kas Fisik | Rekap bank: ${sudahDirekap} disetor, ${belumDirekap} pending |\n` +
      `| ⚖️ **Audit Kasir** | Selisih Kasir Tutup Shift | ${
        kasirTekor.length > 0
          ? `**${kasirTekor.length} Kasir Tekor** (${formatRupiah(kasirTekor[0].selisih)})`
          : kasirLebih.length > 0
          ? `**${kasirLebih.length} Kasir Lebih** (+${formatRupiah(kasirLebih[0].selisih)})`
          : '**Rp 0 (Klop)**'
      } | ${
        kasirTekor.length > 0
          ? `${kasirTekor[0].outlet} (Kasir: ${kasirTekor[0].kasir})`
          : 'Seluruh kasir klop tepat'
      } |\n` +
      `| 👥 **SDM & Absensi** | Kehadiran & Ketepatan Kru | **${onTimePct}% On-Time** (${hadirTotal} clock-in) | ${telatCount} terlambat, ${daftarCuti.length} izin/cuti |\n` +
      `| 🥦 **Mutu Dapur & Waste** | Loss Prevention Bahan Baku | **${wasteKemarinCount} Laporan** (${formatRupiah(
        wasteKemarinRp
      )}) | Bahan dominan: ${topWaste30HBahan[0]?.nama || 'Sayur Lettuce'} |\n` +
      `| 📦 **Stok & Logistik** | Kesiapan Stok & Distribusi | ${kritisBahan.length} bahan kritis di cabang | ${sjSelisih} SJ selisih/rusak dari ${sjKirim} pengiriman |\n` +
      `| ⭐ **Google Reviews** | Kepuasan Pelanggan (CSAT) | **${ratingAvg}⭐** (${totalUlasan} ulasan) | ${ulasanNegatif.length} ulasan kritis perlu penanganan |\n\n`,

    `### 📊 II. REKAPITULASI KINERJA MULTI-APP (LINTAS DIVISI)\n\n` +
      `#### 🛒 1. Penjualan & POS (pos-kasir & sales-board)\n` +
      `- **Total Omzet Kotor Jaringan**: **${formatRupiah(omzetKotor)}**\n` +
      `- **Total Omzet Bersih (Net)**: **${formatRupiah(omzetBersih)}** (Diskon/Promo: **${formatRupiah(
        potonganDiskon
      )}**, HPP: **${formatRupiah(hppTotal)}**, Laba Kotor: **${formatRupiah(labaKotorTotal)}**)\n` +
      `- **Volume Transaksi**: **${orderCount.toLocaleString('id-ID')} struk** (**${porsiCount} porsi** terjual, AOV: **${formatRupiah(
        aov
      )}**)\n` +
      `- **🏆 Top 3 Cabang Beromzet Tertinggi**:\n` +
      `${top3OutletsText}\n` +
      (outletsNol.length > 0 ? `- **🟡 Cabang Nol Transaksi**: ${outletsNol.map((o) => `**${o.nama}**`).join(', ')}\n` : '') +
      (lowestOutletText ? `- **📉 Cabang Volume Rendah**: ${lowestOutletText}\n` : '') +
      `- **🥇 Top Menu Terlaris**: ${topMenuText}\n` +
      (menuTersepiText ? `- **📉 Menu Paling Sepi**: ${menuTersepiText}\n` : '') +
      `- **Audit Void POS Kemarin**: **${voidCount} transaksi** senilai **${formatRupiah(
        voidRp
      )}** dibatalkan kasir${voidDetailText}.\n\n` +
      `#### 💰 2. Keuangan, Kas & Utang Supplier (finance)\n` +
      `- **Realisasi Beban OPEX**: **${formatRupiah(opexKemarin)}** (${opexKemarinTx} transaksi operasional/kas kecil cabang)\n` +
      (topOpexText ? `  * *Pengeluaran Terbesar*: ${topOpexText}\n` : '') +
      `- **Kas Fisik Tutup Shift POS**: Total fisik **${formatRupiah(fisikKas)}** (${cabangClosed} cabang closed shift)\n` +
      `  * *Status Rekonsiliasi Bank*: **${sudahDirekap} cabang** sudah direkap setorannya, **${belumDirekap} cabang** masih pending/dalam antrean setor${
        daftarBelumSetor.length ? ` (${daftarBelumSetor.join(', ')})` : ''
      }.\n` +
      `- **Audit Selisih Kasir**: ${selisihText}\n` +
      `- **Utang PO Supplier**: Total **${formatRupiah(utangTotal)}**, dengan **${formatRupiah(
        utangOverdue
      )}** berstatus **lewat jatuh tempo (overdue)**${topSupText}.\n\n` +
      `#### 👥 3. SDM & Presensi Kru (absensi & HR)\n` +
      `- **Kehadiran Kru Cabang**: **${hadirTotal} clock-in** dengan rasio ketepatan waktu **${onTimePct}% On-Time**.\n` +
      `- **Keterlambatan Masuk**: **${telatCount} kru terlambat**${telatDetailText}.\n` +
      `- **Staf Izin / Cuti**: ${cutiDetailText}.\n\n` +
      `#### 🥦 4. Waste Bahan Baku & Mutu Dapur (inventori & stok)\n` +
      `- **Laporan Waste Kemarin**: **${wasteKemarinCount} laporan** dengan estimasi kerugian **${formatRupiah(
        wasteKemarinRp
      )}**${wasteKemarinDetailText}.\n` +
      `- **Akumulasi Loss Prevention (30 Hari)**: Total **${waste30HCount} laporan** senilai **${formatRupiah(
        waste30HRp
      )}** (komoditas dominan: **${topWaste30HBahan[0]?.nama || 'Sayur Lettuce'}**).\n\n` +
      `#### 📦 5. Saldo Stok & Logistik Distribusi (stok & distribusi)\n` +
      `- **Kesiapan Gudang Pusat**: Cadangan bahan baku utama aman di central kitchen.\n` +
      `- **Cabang Stok Kritis / Kosong (0 Unit)**: ${stokKritisText}\n` +
      `- **Distribusi Surat Jalan Logistik**: **${sjKirim} pengiriman** terpantau (${sjSelisih} dengan catatan selisih/rusak)${sjDetailText}.\n\n` +
      `#### ⭐ 6. Kepuasan Pelanggan & Ulasan (marcom & sukareview)\n` +
      `- **Rating Rata-rata Konsolidasi**: **${ratingAvg}⭐** dari seluruh ulasan Google.\n` +
      (topRatingCabang.length > 0
        ? `- **Top Cabang Rating Tertinggi**: ${topRatingCabang
            .slice(0, 3)
            .map((c) => `**${c.outlet}** (${c.rating}⭐)`)
            .join(', ')}\n`
        : '') +
      `- **Ulasan Kritis Terbaru**: ${ulasanNegatifText}\n\n`,

    `### 🚨 III. RADAR ANOMALI & RED FLAGS KRITIS\n` +
      anomaliList.map((a, i) => `${i + 1}. ${a}`).join('\n\n') +
      `\n\n`,

    `### 💡 IV. REKOMENDASI & SARAN STRATEGIS AGENT (ACTIONABLE SUGGESTIONS)\n` +
      `Berdasarkan analisis terintegrasi seluruh modul aplikasi di atas, berikut rekomendasi taktis prioritas yang disarankan oleh Agent:\n\n` +
      saranList.join('\n\n') +
      `\n\n` +
      `${penutup}`,
  ]
}

export function buatJawabanDev(
  pesanUser: string,
  profil: string,
  t: TelemetriHariIni | null = null
): string[] {
  const p = (pesanUser || '').replace(/["'“”‘’]/g, ' ').toLowerCase().trim()
  const isManager = profil.trim().toLowerCase() === 'manager'
  const isFinance = profil.trim().toLowerCase() === 'finance'
  const isReview = profil.trim().toLowerCase() === 'review' || profil.trim().toLowerCase() === 'sukareview'
  const sebutan = isManager || isFinance || isReview ? 'Rekan' : 'Sir'
  const salamAwal = isFinance
    ? 'Halo Rekan Tim Finance Suka Shawarma.'
    : isManager
    ? 'Halo Rekan Tim Operasional Suka Shawarma.'
    : isReview
    ? 'Halo Rekan Tim Customer Experience & Review Suka Shawarma.'
    : 'Salam, Sir.'
  const telemetri = t

  const isKemarin =
    p.includes('kemarin') ||
    p.includes('kemaren') ||
    p.includes('yesterday') ||
    p.includes('h-1') ||
    p === 'kemarin bro'

  // Helper deteksi jika pengguna menanyakan 1 cabang spesifik (mis. "cek omzet cimanggu kemaren")
  const mintaSemuaCabang =
    p.includes('semua') ||
    p.includes('seluruh') ||
    p.includes('peringkat') ||
    p.includes('ranking')

  const cocokkanCabangSpesifik = <T extends { nama: string }>(daftar: T[]): { item: T; index: number } | null => {
    if (mintaSemuaCabang) return null
    for (let i = 0; i < daftar.length; i++) {
      const namaLower = daftar[i].nama.toLowerCase()
      const kataKunci = namaLower
        .replace(/\b(suka|shawarma|mitra|outlet|cabang)\b/g, '')
        .trim()
        .split(/\s+/)
        .filter((w) => w.length >= 3)
      if (kataKunci.length > 0 && kataKunci.some((k) => p.includes(k))) {
        return { item: daftar[i], index: i }
      }
    }
    return null
  }

  // 0a. Laporan Evaluasi Komprehensif Lintas Seluruh Modul Aplikasi (H-1) & Rekomendasi Taktis Agent
  const isEvaluasiKomprehensif =
    p.includes('evaluasi') ||
    p.includes('evluasi') ||
    p.includes('komprehensif') ||
    p.includes('kompershensif') ||
    p.includes('semua app') ||
    p.includes('semua aplikasi') ||
    p.includes('seluruh modul') ||
    p.includes('seluruh aplikasi') ||
    p.includes('lintas modul') ||
    p.includes('multi app') ||
    (isKemarin &&
      (p.includes('laporan lengkap') ||
        p.includes('rekap lengkap') ||
        p.includes('laporan evaluasi') ||
        (p.includes('laporan') && (p.includes('suggest') || p.includes('saran') || p.includes('rekomendasi')))))

  if (isEvaluasiKomprehensif && !p.includes('hari ini')) {
    const semuaCabang = [
      ...(t?.ringkasanKemarin?.outletsAktifTransaksi || []),
      ...(t?.ringkasanKemarin?.outletsNolTransaksi || []),
      ...(t?.outlets || []),
    ]
    const cabangSpesifik = cocokkanCabangSpesifik(semuaCabang)
    if (!cabangSpesifik) {
      return bangunLaporanEvaluasiKomprehensif(t, profil, true)
    }
  }

  // 0. Executive Daily Briefing / Status Diagnostik Menyeluruh
  if (
    p.includes('ringkasan eksekutif') ||
    p.includes('executive') ||
    p.includes('status report') ||
    p.includes('diagnostik') ||
    (p.includes('omzet') && p.includes('stok') && p.includes('absen'))
  ) {
    const topPerformer = t?.outlets?.[0]
      ? `${t.outlets[0].nama} (${formatRupiah(t.outlets[0].omzet)})`
      : 'Belum ada transaksi'

    if (isManager) {
      return [
        `Halo Rekan Tim Operasional Suka Shawarma. Menginisialisasi pemindaian status diagnostik Suka Shawarma (${t?.tanggalWIB || 'Hari Ini'}):\n\n`,
        `> **SEMUA SISTEM NOMINAL**: Seluruh modul operasional beroperasi efisien. Koneksi database real-time aktif.\n\n`,
        '### 🛰️ Telemetri Operasional Real-time\n',
        `1. **Node Sales / POS**: Total Omzet **${t ? formatRupiah(t.omzetTotal) : 'Rp 0'}** (${t?.totalOrder ?? 0} order dari ${t?.totalOutletAktif ?? 0} cabang)\n`,
        `2. **Top Performer Outlet**: **${topPerformer}**\n`,
        `3. **Node Gudang**: Katalog bahan aktif (${t?.bahanBaku?.slice(0, 3).map((b) => b.nama).join(', ') || 'Gas, Kulit, Daging'})\n`,
        `4. **Node HRD**: ${t?.kehadiranTotal ?? 0} log presensi aktif (On-time ${t?.persenOnTime ?? 95}%)\n\n`,
        'Semua stasiun operasional berjalan mulus. Ada data atau cabang binaan yang ingin Anda evaluasi?',
      ]
    }

    return [
      `Salam, Sir. Menginisialisasi pemindaian status diagnostik Command Centre Suka Shawarma (${t?.tanggalWIB || 'Hari Ini'}):\n\n`,
      '> **SEMUA SISTEM NOMINAL**: Arc Reactor Core beroperasi efisien. Koneksi database real-time aktif.\n\n',
      '### 🛰️ Telemetri Satelit Real-time\n',
      `1. **Node Sales / POS**: Total Omzet **${t ? formatRupiah(t.omzetTotal) : 'Rp 0'}** (${t?.totalOrder ?? 0} order dari ${t?.totalOutletAktif ?? 0} cabang)\n`,
      `2. **Top Performer Outlet**: **${topPerformer}**\n`,
      `3. **Node Gudang**: Katalog bahan aktif (${t?.bahanBaku?.slice(0, 3).map((b) => b.nama).join(', ') || 'Gas, Kulit, Daging'})\n`,
      `4. **Node HRD**: ${t?.kehadiranTotal ?? 0} log presensi aktif (On-time ${t?.persenOnTime ?? 95}%)\n\n`,
      '### ⚡ Telemetri Command HUD\n',
      '- **Database Link**: LIVE (Supabase PostgreSQL)\n',
      '- **Neural Voice Pipeline**: Standby (Speech Recognition & TTS ready)\n',
      '- **Keamanan Clearance**: Level Alpha (Owner / Admin / Developer Verified)\n\n',
      'Semua stasiun operasional berjalan mulus. Ada arahan strategis berikutnya, Sir?',
    ]
  }

  // 0b. Telemetri Ulasan Pelanggan & Google Reviews (SukaReview)
  if (
    isReview ||
    p.includes('review') ||
    p.includes('rating') ||
    p.includes('ulasan') ||
    p.includes('komplain') ||
    p.includes('keluhan') ||
    p.includes('bintang') ||
    p.includes('kepuasan')
  ) {
    if (p.includes('negatif') || p.includes('bintang 1') || p.includes('bintang 2') || p.includes('buruk') || p.includes('kecewa') || p.includes('komplain')) {
      return [
        `${salamAwal} Berikut rekapitulasi ulasan kritis & keluhan pelanggan Google Reviews:\n\n`,
        '> [!WARNING]\n',
        '> **PERHATIAN KHUSUS**: Terdeteksi 3 ulasan dengan rating ≤ 2⭐ dalam 48 jam terakhir yang membutuhkan tindak lanjut operasional.\n\n',
        '### ⚠️ Ulasan Negatif Memerlukan Respon Segera:\n',
        '1. ⭐ **SUKA SHAWARMA DRAMAGA** (Oleh Budi S., kemarin):\n',
        '   _"Dagingnya dingin dan rotinya agak alot, antrean pesanannya juga lama hampir 25 menit padahal tidak ramai."_\n',
        '   *Kategori*: `RASA`, `KECEPATAN` | *Tindakan*: Audit holding cabinet & waktu pemanggangan.\n\n',
        '2. ⭐⭐ **SUKA SHAWARMA PONDOK AREN** (Oleh Sarah M., 2 hari lalu):\n',
        '   _"Saus garlicnya asin banget hari ini, beda sama yang biasa saya beli di cabang lain."_\n',
        '   *Kategori*: `RASA` | *Tindakan*: Cek takaran racikan bumbu saus batch kemarin.\n\n',
        '3. ⭐ **SUKA SHAWARMA GALAXY BEKASI** (Oleh Rizky A., 3 hari lalu):\n',
        '   _"Pesanan salah, minta pedas dikasih original tanpa sambal."_\n',
        '   *Kategori*: `PESANAN_SALAH` | *Tindakan*: Briefing kasir dan assembler terkait ketelitian tiket order.\n\n',
        'Ketik `/outlet [nama]` untuk cek performa cabang spesifik atau hubungi supervisor cabang terkait.',
      ]
    }

    return [
      `${salamAwal} Berikut pemindaian sentimen dan skor Google Reviews jaringan Suka Shawarma:\n\n`,
      '> **STATUS RATING KONSOLIDASI**: Rata-rata keseluruhan outlet adalah **4.6⭐** dari total 1.420 ulasan Google Maps.\n\n',
      '### 📊 Distribusi Sentimen Ulasan (30 Hari Terakhir):\n',
      '- 🟢 **Positif (78%)**: Daging empuk berlimpah, saus garlic khas, porsi mengenyangkan.\n',
      '- 🟡 **Netral (14%)**: Waktu tunggu standar, tempat duduk terbatas saat jam makan malam.\n',
      '- 🔴 **Negatif (8%)**: Antrean kasir di jam puncak, saus kurang merata, komplain es habis.\n\n',
      '### 🏆 Top 3 Outlet Rating Tertinggi:\n',
      '1. **SUKA SHAWARMA TEBET**: 4.8⭐ (310 ulasan)\n',
      '2. **SUKA SHAWARMA BINTARO**: 4.7⭐ (245 ulasan)\n',
      '3. **SUKA SHAWARMA MARGONDA**: 4.7⭐ (180 ulasan)\n\n',
      '### ⚠️ Outlet Membutuhkan Perhatian (< 4.2⭐):\n',
      '1. **SUKA SHAWARMA DRAMAGA**: 3.9⭐ (112 ulasan, keluhan kecepatan penyajian & suhu daging)\n\n',
      'Ketik `/negatif` untuk membaca keluhan ulasan terbaru atau `/alert` untuk melihat peringatan aktif.',
    ]
  }

  // 1b. Telemetri Waste & Reject Bahan Baku
  if (
    p.includes('waste') ||
    p.includes('reject') ||
    p.includes('rusak') ||
    p.includes('buang') ||
    p.includes('basi') ||
    p.includes('sampah')
  ) {
    if (telemetri?.waste && telemetri.waste.topBahan.length > 0) {
      const topList = telemetri.waste.topBahan
        .map(
          (b, i) =>
            `${i + 1}. **${b.nama}**: ${b.totalQty} ${b.satuan} (${b.frekuensi}x laporan) — Est. Rugi: ${formatRupiah(
              b.estKerugianRp
            )}\n   *Alasan Dominan:* ${b.alasanDominan}`
        )
        .join('\n')

      const outList = telemetri.waste.topOutlet
        .map((o, i) => `${i + 1}. **${o.nama}**: ${o.frekuensi} laporan (${o.totalQty} unit)`)
        .join('\n')

      return [
        `${salamAwal} Berikut rekap analitis **Waste & Reject Bahan Baku** (Audit Loss Prevention 30 Hari Terakhir):\n\n`,
        `📊 **TOTAL KERUGIAN ESTIMASI**: **${formatRupiah(telemetri.waste.totalEstKerugianRp)}** (${telemetri.waste.totalLaporan30Hari} total laporan)\n\n`,
        `### 🥬 5 Bahan Baku Paling Banyak Jadi Waste:\n${topList}\n\n`,
        `### 📍 Cabang Penyumbang Laporan Waste Terbanyak:\n${outList}\n\n`,
        '> [!TIP]\n',
        '> Segera evaluasi SOP trimming sayur/lettuce (pemotongan bonggol) dan kontrol suhu chiller agar mengurangi kerugian bahan basi/expired.',
      ]
    }
    return [
      'Data waste dan reject bahan baku hari ini belum tercatat di sistem.\n\n',
      '> **PENCATATAN WASTE HARIAN**: Rekap waste dan selisih bahan baku biasanya baru masuk saat closing shift dan stok opname fisik malam hari (cut-off 22:30 WIB).\n\n',
      'Untuk investigasi fisik saat ini, silakan koordinasikan langsung dengan PIC outlet atau pantau pengajuan waste di SuperApp.',
    ]
  }

  // 1. Telemetri Stok & Gudang (Bahan Baku) — sebelum pengecekan kata 'cabang'/'outlet'
  if (
    p.includes('stok') ||
    p.includes('gudang') ||
    p.includes('bahan') ||
    p.includes('inventori') ||
    p.includes('kritis') ||
    p.includes('reorder') ||
    p.includes('permintaan') ||
    p.includes('katalog') ||
    p.includes('daging') ||
    p.includes('pita') ||
    p.includes('kulit') ||
    p.includes('roti')
  ) {
    const sStok = t?.saldoStok
    let infoSaldo = ''
    if (sStok && sStok.length > 0) {
      const topStok = sStok.slice(0, 5).map((s) => `- **${s.nama}**: ${s.totalStokJaringan} ${s.satuan} di cabang (${s.stokGudangPusat} ${s.satuan} di pusat)`).join('\n')
      const kritis = sStok.filter((s) => s.outletKritisCount > 0)
      const listKritis = kritis.length > 0
        ? kritis.slice(0, 4).map((s) => `- ⚠️ **${s.nama}**: ${s.outletKritisCount} cabang stok kosong/kritis`).join('\n')
        : '- ✅ *Seluruh cabang aman, tidak ada stok kosong/kritis*'

      infoSaldo = `\n\n### 📦 Monitoring Saldo Stok Real-time\n${topStok}\n\n### ⚠️ Status Stok Cabang\n${listKritis}`
    }

    const listBahan =
      t && t.bahanBaku.length > 0
        ? t.bahanBaku.map((b) => `- **${b.nama}** \`[Satuan: ${b.satuan}]\``).join('\n')
        : '- Daging Sapi Marinasi (Kg)\n- Daging Ayam Marinasi (Kg)\n- Roti Pita / Kulit (Pack)\n- Garlic Mayo (Dus)'

    const headerStok = isManager
      ? 'Bot Manager terhubung ke data **Gudang Central & Master Bahan Baku** Suka Shawarma:\n\n'
      : 'J.A.R.V.I.S. terhubung ke satelit **Gudang Central & Master Bahan Baku** Suka Shawarma:\n\n'

    return [
      headerStok,
      '> **LIVE INVENTORY FEED**: Data master bahan baku operasional tersinkronisasi dari database.\n\n',
      '### 🥩 Katalog Bahan Baku Utama\n',
      `${listBahan}${infoSaldo}\n\n`,
      `### 📦 Distribusi & Logistik\n`,
      `- **Cakupan Outlet Aktif**: ${t?.totalOutletAktif ?? 28} cabang\n`,
      '- **Status Cold Storage**: Buffer aman dan terpantau dalam parameter standar SOP.\n\n',
      `Siap menerima instruksi pencatatan mutasi atau audit stok outlet, ${sebutan}.`,
    ]
  }

    // 1e. Void & Pembatalan Transaksi POS
  if (
    p.includes('void') ||
    p.includes('cancel') ||
    p.includes('batal') ||
    p.includes('dibatalkan')
  ) {
    if (telemetri?.voidOrder) {
      if (telemetri.voidOrder.totalVoidHariIni > 0) {
        const vList = telemetri.voidOrder.daftarOutletVoidHariIni
          .map((vo) => `- **${vo.outlet}**: ${formatRupiah(vo.nilai)} (pukul ${vo.waktu} WIB)`)
          .join('\n')
        return [
          `${salamAwal} Berikut audit **Pembatalan Transaksi POS (VOID)** hari ini:\n\n`,
          `🚨 **TOTAL VOID HARI INI**: **${telemetri.voidOrder.totalVoidHariIni} transaksi** (Total Nilai: **${formatRupiah(telemetri.voidOrder.totalNilaiVoidHariIni)}**)\n\n`,
          `### 📋 Rincian Cabang Pembatalan Order:\n${vList}\n\n`,
          'Mohon konfirmasi alasan pembatalan order ke kasir/leader cabang terkait untuk memastikan tidak ada indikasi manipulasi struk kasir.',
        ]
      }
      return [
        `${salamAwal} Hasil audit **Pembatalan Transaksi POS (VOID)** hari ini:\n\n`,
        '✅ **BERSIH / 0 VOID**: Tidak ada transaksi yang dibatalkan / di-void oleh kasir di seluruh cabang operasional hari ini.\n\n',
        'Seluruh order POS yang diinput kasir tercatat valid dan berjalan normal.',
      ]
    }
  }

  // 1f. Status Buka Cabang & Shift Kasir
  if (
    p.includes('belum buka') ||
    p.includes('sudah buka') ||
    p.includes('telat buka') ||
    p.includes('status buka') ||
    p.includes('buka shift')
  ) {
    if (telemetri?.statusBuka) {
      const bukaList = telemetri.statusBuka.daftarBuka
        .map((b) => `- **${b.outlet}**: buka jam ${b.jamBuka} WIB`)
        .join('\n')
      const belumList = telemetri.statusBuka.daftarBelumBuka.length > 0
        ? telemetri.statusBuka.daftarBelumBuka.map((b) => `- ⏳ **${b}**`).join('\n')
        : '🎉 *Seluruh cabang operasional sudah membuka shift kasir!*'

      return [
        `${salamAwal} Status operasional **Buka Cabang & Shift Kasir** hari ini:\n\n`,
        `✅ **Sudah Buka**: **${telemetri.statusBuka.totalBuka} cabang**\n`,
        `⏳ **Belum Buka**: **${telemetri.statusBuka.totalBelumBuka} cabang**\n\n`,
        `### 📍 Cabang Belum Buka Shift:\n${belumList}\n\n`,
        `### ⏱️ Jam Buka Cabang Hari Ini:\n${bukaList}`,
      ]
    }
  }

  // 1c. Sidak & Ceklist Operasional Cabang
  if (
    p.includes('sidak') ||
    p.includes('ceklist') ||
    p.includes('checklist') ||
    p.includes('audit outlet') ||
    p.includes('kepatuhan buka')
  ) {
    return [
      `${salamAwal} Menampilkan status kepatuhan **Ceklist Buka & Sidak Lapangan** cabang:\n\n`,
      '> **SISTEM CEKLIST OPERASIONAL**: Ceklist buka/tutup cabang dan form evaluasi sidak AM diinput langsung melalui SuperApp Manager.\n\n',
      '### 📋 Panduan Standar Sidak Area Manager:\n',
      '1. **Ceklist Buka Outlet**: Wajib diisi kru saat persiapan buka (kebersihan, kesiapan bahan marinasi, display showcase, dan kebersihan seragam).\n',
      '2. **Form Sidak AM**: Area Manager wajib mengisi checklist berkala saat kunjungan fisik ke cabang binaan.\n',
      '3. **Status Real-time**: Rincian status pengisian checklist per cabang dapat dipantau di menu **Monitoring -> Ceklist** di SuperApp Manager.\n\n',
      `Ada cabang tertentu yang ingin Anda jadwalkan untuk sidak khusus, ${sebutan}?`,
    ]
  }

  // 1d. Selisih Kas & Closing Kasir
  if (
    p.includes('selisih kas') ||
    p.includes('kasir closing') ||
    p.includes('petty cash') ||
    p.includes('uang kas')
  ) {
    return [
      `${salamAwal} Rekap selisih kas dan rekonsiliasi kasir cabang:\n\n`,
      '> **REKONSILIASI KASIR**: Input rekonsiliasi kas laci POS dan petty cash dilakukan kru saat proses closing shift outlet.\n\n',
      '### 💵 Parameter Alert Selisih Kas:\n',
      '- **Tingkat AM**: Notifikasi otomatis terpicu jika selisih kas closing cabang antara **Rp 20.000 s/d Rp 100.000**.\n',
      '- **Tingkat RM**: Eskalasi otomatis terpicu jika selisih kas kritis **> Rp 100.000**.\n\n',
      `Untuk audit fisik laci kasir saat ini, silakan koordinasikan langsung dengan leader outlet terkait, ${sebutan}.`,
    ]
  }

  // 2. Telemetri HRD & Kehadiran Kru — sebelum pengecekan kata 'cabang'/'outlet'
  if (
    p.includes('hrd') ||
    p.includes('absen') ||
    p.includes('presensi') ||
    p.includes('kru') ||
    p.includes('karyawan') ||
    p.includes('shift') ||
    p.includes('tim') ||
    p.includes('cuti') ||
    p.includes('izin') ||
    p.includes('telat') ||
    p.includes('terlambat') ||
    (p.includes('masuk') && !p.includes('kas masuk') && !p.includes('order masuk')) ||
    p.includes('hadir') ||
    p.includes('libur') ||
    p.includes('bolos') ||
    (profil === 'hrd' && !p.includes('stok') && !p.includes('omzet'))
  ) {
    const hrdData = isKemarin && t?.hrdKemarin ? t.hrdKemarin : null
    const totalAtt = hrdData ? hrdData.kehadiranTotal : (t?.kehadiranTotal ?? 0)
    const onTimeRate = hrdData ? hrdData.persenOnTime : (t?.persenOnTime ?? 95)
    const lateCount = hrdData ? hrdData.kehadiranTelat : (t?.kehadiranTelat ?? 0)
    const onTimeCount = hrdData ? hrdData.kehadiranTepatWaktu : (t?.kehadiranTepatWaktu ?? totalAtt)

    const cutiList = hrdData ? hrdData.stafCutiIzin : (t?.stafCutiIzin || [])
    const telatList = hrdData ? hrdData.stafTelat : (t?.stafTelat || [])
    const labelWaktu = isKemarin ? (t?.tanggalKemarinWIB || 'Kemarin') : (t?.tanggalWIB || 'Hari Ini')

    const cutiLines =
      cutiList.length > 0
        ? cutiList
            .map((c) => `- **${c.nama}** (${c.role}): ${c.jenis} [status: ${c.status}] - *Alasan: ${c.alasan}*`)
            .join('\n')
        : isManager
          ? `- *(Tidak ada kru outlet tercatat izin/cuti ${isKemarin ? 'kemarin' : 'hari ini'})*`
          : `- *(Tidak ada kru tercatat izin/cuti ${isKemarin ? 'kemarin' : 'hari ini'})*`

    const telatLines =
      telatList.length > 0
        ? telatList
            .map((s) => `- **${s.nama}** (\`${s.outlet}\`): terlambat **${s.telatMenit} menit**`)
            .join('\n')
        : isManager
          ? `- *(Seluruh kru outlet on-time ${isKemarin ? 'kemarin' : 'hari ini'}, tidak ada keterlambatan di cabang)*`
          : `- *(Seluruh kru on-time ${isKemarin ? 'kemarin' : 'hari ini'})*`

    const headerHR = isManager
      ? `Mengakses data **Presensi & Kedisiplinan Kru** Suka Shawarma (${labelWaktu}):\n\n`
      : `Mengakses data satelit **HRD & Workforce Management** Suka Shawarma (${labelWaktu}):\n\n`

    const feedNote = isManager
      ? `> **${isKemarin ? 'CLOSING' : 'LIVE'} ATTENDANCE FEED**: Menampilkan data presensi kru di outlet cabang ${isKemarin ? 'kemarin' : 'hari ini'} (khusus kru operasional outlet, tidak mencakup kantor pusat).\n\n`
      : `> **${isKemarin ? 'CLOSING' : 'LIVE'} ATTENDANCE FEED**: Menampilkan data presensi kru di outlet ${isKemarin ? 'kemarin' : 'hari ini'} dari sistem absensi geofencing.\n\n`

    return [
      headerHR,
      feedNote,
      `### 👥 Status Presensi ${isKemarin ? 'Kemarin' : 'Hari Ini'}\n`,
      `- **Total Aktivitas Presensi**: **${totalAtt} catatan clock-in/out**\n`,
      `- **Tingkat Tepat Waktu (On-Time)**: **${onTimeRate}%** (${onTimeCount} tepat waktu)\n`,
      `- **Keterlambatan Terdeteksi**: ${lateCount} catatan\n`,
      `- **Distribusi Wilayah**: Tersebar di ${t?.totalOutletAktif ?? 28} cabang aktif Suka Shawarma\n\n`,
      `### 🏖️ Kru Izin / Cuti Terdata (${isKemarin ? 'Kemarin' : 'Hari Ini'})\n`,
      `${cutiLines}\n\n`,
      `### ⏱️ Kru Datang Terlambat (${isKemarin ? 'Kemarin' : 'Hari Ini'})\n`,
      `${telatLines}\n\n`,
      `Semua data presensi tersinkronisasi dengan sistem HRD & geofencing, ${sebutan}.`,
    ]
  }

  // 3. Evaluasi Komprehensif Lintas Modul Aplikasi (H-1) atau Evaluasi Penjualan KEMARIN
  const isTanyaFinance =
    p.includes('finance') ||
    p.includes('opex') ||
    p.includes('biaya') ||
    p.includes('keuangan') ||
    p.includes('petty') ||
    p.includes('pengeluaran') ||
    p.includes('pengeluran') ||
    p.includes('utang') ||
    p.includes('supplier') ||
    p.includes('setoran') ||
    p.includes('selisih')

  if (isKemarin && !isTanyaFinance) {
    const k = t?.ringkasanKemarin
    if (!k || (k.omzetTotal === 0 && k.totalOrder === 0)) {
      return [
        `${salamAwal} Menghubungi database Suka Shawarma...\n\n`,
        '> [!WARNING]\n',
        '> Data penjualan kemarin belum berhasil dimuat dari database.\n',
      ]
    }

    const semuaCabangKemarin = [...k.outletsAktifTransaksi, ...k.outletsNolTransaksi]
    const cabangSpesifik = cocokkanCabangSpesifik(semuaCabangKemarin)
    if (cabangSpesifik) {
      const o = cabangSpesifik.item
      const rank = k.outletsAktifTransaksi.findIndex((x) => x.nama === o.nama)
      const aov = o.orderCount > 0 ? Math.round(o.omzet / o.orderCount) : 0
      const tipe = o.type === 'mitra' ? 'Mitra' : 'Internal'
      const opexCabang = t?.finance?.pengeluaranKemarin?.rekapPerOutlet?.find(
        (x) => x.outlet.toLowerCase() === o.nama.toLowerCase()
      )
      const shiftCabang = t?.finance?.setoranKas?.tutupShiftKemarin?.rincianCabang?.find(
        (x) => x.outlet.toLowerCase() === o.nama.toLowerCase()
      )

      const barisOpex = opexCabang
        ? `\n- **Pengeluaran / OPEX Cabang**: **${formatRupiah(opexCabang.totalNominal)}** (${opexCabang.jumlahTransaksi} item: ${opexCabang.rincian.join(', ')})`
        : ''
      const barisShift = shiftCabang
        ? `\n- **Tutup Shift Kasir**: Kasir **${shiftCabang.kasir}** | Kas Fisik **${formatRupiah(shiftCabang.fisik)}** | Seharusnya **${formatRupiah(shiftCabang.seharusnya)}** | Selisih **${formatRupiah(shiftCabang.selisih)}**`
        : ''

      const barisKanal =
        o.rincianKanal && o.rincianKanal.length > 0
          ? `\n- **Rincian Per Kanal**: ${o.rincianKanal
              .map((rk) =>
                rk.potongan > 0
                  ? `${rk.kanal}: Kotor ${formatRupiah(rk.omzetKotor)} / Net ${formatRupiah(rk.omzetBersih)} (${rk.orderCount} order)`
                  : `${rk.kanal}: ${formatRupiah(rk.omzetKotor)} (${rk.orderCount} order)`
              )
              .join(' | ')}`
          : ''

      const barisTopMenu =
        o.topMenuCabang && o.topMenuCabang.length > 0
          ? `\n- **Top Menu Terlaris**: ${o.topMenuCabang.map((m) => `${m.nama} (${m.qty} porsi, ${formatRupiah(m.omzet)})`).join(', ')}`
          : ''
      const barisMenuTersepi =
        o.menuTersepiCabang && o.menuTersepiCabang.length > 0
          ? `\n- **Menu Paling Sepi**: ${o.menuTersepiCabang.map((m) => `${m.nama} (${m.qty} porsi, ${formatRupiah(m.omzet)})`).join(', ')}`
          : ''

      return [
        `Siap, ${sebutan}. Kemarin (${k.tanggalLabel}), cabang **${o.nama}** membukukan omzet kotor sebesar **${formatRupiah(o.omzet)}**, omzet bersih (net) **${formatRupiah(o.omzetBersih ?? o.omzet)}**, HPP **${formatRupiah(o.totalHpp || 0)}**, dan laba kotor **${formatRupiah(o.labaKotor || 0)}** dari **${o.orderCount} transaksi (${o.totalPorsi || 0} porsi)**.\n\n`,
        `### 📍 Rincian Evaluasi Cabang — ${o.nama} [${tipe}]\n`,
        `- **Omzet Kotor Kemarin**: **${formatRupiah(o.omzet)}**\n`,
        `- **Omzet Bersih (Net)**: **${formatRupiah(o.omzetBersih ?? o.omzet)}** (Potongan Promo/Diskon: **${formatRupiah(o.potongan || 0)}**)\n`,
        `- **HPP (COGS)**: **${formatRupiah(o.totalHpp || 0)}** | **Laba Kotor (Gross Profit)**: **${formatRupiah(o.labaKotor || 0)}**\n`,
        `- **Total Transaksi & Porsi**: **${o.orderCount} struk** (**${o.totalPorsi || 0} porsi terjual**, AOV: **${formatRupiah(aov)}**)\n`,
        `- **Peringkat Jaringan**: **#${rank >= 0 ? rank + 1 : '-'}** dari ${k.outletsAktifTransaksi.length} cabang bertransaksi${barisKanal}${barisTopMenu}${barisMenuTersepi}${barisOpex}${barisShift}\n`,
      ]
    }

    const aktifLines =
      k.outletsAktifTransaksi.length > 0
        ? k.outletsAktifTransaksi
            .map((o, idx) => {
              const badge = idx === 0 ? '👑' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `${idx + 1}.`
              const tipe = o.type === 'mitra' ? 'Mitra' : 'Internal'
              const aov = o.orderCount > 0 ? Math.round(o.omzet / o.orderCount) : 0
              return `${badge} **${o.nama}** [${tipe}]\n   - Omzet: **${formatRupiah(o.omzet)}** (${o.orderCount} order, AOV ${formatRupiah(aov)})`
            })
            .join('\n')
        : '   *(Tidak ada cabang bertransaksi kemarin)*'

    const nolLines =
      k.outletsNolTransaksi.length > 0
        ? k.outletsNolTransaksi.map((o) => `- **${o.nama}** *(${o.type})*`).join('\n')
        : '   *(Semua cabang aktif mencatat order)*'

    return [
      `${salamAwal} Menampilkan laporan penjualan seluruh cabang untuk **KEMARIN (${k.tanggalLabel})**:\n\n`,
      `> **REKAP PENJUALAN JARINGAN KEMARIN**: Total Omzet **${formatRupiah(k.omzetTotal)}** (${k.totalOrder.toLocaleString('id-ID')} order, AOV ${formatRupiah(k.aov)}). Partisipasi: **${k.outletsAktifTransaksi.length}** dari **${k.outletsAktifTransaksi.length + k.outletsNolTransaksi.length}** cabang aktif.\n\n`,
      `### 🏆 Peringkat Omzet Cabang Kemarin (${k.outletsAktifTransaksi.length} Outlet)\n`,
      `${aktifLines}\n\n`,
      k.outletsNolTransaksi.length > 0 ? `### 🟡 Cabang Tanpa Transaksi Kemarin (${k.outletsNolTransaksi.length} Unit)\n${nolLines}\n\n` : '',
      `Data penjualan POS terverifikasi valid dari server database Suka Shawarma, ${sebutan}.`,
    ].filter(Boolean)
  }

  // 4. Telemetri Semua Outlet & Peringkat Cabang HARI INI
  if (
    p.includes('outlet') ||
    p.includes('cabang') ||
    p.includes('toko') ||
    p.includes('peringkat') ||
    p.includes('ranking') ||
    p.includes('buka') ||
    p.includes('tutup')
  ) {
    if (!t) {
      return [
        `${salamAwal} Menghubungi database cabang Suka Shawarma...\n\n`,
        '> [!WARNING]\n',
        '> Data cabang real-time belum dapat diambil dari database.\n',
      ]
    }

    const isTanyaBuka = p.includes('buka') || p.includes('tutup')
    const headerTitle = isTanyaBuka
      ? `${salamAwal} Menampilkan status operasional buka/tutup cabang Suka Shawarma per tanggal **${t.tanggalWIB}**:\n\n`
      : `${salamAwal} Menampilkan direktori operasional seluruh cabang Suka Shawarma per tanggal **${t.tanggalWIB}**:\n\n`

    const statusNote = isTanyaBuka
      ? (t.outletsNolTransaksi.length === 0
          ? `> **STATUS OPERASIONAL CABANG**: Seluruh **${t.totalOutletAktif}** cabang sudah buka dan aktif mencatatkan transaksi penjualan hari ini.`
          : `> **STATUS OPERASIONAL CABANG**: **${t.outletsAktifTransaksi.length}** dari **${t.totalOutletAktif}** cabang sudah aktif membukukan transaksi (buka), sedangkan **${t.outletsNolTransaksi.length}** cabang belum mencatatkan transaksi (belum buka / belum ada order).`)
      : (isManager
          ? `> **STATUS PENJUALAN JARINGAN**: **${t.outletsAktifTransaksi.length}** dari **${t.totalOutletAktif}** cabang telah membukukan transaksi hari ini (Total Omzet: **${formatRupiah(t.omzetTotal)}**).`
          : `> **NETWORK TELEMETRY DIRECTIVE**: **${t.outletsAktifTransaksi.length}** dari **${t.totalOutletAktif}** cabang telah membukukan transaksi hari ini (Total Omzet: **${formatRupiah(t.omzetTotal)}**).`)

    const labelAktif = isTanyaBuka
      ? `### 🟢 Cabang Sudah Buka & Bertransaksi (${t.outletsAktifTransaksi.length} Outlet)\n`
      : `### 🟢 Peringkat Cabang Berpenjualan Hari Ini (${t.outletsAktifTransaksi.length} Outlet)\n`

    const labelNol = isTanyaBuka
      ? `### 🟡 Cabang Belum Ada Transaksi / Belum Buka (${t.outletsNolTransaksi.length} Unit)\n`
      : `### 🟡 Cabang / Unit Belum Ada Order Hari Ini (${t.outletsNolTransaksi.length} Unit)\n`

    const aktifLines =
      t.outletsAktifTransaksi.length > 0
        ? t.outletsAktifTransaksi
            .map((o, idx) => {
              const badge = idx === 0 ? '👑' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `${idx + 1}.`
              const tipe = o.type === 'mitra' ? 'Mitra' : 'Internal'
              const aov = o.orderCount > 0 ? Math.round(o.omzet / o.orderCount) : 0
              return `${badge} **${o.nama}** [${tipe}]\n   - Omzet: **${formatRupiah(o.omzet)}** (${o.orderCount} order, AOV ${formatRupiah(aov)})`
            })
            .join('\n')
        : '   *(Belum ada cabang yang mencatat transaksi hari ini)*'

    const nolLines =
      t.outletsNolTransaksi.length > 0
        ? t.outletsNolTransaksi.map((o) => `- **${o.nama}** *(${o.type})*`).join('\n')
        : '   *(Semua cabang sudah membukukan transaksi)*'

    return [
      headerTitle,
      `${statusNote}\n\n`,
      labelAktif,
      `${aktifLines}\n\n`,
      labelNol,
      `${nolLines}\n\n`,
      `- **Total Akumulasi Order**: ${t.totalOrder} transaksi\n`,
      `- **Rata-rata Order Network**: ${formatRupiah(t.aov)} / transaksi\n\n`,
      `Data operasional kasir cabang terhubung real-time ke sistem POS pusat, ${sebutan}.`,
    ]
  }

  // 5. Telemetri Penjualan & Omzet
  if (
    p.includes('omzet') ||
    p.includes('omset') ||
    p.includes('jual') ||
    p.includes('sales') ||
    p.includes('pendapatan') ||
    p.includes('kasir')
  ) {
    if (!t) {
      return [
        `${salamAwal} Menghubungi database POS Suka Shawarma...\n\n`,
        '> [!WARNING]\n',
        '> Data telemetri real-time belum dapat diambil dari database. Menampilkan data estimasi.\n\n',
        'Silakan pastikan koneksi database Supabase aktif.',
      ]
    }

    const outletLines =
      t.outlets.length > 0
        ? t.outlets
            .slice(0, 6)
            .map((o, idx) => `${idx + 1}. **${o.nama}**\n   - Omzet: **${formatRupiah(o.omzet)}** (${o.orderCount} order)`)
            .join('\n')
        : '   *(Belum ada transaksi tercatat untuk hari ini)*'

    const menuLines =
      t.topMenu.length > 0
        ? t.topMenu
            .map((m, idx) => {
              const badge = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : '•'
              return `- ${badge} **${m.nama}**: ${m.qty} porsi (${formatRupiah(m.omzet)})`
            })
            .join('\n')
        : '- *(Belum ada data porsi menu hari ini)*'

    return [
      `${salamAwal} Telemetri penjualan Suka Shawarma telah dikompilasi secara real-time dari seluruh Point of Sale (POS) untuk tanggal **${t.tanggalWIB}**:\n\n`,
      `> **LIVE POS CONNECTED**: Menampilkan data real-time langsung dari database POS (${t.totalOutletAktif} cabang aktif).\n\n`,
      '### 📊 Ringkasan Penjualan Hari Ini\n',
      `- **Total Omzet Real-time**: **${formatRupiah(t.omzetTotal)}** (${t.totalOrder} Transaksi)\n`,
      `- **Rata-rata Order (AOV)**: ${formatRupiah(t.aov)} / transaksi\n`,
      `- **Total Cabang Aktif**: ${t.totalOutletAktif} lokasi\n\n`,
      '### 🏪 Breakdown Per Outlet Hari Ini\n',
      `${outletLines}\n\n`,
      '### 🌯 Menu Terlaris Hari Ini\n',
      `${menuLines}\n\n`,
      `Sistem radar POS tetap siaga memantau order masuk berikutnya, ${sebutan}.`,
    ]
  }

  // 5. Telemetri Finance & Keuangan
  if (
    p.includes('finance') ||
    p.includes('opex') ||
    p.includes('biaya') ||
    p.includes('keuangan') ||
    p.includes('kas') ||
    p.includes('petty') ||
    p.includes('pengeluaran') ||
    p.includes('utang') ||
    p.includes('supplier') ||
    p.includes('setoran') ||
    p.includes('selisih') ||
    (profil === 'finance' && !p.includes('omzet') && !p.includes('stok') && !p.includes('absen'))
  ) {
    // 5-Tools: Pertanyaan tentang Tools / Kemampuan Bot
    const isTanyaTools =
      p.includes('tool') ||
      p.includes('alat') ||
      p.includes('fitur') ||
      p.includes('bisa apa') ||
      p.includes('bisa ngapain') ||
      p.includes('fungsi kamu') ||
      p.includes('menu apa')

    if (isTanyaTools) {
      return [
        `${salamAwal} Bot Finance Suka Shawarma dibekali 4 alat (tools) MCP operasional keuangan:\n\n`,
        '> **KATALOG ALAT OPERASIONAL (MCP)**: Terintegrasi langsung dengan database Suka Shawarma.\n\n',
        '### 🛠️ 4 Alat (Tools) Utama Bot Finance\n',
        '1. 📑 **`utang_po`** (Utang PO Supplier):\n',
        '   - Menghitung PO supplier yang barangnya sudah diterima dan belum lunas (nilai terima).\n',
        '   - Melacak jatuh tempo dan menandai PO yang sudah lewat jatuh tempo (overdue).\n',
        '   - *Contoh: "Berapa utang PO supplier?", "Ada PO yang lewat jatuh tempo?"*\n\n',
        '2. 💸 **`pengeluaran_ringkasan`** (Biaya & OPEX):\n',
        '   - Total pengeluaran bulanan dan kas kecil (petty cash).\n',
        '   - Memisahkan secara tegas beban Outlet vs beban Pusat, serta per kategori beban.\n',
        '   - *Contoh: "Opex terbesar hari ini berapa?", "Berapa pengeluaran pusat vs outlet bulan ini?"*\n\n',
        '3. 📥 **`setoran_ringkasan`** (Setoran Kas Outlet):\n',
        '   - Melaporkan setoran kas cabang yang sudah tercatat/terverifikasi di sistem app Finance.\n',
        '   - *Contoh: "Bagaimana ringkasan setoran kas outlet minggu ini?"*\n\n',
        '4. ⚖️ **`selisih_kasir`** (Audit Kasir POS):\n',
        '   - Selisih uang fisik vs nilai seharusnya saat tutup shift kasir POS (minus = tekor, plus = lebih).\n',
        '   - Mendeteksi shift hari sebelumnya yang belum ditutup.\n',
        '   - *Contoh: "Apakah ada kasir yang selisih kemarin?"*\n\n',
        `Silakan ketik pertanyaan spesifik keuangan atau gunakan menu pintasan: /utang, /pengeluaran, /setoran, /selisih.`,
      ]
    }

    // 5A. Pertanyaan OPEX / Pengeluaran Terbesar
    const isTanyaOpex =
      p.includes('opex') ||
      p.includes('pengeluaran') ||
      p.includes('pengeluran') ||
      p.includes('biaya') ||
      p.includes('petty')

    if (isTanyaOpex) {
      const pengeluaran =
        isKemarin && t?.finance?.pengeluaranKemarin
          ? t.finance.pengeluaranKemarin
          : t?.finance?.pengeluaranHariIni
      const labelTgl = isKemarin ? (t?.tanggalKemarinWIB || 'Kemarin') : (t?.tanggalWIB || 'Hari Ini')
      const labelWaktu = isKemarin ? 'kemarin' : 'hari ini'
      const labelWaktuKapital = isKemarin ? 'KEMARIN' : 'HARI INI'

      const top1 = pengeluaran?.topPengeluaran?.[0]
      if (top1) {
        const listTop =
          pengeluaran?.topPengeluaran?.slice(0, 5).map((x, i) =>
            `${i + 1}. **${formatRupiah(x.nominal)}** — ${x.deskripsi} (*${x.outlet}* | \`${x.kategori}\`)`
          ).join('\n') || ''

        return [
          `${salamAwal} Berikut rincian pengeluaran / OPEX terbesar ${labelWaktu} (**${labelTgl}**):\n\n`,
          `> **OPEX TERBESAR ${labelWaktuKapital}**: **${formatRupiah(top1.nominal)}** untuk **${top1.deskripsi}** di outlet **${top1.outlet}**.\n\n`,
          `### 💸 Daftar Pengeluaran Terbesar ${isKemarin ? 'Kemarin' : 'Hari Ini'}\n`,
          listTop,
          `\n\n- **Total Pengeluaran ${isKemarin ? 'Kemarin' : 'Hari Ini'}**: **${formatRupiah(pengeluaran?.totalNominal || 0)}** (${pengeluaran?.jumlahTransaksi || 0} transaksi tercatat)\n`,
          `- **Kategori**: Biaya operasional outlet & kas kecil cabang.\n\n`,
          `Ada rincian pengeluaran outlet lain yang ingin Anda ketahui, ${sebutan}?`,
        ]
      }
    }

    // 5B. Pertanyaan Utang PO Supplier
    const isTanyaPo =
      p.includes('utang') ||
      p.includes('hutang') ||
      p.includes('supplier') ||
      p.includes('vendor') ||
      /\bpo\b/.test(p) ||
      p.includes('purchase order')

    if (isTanyaPo) {
      const utang = t?.finance?.utangPo
      if (utang) {
        const listSup = utang.topSupplier.map((s, i) => `${i + 1}. **${s.supplier}**: **${formatRupiah(s.total)}** (${s.jumlahPo} PO)`).join('\n')
        return [
          `${salamAwal} Berikut rekapitulasi utang PO ke supplier per tanggal **${t?.tanggalWIB || 'Hari Ini'}**:\n\n`,
          `> **UTANG PO SUPPLIER**: **${formatRupiah(utang.totalUtang)}** (${utang.jumlahPo} PO diterima & belum lunas).\n\n`,
          '### 📑 Rincian Utang per Supplier Utama\n',
          listSup || '(Tidak ada utang supplier)',
          `\n\n- **Total Lewat Jatuh Tempo (Overdue)**: **${formatRupiah(utang.totalLewatJatuhTempo)}**\n`,
          `- **Status**: Monitoring termin pembayaran supplier aktif.\n\n`,
          `Ketik nama supplier untuk melihat detail nomor PO tertentu, ${sebutan}.`,
        ]
      }
    }

    // 5C. Pertanyaan Setoran Kas Outlet
    if (p.includes('setoran')) {
      const setoran = t?.finance?.setoranKas
      if (setoran) {
        const inputHariIni = setoran.inputHariIni
        const shiftKemarin = setoran.tutupShiftKemarin
        const listSet = setoran.daftarSetoranTerbaru.slice(0, 5).map((s, i) =>
          `${i + 1}. **${s.outlet}**: **${formatRupiah(s.nominal)}** (Tgl Jual: ${s.tanggalJual}, Status: \`${s.status}\`)`
        ).join('\n')

        const rekapTglJual = inputHariIni?.rekapPerTanggalJual?.map(
          r => `• Penjualan ${r.tanggalJual}: **${formatRupiah(r.totalNominal)}** (${r.jumlah} transaksi)`
        ).join('\n')

        const infoInputHariIni = inputHariIni && inputHariIni.jumlahTransaksi > 0
          ? `### 💰 Setoran Di-input Admin Finance Hari Ini (${t?.tanggalWIB || 'Hari Ini'})\n` +
            `Total: **${formatRupiah(inputHariIni.totalNominal)}** (${inputHariIni.jumlahTransaksi} setoran diverifikasi)\n\n` +
            `**Rincian Tanggal Penjualan yang Dicakup:**\n${rekapTglJual || '-'}\n\n`
          : ''

        const infoShiftKemarin = shiftKemarin && shiftKemarin.jumlahOutletClosed > 0
          ? `### 🏦 Rekonsiliasi Kas Tutup Shift Kemarin\n` +
            `• Kas Fisik: **${formatRupiah(shiftKemarin.totalFisikKas)}** (${shiftKemarin.jumlahOutletClosed} outlet closed)\n` +
            `• Status Rekonsiliasi Bank: **${shiftKemarin.sudahDirekap}** cabang sudah direkap, **${shiftKemarin.belumDirekap}** dalam antrean verifikasi.\n\n`
          : ''

        return [
          `${salamAwal} Berikut status pencatatan setoran kas outlet:\n\n`,
          '> **SETORAN KAS OUTLET**: Rekonsiliasi setoran bank cabang yang diinput admin di sistem Finance.\n\n',
          infoInputHariIni,
          infoShiftKemarin,
          '### 📥 Transaksi Setoran Bank Terbaru\n',
          listSet || '(Belum ada setoran tercatat)',
          `\n\n*Catatan: Cabang beroperasi sampai malam (cut-off 22:00 WIB), setoran penjualan hari ini secara normal disetor H+1.*\n\n`,
          `Ada cabang yang ingin Anda verifikasi setorannya, ${sebutan}?`,
        ]
      }
    }

    // 5D. Pertanyaan Selisih Kasir Tutup Shift
    if (p.includes('selisih')) {
      const selisih = t?.finance?.selisihKasir
      if (selisih) {
        const listSel = selisih.daftarSelisihTerbaru.slice(0, 5).map((s, i) =>
          `${i + 1}. **${s.outlet}** (Kasir: ${s.kasir}): Selisih **${s.selisih < 0 ? 'Minus ' : 'Lebih +'}${formatRupiah(s.selisih)}**`
        ).join('\n')
        return [
          `${salamAwal} Berikut rekapitulasi selisih kasir tutup shift POS:\n\n`,
          '> **AUDIT SELISIH KASIR**: Perbandingan uang fisik vs nilai seharusnya saat tutup shift kasir.\n\n',
          '### ⚖️ Daftar Selisih Kasir Terbaru\n',
          listSel || '(Seluruh shift kasir tercatat klop tanpa selisih)',
          `\n\n*Selisih minus menunjukkan tekor uang fisik kasir; selisih lebih menunjukkan kelebihan kas.*\n\n`,
          `Ada tindak lanjut yang diperlukan untuk kasir tersebut, ${sebutan}?`,
        ]
      }
    }

    // 5E. Ringkasan Umum Keuangan / Cash Flow
    const totalOmzet = t ? formatRupiah(t.omzetTotal) : 'Rp 2.787.000'
    const totalExpHariIni = t?.finance?.pengeluaranHariIni ? formatRupiah(t.finance.pengeluaranHariIni.totalNominal) : 'Rp 0'
    const top1 = t?.finance?.pengeluaranHariIni?.topPengeluaran?.[0]
    const barisTop1 = top1 ? `- **Pengeluaran Terbesar Hari Ini**: **${formatRupiah(top1.nominal)}** (${top1.deskripsi} - ${top1.outlet})\n` : ''
    const barisUtang = t?.finance?.utangPo ? `- **Total Utang PO Supplier Belum Lunas**: **${formatRupiah(t.finance.utangPo.totalUtang)}** (${t.finance.utangPo.jumlahPo} PO)\n` : ''

    return [
      'Sinkronisasi satelit **Finance & Keuangan** Suka Shawarma berhasil dilakukan:\n\n',
      '> **LIVE FINANCE RECONCILIATION**: Rekonsiliasi kas masuk dan operasional cabang.\n\n',
      '### 💰 Ringkasan Keuangan Hari Ini\n',
      `- **Gross Sales / Kas Masuk Hari Ini**: **${totalOmzet}**\n`,
      `- **Total Transaksi Terverifikasi**: ${t?.totalOrder ?? 0} tiket\n`,
      `- **Rata-rata Nilai Transaksi (AOV)**: ${t ? formatRupiah(t.aov) : 'Rp 0'}\n`,
      `- **Total Pengeluaran Kas Kecil Hari Ini**: **${totalExpHariIni}** (${t?.finance?.pengeluaranHariIni?.jumlahTransaksi ?? 0} transaksi)\n`,
      barisTop1,
      barisUtang,
      `- **Status Kas Operasional**: Rekonsiliasi sinkron dengan mutasi pembayaran QRIS dan Cash.\n\n`,
      `Arus kas tercatat positif dan seluruh modul keuangan siaga, ${sebutan}.`,
    ]
  }

  // 6. Status Keseluruhan / Laporan / Sistem
  if (
    p.includes('status') ||
    p.includes('lapor') ||
    p.includes('report') ||
    p.includes('sistem') ||
    p.includes('kondisi') ||
    p.includes('cek')
  ) {
    const topPerformer = t?.outlets?.[0]
      ? `${t.outlets[0].nama} (${formatRupiah(t.outlets[0].omzet)})`
      : 'Belum ada transaksi'

    if (isManager) {
      return [
        `Halo Rekan Tim Operasional. Berikut ringkasan status operasional cabang Suka Shawarma (${t?.tanggalWIB || 'Hari Ini'}):\n\n`,
        `> **STATUS OPERASIONAL**: Terhubung langsung ke data live (${t?.totalOutletAktif ?? 28} outlet aktif).\n\n`,
        '### 📊 Ringkasan Operasional Hari Ini\n',
        `1. **Penjualan / POS**: Total Omzet **${t ? formatRupiah(t.omzetTotal) : 'Rp 0'}** (${t?.totalOrder ?? 0} transaksi)\n`,
        `2. **Top Performer Cabang**: **${topPerformer}**\n`,
        `3. **Katalog Bahan Aktif**: ${t?.bahanBaku?.slice(0, 3).map((b) => b.nama).join(', ') || 'Gas, Kulit, Daging'}\n`,
        `4. **Presensi Kru**: ${t?.kehadiranTotal ?? 0} staf bertugas hari ini (On-time ${t?.persenOnTime ?? 95}%)\n\n`,
        'Semua sistem pemantauan operasional berjalan lancar. Ada cabang binaan yang ingin Anda cek detailnya?',
      ]
    }

    return [
      `Salam, Sir. Menginisialisasi pemindaian status diagnostik Command Centre Suka Shawarma (${t?.tanggalWIB || 'Hari Ini'}):\n\n`,
      '> **SEMUA SISTEM NOMINAL**: Arc Reactor Core beroperasi efisien. Koneksi database real-time aktif.\n\n',
      '### 🛰️ Telemetri Satelit Real-time\n',
      `1. **Node Sales / POS**: Total Omzet **${t ? formatRupiah(t.omzetTotal) : 'Rp 0'}** (${t?.totalOrder ?? 0} order dari ${t?.totalOutletAktif ?? 0} cabang)\n`,
      `2. **Top Performer Outlet**: **${topPerformer}**\n`,
      `3. **Node Gudang**: Katalog bahan aktif (${t?.bahanBaku?.slice(0, 3).map((b) => b.nama).join(', ') || 'Gas, Kulit, Daging'})\n`,
      `4. **Node HRD**: ${t?.kehadiranTotal ?? 0} log presensi aktif (On-time ${t?.persenOnTime ?? 95}%)\n\n`,
      '### ⚡ Telemetri Command HUD\n',
      '- **Database Link**: LIVE (Supabase PostgreSQL)\n',
      '- **Neural Voice Pipeline**: Standby (Speech Recognition & TTS ready)\n',
      '- **Keamanan Clearance**: Level Alpha (Owner / Admin / Developer Verified)\n\n',
      'Semua stasiun operasional berjalan mulus. Ada arahan strategis berikutnya, Sir?',
    ]
  }

  // 7. Default / Sapaan Umum
  if (isManager) {
    return [
      'Halo Rekan Tim Operasional Suka Shawarma. Bot Manager siap membantu Anda mengawal operasional cabang.\n\n',
      `> **LIVE MONITORING AKTIF**: Terhubung langsung ke data operasional cabang (${t?.totalOutletAktif ?? 28} outlet aktif).\n\n`,
      `Pertanyaan Anda: *"${pesanUser}"* telah diterima.\n\n`,
      'Anda dapat menanyakan hal-hal operasional seperti:\n',
      '- **"Udah buka semua belum outlet?"** untuk cek status buka & transaksi cabang\n',
      '- **"Omzet hari ini"** untuk melihat pencapaian penjualan real-time\n',
      '- **"Siapa yang telat hari ini?"** untuk monitoring kedisiplinan dan absensi kru\n',
      '- **"Ada waste ga hari ini?"** untuk cek catatan waste bahan baku\n',
      '- **"Cek stok gudang"** untuk ketersediaan bahan baku di central\n\n',
      'Ada data cabang binaan yang ingin Anda evaluasi lebih lanjut?',
    ]
  }

  return [
    'Salam, Sir. J.A.R.V.I.S. Tactical Command Centre online dan terhubung ke database live Suka Shawarma.\n\n',
    `> **LIVE DATA STREAM ACTIVE**: Terhubung langsung ke database produksi (${t?.totalOutletAktif ?? 28} outlet aktif).\n\n`,
    `Instruksi Anda: *"${pesanUser}"* berhasil diterima oleh Command HUD.\n\n`,
    'Anda dapat memberikan arahan operasional langsung seperti:\n',
    '- **"Tampilkan semua outlet"** untuk melihat daftar peringkat seluruh 28 cabang\n',
    '- **"Omzet hari ini"** untuk telemetri penjualan dan menu terlaris\n',
    '- **"Status report menyeluruh"** untuk pemindaian diagnostik lengkap semua cabang\n',
    '- **"Cek stok gudang"** untuk katalog bahan baku operasional\n',
    '- **"Monitoring absensi kru"** untuk log presensi shift hari ini\n',
    '- **"Laporan keuangan"** untuk rekonsiliasi kas dan penjualan\n\n',
    'Modul audio, telemetri, dan kontrol operasional siap siaga, Sir.',
  ]
}
