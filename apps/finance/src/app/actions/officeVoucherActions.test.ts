import { describe, expect, it, vi, beforeEach } from 'vitest'
import type { OfficeVoucher } from '@/lib/officeVoucher'

vi.mock('@/lib/authz', () => ({ requireRole: vi.fn(async () => undefined), PERAN_KEUANGAN: [] }))

// Tiru tabel expenses: baris hanya ter-update bila semua filter .eq cocok.
const db: { row: Record<string, unknown> } = { row: {} }
const filterTerakhir: Record<string, unknown>[] = []
vi.mock('@/lib/supabase-service', () => ({
  getServiceSupabase: () => ({
    from: () => ({
      update: (nilai: Record<string, unknown>) => {
        const filter: Record<string, unknown> = {}
        const rantai = {
          eq(kolom: string, v: unknown) {
            filter[kolom] = v
            return rantai
          },
          async select() {
            filterTerakhir.push(filter)
            const cocok = Object.entries(filter).every(([k, v]) => db.row[k] === v)
            if (!cocok) return { data: [], error: null }
            Object.assign(db.row, nilai)
            return { data: [{ id: db.row.id }], error: null }
          },
          then(selesai: (r: { error: null }) => void) {
            // Jalur lama tanpa .select(): update tanpa memeriksa apa pun.
            filterTerakhir.push(filter)
            Object.assign(db.row, nilai)
            selesai({ error: null })
          },
        }
        return rantai
      },
    }),
  }),
}))

import { rejectOfficeVoucherAction, verifyOfficeVoucherAction } from './officeVoucherActions'

const voucher: OfficeVoucher = {
  id: 'v1',
  voucherNumber: 'VCR-001',
  date: '2026-11-05',
  division: 'Marketing & Growth',
  recipientName: 'Andi',
  category: 'lainnya' as OfficeVoucher['category'],
  categoryLabel: 'Lainnya',
  advanceAmount: 1000000,
  realizedAmount: 750000,
  reason: 'cetak banner',
  status: 'waiting_verification',
  createdAt: '2026-11-05T09:00:00Z',
  paymentSource: 'transfer_pusat',
}

describe('voucher dana kantor yang sudah diputuskan', () => {
  beforeEach(() => {
    filterTerakhir.length = 0
  })

  it('menolak voucher yang sudah diverifikasi ditolak, tidak menimpa status', async () => {
    db.row = { id: 'v1', type: 'office_settled' }
    await expect(rejectOfficeVoucherAction({ voucher, reason: 'salah' })).rejects.toThrow('Voucher sudah diproses')
    expect(db.row.type).toBe('office_settled')
  })

  it('verifikasi ulang voucher yang sudah ditolak ditolak', async () => {
    db.row = { id: 'v1', type: 'office_rejected' }
    await expect(verifyOfficeVoucherAction({ voucher })).rejects.toThrow('Voucher sudah diproses')
    expect(db.row.type).toBe('office_rejected')
  })

  it('voucher yang menunggu verifikasi tetap bisa diverifikasi', async () => {
    db.row = { id: 'v1', type: 'office_waiting_verification' }
    await expect(verifyOfficeVoucherAction({ voucher })).resolves.toEqual({ success: true })
    expect(db.row.type).toBe('office_settled')
  })
})
