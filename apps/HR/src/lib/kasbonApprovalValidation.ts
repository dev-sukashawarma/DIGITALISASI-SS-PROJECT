/**
 * Helper dan validasi untuk persetujuan (approval) kasbon dengan penyesuaian nominal dan catatan alasan.
 */

export interface KasbonApprovalValidationResult {
  isValid: boolean
  error?: string
  isAmountDifferent: boolean
}

export function validateKasbonApproval(
  requestedAmount: number,
  approvedAmount: number,
  approvalNote: string
): KasbonApprovalValidationResult {
  const req = Math.round(Number(requestedAmount) || 0)
  const app = Math.round(Number(approvedAmount) || 0)

  if (!Number.isFinite(app) || app <= 0) {
    return {
      isValid: false,
      error: 'Nominal yang disetujui harus lebih dari Rp 0',
      isAmountDifferent: false,
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
      }
    }
  }

  return {
    isValid: true,
    isAmountDifferent,
  }
}
