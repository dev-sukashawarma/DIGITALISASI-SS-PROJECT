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
  /** Nama akun yang mencatat. */
  dicatat_oleh?: string | null
  /** Alasan pengajuan (pencairan petty cash). */
  alasan?: string | null
}

export type JenisMutasi =
  | 'setoran'
  | 'pencairan_pc'
  | 'belanja_pusat'
  | 'setor_bank'
  | 'income_lain'
  | 'penyesuaian'
  | 'transfer'
  | 'lainnya'

export const JENIS_LABEL: Record<JenisMutasi, string> = {
  setoran: 'Setoran',
  pencairan_pc: 'Pencairan PC',
  belanja_pusat: 'Belanja pusat',
  setor_bank: 'Setor bank',
  income_lain: 'Income lainnya',
  penyesuaian: 'Penyesuaian',
  transfer: 'Transfer',
  lainnya: 'Lainnya',
}

export interface BarisMutasi extends TxMutasi {
  jenis: JenisMutasi
  keterangan: string
  pihak: string
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

export function jenisTransaksi(tx: Pick<TxMutasi, 'source_type'>): JenisMutasi {
  switch (tx.source_type) {
    case 'cash_deposit': return 'setoran'
    case 'petty_cash_topup': return 'pencairan_pc'
    case 'expense_pusat': return 'belanja_pusat'
    case 'setor_bank': return 'setor_bank'
    case 'income_lain': return 'income_lain'
    case 'manual': return 'penyesuaian'
    case 'transfer': return 'transfer'
    default: return 'lainnya'
  }
}

function bersih(s: string | null | undefined): string {
  return (s ?? '').replace(/^\[Kategori:[^\]]*\]\s*/, '').trim()
}

/** Keterangan ringkas (jenis & outlet punya kolom sendiri). */
export function keteranganTransaksi(tx: TxMutasi): string {
  switch (tx.source_type) {
    case 'cash_deposit': {
      const jenis = /bank|transfer/i.test(tx.category ?? '') ? 'Transfer' : 'Tunai'
      return tx.sales_date ? `${jenis} · penjualan ${tx.sales_date}` : jenis
    }
    case 'petty_cash_topup': {
      const metode = /tunai/i.test(tx.note ?? '') ? 'Tunai' : 'Transfer'
      const alasan = bersih(tx.alasan)
      return alasan ? `${metode} · ${alasan}` : metode
    }
    case 'manual':
      return tx.category?.trim() || bersih(tx.note) || 'Transaksi manual'
    default:
      return bersih(tx.note) || tx.category?.trim() || '-'
  }
}

/** Catatan panjang di bawah keterangan (hanya bila tidak sudah tercakup). */
export function catatanTambahan(tx: TxMutasi): string {
  if (tx.source_type !== 'manual') return ''
  const note = bersih(tx.note)
  return note && note !== tx.category?.trim() ? note : ''
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
    return {
      ...tx,
      jenis: jenisTransaksi(tx),
      keterangan: keteranganTransaksi(tx),
      pihak: tx.outlet_name?.trim() || '-',
      masuk,
      keluar,
      saldo,
      dihitung: ok,
    }
  })
  return {
    baris,
    ringkasan: { saldoAwal, totalMasuk, totalKeluar, saldoAkhir: saldo, jumlahTransaksi: jumlah },
  }
}

/** Total masuk/keluar baris yang dihitung (dipakai saat tabel disaring per jenis). */
export function totalBaris(baris: BarisMutasi[]): { masuk: number; keluar: number } {
  return baris.reduce(
    (t, b) => (b.dihitung ? { masuk: t.masuk + b.masuk, keluar: t.keluar + b.keluar } : t),
    { masuk: 0, keluar: 0 },
  )
}

/**
 * Transaksi uji coba developer (5 Nov 2026, belanja "TEST" & "ada", keduanya sudah
 * dibatalkan) yang tercatat memakai akun Superadmin 2.
 */
const TX_UJI_DEVELOPER = new Set([
  '400afe0b-2052-4f48-a534-59d0f6a16264',
  'ce72337b-d880-4f09-b247-d8c0fc0f760b',
])

/** Nama pencatat untuk tampilan; akun Superadmin 2 dipegang Hesti Qodriani (sama dengan lib/expenseRow). */
export function namaPencatat(nama: string | null | undefined, txId?: string): string | null {
  if (txId && TX_UJI_DEVELOPER.has(txId)) return 'Developer'
  const n = nama?.trim()
  if (!n) return null
  return /superadmin\s*2/i.test(n) ? 'Hesti Qodriani' : n
}

/** Batas rentang tanggal WIB (inklusif) → ISO untuk filter occurred_at. */
export function batasRentangWib(dari: string, sampai: string): { mulai: string; akhirEksklusif: string } {
  const mulai = new Date(`${dari}T00:00:00+07:00`)
  const akhir = new Date(`${sampai}T00:00:00+07:00`)
  akhir.setUTCDate(akhir.getUTCDate() + 1)
  return { mulai: mulai.toISOString(), akhirEksklusif: akhir.toISOString() }
}
