import { describe, it, expect } from 'vitest'
import type { PettyCashTopup } from '@/lib/types'
import type { PendingPettyCashExpense } from '@/hooks/usePettyCashExpenseApproval'
import type { PendingPo } from '@/hooks/usePoApproval'
import type { PayablePo, TxBayarPo } from '@/hooks/useSupplierSettlement'
import type { OfficeVoucher } from '@/lib/officeVoucher'
import {
  itemDariPettyCash,
  itemDariPengeluaranPettyCash,
  itemDariPo,
  itemDariBayarVendor,
  itemDariVoucher,
  urutkanHub,
  hitungPerJenis,
  isLama,
  gabungSumber,
  teksBadgeHub,
  pisahMenurutUmur,
  totalPerJenis,
  type HubItem,
} from './hub'

function topup(status: string, over: Partial<PettyCashTopup> = {}): PettyCashTopup {
  return {
    id: `t-${status}`,
    outlet_id: 'o1',
    amount: 500000,
    reason: 'beli gas',
    status: status as PettyCashTopup['status'],
    disbursement_method: null,
    disbursed_from_cash_location_id: null,
    created_at: '2026-11-05T08:00:00Z',
    approved_by: null,
    finance_approved_by: null,
    approved_at: null,
    outlet: { id: 'o1', name: 'Mitra Cibinong' },
    ...over,
  } as PettyCashTopup
}

function payable(payment_status: PayablePo['payment_status']): PayablePo {
  return {
    id: 'po1',
    nomor_po: 'SPB/PO/XI/2026/004',
    supplier_id: 's1',
    supplier_nama: 'Lettuce (Pak Aziz) - Tempo 15',
    tanggal_po: '2026-11-01',
    status: 'diterima_lengkap',
    payment_status,
    paid_at: null,
    cash_transaction_id: null,
    total: 4250000,
  }
}

function voucher(status: OfficeVoucher['status'], over: Partial<OfficeVoucher> = {}): OfficeVoucher {
  return {
    id: `v-${status}`,
    voucherNumber: 'VCR-001',
    date: '2026-11-05',
    division: 'Marketing & Growth',
    recipientName: 'Andi',
    category: 'lainnya' as OfficeVoucher['category'],
    categoryLabel: 'Lainnya',
    advanceAmount: 1000000,
    reason: 'cetak banner',
    status,
    createdAt: '2026-11-05T09:00:00Z',
    paymentSource: 'transfer_pusat',
    ...over,
  }
}

const po: PendingPo = {
  id: 'po2',
  nomor_po: 'SPB/PO/XI/2026/010',
  supplier_nama: 'PT Agro Boga Utama',
  tanggal_po: '2026-11-04',
  total: 5000000,
  updated_at: '2026-11-06T06:00:00Z',
}

describe('itemDariPettyCash', () => {
  it('forwarded_to_finance jadi petty_cash', () => {
    expect(itemDariPettyCash(topup('forwarded_to_finance'))?.jenis).toBe('petty_cash')
  })
  it('approved_by_finance jadi serah_am', () => {
    expect(itemDariPettyCash(topup('approved_by_finance'))?.jenis).toBe('serah_am')
  })
  it('status lain tidak masuk hub', () => {
    for (const s of ['rejected', 'forwarded_by_finance', 'completed']) {
      expect(itemDariPettyCash(topup(s))).toBeNull()
    }
  })
  it('judul nama outlet, nominal amount, key berjenis', () => {
    const i = itemDariPettyCash(topup('forwarded_to_finance'))!
    expect(i.judul).toBe('Mitra Cibinong')
    expect(i.nominal).toBe(500000)
    expect(i.key).toBe('petty_cash:t-forwarded_to_finance')
    expect(i.detailHref).toBeNull()
  })
})

