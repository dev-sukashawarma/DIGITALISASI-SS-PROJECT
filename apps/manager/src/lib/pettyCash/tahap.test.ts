import { describe, expect, it } from 'vitest'
import { STATUS_DANA_DI_LACI, labelStatusPettyCash, perluKonfirmasiLeader, sedangBerjalan } from './tahap'

describe('tahap petty cash tanpa AM', () => {
  it('hanya approved_by_finance yang menunggu konfirmasi leader', () => {
    expect(perluKonfirmasiLeader('approved_by_finance')).toBe(true)
    for (const s of ['forwarded_to_finance', 'forwarded_by_leader', 'forwarded_by_area_manager', 'forwarded_by_finance', 'rejected']) {
      expect(perluKonfirmasiLeader(s)).toBe(false)
    }
  })

  it('pengajuan yang masih berjalan = menunggu Finance atau menunggu konfirmasi leader', () => {
    expect(sedangBerjalan('forwarded_to_finance')).toBe(true)
    expect(sedangBerjalan('approved_by_finance')).toBe(true)
    for (const s of ['forwarded_to_area_manager', 'forwarded_by_leader', 'completed', 'rejected']) {
      expect(sedangBerjalan(s)).toBe(false)
    }
  })

  it('label status tanpa menyebut Area Manager untuk alur baru', () => {
    expect(labelStatusPettyCash('forwarded_to_finance')).toBe('Menunggu Finance')
    expect(labelStatusPettyCash('approved_by_finance')).toBe('Sudah ditransfer, menunggu konfirmasi leader')
    expect(labelStatusPettyCash('forwarded_by_leader')).toBe('Dana diterima (saldo bertambah)')
    expect(labelStatusPettyCash('rejected')).toBe('Ditolak')
    expect(labelStatusPettyCash('forwarded_to_area_manager')).toBe('Menunggu Area Manager (alur lama)')
    expect(labelStatusPettyCash('status_aneh')).toBe('status aneh')
  })

  it('dana baru dihitung di laci setelah leader konfirmasi, bukan saat Finance transfer', () => {
    expect(STATUS_DANA_DI_LACI).toContain('forwarded_by_leader')
    expect(STATUS_DANA_DI_LACI).not.toContain('approved_by_finance')
    expect(STATUS_DANA_DI_LACI).not.toContain('forwarded_to_finance')
  })
})
