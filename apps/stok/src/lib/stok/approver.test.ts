import { describe, it, expect } from 'vitest'
import { isApproverRole, canApproveOpname, canApprovePermintaan } from './approver'

describe('isApproverRole', () => {
  it('kitchen, spv, dan leader adalah approver permintaan', () => {
    expect(isApproverRole('kitchen')).toBe(true)
    expect(isApproverRole('spv')).toBe(true)
    expect(isApproverRole('leader')).toBe(true)
  })

  it('crew dan role lain bukan approver', () => {
    expect(isApproverRole('crew')).toBe(false)
    expect(isApproverRole('kiosk')).toBe(false)
    expect(isApproverRole('mitra')).toBe(false)
  })

  it('role tak dikenal / belum termuat tidak dianggap approver', () => {
    expect(isApproverRole(undefined)).toBe(false)
    expect(isApproverRole(null)).toBe(false)
  })
})

describe('canApproveOpname', () => {
  it('leader, spv, kitchen, admin, owner boleh approve opname', () => {
    for (const role of ['leader', 'spv', 'kitchen', 'admin', 'owner']) {
      expect(canApproveOpname(role)).toBe(true)
    }
  })

  it('crew tidak boleh approve opname-nya sendiri', () => {
    expect(canApproveOpname('crew')).toBe(false)
  })

  it('role read-only & non-operasional ditolak', () => {
    for (const role of ['mitra', 'kiosk', 'staff_pusat', 'admin_finance', 'admin_hr']) {
      expect(canApproveOpname(role)).toBe(false)
    }
  })

  it('sesi tanpa role ditolak (fail closed)', () => {
    expect(canApproveOpname(undefined)).toBe(false)
    expect(canApproveOpname(null)).toBe(false)
    expect(canApproveOpname('')).toBe(false)
  })
})

describe('canApprovePermintaan', () => {
  // Kebijakan: hanya Gudang Pusat yang memutuskan pengeluaran barang;
  // admin/owner sebagai escalation. Approval ini menerbitkan surat jalan.
  it('kitchen, admin, owner boleh approve permintaan', () => {
    for (const role of ['kitchen', 'admin', 'owner']) {
      expect(canApprovePermintaan(role)).toBe(true)
    }
  })

  it('spv & leader TIDAK boleh approve permintaan (hanya mengawasi)', () => {
    expect(canApprovePermintaan('spv')).toBe(false)
    expect(canApprovePermintaan('leader')).toBe(false)
  })

  it('crew tidak boleh menyetujui permintaannya sendiri', () => {
    expect(canApprovePermintaan('crew')).toBe(false)
  })

  it('sesi tanpa role ditolak (fail closed)', () => {
    expect(canApprovePermintaan(undefined)).toBe(false)
    expect(canApprovePermintaan(null)).toBe(false)
    expect(canApprovePermintaan('')).toBe(false)
  })
})