describe('itemDariPengeluaranPettyCash', () => {
  const expBase: PendingPettyCashExpense = {
    id: 'exp-1',
    outlet_id: 'o1',
    category: 'gas',
    amount: 45000,
    description: 'Isi ulang gas elpiji 3kg',
    expense_date: '2026-11-11',
    receipt_url: 'https://example.com/struk.jpg',
    created_at: '2026-11-11T04:00:00Z',
    created_by: 'st1',
    status: 'pending',
    outlet_nama: 'Mitra Cibinong',
    pengaju_nama: 'Budi',
  }

  it('pending masuk ke pengeluaran_petty_cash lengkap dengan kategori & pengaju', () => {
    const i = itemDariPengeluaranPettyCash(expBase)!
    expect(i.jenis).toBe('pengeluaran_petty_cash')
    expect(i.judul).toBe('Mitra Cibinong')
    expect(i.keterangan).toContain('Budi')
    expect(i.keterangan).toContain('Gas')
    expect(i.keterangan).toContain('Isi ulang gas elpiji 3kg')
    expect(i.nominal).toBe(45000)
    expect(i.key).toBe('pengeluaran_petty_cash:exp-1')
  })

  it('status selain pending tidak masuk hub', () => {
    expect(itemDariPengeluaranPettyCash({ ...expBase, status: 'approved' })).toBeNull()
    expect(itemDariPengeluaranPettyCash({ ...expBase, status: 'rejected' })).toBeNull()
  })
})

describe('itemDariPo', () => {
  it('memakai updated_at sebagai menungguSejak dan tautan detail PO', () => {
    const i = itemDariPo(po)
    expect(i.jenis).toBe('po')
    expect(i.menungguSejak).toBe('2026-11-06T06:00:00Z')
    expect(i.detailHref).toBe('/pembelian/po2')
  })
  it('tanpa updated_at jatuh ke tanggal_po', () => {
    expect(itemDariPo({ ...po, updated_at: undefined }).menungguSejak).toBe('2026-11-04')
  })
})

describe('itemDariBayarVendor', () => {
  it('unpaid dan paid tidak masuk hub', () => {
    expect(itemDariBayarVendor(payable('unpaid'))).toBeNull()
    expect(itemDariBayarVendor(payable('paid'))).toBeNull()
  })
  it('pending memakai waktu pengajuan dari transaksi', () => {
    const tx = { created_at: '2026-11-05T10:00:00Z', pengaju: 'Rina' } as TxBayarPo
    const i = itemDariBayarVendor(payable('pending'), tx)!
    expect(i.jenis).toBe('bayar_vendor')
    expect(i.menungguSejak).toBe('2026-11-05T10:00:00Z')
    expect(i.keterangan).toContain('Rina')
  })
  it('pending tanpa transaksi jatuh ke tanggal_po', () => {
    expect(itemDariBayarVendor(payable('pending'))!.menungguSejak).toBe('2026-11-01')
  })
})

describe('itemDariVoucher', () => {
  it('hanya waiting_verification', () => {
    expect(itemDariVoucher(voucher('draft_advance'))).toBeNull()
    expect(itemDariVoucher(voucher('verified'))).toBeNull()
    expect(itemDariVoucher(voucher('waiting_verification'))?.jenis).toBe('dana_kantor')
  })
  it('nominal memakai realizedAmount bila ada', () => {
    expect(itemDariVoucher(voucher('waiting_verification', { realizedAmount: 750000 }))!.nominal).toBe(750000)
    expect(itemDariVoucher(voucher('waiting_verification'))!.nominal).toBe(1000000)
  })
})

function item(jenis: HubItem['jenis'], id: string, menungguSejak: string): HubItem {
  return { key: `${jenis}:${id}`, id, jenis, judul: id, keterangan: '', nominal: 1, menungguSejak, detailHref: null, data: {} } as HubItem
}

describe('urutkanHub', () => {
  it('paling lama menunggu di atas lintas jenis', () => {
    const hasil = urutkanHub([
      item('po', 'baru', '2026-11-06T08:00:00Z'),
      item('petty_cash', 'lama', '2026-11-03T08:00:00Z'),
    ])
    expect(hasil.map((i) => i.id)).toEqual(['lama', 'baru'])
  })
  it('seri diurutkan menurut key', () => {
    const t = '2026-11-05T08:00:00Z'
    expect(urutkanHub([item('po', 'b', t), item('po', 'a', t)]).map((i) => i.id)).toEqual(['a', 'b'])
  })
})

