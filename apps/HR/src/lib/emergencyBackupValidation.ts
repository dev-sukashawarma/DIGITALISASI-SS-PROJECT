/**
 * Aturan validasi penugasan darurat (BKO Sementara) untuk Kru Reguler.
 */

export function validateEmergencyCrewEligibility(staff: {
  role: string
  sub_role?: string | null
  status: string
  outlet_id: string | null
  name?: string
}): { ok: boolean; error?: string } {
  if (staff.status !== 'active') {
    return { ok: false, error: `Karyawan "${staff.name || 'terpilih'}" berstatus non-aktif` }
  }

  const disallowRoles = ['area_manager', 'regional_manager', 'spv', 'korlap', 'crew_backup']
  if (disallowRoles.includes(staff.role) || staff.sub_role === 'crew_backup') {
    return {
      ok: false,
      error: `Penugasan BKO Darurat hanya diperuntukkan bagi Kru Reguler. Role "${staff.role}" sudah memiliki akses multi-cabang/backup tersendiri.`,
    }
  }

  if (!staff.outlet_id) {
    return { ok: false, error: `Karyawan "${staff.name || 'terpilih'}" belum memiliki outlet penugasan tetap (Home Outlet)` }
  }

  return { ok: true }
}

export function validateEmergencyAssignmentInput(params: {
  originOutletId: string
  targetOutletId: string
  targetOutletActive: boolean
  assignmentDate: string
}): { ok: boolean; error?: string } {
  if (!params.targetOutletId) {
    return { ok: false, error: 'Outlet tujuan wajib dipilih' }
  }

  if (params.originOutletId === params.targetOutletId) {
    return { ok: false, error: 'Outlet tujuan BKO tidak boleh sama dengan Outlet asal (Home Outlet) karyawan' }
  }

  if (!params.targetOutletActive) {
    return { ok: false, error: 'Outlet tujuan sedang nonaktif' }
  }

  if (!params.assignmentDate || !/^\d{4}-\d{2}-\d{2}$/.test(params.assignmentDate)) {
    return { ok: false, error: 'Format tanggal penugasan tidak valid (harus YYYY-MM-DD)' }
  }

  return { ok: true }
}
