import {
  susunMutasi, keteranganTransaksi, catatanTambahan, jenisTransaksi, totalBaris, namaPencatat, batasRentangWib,
  type TxMutasi,
} from './mutasiRekening'

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
  sales_date: p.sales_date ?? null,
  alasan: p.alasan ?? null,
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

  it('mengisi jenis dan pihak', () => {
    const { baris } = susunMutasi(0, [tx({ source_type: 'petty_cash_topup', outlet_name: 'BEJI', direction: 'out', amount: 1 })])
    expect(baris[0].jenis).toBe('pencairan_pc')
    expect(baris[0].pihak).toBe('BEJI')
    expect(susunMutasi(0, [tx({})]).baris[0].pihak).toBe('-')
  })
})

describe('totalBaris', () => {
  it('menjumlah hanya baris yang dihitung', () => {
    const { baris } = susunMutasi(0, [
      tx({ id: 'a', direction: 'in', amount: 100 }),
      tx({ id: 'b', direction: 'out', amount: 40 }),
      tx({ id: 'c', direction: 'out', amount: 999, status: 'void' }),
    ])
    expect(totalBaris(baris)).toEqual({ masuk: 100, keluar: 40 })
  })
})

describe('keterangan', () => {
  it('setoran: transfer/tunai + tanggal penjualan', () => {
    expect(keteranganTransaksi(tx({ source_type: 'cash_deposit', category: 'Setoran Bank' }))).toBe('Transfer')
    expect(keteranganTransaksi(tx({ source_type: 'cash_deposit', category: 'Setoran Tunai', sales_date: '2026-11-03' }))).toBe('Tunai · penjualan 2026-11-03')
  })
  it('pencairan petty cash: metode + alasan pengajuan', () => {
    expect(keteranganTransaksi(tx({ source_type: 'petty_cash_topup', note: 'Pencairan Petty Cash Outlet (transfer)', alasan: 'beli gas' }))).toBe('Transfer · beli gas')
    expect(keteranganTransaksi(tx({ source_type: 'petty_cash_topup', note: 'Pencairan Petty Cash Outlet (tunai)' }))).toBe('Tunai')
  })
  it('belanja pusat membuang awalan [Kategori: ...]', () => {
    expect(keteranganTransaksi(tx({ source_type: 'expense_pusat', category: 'Belanja pusat', note: '[Kategori: transport] Bensin' }))).toBe('Bensin')
  })
  it('manual: kategori, catatan panjang terpisah', () => {
    const t = tx({ source_type: 'manual', category: 'Koreksi Saldo', note: 'Kalisari 500rb' })
    expect(keteranganTransaksi(t)).toBe('Koreksi Saldo')
    expect(catatanTambahan(t)).toBe('Kalisari 500rb')
    expect(jenisTransaksi(t)).toBe('penyesuaian')
  })
})

describe('namaPencatat', () => {
  it('Superadmin 2 ditampilkan sebagai Hesti Qodriani, uji coba developer sebagai Developer', () => {
    expect(namaPencatat('Superadmin 2')).toBe('Hesti Qodriani')
    expect(namaPencatat('Superadmin 2', 'ce72337b-d880-4f09-b247-d8c0fc0f760b')).toBe('Developer')
    expect(namaPencatat(' Putri ')).toBe('Putri')
    expect(namaPencatat(null)).toBeNull()
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
