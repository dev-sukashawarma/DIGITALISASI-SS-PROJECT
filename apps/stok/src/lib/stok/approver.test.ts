import { describe, it, expect } from 'vitest'
import { isApproverRole, canApproveOpname, canApprovePermintaan } from './approver'

describe('approver permissions', () => {
  it('identifies area_manager and regional_manager as approvers', () => {
    expect(isApproverRole('area_manager')).toBe(true)
    expect(isApproverRole('regional_manager')).toBe(true)
    expect(isApproverRole('leader')).toBe(true)
    expect(isApproverRole('spv')).toBe(true)
    expect(isApproverRole('crew')).toBe(false)
    expect(isApproverRole(null)).toBe(false)
  })

  it('allows area_manager and regional_manager to approve opname', () => {
    expect(canApproveOpname('area_manager')).toBe(true)
    expect(canApproveOpname('regional_manager')).toBe(true)
    expect(canApproveOpname('leader')).toBe(true)
    expect(canApproveOpname('spv')).toBe(true)
    expect(canApproveOpname('admin')).toBe(true)
    expect(canApproveOpname('crew')).toBe(false)
  })

  it('preserves strict permintaan pengeluaran authorization', () => {
    expect(canApprovePermintaan('kitchen')).toBe(true)
    expect(canApprovePermintaan('admin')).toBe(true)
    expect(canApprovePermintaan('area_manager')).toBe(false)
    expect(canApprovePermintaan('crew')).toBe(false)
  })
})
