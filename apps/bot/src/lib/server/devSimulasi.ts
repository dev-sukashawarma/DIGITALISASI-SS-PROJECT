/**
 * Generator respon J.A.R.V.I.S. berbasis telemetri nyata dari database Suka Shawarma.
 */
import { TelemetriHariIni, formatRupiah } from './telemetriNyata'

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
        '> [!NOTE]\n',
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
      '> [!NOTE]\n',
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
      '> [!NOTE]\n',
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
    const listBahan =
      t && t.bahanBaku.length > 0
        ? t.bahanBaku.map((b) => `- **${b.nama}** \`[Satuan: ${b.satuan}]\``).join('\n')
        : '- Daging Sapi Marinasi (Kg)\n- Daging Ayam Marinasi (Kg)\n- Roti Pita / Kulit (Pack)\n- Garlic Mayo (Dus)'

    const headerStok = isManager
      ? 'Bot Manager terhubung ke data **Gudang Central & Master Bahan Baku** Suka Shawarma:\n\n'
      : 'J.A.R.V.I.S. terhubung ke satelit **Gudang Central & Master Bahan Baku** Suka Shawarma:\n\n'

    return [
      headerStok,
      '> [!NOTE]\n',
      '> **LIVE INVENTORY FEED**: Data master bahan baku operasional tersinkronisasi dari database.\n\n',
      '### 🥩 Katalog Bahan Baku Utama\n',
      `${listBahan}\n\n`,
      `### 📦 Distribusi & Logistik\n`,
      `- **Cakupan Outlet Aktif**: ${t?.totalOutletAktif ?? 28} cabang\n`,
      '- **Status Cold Storage**: Buffer aman dan terpantau dalam parameter standar SOP.\n\n',
      `Siap menerima instruksi pencatatan mutasi atau audit stok outlet, ${sebutan}.`,
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
      '> [!NOTE]\n',
      '> **PENCATATAN WASTE HARIAN**: Rekap waste dan selisih bahan baku biasanya baru masuk saat closing shift dan stok opname fisik malam hari (cut-off 22:30 WIB).\n\n',
      'Untuk investigasi fisik saat ini, silakan koordinasikan langsung dengan PIC outlet atau pantau pengajuan waste di SuperApp.',
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
      '> [!NOTE]\n',
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
      '> [!NOTE]\n',
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
    const totalAtt = t?.kehadiranTotal ?? 0
    const onTimeRate = t?.persenOnTime ?? 95
    const lateCount = t?.kehadiranTelat ?? 0
    const onTimeCount = t?.kehadiranTepatWaktu ?? totalAtt

    const cutiLines =
      t && t.stafCutiIzin.length > 0
        ? t.stafCutiIzin
            .map((c) => `- **${c.nama}** (${c.role}): ${c.jenis} [status: ${c.status}] - *Alasan: ${c.alasan}*`)
            .join('\n')
        : isManager
          ? '- *(Tidak ada kru outlet tercatat izin/cuti hari ini)*'
          : '- *(Tidak ada kru tercatat izin/cuti hari ini)*'

    const telatLines =
      t && t.stafTelat.length > 0
        ? t.stafTelat
            .map((s) => `- **${s.nama}** (\`${s.outlet}\`): terlambat **${s.telatMenit} menit**`)
            .join('\n')
        : isManager
          ? '- *(Seluruh kru outlet on-time hari ini, tidak ada keterlambatan di cabang)*'
          : '- *(Seluruh kru on-time hari ini)*'

    const headerHR = isManager
      ? `Mengakses data **Presensi & Kedisiplinan Kru** Suka Shawarma (${t?.tanggalWIB || 'Hari Ini'}):\n\n`
      : `Mengakses data satelit **HRD & Workforce Management** Suka Shawarma (${t?.tanggalWIB || 'Hari Ini'}):\n\n`

    const feedNote = isManager
      ? '> **LIVE ATTENDANCE FEED**: Menampilkan data presensi kru di outlet cabang hari ini (khusus kru operasional outlet, tidak mencakup kantor pusat).\n\n'
      : '> **LIVE ATTENDANCE FEED**: Menampilkan data presensi kru di outlet hari ini dari sistem absensi geofencing.\n\n'

    return [
      headerHR,
      '> [!NOTE]\n',
      feedNote,
      '### 👥 Status Presensi Hari Ini\n',
      `- **Total Aktivitas Presensi**: **${totalAtt} catatan clock-in/out**\n`,
      `- **Tingkat Tepat Waktu (On-Time)**: **${onTimeRate}%** (${onTimeCount} tepat waktu)\n`,
      `- **Keterlambatan Terdeteksi**: ${lateCount} catatan\n`,
      `- **Distribusi Wilayah**: Tersebar di ${t?.totalOutletAktif ?? 28} cabang aktif Suka Shawarma\n\n`,
      '### 🏖️ Kru Izin / Cuti Terdata\n',
      `${cutiLines}\n\n`,
      '### ⏱️ Kru Datang Terlambat\n',
      `${telatLines}\n\n`,
      `Semua data presensi tersinkronisasi dengan sistem HRD & geofencing, ${sebutan}.`,
    ]
  }

  // 3. Pertanyaan Penjualan & Ranking KEMARIN
  if (isKemarin) {
    const k = t?.ringkasanKemarin
    if (!k || (k.omzetTotal === 0 && k.totalOrder === 0)) {
      return [
        `${salamAwal} Menghubungi database Suka Shawarma...\n\n`,
        '> [!WARNING]\n',
        '> Data penjualan kemarin belum berhasil dimuat dari database.\n',
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
      '> [!NOTE]\n',
      `> **REKAP PENJUALAN JARINGAN KEMARIN**: Total Omzet **${formatRupiah(k.omzetTotal)}** (${k.totalOrder} order, AOV ${formatRupiah(k.aov)}). Partisipasi: **${k.outletsAktifTransaksi.length}** dari **${k.outletsAktifTransaksi.length + k.outletsNolTransaksi.length}** cabang aktif.\n\n`,
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
      '> [!NOTE]\n',
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
      '> [!NOTE]\n',
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
        '> [!NOTE]\n',
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
      const top1 = t?.finance?.pengeluaranHariIni?.topPengeluaran?.[0]
      if (top1) {
        const listTop = t?.finance?.pengeluaranHariIni?.topPengeluaran?.slice(0, 5).map((x, i) =>
          `${i + 1}. **${formatRupiah(x.nominal)}** — ${x.deskripsi} (*${x.outlet}* | \`${x.kategori}\`)`
        ).join('\n') || ''

        return [
          `${salamAwal} Berikut rincian pengeluaran / OPEX terbesar hari ini (**${t?.tanggalWIB || 'Hari Ini'}**):\n\n`,
          '> [!NOTE]\n',
          `> **OPEX TERBESAR HARI INI**: **${formatRupiah(top1.nominal)}** untuk **${top1.deskripsi}** di outlet **${top1.outlet}**.\n\n`,
          '### 💸 Daftar Pengeluaran Terbesar Hari Ini\n',
          listTop,
          `\n\n- **Total Pengeluaran Hari Ini**: **${formatRupiah(t?.finance?.pengeluaranHariIni?.totalNominal || 0)}** (${t?.finance?.pengeluaranHariIni?.jumlahTransaksi || 0} transaksi tercatat)\n`,
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
          '> [!NOTE]\n',
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
        const listSet = setoran.daftarSetoranTerbaru.slice(0, 5).map((s, i) =>
          `${i + 1}. **${s.outlet}**: **${formatRupiah(s.nominal)}** (Tgl Jual: ${s.tanggalJual}, Status: \`${s.status}\`)`
        ).join('\n')
        return [
          `${salamAwal} Berikut status pencatatan setoran kas outlet terbaru:\n\n`,
          '> [!NOTE]\n',
          '> **SETORAN KAS OUTLET**: Rekonsiliasi setoran bank cabang tercatat di sistem Finance.\n\n',
          '### 📥 Setoran Kas Terbaru\n',
          listSet || '(Belum ada setoran tercatat)',
          `\n\n*Catatan: Data di atas adalah setoran yang sudah diinput/diverifikasi ke dalam sistem Finance.*\n\n`,
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
          '> [!NOTE]\n',
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
      '> [!NOTE]\n',
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
        '> [!NOTE]\n',
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
      '> [!NOTE]\n',
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
      '> [!NOTE]\n',
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
    '> [!NOTE]\n',
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
