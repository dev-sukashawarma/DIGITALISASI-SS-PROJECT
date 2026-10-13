import { describe, it, expect } from 'vitest'
import { buatJawabanDev } from './devSimulasi'

describe('buatJawabanDev', () => {
  it('menghasilkan telemetri penjualan ketika user bertanya omzet', () => {
    const chunks = buatJawabanDev('bagaimana omzet hari ini?', 'ceo')
    const full = chunks.join('')
    expect(full).toContain('Ringkasan Penjualan Hari Ini')
    expect(full).toContain('SS Paledang')
    expect(full).toContain('SS Lodaya')
  })

  it('menghasilkan telemetri gudang ketika user bertanya stok', () => {
    const chunks = buatJawabanDev('cek stok bahan baku', 'gudang')
    const full = chunks.join('')
    expect(full).toContain('Gudang Central')
    expect(full).toContain('Daging Sapi Marinasi')
    expect(full).toContain('Roti Pita Premium')
  })

  it('menghasilkan telemetri hrd ketika user bertanya absensi', () => {
    const chunks = buatJawabanDev('siapa saja kru yang bertugas hari ini?', 'hrd')
    const full = chunks.join('')
    expect(full).toContain('Workforce Management')
    expect(full).toContain('Total Kru Bertugas')
    expect(full).toContain('Shift Pagi')
  })

  it('menghasilkan telemetri finance ketika user bertanya opex', () => {
    const chunks = buatJawabanDev('laporan opex dan petty cash', 'finance')
    const full = chunks.join('')
    expect(full).toContain('Realisasi OPEX')
    expect(full).toContain('Petty Cash')
  })

  it('menghasilkan status diagnostik sistem menyeluruh', () => {
    const chunks = buatJawabanDev('status report menyeluruh', 'ceo')
    const full = chunks.join('')
    expect(full).toContain('SEMUA SISTEM NOMINAL')
    expect(full).toContain('Arc Reactor Core')
    expect(full).toContain('Node CEO')
  })

  it('menghasilkan sapaan default jika pertanyaan tidak spesifik', () => {
    const chunks = buatJawabanDev('halo selamat siang', 'ceo')
    const full = chunks.join('')
    expect(full).toContain('Salam, Sir')
    expect(full).toContain('Local Development Mode')
  })
})
