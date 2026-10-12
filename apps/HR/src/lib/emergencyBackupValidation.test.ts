import { describe, it, expect } from 'vitest'
import {
  validateEmergencyCrewEligibility,
  validateEmergencyAssignmentInput,
} from './emergencyBackupValidation'

describe('emergencyBackupValidation - validateEmergencyCrewEligibility', () => {
  it('rejects inactive staff', () => {
    const res = validateEmergencyCrewEligibility({
      role: 'crew',
      status: 'inactive',
      outlet_id: 'outlet-1',
      name: 'Budi Inaktif',
    })
    expect(res.ok).toBe(false)
    expect(res.error).toContain('non-aktif')
  })

  it('rejects multi-outlet / management roles (area_manager, spv, etc.)', () => {
    const rolesToReject = ['area_manager', 'regional_manager', 'spv', 'korlap', 'crew_backup']

    rolesToReject.forEach((role) => {
      const res = validateEmergencyCrewEligibility({
        role,
        status: 'active',
        outlet_id: 'outlet-1',
        name: `User ${role}`,
      })
      expect(res.ok).toBe(false)
      expect(res.error).toContain('hanya diperuntukkan bagi Kru Reguler')
    })
  })

  it('rejects staff with crew_backup sub_role', () => {
    const res = validateEmergencyCrewEligibility({
      role: 'crew',
      sub_role: 'crew_backup',
      status: 'active',
      outlet_id: 'outlet-1',
      name: 'Crew Backup Mobile',
    })
    expect(res.ok).toBe(false)
    expect(res.error).toContain('hanya diperuntukkan bagi Kru Reguler')
  })

  it('rejects crew without assigned home outlet', () => {
    const res = validateEmergencyCrewEligibility({
      role: 'crew',
      sub_role: 'crew_regular',
      status: 'active',
      outlet_id: null,
      name: 'Crew Tanpa Outlet',
    })
    expect(res.ok).toBe(false)
    expect(res.error).toContain('belum memiliki outlet penugasan tetap')
  })

  it('allows active regular crew with valid home outlet', () => {
    const res1 = validateEmergencyCrewEligibility({
      role: 'crew',
      sub_role: 'crew_regular',
      status: 'active',
      outlet_id: 'outlet-1',
      name: 'Siti Reguler',
    })
    expect(res1.ok).toBe(true)
    expect(res1.error).toBeUndefined()

    const res2 = validateEmergencyCrewEligibility({
      role: 'crew',
      sub_role: 'crew_trainee',
      status: 'active',
      outlet_id: 'outlet-1',
      name: 'Andi Trainee',
    })
    expect(res2.ok).toBe(true)

    const res3 = validateEmergencyCrewEligibility({
      role: 'crew',
      sub_role: null,
      status: 'active',
      outlet_id: 'outlet-2',
      name: 'Joko Crew',
    })
    expect(res3.ok).toBe(true)
  })
})

describe('emergencyBackupValidation - validateEmergencyAssignmentInput', () => {
  const defaultValid = {
    originOutletId: 'outlet-origin-id',
    targetOutletId: 'outlet-target-id',
    targetOutletActive: true,
    assignmentDate: '2026-10-12',
  }

  it('allows valid assignment input', () => {
    const res = validateEmergencyAssignmentInput(defaultValid)
    expect(res.ok).toBe(true)
  })

  it('rejects empty target outlet', () => {
    const res = validateEmergencyAssignmentInput({
      ...defaultValid,
      targetOutletId: '',
    })
    expect(res.ok).toBe(false)
    expect(res.error).toContain('Outlet tujuan wajib dipilih')
  })

  it('rejects assigning crew to their own home outlet', () => {
    const res = validateEmergencyAssignmentInput({
      ...defaultValid,
      originOutletId: 'outlet-a',
      targetOutletId: 'outlet-a',
    })
    expect(res.ok).toBe(false)
    expect(res.error).toContain('tidak boleh sama dengan Outlet asal')
  })

  it('rejects inactive target outlet', () => {
    const res = validateEmergencyAssignmentInput({
      ...defaultValid,
      targetOutletActive: false,
    })
    expect(res.ok).toBe(false)
    expect(res.error).toContain('Outlet tujuan sedang nonaktif')
  })

  it('rejects invalid assignment date format', () => {
    const res1 = validateEmergencyAssignmentInput({
      ...defaultValid,
      assignmentDate: '12-10-2026',
    })
    expect(res1.ok).toBe(false)
    expect(res1.error).toContain('Format tanggal penugasan tidak valid')

    const res2 = validateEmergencyAssignmentInput({
      ...defaultValid,
      assignmentDate: '',
    })
    expect(res2.ok).toBe(false)
  })
})
