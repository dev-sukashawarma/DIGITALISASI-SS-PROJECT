// Hanya untuk route /api/hermes/* SETELAH autentikasi kunci lolos.
import { laporanPosUntukScope, type CakupanLaporan } from '@/lib/posReport/laporan'
import { buatAmbilLaporan, ambilOutlets } from '@/lib/sukaBot/server/sumberData'
import { jakartaDate } from '@/lib/ownerDashboardCache'
import type { KonteksHermes } from '../registry'
import { buatKonteksAbsensi } from './absensiSumber'
import { buatKonteksHrRinci } from './hrRinciSumber'
import { buatKonteksFinance } from './financeSumber'
import { buatKonteksStok } from './stokSumber'
import { buatKonteksSistem } from './sistemSumber'

export async function konteksHermes(svc: any, sekarang: Date): Promise<KonteksHermes> {
  // Cakupan 'all' = sama dengan role berakses penuh (owner/admin) di layar Rangkuman Penjualan,
  // jadi angka & cache-nya identik. Pembatasan per bot dilakukan lewat scope DOMAIN, bukan outlet.
  const cakupan: CakupanLaporan = { supabase: svc, scopeKey: 'all', allowedOutletIds: 'all' }
  const outlets = await ambilOutlets(svc)
  const hariIni = jakartaDate(sekarang)
  return {
    sekarang,
    penjualan: {
      outlets,
      hariIni,
      sekarang,
      ambilLaporan: buatAmbilLaporan((req) => laporanPosUntukScope(req, cakupan)),
    },
    absensi: buatKonteksAbsensi(svc, sekarang),
    hrRinci: buatKonteksHrRinci(svc, sekarang),
    finance: buatKonteksFinance(svc, sekarang, outlets),
    stok: buatKonteksStok(svc, outlets, hariIni),
    sistem: buatKonteksSistem(svc, sekarang),
  }
}
