import { mapWithConcurrency } from '@/lib/ownerDashboardCache'
import { resolvePeriode, periodePembanding, type KodePeriode, type Periode } from '../periode'
import { cariSatu, normalisasiOutlet } from '../pencarian'
import { rupiah, persenPerubahan, teksPersen, jamWib } from '../format'

export interface RingkasanLaporan { omzetKotor: number; omzetBersih: number; transaksi: number; menu: { nama: string; qty: number; omzet: number }[] }
export type AmbilLaporan = (r: { dari: string; sampai: string; outletIds: string[]; kanal: string[] }) => Promise<RingkasanLaporan>
export interface OutletInfo { id: string; name: string; type: string; is_active: boolean; slug?: string | null }
export interface KonteksPenjualan { ambilLaporan: AmbilLaporan; outlets: OutletInfo[]; hariIni: string; sekarang: Date }

export type KodeKanal = 'semua' | 'kasir' | 'gofood' | 'grabfood' | 'shopeefood' | 'food_apps' | 'tiktok_go' | 'web'
// Kunci = kunci channel Rangkuman Penjualan (computeAvailableChannels/isChannelSelected).
export const KANAL: Record<KodeKanal, { channels: string[]; label: string }> = {
  semua: { channels: ['all'], label: 'Semua kanal' },
  kasir: { channels: ['pos_kasir'], label: 'POS Kasir' },
  gofood: { channels: ['gofood'], label: 'GoFood' },
  grabfood: { channels: ['grabfood'], label: 'GrabFood' },
  shopeefood: { channels: ['shopeefood'], label: 'ShopeeFood' },
  food_apps: { channels: ['food_apps'], label: 'Food Apps (GoFood+GrabFood+ShopeeFood)' },
  tiktok_go: { channels: ['tiktokgo'], label: 'TikTok GO' },
  web: { channels: ['online'], label: 'Website Online' },
}

export interface ArgPeriode { periode: KodePeriode; dari?: string; sampai?: string }
export interface BarisRanking { peringkat: number; nama: string; omzet: number; omzetPembanding: number | null; persen: number | null }

// Outlet sungguhan = 'internal' | 'mitra' (migration 20261003150000, keputusan owner 3 Okt).
// Aturan nama & slug disamakan dengan view valid_operational_outlets / sales_board_outlets:
// SS BACKUP dan outlet bernama tes/test/trial/demo bertipe internal/mitra tapi bukan outlet nyata.
const TIPE_TERHITUNG = new Set(['internal', 'mitra'])
const SLUG_DIKECUALIKAN = new Set(['ss-backup'])
const NAMA_UJI = /tes|test|trial|demo/i
const KONKURENSI = 4
const SUMBER = 'Rangkuman Penjualan'

export function outletTerhitung(outlets: OutletInfo[]): OutletInfo[] {
  return outlets.filter((o) => TIPE_TERHITUNG.has(o.type) && !SLUG_DIKECUALIKAN.has(o.slug ?? '') && !NAMA_UJI.test(o.name))
}

const periodeDari = (ctx: KonteksPenjualan, a: ArgPeriode) => resolvePeriode(a.periode, ctx.hariIni, { dari: a.dari, sampai: a.sampai })
const catatanBerjalan = (ctx: KonteksPenjualan, p: Periode) => (p.berjalan ? `Angka berjalan sampai pukul ${jamWib(ctx.sekarang)} WIB.` : undefined)

type Cakupan = { ok: true; ids: string[]; label: string } | { ok: false; hasil: Record<string, unknown> }

function pilihCakupan(ctx: KonteksPenjualan, outlet?: string): Cakupan {
  const daftar = outletTerhitung(ctx.outlets)
  // ids memuat outlet nonaktif juga (periode lampau), tapi label menghitung yang aktif saja.
  if (!outlet) return { ok: true, ids: daftar.map((o) => o.id), label: `Semua outlet (${daftar.filter((o) => o.is_active).length} outlet aktif, tanpa SS Online)` }
  const h = cariSatu(outlet, daftar, (o) => o.name, normalisasiOutlet)
  if (h.status === 'cocok') return { ok: true, ids: [h.item.id], label: h.item.name }
  if (h.status === 'ambigu') return { ok: false, hasil: { status: 'ambigu', pesan: `Ada beberapa outlet yang cocok dengan "${outlet}". Tanyakan ke Bos yang mana.`, kandidat: h.kandidat.map((o) => o.name) } }
  return { ok: false, hasil: { status: 'tidak_ditemukan', pesan: `Outlet "${outlet}" tidak ditemukan di daftar outlet yang dihitung.`, outlet_tersedia: daftar.map((o) => o.name) } }
}

function ringkas(p: Periode, l: RingkasanLaporan) {
  return {
    periode: p.label,
    omzet_kotor: rupiah(l.omzetKotor),
    omzet_kotor_angka: Math.round(l.omzetKotor),
    omzet_bersih: rupiah(l.omzetBersih),
    transaksi: l.transaksi,
  }
}

