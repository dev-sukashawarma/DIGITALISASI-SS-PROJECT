// Adapter nyata untuk alat SUKA Bot & Hermes. Rumus = Rangkuman Penjualan (getPosReport).
// SUKA Bot: query memakai `supabase` sesi penanya (bukan service role).
import { getPosReport } from '@/app/actions/posReport'
import type { PosReportRequest } from '@/lib/posReport/laporan'
import type { AmbilLaporan, OutletInfo, KonteksPenjualan } from '../alat/penjualan'
import type { KonteksStok, BahanInfo, BarisStok } from '../alat/stok'

/** Bungkus pemanggil Rangkuman Penjualan apa pun (sesi cookie atau cakupan Hermes) jadi AmbilLaporan. */
export function buatAmbilLaporan(panggil: (req: PosReportRequest) => Promise<any>): AmbilLaporan {
  return async ({ dari, sampai, outletIds, kanal }) => {
    // outlets kosong akan dibaca getPosReport sebagai "semua" (termasuk SS Online) — tolak.
    if (outletIds.length === 0) throw new Error('Daftar outlet kosong')
    const r: any = await panggil({
      from: dari, to: sampai, outlets: outletIds, channels: kanal,
      paymentMethod: 'all', search: '', page: 1, pageSize: 1, isPawoonVisible: true,
    })
    return {
      omzetKotor: Number(r.analytics.grossRevenue) || 0,
      omzetBersih: Number(r.analytics.netRevenue) || 0,
      transaksi: Number(r.analytics.totalOrders) || 0,
      menu: (r.analytics.bestSellers ?? []).map((b: any) => ({ nama: String(b.name), qty: Number(b.qty) || 0, omzet: Number(b.revenue) || 0 })),
    }
  }
}

/** Rangkuman Penjualan yang sama dengan /dashboard/reports/pos (rumus + cache per hari). */
export const ambilLaporanRangkuman: AmbilLaporan = buatAmbilLaporan(getPosReport)

export async function ambilOutlets(supabase: any): Promise<OutletInfo[]> {
  const { data, error } = await supabase.from('outlets').select('id, name, type, is_active, slug').order('name')
  if (error) throw new Error(`outlets: ${error.message}`)
  return (data ?? []).map((o: any) => ({ id: o.id, name: o.name, type: o.type ?? '', is_active: !!o.is_active, slug: o.slug ?? null }))
}

export function konteksStok(supabase: any, outlets: OutletInfo[], hariIni: string): KonteksStok {
  return {
    outlets,
    hariIni,
    daftarBahan: async (): Promise<BahanInfo[]> => {
      const { data, error } = await supabase
        .from('bahan_baku')
        .select('id, nama, satuan, satuan_tengah, faktor_tengah, satuan_kecil, faktor_tampilan')
        .eq('is_active', true)
        .order('nama')
      if (error) throw new Error(`bahan_baku: ${error.message}`)
      return data ?? []
    },
    barisStok: async (bahanId: string): Promise<BarisStok[]> => {
      const { data, error } = await supabase
        .from('monitoring_view_spv')
        .select('outlet_id, bahan_baku_id, current_qty, last_opname_date, saldo_is_gram')
        .eq('bahan_baku_id', bahanId)
      if (error) throw new Error(`monitoring_view_spv: ${error.message}`)
      const seen = new Set<string>()
      return (data ?? []).filter((r: any) => (seen.has(r.outlet_id) ? false : (seen.add(r.outlet_id), true)))
    },
  }
}

export function konteksPenjualan(outlets: OutletInfo[], hariIni: string, sekarang: Date): KonteksPenjualan {
  return { ambilLaporan: ambilLaporanRangkuman, outlets, hariIni, sekarang }
}
