import { addDaysStr, jakartaDate } from '@/lib/ownerDashboardCache'
import { hitungRanking, outletTerhitung, type BarisRanking, type KonteksPenjualan } from './alat/penjualan'
import { resolvePeriode, labelTanggal } from './periode'
import { rupiah, persenPerubahan, teksPersen, jamWibAngka } from './format'

export interface DataRekap {
  tanggal: string
  pembanding: string
  omzet: number
  omzetPembanding: number
  persen: number | null
  transaksi: number
  ranking: BarisRanking[]
  menuTeratas: { nama: string; qty: number }[]
}

const JAM_REKAP_SIAP = 5

/** Data "kemarin" dianggap cukup lengkap mulai 05:00 WIB; sebelum itu rekap yang tampil = hari sebelumnya. */
export function tanggalRekapUntuk(sekarang: Date): string {
  const hariIni = jakartaDate(sekarang)
  return addDaysStr(hariIni, jamWibAngka(sekarang) < JAM_REKAP_SIAP ? -2 : -1)
}

export async function hitungRekap(ctx: KonteksPenjualan, tanggal: string): Promise<DataRekap> {
  const pembanding = addDaysStr(tanggal, -7)
  const ids = outletTerhitung(ctx.outlets).map((o) => o.id)
  const p = resolvePeriode('rentang', addDaysStr(tanggal, 1), { dari: tanggal, sampai: tanggal })
  const q = resolvePeriode('rentang', addDaysStr(tanggal, 1), { dari: pembanding, sampai: pembanding })
  const [total, totalP, ranking] = await Promise.all([
    ctx.ambilLaporan({ dari: tanggal, sampai: tanggal, outletIds: ids, kanal: ['all'] }),
    ctx.ambilLaporan({ dari: pembanding, sampai: pembanding, outletIds: ids, kanal: ['all'] }),
    hitungRanking(ctx, p, q, ['all']),
  ])
  return {
    tanggal,
    pembanding,
    omzet: total.omzetKotor,
    omzetPembanding: totalP.omzetKotor,
    persen: persenPerubahan(total.omzetKotor, totalP.omzetKotor),
    transaksi: total.transaksi,
    ranking,
    menuTeratas: [...total.menu].sort((a, b) => b.qty - a.qty).slice(0, 3).map((m) => ({ nama: m.nama, qty: m.qty })),
  }
}

export function teksRekap(d: DataRekap): string {
  const baris = [
    `Rekap penjualan ${labelTanggal(d.tanggal)}, Bos 👋`,
    '',
    `Omzet kotor: ${rupiah(d.omzet)} (${teksPersen(d.persen)} vs ${labelTanggal(d.pembanding)}: ${rupiah(d.omzetPembanding)})`,
    `Transaksi: ${d.transaksi.toLocaleString('id-ID')}`,
    '',
    'Ranking outlet:',
    ...d.ranking.map((r) => `${r.peringkat}. ${r.nama} — ${rupiah(r.omzet)} (${teksPersen(r.persen)})`),
    '',
    'Menu terlaris:',
    ...d.menuTeratas.map((m, i) => `${i + 1}. ${m.nama} — ${m.qty.toLocaleString('id-ID')} porsi`),
    '',
    'Sumber: Rangkuman Penjualan (omzet kotor, tanpa SS Online).',
  ]
  return baris.join('\n')
}
