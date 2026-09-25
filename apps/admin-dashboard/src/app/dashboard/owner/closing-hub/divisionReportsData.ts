// apps/admin-dashboard/src/app/dashboard/owner/closing-hub/divisionReportsData.ts

export interface ReportColumn {
  key: string
  label: string
  align?: 'left' | 'right' | 'center'
  isCurrency?: boolean
  isBold?: boolean
}

export interface DivisionFullReport {
  divisionKey: string
  codePrefix: string
  title: string
  subtitle: string
  preparedByRole: string
  verifiedByRole: string
  approvedByRole: string
  notesDefault: string
  columns: ReportColumn[]
  rows: Record<string, any>[]
  summaryKpis: { label: string; value: string; isHighlight?: boolean }[]
}

export const DIVISION_FULL_REPORTS: Record<string, DivisionFullReport> = {
  kasir_outlet: {
    divisionKey: 'kasir_outlet',
    codePrefix: 'BA/SS/KSR',
    title: 'BERITA ACARA REKAPITULASI PENJUALAN KASIR & FISIK KAS TOKO',
    subtitle: 'Rekonsiliasi transaksi offline POS, pembayaran non-tunai, kas kecil outlet, dan setoran bank 19 cabang.',
    preparedByRole: 'Leader Outlet / Kasir',
    verifiedByRole: 'SPV Kasir & Operasional',
    approvedByRole: 'Finance Director / Owner',
    notesDefault: 'Seluruh selisih kas fisik telah dicocokkan dengan log blind close shift kasir dan disetorkan ke rekening penampung.',
    summaryKpis: [
      { label: 'Total Omzet POS', value: 'Rp 620.500.000', isHighlight: true },
      { label: 'Total Setoran Bank', value: 'Rp 612.080.000' },
      { label: 'Total Kas Kecil Toko', value: 'Rp 8.420.000' },
      { label: 'Net Selisih (Variance)', value: 'Rp 0 (Matched)', isHighlight: true },
    ],
    columns: [
      { key: 'no', label: 'No', align: 'center' },
      { key: 'outlet', label: 'Nama Cabang Outlet', align: 'left', isBold: true },
      { key: 'cash', label: 'Omzet Tunai (Cash)', align: 'right', isCurrency: true },
      { key: 'nonCash', label: 'Omzet QRIS/EDC', align: 'right', isCurrency: true },
      { key: 'grossPos', label: 'Total Omzet POS', align: 'right', isCurrency: true, isBold: true },
      { key: 'pettyCash', label: 'Kas Kecil Laci', align: 'right', isCurrency: true },
      { key: 'depositBank', label: 'Setoran Bank', align: 'right', isCurrency: true },
      { key: 'variance', label: 'Selisih (Variance)', align: 'right', isCurrency: true },
      { key: 'status', label: 'Status Shift', align: 'center' },
    ],
    rows: [
      { no: 1, outlet: 'Cabang Empang', cash: 24500000, nonCash: 21000000, grossPos: 45500000, pettyCash: 550000, depositBank: 44950000, variance: 0, status: 'CLOSED (100%)' },
      { no: 2, outlet: 'Cabang Pajajaran', cash: 28000000, nonCash: 26500000, grossPos: 54500000, pettyCash: 620000, depositBank: 53880000, variance: 0, status: 'CLOSED (100%)' },
      { no: 3, outlet: 'Cabang Bangbarung', cash: 21000000, nonCash: 19500000, grossPos: 40500000, pettyCash: 480000, depositBank: 40020000, variance: 0, status: 'CLOSED (100%)' },
      { no: 4, outlet: 'Cabang Cibinong', cash: 25500000, nonCash: 23000000, grossPos: 48500000, pettyCash: 520000, depositBank: 47980000, variance: 0, status: 'CLOSED (100%)' },
      { no: 5, outlet: 'Cabang Dramaga', cash: 19500000, nonCash: 18000000, grossPos: 37500000, pettyCash: 410000, depositBank: 37090000, variance: 0, status: 'CLOSED (100%)' },
      { no: 6, outlet: 'Cabang Sukasari', cash: 20500000, nonCash: 19000000, grossPos: 39500000, pettyCash: 430000, depositBank: 39070000, variance: 0, status: 'CLOSED (100%)' },
      { no: 7, outlet: 'Cabang Gunung Batu', cash: 18000000, nonCash: 16500000, grossPos: 34500000, pettyCash: 390000, depositBank: 34110000, variance: 0, status: 'CLOSED (100%)' },
      { no: 8, outlet: 'Cabang Tajur', cash: 19000000, nonCash: 17500000, grossPos: 36500000, pettyCash: 420000, depositBank: 36080000, variance: 0, status: 'CLOSED (100%)' },
      { no: 9, outlet: 'Cabang Yasmin', cash: 23000000, nonCash: 21500000, grossPos: 44500000, pettyCash: 500000, depositBank: 44000000, variance: 0, status: 'CLOSED (100%)' },
      { no: 10, outlet: 'Cabang Pandu Raya', cash: 17500000, nonCash: 16000000, grossPos: 33500000, pettyCash: 380000, depositBank: 33120000, variance: 0, status: 'CLOSED (100%)' },
      { no: 11, outlet: 'Cabang Pandu II', cash: 16000000, nonCash: 14500000, grossPos: 30500000, pettyCash: 350000, depositBank: 30150000, variance: 0, status: 'CLOSED (100%)' },
      { no: 12, outlet: 'Cabang Air Mancur', cash: 18500000, nonCash: 17000000, grossPos: 35500000, pettyCash: 400000, depositBank: 35100000, variance: 0, status: 'CLOSED (100%)' },
      { no: 13, outlet: 'Cabang Semplak', cash: 15500000, nonCash: 14000000, grossPos: 29500000, pettyCash: 340000, depositBank: 29160000, variance: 0, status: 'CLOSED (100%)' },
      { no: 14, outlet: 'Cabang Ciawi', cash: 19000000, nonCash: 17000000, grossPos: 36000000, pettyCash: 410000, depositBank: 35590000, variance: 0, status: 'CLOSED (100%)' },
      { no: 15, outlet: 'Cabang Ciomas', cash: 14000000, nonCash: 13000000, grossPos: 27000000, pettyCash: 320000, depositBank: 26680000, variance: 0, status: 'CLOSED (100%)' },
      { no: 16, outlet: 'Cabang Cimahpar', cash: 13500000, nonCash: 12000000, grossPos: 25500000, pettyCash: 310000, depositBank: 25190000, variance: 0, status: 'CLOSED (100%)' },
      { no: 17, outlet: 'Cabang Kota Wisata', cash: 22000000, nonCash: 21000000, grossPos: 43000000, pettyCash: 510000, depositBank: 42490000, variance: 0, status: 'CLOSED (100%)' },
      { no: 18, outlet: 'Cabang Sentul', cash: 21000000, nonCash: 20000000, grossPos: 41000000, pettyCash: 490000, depositBank: 40510000, variance: 0, status: 'CLOSED (100%)' },
      { no: 19, outlet: 'SS Online Center', cash: 4000000, nonCash: 13000000, grossPos: 17000000, pettyCash: 180000, depositBank: 16820000, variance: 0, status: 'CLOSED (100%)' },
    ],
  },

  kitchen_stok: {
    divisionKey: 'kitchen_stok',
    codePrefix: 'BA/SS/KTN',
    title: 'BERITA ACARA STOCK OPNAME FISIK, SHRINKAGE & KERUGIAN STOK',
    subtitle: 'Hasil perhitungan fisik serentak 19 outlet dan gudang pusat, serta kerugian waste dan selisih stok.',
    preparedByRole: 'Staf Gudang & Kitchen',
    verifiedByRole: 'SPV Kitchen & Logistik',
    approvedByRole: 'Operational Director / Owner',
    notesDefault: 'Perhitungan fisik dilakukan serentak pada cut-off tanggal 30/31 malam pukul 23:59 WIB. Seluruh surat jalan 100% diterima.',
    summaryKpis: [
      { label: 'Nilai Aset Stok Akhir', value: 'Rp 148.600.000', isHighlight: true },
      { label: 'Kerugian Waste (Bahan Rusak)', value: 'Rp 4.250.000' },
      { label: 'Kerugian Shrinkage (Hilang)', value: 'Rp 2.180.000' },
      { label: 'Rasio Waste & Shrinkage', value: '1.03% (Aman)', isHighlight: true },
    ],
    columns: [
      { key: 'no', label: 'No', align: 'center' },
      { key: 'code', label: 'Kode', align: 'center' },
      { key: 'material', label: 'Nama Bahan Baku Pokok', align: 'left', isBold: true },
      { key: 'unit', label: 'Satuan', align: 'center' },
      { key: 'systemQty', label: 'Stok Sistem', align: 'right' },
      { key: 'physicalQty', label: 'Stok Fisik (SO)', align: 'right', isBold: true },
      { key: 'diffQty', label: 'Selisih (Qty)', align: 'right' },
      { key: 'shrinkageRp', label: 'Kerugian Selisih', align: 'right', isCurrency: true },
      { key: 'wasteRp', label: 'Kerugian Waste', align: 'right', isCurrency: true },
      { key: 'status', label: 'Kondisi Stok', align: 'center' },
    ],
    rows: [
      { no: 1, code: 'AYM-01', material: 'Daging Ayam Fillet Marinasi', unit: 'kg', systemQty: '1,450', physicalQty: '1,432', diffQty: '-18', shrinkageRp: 720000, wasteRp: 1200000, status: 'NORMAL' },
      { no: 2, code: 'KLT-25', material: 'Kulit Pita Shawarma 25cm', unit: 'pack', systemQty: '3,800', physicalQty: '3,765', diffQty: '-35', shrinkageRp: 525000, wasteRp: 750000, status: 'NORMAL' },
      { no: 3, code: 'MYN-01', material: 'Mayones SS Signature Garlic', unit: 'crt', systemQty: '280', physicalQty: '278', diffQty: '-2', shrinkageRp: 280000, wasteRp: 420000, status: 'NORMAL' },
      { no: 4, code: 'MYK-01', material: 'Minyak Goreng Sawit 2L', unit: 'pch', systemQty: '540', physicalQty: '538', diffQty: '-2', shrinkageRp: 70000, wasteRp: 0, status: 'NORMAL' },
      { no: 5, code: 'SAU-01', material: 'Saus Sambal Ekstra Pedas', unit: 'crt', systemQty: '310', physicalQty: '309', diffQty: '-1', shrinkageRp: 110000, wasteRp: 180000, status: 'NORMAL' },
      { no: 6, code: 'SAY-01', material: 'Sayur Lettuce Segar', unit: 'kg', systemQty: '680', physicalQty: '665', diffQty: '-15', shrinkageRp: 225000, wasteRp: 950000, status: 'CEPAT RUSAK' },
      { no: 7, code: 'BMB-01', material: 'Racik Bumbu Rempah Timur Tengah', unit: 'pack', systemQty: '420', physicalQty: '419', diffQty: '-1', shrinkageRp: 80000, wasteRp: 150000, status: 'NORMAL' },
      { no: 8, code: 'BOX-01', material: 'Kemasan Box Regular Suka Shawarma', unit: 'pcs', systemQty: '12,500', physicalQty: '12,420', diffQty: '-80', shrinkageRp: 96000, wasteRp: 360000, status: 'NORMAL' },
      { no: 9, code: 'BOX-02', material: 'Kemasan Box Jumbo Party Pack', unit: 'pcs', systemQty: '3,200', physicalQty: '3,185', diffQty: '-15', shrinkageRp: 30000, wasteRp: 120000, status: 'NORMAL' },
      { no: 10, code: 'PLS-01', material: 'Kantong Plastik Ramah Lingkungan', unit: 'pack', systemQty: '850', physicalQty: '840', diffQty: '-10', shrinkageRp: 44000, wasteRp: 120000, status: 'NORMAL' },
    ],
  },

  purchasing: {
    divisionKey: 'purchasing',
    codePrefix: 'BA/SS/PUR',
    title: 'BERITA ACARA REKAP PEMBELIAN BAHAN BAKU & HUTANG USAHA (AP)',
    subtitle: 'Matching 3-Way antara Purchase Order (PO), Surat Penerimaan Barang (GRN), dan Faktur Tagihan Supplier.',
    preparedByRole: 'Purchasing Officer',
    verifiedByRole: 'Purchasing Lead & Finance',
    approvedByRole: 'Finance Director / Owner',
    notesDefault: 'Seluruh barang telah diterima dengan kondisi baik. Invoice yang jatuh tempo telah dijadwalkan pembayarannya.',
    summaryKpis: [
      { label: 'Total Belanja PO', value: 'Rp 215.300.000', isHighlight: true },
      { label: 'Faktur Lunas Terbayar', value: 'Rp 160.000.000' },
      { label: 'Hutang Dagang (AP)', value: 'Rp 55.300.000' },
      { label: 'Deviasi Harga Pokok', value: '+1.2% (Terkendali)', isHighlight: true },
    ],
    columns: [
      { key: 'no', label: 'No', align: 'center' },
      { key: 'supplier', label: 'Nama Supplier / Vendor', align: 'left', isBold: true },
      { key: 'category', label: 'Kategori Pasokan', align: 'left' },
      { key: 'poCount', label: 'Jml PO', align: 'center' },
      { key: 'poValue', label: 'Total Nilai PO', align: 'right', isCurrency: true },
      { key: 'invoiceValue', label: 'Faktur Masuk', align: 'right', isCurrency: true },
      { key: 'paidValue', label: 'Lunas Terbayar', align: 'right', isCurrency: true },
      { key: 'unpaidValue', label: 'Sisa Hutang (AP)', align: 'right', isCurrency: true, isBold: true },
      { key: 'dueDate', label: 'Jatuh Tempo', align: 'center' },
    ],
    rows: [
      { no: 1, supplier: 'PT Surya Unggas Mandiri', category: 'Daging Ayam Segar', poCount: 8, poValue: 86400000, invoiceValue: 86400000, paidValue: 66400000, unpaidValue: 20000000, dueDate: '10 Okt 2026' },
      { no: 2, supplier: 'UD Berkah Roti Bogasari', category: 'Kulit Pita Shawarma', poCount: 6, poValue: 42500000, invoiceValue: 42500000, paidValue: 32500000, unpaidValue: 10000000, dueDate: '12 Okt 2026' },
      { no: 3, supplier: 'PT Mayora Prima Distribusi', category: 'Mayones & Saus', poCount: 4, poValue: 28200000, invoiceValue: 28200000, paidValue: 20200000, unpaidValue: 8000000, dueDate: '15 Okt 2026' },
      { no: 4, supplier: 'Mitra Sayur Segar Cipanas', category: 'Sayuran & Lettuce', poCount: 12, poValue: 16800000, invoiceValue: 16800000, paidValue: 12800000, unpaidValue: 4000000, dueDate: '08 Okt 2026' },
      { no: 5, supplier: 'CV Kemasan Sentosa Abadi', category: 'Box & Kemasan', poCount: 3, poValue: 22400000, invoiceValue: 22400000, paidValue: 15400000, unpaidValue: 7000000, dueDate: '18 Okt 2026' },
      { no: 6, supplier: 'CV Bumbu Rempah Alami', category: 'Bumbu Khas Timur Tengah', poCount: 2, poValue: 11500000, invoiceValue: 11500000, paidValue: 7500000, unpaidValue: 4000000, dueDate: '20 Okt 2026' },
      { no: 7, supplier: 'Agen Gas Elpiji Berkah', category: 'Gas 3kg / 12kg Outlet', poCount: 15, poValue: 7500000, invoiceValue: 7500000, paidValue: 5200000, unpaidValue: 2300000, dueDate: '07 Okt 2026' },
    ],
  },

  hr_payroll: {
    divisionKey: 'hr_payroll',
    codePrefix: 'BA/SS/HRD',
    title: 'BERITA ACARA REKAPITULASI ABSENSI, LEMBUR, BONUS & PAYROLL FINAL',
    subtitle: 'Rekapitulasi kehadiran 94 kru & staf, jam lembur tervalidasi, bonus omzet cabang, dan daftar gaji bersih.',
    preparedByRole: 'Admin HR / Personalia',
    verifiedByRole: 'Head of People & HR',
    approvedByRole: 'Managing Director / Owner',
    notesDefault: 'Perhitungan lembur telah divalidasi oleh Leader Outlet & SPV. Potongan kasbon telah sesuai persetujuan tertulis karyawan.',
    summaryKpis: [
      { label: 'Total Beban Payroll', value: 'Rp 138.200.000', isHighlight: true },
      { label: 'Total Kru & Staf Aktif', value: '94 Karyawan' },
      { label: 'Bonus Omzet Kru', value: 'Rp 18.450.000' },
      { label: 'Tingkat Kehadiran', value: '98.4% (Sangat Baik)', isHighlight: true },
    ],
    columns: [
      { key: 'no', label: 'No', align: 'center' },
      { key: 'unit', label: 'Unit / Divisi / Cabang', align: 'left', isBold: true },
      { key: 'staffCount', label: 'Staf', align: 'center' },
      { key: 'attendanceRate', label: 'Hadir (%)', align: 'center' },
      { key: 'overtimeHours', label: 'Lembur (Jam)', align: 'right' },
      { key: 'baseSalary', label: 'Gaji Pokok & Tunj.', align: 'right', isCurrency: true },
      { key: 'crewBonus', label: 'Bonus Omzet', align: 'right', isCurrency: true },
      { key: 'deductions', label: 'Pot. Kasbon', align: 'right', isCurrency: true },
      { key: 'netPayroll', label: 'Net Take Home Pay', align: 'right', isCurrency: true, isBold: true },
    ],
    rows: [
      { no: 1, unit: 'Cabang Empang', staffCount: 6, attendanceRate: '98.8%', overtimeHours: 42, baseSalary: 16800000, crewBonus: 1850000, deductions: 250000, netPayroll: 18400000 },
      { no: 2, unit: 'Cabang Pajajaran', staffCount: 6, attendanceRate: '99.1%', overtimeHours: 48, baseSalary: 17200000, crewBonus: 2200000, deductions: 300000, netPayroll: 19100000 },
      { no: 3, unit: 'Cabang Bangbarung', staffCount: 5, attendanceRate: '97.5%', overtimeHours: 36, baseSalary: 14000000, crewBonus: 1450000, deductions: 200000, netPayroll: 15250000 },
      { no: 4, unit: 'Cabang Cibinong', staffCount: 6, attendanceRate: '98.0%', overtimeHours: 40, baseSalary: 16800000, crewBonus: 1900000, deductions: 150000, netPayroll: 18550000 },
      { no: 5, unit: 'Cabang Dramaga', staffCount: 5, attendanceRate: '96.8%', overtimeHours: 32, baseSalary: 13900000, crewBonus: 1300000, deductions: 350000, netPayroll: 14850000 },
      { no: 6, unit: 'Cabang Sukasari', staffCount: 5, attendanceRate: '98.2%', overtimeHours: 34, baseSalary: 14100000, crewBonus: 1400000, deductions: 100000, netPayroll: 15400000 },
      { no: 7, unit: 'Cabang Gunung Batu', staffCount: 5, attendanceRate: '97.4%', overtimeHours: 30, baseSalary: 13800000, crewBonus: 1200000, deductions: 200000, netPayroll: 14800000 },
      { no: 8, unit: 'Gudang & Dapur Pusat', staffCount: 8, attendanceRate: '99.5%', overtimeHours: 64, baseSalary: 24500000, crewBonus: 1500000, deductions: 400000, netPayroll: 25600000 },
      { no: 9, unit: 'Tim Kantor Pusat (HQ)', staffCount: 16, attendanceRate: '99.2%', overtimeHours: 20, baseSalary: 48000000, crewBonus: 0, deductions: 500000, netPayroll: 47500000 },
    ],
  },

  marcom: {
    divisionKey: 'marcom',
    codePrefix: 'BA/SS/MKT',
    title: 'BERITA ACARA REALISASI ANGGARAN PEMASARAN & KINERJA PROMOSI',
    subtitle: 'Realisasi biaya iklan digital (Meta & TikTok Ads), kolaborasi influencer/KOL, cetak materi POSM outlet.',
    preparedByRole: 'Marcom Specialist',
    verifiedByRole: 'Marketing Lead',
    approvedByRole: 'Chief Marketing Officer / Owner',
    notesDefault: 'Seluruh kampanye berbayar dan endorsement telah tuntas ditayangkan dengan ROI dan sales uplift positif.',
    summaryKpis: [
      { label: 'Total Biaya Marketing', value: 'Rp 25.700.000', isHighlight: true },
      { label: 'Realisasi Ad Spend Meta/TikTok', value: 'Rp 14.500.000' },
      { label: 'Honorarium KOL / Reviewer', value: 'Rp 7.000.000' },
      { label: 'Pertumbuhan Omzet (MoM)', value: '+14.8% (Positif)', isHighlight: true },
    ],
    columns: [
      { key: 'no', label: 'No', align: 'center' },
      { key: 'program', label: 'Program / Saluran Pemasaran', align: 'left', isBold: true },
      { key: 'channelType', label: 'Kategori Media', align: 'left' },
      { key: 'budget', label: 'Anggaran (Budget)', align: 'right', isCurrency: true },
      { key: 'actualCost', label: 'Realisasi Biaya', align: 'right', isCurrency: true, isBold: true },
      { key: 'reach', label: 'Capaian (Reach/Imp)', align: 'right' },
      { key: 'salesAttributed', label: 'Est. Omzet Terkait', align: 'right', isCurrency: true },
      { key: 'roas', label: 'ROAS / Uplift', align: 'center' },
      { key: 'status', label: 'Status Kampanye', align: 'center' },
    ],
    rows: [
      { no: 1, program: 'Meta Ads (Instagram Feed & Reels)', channelType: 'Paid Digital Ads', budget: 9000000, actualCost: 8850000, reach: '345,000 Reach', salesAttributed: 52000000, roas: '5.8x', status: 'SELESAI' },
      { no: 2, program: 'TikTok Ads (Sponsored Video & Shop)', channelType: 'Paid Digital Ads', budget: 6000000, actualCost: 5650000, reach: '480,000 Views', salesAttributed: 38500000, roas: '6.8x', status: 'SELESAI' },
      { no: 3, program: 'Endorsement Food Vlogger Jabodetabek (4 KOL)', channelType: 'Influencer Marketing', budget: 7500000, actualCost: 7000000, reach: '620,000 Views', salesAttributed: 45000000, roas: '6.4x', status: 'POSTED (100%)' },
      { no: 4, program: 'Cetak Banner Promo & POSM 19 Outlet', channelType: 'Offline Branding', budget: 4500000, actualCost: 4200000, reach: '19 Outlet', salesAttributed: 0, roas: 'Branding', status: 'TERPASANG' },
    ],
  },

  finance_akuntansi: {
    divisionKey: 'finance_akuntansi',
    codePrefix: 'BA/SS/ACC',
    title: 'BERITA ACARA REKONSILIASI KAS, BANK & SETTLEMENT ONLINE FOOD AGGREGATOR',
    subtitle: 'Pencocokan rekening koran bank 100%, mutasi kas fisik, potongan komisi platform, dan pencairan aggregator.',
    preparedByRole: 'Staff Finance & Accounting',
    verifiedByRole: 'Finance Controller / Lead',
    approvedByRole: 'Finance Director / Owner',
    notesDefault: 'Tidak ada transaksi gantung pada mutasi bank per 30/31 malam. Saldo buku bank identik dengan rekening koran riil.',
    summaryKpis: [
      { label: 'Rekonsiliasi Bank', value: '100% Cocok (0 Selisih)', isHighlight: true },
      { label: 'Gross Sales Aggregator', value: 'Rp 210.400.000' },
      { label: 'Potongan Komisi Platform', value: 'Rp 42.080.000 (20%)' },
      { label: 'Net Cair ke Rekening', value: 'Rp 168.320.000', isHighlight: true },
    ],
    columns: [
      { key: 'no', label: 'No', align: 'center' },
      { key: 'channel', label: 'Saluran Rekening / Mitra', align: 'left', isBold: true },
      { key: 'accountType', label: 'Tipe Akun', align: 'left' },
      { key: 'bookBalance', label: 'Saldo Buku Sistem', align: 'right', isCurrency: true },
      { key: 'bankBalance', label: 'Saldo Rek. Koran', align: 'right', isCurrency: true, isBold: true },
      { key: 'variance', label: 'Selisih (Variance)', align: 'right', isCurrency: true },
      { key: 'merchantFee', label: 'Biaya Platform/Admin', align: 'right', isCurrency: true },
      { key: 'status', label: 'Status Rekonsiliasi', align: 'center' },
    ],
    rows: [
      { no: 1, channel: 'BCA Operasional Utama (012-345-6789)', accountType: 'Bank Account', bookBalance: 324500000, bankBalance: 324500000, variance: 0, merchantFee: 450000, status: 'MATCHED (100%)' },
      { no: 2, channel: 'Mandiri Operasional (133-00-9876-5432)', accountType: 'Bank Account', bookBalance: 185200000, bankBalance: 185200000, variance: 0, merchantFee: 280000, status: 'MATCHED (100%)' },
      { no: 3, channel: 'Kas Fisik Brankas Kantor Pusat', accountType: 'Cash on Hand', bookBalance: 15000000, bankBalance: 15000000, variance: 0, merchantFee: 0, status: 'MATCHED (100%)' },
      { no: 4, channel: 'GoFood Indonesia (PT GoTo)', accountType: 'Food Aggregator', bookBalance: 78500000, bankBalance: 62800000, variance: 0, merchantFee: 15700000, status: 'SETTLED' },
      { no: 5, channel: 'GrabFood Indonesia (PT Grab)', accountType: 'Food Aggregator', bookBalance: 72400000, bankBalance: 57920000, variance: 0, merchantFee: 14480000, status: 'SETTLED' },
      { no: 6, channel: 'ShopeeFood Indonesia', accountType: 'Food Aggregator', bookBalance: 38200000, bankBalance: 30560000, variance: 0, merchantFee: 7640000, status: 'SETTLED' },
      { no: 7, channel: 'TikTok Go Food Voucher', accountType: 'Food Aggregator', bookBalance: 21300000, bankBalance: 17040000, variance: 0, merchantFee: 4260000, status: 'SETTLED' },
    ],
  },
}

