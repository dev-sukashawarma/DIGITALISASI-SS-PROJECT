import { z } from 'zod'
import { alpaDariHariHadir, jumlahHariRekap } from '@suka/hr-rumus'
import type { DefinisiAlat, KonteksHermes } from '../registry'
import { pilihOutlet } from '../absensi/outlet'

const TGL = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'format YYYY-MM-DD')
const OUTLET = z.string().min(1).max(60).describe('Nama outlet (sebagian nama boleh). Kosong = semua lokasi.')
const CATATAN_ALPA =
  'Alpa/belum hadir mengikuti rumus papan & rekap absensi: staf yang sedang cuti atau libur BELUM dikecualikan. Cek alat cuti_izin sebelum menyimpulkan.'
const SUMBER_PAPAN = 'Papan Kehadiran (app absensi)'
const SUMBER_REKAP = 'Rekap Absensi (app absensi)'

/** 'HH.MM WIB' dari waktu UTC (aritmetika +7 jam tetap; WIB tanpa DST). */
const pukulWib = (d: Date) => {
  const w = new Date(d.getTime() + 7 * 3_600_000)
  return `${String(w.getUTCHours()).padStart(2, '0')}.${String(w.getUTCMinutes()).padStart(2, '0')} WIB`
}
const dgn = (ctx: KonteksHermes, hasil: object) => ({ ...hasil, diambil_pukul_wib: pukulWib(ctx.sekarang) })
const PETUNJUK_HARI_INI = 'Tampilkan ringkasan sebagai kartu suka-ui dan daftar orang sebagai tabel suka-ui (kolom: Nama, Lokasi, Jam masuk, Menit telat); pisahkan Telat vs Dalam toleransi.'
const PETUNJUK_REKAP = 'Tampilkan per lokasi sebagai tabel suka-ui (kolom: Lokasi, Staf, Telat, Toleransi, Alpa); boleh tambah grafik_batang telat per lokasi.'

const galat = (pesan: string) => ({ status: 'galat', pesan })
const selisihHari = (dari: string, sampai: string) => (Date.parse(sampai) - Date.parse(dari)) / 86_400_000

async function hariIni(ctx: KonteksHermes, a: { tanggal?: string; outlet?: string }) {
  const tanggal = a.tanggal ?? ctx.absensi.hariIni
  if (tanggal > ctx.absensi.hariIni) return galat('Tanggal di masa depan.')
  const pilih = pilihOutlet(await ctx.absensi.outlets(), a.outlet)
  if (!pilih.ok) return galat(pilih.pesan)
  const ids = new Set(pilih.outlets.map((o) => o.id))
  const papan = (await ctx.absensi.papan(tanggal)).filter((p) => ids.has(p.outlet.id))
  const total = { hadir: 0, telat: 0, telat_toleransi: 0, belum: 0, alpa: 0, staf: 0 }
  const outlet = papan.map((p) => {
    total.hadir += p.ringkas.hadir
    total.telat += p.ringkas.telat
    total.telat_toleransi += p.ringkas.telat_toleransi
    total.belum += p.ringkas.belum
    total.alpa += p.ringkas.alpha
    total.staf += p.ringkas.total
    return {
      outlet: p.outlet.name,
      ringkas: { hadir: p.ringkas.hadir, telat: p.ringkas.telat, telat_toleransi: p.ringkas.telat_toleransi, belum: p.ringkas.belum, alpa: p.ringkas.alpha, staf: p.ringkas.total },
      telat: p.staf.filter((s) => s.state === 'telat').map((s) => ({ nama: s.nama, menit: s.menitTelat, jam: s.jam })),
      telat_toleransi: p.staf.filter((s) => s.state === 'telat_toleransi').map((s) => ({ nama: s.nama, menit: s.menitTelat, jam: s.jam })),
      belum_hadir: p.staf.filter((s) => s.state === 'belum').map((s) => s.nama),
      alpa: p.staf.filter((s) => s.state === 'alpha').map((s) => s.nama),
    }
  })
  return dgn(ctx, { status: 'ok', tanggal, total, outlet, petunjuk_tampilan: PETUNJUK_HARI_INI })
}

async function rekapDasar(ctx: KonteksHermes, dari: string, sampai: string, teksOutlet?: string) {
  const pilih = pilihOutlet(await ctx.absensi.outlets(), teksOutlet)
  if (!pilih.ok) return { galat: pilih.pesan } as const
  const [stafMap, rekap] = await Promise.all([ctx.absensi.stafPerOutlet(), ctx.absensi.rekapStaf(dari, sampai)])
  const perStaf = new Map(rekap.map((r) => [r.staffId, r]))
  const hariIniStr = ctx.absensi.hariIni
  const baris = pilih.outlets.flatMap((o) =>
    (stafMap.get(o.id) ?? []).map((s) => {
      const r = perStaf.get(s.id)
      return {
        nama: s.nama,
        outlet: o.name,
        telat: r?.telat ?? 0,
        telat_toleransi: r?.telatToleransi ?? 0,
        menit_telat: r?.menitTelat ?? 0,
        alpa: alpaDariHariHadir(dari, sampai, hariIniStr, r?.hariHadir ?? 0),
      }
    }),
  )
  return { outlets: pilih.outlets, baris, hariDinilai: jumlahHariRekap(dari, sampai, hariIniStr) } as const
}

