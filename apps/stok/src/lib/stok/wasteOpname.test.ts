import { describe, it, expect } from 'vitest'
import { ringkasWasteOpname } from './wasteOpname'

const START = '2026-09-20T15:00:00Z'
const CUTOFF = '2026-09-21T15:00:00Z'
const FAKTOR = { sayur: 1000, kulit: 20 }

describe('ringkasWasteOpname', () => {
  it('waste disetujui dalam periode -> sudah masuk Sistem (satuan kecil)', () => {
    const r = ringkasWasteOpname({
      reports: [{ id: 'w1', bahan_baku_id: 'sayur', qty: 1.2, status: 'APPROVED', created_at: '2026-09-21T02:00:00Z' }],
      approvedAt: { w1: '2026-09-21T05:00:00Z' },
      start: START, cutoff: CUTOFF, faktor: FAKTOR,
    })
    expect(r.sayur).toEqual({ masuk: 1200, belum: 0, jmlBelum: 0 })
  })

  it('dilaporkan dalam periode tapi disetujui setelah opname -> belum masuk Sistem', () => {
    const r = ringkasWasteOpname({
      reports: [{ id: 'w1', bahan_baku_id: 'kulit', qty: 0.1, status: 'APPROVED', created_at: '2026-09-21T02:00:00Z' }],
      approvedAt: { w1: '2026-09-21T16:00:00Z' },
      start: START, cutoff: CUTOFF, faktor: FAKTOR,
    })
    expect(r.kulit).toEqual({ masuk: 0, belum: 2, jmlBelum: 1 })
  })

  it('masih PENDING -> belum masuk Sistem', () => {
    const r = ringkasWasteOpname({
      reports: [{ id: 'w1', bahan_baku_id: 'kulit', qty: 0.05, status: 'PENDING', created_at: '2026-09-21T02:00:00Z' }],
      approvedAt: {},
      start: START, cutoff: CUTOFF, faktor: FAKTOR,
    })
    expect(r.kulit).toEqual({ masuk: 0, belum: 1, jmlBelum: 1 })
  })

  it('REJECTED diabaikan', () => {
    const r = ringkasWasteOpname({
      reports: [{ id: 'w1', bahan_baku_id: 'kulit', qty: 1, status: 'rejected', created_at: '2026-09-21T02:00:00Z' }],
      approvedAt: {},
      start: START, cutoff: CUTOFF, faktor: FAKTOR,
    })
    expect(r.kulit).toBeUndefined()
  })

  it('dilaporkan sebelum opname lalu, disetujui dalam periode -> masuk; laporan pending lama diabaikan', () => {
    const r = ringkasWasteOpname({
      reports: [
        { id: 'lama-ok', bahan_baku_id: 'sayur', qty: 0.5, status: 'APPROVED', created_at: '2026-09-19T02:00:00Z' },
        { id: 'lama-pending', bahan_baku_id: 'sayur', qty: 9, status: 'PENDING', created_at: '2026-09-19T02:00:00Z' },
      ],
      approvedAt: { 'lama-ok': '2026-09-21T01:00:00Z' },
      start: START, cutoff: CUTOFF, faktor: FAKTOR,
    })
    expect(r.sayur).toEqual({ masuk: 500, belum: 0, jmlBelum: 0 })
  })

  it('disetujui sebelum periode tidak dihitung ulang', () => {
    const r = ringkasWasteOpname({
      reports: [{ id: 'w1', bahan_baku_id: 'sayur', qty: 1, status: 'APPROVED', created_at: '2026-09-19T02:00:00Z' }],
      approvedAt: { w1: '2026-09-19T05:00:00Z' },
      start: START, cutoff: CUTOFF, faktor: FAKTOR,
    })
    expect(r.sayur).toBeUndefined()
  })

  it('faktor tak diketahui -> pakai 1 (tidak menebak skala)', () => {
    const r = ringkasWasteOpname({
      reports: [{ id: 'w1', bahan_baku_id: 'x', qty: 3, status: 'PENDING', created_at: '2026-09-21T02:00:00Z' }],
      approvedAt: {},
      start: START, cutoff: CUTOFF, faktor: {},
    })
    expect(r.x).toEqual({ masuk: 0, belum: 3, jmlBelum: 1 })
  })
})