export interface Outlet19Data {
  id: string
  no: number
  name: string
  code: string
  type: 'Internal (Pusat)' | 'Mitra (Franchise)' | 'Online / Central'
  isInternal: boolean
  grossPos: number
  cash: number
  nonCash: number
  bankDeposit: number
  pettyCash: number
  variance: number
  stockAsset: number
  wasteRp: number
  shrinkageRp: number
  poPurchasing: number
  crewCount: number
  attendanceRate: string
  overtimeHours: number
  payroll: number
  mktAllocation: number
  status: string
}

export const OUTLETS_19_DATA: Outlet19Data[] = [
  // 12 Cabang Internal (Pusat)
  {
    id: 'out-01',
    no: 1,
    name: 'Cabang Empang',
    code: 'EMP',
    type: 'Internal (Pusat)',
    isInternal: true,
    grossPos: 45500000,
    cash: 24500000,
    nonCash: 21000000,
    bankDeposit: 44950000,
    pettyCash: 550000,
    variance: 0,
    stockAsset: 11200000,
    wasteRp: 320000,
    shrinkageRp: 160000,
    poPurchasing: 14200000,
    crewCount: 6,
    attendanceRate: '98.8%',
    overtimeHours: 42,
    payroll: 8800000,
    mktAllocation: 1900000,
    status: 'CLOSED (100%)',
  },
  {
    id: 'out-02',
    no: 2,
    name: 'Cabang Pajajaran',
    code: 'PJJ',
    type: 'Internal (Pusat)',
    isInternal: true,
    grossPos: 54500000,
    cash: 28000000,
    nonCash: 26500000,
    bankDeposit: 53880000,
    pettyCash: 620000,
    variance: 0,
    stockAsset: 13400000,
    wasteRp: 380000,
    shrinkageRp: 190000,
    poPurchasing: 17000000,
    crewCount: 6,
    attendanceRate: '99.1%',
    overtimeHours: 48,
    payroll: 9200000,
    mktAllocation: 2200000,
    status: 'CLOSED (100%)',
  },
  {
    id: 'out-03',
    no: 3,
    name: 'Cabang Bangbarung',
    code: 'BGB',
    type: 'Internal (Pusat)',
    isInternal: true,
    grossPos: 40500000,
    cash: 21000000,
    nonCash: 19500000,
    bankDeposit: 40020000,
    pettyCash: 480000,
    variance: 0,
    stockAsset: 9800000,
    wasteRp: 290000,
    shrinkageRp: 150000,
    poPurchasing: 12600000,
    crewCount: 5,
    attendanceRate: '97.5%',
    overtimeHours: 36,
    payroll: 7350000,
    mktAllocation: 1700000,
    status: 'CLOSED (100%)',
  },
  {
    id: 'out-04',
    no: 4,
    name: 'Cabang Cibinong',
    code: 'CBN',
    type: 'Internal (Pusat)',
    isInternal: true,
    grossPos: 48500000,
    cash: 25500000,
    nonCash: 23000000,
    bankDeposit: 47980000,
    pettyCash: 520000,
    variance: 0,
    stockAsset: 11900000,
    wasteRp: 340000,
    shrinkageRp: 170000,
    poPurchasing: 15100000,
    crewCount: 6,
    attendanceRate: '98.0%',
    overtimeHours: 40,
    payroll: 8950000,
    mktAllocation: 2000000,
    status: 'CLOSED (100%)',
  },
  {
    id: 'out-05',
    no: 5,
    name: 'Cabang Dramaga',
    code: 'DMG',
    type: 'Internal (Pusat)',
    isInternal: true,
    grossPos: 37500000,
    cash: 19500000,
    nonCash: 18000000,
    bankDeposit: 37090000,
    pettyCash: 410000,
    variance: 0,
    stockAsset: 9200000,
    wasteRp: 260000,
    shrinkageRp: 130000,
    poPurchasing: 11600000,
    crewCount: 5,
    attendanceRate: '96.8%',
    overtimeHours: 32,
    payroll: 7200000,
    mktAllocation: 1600000,
    status: 'CLOSED (100%)',
  },
  {
    id: 'out-06',
    no: 6,
    name: 'Cabang Sukasari',
    code: 'SKS',
    type: 'Internal (Pusat)',
    isInternal: true,
    grossPos: 39500000,
    cash: 20500000,
    nonCash: 19000000,
    bankDeposit: 39070000,
    pettyCash: 430000,
    variance: 0,
    stockAsset: 9600000,
    wasteRp: 270000,
    shrinkageRp: 140000,
    poPurchasing: 12300000,
    crewCount: 5,
    attendanceRate: '98.2%',
    overtimeHours: 34,
    payroll: 7450000,
    mktAllocation: 1650000,
    status: 'CLOSED (100%)',
  },
  {
    id: 'out-07',
    no: 7,
    name: 'Cabang Gunung Batu',
    code: 'GNB',
    type: 'Internal (Pusat)',
    isInternal: true,
    grossPos: 34500000,
    cash: 18000000,
    nonCash: 16500000,
    bankDeposit: 34110000,
    pettyCash: 390000,
    variance: 0,
    stockAsset: 8500000,
    wasteRp: 240000,
    shrinkageRp: 120000,
    poPurchasing: 10700000,
    crewCount: 5,
    attendanceRate: '97.4%',
    overtimeHours: 30,
    payroll: 7150000,
    mktAllocation: 1450000,
    status: 'CLOSED (100%)',
  },
  {
    id: 'out-08',
    no: 8,
    name: 'Cabang Tajur',
    code: 'TJR',
    type: 'Internal (Pusat)',
    isInternal: true,
    grossPos: 36500000,
    cash: 19000000,
    nonCash: 17500000,
    bankDeposit: 36080000,
    pettyCash: 420000,
    variance: 0,
    stockAsset: 8900000,
    wasteRp: 250000,
    shrinkageRp: 130000,
    poPurchasing: 11300000,
    crewCount: 5,
    attendanceRate: '98.0%',
    overtimeHours: 32,
    payroll: 7200000,
    mktAllocation: 1550000,
    status: 'CLOSED (100%)',
  },
  {
    id: 'out-09',
    no: 9,
    name: 'Cabang Yasmin',
    code: 'YSM',
    type: 'Internal (Pusat)',
    isInternal: true,
    grossPos: 44500000,
    cash: 23000000,
    nonCash: 21500000,
    bankDeposit: 44000000,
    pettyCash: 500000,
    variance: 0,
    stockAsset: 10900000,
    wasteRp: 310000,
    shrinkageRp: 150000,
    poPurchasing: 13800000,
    crewCount: 6,
    attendanceRate: '98.5%',
    overtimeHours: 38,
    payroll: 8600000,
    mktAllocation: 1850000,
    status: 'CLOSED (100%)',
  },
  {
    id: 'out-10',
    no: 10,
    name: 'Cabang Pandu Raya',
    code: 'PDR',
    type: 'Internal (Pusat)',
    isInternal: true,
    grossPos: 33500000,
    cash: 17500000,
    nonCash: 16000000,
    bankDeposit: 33120000,
    pettyCash: 380000,
    variance: 0,
    stockAsset: 8200000,
    wasteRp: 230000,
    shrinkageRp: 120000,
    poPurchasing: 10400000,
    crewCount: 4,
    attendanceRate: '98.1%',
    overtimeHours: 26,
    payroll: 5950000,
    mktAllocation: 1400000,
    status: 'CLOSED (100%)',
  },
  {
    id: 'out-11',
    no: 11,
    name: 'Cabang Pandu II',
    code: 'PD2',
    type: 'Internal (Pusat)',
    isInternal: true,
    grossPos: 30500000,
    cash: 16000000,
    nonCash: 14500000,
    bankDeposit: 30150000,
    pettyCash: 350000,
    variance: 0,
    stockAsset: 7500000,
    wasteRp: 210000,
    shrinkageRp: 110000,
    poPurchasing: 9500000,
    crewCount: 4,
    attendanceRate: '97.8%',
    overtimeHours: 24,
    payroll: 5800000,
    mktAllocation: 1300000,
    status: 'CLOSED (100%)',
  },
  {
    id: 'out-12',
    no: 12,
    name: 'Cabang Air Mancur',
    code: 'AMC',
    type: 'Internal (Pusat)',
    isInternal: true,
    grossPos: 35500000,
    cash: 18500000,
    nonCash: 17000000,
    bankDeposit: 35100000,
    pettyCash: 400000,
    variance: 0,
    stockAsset: 8700000,
    wasteRp: 240000,
    shrinkageRp: 130000,
    poPurchasing: 11000000,
    crewCount: 5,
    attendanceRate: '98.4%',
    overtimeHours: 30,
    payroll: 7150000,
    mktAllocation: 1500000,
    status: 'CLOSED (100%)',
  },

  // 6 Cabang Mitra (Franchise)
  {
    id: 'out-13',
    no: 13,
    name: 'Cabang Semplak',
    code: 'SMP',
    type: 'Mitra (Franchise)',
    isInternal: false,
    grossPos: 29500000,
    cash: 15500000,
    nonCash: 14000000,
    bankDeposit: 29160000,
    pettyCash: 340000,
    variance: 0,
    stockAsset: 4500000,
    wasteRp: 130000,
    shrinkageRp: 70000,
    poPurchasing: 9100000,
    crewCount: 4,
    attendanceRate: '98.0%',
    overtimeHours: 20,
    payroll: 5700000,
    mktAllocation: 1200000,
    status: 'CLOSED (100%)',
  },
  {
    id: 'out-14',
    no: 14,
    name: 'Cabang Ciawi',
    code: 'CW',
    type: 'Mitra (Franchise)',
    isInternal: false,
    grossPos: 36000000,
    cash: 19000000,
    nonCash: 17000000,
    bankDeposit: 35590000,
    pettyCash: 410000,
    variance: 0,
    stockAsset: 5200000,
    wasteRp: 160000,
    shrinkageRp: 90000,
    poPurchasing: 11200000,
    crewCount: 5,
    attendanceRate: '97.6%',
    overtimeHours: 24,
    payroll: 7000000,
    mktAllocation: 1500000,
    status: 'CLOSED (100%)',
  },
  {
    id: 'out-15',
    no: 15,
    name: 'Cabang Ciomas',
    code: 'CMS',
    type: 'Mitra (Franchise)',
    isInternal: false,
    grossPos: 27000000,
    cash: 14000000,
    nonCash: 13000000,
    bankDeposit: 26680000,
    pettyCash: 320000,
    variance: 0,
    stockAsset: 4100000,
    wasteRp: 110000,
    shrinkageRp: 60000,
    poPurchasing: 8400000,
    crewCount: 4,
    attendanceRate: '98.2%',
    overtimeHours: 18,
    payroll: 5550000,
    mktAllocation: 1100000,
    status: 'CLOSED (100%)',
  },
  {
    id: 'out-16',
    no: 16,
    name: 'Cabang Cimahpar',
    code: 'CMP',
    type: 'Mitra (Franchise)',
    isInternal: false,
    grossPos: 25500000,
    cash: 13500000,
    nonCash: 12000000,
    bankDeposit: 25190000,
    pettyCash: 310000,
    variance: 0,
    stockAsset: 3900000,
    wasteRp: 100000,
    shrinkageRp: 50000,
    poPurchasing: 7900000,
    crewCount: 4,
    attendanceRate: '98.5%',
    overtimeHours: 16,
    payroll: 5400000,
    mktAllocation: 1050000,
    status: 'CLOSED (100%)',
  },
  {
    id: 'out-17',
    no: 17,
    name: 'Cabang Kota Wisata',
    code: 'KTW',
    type: 'Mitra (Franchise)',
    isInternal: false,
    grossPos: 43000000,
    cash: 22000000,
    nonCash: 21000000,
    bankDeposit: 42490000,
    pettyCash: 510000,
    variance: 0,
    stockAsset: 6400000,
    wasteRp: 200000,
    shrinkageRp: 100000,
    poPurchasing: 13300000,
    crewCount: 5,
    attendanceRate: '98.9%',
    overtimeHours: 26,
    payroll: 7200000,
    mktAllocation: 1750000,
    status: 'CLOSED (100%)',
  },
  {
    id: 'out-18',
    no: 18,
    name: 'Cabang Sentul',
    code: 'STL',
    type: 'Mitra (Franchise)',
    isInternal: false,
    grossPos: 41000000,
    cash: 21000000,
    nonCash: 20000000,
    bankDeposit: 40510000,
    pettyCash: 490000,
    variance: 0,
    stockAsset: 6100000,
    wasteRp: 150000,
    shrinkageRp: 80000,
    poPurchasing: 12700000,
    crewCount: 5,
    attendanceRate: '98.7%',
    overtimeHours: 25,
    payroll: 7050000,
    mktAllocation: 1700000,
    status: 'CLOSED (100%)',
  },

  // 1 Online Center / Central Hub
  {
    id: 'out-19',
    no: 19,
    name: 'SS Online Center',
    code: 'ONL',
    type: 'Online / Central',
    isInternal: true,
    grossPos: 17000000,
    cash: 4000000,
    nonCash: 13000000,
    bankDeposit: 16820000,
    pettyCash: 180000,
    variance: 0,
    stockAsset: 600000,
    wasteRp: 60000,
    shrinkageRp: 30000,
    poPurchasing: 5300000,
    crewCount: 5,
    attendanceRate: '99.0%',
    overtimeHours: 15,
    payroll: 9500000,
    mktAllocation: 900000,
    status: 'CLOSED (100%)',
  },
]

