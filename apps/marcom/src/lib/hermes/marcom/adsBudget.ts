import type { AdData, BudgetData, KonteksMarcom } from './tipe'

export interface ParameterAdsBudget {
  bulan?: number
  tahun?: number
  outlet?: string
}

export interface RingkasanBudget {
  total_target_budget: number
  total_spent: number
  sisa_budget: number
  persen_terpakai: number
  total_target_kol: number
  total_kol_tercapai: number
}

export interface OutletBudgetDetail {
  outlet_nama: string
  target_budget: number
  spent: number
  sisa_budget: number
  persen_terpakai: number
  target_kol: number
  kol_tercapai: number
}

export interface HasilAdsBudget {
  ringkasan_budget: RingkasanBudget
  per_outlet: OutletBudgetDetail[]
  iklan_aktif: AdData[]
  meta: {
    sumber: string
    bulan: number
    tahun: number
    dihitung_pada: string
  }
}

export async function hitungAdsBudget(
  konteks: KonteksMarcom,
  params: ParameterAdsBudget = {}
): Promise<HasilAdsBudget> {
  const bulan = params.bulan ?? konteks.sekarang.getMonth() + 1
  const tahun = params.tahun ?? konteks.sekarang.getFullYear()

  const semuaBudget = await konteks.daftarBudget(bulan, tahun)
  const semuaAds = await konteks.daftarAds()

  let budgetTerfilter = semuaBudget
  let adsTerfilter = semuaAds

  if (params.outlet) {
    const outletKecil = params.outlet.toLowerCase()
    budgetTerfilter = budgetTerfilter.filter((b) =>
      b.outlet_nama.toLowerCase().includes(outletKecil)
    )
    adsTerfilter = adsTerfilter.filter((a) =>
      a.outlet_nama.toLowerCase().includes(outletKecil)
    )
  }

  const total_target_budget = budgetTerfilter.reduce(
    (acc, b) => acc + (b.target_budget || 0),
    0
  )
  const total_spent = budgetTerfilter.reduce((acc, b) => acc + (b.spent || 0), 0)
  const sisa_budget = total_target_budget - total_spent
  const persen_terpakai =
    total_target_budget > 0
      ? Math.round((total_spent / total_target_budget) * 10000) / 100
      : 0

  const total_target_kol = budgetTerfilter.reduce(
    (acc, b) => acc + (b.target_kol_count || 0),
    0
  )
  const total_kol_tercapai = budgetTerfilter.reduce(
    (acc, b) => acc + (b.kol_count || 0),
    0
  )

  const ringkasan_budget: RingkasanBudget = {
    total_target_budget,
    total_spent,
    sisa_budget,
    persen_terpakai,
    total_target_kol,
    total_kol_tercapai,
  }

  const per_outlet: OutletBudgetDetail[] = budgetTerfilter.map((b) => {
    const sisa = b.target_budget - b.spent
    const persen =
      b.target_budget > 0
        ? Math.round((b.spent / b.target_budget) * 10000) / 100
        : 0
    return {
      outlet_nama: b.outlet_nama,
      target_budget: b.target_budget,
      spent: b.spent,
      sisa_budget: sisa,
      persen_terpakai: persen,
      target_kol: b.target_kol_count,
      kol_tercapai: b.kol_count,
    }
  })

  const iklan_aktif: AdData[] = adsTerfilter.filter((a) => a.status === 'ON')

  return {
    ringkasan_budget,
    per_outlet,
    iklan_aktif,
    meta: {
      sumber: 'apps/marcom (database marcom_db)',
      bulan,
      tahun,
      dihitung_pada: konteks.sekarang.toISOString(),
    },
  }
}
