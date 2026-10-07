// Hanya untuk route /api/hermes/* SETELAH autentikasi kunci lolos.
import { laporanPosUntukScope, type CakupanLaporan } from '@/lib/posReport/laporan'
import { buatAmbilLaporan, ambilOutlets } from '@/lib/sukaBot/server/sumberData'
import { jakartaDate } from '@/lib/ownerDashboardCache'
import type { KonteksHermes } from '../registry'

export async function konteksHermes(svc: any, sekarang: Date): Promise<KonteksHermes> {
  // Cakupan 'all' = sama dengan role berakses penuh (owner/admin) di layar Rangkuman Penjualan,
  // jadi angka & cache-nya identik. Pembatasan per bot dilakukan lewat scope DOMAIN, bukan outlet.
  const cakupan: CakupanLaporan = { supabase: svc, scopeKey: 'all', allowedOutletIds: 'all' }
  const outlets = await ambilOutlets(svc)
  return {
    sekarang,
    penjualan: {
      outlets,
      hariIni: jakartaDate(sekarang),
      sekarang,
      ambilLaporan: buatAmbilLaporan((req) => laporanPosUntukScope(req, cakupan)),
    },
  }
}
