import { susunMutasi, keteranganTransaksi, batasRentangWib, type TxMutasi } from './mutasiRekening'

const tx = (p: Partial<TxMutasi>): TxMutasi => ({
  id: p.id ?? 'x',
  occurred_at: p.occurred_at ?? '2026-11-02T03:00:00Z',
  direction: p.direction ?? 'in',
  amount: p.amount ?? 0,
  status: p.status ?? 'paid',
  source_type: p.source_type ?? 'manual',
  category: p.category ?? null,
  note: p.note ?? null,
  outlet_name: p.outlet_name ?? null,
})

describe('susunMutasi', () => {
  it('menghitung saldo berjalan menaik dan mengabaikan void', () => {
    const { baris, ringkasan } = susunMutasi(1000, [
      tx({ id: 'c', occurred_at: '2026-11-03T00:00:00Z', direction: 'out', amount: 300 }),
      tx({ id: 'a', occurred_at: '2026-11-01T00:00:00Z', direction: 'in', amount: 500, status: 'reconciled' }),
      tx({ id: 'b', occurred_at: '2026-11-02T00:00:00Z', direction: 'out', amount: 999, status: 'void' }),
    ])
    expect(baris.map(b => b.id)).toEqual(['a', 'b', 'c'])
    expect(baris.map(b => b.saldo)).toEqual([1500, 1500, 1200])
    expect(baris[1].dihitung).toBe(false)
    expect(ringkasan).toEqual({ saldoAwal: 1000, totalMasuk: 500, totalKeluar: 300, saldoAkhir: 1200, jumlahTransaksi: 2 })
  })

  it('tanpa transaksi saldo akhir = saldo awal', () => {
    expect(susunMutasi(717551.98, []).ringkasan.saldoAkhir).toBe(717551.98)
  })
})

describe('keteranganTransaksi', () => {
  it('setoran outlet membedakan transfer dan tunai', () => {
    expect(keteranganTransaksi(tx({ source_type: 'cash_deposit', category: 'Setoran Bank', outlet_name: 'BEJI' }))).toBe('Setoran transfer · BEJI')
    expect(keteranganTransaksi(tx({ source_type: 'cash_deposit', category: 'Setoran Tunai', outlet_name: 'BEJI' }))).toBe('Setoran tunai · BEJI')
  })
  it('belanja pusat membuang awalan [Kategori: ...]', () => {
    expect(keteranganTransaksi(tx({ source_type: 'expense_pusat', category: 'Belanja pusat', note: '[Kategori: transport] Bensin' }))).toBe('Belanja pusat · Bensin')
  })
  it('manual memakai kategori lalu catatan', () => {
    expect(keteranganTransaksi(tx({ source_type: 'manual', category: 'Koreksi Saldo', note: 'Kalisari' }))).toBe('Koreksi Saldo · Kalisari')
  })
  it('pencairan petty cash menyebut outlet', () => {
    expect(keteranganTransaksi(tx({ source_type: 'petty_cash_topup', note: 'Pencairan Petty Cash Outlet (transfer)', outlet_name: 'MITRA KALISARI' }))).toBe('Pencairan petty cash · MITRA KALISARI')
  })
})

describe('batasRentangWib', () => {
  it('mengubah tanggal WIB ke rentang UTC setengah terbuka', () => {
    expect(batasRentangWib('2026-11-01', '2026-11-05')).toEqual({
      mulai: '2026-10-31T17:00:00.000Z',
      akhirEksklusif: '2026-11-05T17:00:00.000Z',
    })
  })
})
