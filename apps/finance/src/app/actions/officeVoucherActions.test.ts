import { describe, expect, it, vi, beforeEach } from 'vitest'
import type { OfficeVoucher } from '@/lib/officeVoucher'

vi.mock('@/lib/authz', () => ({ requireRole: vi.fn(async () => ({ userId: 'u1', role: 'admin_finance' })), PERAN_KEUANGAN: [] }))

// Tiru tabel expenses: baris hanya ter-update bila semua filter .eq cocok.
const db: { row: Record<string, unknown> } = { row: {} }
const filterTerakhir: Record<string, unknown>[] = []
const logDitulis: Record<string, unknown>[] = []
vi.mock('@/lib/supabase-service', () => ({
  getServiceSupabase: () => ({
    from: (tabel: string) => ({
      insert: async (baris: Record<string, unknown>) => {
        if (tabel === 'approval_log') logDitulis.push(baris)
        return { error: null }
      },
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

const REK = 'rek-petty-bank'

describe('voucher dana kantor yang sudah diputuskan', () => {
  beforeEach(() => {
    filterTerakhir.length = 0
    logDitulis.length = 0
  })

  it('menolak voucher yang sudah diverifikasi ditolak, tidak menimpa status', async () => {
    db.row = { id: 'v1', type: 'office_settled' }
    await expect(rejectOfficeVoucherAction({ voucher, reason: 'salah' })).rejects.toThrow('Voucher sudah diproses')
    expect(db.row.type).toBe('office_settled')
  })

  it('verifikasi ulang voucher yang sudah ditolak ditolak', async () => {
    db.row = { id: 'v1', type: 'office_rejected' }
    await expect(verifyOfficeVoucherAction({ voucher, cashLocationId: REK })).rejects.toThrow('Voucher sudah diproses')
    expect(db.row.type).toBe('office_rejected')
  })

  it('voucher yang menunggu verifikasi tetap bisa diverifikasi', async () => {
    db.row = { id: 'v1', type: 'office_waiting_verification' }
    await expect(verifyOfficeVoucherAction({ voucher, cashLocationId: REK })).resolves.toEqual({ success: true })
    expect(db.row.type).toBe('office_settled')
  })
})

describe('riwayat keputusan dana kantor', () => {
  beforeEach(() => {
    logDitulis.length = 0
  })

  it('verifikasi mencatat riwayat setuju dengan pelaku dari sesi', async () => {
    db.row = { id: 'v1', type: 'office_waiting_verification' }
    await verifyOfficeVoucherAction({ voucher, cashLocationId: REK })
    expect(logDitulis).toHaveLength(1)
    expect(logDitulis[0]).toMatchObject({ jenis: 'dana_kantor', keputusan: 'setuju', sumber_id: 'v1', nominal: 750000, pelaku: 'u1' })
  })

  it('tolak mencatat riwayat beserta alasannya', async () => {
    db.row = { id: 'v1', type: 'office_waiting_verification' }
    await rejectOfficeVoucherAction({ voucher, reason: 'nota buram' })
    expect(logDitulis[0]).toMatchObject({ jenis: 'dana_kantor', keputusan: 'tolak', alasan: 'nota buram', pelaku: 'u1' })
  })

  it('aksi dari tab basi tidak mencatat riwayat', async () => {
    db.row = { id: 'v1', type: 'office_settled' }
    await expect(rejectOfficeVoucherAction({ voucher, reason: 'x' })).rejects.toThrow()
    expect(logDitulis).toHaveLength(0)
  })
})

describe('rekening pembayar voucher dana kantor', () => {
  it('verifikasi menyimpan rekening pembayar agar saldo terpotong', async () => {
    db.row = { id: 'v1', type: 'office_waiting_verification' }
    await verifyOfficeVoucherAction({ voucher, cashLocationId: REK })
    expect(db.row).toMatchObject({ type: 'office_settled', cash_location_id: REK, amount: 750000 })
  })

  it('verifikasi tanpa rekening ditolak dan voucher tidak berubah', async () => {
    db.row = { id: 'v1', type: 'office_waiting_verification' }
    await expect(verifyOfficeVoucherAction({ voucher, cashLocationId: '' })).rejects.toThrow('Pilih rekening')
    expect(db.row.type).toBe('office_waiting_verification')
    expect(db.row.cash_location_id).toBeUndefined()
  })
})