async function rekap(ctx: KonteksHermes, a: { dari?: string; sampai?: string; outlet?: string }) {
  const sampai = a.sampai ?? ctx.absensi.hariIni
  const dari = a.dari ?? `${sampai.slice(0, 8)}01`
  if (dari > sampai) return galat('Tanggal "dari" setelah "sampai".')
  const d = await rekapDasar(ctx, dari, sampai, a.outlet)
  if ('galat' in d) return galat(d.galat!)
  const outlet = d.outlets.map((o) => {
    const b = d.baris.filter((x) => x.outlet === o.name)
    return {
      outlet: o.name,
      staf: b.length,
      telat: b.reduce((s, x) => s + x.telat, 0),
      telat_toleransi: b.reduce((s, x) => s + x.telat_toleransi, 0),
      alpa: b.reduce((s, x) => s + x.alpa, 0),
    }
  })
  return dgn(ctx, { status: 'ok', dari, sampai, hari_dinilai: d.hariDinilai, outlet, petunjuk_tampilan: PETUNJUK_REKAP })
}

async function telatBulanIni(ctx: KonteksHermes, a: { outlet?: string }) {
  const sampai = ctx.absensi.hariIni
  const dari = `${sampai.slice(0, 8)}01`
  const d = await rekapDasar(ctx, dari, sampai, a.outlet)
  if ('galat' in d) return galat(d.galat!)
  const orang = d.baris
    .filter((x) => x.telat + x.telat_toleransi + x.alpa > 0)
    .sort((x, y) => y.telat - x.telat || y.alpa - x.alpa || y.menit_telat - x.menit_telat || x.nama.localeCompare(y.nama, 'id'))
  return dgn(ctx, { status: 'ok', dari, sampai, hari_dinilai: d.hariDinilai, orang })
}

// Label sama dengan layar Perizinan HR (src/lib/types.ts LeaveType).
const LABEL_CUTI: Record<string, string> = {
  annual: 'Cuti Tahunan',
  sick: 'Sakit',
  personal: 'Izin Pribadi',
  maternity: 'Cuti Melahirkan',
  other: 'Lainnya',
}

async function cutiIzin(ctx: KonteksHermes, a: { tanggal?: string }) {
  const tanggal = a.tanggal ?? ctx.absensi.hariIni
  const [daftar, outlets] = await Promise.all([ctx.absensi.cuti(), ctx.absensi.outlets()])
  const nama = new Map(outlets.map((o) => [o.id, o.name]))
  const bentuk = (c: (typeof daftar)[number]) => ({
    nama: c.nama,
    outlet: (c.outletId && nama.get(c.outletId)) || '-',
    jenis: LABEL_CUTI[c.jenis] ?? c.jenis,
    mulai: c.mulai,
    selesai: c.selesai,
    hari: c.hari,
  })
  return dgn(ctx, {
    status: 'ok',
    tanggal,
    sedang_cuti: daftar.filter((c) => c.status === 'approved' && c.mulai <= tanggal && c.selesai >= tanggal).map(bentuk),
    menunggu: daftar.filter((c) => c.status === 'pending').map(bentuk),
  })
}

async function kasbonRingkasan(ctx: KonteksHermes) {
  const [baris, outlets] = await Promise.all([ctx.absensi.kasbon(), ctx.absensi.outlets()])
  const nama = new Map(outlets.map((o) => [o.id, o.name]))
  const outlet = baris
    .filter((b) => nama.has(b.outletId) && b.menungguJumlah + b.aktifJumlah > 0)
    .map((b) => ({ outlet: nama.get(b.outletId)!, menunggu_jumlah: b.menungguJumlah, menunggu_nominal: b.menungguNominal, aktif_jumlah: b.aktifJumlah, aktif_sisa: b.aktifSisa }))
    .sort((x, y) => x.outlet.localeCompare(y.outlet, 'id'))
  const total = outlet.reduce(
    (t, o) => ({ menunggu_jumlah: t.menunggu_jumlah + o.menunggu_jumlah, menunggu_nominal: t.menunggu_nominal + o.menunggu_nominal, aktif_jumlah: t.aktif_jumlah + o.aktif_jumlah, aktif_sisa: t.aktif_sisa + o.aktif_sisa }),
    { menunggu_jumlah: 0, menunggu_nominal: 0, aktif_jumlah: 0, aktif_sisa: 0 },
  )
  return dgn(ctx, { status: 'ok', outlet, total })
}

