import { describe, it, expect } from 'vitest'
import { calculateMutasiBadgeCounts, canUserApproveMutasi, isMutasiActionable, PendingMutasiItem } from './mutasiBadge'

describe('canUserApproveMutasi', () => {
  it('returns true only for kitchen, admin, owner, developer', () => {
    expect(canUserApproveMutasi('kitchen')).toBe(true)
    expect(canUserApproveMutasi('admin')).toBe(true)
    expect(canUserApproveMutasi('owner')).toBe(true)
    expect(canUserApproveMutasi('developer')).toBe(true)
  })

  it('returns false for regular crew, leader, spv, and others', () => {
    expect(canUserApproveMutasi('crew')).toBe(false)
    expect(canUserApproveMutasi('leader')).toBe(false)
    expect(canUserApproveMutasi('spv')).toBe(false)
    expect(canUserApproveMutasi('area_manager')).toBe(false)
    expect(canUserApproveMutasi('regional_manager')).toBe(false)
    expect(canUserApproveMutasi('staff')).toBe(false)
    expect(canUserApproveMutasi(null)).toBe(false)
    expect(canUserApproveMutasi(undefined)).toBe(false)
  })
})

describe('calculateMutasiBadgeCounts', () => {
  const sampleItems: PendingMutasiItem[] = [
    {
      id: '1',
      status: 'menunggu_persetujuan',
      outlet_asal_id: 'outlet-a',
      outlet_tujuan_id: 'outlet-b',
    },
    {
      id: '2',
      status: 'menunggu_pengiriman',
      outlet_asal_id: 'outlet-a',
      outlet_tujuan_id: 'outlet-b',
    },
    {
      id: '3',
      status: 'dikirim',
      outlet_asal_id: 'outlet-a',
      outlet_tujuan_id: 'outlet-b',
    },
    {
      id: '4',
      status: 'dikirim',
      outlet_asal_id: 'outlet-b',
      outlet_tujuan_id: 'outlet-c',
    },
  ]

  it('counts correctly for Approver with no specific outlet (HQ view)', () => {
    const counts = calculateMutasiBadgeCounts(sampleItems, 'kitchen', undefined)
    expect(counts.menungguPersetujuan).toBe(1)
    expect(counts.menungguPengiriman).toBe(1)
    expect(counts.dikirim).toBe(2)
    expect(counts.total).toBe(4)
  })

  it('counts correctly for Approver scoped to outlet-a', () => {
    const counts = calculateMutasiBadgeCounts(sampleItems, 'kitchen', 'outlet-a')
    // Approver sees 1 pending approval (item 1) + 1 shipment waiting for outlet-a (item 2)
    expect(counts.menungguPersetujuan).toBe(1)
    expect(counts.menungguPengiriman).toBe(1)
    expect(counts.dikirim).toBe(0) // outlet-a has no incoming shipments
    expect(counts.total).toBe(2)

    // SPV and Leader are NOT approvers for mutasi
    const spvCounts = calculateMutasiBadgeCounts(sampleItems, 'spv', 'outlet-a')
    expect(spvCounts.menungguPersetujuan).toBe(0)
  })

  it('counts correctly for Regular Crew at outlet-a (Sender)', () => {
    const counts = calculateMutasiBadgeCounts(sampleItems, 'crew', 'outlet-a')
    // Crew cannot approve item 1
    expect(counts.menungguPersetujuan).toBe(0)
    // Crew at outlet-a must ship item 2
    expect(counts.menungguPengiriman).toBe(1)
    // Crew at outlet-a is not recipient of item 3 or 4
    expect(counts.dikirim).toBe(0)
    expect(counts.total).toBe(1)
  })

  it('counts correctly for Regular Crew at outlet-b (Recipient of item 3, Sender of item 4)', () => {
    const counts = calculateMutasiBadgeCounts(sampleItems, 'crew', 'outlet-b')
    // Crew cannot approve item 1
    expect(counts.menungguPersetujuan).toBe(0)
    // No items waiting shipment from outlet-b (item 4 is already sent)
    expect(counts.menungguPengiriman).toBe(0)
    // Item 3 is incoming to outlet-b
    expect(counts.dikirim).toBe(1)
    expect(counts.total).toBe(1)
  })

  it('returns zero for empty list', () => {
    const counts = calculateMutasiBadgeCounts([], 'admin', 'outlet-a')
    expect(counts.total).toBe(0)
    expect(counts.menungguPersetujuan).toBe(0)
    expect(counts.menungguPengiriman).toBe(0)
    expect(counts.dikirim).toBe(0)
  })
})

describe('isMutasiActionable', () => {
  it('identifies actionable items per role and outlet', () => {
    const itemApprove = { status: 'menunggu_persetujuan', outlet_asal_id: 'a', outlet_tujuan_id: 'b' }
    const itemKirim = { status: 'menunggu_pengiriman', outlet_asal_id: 'a', outlet_tujuan_id: 'b' }
    const itemTerima = { status: 'dikirim', outlet_asal_id: 'a', outlet_tujuan_id: 'b' }
    const itemDone = { status: 'selesai', outlet_asal_id: 'a', outlet_tujuan_id: 'b' }

    // Approver
    expect(isMutasiActionable(itemApprove, 'kitchen', 'a')).toBe(true)
    expect(isMutasiActionable(itemApprove, 'admin', 'a')).toBe(true)
    expect(isMutasiActionable(itemApprove, 'spv', 'a')).toBe(false)
    expect(isMutasiActionable(itemApprove, 'leader', 'a')).toBe(false)
    expect(isMutasiActionable(itemApprove, 'crew', 'a')).toBe(false)

    // Sender outlet 'a'
    expect(isMutasiActionable(itemKirim, 'crew', 'a')).toBe(true)
    expect(isMutasiActionable(itemKirim, 'crew', 'b')).toBe(false)

    // Receiver outlet 'b'
    expect(isMutasiActionable(itemTerima, 'crew', 'b')).toBe(true)
    expect(isMutasiActionable(itemTerima, 'crew', 'a')).toBe(false)

    // Completed
    expect(isMutasiActionable(itemDone, 'admin', 'a')).toBe(false)
  })
})
