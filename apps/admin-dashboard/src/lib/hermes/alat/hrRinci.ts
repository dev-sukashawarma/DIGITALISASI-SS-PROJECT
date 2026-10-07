import { z } from 'zod'
import type { DefinisiAlat, KonteksHermes } from '../registry'
import { pilihOutlet } from '../absensi/outlet'
import type { StatusKasbon } from '../absensi/tipe'

const OUTLET = z.string().min(1).max(60).describe('Nama outlet (sebagian nama boleh). Kosong = semua lokasi.')
const SUMBER = 'Perizinan & Payroll HR'
const galat = (pesan: string) => ({ status: 'galat', pesan })
const urut = (a: string, b: string) => a.localeCompare(b, 'id')

async function kasbonDaftar(ctx: KonteksHermes, a: { status?: StatusKasbon | 'semua'; outlet?: string }) {
  const outlets = await ctx.absensi.outlets()
  const pilih = pilihOutlet(outlets, a.outlet)
  if (!pilih.ok) return galat(pilih.pesan)
  const nama = new Map(pilih.outlets.map((o) => [o.id, o.name]))
  const status = a.status
  const semua = await ctx.hrRinci.kasbonDaftar()
  const baris = semua
    .filter((k) => k.outletId && nama.has(k.outletId))
    .filter((k) => (!status ? k.status === 'menunggu' || k.status === 'aktif' : status === 'semua' || k.status === status))
    .map((k) => ({ id: k.id, nama: k.nama, outlet: nama.get(k.outletId!)!, nominal: k.nominal, sisa: k.sisa, cicilan_bulan: k.cicilanBulan, status: k.status, tanggal: k.tanggal }))
    .sort((x, y) => y.tanggal.localeCompare(x.tanggal) || urut(x.nama, y.nama) || urut(x.id, y.id))
  const total = baris.reduce((t, k) => ({ jumlah: t.jumlah + 1, nominal: t.nominal + k.nominal, sisa: t.sisa + k.sisa }), { jumlah: 0, nominal: 0, sisa: 0 })
  return { status: 'ok', filter_status: status ?? 'menunggu_dan_aktif', kasbon: baris, total }
}

async function gajiDaftar(ctx: KonteksHermes, a: { bulan?: number; tahun?: number; outlet?: string }) {
  const [tahunIni, bulanIni] = ctx.absensi.hariIni.split('-').map(Number)
  const bulan = a.bulan ?? bulanIni
  const tahun = a.tahun ?? tahunIni
  const pilih = pilihOutlet(await ctx.absensi.outlets(), a.outlet)
  if (!pilih.ok) return galat(pilih.pesan)
  const nama = new Map(pilih.outlets.map((o) => [o.id, o.name]))
  const baris = (await ctx.hrRinci.gajiDaftar(bulan, tahun))
    .filter((g) => g.outletId && nama.has(g.outletId))
    .map((g) => ({ nama: g.nama, outlet: nama.get(g.outletId!)!, gaji_pokok: g.gajiPokok, tunjangan: g.tunjangan, bonus: g.bonus, potongan: g.potongan, total: g.total, status: g.status }))
    .sort((x, y) => urut(x.outlet, y.outlet) || urut(x.nama, y.nama))
  const total = baris.reduce(
    (t, g) => ({ jumlah: t.jumlah + 1, gaji_pokok: t.gaji_pokok + g.gaji_pokok, tunjangan: t.tunjangan + g.tunjangan, bonus: t.bonus + g.bonus, potongan: t.potongan + g.potongan, total: t.total + g.total }),
    { jumlah: 0, gaji_pokok: 0, tunjangan: 0, bonus: 0, potongan: 0, total: 0 },
  )
  return { status: 'ok', bulan, tahun, gaji: baris, total }
}

export const ALAT_HR_RINCI: DefinisiAlat[] = [
  {
    nama: 'kasbon_daftar',
    domain: 'hr_rinci',
    sumber: SUMBER,
    deskripsi: 'Daftar kasbon per orang (nama, outlet, nominal, sisa, cicilan, status, tanggal pengajuan). Default: menunggu + aktif. Status = layar Kasbon HR. Alasan pengajuan tidak ditampilkan.',
    skema: z.object({ status: z.enum(['menunggu', 'aktif', 'lunas', 'ditolak', 'semua']).optional(), outlet: OUTLET.optional() }).strict(),
    contoh: {},
    jalankan: kasbonDaftar,
  },
  {
    nama: 'gaji_daftar',
    domain: 'hr_rinci',
    sumber: SUMBER,
    deskripsi: 'Slip gaji per orang untuk satu bulan (default bulan berjalan WIB): gaji pokok, tunjangan, bonus, potongan, total, status. Tanpa data rekening/kontak/catatan bebas.',
    skema: z.object({ bulan: z.number().int().min(1).max(12).optional(), tahun: z.number().int().min(2020).max(2100).optional(), outlet: OUTLET.optional() }).strict(),
    contoh: {},
    jalankan: gajiDaftar,
  },
]