async function ceklistKepatuhan(ctx: KonteksHermes, a: { tanggal?: string }) {
  const tanggal = a.tanggal ?? ctx.absensi.hariIni
  const daftar = await ctx.absensi.ceklist(tanggal)
  const outlet = daftar.map((c) =>
    c.laporan
      ? { outlet: c.outlet.name, status: 'sudah_dicek', area_manager: c.laporan.namaAm, nilai: c.laporan.nilai, jumlah_temuan: c.laporan.jumlahTemuan, ditinjau: c.laporan.ditinjau }
      : { outlet: c.outlet.name, status: 'belum_dicek' },
  )
  const sudah = daftar.filter((c) => c.laporan)
  return dgn(ctx, {
    status: 'ok',
    tanggal,
    ringkas: {
      lokasi: daftar.length,
      sudah_dicek: sudah.length,
      belum_dicek: daftar.length - sudah.length,
      perlu_perhatian: sudah.filter((c) => c.laporan!.jumlahTemuan > 0 || (c.laporan!.nilai ?? 'baik') !== 'baik').length,
      belum_ditinjau: sudah.filter((c) => !c.laporan!.ditinjau).length,
    },
    outlet,
  })
}

export const ALAT_ABSENSI: DefinisiAlat[] = [
  {
    nama: 'absensi_hari_ini',
    domain: 'absensi',
    sumber: SUMBER_PAPAN,
    catatanMeta: CATATAN_ALPA,
    deskripsi: 'Kehadiran satu hari (default hari ini) per lokasi: ringkasan, siapa telat (menit), siapa belum hadir, siapa alpa. Angka = Papan Kehadiran.',
    skema: z.object({ tanggal: TGL.optional(), outlet: OUTLET.optional() }).strict(),
    contoh: {},
    jalankan: hariIni,
  },
  {
    nama: 'absensi_rekap',
    domain: 'absensi',
    sumber: SUMBER_REKAP,
    catatanMeta: CATATAN_ALPA,
    deskripsi: 'Rekap absensi rentang tanggal (default awal bulan s/d hari ini, maks 62 hari) per lokasi: jumlah staf, telat, telat toleransi, alpa. Angka = Rekap Absensi.',
    skema: z
      .object({ dari: TGL.optional(), sampai: TGL.optional(), outlet: OUTLET.optional() })
      .strict()
      .refine((a) => !a.dari || !a.sampai || selisihHari(a.dari, a.sampai) <= 61, 'rentang maksimal 62 hari'),
    contoh: { dari: '2026-10-01', sampai: '2026-10-07' },
    jalankan: rekap,
  },
  {
    nama: 'absensi_telat_bulan_ini',
    domain: 'absensi',
    sumber: SUMBER_REKAP,
    catatanMeta: CATATAN_ALPA,
    deskripsi: 'Daftar orang yang telat atau alpa bulan berjalan (awal bulan s/d hari ini), urut telat terbanyak: jumlah telat, telat toleransi, total menit telat, alpa.',
    skema: z.object({ outlet: OUTLET.optional() }).strict(),
    contoh: {},
    jalankan: telatBulanIni,
  },
  {
    nama: 'cuti_izin',
    domain: 'absensi',
    sumber: 'Perizinan HR (cuti & izin)',
    deskripsi: 'Siapa sedang cuti/izin yang sudah disetujui pada satu tanggal (default hari ini), dan semua pengajuan cuti/izin yang masih menunggu persetujuan.',
    skema: z.object({ tanggal: TGL.optional() }).strict(),
    contoh: {},
    jalankan: cutiIzin,
  },
  {
    nama: 'kasbon_ringkasan',
    domain: 'absensi',
    sumber: 'Perizinan HR (kasbon)',
    deskripsi: 'Kasbon per outlet: jumlah & nominal pengajuan yang masih menunggu persetujuan, jumlah kasbon aktif & sisa yang belum lunas. Agregat per outlet saja — tidak ada data per orang.',
    skema: z.object({}).strict(),
    contoh: {},
    jalankan: (ctx) => kasbonRingkasan(ctx),
  },
  {
    nama: 'ceklist_kepatuhan',
    domain: 'absensi',
    sumber: 'Ceklist Harian (HR)',
    deskripsi: 'Ceklist harian area manager per outlet pada satu tanggal (default hari ini): sudah/belum dicek, nilai terburuk, jumlah temuan, sudah ditinjau atau belum.',
    skema: z.object({ tanggal: TGL.optional() }).strict(),
    contoh: {},
    jalankan: ceklistKepatuhan,
  },
]
