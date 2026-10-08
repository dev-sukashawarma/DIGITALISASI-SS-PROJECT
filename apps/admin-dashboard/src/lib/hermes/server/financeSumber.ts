// Loader data finance Bot CEO (service role). Hanya untuk route /api/hermes/* SETELAH
// autentikasi kunci lolos. Sumber = layar yang sama dengan manusia (spec Finance 1 §4).
import type { SupabaseClient } from '@supabase/supabase-js'
import { isTestOutlet } from '@/lib/outletFilters'
import { jakartaDate } from '@/lib/ownerDashboardCache'
import { ambilPengeluaranMentah } from '@/lib/pengeluaran/ambilPengeluaran'
import { susunBarisPengeluaran } from '@/lib/pengeluaran/susunBaris'
import type { OutletInfo } from '@/lib/sukaBot/alat/penjualan'
import type { KonteksFinance, OutletNama, PoBaris, SetoranBaris, ShiftBaris } from '../finance/tipe'
import { semuaHalaman } from './absensiSumber'

const tambahHari = (tgl: string, n: number) => new Date(Date.parse(`${tgl}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10)

export function buatKonteksFinance(svc: SupabaseClient, sekarang: Date, outletsSemua: OutletInfo[]): KonteksFinance {
  const hariIni = jakartaDate(sekarang)
  let po: Promise<PoBaris[]> | null = null
  const outlets: OutletNama[] = outletsSemua
    .filter((o) => !isTestOutlet(o) && o.type !== 'test')
    .map((o) => ({ id: o.id, name: o.name, type: o.type }))

  return {
    hariIni,
    outlets: async () => outlets,

    // Dashboard Pembelian: RPC get_purchase_orders (SECURITY DEFINER), seluruh riwayat.
    purchaseOrders: () =>
      (po ??= (async () => {
        const { data, error } = await svc.rpc('get_purchase_orders', { p_from: '2000-01-01', p_to: hariIni, p_status: null })
        if (error) throw new Error(`purchase order: ${error.message}`)
        return ((data ?? []) as any[]).map((r) => ({
          nomorPo: r.nomor_po,
          supplier: r.supplier_nama ?? 'Tanpa supplier',
          tanggalPo: String(r.tanggal_po ?? '').slice(0, 10),
          status: r.status,
          nilaiPesan: Number(r.total_nilai) || 0,
          nilaiTerima: Number(r.total_nilai_terima) || 0,
          jatuhTempo: r.jatuh_tempo ? String(r.jatuh_tempo).slice(0, 10) : null,
          statusBayar: r.payment_status ?? 'unpaid',
        }))
      })()),

    // Halaman Pengeluaran: rumus & penyaringan yang sama persis (lib/pengeluaran).
    pengeluaran: async (dari, sampai) => {
      const r = await ambilPengeluaranMentah(svc, { from: dari, to: sampai, outletId: 'all' })
      return susunBarisPengeluaran(r.expenses, r.pettyCashExpenses)
    },

    // Riwayat Setoran (app Finance). Rentang occurred_at dilebarkan +1 hari karena tanggal
    // jual fallback = tanggal catat − 1; penyaringan akhir di ringkasSetoran.
    setoran: async (dari, sampai) => {
      const fromIso = `${dari}T00:00:00+07:00`
      const toIso = `${tambahHari(sampai, 1)}T23:59:59.999+07:00`
      const rows = await semuaHalaman<any>(() =>
        svc
          .from('cash_transaction')
          .select('id, outlet_id, amount, sales_date, occurred_at, category')
          .eq('source_type', 'cash_deposit')
          .in('status', ['reconciled', 'paid', 'approved'])
          .or(`and(sales_date.gte.${dari},sales_date.lte.${sampai}),and(sales_date.is.null,occurred_at.gte.${fromIso},occurred_at.lte.${toIso})`)
          .order('id', { ascending: true }),
      )
      return rows.map((r): SetoranBaris => ({
        outletId: r.outlet_id,
        nominal: Number(r.amount) || 0,
        tanggalJual: r.sales_date ? String(r.sales_date).slice(0, 10) : null,
        occurredAt: r.occurred_at,
        jenis: r.category ?? null,
      }))
    },

    // Tutup shift POS (tanggal = start_time WIB).
    shift: async (dari, sampai) => {
      const rows = await semuaHalaman<any>(() =>
        svc
          .from('shifts')
          .select('id, outlet_id, start_time, status, expected_ending_cash, actual_ending_cash, variance, staff:outlet_staff!shifts_staff_id_fkey(name)')
          .gte('start_time', `${dari}T00:00:00+07:00`)
          .lte('start_time', `${sampai}T23:59:59.999+07:00`)
          .order('id', { ascending: true }),
      )
      return rows.map((r): ShiftBaris => ({
        outletId: r.outlet_id,
        mulai: r.start_time,
        status: r.status,
        seharusnya: Number(r.expected_ending_cash) || 0,
        fisik: Number(r.actual_ending_cash) || 0,
        selisih: Number(r.variance) || 0,
        kasir: r.staff?.name ?? null,
      }))
    },
  }
}
