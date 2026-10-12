import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { CreateEmergencyAssignmentInput, EmergencyCrewAssignment } from '@/lib/types'
import {
  getEmergencyAssignments,
  createEmergencyAssignment,
  cancelEmergencyAssignment,
  getEligibleRegularCrews,
  getEmergencyOutlets,
  type GetEmergencyAssignmentsParams,
} from '@/app/actions/emergencyBackup'

export function useEmergencyAssignments(params?: GetEmergencyAssignmentsParams) {
  return useQuery<EmergencyCrewAssignment[]>({
    queryKey: ['emergency-assignments', params?.date, params?.month, params?.status, params?.outletId],
    queryFn: async () => {
      const res = await getEmergencyAssignments(params)
      if (!res.ok) throw new Error(res.error || 'Gagal memuat data penugasan darurat')
      return res.data || []
    },
    staleTime: 30_000,
    refetchInterval: 60_000, // periodic refresh to reflect real-time attendance
  })
}

export function useEligibleRegularCrews(search?: string) {
  return useQuery({
    queryKey: ['eligible-regular-crews', search],
    queryFn: async () => {
      const res = await getEligibleRegularCrews(search)
      if (!res.ok) throw new Error(res.error || 'Gagal memuat kru reguler')
      return res.data || []
    },
    staleTime: 60_000,
  })
}

export function useEmergencyOutlets() {
  return useQuery({
    queryKey: ['emergency-outlets'],
    queryFn: async () => {
      const res = await getEmergencyOutlets()
      if (!res.ok) throw new Error(res.error || 'Gagal memuat outlet')
      return res.data || []
    },
    staleTime: 5 * 60_000,
  })
}

export function useEmergencyMutations() {
  const qc = useQueryClient()

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['emergency-assignments'] })
    qc.invalidateQueries({ queryKey: ['eligible-regular-crews'] })
  }

  const create = useMutation({
    mutationFn: async (values: CreateEmergencyAssignmentInput) => {
      const res = await createEmergencyAssignment(values)
      if (!res.ok) throw new Error(res.error || 'Gagal membuat penugasan darurat')
      return res.data
    },
    onSuccess: invalidate,
  })

  const cancel = useMutation({
    mutationFn: async (assignmentId: string) => {
      const res = await cancelEmergencyAssignment(assignmentId)
      if (!res.ok) throw new Error(res.error || 'Gagal membatalkan penugasan darurat')
      return res
    },
    onSuccess: invalidate,
  })

  return {
    create,
    cancel,
  }
}