export function getOutletsSummaryTotals() {
  const grossPos = OUTLETS_19_DATA.reduce((a, b) => a + b.grossPos, 0)
  const cash = OUTLETS_19_DATA.reduce((a, b) => a + b.cash, 0)
  const nonCash = OUTLETS_19_DATA.reduce((a, b) => a + b.nonCash, 0)
  const bankDeposit = OUTLETS_19_DATA.reduce((a, b) => a + b.bankDeposit, 0)
  const pettyCash = OUTLETS_19_DATA.reduce((a, b) => a + b.pettyCash, 0)
  const stockAsset = OUTLETS_19_DATA.reduce((a, b) => a + b.stockAsset, 0)
  const wasteRp = OUTLETS_19_DATA.reduce((a, b) => a + b.wasteRp, 0)
  const shrinkageRp = OUTLETS_19_DATA.reduce((a, b) => a + b.shrinkageRp, 0)
  const poPurchasing = OUTLETS_19_DATA.reduce((a, b) => a + b.poPurchasing, 0)
  const crewCount = OUTLETS_19_DATA.reduce((a, b) => a + b.crewCount, 0)
  const payroll = OUTLETS_19_DATA.reduce((a, b) => a + b.payroll, 0)
  const mktAllocation = OUTLETS_19_DATA.reduce((a, b) => a + b.mktAllocation, 0)

  return {
    grossPos,
    cash,
    nonCash,
    bankDeposit,
    pettyCash,
    variance: 0,
    stockAsset,
    wasteRp,
    shrinkageRp,
    poPurchasing,
    crewCount,
    payroll,
    mktAllocation,
  }
}