describe('hitungPerJenis', () => {
  it('semua kunci selalu ada', () => {
    const t = '2026-11-05T08:00:00Z'
    expect(
      hitungPerJenis([
        item('petty_cash', '1', t),
        item('petty_cash', '2', t),
        item('pengeluaran_petty_cash', '5', t),
        item('serah_am', '3', t),
        item('bayar_vendor', '4', t),
      ]),
    ).toEqual({
      petty_cash: 2,
      pengeluaran_petty_cash: 1,
      serah_am: 1,
      po: 0,
      bayar_vendor: 1,
      dana_kantor: 0,
    })
  })
})

describe('isLama', () => {
  const now = new Date('2026-11-06T10:00:00Z')
  it('lebih dari 24 jam = lama', () => {
    expect(isLama('2026-11-05T09:00:00Z', now)).toBe(true)
  })
  it('23 jam belum lama', () => {
    expect(isLama('2026-11-05T11:00:00Z', now)).toBe(false)
  })
})

describe('gabungSumber', () => {
  it('sumber galat masuk daftar galat, sumber lain tetap tampil terurut', () => {
    const hasil = gabungSumber([
      { jenis: ['po'], items: [item('po', 'x', '2026-11-06T08:00:00Z')], isLoading: false, error: null },
      { jenis: ['petty_cash', 'serah_am'], items: [item('petty_cash', 'y', '2026-11-04T08:00:00Z')], isLoading: false, error: null },
      { jenis: ['dana_kantor'], items: [item('dana_kantor', 'z', '2026-11-01T08:00:00Z')], isLoading: false, error: new Error('Forbidden') },
    ])
    expect(hasil.galat).toEqual(['dana_kantor'])
    expect(hasil.items.map((i) => i.id)).toEqual(['y', 'x'])
    expect(hasil.isLoading).toBe(false)
  })
  it('isLoading bila salah satu sumber loading', () => {
    expect(gabungSumber([{ jenis: ['po'], items: [], isLoading: true, error: null }]).isLoading).toBe(true)
  })
})

describe('teksBadgeHub', () => {
  it('angka biasa bila semua sumber terbaca', () => {
    expect(teksBadgeHub(3, false)).toBe('3')
  })
  it('nol tanpa galat tidak menampilkan badge', () => {
    expect(teksBadgeHub(0, false)).toBeNull()
  })
  it('sumber galat ditandai, tidak diam-diam dihitung nol', () => {
    expect(teksBadgeHub(3, true)).toBe('3!')
    expect(teksBadgeHub(0, true)).toBe('!')
  })
})

describe('pisahMenurutUmur', () => {
  it('memisahkan yang lewat 24 jam dari yang baru masuk, urutan tetap', () => {
    const now = new Date('2026-11-06T12:00:00Z')
    const { lama, baru } = pisahMenurutUmur(
      [item('po', 'a', '2026-11-04T08:00:00Z'), item('petty_cash', 'b', '2026-11-05T10:00:00Z'), item('po', 'c', '2026-11-06T08:00:00Z')],
      now,
    )
    expect(lama.map((i) => i.id)).toEqual(['a', 'b'])
    expect(baru.map((i) => i.id)).toEqual(['c'])
  })
})

describe('totalPerJenis', () => {
  it('menjumlah nominal per jenis, semua kunci ada', () => {
    const t = '2026-11-05T08:00:00Z'
    const a = { ...item('po', 'a', t), nominal: 1000 } as HubItem
    const b = { ...item('po', 'b', t), nominal: 500 } as HubItem
    expect(totalPerJenis([a, b])).toEqual({
      petty_cash: 0,
      pengeluaran_petty_cash: 0,
      serah_am: 0,
      po: 1500,
      bayar_vendor: 0,
      dana_kantor: 0,
    })
  })
})
