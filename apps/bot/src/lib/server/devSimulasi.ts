/**
 * Generator respon simulasi J.A.R.V.I.S. untuk local development.
 * Menghasilkan data telemetri operasional Suka Shawarma yang realistis saat Hermes VPS tidak aktif di localhost.
 */

export function buatJawabanDev(pesanUser: string, profil: string): string[] {
  const p = (pesanUser || '').toLowerCase().trim()

  // 1. Telemetri Penjualan & Omzet
  if (p.includes('omzet') || p.includes('omset') || p.includes('jual') || p.includes('sales') || p.includes('pendapatan') || p.includes('kasir')) {
    return [
      'Salam, Sir. Telemetri penjualan Suka Shawarma telah dikompilasi secara real-time dari seluruh Point of Sale (POS):\n\n',
      '> [!NOTE]\n',
      '> **PERFORMA PENJUALAN NOMINAL**: Total pendapatan hari ini melampaui target harian sebesar **+14.3%**.\n\n',
      '### 📊 Ringkasan Penjualan Hari Ini\n',
      '- **Total Omzet**: Rp 24.850.000 (842 Transaksi)\n',
      '- **Rata-rata Order (AOV)**: Rp 29.513 / tiket\n',
      '- **Metode Pembayaran**: QRIS 68% | Tunai 22% | Debit/Transfer 10%\n\n',
      '### 🏪 Breakdown Per Outlet\n',
      '1. **Outlet SS Paledang (HQ)**\n',
      '   - Omzet: **Rp 14.200.000** (480 order)\n',
      '   - Status: Capai target 105% (Peak: 12:00 - 13:30 & 18:30 - 20:30)\n',
      '2. **Outlet SS Lodaya**\n',
      '   - Omzet: **Rp 10.650.000** (362 order)\n',
      '   - Status: Capai target 98% (Lonjakan pesanan saat makan malam)\n\n',
      '### 🌯 Top 3 Best-Seller Menu\n',
      '- 🥇 **Shawarma Beef Large (Spicy Garlic)**: 310 porsi\n',
      '- 🥈 **Shawarma Chicken Special**: 285 porsi\n',
      '- 🥉 **Lebanese Fries & Tahini Dip**: 145 porsi\n\n',
      'Sistem radar POS tetap siaga memantau lonjakan malam, Sir.',
    ]
  }

  // 2. Telemetri Stok & Gudang (Bahan Baku)
  if (
    p.includes('stok') ||
    p.includes('gudang') ||
    p.includes('bahan') ||
    p.includes('inventori') ||
    p.includes('daging') ||
    p.includes('pita') ||
    p.includes('sauce') ||
    p.includes('roti') ||
    (profil === 'gudang' && !p.includes('absensi') && !p.includes('keuangan'))
  ) {
    return [
      'J.A.R.V.I.S. terhubung ke satelit **Gudang Central & Cold Storage**. Berikut laporan ketersediaan bahan baku per detik ini:\n\n',
      '> [!NOTE]\n',
      '> **STATUS LOGISTIK AMAN**: Buffer stock operasional mencukupi untuk operasional **3.5 hari ke depan**.\n\n',
      '### 🥩 Ketersediaan Bahan Baku Utama\n',
      '- **Daging Sapi Marinasi**: 42.5 kg `[STATUS: OPTIMAL]`\n',
      '- **Daging Ayam Marinasi**: 58.0 kg `[STATUS: OPTIMAL]`\n',
      '- **Roti Pita Premium (Diameter 20cm)**: 680 pcs `[STATUS: NORMAL]`\n',
      '- **Garlic Mayo & Tahini Sauce**: 18.5 liter `[STATUS: AMAN]`\n',
      '- **Sayuran Segar (Selada & Tomat)**: Batch pagi terdistribusi 100%\n\n',
      '### 📦 Material Kemasan\n',
      '- **Shawarma Foil Wrap**: 1.250 lembar\n',
      '- **Takeaway Box Craft**: 840 pcs\n',
      '- **Paper Bag SS**: 620 pcs\n\n',
      '### 🚚 Jadwal Pengadaan Terdekat\n',
      '- Supplier Daging Suharmanto dijadwalkan tiba **Besok, 08:00 WIB** (+50 kg Sapi).\n',
      'Tidak ada indikasi stok kritis atau anomali susut (shrinkage) hari ini.',
    ]
  }

  // 3. Telemetri HRD & Kehadiran Kru
  if (
    p.includes('hrd') ||
    p.includes('absen') ||
    p.includes('kru') ||
    p.includes('karyawan') ||
    p.includes('shift') ||
    p.includes('tim') ||
    (profil === 'hrd' && !p.includes('stok') && !p.includes('omzet'))
  ) {
    return [
      'Mengakses data satelit **HRD & Workforce Management** Suka Shawarma:\n\n',
      '> [!NOTE]\n',
      '> **KEDISIPLINAN TINGGI**: Tingkat on-time attendance kru shift pagi dan sore mencapai **94.7%**.\n\n',
      '### 👥 Status Personil Hari Ini\n',
      '- **Total Kru Bertugas**: 38 Personil\n',
      '  - Shift Pagi (08:00 - 16:00): 20 personil (Semua hadir)\n',
      '  - Shift Sore (15:30 - 23:00): 18 personil (Siap bertugas)\n',
      '- **Kru Libur / Day Off**: 4 personil\n',
      '- **Izin / Cuti Sakit**: 0 personil\n\n',
      '### 📍 Distribusi Kru Per Outlet\n',
      '- **SS Paledang**: 12 Kitchen Crew, 6 Kasir/Frontline, 2 Barista/Beverage\n',
      '- **SS Lodaya**: 10 Kitchen Crew, 6 Kasir/Frontline, 2 Cleaning/Support\n\n',
      'Seluruh station dapur berjalan lancar dengan standar SOP sanitasi dan hospitality aktif.',
    ]
  }

  // 4. Telemetri Finance & Keuangan
  if (
    p.includes('finance') ||
    p.includes('opex') ||
    p.includes('biaya') ||
    p.includes('keuangan') ||
    p.includes('kas') ||
    p.includes('petty') ||
    p.includes('pengeluaran') ||
    (profil === 'finance' && !p.includes('omzet') && !p.includes('stok'))
  ) {
    return [
      'Sinkronisasi satelit **Finance & Keuangan** Suka Shawarma berhasil dilakukan:\n\n',
      '> [!NOTE]\n',
      '> **EFISIENSI BIAYA**: Realisasi OPEX bulan berjalan berada di angka **80.5%** dari pagu anggaran yang ditetapkan.\n\n',
      '### 💰 Ringkasan Keuangan\n',
      '- **Realisasi OPEX (Month-to-Date)**: Rp 68.420.000 / Rp 85.000.000\n',
      '- **Kas Operasional / Petty Cash**:\n',
      '  - Outlet Paledang: Rp 1.850.000 (Sisa kas kecil aman)\n',
      '  - Outlet Lodaya: Rp 1.650.000 (Sisa kas kecil aman)\n',
      '- **Tagihan Supplier Jatuh Tempo**: 2 Invoice (Total Rp 8.200.000 - Jatuh tempo 3 hari lagi)\n\n',
      '### 📈 Rasio Pengeluaran Utama\n',
      '- **HPP Bahan Baku**: 58.2%\n',
      '- **Tenaga Kerja & Shift**: 25.4%\n',
      '- **Utilitas & Kebersihan**: 8.1%\n',
      '- **Maintenance Mesin & Gas**: 8.3%\n\n',
      'Arus kas bersih tercatat positif dan rekonsiliasi kas harian sinkron dengan bank account.',
    ]
  }

  // 5. Status Keseluruhan / Laporan / Sistem
  if (
    p.includes('status') ||
    p.includes('lapor') ||
    p.includes('report') ||
    p.includes('sistem') ||
    p.includes('kondisi') ||
    p.includes('cek')
  ) {
    return [
      'Salam, Sir. Menginisialisasi pemindaian status diagnostik Command Centre Suka Shawarma secara menyeluruh:\n\n',
      '> [!NOTE]\n',
      '> **SEMUA SISTEM NOMINAL**: Arc Reactor Core beroperasi pada efisiensi 99.8%. Satelit CEO, Gudang, HRD, dan Finance tersinkronisasi penuh.\n\n',
      '### 🛰️ Status Modul Satelit\n',
      '1. **Node CEO / Executive**: Online & Monitoring Real-time\n',
      '2. **Node Gudang**: Buffer stock aman 3.5 hari (Daging 100.5 kg, Pita 680 pcs)\n',
      '3. **Node HRD**: 38 Kru aktif bertugas, On-time rate 94.7%\n',
      '4. **Node Finance**: Omzet hari ini Rp 24.850.000, OPEX efisien 80.5%\n\n',
      '### ⚡ Telemetri Command HUD\n',
      '- **Latensi Data**: < 15ms\n',
      '- **Neural Voice Pipeline**: Standby (Speech Recognition & TTS ready)\n',
      '- **Keamanan Clearance**: Level Alpha (Owner / Admin / Developer Verified)\n\n',
      'Semua stasiun operasional berjalan mulus. Ada arahan strategis berikutnya, Sir?',
    ]
  }

  // 6. Default / Sapaan Umum
  return [
    'Salam, Sir. J.A.R.V.I.S. Tactical Command Centre online dan siap menerima instruksi.\n\n',
    '> [!NOTE]\n',
    '> **Local Development Mode**: Koneksi Hermes VPS aktif di environment produksi (`agents.sukashawarma.com`).\n\n',
    `Instruksi Anda: *"${pesanUser}"* berhasil diterima oleh Command HUD.\n\n`,
    'Anda dapat memberikan arahan operasional seperti:\n',
    '- **"Omzet hari ini"** untuk telemetri penjualan per outlet\n',
    '- **"Status report menyeluruh"** untuk pemindaian diagnostik 4 node\n',
    '- **"Cek stok gudang"** untuk ketersediaan bahan baku daging & pita\n',
    '- **"Monitoring absensi kru"** untuk status personil shift dan kehadiran\n',
    '- **"Laporan keuangan opex"** untuk rekonsiliasi kas dan pengeluaran\n\n',
    'Modul audio, telemetri, dan kontrol operasional siap siaga, Sir.',
  ]
}
