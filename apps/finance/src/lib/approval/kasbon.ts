/** Satu baris antrean pencairan kasbon (RPC finance_kasbon_menunggu). */
export interface KasbonMenunggu {
  id: string
  staff_id: string
  staff_nama: string | null
  outlet_nama: string | null
  amount: number
  amount_requested: number | null
  reason: string | null
  installment_months: number | null
  approval_note: string | null
  approved_at: string | null
  /** Penyetuju di HR; NULL hanya pada kasbon lama. */
  approved_by: string | null
  penyetuju_nama: string | null
  created_at: string
}

export const ALASAN_PENYETUJU_SAMA = 'Anda menyetujui kasbon ini di HR, pencairan harus oleh orang lain'

/** Yang menyetujui di HR tidak boleh mencairkan (DB juga menolak). */
export function bolehCairkan(
  k: Pick<KasbonMenunggu, 'approved_by'>,
  userId: string | null,
): { boleh: boolean; alasan: string | null } {
  if (k.approved_by && userId && k.approved_by === userId) return { boleh: false, alasan: ALASAN_PENYETUJU_SAMA }
  return { boleh: true, alasan: null }
}

/** Pencairan bisa dibatalkan hanya selama kasbon aktif dan belum pernah dipotong/dicicil. */
export function bolehBatalCair(k: { status: string; amount: number; remaining: number | null }): boolean {
  return k.status === 'active' && Number(k.remaining) === Number(k.amount)
}
