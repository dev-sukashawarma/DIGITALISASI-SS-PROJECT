import type { KontenData, KonteksMarcom } from './tipe'

export interface ParameterKonten {
  periode?: 'hari_ini' | 'kemarin' | 'minggu_ini' | 'minggu_depan' | 'bulan_ini' | 'custom' | string
  dari?: string // YYYY-MM-DD
  sampai?: string // YYYY-MM-DD
  platform?: string
  outlet?: string
  status?: 'sudah_posting' | 'belum_posting' | 'siap_tayang' | 'draft' | string
  limit?: number
}

export interface RingkasanKonten {
  total: number
  sudah_posting: number
  siap_tayang: number
  dalam_proses: number
  total_views: number
  total_likes: number
}

export interface HasilJadwalKonten {
  ringkasan: RingkasanKonten
  daftar: KontenData[]
  meta: {
    sumber: string
    periode: string
    dari: string
    sampai: string
    dihitung_pada: string
  }
}

function parseTanggal(str: string): Date {
  const [tahun, bulan, hari] = str.split('-').map(Number)
  return new Date(Date.UTC(tahun, bulan - 1, hari, 12, 0, 0))
}

function formatTanggal(d: Date): string {
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const date = String(d.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${date}`
}

export function tentukanRentangTanggal(
  hariIni: string,
  periode?: string,
  dariUser?: string,
  sampaiUser?: string
): { dari: string; sampai: string; namaPeriode: string } {
  if (dariUser && sampaiUser) {
    return {
      dari: dariUser,
      sampai: sampaiUser,
      namaPeriode: periode || 'custom',
    }
  }

  const tgl = parseTanggal(hariIni)
  const namaPeriode = periode || 'hari_ini'

  switch (namaPeriode) {
    case 'kemarin': {
      const kemarin = new Date(tgl)
      kemarin.setUTCDate(tgl.getUTCDate() - 1)
      const kStr = formatTanggal(kemarin)
      return { dari: kStr, sampai: kStr, namaPeriode }
    }
    case 'minggu_ini': {
      // 0 = Minggu, 1 = Senin, ..., 6 = Sabtu
      const day = tgl.getUTCDay()
      const diffToMonday = day === 0 ? -6 : 1 - day
      const senin = new Date(tgl)
      senin.setUTCDate(tgl.getUTCDate() + diffToMonday)
      const minggu = new Date(senin)
      minggu.setUTCDate(senin.getUTCDate() + 6)
      return {
        dari: formatTanggal(senin),
        sampai: formatTanggal(minggu),
        namaPeriode,
      }
    }
    case 'minggu_depan': {
      const day = tgl.getUTCDay()
      const diffToMonday = day === 0 ? 1 : 8 - day
      const senin = new Date(tgl)
      senin.setUTCDate(tgl.getUTCDate() + diffToMonday)
      const minggu = new Date(senin)
      minggu.setUTCDate(senin.getUTCDate() + 6)
      return {
        dari: formatTanggal(senin),
        sampai: formatTanggal(minggu),
        namaPeriode,
      }
    }
    case 'bulan_ini': {
      const thn = tgl.getUTCFullYear()
      const bln = tgl.getUTCMonth()
      const awalBulan = new Date(Date.UTC(thn, bln, 1, 12, 0, 0))
      const akhirBulan = new Date(Date.UTC(thn, bln + 1, 0, 12, 0, 0))
      return {
        dari: formatTanggal(awalBulan),
        sampai: formatTanggal(akhirBulan),
        namaPeriode,
      }
    }
    case 'hari_ini':
    default: {
      return { dari: hariIni, sampai: hariIni, namaPeriode: 'hari_ini' }
    }
  }
}

export async function hitungJadwalKonten(
  konteks: KonteksMarcom,
  params: ParameterKonten = {}
): Promise<HasilJadwalKonten> {
  const rentang = tentukanRentangTanggal(
    konteks.hariIni,
    params.periode,
    params.dari,
    params.sampai
  )

  const semuaKonten = await konteks.daftarKonten(rentang.dari, rentang.sampai)

  // Filter berdasarkan platform, outlet, status
  let daftar = semuaKonten.filter((k) => {
    if (params.platform) {
      if (k.platform.toUpperCase() !== params.platform.toUpperCase()) return false
    }

    if (params.outlet) {
      const outletKecil = params.outlet.toLowerCase()
      if (!k.outletName.toLowerCase().includes(outletKecil)) return false
    }

    if (params.status) {
      const statusKecil = params.status.toLowerCase()
      if (statusKecil === 'sudah_posting' && k.status !== 'Sudah Posting') return false
      if (statusKecil === 'belum_posting' && k.status === 'Sudah Posting') return false
      if (statusKecil === 'siap_tayang' && k.status !== 'Siap Tayang') return false
      if (statusKecil === 'draft' && k.status !== 'Draft') return false
    }

    return true
  })

  // Urutkan berdasarkan postDate asc, postTime asc
  daftar.sort((a, b) => {
    const cmpTgl = a.postDate.localeCompare(b.postDate)
    if (cmpTgl !== 0) return cmpTgl
    return (a.postTime || '').localeCompare(b.postTime || '')
  })

  // Hitung ringkasan
  const ringkasan: RingkasanKonten = {
    total: daftar.length,
    sudah_posting: daftar.filter((k) => k.status === 'Sudah Posting').length,
    siap_tayang: daftar.filter((k) => k.status === 'Siap Tayang').length,
    dalam_proses: daftar.filter(
      (k) => k.status !== 'Sudah Posting' && k.status !== 'Siap Tayang'
    ).length,
    total_views: daftar.reduce((acc, k) => acc + (k.views || 0), 0),
    total_likes: daftar.reduce((acc, k) => acc + (k.likes || 0), 0),
  }

  if (params.limit && params.limit > 0) {
    daftar = daftar.slice(0, params.limit)
  }

  return {
    ringkasan,
    daftar,
    meta: {
      sumber: 'apps/marcom (database marcom_db)',
      periode: rentang.namaPeriode,
      dari: rentang.dari,
      sampai: rentang.sampai,
      dihitung_pada: konteks.sekarang.toISOString(),
    },
  }
}
