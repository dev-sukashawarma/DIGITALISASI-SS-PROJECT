import { describe, it, expect } from 'vitest'
import { buatJawabanDev } from './devSimulasi'
import type { TelemetriHariIni } from './telemetriNyata'

const mockTelemetri: TelemetriHariIni = {
  tanggalWIB: '2026-10-13',
  omzetTotal: 2787000,
  totalOrder: 34,
  aov: 81970,
  outlets: [
    { id: '1', nama: 'SUKA SHAWARMA CIMANGGU', type: 'internal', omzet: 1292000, orderCount: 8 },
    { id: '2', nama: 'SUKA SHAWARMA BNR', type: 'internal', omzet: 710000, orderCount: 8 },
    { id: '3', nama: 'GUDANG PUSAT (HQ)', type: 'office', omzet: 0, orderCount: 0 },
  ],
  outletsAktifTransaksi: [
    { id: '1', nama: 'SUKA SHAWARMA CIMANGGU', type: 'internal', omzet: 1292000, orderCount: 8 },
    { id: '2', nama: 'SUKA SHAWARMA BNR', type: 'internal', omzet: 710000, orderCount: 8 },
  ],
  outletsNolTransaksi: [
    { id: '3', nama: 'GUDANG PUSAT (HQ)', type: 'office', omzet: 0, orderCount: 0 },
  ],
  topMenu: [
    { nama: 'Original Ayam Jumbo', qty: 23, omzet: 1012000 },
    { nama: 'Original Sapi Besar', qty: 7, omzet: 270000 },
  ],
  kehadiranTotal: 70,
  kehadiranTepatWaktu: 65,
  kehadiranTelat: 5,
  persenOnTime: 93,
  totalOutletAktif: 28,
  bahanBaku: [
    { nama: 'GAS 12 KG', satuan: 'tabung' },
    { nama: 'KULIT 25', satuan: 'Pack' },
  ],
  stafCutiIzin: [
    {
      nama: 'Muhamad Andrian Hermawan',
      role: 'Staff Outlet',
      jenis: 'cuti tahunan',
      status: 'pending',
      alasan: 'ada kepentingan di rumah',
    },
  ],
  stafTelat: [
    {
      nama: 'Mohamad Raka',
      outlet: 'Mitra Sentul',
      telatMenit: 74,
    },
  ],
  finance: {
    pengeluaranHariIni: {
      totalNominal: 668500,
      jumlahTransaksi: 13,
      topPengeluaran: [
        {
          id: '1',
          nominal: 154000,
          deskripsi: 'gas x7',
          outlet: 'SUKA SHAWARMA CIMANGGU',
          kategori: 'pengeluaran_outlet',
          tipe: 'petty_cash',
          tanggal: '2026-10-13',
        },
        {
          id: '2',
          nominal: 104500,
          deskripsi: 'token listrik toko',
          outlet: 'MITRA CICURUG',
          kategori: 'pengeluaran_outlet',
          tipe: 'petty_cash',
          tanggal: '2026-10-13',
        },
      ],
    },
    pengeluaranBulanIni: {
      totalNominal: 25000000,
      topPengeluaran: [],
    },
    utangPo: {
      totalUtang: 1548595382,
      jumlahPo: 85,
      totalLewatJatuhTempo: 35000000,
      topSupplier: [
        { supplier: 'PT Agro Boga Utama', total: 19200000, jumlahPo: 1, jatuhTempoTerdekat: '2026-12-03' },
      ],
      daftarPo: [],
    },
    setoranKas: {
      daftarSetoranTerbaru: [
        { id: '1', nominal: 886000, outlet: 'MITRA CICURUG', tanggalJual: '2026-10-12', status: 'reconciled', kategori: 'Setoran Bank', waktu: '' },
      ],
    },
    selisihKasir: {
      daftarSelisihTerbaru: [
        { id: '1', outlet: 'MITRA CIBUBUR', kasir: 'Adhi Setiawan', selisih: 92000, seharusnya: 0, fisik: 92000, tanggal: '' },
      ],
    },
  },
}