// Fungsi pembantu Ekspor CSV Spreadsheet Lengkap
export function exportDivisionToCsv(divisionKey: string, monthName: string, yearNum: number) {
  const report = DIVISION_FULL_REPORTS[divisionKey]
  if (!report) return

  const docNumber = `${report.codePrefix}/${yearNum}/${String(new Date().getMonth() + 1).padStart(2, '0')}`

  let csvContent = '\uFEFF' // UTF-8 BOM untuk Excel Indonesia
  csvContent += `SUKA SHAWARMA INDONESIA - SISTEM OUTLET SUITE\n`
  csvContent += `${report.title}\n`
  csvContent += `Nomor Dokumen: ${docNumber}\n`
  csvContent += `Periode: ${monthName} ${yearNum}\n`
  csvContent += `Status Dokumen: VERIFIED & LOCKED\n`
  csvContent += `\n`

  // Summary KPIs
  csvContent += `RINGKASAN METRIK KUNCI:\n`
  report.summaryKpis.forEach((kpi) => {
    csvContent += `${kpi.label},${kpi.value}\n`
  })
  csvContent += `\n`

  // Headers
  const headerLabels = report.columns.map((c) => `"${c.label}"`).join(',')
  csvContent += `${headerLabels}\n`

  // Rows
  report.rows.forEach((r) => {
    const rowValues = report.columns.map((c) => {
      const val = r[c.key]
      if (val === undefined || val === null) return '""'
      if (typeof val === 'number') return `"${val}"`
      return `"${String(val).replace(/"/g, '""')}"`
    }).join(',')
    csvContent += `${rowValues}\n`
  })

  // 19 Outlet Breakdown in CSV
  csvContent += `\n`
  csvContent += `LAMPIRAN REKAPITULASI 19 OUTLET LENGKAP:\n`
  csvContent += `"No","Nama Outlet Cabang","Tipe","Omzet POS","Setoran Bank","Kas Kecil","Aset Stok (SO)","Waste","Shrinkage","Kru","Kehadiran","Payroll","Status"\n`
  OUTLETS_19_DATA.forEach((o) => {
    csvContent += `"${o.no}","${o.name}","${o.type}","${o.grossPos}","${o.bankDeposit}","${o.pettyCash}","${o.stockAsset}","${o.wasteRp}","${o.shrinkageRp}","${o.crewCount}","${o.attendanceRate}","${o.payroll}","${o.status}"\n`
  })

  // Sign-off
  csvContent += `\n`
  csvContent += `PENGESAHAN DOKUMEN:\n`
  csvContent += `Disusun Oleh: ${report.preparedByRole}\n`
  csvContent += `Diverifikasi Oleh: ${report.verifiedByRole}\n`
  csvContent += `Disetujui Oleh: ${report.approvedByRole}\n`

  // Trigger Download
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.setAttribute('href', url)
  link.setAttribute('download', `Laporan_${report.divisionKey}_${monthName}_${yearNum}.csv`)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

