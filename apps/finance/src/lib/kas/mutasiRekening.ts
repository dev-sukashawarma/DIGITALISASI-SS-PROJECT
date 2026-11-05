/**
 * Mutasi satu rekening pusat (mirip rekening koran): baris berurutan waktu
 * dengan saldo berjalan. Hanya status paid/reconciled yang menggerakkan saldo
 * (aturan trigger cash_apply_balance); baris void tetap ditampilkan bertanda.
 */

export interface TxMutasi {
  id: string
  occurred_at: string
  direction: 'in' | 'out'
  amount: number
  status: string
  source_type: string
  category: string | null
  note: string | null
  sales_date?: string | null
  outlet_name?: string | null
  proof_url?: string | null
}

export interface BarisMutasi extends TxMutasi {
  keterangan: string
  masuk: number
  keluar: number
  /** Saldo setelah baris ini; untuk baris yang tak menggerakkan saldo = saldo sebelumnya. */
  saldo: number
  dihitung: boolean
}

export interface RingkasanMutasi {
  saldoAwal: number
  totalMasuk: number
  totalKeluar: number
  saldoAkhir: number
  jumlahTransaksi: number
}

export const STATUS_DIHITUNG = ['paid', 'reconciled'] as const

export function dihitung(status: string): boolean {
  return (STATUS_DIHITUNG as readonly string[]).includes(status)
}

export function nilaiBertanda(tx: Pick<TxMutasi, 'direction' | 'amount'>): number {
  const n = Number(tx.amount) || 0
  return tx.direction === 'in' ? n : -n
}

const LABEL_SUMBER: Record<string, string> = {
  cash_deposit: 'Setoran outlet',
  petty_cash_topup: 'Pencairan petty cash',
  setor_bank: 'Setor ke bank',
  income_lain: 'Income lainnya',
  expense_pusat: 'Belanja pusat',
  transfer: 'Transfer',
  payroll: 'Payroll',
  supplier_po: 'Pembayaran PO',
  kasbon: 'Kasbon',
  manual: 'Manual',
}

/** Keterangan singkat satu transaksi, seperti baris rekening koran. */
export function keteranganTransaksi(tx: TxMutasi): string {
  const sumber = LABEL_SUMBER[tx.source_type] ?? tx.source_type
  const outlet = tx.outlet_name?.trim()
  const note = (tx.note ?? '').replace(/^\[Kategori:[^\]]*\]\s*/, '').trim()
  switch (tx.source_type) {
    case 'cash_deposit': {
      const jenis = /bank|transfer/i.test(tx.category ?? '') ? 'transfer' : 'tunai'
      return [`Setoran ${jenis}`, outlet].filter(Boolean).join(' · ')
    }
    case 'petty_cash_topup':
      return [sumber, outlet].filter(Boolean).join(' · ')
    case 'manual':
      return [tx.category?.trim() || 'Transaksi manual', note].filter(Boolean).join(' · ')
    default:
      return [sumber, note || tx.category?.trim(), outlet].filter(Boolean).join(' · ')
  }
}

/** Urutkan menaik lalu hitung saldo berjalan mulai dari saldoAwal. */
export function susunMutasi(saldoAwal: number, txs: TxMutasi[]): { baris: BarisMutasi[]; ringkasan: RingkasanMutasi } {
  const urut = [...txs].sort((a, b) =>
    a.occurred_at === b.occurred_at ? a.id.localeCompare(b.id) : a.occurred_at < b.occurred_at ? -1 : 1,
  )
  let saldo = saldoAwal
  let totalMasuk = 0
  let totalKeluar = 0
  let jumlah = 0
  const baris = urut.map((tx): BarisMutasi => {
    const ok = dihitung(tx.status)
    const n = Number(tx.amount) || 0
    const masuk = tx.direction === 'in' ? n : 0
    const keluar = tx.direction === 'out' ? n : 0
    if (ok) {
      saldo += masuk - keluar
      totalMasuk += masuk
      totalKeluar += keluar
      jumlah += 1
    }
    return { ...tx, keterangan: keteranganTransaksi(tx), masuk, keluar, saldo, dihitung: ok }
  })
  return {
    baris,
    ringkasan: { saldoAwal, totalMasuk, totalKeluar, saldoAkhir: saldo, jumlahTransaksi: jumlah },
  }
}

/** Batas rentang tanggal WIB (inklusif) → ISO untuk filter occurred_at. */
export function batasRentangWib(dari: string, sampai: string): { mulai: string; akhirEksklusif: string } {
  const mulai = new Date(`${dari}T00:00:00+07:00`)
  const akhir = new Date(`${sampai}T00:00:00+07:00`)
  akhir.setUTCDate(akhir.getUTCDate() + 1)
  return { mulai: mulai.toISOString(), akhirEksklusif: akhir.toISOString() }
}