describe('buatJawabanDev', () => {
  it('menghasilkan direktori semua cabang ketika user bertanya tampilkan semua outlet', () => {
    const chunks = buatJawabanDev('tampilkan semua outlet', 'ceo', mockTelemetri)
    const full = chunks.join('')
    expect(full).toContain('NETWORK TELEMETRY DIRECTIVE')
    expect(full).toContain('SUKA SHAWARMA CIMANGGU')
    expect(full).toContain('SUKA SHAWARMA BNR')
    expect(full).toContain('GUDANG PUSAT (HQ)')
  })

  it('menghasilkan telemetri penjualan nyata ketika user bertanya omzet', () => {
    const chunks = buatJawabanDev('bagaimana omzet hari ini?', 'ceo', mockTelemetri)
    const full = chunks.join('')
    expect(full).toContain('Ringkasan Penjualan Hari Ini')
    expect(full).toContain('SUKA SHAWARMA CIMANGGU')
    expect(full).toContain('SUKA SHAWARMA BNR')
    expect(full).toContain('Original Ayam Jumbo')
    expect(full).toContain('LIVE POS CONNECTED')
  })

  it('menghasilkan katalog bahan baku ketika user bertanya stok', () => {
    const chunks = buatJawabanDev('cek stok bahan baku', 'gudang', mockTelemetri)
    const full = chunks.join('')
    expect(full).toContain('Gudang Central')
    expect(full).toContain('GAS 12 KG')
    expect(full).toContain('KULIT 25')
  })

  it('menghasilkan telemetri presensi nyata ketika user bertanya absensi', () => {
    const chunks = buatJawabanDev('siapa saja kru yang bertugas hari ini?', 'hrd', mockTelemetri)
    const full = chunks.join('')
    expect(full).toContain('Workforce Management')
    expect(full).toContain('70 catatan clock-in/out')
    expect(full).toContain('93%')
    expect(full).toContain('Muhamad Andrian Hermawan')
    expect(full).toContain('Mohamad Raka')
  })

  it('menghasilkan data cuti dan telat ketika user bertanya yang ga masuk siapa', () => {
    const chunks = buatJawabanDev('yang ga masuk hari ini siapa?', 'ceo', mockTelemetri)
    const full = chunks.join('')
    expect(full).toContain('Kru Izin / Cuti Terdata')
    expect(full).toContain('Muhamad Andrian Hermawan')
    expect(full).toContain('Mohamad Raka')
  })

  it('menghasilkan ringkasan finance nyata ketika user bertanya opex / finance', () => {
    const chunks = buatJawabanDev('laporan keuangan dan kas', 'finance', mockTelemetri)
    const full = chunks.join('')
    expect(full).toContain('Ringkasan Keuangan')
    expect(full).toContain('LIVE FINANCE RECONCILIATION')
  })

  it('menjawab pertanyaan opex terbesar hari ini secara presisi dari telemetri finance', () => {
    const chunks = buatJawabanDev('opex terbedsar hari ini berapa?', 'finance', mockTelemetri)
    const full = chunks.join('')
    expect(full).toContain('OPEX TERBESAR HARI INI')
    expect(full).toContain('154.000')
    expect(full).toContain('gas x7')
    expect(full).toContain('SUKA SHAWARMA CIMANGGU')
    expect(full).not.toContain('Sir')
  })

  it('menjawab pertanyaan pengeluaran terbesar hari ini dengan persona Rekan Tim Finance', () => {
    const chunks = buatJawabanDev('pengeluran terbesar hari ni apa?', 'finance', mockTelemetri)
    const full = chunks.join('')
    expect(full).toContain('OPEX TERBESAR HARI INI')
    expect(full).toContain('154.000')
    expect(full).toContain('gas x7')
    expect(full).toContain('Rekan')
    expect(full).not.toContain('Sir')
  })

  it('menjawab pertanyaan tools apa saja dengan katalog 4 alat MCP finance', () => {
    const chunks = buatJawabanDev('tools yang kamu punya apa aaja', 'finance', mockTelemetri)
    const full = chunks.join('')
    expect(full).toContain('utang_po')
    expect(full).toContain('pengeluaran_ringkasan')
    expect(full).toContain('setoran_ringkasan')
    expect(full).toContain('selisih_kasir')
    expect(full).toContain('Rekan')
    expect(full).not.toContain('Sir')
  })

  it('menghapus tanda kutip ganda dan menjawab opex terbesar hari ini secara presisi', () => {
    const chunks = buatJawabanDev('"opex terbesar hari ini berapa?"', 'finance', mockTelemetri)
    const full = chunks.join('')
    expect(full).toContain('OPEX TERBESAR HARI INI')
    expect(full).toContain('154.000')
    expect(full).toContain('gas x7')
    expect(full).toContain('SUKA SHAWARMA CIMANGGU')
  })

  it('menjawab pertanyaan utang po supplier secara presisi', () => {
    const chunks = buatJawabanDev('berapa utang po ke supplier?', 'finance', mockTelemetri)
    const full = chunks.join('')
    expect(full).toContain('UTANG PO SUPPLIER')
    expect(full).toContain('PT Agro Boga Utama')
  })

  it('menghasilkan status diagnostik sistem menyeluruh', () => {
    const chunks = buatJawabanDev('status report menyeluruh', 'ceo', mockTelemetri)
    const full = chunks.join('')
    expect(full).toContain('SEMUA SISTEM NOMINAL')
    expect(full).toContain('Arc Reactor Core')
    expect(full).toContain('SUKA SHAWARMA CIMANGGU')
  })

  it('menghasilkan sapaan default jika pertanyaan tidak spesifik', () => {
    const chunks = buatJawabanDev('halo selamat siang', 'ceo', mockTelemetri)
    const full = chunks.join('')
    expect(full).toContain('Salam, Sir')
    expect(full).toContain('LIVE DATA STREAM ACTIVE')
  })

  it('menampilkan rincian waste bahan baku ketika data waste tersedia', () => {
    const telemetriDenganWaste: TelemetriHariIni = {
      ...mockTelemetri,
      waste: {
        totalLaporan30Hari: 120,
        totalEstKerugianRp: 15000000,
        topBahan: [
          {
            nama: 'Sayur (lettuce)',
            satuan: 'kg',
            totalQty: 50,
            frekuensi: 40,
            estKerugianRp: 12000000,
            alasanDominan: 'bonggol',
          },
        ],
        topOutlet: [{ nama: 'MITRA CIBINONG', frekuensi: 25, totalQty: 30 }],
        laporanHariIniCount: 2,
      },
    }
    const chunks = buatJawabanDev('waste yang paling tinggi apa ya?', 'manager', telemetriDenganWaste)
    const full = chunks.join('')
    expect(full).toContain('Waste & Reject Bahan Baku')
    expect(full).toContain('Sayur (lettuce)')
    expect(full).toContain('MITRA CIBINONG')
  })

  it('menampilkan audit void dan status buka cabang dengan tepat', () => {
    const telemetriVoidDanBuka: TelemetriHariIni = {
      ...mockTelemetri,
      voidOrder: {
        totalVoidHariIni: 2,
        totalNilaiVoidHariIni: 75000,
        daftarOutletVoidHariIni: [{ outlet: 'PAJAJARAN', nilai: 75000, waktu: '11:20' }],
      },
      statusBuka: {
        totalBuka: 17,
        totalBelumBuka: 11,
        daftarBuka: [{ outlet: 'CIMANGGU', jamBuka: '10:55', status: 'open' }],
        daftarBelumBuka: ['OUTLET TEST'],
      },
    }
    const chunksVoid = buatJawabanDev('ada void hari ini?', 'manager', telemetriVoidDanBuka)
    expect(chunksVoid.join('')).toContain('PAJAJARAN')
    expect(chunksVoid.join('')).toContain('2 transaksi')

    const chunksBuka = buatJawabanDev('cabang mana yang belum buka?', 'manager', telemetriVoidDanBuka)
    expect(chunksBuka.join('')).toContain('OUTLET TEST')
    expect(chunksBuka.join('')).toContain('CIMANGGU')
  })

  it('menggunakan persona manajer operasional dan tidak membocorkan persona CEO / Sir', () => {
    const chunksDefault = buatJawabanDev('halo selamat siang', 'manager', mockTelemetri)
    const fullDefault = chunksDefault.join('')
    expect(fullDefault).toContain('Halo Rekan Tim Operasional Suka Shawarma')
    expect(fullDefault).not.toContain('Sir')
    expect(fullDefault).not.toContain('J.A.R.V.I.S.')
    expect(fullDefault).not.toContain('Arc Reactor')

    const chunksWaste = buatJawabanDev('ada waste ga hari ini', 'manager', mockTelemetri)
    const fullWaste = chunksWaste.join('')
    expect(fullWaste).toContain('Data waste dan reject bahan baku hari ini belum tercatat')
    expect(fullWaste).toContain('closing shift dan stok opname fisik')
    expect(fullWaste).not.toContain('Sir')
    expect(fullWaste).not.toContain('J.A.R.V.I.S.')

    const chunksDiagnostik = buatJawabanDev('status report menyeluruh', 'manager', mockTelemetri)
    const fullDiagnostik = chunksDiagnostik.join('')
    expect(fullDiagnostik).toContain('Halo Rekan Tim Operasional')
    expect(fullDiagnostik).not.toContain('Arc Reactor Core')
    expect(fullDiagnostik).not.toContain('Sir')

    const telemetriNolTelat = { ...mockTelemetri, stafTelat: [] }
    const chunksPresensi = buatJawabanDev('ada yang telat ga hari ini', 'manager', telemetriNolTelat)
    const fullPresensi = chunksPresensi.join('')
    expect(fullPresensi).toContain('Seluruh kru outlet on-time hari ini, tidak ada keterlambatan di cabang')
    expect(fullPresensi).toContain('Presensi & Kedisiplinan Kru')
    expect(fullPresensi).not.toContain('Sir')

    const chunksSidak = buatJawabanDev('ceklist pembukaan cabang dan sidak', 'manager', mockTelemetri)
    const fullSidak = chunksSidak.join('')
    expect(fullSidak).toContain('Ceklist Buka & Sidak Lapangan')
    expect(fullSidak).not.toContain('Sir')

    const chunksKas = buatJawabanDev('apakah ada selisih kas kasir closing?', 'manager', mockTelemetri)
    const fullKas = chunksKas.join('')
    expect(fullKas).toContain('Parameter Alert Selisih Kas')
    expect(fullKas).not.toContain('Sir')

    const chunksFinance = buatJawabanDev('laporan keuangan dan kas', 'manager', mockTelemetri)
    const fullFinance = chunksFinance.join('')
    expect(fullFinance).toContain('seluruh modul keuangan siaga, Rekan.')
    expect(fullFinance).not.toContain('Sir')
  })
  it('menangani pertanyaan temporal presensi dan opex kemarin (H-1) dengan data hrdKemarin dan pengeluaranKemarin', () => {
    const telemetriDenganKemarin: TelemetriHariIni = {
      ...mockTelemetri,
      tanggalKemarinWIB: '2026-10-12',
      hrdKemarin: {
        tanggalIso: '2026-10-12',
        kehadiranTotal: 68,
        kehadiranTepatWaktu: 60,
        kehadiranTelat: 8,
        persenOnTime: 88,
        stafTelat: [
          { nama: 'Budi Kemarin', outlet: 'Cabang Tebet', telatMenit: 35 },
        ],
        stafCutiIzin: [
          { nama: 'Siti Kemarin', role: 'Staff Outlet', jenis: 'izin sakit', status: 'approved', alasan: 'demam' },
        ],
      },
      finance: {
        ...mockTelemetri.finance!,
        pengeluaranKemarin: {
          totalNominal: 1250000,
          jumlahTransaksi: 5,
          topPengeluaran: [
            {
              id: 'k1',
              nominal: 500000,
              deskripsi: 'Service Chiller Kemarin',
              outlet: 'SUKA SHAWARMA TEBET',
              kategori: 'maintenance',
              tipe: 'operasional',
              tanggal: '2026-10-12',
            },
          ],
        },
      },
    }

    const chunksPresensi = buatJawabanDev('siapa yang telat kemarin?', 'ceo', telemetriDenganKemarin)
    const textPresensi = chunksPresensi.join('')
    expect(textPresensi).toContain('Budi Kemarin')
    expect(textPresensi).toContain('35 menit')
    expect(textPresensi).toContain('Siti Kemarin')
    expect(textPresensi).toContain('Status Presensi Kemarin')

    const chunksOpex = buatJawabanDev('berapa opex kemarin?', 'ceo', telemetriDenganKemarin)
    const textOpex = chunksOpex.join('')
    expect(textOpex).toContain('Service Chiller Kemarin')
    expect(textOpex).toContain('OPEX TERBESAR KEMARIN')
  })

  it('menghasilkan laporan evaluasi komprehensif dari semua app dan saran taktis saat ditanya evaluasi kemarin', () => {
    const chunks = buatJawabanDev(
      'Buat laporan evaluasi komprehensif kemarin (H-1) dari semua aplikasi (penjualan, finance, HRD, waste, stok, distribusi, dan review) lengkap dengan rekomendasi dan saran taktis dari agent.',
      'ceo',
      mockTelemetri
    )
    const full = chunks.join('')
    expect(full).toContain('LAPORAN EVALUASI OPERASIONAL & EKSEKUTIF KOMPREHENSIF')
    expect(full).toContain('EXECUTIVE SUMMARY & MULTI-APP SCORECARD')
    expect(full).toContain('REKAPITULASI KINERJA MULTI-APP (LINTAS DIVISI)')
    expect(full).toContain('RADAR ANOMALI & RED FLAGS KRITIS')
    expect(full).toContain('REKOMENDASI & SARAN STRATEGIS AGENT (ACTIONABLE SUGGESTIONS)')
    expect(full).toContain('Sir')
  })
})
