import { describe, it, expect } from 'vitest'
import { canCatatTerimaVendor, canSahkanNotaVendor, canLihatNotaVendor, canViewPermintaanQueue, canApproveMutasi } from './approver'

describe('drop-ship: peran', () => {
  it('pengesah = purchasing, kitchen, admin (keputusan owner 2026-09-11)', () => {
    for (const r of ['purchasing', 'kitchen', 'admin']) expect(canSahkanNotaVendor(r)).toBe(true)
    for (const r of ['owner', 'admin_finance', 'crew', 'leader', 'spv', null]) expect(canSahkanNotaVendor(r)).toBe(false)
  })
  it('owner & admin_finance boleh melihat, tidak mengesahkan', () => {
    expect(canLihatNotaVendor('owner')).toBe(true)
    expect(canLihatNotaVendor('admin_finance')).toBe(true)
    expect(canLihatNotaVendor('crew')).toBe(false)
  })
  it('pencatat = siapa pun yang punya outlet sendiri', () => {
    expect(canCatatTerimaVendor('d23e11b3-0000-0000-0000-000000000000')).toBe(true)
    expect(canCatatTerimaVendor(null)).toBe(false)
  })
})

describe('permintaan bahan: tampilan antrean', () => {
  it('leader TIDAK melihat antrean -- tampilan sama seperti crew', () => {
    expect(canViewPermintaanQueue('leader')).toBe(false)
    expect(canViewPermintaanQueue('crew')).toBe(false)
  })
  it('role monitoring/approval lain tetap melihat antrean', () => {
    for (const r of ['kitchen', 'admin_finance', 'spv', 'regional_manager', 'purchasing', 'admin', 'owner']) {
      expect(canViewPermintaanQueue(r)).toBe(true)
    }
  })
})

describe('mutasi: peran persetujuan', () => {
  it('hanya kitchen, admin, owner, developer yang boleh menyetujui atau menolak', () => {
    for (const r of ['kitchen', 'admin', 'owner', 'developer']) {
      expect(canApproveMutasi(r)).toBe(true)
    }
  })
  it('kru, leader, spv, dan peran cabang lainnya dilarang', () => {
    for (const r of ['crew', 'leader', 'spv', 'regional_manager', 'area_manager', 'purchasing', 'admin_finance', 'mitra', null, undefined]) {
      expect(canApproveMutasi(r)).toBe(false)
    }
  })
})
