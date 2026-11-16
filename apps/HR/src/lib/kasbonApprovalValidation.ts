/**
 * Helper dan validasi untuk persetujuan (approval) kasbon dengan penyesuaian nominal dan catatan alasan.
 */

export interface KasbonApprovalValidationResult {
  isValid: boolean
  error?: string
  isAmountDifferent: boolean
  isTenorDifferent: boolean
}

export function validateKasbonApproval(
  requestedAmount: number,
  approvedAmount: number,
  approvalNote: string,
  requestedMonths?: number,
  approvedMonths?: number
): KasbonApprovalValidationResult {
  const req = Math.round(Number(requestedAmount) || 0)
  const app = Math.round(Number(approvedAmount) || 0)
  const isTenorDifferent =
    requestedMonths !== undefined &&
    approvedMonths !== undefined &&
    Math.round(Number(requestedMonths) || 1) !== Math.round(Number(approvedMonths) || 1)

  if (!Number.isFinite(app) || app <= 0) {
    return {
      isValid: false,
      error: 'Nominal yang disetujui harus lebih dari Rp 0',
      isAmountDifferent: false,
      isTenorDifferent,
    }
  }

  if (
    approvedMonths !== undefined &&
    (!Number.isInteger(approvedMonths) || approvedMonths < 1 || approvedMonths > 6)
  ) {
    return {
      isValid: false,
      error: 'Tenor cicilan harus antara 1 sampai 6 bulan',
      isAmountDifferent: app !== req,
      isTenorDifferent,
    }
  }

  const isAmountDifferent = app !== req

  if (isAmountDifferent) {
    const trimmedNote = (approvalNote || '').trim()
    if (trimmedNote.length < 3) {
      return {
        isValid: false,
        error: 'Alasan perubahan nominal wajib diisi (minimal 3 karakter)',
        isAmountDifferent: true,
        isTenorDifferent,
      }
    }
  }

  return {
    isValid: true,
    isAmountDifferent,
    isTenorDifferent,
  }
}
