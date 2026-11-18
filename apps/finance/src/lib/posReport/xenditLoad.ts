/* Data & penggabungan status Xendit untuk Histori Transaksi (spec 2026-11-18-validasi-xendit).
 * Sengaja di luar cache hari laporan: status harus segar setelah unggah file / webhook,
 * dan tidak boleh ikut memengaruhi angka omzet. */
import {
  isPesananWebsite, statusXendit, cocokFilterXendit, pembayaranTanpaPesananSelesai,
  type PembayaranRingkas, type StatusXendit, type XenditFilter,
} from './xenditStatus'

export type InfoXendit = { status: StatusXendit; bayar: PembayaranRingkas[] }
export type XenditLain = { jenis: 'hanya_xendit' | 'batal'; bayar: PembayaranRingkas }

type PesananMin = { status?: string | null; sales_source?: string | null; external_order_id?: string | null; total_amount: number | string }

const tanggalWib = (iso: string) => new Date(Date.parse(iso) + 7 * 3600_000).toISOString().slice(0, 10)

export function gabungXendit<T extends PesananMin>(p: {
  tableRows: T[]
  semuaPesanan: PesananMin[]
  bayar: PembayaranRingkas[]
  filter: XenditFilter
  from: string
  to: string
  /** Sumber yang dipilih mencakup Website. */
  tampilWebsite: boolean
  outletDipilih: 'all' | Set<string>
  /** Boleh menampilkan pembayaran yang belum diketahui outletnya (Semua Cabang + akses penuh). */
  bolehTanpaOutlet: boolean
}): { rows: (T & { xendit?: InfoXendit })[]; xenditLain: XenditLain[]; xenditTanpaOutletTersembunyi: number } {
  if (!p.tampilWebsite) return { rows: p.tableRows, xenditLain: [], xenditTanpaOutletTersembunyi: 0 }

  const perPesanan = new Map<string, PembayaranRingkas[]>()
  for (const b of p.bayar) {
    if (b.bukanPenjualan || !b.externalOrderId) continue
    const arr = perPesanan.get(b.externalOrderId) ?? []
    arr.push(b)
    perPesanan.set(b.externalOrderId, arr)
  }

  const rows: (T & { xendit?: InfoXendit })[] = []
  for (const r of p.tableRows) {
    if (!isPesananWebsite(r)) {
      if (p.filter === 'all') rows.push(r)
      continue
    }
    const bayar = perPesanan.get(r.external_order_id!) ?? []
    const status = statusXendit({ total_amount: Number(r.total_amount) }, bayar)
    if (cocokFilterXendit(status, p.filter)) rows.push({ ...r, xendit: { status, bayar } })
  }

  let tersembunyi = 0
  const dalamCakupan = p.bayar.filter(b => {
    const t = tanggalWib(b.dibayarAt)
    if (t < p.from || t > p.to) return false
    if (b.outletId == null) {
      if (!p.bolehTanpaOutlet) { if (!b.bukanPenjualan) tersembunyi++; return false }
      return true
    }
    return p.outletDipilih === 'all' || p.outletDipilih.has(b.outletId)
  })
  // Semua pesanan ber-external_order_id, bukan hanya yang terdeteksi website: pesanan
  // website yang tercatat sebagai penjualan kasir (mis. Pekayon #23) tetap "ada di POS".
  const web = p.semuaPesanan.filter(o => !!o.external_order_id)
  const selesai = new Set(web.filter(o => o.status === 'completed').map(o => o.external_order_id!))
  const batal = new Set(web.filter(o => o.status === 'cancelled').map(o => o.external_order_id!))
  const xenditLain = p.filter === 'all' || p.filter === 'hanya_xendit'
    ? pembayaranTanpaPesananSelesai(dalamCakupan, selesai, batal)
    : []

  return { rows, xenditLain, xenditTanpaOutletTersembunyi: tersembunyi }
}

const MEMO_MS = 30_000
const memo = new Map<string, { t: number; data: Promise<PembayaranRingkas[]> }>()

/** Pembayaran Xendit untuk rentang laporan (± 1 hari agar tautan lintas tengah malam tetap terbaca). */
export function muatPembayaranXendit(supabase: any, scopeKey: string, from: string, to: string): Promise<PembayaranRingkas[]> {
  const key = `${scopeKey}|${from}|${to}`
  const ada = memo.get(key)
  if (ada && Date.now() - ada.t < MEMO_MS) return ada.data
  const dari = new Date(Date.parse(`${from}T00:00:00+07:00`) - 86400_000).toISOString()
  const sampai = new Date(Date.parse(`${to}T23:59:59+07:00`) + 86400_000).toISOString()
  const data = (async () => {
    const hasil: PembayaranRingkas[] = []
    for (let mulai = 0; ; mulai += 1000) {
      const { data: rows, error } = await supabase.from('xendit_pembayaran')
        .select('xendit_id, ref_qris, nominal, dibayar_at, cara_cocok, external_order_id, outlet_id, nama_pelanggan, ringkasan_item, bukan_penjualan')
        .gte('dibayar_at', dari).lte('dibayar_at', sampai)
        .order('xendit_id', { ascending: true }).range(mulai, mulai + 999)
      if (error) throw new Error(error.message)
      for (const r of rows ?? []) {
        hasil.push({
          xenditId: r.xendit_id, refQris: r.ref_qris, nominal: Number(r.nominal), dibayarAt: r.dibayar_at,
          caraCocok: r.cara_cocok, externalOrderId: r.external_order_id, outletId: r.outlet_id,
          namaPelanggan: r.nama_pelanggan, ringkasanItem: r.ringkasan_item, bukanPenjualan: !!r.bukan_penjualan,
        })
      }
      if (!rows || rows.length < 1000) break
    }
    return hasil
  })()
  data.catch(() => memo.delete(key))
  memo.set(key, { t: Date.now(), data })
  if (memo.size > 50) memo.delete(memo.keys().next().value!)
  return data
}

/** Dipanggil setelah unggah file agar status langsung segar. */
export function bersihkanMemoXendit() {
  memo.clear()
}
