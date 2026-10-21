import { describe, it, expect } from 'vitest'
import { buatJawabanDev } from './devSimulasi'
import type { TelemetriHariIni } from './telemetriNyata'

describe('Bot CEO Cross-App Integrated Output Verification', () => {
  const fullFixedTelemetri: TelemetriHariIni = {
    tanggalWIB: '2026-10-21',
    tanggalKemarinWIB: '2026-10-20',
    omzetTotal: 15420000,
    totalOrder: 215,
    aov: 71720,
    outlets: [
      { id: '1', nama: 'SUKA SHAWARMA TEBET', type: 'internal', omzet: 5200000, orderCount: 72 },
      { id: '2', nama: 'SUKA SHAWARMA CONDET', type: 'internal', omzet: 4800000, orderCount: 65 },
      { id: '3', nama: 'SUKA SHAWARMA BINTARO', type: 'mitra', omzet: 3420000, orderCount: 48 },
      { id: '4', nama: 'SUKA SHAWARMA DRAMAGA', type: 'internal', omzet: 2000000, orderCount: 30 },
      { id: '5', nama: 'SUKA SHAWARMA MARGONDA', type: 'internal', omzet: 0, orderCount: 0 },
    ],
    outletsAktifTransaksi: [
      { id: '1', nama: 'SUKA SHAWARMA TEBET', type: 'internal', omzet: 5200000, orderCount: 72 },
      { id: '2', nama: 'SUKA SHAWARMA CONDET', type: 'internal', omzet: 4800000, orderCount: 65 },
      { id: '3', nama: 'SUKA SHAWARMA BINTARO', type: 'mitra', omzet: 3420000, orderCount: 48 },
      { id: '4', nama: 'SUKA SHAWARMA DRAMAGA', type: 'internal', omzet: 2000000, orderCount: 30 },
    ],
    outletsNolTransaksi: [
      { id: '5', nama: 'SUKA SHAWARMA MARGONDA', type: 'internal', omzet: 0, orderCount: 0 },
    ],
    topMenu: [
      { nama: 'Shawarma Beef Large Garlic Mayo', qty: 110, omzet: 5500000 },
      { nama: 'Shawarma Chicken Medium Spicy', qty: 85, omzet: 3400000 },
    ],
    topMenuKemarin: [
      { nama: 'Shawarma Beef Large Garlic Mayo', qty: 145, omzet: 7250000 },
      { nama: 'Shawarma Chicken Medium Spicy', qty: 98, omzet: 3920000 },
    ],
    ringkasanHariIni: {
      tanggalLabel: 'Hari Ini (2026-10-21)',
      tglIso: '2026-10-21',
      omzetTotal: 15420000,
      totalOrder: 215,
      aov: 71720,
      outletsAktifTransaksi: [
        { id: '1', nama: 'SUKA SHAWARMA TEBET', type: 'internal', omzet: 5200000, orderCount: 72 },
        { id: '2', nama: 'SUKA SHAWARMA CONDET', type: 'internal', omzet: 4800000, orderCount: 65 },
      ],
      outletsNolTransaksi: [
        { id: '5', nama: 'SUKA SHAWARMA MARGONDA', type: 'internal', omzet: 0, orderCount: 0 },
      ],
      topMenu: [
        { nama: 'Shawarma Beef Large Garlic Mayo', qty: 110, omzet: 5500000 },
      ],
    },
    ringkasanKemarin: {
      tanggalLabel: 'Kemarin (2026-10-20)',
      tglIso: '2026-10-20',
      omzetTotal: 65600000,
      totalOrder: 1080,
      aov: 60740,
      outletsAktifTransaksi: [
        { id: '2', nama: 'SUKA SHAWARMA CONDET', type: 'internal', omzet: 18400000, orderCount: 310 },
        { id: '1', nama: 'SUKA SHAWARMA TEBET', type: 'internal', omzet: 15200000, orderCount: 260 },
        { id: '3', nama: 'SUKA SHAWARMA BINTARO', type: 'mitra', omzet: 14000000, orderCount: 240 },
        { id: '4', nama: 'SUKA SHAWARMA DRAMAGA', type: 'internal', omzet: 10000000, orderCount: 160 },
        { id: '5', nama: 'SUKA SHAWARMA MARGONDA', type: 'internal', omzet: 8000000, orderCount: 110 },
      ],
      outletsNolTransaksi: [],
      topMenu: [
        { nama: 'Shawarma Beef Large Garlic Mayo', qty: 450, omzet: 22500000 },
      ],
    },
    kehadiranTotal: 62,
    kehadiranTepatWaktu: 58,
    kehadiranTelat: 4,
    persenOnTime: 94,
    totalOutletAktif: 28,
    bahanBaku: [
      { nama: 'Daging Sapi Marinasi', satuan: 'kg' },
      { nama: 'Daging Ayam Marinasi', satuan: 'kg' },
      { nama: 'Kulit Pita Jumbo', satuan: 'pack' },
    ],
    stafCutiIzin: [
      { nama: 'Ahmad Fauzi', role: 'Kasir', jenis: 'Izin Sakit', status: 'approved', alasan: 'Demam berdarah' },
    ],
    stafTelat: [
      { nama: 'Rizki Ramadhan', outlet: 'SUKA SHAWARMA CONDET', telatMenit: 18 },
      { nama: 'Fajar Nugraha', outlet: 'SUKA SHAWARMA TEBET', telatMenit: 12 },
    ],
    hrdKemarin: {
      tanggalIso: '2026-10-20',
      kehadiranTotal: 65,
      kehadiranTepatWaktu: 63,
      kehadiranTelat: 2,
      persenOnTime: 97,
      stafTelat: [
        { nama: 'Indra Pratama', outlet: 'SUKA SHAWARMA DRAMAGA', telatMenit: 25 },
      ],
      stafCutiIzin: [
        { nama: 'Ahmad Fauzi', role: 'Kasir', jenis: 'Izin Sakit', status: 'approved', alasan: 'Demam berdarah' },
      ],
    },
    waste: {
      totalLaporan30Hari: 42,
      totalEstKerugianRp: 1250000,
      topBahan: [
        { nama: 'Sayur Lettuce', satuan: 'kg', totalQty: 18.5, frekuensi: 14, alasanDominan: 'Potongan bonggol / layu', estKerugianRp: 450000 },
        { nama: 'Kulit Pita 25', satuan: 'pack', totalQty: 8, frekuensi: 6, alasanDominan: 'Robek saat pemanggangan', estKerugianRp: 240000 },
      ],
      topOutlet: [
        { nama: 'SUKA SHAWARMA DRAMAGA', frekuensi: 12, totalQty: 15.2 },
      ],
      laporanHariIniCount: 2,
      estKerugianHariIniRp: 85000,
      laporanKemarinCount: 4,
      estKerugianKemarinRp: 140000,
    },
    voidOrder: {
      totalVoidHariIni: 1,
      totalNilaiVoidHariIni: 45000,
      daftarOutletVoidHariIni: [
        { outlet: 'SUKA SHAWARMA TEBET', nilai: 45000, waktu: '12:15' },
      ],
      totalVoidKemarin: 2,
      totalNilaiVoidKemarin: 90000,
      daftarOutletVoidKemarin: [
        { outlet: 'SUKA SHAWARMA DRAMAGA', nilai: 50000, waktu: '19:40' },
        { outlet: 'SUKA SHAWARMA CONDET', nilai: 40000, waktu: '21:10' },
      ],
    },
    statusBuka: {
      totalBuka: 26,
      totalBelumBuka: 2,
      daftarBuka: [
        { outlet: 'SUKA SHAWARMA TEBET', jamBuka: '10:00', status: 'open' },
        { outlet: 'SUKA SHAWARMA CONDET', jamBuka: '10:05', status: 'open' },
      ],
      daftarBelumBuka: ['SUKA SHAWARMA MARGONDA', 'SUKA SHAWARMA BOGOR BARAT'],
      shiftKemarinClosedCount: 28,
      shiftKemarinTotalCount: 28,
    },
    finance: {
      pengeluaranHariIni: {
        totalNominal: 485000,
        jumlahTransaksi: 3,
        topPengeluaran: [
          { id: '1', nominal: 250000, deskripsi: 'Beli Es Batu & Galon', outlet: 'SUKA SHAWARMA CONDET', kategori: 'petty_cash', tipe: 'petty_cash', tanggal: '2026-10-21' },
          { id: '2', nominal: 150000, deskripsi: 'Gas LPG 3kg x3', outlet: 'SUKA SHAWARMA TEBET', kategori: 'petty_cash', tipe: 'petty_cash', tanggal: '2026-10-21' },
        ],
      },
      pengeluaranKemarin: {
        totalNominal: 2850000,
        jumlahTransaksi: 8,
        topPengeluaran: [
          { id: 'k1', nominal: 1500000, deskripsi: 'Service Exhaust Fan & Chiller', outlet: 'SUKA SHAWARMA DRAMAGA', kategori: 'maintenance', tipe: 'operasional', tanggal: '2026-10-20' },
          { id: 'k2', nominal: 450000, deskripsi: 'Perbaikan Lampu Signboard', outlet: 'SUKA SHAWARMA CONDET', kategori: 'maintenance', tipe: 'operasional', tanggal: '2026-10-20' },
        ],
      },
      pengeluaranBulanIni: {
        totalNominal: 45200000,
        topPengeluaran: [],
      },
      utangPo: {
        totalUtang: 38400000,
        jumlahPo: 4,
        totalLewatJatuhTempo: 12000000,
        topSupplier: [
          { supplier: 'PT Agro Boga Daging Nusantara', total: 22000000, jumlahPo: 2, jatuhTempoTerdekat: '2026-10-25' },
          { supplier: 'CV Roti Pita Berkah', total: 16400000, jumlahPo: 2, jatuhTempoTerdekat: '2026-10-18' },
        ],
        daftarPo: [],
      },
      setoranKas: {
        daftarSetoranTerbaru: [
          { id: 's1', nominal: 18400000, outlet: 'SUKA SHAWARMA CONDET', tanggalJual: '2026-10-20', kategori: 'Setoran Bank BCA', status: 'reconciled', waktu: '2026-10-21T09:30:00Z' },
        ],
        inputHariIni: {
          totalNominal: 18400000,
          jumlahTransaksi: 1,
          rekapPerTanggalJual: [
            { tanggalJual: '2026-10-20', totalNominal: 18400000, jumlah: 1 },
          ],
        },
        tutupShiftKemarin: {
          totalFisikKas: 64200000,
          totalSetoranDirekap: 18400000,
          jumlahOutletClosed: 28,
          sudahDirekap: 1,
          belumDirekap: 27,
          daftarBelumSetor: ['SUKA SHAWARMA TEBET', 'SUKA SHAWARMA BINTARO'],
        },
      },
      selisihKasir: {
        daftarSelisihTerbaru: [],
        selisihKemarin: [
          { id: 'sk1', outlet: 'SUKA SHAWARMA DRAMAGA', kasir: 'Bambang', selisih: -25000, seharusnya: 4525000, fisik: 4500000, tanggal: '2026-10-20' },
        ],
        totalSelisihKemarinRp: -25000,
      },
    },
    review: {
      totalUlasan: 1420,
      ratingRataRata: 4.6,
      topCabangRating: [
        { outlet: 'SUKA SHAWARMA TEBET', rating: 4.8, totalUlasan: 310 },
        { outlet: 'SUKA SHAWARMA BINTARO', rating: 4.7, totalUlasan: 245 },
        { outlet: 'SUKA SHAWARMA MARGONDA', rating: 4.7, totalUlasan: 180 },
        { outlet: 'SUKA SHAWARMA CONDET', rating: 4.5, totalUlasan: 290 },
        { outlet: 'SUKA SHAWARMA DRAMAGA', rating: 3.9, totalUlasan: 112 },
      ],
      ulasanNegatifTerbaru: [
        { outlet: 'SUKA SHAWARMA DRAMAGA', reviewer: 'Hendra W.', rating: 1, komentar: 'Daging agak alot dan dingin pas sampai meja, antre lama.', waktu: '2026-10-20' },
      ],
    },
    saldoStok: [
      {
        bahanId: 'b-beef',
        nama: 'Daging Sapi Marinasi',
        satuan: 'kg',
        totalStokJaringan: 210,
        stokGudangPusat: 450,
        outletKritisCount: 2,
        daftarOutlet: [
          { outlet: 'SUKA SHAWARMA DRAMAGA', qty: 0, opnameTerakhir: '2026-10-20' },
          { outlet: 'SUKA SHAWARMA MARGONDA', qty: 0, opnameTerakhir: '2026-10-20' },
        ],
      },
      {
        bahanId: 'b-kulit',
        nama: 'Kulit Pita Jumbo',
        satuan: 'pack',
        totalStokJaringan: 180,
        stokGudangPusat: 300,
        outletKritisCount: 0,
        daftarOutlet: [],
      },
    ],
    distribusi: {
      totalSuratJalanDikirim: 12,
      totalSuratJalanAdaSelisih: 1,
      daftarSuratJalanTerbaru: [
        {
          id: 'sj-101',
          outlet: 'SUKA SHAWARMA DRAMAGA',
          status: 'terkirim',
          tanggal: '2026-10-21',
          totalItem: 6,
          adaSelisih: true,
          rincianSelisih: ['Daging Ayam Marinasi: kirim 20 kg, terima 18 kg (-2 kg) - bocor di perjalanan'],
        },
      ],
    },
  }

  it('CEO: Menjawab pertanyaan evaluasi kemarin (H-1) dengan angka penjualan, HRD, dan OPEX kemarin yang tepat', () => {
    const resSales = buatJawabanDev('bagaimana penjualan kemarin?', 'ceo', fullFixedTelemetri).join('')
    expect(resSales).toContain('65.600.000')
    expect(resSales).toContain('1.080')
    expect(resSales).toContain('SUKA SHAWARMA CONDET')

    const resHrd = buatJawabanDev('siapa yang telat kemarin?', 'ceo', fullFixedTelemetri).join('')
    expect(resHrd).toContain('Indra Pratama')
    expect(resHrd).toContain('25 menit')
    expect(resHrd).toContain('Status Presensi Kemarin')

    const resOpex = buatJawabanDev('berapa opex kemarin?', 'ceo', fullFixedTelemetri).join('')
    expect(resOpex).toContain('Service Exhaust Fan & Chiller')
    expect(resOpex).toContain('1.500.000')
    expect(resOpex).toContain('OPEX TERBESAR KEMARIN')
  })

  it('Manager: Menjawab audit operasional cabang, void, waste, dan shift buka hari ini', () => {
    const resVoid = buatJawabanDev('ada void hari ini?', 'manager', fullFixedTelemetri).join('')
    expect(resVoid).toContain('SUKA SHAWARMA TEBET')
    expect(resVoid).toContain('45.000')

    const resWaste = buatJawabanDev('audit waste bahan', 'manager', fullFixedTelemetri).join('')
    expect(resWaste).toContain('Sayur Lettuce')
    expect(resWaste).toContain('Potongan bonggol / layu')

    const resBuka = buatJawabanDev('cabang mana yang belum buka?', 'manager', fullFixedTelemetri).join('')
    expect(resBuka).toContain('SUKA SHAWARMA MARGONDA')
    expect(resBuka).toContain('SUKA SHAWARMA BOGOR BARAT')
  })

  it('Finance: Menjawab utang supplier, setoran bank admin, dan selisih kasir', () => {
    const resUtang = buatJawabanDev('berapa utang po supplier?', 'finance', fullFixedTelemetri).join('')
    expect(resUtang).toContain('PT Agro Boga Daging Nusantara')
    expect(resUtang).toContain('38.400.000')
    expect(resUtang).toContain('12.000.000')

    const resSetoran = buatJawabanDev('rekap setoran kas hari ini', 'finance', fullFixedTelemetri).join('')
    expect(resSetoran).toContain('18.400.000')
    expect(resSetoran).toContain('SUKA SHAWARMA CONDET')
  })
})