export async function alatOmzet(ctx: KonteksPenjualan, a: ArgPeriode & { outlet?: string; kanal?: KodeKanal }) {
  const p = periodeDari(ctx, a)
  const c = pilihCakupan(ctx, a.outlet)
  if (!c.ok) return c.hasil
  const kanal = KANAL[a.kanal ?? 'semua']
  const l = await ctx.ambilLaporan({ dari: p.dari, sampai: p.sampai, outletIds: c.ids, kanal: kanal.channels })
  return { status: 'ok', ...ringkas(p, l), cakupan: c.label, kanal: kanal.label, catatan: catatanBerjalan(ctx, p), sumber: SUMBER }
}

export async function alatBandingkan(ctx: KonteksPenjualan, a: ArgPeriode & { pembanding?: ArgPeriode; outlet?: string; kanal?: KodeKanal }) {
  const p = periodeDari(ctx, a)
  const q = a.pembanding ? periodeDari(ctx, a.pembanding) : periodePembanding(a.periode, p)
  const c = pilihCakupan(ctx, a.outlet)
  if (!c.ok) return c.hasil
  const kanal = KANAL[a.kanal ?? 'semua']
  const [lp, lq] = await Promise.all([
    ctx.ambilLaporan({ dari: p.dari, sampai: p.sampai, outletIds: c.ids, kanal: kanal.channels }),
    ctx.ambilLaporan({ dari: q.dari, sampai: q.sampai, outletIds: c.ids, kanal: kanal.channels }),
  ])
  return {
    status: 'ok',
    cakupan: c.label,
    kanal: kanal.label,
    utama: ringkas(p, lp),
    pembanding: ringkas(q, lq),
    selisih: rupiah(lp.omzetKotor - lq.omzetKotor),
    perubahan: teksPersen(persenPerubahan(lp.omzetKotor, lq.omzetKotor)),
    catatan: catatanBerjalan(ctx, p),
    sumber: SUMBER,
  }
}

export async function alatMenuTerlaris(ctx: KonteksPenjualan, a: ArgPeriode & { outlet?: string; kanal?: KodeKanal; urutan?: 'terlaris' | 'tersepi'; jumlah?: number }) {
  const p = periodeDari(ctx, a)
  const c = pilihCakupan(ctx, a.outlet)
  if (!c.ok) return c.hasil
  const kanal = KANAL[a.kanal ?? 'semua']
  const l = await ctx.ambilLaporan({ dari: p.dari, sampai: p.sampai, outletIds: c.ids, kanal: kanal.channels })
  const jumlah = Math.min(20, Math.max(1, a.jumlah ?? 5))
  const tersepi = a.urutan === 'tersepi'
  const urut = [...l.menu].filter((m) => m.qty > 0).sort((x, y) => (tersepi ? x.qty - y.qty : y.qty - x.qty))
  return {
    status: 'ok',
    periode: p.label,
    cakupan: c.label,
    kanal: kanal.label,
    urutan: tersepi ? 'tersepi' : 'terlaris',
    menu: urut.slice(0, jumlah).map((m, i) => ({ peringkat: i + 1, nama: m.nama, terjual: m.qty, omzet_item: rupiah(m.omzet) })),
    catatan: [tersepi ? 'Hanya menu yang terjual minimal 1 porsi; menu yang tidak laku sama sekali tidak tercatat.' : undefined, catatanBerjalan(ctx, p)].filter(Boolean).join(' ') || undefined,
    sumber: SUMBER,
  }
}

export async function hitungRanking(ctx: KonteksPenjualan, p: Periode, pembanding: Periode | null, kanal: string[]): Promise<BarisRanking[]> {
  const daftar = outletTerhitung(ctx.outlets)
  const baris = await mapWithConcurrency(daftar, KONKURENSI, async (o) => {
    const [lp, lq] = await Promise.all([
      ctx.ambilLaporan({ dari: p.dari, sampai: p.sampai, outletIds: [o.id], kanal }),
      pembanding ? ctx.ambilLaporan({ dari: pembanding.dari, sampai: pembanding.sampai, outletIds: [o.id], kanal }) : Promise.resolve(null),
    ])
    return { o, omzet: lp.omzetKotor, omzetPembanding: lq ? lq.omzetKotor : null }
  })
  return baris
    .filter((b) => b.o.is_active || b.omzet > 0)
    .sort((x, y) => y.omzet - x.omzet)
    .map((b, i) => ({
      peringkat: i + 1,
      nama: b.o.name,
      omzet: b.omzet,
      omzetPembanding: b.omzetPembanding,
      persen: b.omzetPembanding === null ? null : persenPerubahan(b.omzet, b.omzetPembanding),
    }))
}

export async function alatRankingOutlet(ctx: KonteksPenjualan, a: ArgPeriode & { kanal?: KodeKanal; bandingkan?: boolean }) {
  const p = periodeDari(ctx, a)
  const q = a.bandingkan === false ? null : periodePembanding(a.periode, p)
  const kanal = KANAL[a.kanal ?? 'semua']
  const ranking = await hitungRanking(ctx, p, q, kanal.channels)
  return {
    status: 'ok',
    periode: p.label,
    pembanding: q?.label,
    kanal: kanal.label,
    ranking: ranking.map((r) => ({ peringkat: r.peringkat, nama: r.nama, omzet: rupiah(r.omzet), perubahan: q ? teksPersen(r.persen) : undefined })),
    catatan: catatanBerjalan(ctx, p),
    sumber: SUMBER,
  }
}
