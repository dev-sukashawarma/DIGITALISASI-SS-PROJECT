import type { EndorsementData, KonteksMarcom } from './tipe'

export interface ParameterEndorsement {
  status?: string
  outlet?: string
  kol_nama?: string
  limit?: number
}

export interface RingkasanEndorsement {
  total: number
  visit_pending: number
  draft_pending: number
  belum_posting: number
  belum_bayar: number
  total_biaya: number
}

export interface HasilEndorsement {
  ringkasan: RingkasanEndorsement
  daftar: EndorsementData[]
  meta: {
    sumber: string
    dihitung_pada: string
  }
}

export async function hitungEndorsement(
  konteks: KonteksMarcom,
  params: ParameterEndorsement = {}
): Promise<HasilEndorsement> {
  const semuaEndorsement = await konteks.daftarEndorsement()

  // 1. Hitung ringkasan dari semua endorsement sebelum filter spesifik
  const ringkasan: RingkasanEndorsement = {
    total: semuaEndorsement.length,
    visit_pending: semuaEndorsement.filter((e) => e.visit_status === 'PENDING').length,
    draft_pending: semuaEndorsement.filter(
      (e) => e.draft_status === 'PENDING' || e.draft_status === 'REVISION'
    ).length,
    belum_posting: semuaEndorsement.filter((e) => e.post_status !== 'POSTED').length,
    belum_bayar: semuaEndorsement.filter(
      (e) => e.payment_status === 'UNPAID' || e.payment_status === 'DOWN_PAYMENT'
    ).length,
    total_biaya: semuaEndorsement.reduce((total, e) => total + (e.rate_card || 0), 0),
  }

  // 2. Filter daftar endorsement berdasarkan parameter
  let daftar = semuaEndorsement.filter((e) => {
    if (params.status) {
      const statusUpper = params.status.toUpperCase()
      if (statusUpper === 'PENDING_VISIT' && e.visit_status !== 'PENDING') return false
      if (statusUpper === 'PENDING_DRAFT' && e.draft_status !== 'PENDING') return false
      if (statusUpper === 'DRAFT_REVISION' && e.draft_status !== 'REVISION') return false
      if (statusUpper === 'PENDING_POST' && e.post_status === 'POSTED') return false
      if (statusUpper === 'UNPAID' && e.payment_status !== 'UNPAID') return false
      if (statusUpper === 'DOWN_PAYMENT' && e.payment_status !== 'DOWN_PAYMENT') return false
      if (statusUpper === 'PAID' && e.payment_status !== 'PAID') return false
    }

    if (params.outlet) {
      const outletKecil = params.outlet.toLowerCase()
      if (!e.outlet_nama.toLowerCase().includes(outletKecil)) return false
    }

    if (params.kol_nama) {
      const kolKecil = params.kol_nama.toLowerCase()
      if (!e.kol_nama.toLowerCase().includes(kolKecil)) return false
    }

    return true
  })

  if (params.limit && params.limit > 0) {
    daftar = daftar.slice(0, params.limit)
  }

  // 3. Sanitasi output (hanya kembalikan field yang aman tanpa info rekening/kontak rahasia)
  const daftarSanitasi: EndorsementData[] = daftar.map((e) => ({
    id: e.id,
    kol_nama: e.kol_nama,
    outlet_nama: e.outlet_nama,
    schedule_date: e.schedule_date,
    visit_status: e.visit_status,
    draft_status: e.draft_status,
    post_status: e.post_status,
    payment_status: e.payment_status,
    rate_card: e.rate_card,
    tipe: e.tipe,
    post_url: e.post_url,
    views: e.views,
    likes: e.likes,
  }))

  return {
    ringkasan,
    daftar: daftarSanitasi,
    meta: {
      sumber: 'apps/marcom (database marcom_db)',
      dihitung_pada: konteks.sekarang.toISOString(),
    },
  }
}
