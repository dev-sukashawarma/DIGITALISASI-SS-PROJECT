import { usePerizinanSummary } from '@/hooks/useLeaveRequests'

/**
 * Badge pengajuan pending di sidebar/bottom-nav. Memakai ringkasan yang sama
 * dengan halaman Perizinan (satu RPC, akun tes dikecualikan) — dulu dua query
 * count terpisah tiap 15 detik di setiap halaman.
 */
export function useApprovalNotifications() {
  const { data } = usePerizinanSummary()
  const pendingLeaves = data?.cuti.pending ?? 0
  const pendingKasbon = data?.kasbon.pending ?? 0
  const totalPending = pendingLeaves + pendingKasbon

  return {
    pendingLeavesCount: pendingLeaves,
    pendingKasbonCount: pendingKasbon,
    pendingCount: totalPending,
    totalPendingCount: totalPending,
  }
}

// Backwards compatibility
export const useLeaveNotifications = useApprovalNotifications
