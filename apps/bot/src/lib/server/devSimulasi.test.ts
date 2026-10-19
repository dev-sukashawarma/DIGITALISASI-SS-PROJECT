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
})

