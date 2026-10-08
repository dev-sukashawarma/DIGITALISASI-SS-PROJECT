import type { KonteksMarcom, PromoData } from './tipe'

export interface ParameterPromo {
  tanggal?: string // YYYY-MM-DD
  outlet?: string
}

export interface RingkasanPromo {
  total_aktif: number
  total_mendatang: number
}

export interface HasilPromoAktif {
  ringkasan: RingkasanPromo
  promo_aktif: PromoData[]
  promo_mendatang: PromoData[]
  meta: {
    sumber: string
    tanggal: string
    dihitung_pada: string
  }
}

export async function hitungPromoAktif(
  konteks: KonteksMarcom,
  params: ParameterPromo = {}
): Promise<HasilPromoAktif> {
  const tanggal = params.tanggal || konteks.hariIni
  const semuaPromo = await konteks.daftarPromo()

  let terfilter = semuaPromo
  if (params.outlet) {
    const outletKecil = params.outlet.toLowerCase()
    terfilter = terfilter.filter((p) =>
      p.outlet_nama.toLowerCase().includes(outletKecil)
    )
  }

  const promo_aktif = terfilter.filter(
    (p) => p.start_date <= tanggal && p.end_date >= tanggal
  )

  const promo_mendatang = terfilter.filter((p) => p.start_date > tanggal)

  const ringkasan: RingkasanPromo = {
    total_aktif: promo_aktif.length,
    total_mendatang: promo_mendatang.length,
  }

  return {
    ringkasan,
    promo_aktif,
    promo_mendatang,
    meta: {
      sumber: 'apps/marcom (database marcom_db)',
      tanggal,
      dihitung_pada: konteks.sekarang.toISOString(),
    },
  }
}
