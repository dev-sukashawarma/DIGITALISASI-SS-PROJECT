import { formatTriUnitSaldoAdaptive } from '@/lib/format/compositeUnit'
import { cariSatu, normalisasiBahan, normalisasiOutlet } from '../pencarian'
import { outletTerhitung, type OutletInfo } from './penjualan'

export interface BahanInfo { id: string; nama: string; satuan: string; satuan_tengah: string | null; faktor_tengah: number | null; satuan_kecil: string | null; faktor_tampilan: number | null }
export interface BarisStok { outlet_id: string; bahan_baku_id: string; current_qty: number; last_opname_date: string | null; saldo_is_gram: boolean }
export interface KonteksStok { daftarBahan: () => Promise<BahanInfo[]>; barisStok: (bahanId: string) => Promise<BarisStok[]>; outlets: OutletInfo[]; hariIni: string }

/** Gudang Pusat (type 'office') — dipakai trigger surat jalan; bukan outlet penjualan tapi lokasi stok sah. */
export const GUDANG_PUSAT_ID = 'd23e11b3-23f1-4f9a-b428-cc73e1aa9b90'
const BATAS_HARI_AKURAT = 3

const selisihHari = (a: string, b: string) =>
  Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000)

function lokasiStok(outlets: OutletInfo[]): OutletInfo[] {
  const gudang = outlets.filter((o) => o.id === GUDANG_PUSAT_ID)
  return [...gudang, ...outletTerhitung(outlets)]
}

export async function alatStokBahan(ctx: KonteksStok, a: { bahan: string; outlet?: string }) {
  const daftarBahan = await ctx.daftarBahan()
  const hb = cariSatu(a.bahan, daftarBahan, (b) => b.nama, normalisasiBahan)
  if (hb.status === 'ambigu') return { status: 'ambigu', pesan: `Ada beberapa bahan yang cocok dengan "${a.bahan}". Tanyakan ke Bos yang mana.`, kandidat: hb.kandidat.map((b) => b.nama) }
  if (hb.status === 'tidak_ada') return { status: 'tidak_ditemukan', pesan: `Bahan "${a.bahan}" tidak ditemukan di master bahan aktif.` }
  const bahan = hb.item

  const lokasi = lokasiStok(ctx.outlets)
  let dipilih = lokasi
  if (a.outlet) {
    const ho = cariSatu(a.outlet, lokasi, (o) => o.name, (s) => normalisasiOutlet(s).replace(/\bpusat\b|\bhq\b/g, '').trim())
    if (ho.status === 'ambigu') return { status: 'ambigu', pesan: `Ada beberapa lokasi yang cocok dengan "${a.outlet}".`, kandidat: ho.kandidat.map((o) => o.name) }
    if (ho.status === 'tidak_ada') return { status: 'tidak_ditemukan', pesan: `Lokasi "${a.outlet}" tidak ditemukan.` }
    dipilih = [ho.item]
  }
  const namaById = new Map(dipilih.map((o) => [o.id, o.name]))

  const baris = (await ctx.barisStok(bahan.id)).filter((b) => namaById.has(b.outlet_id))
  const hasil = baris
    .map((b) => {
      const hari = b.last_opname_date ? selisihHari(b.last_opname_date, ctx.hariIni) : null
      return {
        lokasi: namaById.get(b.outlet_id)!,
        saldo_sistem: formatTriUnitSaldoAdaptive(Number(b.current_qty) || 0, !!b.saldo_is_gram, bahan.satuan, bahan.satuan_tengah, bahan.faktor_tengah, bahan.satuan_kecil, bahan.faktor_tampilan),
        opname_terakhir: b.last_opname_date ? `${b.last_opname_date} (${hari} hari lalu)` : 'belum pernah',
        mungkin_tidak_akurat: hari === null || hari > BATAS_HARI_AKURAT,
      }
    })
    .sort((x, y) => x.lokasi.localeCompare(y.lokasi))

  return {
    status: 'ok',
    bahan: bahan.nama,
    lokasi: hasil,
    catatan: 'Saldo sistem = catatan aplikasi, benar sampai opname terakhir; bukan hitungan rak saat ini.',
    sumber: 'App Stok (Monitoring)',
  }
}
